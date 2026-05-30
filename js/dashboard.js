// ============================================================
// 📊 AyamDashboard — Dashboard data fetching & rendering
// Reads from AyamSheets and renders dashboard metrics
// ============================================================

const AyamDashboard = (() => {
  let currentMonth = new Date().getMonth(); // 0-indexed
  let currentYear = new Date().getFullYear();
  let targetProfit = 2000;

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
   * Filter rows by current month/year.
   * Date column is in YYYY-MM-DD format (from HTML date input).
   * @param {Array[]} rows
   * @param {number} dateColIndex
   * @returns {Array[]}
   */
  function filterByMonth(rows, dateColIndex) {
    return rows.filter(row => {
      if (!row[dateColIndex]) return false;
      const date = new Date(row[dateColIndex]);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
  }

  /**
   * Format a YYYY-MM-DD date string into a human-readable form.
   * @param {string} dateStr
   * @returns {string} e.g. "30 May"
   */
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
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
        const [salesRows, expenseRows, target] = await Promise.all([
          AyamSheets.getSalesData(),
          AyamSheets.getExpensesData(),
          AyamSheets.getTargetProfit()
        ]);

        targetProfit = target || 2000;

        // Filter by current month
        const monthlySales = filterByMonth(salesRows || [], 0);
        const monthlyExpenses = filterByMonth(expenseRows || [], 0);

        // Calculate metrics
        let totalCash = 0, totalQR = 0, totalRevenue = 0, totalExpenses = 0;

        monthlySales.forEach(row => {
          const cash = parseFloat(row[1]) || 0;
          const qr = parseFloat(row[2]) || 0;
          totalCash += cash;
          totalQR += qr;
          totalRevenue += cash + qr;
        });

        monthlyExpenses.forEach(row => {
          totalExpenses += parseFloat(row[2]) || 0;
        });

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
          this._renderMetrics(totalRevenue, totalCash, totalQR, totalExpenses, netProfit, progressPct);
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
       $('dash-expenses'), $('dash-profit')].forEach(el => {
        if (el) el.textContent = formatRM(0);
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
            <div style="font-size:3rem; margin-bottom:0.75rem;">🍗</div>
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
    _renderMetrics(revenue, cash, qr, expenses, profit, pct) {
      // Month label
      const monthLabel = $('dash-month-label');
      if (monthLabel) monthLabel.textContent = MONTHS[currentMonth] + ' ' + currentYear;

      // Animated number fills
      animateNumber($('dash-revenue'), revenue);
      animateNumber($('dash-revenue-cash'), cash);
      animateNumber($('dash-revenue-qr'), qr);
      animateNumber($('dash-expenses'), expenses);
      animateNumber($('dash-profit'), profit);

      // Target label
      const targetEl = $('dash-target');
      if (targetEl) targetEl.textContent = 'Target: ' + formatRM(targetProfit);

      // Progress bar
      const progressBar = $('dash-progress-bar');
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
        if (profit >= 0) {
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
      const container = $('dash-recent');
      if (!container) return;
      container.innerHTML = '';

      // Build unified list
      const entries = [];

      // Sales entries: [date, cash, qr, total, notes, timestamp]
      (sales || []).forEach(row => {
        const cash = parseFloat(row[1]) || 0;
        const qr = parseFloat(row[2]) || 0;
        const total = cash + qr;
        if (total === 0) return;
        entries.push({
          type: 'sale',
          date: row[0],
          amount: total,
          label: row[4] || 'Daily Sales',
          timestamp: row[5] || row[0]
        });
      });

      // Expense entries: [date, category, amount, notes, timestamp]
      (expenses || []).forEach(row => {
        const amt = parseFloat(row[2]) || 0;
        if (amt === 0) return;
        entries.push({
          type: 'expense',
          date: row[0],
          amount: amt,
          label: row[1] || 'Expense',
          timestamp: row[4] || row[0]
        });
      });

      // Sort by timestamp descending (newest first)
      entries.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime() || 0;
        const tB = new Date(b.timestamp).getTime() || 0;
        return tB - tA;
      });

      // Take last 5
      const recent = entries.slice(0, 5);

      if (recent.length === 0) {
        container.innerHTML = `
          <p style="text-align:center; padding:1rem; opacity:0.5; font-size:0.85rem; color:#78716C;">
            No recent transactions
          </p>
        `;
        return;
      }

      recent.forEach((entry, index) => {
        const isSale = entry.type === 'sale';
        const row = document.createElement('div');
        row.style.cssText = `
          display:flex; align-items:center; gap:0.75rem;
          padding:0.7rem 0;
          border-bottom:1px solid rgba(0,0,0,0.06);
          opacity:0; transform:translateY(8px);
          animation:dashFadeIn 0.35s ease forwards;
          animation-delay:${index * 0.07}s;
        `;

        // Icon circle
        const icon = document.createElement('div');
        icon.style.cssText = `
          width:36px; height:36px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:1rem; flex-shrink:0;
          background:${isSale ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};
        `;
        icon.textContent = isSale ? '💰' : '📦';

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

        row.appendChild(icon);
        row.appendChild(info);
        row.appendChild(amtEl);
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
