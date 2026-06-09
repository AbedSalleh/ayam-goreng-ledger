package com.example.ayamgorengledger.data.test

import android.content.Context
import android.util.Log
import com.example.ayamgorengledger.data.sheets.AyamSheets
import kotlinx.coroutines.delay

object StressTester {
    private const val TAG = "StressTester"

    suspend fun runStressTest(context: Context, onProgress: (String) -> Unit): Boolean {
        try {
            onProgress("Starting Stress Test: 5 cycles of operations...")
            
            val id = AyamSheets.getSpreadsheetId() ?: AyamSheets.initLedger(context)
            Log.i(TAG, "Running stress test on spreadsheet: $id")

            for (i in 1..5) {
                onProgress("Cycle $i/5: Appending Sales row...")
                val salesSuccess = AyamSheets.appendSalesRow(
                    date = "2026-06-09",
                    cash = 100.0 + (i * 10),
                    qr = 50.0 + (i * 5),
                    notes = "STRESS_TEST_SALES_$i"
                )
                if (!salesSuccess) throw Exception("Failed to append sales in cycle $i")

                onProgress("Cycle $i/5: Appending Expense row...")
                val expenseSuccess = AyamSheets.appendExpenseRow(
                    date = "2026-06-09",
                    category = "Chicken",
                    amount = 30.0 + (i * 2),
                    type = "Direct (COGS)",
                    vendor = "Stress Vendor $i",
                    status = "Paid",
                    notes = "STRESS_TEST_EXPENSE_$i"
                )
                if (!expenseSuccess) throw Exception("Failed to append expense in cycle $i")

                onProgress("Cycle $i/5: Saving Inventory Item...")
                val inventorySuccess = AyamSheets.saveInventoryItem(
                    originalName = null,
                    name = "Stress Item $i",
                    quantity = 20.0 + i,
                    unit = "pcs",
                    minAlert = 10.0,
                    notes = "STRESS_TEST_INV_$i"
                )
                if (!inventorySuccess) throw Exception("Failed to save inventory item in cycle $i")
                
                // Wait 1 second between queries to respect Google API limits
                delay(1000)
            }

            onProgress("Stress test completed successfully! 15 entries written.")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Stress test failed", e)
            onProgress("Stress Test Failed: ${e.message}")
            return false
        }
    }
}
