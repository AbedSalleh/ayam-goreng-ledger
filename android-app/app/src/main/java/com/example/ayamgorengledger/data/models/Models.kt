package com.example.ayamgorengledger.data.models

data class DailySales(
    val date: String,
    val cash: Double,
    val qr: Double,
    val total: Double,
    val notes: String,
    val timestamp: String
)

data class Expense(
    val date: String,
    val category: String,
    val amount: Double,
    val type: String,
    val vendor: String,
    val status: String,
    val notes: String,
    val timestamp: String
)

data class InventoryItem(
    val itemName: String,
    val quantity: Double,
    val unit: String,
    val minAlertQuantity: Double,
    val notes: String,
    val timestamp: String
)
