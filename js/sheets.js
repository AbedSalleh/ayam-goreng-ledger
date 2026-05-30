/**
 * @fileoverview Google Sheets / Drive CRUD module for Ayam Goreng Ledger.
 * Handles spreadsheet discovery, creation, and all read/write operations
 * against the four ledger tabs (Daily_Sales, Expenses, Monthly_Summary, Settings).
 *
 * Depends on:
 *   - `gapi.client.sheets` and `gapi.client.drive` being initialised (via auth.js).
 *   - `AyamAuth.withTokenRefresh()` for automatic 401 handling.
 *
 * Exposes a global `AyamSheets` object.
 */

const AyamSheets = (() => {
  // ---------------------------------------------------------------------------
  // Private state
  // ---------------------------------------------------------------------------

  /** @type {string|null} The ID of the active ledger spreadsheet. */
  let spreadsheetId = null;

  /** Canonical spreadsheet name used for Drive search & creation. */
  const SPREADSHEET_NAME = 'Ayam_Goreng_Ledger';

  /** Default monthly target profit if not set in Settings tab. */
  const DEFAULT_TARGET_PROFIT = 2000;

  // ---------------------------------------------------------------------------
  // Tab / header definitions (single source of truth)
  // ---------------------------------------------------------------------------

  const TABS = {
    DAILY_SALES: 'Daily_Sales',
    EXPENSES: 'Expenses',
    MONTHLY_SUMMARY: 'Monthly_Summary',
    SETTINGS: 'Settings',
  };

  const HEADERS = {
    [TABS.DAILY_SALES]: [
      'Date',
      'Cash Revenue (RM)',
      'QR/DuitNow Revenue (RM)',
      'Total Revenue (RM)',
      'Notes',
      'Timestamp',
    ],
    [TABS.EXPENSES]: [
      'Date',
      'Category',
      'Amount (RM)',
      'Notes',
      'Timestamp',
    ],
    [TABS.MONTHLY_SUMMARY]: [
      'Auto-generated summary — do not edit manually',
    ],
    [TABS.SETTINGS]: {
      headers: ['Key', 'Value'],
      defaults: [['target_profit', String(DEFAULT_TARGET_PROFIT)]],
    },
  };

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Wrap a gapi call with `AyamAuth.withTokenRefresh` if available,
   * otherwise execute directly. Adds a consistent error wrapper.
   *
   * @template T
   * @param {string} label – Human-readable label for error messages.
   * @param {() => Promise<T>} apiCall
   * @returns {Promise<T>}
   * @private
   */
  async function _call(label, apiCall) {
    try {
      if (typeof AyamAuth !== 'undefined' && AyamAuth.withTokenRefresh) {
        return await AyamAuth.withTokenRefresh(apiCall);
      }
      return await apiCall();
    } catch (err) {
      const msg = err?.result?.error?.message || err?.message || String(err);
      console.error(`[AyamSheets] ${label} failed:`, msg);
      throw new Error(`${label}: ${msg}`);
    }
  }

  /**
   * Ensure `spreadsheetId` has been set. Throws if not.
   * @private
   */
  function _requireInit() {
    if (!spreadsheetId) {
      throw new Error(
        '[AyamSheets] Spreadsheet not initialised. Call initLedger() first.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    /**
     * Returns the active spreadsheet ID, or `null` if not initialised.
     *
     * @returns {string|null}
     */
    getSpreadsheetId() {
      return spreadsheetId;
    },

    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /**
     * Find or create the Ayam Goreng Ledger spreadsheet.
     *
     * 1. Searches Google Drive for an existing spreadsheet named
     *    `Ayam_Goreng_Ledger`.
     * 2. If found, reuses it; otherwise creates a new one with all required
     *    tabs and headers.
     *
     * @returns {Promise<string>} The spreadsheet ID.
     */
    async initLedger() {
      const files = await this._findLedger();
      if (files && files.length > 0) {
        spreadsheetId = files[0].id;
        console.info(
          `[AyamSheets] Found existing ledger: ${spreadsheetId}`,
        );
      } else {
        spreadsheetId = await this._createLedger();
        console.info(
          `[AyamSheets] Created new ledger: ${spreadsheetId}`,
        );
      }
      return spreadsheetId;
    },

    /**
     * Search the user's Drive for the ledger spreadsheet.
     *
     * @returns {Promise<Array<{ id: string, name: string }>>}
     * @private
     */
    async _findLedger() {
      return _call('Find ledger', async () => {
        const response = await gapi.client.drive.files.list({
          q: `name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });
        return response.result.files || [];
      });
    },

    /**
     * Create a brand-new ledger spreadsheet with all four tabs and their
     * respective headers / default rows.
     *
     * @returns {Promise<string>} The new spreadsheet ID.
     * @private
     */
    async _createLedger() {
      return _call('Create ledger', async () => {
        // 1. Create the spreadsheet with named tabs
        const createResponse = await gapi.client.sheets.spreadsheets.create({
          resource: {
            properties: { title: SPREADSHEET_NAME },
            sheets: [
              { properties: { title: TABS.DAILY_SALES, index: 0 } },
              { properties: { title: TABS.EXPENSES, index: 1 } },
              { properties: { title: TABS.MONTHLY_SUMMARY, index: 2 } },
              { properties: { title: TABS.SETTINGS, index: 3 } },
            ],
          },
        });

        const id = createResponse.result.spreadsheetId;

        // 2. Populate headers and default rows in a single batchUpdate
        const settingsValues = [
          HEADERS[TABS.SETTINGS].headers,
          ...HEADERS[TABS.SETTINGS].defaults,
        ];

        await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: id,
          resource: {
            valueInputOption: 'RAW',
            data: [
              {
                range: `${TABS.DAILY_SALES}!A1:F1`,
                values: [HEADERS[TABS.DAILY_SALES]],
              },
              {
                range: `${TABS.EXPENSES}!A1:E1`,
                values: [HEADERS[TABS.EXPENSES]],
              },
              {
                range: `${TABS.MONTHLY_SUMMARY}!A1`,
                values: [HEADERS[TABS.MONTHLY_SUMMARY]],
              },
              {
                range: `${TABS.SETTINGS}!A1:B${1 + settingsValues.length - 1}`,
                values: settingsValues,
              },
            ],
          },
        });

        return id;
      });
    },

    // -----------------------------------------------------------------------
    // Daily Sales
    // -----------------------------------------------------------------------

    /**
     * Append a new daily-sales row.
     *
     * Column D is populated with a `=B{row}+C{row}` formula so the total is
     * always consistent, even if edited manually in Sheets.
     *
     * @param {object}  params
     * @param {string}  params.date  – Date string (e.g. "2026-05-30").
     * @param {number}  [params.cash=0]  – Cash revenue in RM.
     * @param {number}  [params.qr=0]    – QR / DuitNow revenue in RM.
     * @param {string}  [params.notes=''] – Free-text notes.
     * @returns {Promise<object>} The Sheets API append response.
     */
    async appendSalesRow({ date, cash = 0, qr = 0, notes = '' }) {
      _requireInit();

      if (!date) {
        throw new Error('[AyamSheets] appendSalesRow: "date" is required.');
      }

      return _call('Append sales row', async () => {
        const rowNum = await this._getNextRow(TABS.DAILY_SALES);
        const values = [
          [
            date,
            cash,
            qr,
            `=B${rowNum}+C${rowNum}`,
            notes,
            new Date().toISOString(),
          ],
        ];

        const response = await gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${TABS.DAILY_SALES}!A:F`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values },
        });

        return response.result;
      });
    },

    /**
     * Retrieve all sales data rows (excludes the header row).
     *
     * Each element is an array of cell values:
     * `[Date, Cash, QR, Total, Notes, Timestamp]`
     *
     * @returns {Promise<Array<Array<string>>>}
     */
    async getSalesData() {
      _requireInit();

      return _call('Get sales data', async () => {
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TABS.DAILY_SALES}!A2:F`,
        });
        return response.result.values || [];
      });
    },

    // -----------------------------------------------------------------------
    // Expenses
    // -----------------------------------------------------------------------

    /**
     * Append a new expense row.
     *
     * @param {object}  params
     * @param {string}  params.date     – Date string.
     * @param {string}  params.category – Expense category.
     * @param {number}  [params.amount=0] – Amount in RM.
     * @param {string}  [params.notes=''] – Free-text notes.
     * @returns {Promise<object>} The Sheets API append response.
     */
    async appendExpenseRow({ date, category, amount = 0, notes = '' }) {
      _requireInit();

      if (!date) {
        throw new Error('[AyamSheets] appendExpenseRow: "date" is required.');
      }
      if (!category) {
        throw new Error('[AyamSheets] appendExpenseRow: "category" is required.');
      }

      return _call('Append expense row', async () => {
        const values = [
          [
            date,
            category,
            amount,
            notes,
            new Date().toISOString(),
          ],
        ];

        const response = await gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${TABS.EXPENSES}!A:E`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values },
        });

        return response.result;
      });
    },

    /**
     * Retrieve all expense data rows (excludes the header row).
     *
     * Each element is an array of cell values:
     * `[Date, Category, Amount, Notes, Timestamp]`
     *
     * @returns {Promise<Array<Array<string>>>}
     */
    async getExpensesData() {
      _requireInit();

      return _call('Get expenses data', async () => {
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TABS.EXPENSES}!A2:E`,
        });
        return response.result.values || [];
      });
    },

    // -----------------------------------------------------------------------
    // Settings
    // -----------------------------------------------------------------------

    /**
     * Read the monthly target profit from the Settings tab.
     *
     * Falls back to {@link DEFAULT_TARGET_PROFIT} if the value is missing or
     * cannot be parsed.
     *
     * @returns {Promise<number>}
     */
    async getTargetProfit() {
      _requireInit();

      try {
        return await _call('Get target profit', async () => {
          const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${TABS.SETTINGS}!B2`,
          });

          const val = response.result.values;
          if (val && val[0] && val[0][0]) {
            const parsed = parseFloat(val[0][0]);
            return Number.isFinite(parsed) ? parsed : DEFAULT_TARGET_PROFIT;
          }
          return DEFAULT_TARGET_PROFIT;
        });
      } catch (err) {
        console.warn('[AyamSheets] getTargetProfit fallback:', err.message);
        return DEFAULT_TARGET_PROFIT;
      }
    },

    /**
     * Update the monthly target profit in the Settings tab.
     *
     * @param {number} amount – New target profit in RM.
     * @returns {Promise<object>} The Sheets API update response.
     */
    async setTargetProfit(amount) {
      _requireInit();

      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
        throw new Error(
          '[AyamSheets] setTargetProfit: amount must be a non-negative number.',
        );
      }

      return _call('Set target profit', async () => {
        const response = await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${TABS.SETTINGS}!B2`,
          valueInputOption: 'RAW',
          resource: { values: [[amount]] },
        });
        return response.result;
      });
    },

    /**
     * Read an arbitrary key from the Settings tab.
     *
     * Settings are stored as key-value pairs starting at row 2. This method
     * scans all rows and returns the value for the first matching key, or
     * `defaultValue` if not found.
     *
     * @param {string} key – The settings key to look up.
     * @param {*} [defaultValue=null] – Value returned when the key is absent.
     * @returns {Promise<string|*>}
     */
    async getSetting(key, defaultValue = null) {
      _requireInit();

      return _call('Get setting', async () => {
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TABS.SETTINGS}!A2:B`,
        });
        const rows = response.result.values || [];
        for (const row of rows) {
          if (row[0] === key) return row[1] ?? defaultValue;
        }
        return defaultValue;
      });
    },

    /**
     * Write an arbitrary key-value pair to the Settings tab.
     *
     * If the key already exists, its value is updated in-place. Otherwise a
     * new row is appended.
     *
     * @param {string} key
     * @param {string|number} value
     * @returns {Promise<object>}
     */
    async setSetting(key, value) {
      _requireInit();

      return _call('Set setting', async () => {
        // Read existing settings to find the row
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TABS.SETTINGS}!A2:B`,
        });
        const rows = response.result.values || [];

        let targetRow = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i][0] === key) {
            targetRow = i + 2; // +2 because rows are 0-indexed and row 1 is header
            break;
          }
        }

        if (targetRow > 0) {
          // Update existing row
          const updateResponse = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${TABS.SETTINGS}!A${targetRow}:B${targetRow}`,
            valueInputOption: 'RAW',
            resource: { values: [[key, value]] },
          });
          return updateResponse.result;
        } else {
          // Append new row
          const appendResponse = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${TABS.SETTINGS}!A:B`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [[key, value]] },
          });
          return appendResponse.result;
        }
      });
    },

    // -----------------------------------------------------------------------
    // Utilities
    // -----------------------------------------------------------------------

    /**
     * Determine the next available row number in a given sheet.
     *
     * Reads column A to count existing rows (including the header).
     *
     * @param {string} sheetName – Tab name (e.g. "Daily_Sales").
     * @returns {Promise<number>} 1-based row number for the next empty row.
     * @private
     */
    async _getNextRow(sheetName) {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`,
      });
      const rows = response.result.values || [];
      return rows.length + 1;
    },

    /**
     * Return the URL to open the spreadsheet in a browser.
     *
     * @returns {string|null}
     */
    getSpreadsheetUrl() {
      if (!spreadsheetId) return null;
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    },
  };
})();
