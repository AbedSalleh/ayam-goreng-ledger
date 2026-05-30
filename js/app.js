// ============================================================
// 🍗 AyamApp — Main application controller
// Loaded LAST — orchestrates auth, views, forms, and settings
// ============================================================

// ========================================
// 🔧 CONFIGURATION — Fill these in!
// See README.md for setup instructions
// ========================================
const CONFIG = {
  CLIENT_ID: '905579408027-vbfp6i4asha3g4eeoros34605u92gos0.apps.googleusercontent.com',
  API_KEY: 'YOUR_API_KEY',  // Not strictly needed with OAuth, but good to have
};

const AyamApp = (() => {
  let currentView = 'dashboard';
  let isInitialized = false;

  /**
   * Helper: safely get an element by ID.
   */
  function $(id) {
    return document.getElementById(id);
  }

  return {
    // ─────────────────────────────────────────────
    // Boot sequence — called on DOMContentLoaded
    // ─────────────────────────────────────────────
    async init() {
      // Set default dates on forms to today (YYYY-MM-DD format)
      const today = new Date().toISOString().split('T')[0];
      const salesDate = $('sales-date');
      const expenseDate = $('expense-date');
      if (salesDate) salesDate.value = today;
      if (expenseDate) expenseDate.value = today;

      // Check CONFIG
      if (CONFIG.CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
        console.warn(
          '%c⚠️ Ayam Goreng Ledger: CLIENT_ID not configured!%c\n' +
          'Open js/app.js and set your Google OAuth Client ID.\n' +
          'See README.md for setup instructions.',
          'color:#F59E0B; font-size:14px; font-weight:bold;',
          'color:#a8a29e;'
        );
      }

      // Initialize auth
      AyamAuth.init(CONFIG.CLIENT_ID, async (signedIn, user) => {
        if (signedIn) {
          this._showApp(user);
          try {
            await AyamSheets.initLedger();
            await AyamDashboard.load();
            isInitialized = true;
          } catch (e) {
            console.error('Init error:', e);
            this.showToast('Failed to initialize ledger. Please try again.', 'error');
          }
        } else {
          this._showLogin();
        }
      });
    },

    // ─────────────────────────────────────────────
    // Auth actions
    // ─────────────────────────────────────────────
    signIn() {
      AyamAuth.signIn();
    },

    signOut() {
      AyamAuth.signOut();
      isInitialized = false;
      this._showLogin();
    },

    /**
     * Transition to the authenticated app view.
     * @param {object|null} user — Google user profile
     */
    _showApp(user) {
      const login = $('login-screen');
      const app = $('app-screen');
      if (login) login.style.display = 'none';
      if (app) app.style.display = 'block';

      if (user) {
        const avatar = $('user-avatar');
        if (avatar && user.picture) {
          avatar.src = user.picture;
          avatar.style.display = 'block';
        }
      }
    },

    /**
     * Transition to the login screen.
     */
    _showLogin() {
      const login = $('login-screen');
      const app = $('app-screen');
      if (login) login.style.display = 'flex';
      if (app) app.style.display = 'none';
    },

    // ─────────────────────────────────────────────
    // View switching
    // ─────────────────────────────────────────────
    switchView(viewName) {
      currentView = viewName;

      ['dashboard', 'sales', 'expenses'].forEach(v => {
        const el = $('view-' + v);
        const nav = $('nav-' + v);

        if (!el || !nav) return;

        if (v === viewName) {
          el.classList.remove('hidden');
          // Trigger fade-in animation
          el.classList.remove('animate-fadeIn');
          // Force reflow to restart animation
          void el.offsetWidth;
          el.classList.add('animate-fadeIn');
          // Active nav styling
          nav.classList.add('active', 'text-brand-600');
          nav.classList.remove('text-gray-400');
        } else {
          el.classList.add('hidden');
          nav.classList.remove('active', 'text-brand-600');
          nav.classList.add('text-gray-400');
        }
      });

      // Refresh dashboard data when switching to it
      if (viewName === 'dashboard' && isInitialized) {
        AyamDashboard.load();
      }
    },

    // ─────────────────────────────────────────────
    // Sales form handler
    // ─────────────────────────────────────────────
    async saveSales() {
      const date = ($('sales-date') || {}).value;
      const cash = ($('sales-cash') || {}).value;
      const qr = ($('sales-qr') || {}).value;
      const notes = ($('sales-notes') || {}).value || '';

      // Validation
      if (!date) {
        this.showToast('Please select a date', 'error');
        return;
      }
      if (!cash && !qr) {
        this.showToast('Please enter at least one revenue amount', 'error');
        return;
      }

      const cashVal = parseFloat(cash) || 0;
      const qrVal = parseFloat(qr) || 0;

      if (cashVal < 0 || qrVal < 0) {
        this.showToast('Amounts cannot be negative', 'error');
        return;
      }

      const btn = $('btn-save-sales');
      if (!btn) return;

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Saving...';

      try {
        await AyamSheets.appendSalesRow({
          date: date,
          cash: cashVal,
          qr: qrVal,
          notes: notes
        });

        this.showToast('Sales recorded! 🍗', 'success');

        // Reset form (keep the date)
        const salesCash = $('sales-cash');
        const salesQR = $('sales-qr');
        const salesNotes = $('sales-notes');
        if (salesCash) salesCash.value = '';
        if (salesQR) salesQR.value = '';
        if (salesNotes) salesNotes.value = '';

        // Visual success feedback on button
        btn.classList.add('animate-pulse-success');
        setTimeout(() => btn.classList.remove('animate-pulse-success'), 600);

      } catch (e) {
        console.error('Save sales error:', e);
        this.showToast('Failed to save. Please try again.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText || '💾 Save Sales';
      }
    },

    // ─────────────────────────────────────────────
    // Expenses form handler
    // ─────────────────────────────────────────────
    async saveExpense() {
      const date = ($('expense-date') || {}).value;
      const category = ($('expense-category') || {}).value;
      const amount = ($('expense-amount') || {}).value;
      const notes = ($('expense-notes') || {}).value || '';

      // Validation
      if (!date) {
        this.showToast('Please select a date', 'error');
        return;
      }
      if (!category) {
        this.showToast('Please select a category', 'error');
        return;
      }
      if (!amount) {
        this.showToast('Please enter an amount', 'error');
        return;
      }

      const amountVal = parseFloat(amount);
      if (isNaN(amountVal) || amountVal <= 0) {
        this.showToast('Please enter a valid positive amount', 'error');
        return;
      }

      const btn = $('btn-save-expense');
      if (!btn) return;

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Saving...';

      try {
        await AyamSheets.appendExpenseRow({
          date: date,
          category: category,
          amount: amountVal,
          notes: notes
        });

        this.showToast('Expense logged! 📝', 'success');

        // Reset form (keep date and category)
        const expenseAmt = $('expense-amount');
        const expenseNotes = $('expense-notes');
        if (expenseAmt) expenseAmt.value = '';
        if (expenseNotes) expenseNotes.value = '';

        // Visual success feedback
        btn.classList.add('animate-pulse-success');
        setTimeout(() => btn.classList.remove('animate-pulse-success'), 600);

      } catch (e) {
        console.error('Save expense error:', e);
        this.showToast('Failed to save. Please try again.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText || '💾 Save Expense';
      }
    },

    // ─────────────────────────────────────────────
    // Settings modal
    // ─────────────────────────────────────────────
    async openSettings() {
      const modal = $('settings-modal');
      if (!modal) return;

      modal.classList.remove('hidden');
      modal.classList.add('flex');

      // Load current target
      try {
        const target = await AyamSheets.getTargetProfit();
        const input = $('settings-target');
        if (input) input.value = target || 2000;
      } catch (e) {
        const input = $('settings-target');
        if (input) input.value = 2000;
      }
    },

    closeSettings() {
      const modal = $('settings-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    },

    async saveSettings() {
      const input = $('settings-target');
      const target = parseFloat((input || {}).value);

      if (!target || target <= 0) {
        this.showToast('Please enter a valid target amount', 'error');
        return;
      }

      try {
        await AyamSheets.setTargetProfit(target);
        AyamDashboard.setTarget(target);
        this.closeSettings();
        this.showToast('Target updated! 🎯', 'success');
        if (currentView === 'dashboard') {
          AyamDashboard.load();
        }
      } catch (e) {
        console.error('Save settings error:', e);
        this.showToast('Failed to save settings', 'error');
      }
    },

    // ─────────────────────────────────────────────
    // Toast notifications
    // ─────────────────────────────────────────────
    showToast(message, type = 'info') {
      const container = $('toast-container');
      if (!container) {
        console.warn('Toast container not found');
        return;
      }

      const toast = document.createElement('div');

      // Background color by type
      const bgColor =
        type === 'success' ? 'bg-emerald-500' :
        type === 'error'   ? 'bg-red-500' :
                             'bg-blue-500';

      toast.className = `${bgColor} text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium toast-enter mb-2`;
      toast.style.cssText = 'pointer-events:auto; max-width:90vw; word-break:break-word;';
      toast.textContent = message;

      container.appendChild(toast);

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 300);
      }, 3000);
    }
  };
})();

// ─────────────────────────────────────────────
// Boot on DOM ready
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => AyamApp.init());
