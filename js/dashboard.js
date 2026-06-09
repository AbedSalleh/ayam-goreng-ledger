// ============================================================
// 📊 AyamDashboard — Dashboard data fetching & rendering
// Reads from AyamSheets and renders dashboard metrics
// ============================================================

const AyamDashboard = (() => {
  let currentMonth = new Date().getMonth(); // 0-indexed
  let currentYear = new Date().getFullYear();
  let targetProfit = 2000;
  let allTxEntries = [];

  // Month names
  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // Category colors for expense breakdown
  const CATEGORY_COLORS = {
    'Raw Chicken': '#EF4444',
    'Cooking Oil/Gas': '#F59E0B',
    'Flour/Spices': '#8B5CF6',
    'Rent/Stall': '#3B82F6',
    'Packaging': '#10B981',
    'Transport': '#EC4899',
    'Others': '#6B7280'
  };

  /**
   * Format a number as RM currency string.
   * @param {number} amount
   * @returns {string} e.g. "RM 1,234.50"
   */
  function formatRM(amount) {
    return 'RM ' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Animate a number counting up inside an element.
   * @param {HTMLElement} el — target element
   * @param {number} end — final value
   * @param {number} duration — animation duration in ms
   * @param {boolean} isCurrency — whether to format as RM
   */
  function animateNumber(el, end, duration = 600, isCurrency = true) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      el.textContent = isCurrency ? formatRM(current) : Math.round(current).toString();
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = isCurrency ? formatRM(end) : Math.round(end).toString();
      }
    }

    requestAnimationFrame(tick);
  }

  /**
   * Animate a progress bar's width from 0 to target %.
   * @param {HTMLElement} bar — the fill element
   * @param {number} pct — target percentage (0-100)
   */
  function animateBar(bar, pct, duration = 800) {
    if (!bar) return;
    bar.style.width = '0%';
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      bar.style.width = (pct * eased).toFixed(1) + '%';
      if (progress < 1) requestAnimationFrame(tick);
      else bar.style.width = pct.toFixed(1) + '%';
    }

    requestAnimationFrame(tick);
  }

  /**
   * Parse a date string timezone-safely, supporting YYYY-MM-DD (hyphens) as UTC
   * and local formats (slashes) as local time.
   * @param {string} dateStr
   * @returns {{ year: number, month: number, day: number }|null}
   */
  function parseDateTimezoneSafe(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth(),
          day: d.getUTCDate()
        };
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate()
      };
    }
    return null;
  }

  /**
   * Filter rows by current month/year.
   * @param {Array[]} rows
   * @param {number} dateColIndex
   * @returns {Array[]}
   */
  function filterByMonth(rows, dateColIndex) {
    return rows.filter(row => {
      if (!row[dateColIndex]) return false;
      const parsed = parseDateTimezoneSafe(row[dateColIndex]);
      if (!parsed) return false;
      return parsed.month === currentMonth && parsed.year === currentYear;
    });
  }

  /**
   * Format a date string into a human-readable form.
   * @param {string} dateStr
   * @returns {string} e.g. "30 May"
   */
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const parsed = parseDateTimezoneSafe(dateStr);
    if (!parsed) return dateStr;
    return parsed.day + ' ' + MONTHS[parsed.month].slice(0, 3);
  }

  /**
   * Safely get an element by id.
   */
  function $(id) {
    return document.getElementById(id);
  }

  return {
    getCurrentMonth() { return currentMonth; },
    getCurrentYear() { return currentYear; },

    /**
     * Load and render dashboard data for the current month.
     */
    async load() {
      // Show loading, hide content
      const loading = $('dash-loading');
      if (loading) loading.classList.remove('hidden');

      try {
        // Fetch data in parallel
        const [salesRows, expenseRows, target, inventoryRows] = await Promise.all([
          AyamSheets.getSalesData(),
          AyamSheets.getExpensesData(),
          AyamSheets.getTargetProfit(),
          AyamSheets.getInventoryData().catch(e => {
            console.warn('Could not load inventory for dashboard alerts:', e);
            return [];
          })
        ]);

        targetProfit = target || 2000;

        // Check low stock items
        const lowStockItems = [];
        (inventoryRows || []).forEach(row => {
          const name = row[0];
          const qty = parseFloat(row[1]) || 0;
          const minAlert = parseFloat(row[3]) || 0;
          const unit = row[2] || '';
          if (name && qty <= minAlert) {
            lowStockItems.push(`${name} (${qty} ${unit})`);
          }
        });

        // Show/hide low stock warning banner
        const alertBanner = $('dash-stock-alert');
        const alertText = $('dash-stock-alert-text');
        if (alertBanner && alertText) {
          if (lowStockItems.length > 0) {
            alertText.textContent = `The following items are running low: ${lowStockItems.join(', ')}.`;
            alertBanner.classList.remove('hidden');
          } else {
            alertBanner.classList.add('hidden');
          }
        }

        // Filter by current month
        const monthlySales = filterByMonth(salesRows || [], 0);
        const monthlyExpenses = filterByMonth(expenseRows || [], 0);

        // Calculate metrics
        let totalCash = 0, totalQR = 0, totalRevenue = 0;
        let totalExpenses = 0, totalCOGS = 0, totalOPEX = 0;
        let totalPayable = 0;

        monthlySales.forEach(row => {
          const cash = parseFloat(row[1]) || 0;
          const qr = parseFloat(row[2]) || 0;
          totalCash += cash;
          totalQR += qr;
          totalRevenue += cash + qr;
        });

        monthlyExpenses.forEach(row => {
          const amt = parseFloat(row[2]) || 0;
          totalExpenses += amt;

          // Detect Direct (COGS) vs Indirect (OPEX)
          let type = row[3];
          if (row.length <= 5 || !type) {
            const directCategories = ['Raw Chicken', 'Cooking Oil/Gas', 'Flour/Spices', 'Packaging'];
            type = directCategories.includes(row[1]) ? 'Direct (COGS)' : 'Indirect (OPEX)';
          }

          if (type === 'Direct (COGS)') {
            totalCOGS += amt;
          } else {
            totalOPEX += amt;
          }

          // Detect Accounts Payable (Unpaid status)
          const status = row.length > 5 ? row[5] : 'Paid';
          if (status === 'Unpaid') {
            totalPayable += amt;
          }
        });

        const grossProfit = totalRevenue - totalCOGS;
        const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const netProfit = totalRevenue - totalExpenses;
        const progressPct = targetProfit > 0
          ? Math.min(Math.max((netProfit / targetProfit) * 100, 0), 100)
          : 0;

        // Check empty state
        if (monthlySales.length === 0 && monthlyExpenses.length === 0) {
          this._renderEmptyState();
        } else {
          this._hideEmptyState();
          // Render metrics
          this._renderMetrics({
            revenue: totalRevenue,
            cash: totalCash,
            qr: totalQR,
            expenses: totalExpenses,
            cogs: totalCOGS,
            opex: totalOPEX,
            grossProfit: grossProfit,
            grossMargin: grossMarginPct,
            payable: totalPayable,
            profit: netProfit,
            progressPct: progressPct
          });
          // Render category breakdown
          this._renderCategories(monthlyExpenses, totalExpenses);
          // Render recent transactions
          this._renderRecent(salesRows || [], expenseRows || []);
        }

      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        if (loading) loading.classList.add('hidden');
      }
    },

    /**
     * Show an empty state message when there's no data for the month.
     */
    _renderEmptyState() {
      // Update month label
      const monthLabel = $('dash-month-label');
      if (monthLabel) monthLabel.textContent = MONTHS[currentMonth] + ' ' + currentYear;

      // Clear data areas
      [$('dash-revenue'), $('dash-revenue-cash'), $('dash-revenue-qr'),
       $('dash-expenses'), $('dash-expenses-cogs'), $('dash-expenses-opex'),
       $('dash-gross-profit'), $('dash-gross-margin'), $('dash-payable'), 
       $('dash-profit')].forEach(el => {
        if (el) {
          if (el.id === 'dash-gross-margin') {
            el.textContent = '0.0%';
          } else {
            el.textContent = formatRM(0);
          }
        }
      });

      const targetEl = $('dash-target');
      if (targetEl) targetEl.textContent = 'Target: ' + formatRM(targetProfit);

      const progressBar = $('dash-progress-bar');
      if (progressBar) progressBar.style.width = '0%';

      const progressPct = $('dash-progress-pct');
      if (progressPct) progressPct.textContent = '0%';

      const profitEl = $('dash-profit');
      if (profitEl) {
        profitEl.style.color = '';
      }

      // Show empty state in categories
      const categoriesEl = $('dash-categories');
      if (categoriesEl) {
        categoriesEl.innerHTML = '';
      }

      // Show empty state in recent
      const recentEl = $('dash-recent');
      if (recentEl) {
        recentEl.innerHTML = `
          <div style="text-align:center; padding:2.5rem 1rem; opacity:0.7;">
            <div style="display:flex; justify-content:center; margin-bottom:0.75rem; color:#94A3B8;">
              <svg style="width:3rem; height:3rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <p style="font-size:1.1rem; font-weight:600; margin-bottom:0.35rem; color:#292524;">
              No data for this month yet
            </p>
            <p style="font-size:0.9rem; color:#78716C;">
              Start by recording a sale! Tap the <strong>Sales</strong> tab below.
            </p>
          </div>
        `;
      }
    },

    /**
     * Hide empty state elements if they exist.
     */
    _hideEmptyState() {
      // Nothing to do — renderRecent and renderCategories will overwrite content
    },

    /**
     * Render all numeric metric elements with count-up animations.
     */
    _renderMetrics(metrics) {
      // Month label
      const monthLabel = $('dash-month-label');
      if (monthLabel) monthLabel.textContent = MONTHS[currentMonth] + ' ' + currentYear;

      // Animated number fills
      animateNumber($('dash-revenue'), metrics.revenue);
      animateNumber($('dash-revenue-cash'), metrics.cash);
      animateNumber($('dash-revenue-qr'), metrics.qr);
      
      animateNumber($('dash-expenses'), metrics.expenses);
      animateNumber($('dash-expenses-cogs'), metrics.cogs);
      animateNumber($('dash-expenses-opex'), metrics.opex);

      animateNumber($('dash-gross-profit'), metrics.grossProfit);
      
      // Margin animation
      const marginEl = $('dash-gross-margin');
      if (marginEl) {
        animateNumber(marginEl, metrics.grossMargin, 800, false);
        setTimeout(() => {
          if (marginEl) marginEl.textContent = metrics.grossMargin.toFixed(1) + '%';
        }, 850);
      }

      animateNumber($('dash-payable'), metrics.payable);
      animateNumber($('dash-profit'), metrics.profit);

      // Target label
      const targetEl = $('dash-target');
      if (targetEl) targetEl.textContent = 'Target: ' + formatRM(targetProfit);

      // Progress bar
      const progressBar = $('dash-progress-bar');
      const pct = metrics.progressPct;
      if (progressBar) {
        // Color the bar based on progress
        if (pct >= 100) {
          progressBar.style.background = 'linear-gradient(90deg, #10B981, #34D399)';
        } else if (pct >= 60) {
          progressBar.style.background = 'linear-gradient(90deg, #F59E0B, #FBBF24)';
        } else {
          progressBar.style.background = 'linear-gradient(90deg, #EF4444, #F87171)';
        }
        animateBar(progressBar, pct);
      }

      // Progress percentage text
      const progressPctEl = $('dash-progress-pct');
      if (progressPctEl) {
        animateNumber(progressPctEl, Math.round(pct), 800, false);
        // Append % after animation settles
        setTimeout(() => {
          if (progressPctEl) progressPctEl.textContent = Math.round(pct) + '%';
        }, 850);
      }

      // Profit text color: green if positive, red if negative
      const profitEl = $('dash-profit');
      if (profitEl) {
        if (metrics.profit >= 0) {
          profitEl.style.color = '#065F46'; // emerald-900
        } else {
          profitEl.style.color = '#991B1B'; // red-900
        }
      }
    },

    /**
     * Render expense category breakdown as animated horizontal bars.
     */
    _renderCategories(expenses, total) {
      const container = $('dash-categories');
      if (!container) return;
      container.innerHTML = '';

      if (!expenses.length || total === 0) {
        container.innerHTML = `
          <p style="text-align:center; padding:1rem; opacity:0.5; font-size:0.85rem; color:#78716C;">
            No expenses recorded this month
          </p>
        `;
        return;
      }

      // Group by category (column index 1)
      const grouped = {};
      expenses.forEach(row => {
        const cat = row[1] || 'Others';
        const amt = parseFloat(row[2]) || 0;
        grouped[cat] = (grouped[cat] || 0) + amt;
      });

      // Sort by amount descending
      const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);

      sorted.forEach(([category, amount], index) => {
        const pct = total > 0 ? (amount / total) * 100 : 0;
        const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['Others'];

        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom:0.75rem;';

        // Header: category name + amount
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem; font-size:0.82rem; color:#57534E;';

        const catName = document.createElement('span');
        catName.style.cssText = 'display:flex; align-items:center; gap:0.4rem; font-weight:500; color:#292524;';
        // Color dot
        const dot = document.createElement('span');
        dot.style.cssText = `width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block; flex-shrink:0;`;
        catName.appendChild(dot);
        catName.appendChild(document.createTextNode(category));

        const catAmt = document.createElement('span');
        catAmt.style.cssText = 'color:#78716C; font-variant-numeric:tabular-nums;';
        catAmt.textContent = formatRM(amount) + '  (' + pct.toFixed(0) + '%)';

        header.appendChild(catName);
        header.appendChild(catAmt);

        // Bar track
        const track = document.createElement('div');
        track.style.cssText = 'width:100%; height:6px; background:rgba(0,0,0,0.06); border-radius:3px; overflow:hidden;';

        const fill = document.createElement('div');
        fill.style.cssText = `height:100%; border-radius:3px; background:${color}; width:0%; transition:width 0.8s cubic-bezier(0.22,1,0.36,1);`;

        track.appendChild(fill);
        row.appendChild(header);
        row.appendChild(track);
        container.appendChild(row);

        // Animate bar after a staggered delay
        setTimeout(() => {
          fill.style.width = pct + '%';
        }, 100 + index * 80);
      });
    },

    /**
     * Render recent transactions list — last 5 entries combined from sales & expenses.
     */
    _renderRecent(sales, expenses) {
      allTxEntries = [];

      // Sales entries: [date, cash, qr, total, notes, timestamp]
      (sales || []).forEach(row => {
        const cash = parseFloat(row[1]) || 0;
        const qr = parseFloat(row[2]) || 0;
        const total = cash + qr;
        if (total === 0) return;
        allTxEntries.push({
          type: 'sale',
          date: row[0],
          amount: total,
          label: row[4] || 'Daily Sales',
          timestamp: row[5] || row[0]
        });
      });

      // Expense entries: [date, category, amount, type, vendor, status, notes, timestamp]
      (expenses || []).forEach(row => {
        const amt = parseFloat(row[2]) || 0;
        if (amt === 0) return;
        
        let labelText = row[1] || 'Expense';
        let timestampVal = row[0];
        
        if (row.length <= 5) {
          // Old format: [date, category, amount, notes, timestamp]
          timestampVal = row[4] || row[0];
          if (row[3]) {
            labelText += ` (${row[3]})`;
          }
        } else {
          // New format: [date, category, amount, type, vendor, status, notes, timestamp]
          timestampVal = row[7] || row[0];
          if (row[4] && row[4] !== 'General') {
            labelText += ` - ${row[4]}`;
          }
          if (row[5] === 'Unpaid') {
            labelText += ' [UNPAID]';
          }
        }
        
        allTxEntries.push({
          type: 'expense',
          date: row[0],
          amount: amt,
          label: labelText,
          timestamp: timestampVal
        });
      });

      // Render with filters/sort
      this.filterRecent();
    },

    /**
     * Filter and sort the cached transactions, then render them to the DOM.
     */
    filterRecent() {
      const container = $('dash-recent');
      if (!container) return;

      const searchInput = $('tx-search');
      const typeFilter = $('tx-filter-type');
      const sortSelect = $('tx-sort');

      const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
      const type = typeFilter ? typeFilter.value : 'all';
      const sortBy = sortSelect ? sortSelect.value : 'time-desc';

      // 1. Filter
      let filtered = allTxEntries;
      if (type !== 'all') {
        filtered = filtered.filter(entry => entry.type === type);
      }
      if (query) {
        filtered = filtered.filter(entry => {
          return (
            entry.label.toLowerCase().includes(query) ||
            entry.date.includes(query) ||
            String(entry.amount).includes(query)
          );
        });
      }

      // 2. Sort
      filtered.sort((a, b) => {
        if (sortBy === 'time-desc') {
          const tA = new Date(a.timestamp).getTime() || 0;
          const tB = new Date(b.timestamp).getTime() || 0;
          return tB - tA;
        } else if (sortBy === 'time-asc') {
          const tA = new Date(a.timestamp).getTime() || 0;
          const tB = new Date(b.timestamp).getTime() || 0;
          return tA - tB;
        } else if (sortBy === 'amount-desc') {
          return b.amount - a.amount;
        } else if (sortBy === 'amount-asc') {
          return a.amount - b.amount;
        }
        return 0;
      });

      // 3. Render
      container.innerHTML = '';

      if (filtered.length === 0) {
        container.innerHTML = `
          <p style="text-align:center; padding:2.5rem 1rem; opacity:0.5; font-size:0.85rem; color:#78716C;">
            No transactions match search/filter.
          </p>
        `;
        return;
      }

      filtered.forEach((entry, index) => {
        const isSale = entry.type === 'sale';
        const row = document.createElement('div');
        row.style.cssText = `
          display:flex; align-items:center; gap:0.75rem;
          padding:0.7rem 0;
          border-bottom:1px solid rgba(0,0,0,0.06);
          opacity:0; transform:translateY(8px);
          animation:dashFadeIn 0.35s ease forwards;
          animation-delay:${Math.min(index * 0.03, 0.5)}s;
        `;

        // Icon badge (CR / DR)
        const icon = document.createElement('div');
        icon.style.cssText = `
          width:36px; height:36px; border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          font-size:0.75rem; font-weight:700; flex-shrink:0;
          font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background:${isSale ? 'rgba(13,148,136,0.1)' : 'rgba(225,29,72,0.1)'};
          color:${isSale ? '#0d9488' : '#e11d48'};
          border:1px solid ${isSale ? 'rgba(13,148,136,0.2)' : 'rgba(225,29,72,0.2)'};
        `;
        icon.textContent = isSale ? 'CR' : 'DR';

        // Info
        const info = document.createElement('div');
        info.style.cssText = 'flex:1; min-width:0;';

        const label = document.createElement('div');
        label.style.cssText = 'font-size:0.85rem; font-weight:500; color:#292524; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
        label.textContent = entry.label;

        const dateLine = document.createElement('div');
        dateLine.style.cssText = 'font-size:0.75rem; color:#78716C; margin-top:1px;';
        dateLine.textContent = formatDateShort(entry.date);

        info.appendChild(label);
        info.appendChild(dateLine);

        // Amount
        const amtEl = document.createElement('div');
        amtEl.style.cssText = `
          font-size:0.9rem; font-weight:600; font-variant-numeric:tabular-nums; flex-shrink:0;
          color:${isSale ? '#34D399' : '#F87171'};
        `;
        amtEl.textContent = (isSale ? '+' : '-') + formatRM(entry.amount);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all ml-1.5 flex-shrink-0';
        deleteBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        `;
        deleteBtn.title = 'Delete transaction';
        deleteBtn.onclick = async () => {
          if (confirm(`Are you sure you want to delete this "${entry.label}" entry?`)) {
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = `
              <svg class="w-4 h-4 animate-spin text-red-500" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            `;
            try {
              const tab = isSale ? 'Daily_Sales' : 'Expenses';
              const success = await AyamSheets.deleteRowByTimestamp(tab, entry.timestamp);
              if (success) {
                if (typeof AyamApp !== 'undefined') {
                  AyamApp.showToast('Transaction deleted successfully', 'success');
                }
                // Reload dashboard data
                await AyamDashboard.load();
                if (typeof AyamApp !== 'undefined') {
                  AyamApp.populateVendorSuggestions();
                }
              } else {
                if (typeof AyamApp !== 'undefined') {
                  AyamApp.showToast('Failed to find transaction to delete', 'error');
                }
              }
            } catch (err) {
              console.error('Delete error:', err);
              if (typeof AyamApp !== 'undefined') {
                AyamApp.showToast('Error deleting transaction', 'error');
              }
            } finally {
              deleteBtn.disabled = false;
              deleteBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              `;
            }
          }
        };

        row.appendChild(icon);
        row.appendChild(info);
        row.appendChild(amtEl);
        row.appendChild(deleteBtn);
        container.appendChild(row);
      });

      // Inject keyframes if not already present
      if (!document.getElementById('dash-anim-styles')) {
        const style = document.createElement('style');
        style.id = 'dash-anim-styles';
        style.textContent = `
          @keyframes dashFadeIn {
            to { opacity:1; transform:translateY(0); }
          }
        `;
        document.head.appendChild(style);
      }
    },

    /**
     * Navigate to a different month.
     * @param {number} delta — +1 for next month, -1 for previous
     */
    navigateMonth(delta) {
      currentMonth += delta;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      this.load();
    },

    /**
     * Update the target profit value (used after settings save).
     * @param {number} amount
     */
    setTarget(amount) {
      targetProfit = amount;
    }
  };
})();
