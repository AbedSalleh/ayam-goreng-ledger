package com.example.ayamgorengledger.ui.main

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.ayamgorengledger.data.models.DailySales
import com.example.ayamgorengledger.data.models.Expense
import com.example.ayamgorengledger.data.models.InventoryItem
import com.example.ayamgorengledger.data.sheets.AyamSheets
import com.example.ayamgorengledger.data.test.StressTester
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

class MainScreenViewModel : ViewModel() {
    val sales = MutableStateFlow<List<DailySales>>(emptyList())
    val expenses = MutableStateFlow<List<Expense>>(emptyList())
    val inventory = MutableStateFlow<List<InventoryItem>>(emptyList())
    val targetProfit = MutableStateFlow(2000.0)
    
    val isLoading = MutableStateFlow(false)
    val statusMessage = MutableStateFlow<String?>(null)
    
    val selectedYear = MutableStateFlow(Calendar.getInstance().get(Calendar.YEAR))
    val selectedMonth = MutableStateFlow(Calendar.getInstance().get(Calendar.MONTH) + 1) // 1-indexed

    fun loadAllData(context: Context) {
        viewModelScope.launch {
            isLoading.value = true
            statusMessage.value = "Connecting to Google Sheets..."
            try {
                // Initialize spreadsheet
                AyamSheets.initLedger(context)
                
                // Fetch in parallel
                val salesDeferred = async { AyamSheets.getSalesData() }
                val expensesDeferred = async { AyamSheets.getExpensesData() }
                val inventoryDeferred = async { AyamSheets.getInventoryData() }
                val targetProfitDeferred = async { AyamSheets.getTargetProfit() }
                
                sales.value = salesDeferred.await()
                expenses.value = expensesDeferred.await()
                inventory.value = inventoryDeferred.await()
                targetProfit.value = targetProfitDeferred.await()
                
                statusMessage.value = null
            } catch (e: AyamSheets.UnauthorizedException) {
                statusMessage.value = "Session expired. Please sign in again."
            } catch (e: Exception) {
                statusMessage.value = "Error loading data: ${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun addSales(context: Context, date: String, cash: Double, qr: Double, notes: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.appendSalesRow(date, cash, qr, notes)
                if (success) {
                    loadAllData(context)
                    onSuccess()
                } else {
                    statusMessage.value = "Failed to add sales."
                }
            } catch (e: Exception) {
                statusMessage.value = "Error: ${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun deleteSales(context: Context, timestamp: String) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.deleteRowByTimestamp(AyamSheets.TAB_SALES, timestamp)
                if (success) {
                    loadAllData(context)
                } else {
                    statusMessage.value = "Failed to delete sales entry."
                }
            } catch (e: Exception) {
                statusMessage.value = "Error: ${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun addExpense(
        context: Context,
        date: String,
        category: String,
        amount: Double,
        type: String,
        vendor: String,
        status: String,
        notes: String,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.appendExpenseRow(date, category, amount, type, vendor, status, notes)
                if (success) {
                    loadAllData(context)
                    onSuccess()
                } else {
                    statusMessage.value = "Failed to add expense."
                }
            } catch (e: Exception) {
                statusMessage.value = "Error: ${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun deleteExpense(context: Context, timestamp: String) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.deleteRowByTimestamp(AyamSheets.TAB_EXPENSES, timestamp)
                if (success) {
                    loadAllData(context)
                } else {
                    statusMessage.value = "Failed to delete expense entry."
                }
            } catch (e: Exception) {
                statusMessage.value = "Error: ${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun saveInventoryItem(
        context: Context,
        originalName: String?,
        name: String,
        qty: Double,
        unit: String,
        minAlert: Double,
        notes: String,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.saveInventoryItem(originalName, name, qty, unit, minAlert, notes)
                if (success) {
                    loadAllData(context)
                    onSuccess()
                } else {
                    statusMessage.value = "Failed to save inventory item."
                }
            } catch (e: Exception) {
                statusMessage.value = "${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun updateInventoryQuantity(context: Context, name: String, newQty: Double) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.updateInventoryQuantity(name, newQty)
                if (success) {
                    loadAllData(context)
                }
            } catch (e: Exception) {
                statusMessage.value = "${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun deleteInventoryItem(context: Context, name: String) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.deleteInventoryItem(name)
                if (success) {
                    loadAllData(context)
                }
            } catch (e: Exception) {
                statusMessage.value = "${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun updateTargetProfit(context: Context, amount: Double) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = AyamSheets.setTargetProfit(amount)
                if (success) {
                    targetProfit.value = amount
                }
            } catch (e: Exception) {
                statusMessage.value = "${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun repairColumns(context: Context) {
        viewModelScope.launch {
            isLoading.value = true
            statusMessage.value = "Repairing column alignments Check..."
            try {
                val success = AyamSheets.repairColumnAlignments()
                if (success) {
                    loadAllData(context)
                    statusMessage.value = "Alignment Repair finished successfully."
                } else {
                    statusMessage.value = "Alignment Repair failed."
                }
            } catch (e: Exception) {
                statusMessage.value = "Error: ${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
    
    fun runStressTest(context: Context) {
        viewModelScope.launch {
            isLoading.value = true
            try {
                val success = StressTester.runStressTest(context) { msg ->
                    statusMessage.value = msg
                }
                if (success) {
                    loadAllData(context)
                }
            } catch (e: Exception) {
                statusMessage.value = "Stress test error: ${e.message}"
            } finally {
                isLoading.value = false
            }
        }
    }
}
