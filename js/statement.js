// ============================================================
// 📄 AyamStatement — Printable Financial Report Generator
// Compiles sales & expense data into a formal Profit & Loss format
// ============================================================

const AyamStatement = (() => {

  /**
   * Helper: safely get an element by ID.
   */
  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Format currency value.
   */
  function formatRM(amount) {
    return 'RM ' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
   * Format date as standard accounting statement short form (e.g. "2026-05-30").
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parsed = parseDateTimezoneSafe(dateStr);
    if (!parsed) return dateStr;
    const yyyy = parsed.year;
    const mm = String(parsed.month + 1).padStart(2, '0');
    const dd = String(parsed.day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return {
    /**
     * Generate the account statement for the current dashboard month
     */
    async generate() {
      // 1. Get current dashboard period
      let month = new Date().getMonth();
      let year = new Date().getFullYear();

      if (typeof AyamDashboard !== 'undefined') {
        month = AyamDashboard.getCurrentMonth();
        year = AyamDashboard.getCurrentYear();
      }

      const MONTH_NAMES = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
      ];

      const periodText = `${MONTH_NAMES[month]} ${year}`;
      $('stmt-period-label').textContent = periodText;

      // Show toast loading feedback
      if (typeof AyamApp !== 'undefined') {
        AyamApp.showToast('Compiling statement...', 'info');
      }

      try {
        // 2. Fetch sales and expenses from Sheets
        const [salesRows, expenseRows] = await Promise.all([
          AyamSheets.getSalesData(),
          AyamSheets.getExpensesData()
        ]);

        // 3. Filter data for the active month
        const monthlySales = (salesRows || []).filter(row => {
          if (!row[0]) return false;
          const parsed = parseDateTimezoneSafe(row[0]);
          if (!parsed) return false;
          return parsed.month === month && parsed.year === year;
        });

        const monthlyExpenses = (expenseRows || []).filter(row => {
          if (!row[0]) return false;
          const parsed = parseDateTimezoneSafe(row[0]);
          if (!parsed) return false;
          return parsed.month === month && parsed.year === year;
        });

        // 4. Summarize Revenue
        let cashSales = 0;
        let qrSales = 0;
        monthlySales.forEach(row => {
          cashSales += parseFloat(row[1]) || 0;
          qrSales += parseFloat(row[2]) || 0;
        });
        const totalRevenue = cashSales + qrSales;

        $('stmt-revenue-cash').textContent = formatRM(cashSales);
        $('stmt-revenue-qr').textContent = formatRM(qrSales);
        $('stmt-revenue-total').textContent = formatRM(totalRevenue);

        // 5. Categorize Expenses into COGS vs OPEX
        let totalCOGS = 0;
        let totalOPEX = 0;
        const cogsBreakdown = {};
        const opexBreakdown = {};

        monthlyExpenses.forEach(row => {
          const cat = row[1] || 'Others';
          const amt = parseFloat(row[2]) || 0;
          let type = row[3];

          // Legacy fallbacks for expense types
          if (row.length <= 5 || !type) {
            const directCategories = ['Raw Chicken', 'Cooking Oil/Gas', 'Flour/Spices', 'Packaging'];
            type = directCategories.includes(row[1]) ? 'Direct (COGS)' : 'Indirect (OPEX)';
          }

          if (type === 'Direct (COGS)') {
            totalCOGS += amt;
            cogsBreakdown[cat] = (cogsBreakdown[cat] || 0) + amt;
          } else {
            totalOPEX += amt;
            opexBreakdown[cat] = (opexBreakdown[cat] || 0) + amt;
          }
        });

        $('stmt-cogs-total').textContent = formatRM(totalCOGS);
        $('stmt-opex-total').textContent = formatRM(totalOPEX);

        // Render breakdowns
        const cogsContainer = $('stmt-cogs-breakdown');
        cogsContainer.innerHTML = '';
        if (Object.keys(cogsBreakdown).length === 0) {
          cogsContainer.innerHTML = '<div class="flex justify-between italic"><span>No COGS recorded</span><span>RM 0.00</span></div>';
        } else {
          Object.entries(cogsBreakdown).forEach(([cat, val]) => {
            const row = document.createElement('div');
            row.className = 'flex justify-between';
            row.innerHTML = `<span>${cat}</span><span>${formatRM(val)}</span>`;
            cogsContainer.appendChild(row);
          });
        }

        const opexContainer = $('stmt-opex-breakdown');
        opexContainer.innerHTML = '';
        if (Object.keys(opexBreakdown).length === 0) {
          opexContainer.innerHTML = '<div class="flex justify-between italic"><span>No Operating Expenses recorded</span><span>RM 0.00</span></div>';
        } else {
          Object.entries(opexBreakdown).forEach(([cat, val]) => {
            const row = document.createElement('div');
            row.className = 'flex justify-between';
            row.innerHTML = `<span>${cat}</span><span>${formatRM(val)}</span>`;
            opexContainer.appendChild(row);
          });
        }

        // 6. Net totals
        const grossProfit = totalRevenue - totalCOGS;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const netProfit = grossProfit - totalOPEX;

        $('stmt-gross-profit').textContent = formatRM(grossProfit);
        $('stmt-gross-margin').textContent = grossMargin.toFixed(1) + '%';
        
        const netProfitEl = $('stmt-net-profit');
        netProfitEl.textContent = formatRM(netProfit);
        if (netProfit < 0) {
          netProfitEl.className = 'double-underline text-red-700';
        } else {
          netProfitEl.className = 'double-underline text-emerald-800';
        }

        // 7. Compile Detailed Ledger rows
        const ledgerEntries = [];
        
        // Add sales
        monthlySales.forEach(row => {
          const cash = parseFloat(row[1]) || 0;
          const qr = parseFloat(row[2]) || 0;
          const total = cash + qr;
          if (total === 0) return;
          ledgerEntries.push({
            date: row[0],
            type: 'Sale',
            category: 'Sales Revenue',
            ref: row[4] ? `Sales notes: ${row[4]}` : 'Daily sales record',
            amount: total
          });
        });

        // Add expenses
        monthlyExpenses.forEach(row => {
          let refVal = 'General';
          if (row.length > 5) {
            // date, category, amount, type, vendor, status, notes
            refVal = row[4] || 'General';
            if (row[6]) refVal += ` (${row[6]})`;
          } else {
            // legacy format: date, category, amount, notes
            refVal = row[3] || 'General';
          }

          ledgerEntries.push({
            date: row[0],
            type: 'Expense',
            category: row[1] || 'Expense',
            ref: refVal,
            amount: -(parseFloat(row[2]) || 0)
          });
        });

        // Sort ascending (chronological order)
        ledgerEntries.sort((a, b) => a.date.localeCompare(b.date));

        const ledgerBody = $('stmt-ledger-rows');
        ledgerBody.innerHTML = '';
        if (ledgerEntries.length === 0) {
          ledgerBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400 italic">No transactions recorded for this period.</td></tr>';
        } else {
          ledgerEntries.forEach(entry => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-50';
            
            const isSale = entry.type === 'Sale';
            const typeBadge = isSale 
              ? '<span class="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100">SALE</span>'
              : '<span class="px-1.5 py-0.5 rounded font-bold text-[10px] bg-red-50 text-red-700 border border-red-100">EXPENSE</span>';
            
            const amtClass = isSale ? 'text-emerald-700 font-semibold' : 'text-red-600';
            const amtSign = isSale ? '+' : '';

            tr.innerHTML = `
              <td class="py-2.5 pr-2 font-medium text-gray-900 whitespace-nowrap">${formatDate(entry.date)}</td>
              <td class="py-2.5 px-2">${typeBadge}</td>
              <td class="py-2.5 px-2 font-medium">${entry.category}</td>
              <td class="py-2.5 px-2 text-gray-500 truncate max-w-[150px]" title="${entry.ref}">${entry.ref}</td>
              <td class="py-2.5 pl-2 text-right font-semibold ${amtClass}">${amtSign}${formatRM(entry.amount)}</td>
            `;
            ledgerBody.appendChild(tr);
          });
        }

        // Set generation timestamp
        const now = new Date();
        const formattedTimestamp = now.getFullYear() + '-' + 
          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
          String(now.getDate()).padStart(2, '0') + ' ' + 
          String(now.getHours()).padStart(2, '0') + ':' + 
          String(now.getMinutes()).padStart(2, '0');
        $('stmt-gen-timestamp').textContent = formattedTimestamp;

        // 8. Swap views
        $('login-screen').style.display = 'none';
        $('app-screen').style.display = 'none';
        $('view-statement').style.display = 'block';

      } catch (err) {
        console.error('Error generating statement:', err);
        if (typeof AyamApp !== 'undefined') {
          AyamApp.showToast('Failed to generate statement.', 'error');
        }
      }
    },

    /**
     * Close the statement view and return to the main dashboard app
     */
    close() {
      $('view-statement').style.display = 'none';
      
      // Return to app screen (auth is already validated)
      const login = $('login-screen');
      const app = $('app-screen');
      if (login) login.style.display = 'none';
      if (app) app.style.display = 'block';

      // Load dashboard to ensure everything is synced
      if (typeof AyamApp !== 'undefined') {
        AyamApp.switchView('dashboard');
      }
    },

    /**
     * Call native print window dialog
     */
    print() {
      window.print();
    }
  };
})();
