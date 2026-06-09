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
    INVENTORY: 'Inventory',
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
      'Type',
      'Vendor',
      'Status',
      'Notes',
      'Timestamp',
    ],
    [TABS.INVENTORY]: [
      'Item Name',
      'Quantity',
      'Unit',
      'Min Alert Quantity',
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

  /**
   * Scan Daily_Sales, Expenses, and Inventory tabs for rows starting at shifted columns,
   * align them back to Column A, and update the sheets.
   * @private
   */
  async function _repairColumnAlignments() {
    _requireInit();
    console.info('[AyamSheets] Running auto-repair check for column alignments...');

    // 1. Repair Expenses
    // Shifted rows will have empty cells in columns A-G (index 0-6) but data in H+
    try {
      const expResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${TABS.EXPENSES}!A2:P`, // read widely to capture columns H onwards
      });
      const expRows = expResponse.result.values || [];
      let expUpdated = false;
      const expBatchUpdates = [];

      for (let i = 0; i < expRows.length; i++) {
        const row = expRows[i];
        const rowNum = i + 2; // header is row 1
        
        // Check if it's a shifted row: columns A to G are empty, but column H is not empty
        const hasDataInH = row.length > 7 && row[7];
        const isEmptyBeforeH = row.slice(0, 7).every(val => !val);

        if (hasDataInH && isEmptyBeforeH) {
          // This row starts at Column H (index 7).
          // Shift columns H+ back to Column A
          const shiftedData = row.slice(7);
          
          // Pad the shifted data to exactly 8 elements (matching new Expenses schema: A to H)
          const correctedRow = [...shiftedData];
          while (correctedRow.length < 8) {
            correctedRow.push('');
          }
          
          console.info(`[AyamSheets] Repairing shifted Expense row ${rowNum}:`, correctedRow);
          
          // Push update to rewrite columns A-H
          expBatchUpdates.push({
            range: `${TABS.EXPENSES}!A${rowNum}:H${rowNum}`,
            values: [correctedRow],
          });

          // Also clear the shifted columns (H onwards) to prevent leftover data
          const clearLength = row.length - 8;
          if (clearLength > 0) {
            const emptyPadding = Array(clearLength).fill('');
            expBatchUpdates.push({
              range: `${TABS.EXPENSES}!I${rowNum}:${String.fromCharCode(73 + clearLength - 1)}${rowNum}`,
              values: [emptyPadding],
            });
          }
          expUpdated = true;
        }
      }

      if (expUpdated && expBatchUpdates.length > 0) {
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: expBatchUpdates,
          },
        });
        console.info('[AyamSheets] Expenses alignment repair complete.');
      }
    } catch (err) {
      console.error('[AyamSheets] Expenses repair failed:', err);
    }

    // 2. Repair Daily_Sales
    // Shifted rows will have empty cells in columns A-E (index 0-4) but data in F+ (index 5+)
    try {
      const salesResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${TABS.DAILY_SALES}!A2:L`, // read widely to capture columns F onwards
      });
      const salesRows = salesResponse.result.values || [];
      let salesUpdated = false;
      const salesBatchUpdates = [];

      for (let i = 0; i < salesRows.length; i++) {
        const row = salesRows[i];
        const rowNum = i + 2;

        const hasDataInF = row.length > 5 && row[5];
        const isEmptyBeforeF = row.slice(0, 5).every(val => !val);

        if (hasDataInF && isEmptyBeforeF) {
          const shiftedData = row.slice(5);
          const correctedRow = [...shiftedData];
          while (correctedRow.length < 6) { // Daily_Sales has 6 columns
            correctedRow.push('');
          }
          console.info(`[AyamSheets] Repairing shifted Sales row ${rowNum}:`, correctedRow);

          salesBatchUpdates.push({
            range: `${TABS.DAILY_SALES}!A${rowNum}:F${rowNum}`,
            values: [correctedRow],
          });

          const clearLength = row.length - 6;
          if (clearLength > 0) {
            const emptyPadding = Array(clearLength).fill('');
            salesBatchUpdates.push({
              range: `${TABS.DAILY_SALES}!G${rowNum}:${String.fromCharCode(71 + clearLength - 1)}${rowNum}`,
              values: [emptyPadding],
            });
          }
          salesUpdated = true;
        }
      }

      if (salesUpdated && salesBatchUpdates.length > 0) {
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: salesBatchUpdates,
          },
        });
        console.info('[AyamSheets] Daily_Sales alignment repair complete.');
      }
    } catch (err) {
      console.error('[AyamSheets] Daily_Sales repair failed:', err);
    }

    // 3. Repair Inventory
    // Shifted rows will have empty cells in columns A-E (index 0-4) but data in F+ (index 5+)
    try {
      const invResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${TABS.INVENTORY}!A2:L`,
      });
      const invRows = invResponse.result.values || [];
      let invUpdated = false;
      const invBatchUpdates = [];

      for (let i = 0; i < invRows.length; i++) {
        const row = invRows[i];
        const rowNum = i + 2;

        const hasDataInF = row.length > 5 && row[5];
        const isEmptyBeforeF = row.slice(0, 5).every(val => !val);

        if (hasDataInF && isEmptyBeforeF) {
          const shiftedData = row.slice(5);
          const correctedRow = [...shiftedData];
          while (correctedRow.length < 6) { // Inventory has 6 columns
            correctedRow.push('');
          }
          console.info(`[AyamSheets] Repairing shifted Inventory row ${rowNum}:`, correctedRow);

          invBatchUpdates.push({
            range: `${TABS.INVENTORY}!A${rowNum}:F${rowNum}`,
            values: [correctedRow],
          });

          const clearLength = row.length - 6;
          if (clearLength > 0) {
            const emptyPadding = Array(clearLength).fill('');
            invBatchUpdates.push({
              range: `${TABS.INVENTORY}!G${rowNum}:${String.fromCharCode(71 + clearLength - 1)}${rowNum}`,
              values: [emptyPadding],
            });
          }
          invUpdated = true;
        }
      }

      if (invUpdated && invBatchUpdates.length > 0) {
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: invBatchUpdates,
          },
        });
        console.info('[AyamSheets] Inventory alignment repair complete.');
      }
    } catch (err) {
      console.error('[AyamSheets] Inventory repair failed:', err);
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
        // Ensure the inventory tab exists in the existing ledger
        await this._ensureInventoryTabExists();
      } else {
        spreadsheetId = await this._createLedger();
        console.info(
          `[AyamSheets] Created new ledger: ${spreadsheetId}`,
        );
      }
      // Run the repair utility to fix any column misalignments
      await _repairColumnAlignments();
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
              { properties: { title: TABS.INVENTORY, index: 2 } },
              { properties: { title: TABS.MONTHLY_SUMMARY, index: 3 } },
              { properties: { title: TABS.SETTINGS, index: 4 } },
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
                range: `${TABS.EXPENSES}!A1:H1`,
                values: [HEADERS[TABS.EXPENSES]],
              },
              {
                range: `${TABS.INVENTORY}!A1:F1`,
                values: [HEADERS[TABS.INVENTORY]],
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

    /**
     * Ensure the Inventory tab exists in the existing ledger spreadsheet.
     * @private
     */
    async _ensureInventoryTabExists() {
      _requireInit();
      return _call('Ensure inventory tab exists', async () => {
        const metadata = await gapi.client.sheets.spreadsheets.get({
          spreadsheetId,
        });
        const sheets = metadata.result.sheets || [];
        const hasInventory = sheets.some(s => s.properties.title === TABS.INVENTORY);

        if (!hasInventory) {
          console.info(`[AyamSheets] Upgrading ledger: adding ${TABS.INVENTORY} tab.`);
          await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
              requests: [
                {
                  addSheet: {
                    properties: { title: TABS.INVENTORY }
                  }
                }
              ]
            }
          });
          // Write headers
          await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${TABS.INVENTORY}!A1:F1`,
            valueInputOption: 'RAW',
            resource: { values: [HEADERS[TABS.INVENTORY]] },
          });
        }
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
          range: `${TABS.DAILY_SALES}!A:A`,
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
     * @param {string}  [params.type='Direct (COGS)'] – Direct vs Indirect cost.
     * @param {string}  [params.vendor='General'] – Counterparty/Supplier name.
     * @param {string}  [params.status='Paid'] – Paid vs Unpaid.
     * @param {string}  [params.notes=''] – Free-text notes.
     * @returns {Promise<object>} The Sheets API append response.
     */
    async appendExpenseRow({ date, category, amount = 0, type = 'Direct (COGS)', vendor = 'General', status = 'Paid', notes = '' }) {
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
            type,
            vendor,
            status,
            notes,
            new Date().toISOString(),
          ],
        ];

        const response = await gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${TABS.EXPENSES}!A:A`,
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
     * `[Date, Category, Amount, Type, Vendor, Status, Notes, Timestamp]`
     *
     * @returns {Promise<Array<Array<string>>>}
     */
    async getExpensesData() {
      _requireInit();

      return _call('Get expenses data', async () => {
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TABS.EXPENSES}!A2:H`,
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
            range: `${TABS.SETTINGS}!A:A`,
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
     * Delete a row in a specific tab by matching its unique ISO timestamp.
     * 
     * @param {string} tabName - e.g., 'Daily_Sales' or 'Expenses'
     * @param {string} timestamp - ISO timestamp to match
     * @returns {Promise<boolean>} True if deleted, false if not found.
     */
    async deleteRowByTimestamp(tabName, timestamp) {
      _requireInit();
      if (!tabName || !timestamp) {
        throw new Error('[AyamSheets] deleteRowByTimestamp: tabName and timestamp are required.');
      }

      return _call('Delete row by timestamp', async () => {
        // Read columns A to H (covering all elements)
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${tabName}!A:H`,
        });

        const rows = response.result.values || [];
        let foundIndex = -1;

        // Iterate through rows (skipping header at index 0)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.includes(timestamp)) {
            foundIndex = i;
            break;
          }
        }

        if (foundIndex === -1) {
          console.warn(`[AyamSheets] Row with timestamp ${timestamp} not found in ${tabName}.`);
          return false;
        }

        // Get sheet ID by tab name
        const metadata = await gapi.client.sheets.spreadsheets.get({
          spreadsheetId,
        });
        const sheets = metadata.result.sheets || [];
        const sheet = sheets.find(s => s.properties.title === tabName);
        if (!sheet) {
          throw new Error(`Sheet ${tabName} not found.`);
        }
        const sheetId = sheet.properties.sheetId;

        // Request deleteDimension (startIndex is inclusive, endIndex is exclusive, 0-indexed)
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: foundIndex,
                    endIndex: foundIndex + 1,
                  },
                },
              },
            ],
          },
        });

        return true;
      });
    },

    /**
     * Retrieve all inventory data (excludes the header row).
     *
     * Each element is an array of cell values:
     * `[Item Name, Quantity, Unit, Min Alert Quantity, Notes, Timestamp]`
     *
     * @returns {Promise<Array<Array<string>>>}
     */
    async getInventoryData() {
      _requireInit();

      return _call('Get inventory data', async () => {
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TABS.INVENTORY}!A2:F`,
        });
        return response.result.values || [];
      });
    },

    /**
     * Add or update an inventory item.
     *
     * @param {object} params
     * @param {string} [params.originalName] - Old name of the item, if updating.
     * @param {string} params.name - Item name.
     * @param {number} params.quantity - Stock level.
     * @param {string} params.unit - Unit (e.g. kg).
     * @param {number} params.minAlert - Alert threshold.
     * @param {string} [params.notes=''] - Notes.
     */
    async saveInventoryItem({ originalName, name, quantity, unit, minAlert, notes = '' }) {
      _requireInit();

      if (!name) {
        throw new Error('[AyamSheets] saveInventoryItem: "name" is required.');
      }

      return _call('Save inventory item', async () => {
        const rows = await this.getInventoryData();
        const searchName = originalName || name;
        
        let foundIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i][0] && rows[i][0].toLowerCase() === searchName.toLowerCase()) {
            foundIndex = i;
            break;
          }
        }

        const values = [[
          name,
          quantity,
          unit,
          minAlert,
          notes,
          new Date().toISOString()
        ]];

        if (foundIndex !== -1) {
          // Update existing row (index + 2 because header is row 1)
          const rowNum = foundIndex + 2;
          await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${TABS.INVENTORY}!A${rowNum}:F${rowNum}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
          });
        } else {
          // If we didn't specify originalName but name already exists, reject
          if (!originalName) {
            const nameExists = rows.some(r => r[0] && r[0].toLowerCase() === name.toLowerCase());
            if (nameExists) {
              throw new Error(`An item named "${name}" already exists.`);
            }
          }

          // Append new row
          await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${TABS.INVENTORY}!A:A`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values },
          });
        }
      });
    },

    /**
     * Fast update for single item quantity & timestamp (e.g., inline +/- buttons).
     *
     * @param {string} name
     * @param {number} newQuantity
     */
    async updateInventoryQuantity(name, newQuantity) {
      _requireInit();

      if (!name) {
        throw new Error('[AyamSheets] updateInventoryQuantity: "name" is required.');
      }

      return _call('Update inventory quantity', async () => {
        const rows = await this.getInventoryData();
        let foundIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i][0] && rows[i][0].toLowerCase() === name.toLowerCase()) {
            foundIndex = i;
            break;
          }
        }

        if (foundIndex === -1) {
          throw new Error(`Inventory item "${name}" not found.`);
        }

        const rowNum = foundIndex + 2;

        await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: [
              {
                range: `${TABS.INVENTORY}!B${rowNum}`,
                values: [[newQuantity]]
              },
              {
                range: `${TABS.INVENTORY}!F${rowNum}`,
                values: [[new Date().toISOString()]]
              }
            ]
          }
        });
      });
    },

    /**
     * Delete an inventory item by name.
     *
     * @param {string} name
     * @returns {Promise<boolean>}
     */
    async deleteInventoryItem(name) {
      _requireInit();

      if (!name) {
        throw new Error('[AyamSheets] deleteInventoryItem: "name" is required.');
      }

      return _call('Delete inventory item', async () => {
        const rows = await this.getInventoryData();
        let foundIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i][0] && rows[i][0].toLowerCase() === name.toLowerCase()) {
            foundIndex = i;
            break;
          }
        }

        if (foundIndex === -1) {
          console.warn(`[AyamSheets] Inventory item "${name}" not found.`);
          return false;
        }

        const sheetIndex = foundIndex + 1; // +1 because rows starts at index 2 (1-based row 2 is 0-indexed index 0 in rows)

        const metadata = await gapi.client.sheets.spreadsheets.get({
          spreadsheetId,
        });
        const sheets = metadata.result.sheets || [];
        const sheet = sheets.find(s => s.properties.title === TABS.INVENTORY);
        if (!sheet) {
          throw new Error(`Sheet ${TABS.INVENTORY} not found.`);
        }
        const sheetId = sheet.properties.sheetId;

        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: sheetIndex,
                    endIndex: sheetIndex + 1,
                  },
                },
              },
            ],
          },
        });

        return true;
      });
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
