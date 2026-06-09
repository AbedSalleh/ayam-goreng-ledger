const AyamTest = (() => {
  function $(id) {
    return document.getElementById(id);
  }

  return {
    async runStressTest() {
      const modal = $('test-modal');
      const logArea = $('test-log');
      const closeBtn = $('btn-close-test');
      if (!modal || !logArea) {
        alert('Stress test modal elements not found!');
        return;
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (closeBtn) closeBtn.disabled = true;

      logArea.innerHTML = '';
      function log(msg) {
        logArea.innerHTML += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
        logArea.scrollTop = logArea.scrollHeight;
      }

      log('🚀 Starting system stress test (5 iterations)...');
      
      const salesToDelete = [];
      const expensesToDelete = [];
      const inventoryToDelete = [];
      let originalTarget = 2000;

      try {
        log('Reading original Settings target profit...');
        originalTarget = await AyamSheets.getTargetProfit();
        log(`Original target profit is RM ${originalTarget}`);
      } catch (e) {
        log(`Warning: could not read original target profit: ${e.message}`);
      }

      try {
        for (let i = 1; i <= 5; i++) {
          log(`\n--- Iteration ${i}/5 ---`);

          // 1. Log Sales
          log(`[Sale] Appending sales row...`);
          const saleDate = `2026-06-09`;
          const saleCash = Math.floor(Math.random() * 500) + 100;
          const saleQr = Math.floor(Math.random() * 300) + 50;
          const saleNotes = `Stress Test Iteration ${i}`;
          
          await AyamSheets.appendSalesRow({
            date: saleDate,
            cash: saleCash,
            qr: saleQr,
            notes: saleNotes
          });
          log(`[Sale] Appended sale row successfully.`);

          // 2. Log Expense
          log(`[Expense] Appending expense row...`);
          const expenseDate = `2026-06-09`;
          const expenseCategory = 'Flour/Spices';
          const expenseAmount = Math.floor(Math.random() * 100) + 10;
          const expenseType = 'Direct (COGS)';
          const expenseVendor = `Vendor-${i}`;
          const expenseStatus = 'Paid';
          const expenseNotes = `Stress Test Iteration ${i}`;
          
          await AyamSheets.appendExpenseRow({
            date: expenseDate,
            category: expenseCategory,
            amount: expenseAmount,
            type: expenseType,
            vendor: expenseVendor,
            status: expenseStatus,
            notes: expenseNotes
          });
          log(`[Expense] Appended expense row successfully.`);

          // 3. Save Inventory
          log(`[Inventory] Saving inventory item...`);
          const itemName = `Test-Item-${i}`;
          const itemQty = 10 + i;
          const itemUnit = 'kg';
          const itemMin = 5;
          const itemNotes = `Stress test item ${i}`;

          await AyamSheets.saveInventoryItem({
            name: itemName,
            quantity: itemQty,
            unit: itemUnit,
            minAlert: itemMin,
            notes: itemNotes
          });
          inventoryToDelete.push(itemName);
          log(`[Inventory] Saved inventory item "${itemName}" successfully.`);

          // 4. Update Inventory Qty
          log(`[Inventory] Updating inventory quantity for "${itemName}"...`);
          const newQty = itemQty + 5;
          await AyamSheets.updateInventoryQuantity(itemName, newQty);
          log(`[Inventory] Updated quantity to ${newQty} successfully.`);

          // 5. Update Setting
          log(`[Setting] Updating target profit to ${2000 + i * 100}...`);
          await AyamSheets.setTargetProfit(2000 + i * 100);
          log(`[Setting] Updated target profit successfully.`);
        }

        // Run verification on Dashboard
        log(`\n--- Verification ---`);
        log(`Loading dashboard metrics...`);
        await AyamDashboard.load();
        log(`Dashboard metrics loaded successfully.`);

        // 6. Clean up
        log(`\n--- Cleaning Up Test Data ---`);
        
        // Find the timestamps of the sales and expenses we just wrote so we can delete them
        log('Fetching sales data to locate test timestamps...');
        const allSales = await AyamSheets.getSalesData();
        allSales.forEach(row => {
          if (row.length >= 6 && row[4] && row[4].startsWith('Stress Test Iteration')) {
            salesToDelete.push(row[5]); // Timestamp is index 5
          }
        });

        log('Fetching expenses data to locate test timestamps...');
        const allExpenses = await AyamSheets.getExpensesData();
        allExpenses.forEach(row => {
          if (row.length >= 8 && row[6] && row[6].startsWith('Stress Test Iteration')) {
            expensesToDelete.push(row[7]); // Timestamp is index 7
          }
        });

        log(`Found ${salesToDelete.length} sales and ${expensesToDelete.length} expenses to delete.`);

        for (const timestamp of salesToDelete) {
          log(`[Cleanup] Deleting Daily Sale with timestamp: ${timestamp}...`);
          await AyamSheets.deleteRowByTimestamp('Daily_Sales', timestamp);
        }

        for (const timestamp of expensesToDelete) {
          log(`[Cleanup] Deleting Expense with timestamp: ${timestamp}...`);
          await AyamSheets.deleteRowByTimestamp('Expenses', timestamp);
        }

        for (const itemName of inventoryToDelete) {
          log(`[Cleanup] Deleting Inventory Item: "${itemName}"...`);
          await AyamSheets.deleteInventoryItem(itemName);
        }

        log(`[Cleanup] Restoring original target profit to RM ${originalTarget}...`);
        await AyamSheets.setTargetProfit(originalTarget);
        AyamDashboard.setTarget(originalTarget);

        log(`\nReloading dashboard with restored clean state...`);
        await AyamDashboard.load();

        log(`\n🎉 STRESS TEST SUCCESSFUL! 🎉`);
        log('All 5 iterations of read, write, update, delete, and settings configuration passed.');
      } catch (err) {
        log(`\n❌ STRESS TEST FAILED! ❌`);
        log(`Error: ${err.message}`);
      } finally {
        if (closeBtn) closeBtn.disabled = false;
      }
    }
  };
})();
