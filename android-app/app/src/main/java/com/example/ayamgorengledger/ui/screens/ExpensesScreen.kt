package com.example.ayamgorengledger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ayamgorengledger.data.models.Expense
import com.example.ayamgorengledger.ui.main.MainScreenViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpensesScreen(
    viewModel: MainScreenViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val expensesList by viewModel.expenses.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var sortOrder by remember { mutableStateOf("Date Desc") }
    var showAddDialog by remember { mutableStateOf(false) }
    var itemToDelete by remember { mutableStateOf<Expense?>(null) }

    val processedExpenses = remember(expensesList, searchQuery, sortOrder) {
        var list = expensesList.filter {
            searchQuery.isEmpty() || 
            it.category.contains(searchQuery, ignoreCase = true) || 
            it.vendor.contains(searchQuery, ignoreCase = true) || 
            it.notes.contains(searchQuery, ignoreCase = true) ||
            it.date.contains(searchQuery)
        }
        
        list = when (sortOrder) {
            "Date Asc" -> list.sortedWith(compareBy({ it.date }, { it.timestamp }))
            "Amount Desc" -> list.sortedByDescending { it.amount }
            "Amount Asc" -> list.sortedBy { it.amount }
            else -> list.sortedWith(compareByDescending<Expense> { it.date }.thenByDescending { it.timestamp }) // Date Desc
        }
        list
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFF0F172A),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = Color(0xFF0D9488),
                contentColor = Color.White
            ) {
                Text("+", fontSize = 24.sp, fontWeight = FontWeight.Bold)
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))
            
            // Search and Sort Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search expenses...", color = Color(0xFF64748B), fontSize = 13.sp) },
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color(0xFF1E293B),
                        unfocusedContainerColor = Color(0xFF1E293B),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent
                    ),
                    shape = RoundedCornerShape(8.dp),
                    singleLine = true
                )

                Spacer(modifier = Modifier.width(8.dp))

                var showDropdown by remember { mutableStateOf(false) }
                Box {
                    Button(
                        onClick = { showDropdown = true },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.height(50.dp)
                    ) {
                        Text(sortOrder, color = Color.White, fontSize = 12.sp)
                    }

                    DropdownMenu(
                        expanded = showDropdown,
                        onDismissRequest = { showDropdown = false },
                        modifier = Modifier.background(Color(0xFF1E293B))
                    ) {
                        listOf("Date Desc", "Date Asc", "Amount Desc", "Amount Asc").forEach { order ->
                            DropdownMenuItem(
                                text = { Text(order, color = Color.White) },
                                onClick = {
                                    sortOrder = order
                                    showDropdown = false
                                }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (processedExpenses.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No expense entries found.", color = Color(0xFF64748B))
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(processedExpenses) { item ->
                        ExpenseListItem(
                            item = item,
                            onDeleteClick = { itemToDelete = item }
                        )
                    }
                }
            }
        }
    }

    // Add Entry Dialog
    if (showAddDialog) {
        var dateVal by remember {
            val df = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            mutableStateOf(df.format(Date()))
        }
        var categoryVal by remember { mutableStateOf("Chicken") }
        var amountVal by remember { mutableStateOf("") }
        var typeVal by remember { mutableStateOf("Direct (COGS)") }
        var vendorVal by remember { mutableStateOf("") }
        var statusVal by remember { mutableStateOf("Paid") }
        var notesVal by remember { mutableStateOf("") }
        var errorMsg by remember { mutableStateOf<String?>(null) }

        val categories = listOf("Chicken", "Oil", "Flour", "Gas", "Rent", "Utilities", "Packaging", "Wages", "Marketing", "Other")
        val types = listOf("Direct (COGS)", "Indirect")
        val statuses = listOf("Paid", "Unpaid")

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Log Expense Entry", color = Color.White) },
            containerColor = Color(0xFF1E293B),
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.verticalScroll(rememberScrollState())
                ) {
                    if (errorMsg != null) {
                        Text(errorMsg!!, color = Color(0xFFF43F5E), fontSize = 12.sp)
                    }

                    OutlinedTextField(
                        value = dateVal,
                        onValueChange = { dateVal = it },
                        label = { Text("Date (YYYY-MM-DD)", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        singleLine = true
                    )

                    // Category Dropdown
                    var showCatDropdown by remember { mutableStateOf(false) }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = categoryVal,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Category", color = Color(0xFF94A3B8)) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFF0D9488),
                                unfocusedBorderColor = Color(0xFF475569)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showCatDropdown = true },
                            enabled = false
                        )
                        Box(modifier = Modifier
                            .matchParentSize()
                            .clickable { showCatDropdown = true })

                        DropdownMenu(
                            expanded = showCatDropdown,
                            onDismissRequest = { showCatDropdown = false },
                            modifier = Modifier.background(Color(0xFF1E293B))
                        ) {
                            categories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { Text(cat, color = Color.White) },
                                    onClick = {
                                        categoryVal = cat
                                        showCatDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = amountVal,
                        onValueChange = { amountVal = it },
                        label = { Text("Amount (RM)", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true
                    )

                    // Type Dropdown
                    var showTypeDropdown by remember { mutableStateOf(false) }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = typeVal,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Type", color = Color(0xFF94A3B8)) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFF0D9488),
                                unfocusedBorderColor = Color(0xFF475569)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showTypeDropdown = true },
                            enabled = false
                        )
                        Box(modifier = Modifier
                            .matchParentSize()
                            .clickable { showTypeDropdown = true })

                        DropdownMenu(
                            expanded = showTypeDropdown,
                            onDismissRequest = { showTypeDropdown = false },
                            modifier = Modifier.background(Color(0xFF1E293B))
                        ) {
                            types.forEach { t ->
                                DropdownMenuItem(
                                    text = { Text(t, color = Color.White) },
                                    onClick = {
                                        typeVal = t
                                        showTypeDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = vendorVal,
                        onValueChange = { vendorVal = it },
                        label = { Text("Vendor", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        singleLine = true
                    )

                    // Status Dropdown
                    var showStatusDropdown by remember { mutableStateOf(false) }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = statusVal,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Status", color = Color(0xFF94A3B8)) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFF0D9488),
                                unfocusedBorderColor = Color(0xFF475569)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showStatusDropdown = true },
                            enabled = false
                        )
                        Box(modifier = Modifier
                            .matchParentSize()
                            .clickable { showStatusDropdown = true })

                        DropdownMenu(
                            expanded = showStatusDropdown,
                            onDismissRequest = { showStatusDropdown = false },
                            modifier = Modifier.background(Color(0xFF1E293B))
                        ) {
                            statuses.forEach { s ->
                                DropdownMenuItem(
                                    text = { Text(s, color = Color.White) },
                                    onClick = {
                                        statusVal = s
                                        showStatusDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = notesVal,
                        onValueChange = { notesVal = it },
                        label = { Text("Notes", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amount = amountVal.toDoubleOrNull() ?: 0.0
                        val vendor = if (vendorVal.trim().isEmpty()) "General" else vendorVal.trim()
                        
                        if (amount <= 0) {
                            errorMsg = "Amount must be greater than RM 0."
                            return@Button
                        }
                        if (!dateVal.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
                            errorMsg = "Date must be YYYY-MM-DD."
                            return@Button
                        }

                        viewModel.addExpense(context, dateVal, categoryVal, amount, typeVal, vendor, statusVal, notesVal) {
                            showAddDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D9488))
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel", color = Color(0xFF94A3B8))
                }
            }
        )
    }

    // Delete Confirmation Dialog
    if (itemToDelete != null) {
        AlertDialog(
            onDismissRequest = { itemToDelete = null },
            title = { Text("Delete Entry?", color = Color.White) },
            containerColor = Color(0xFF1E293B),
            text = { Text("Delete expense record of RM ${String.format(Locale.US, "%.2f", itemToDelete!!.amount)} (${itemToDelete!!.category}) on ${itemToDelete!!.date}?", color = Color(0xFFCBD5E1)) },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteExpense(context, itemToDelete!!.timestamp)
                        itemToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF43F5E))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { itemToDelete = null }) {
                    Text("Cancel", color = Color(0xFF94A3B8))
                }
            }
        )
    }
}

@Composable
fun ExpenseListItem(
    item: Expense,
    onDeleteClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = item.date,
                        color = Color(0xFF94A3B8),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .background(Color(0xFFF43F5E).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text("DR", color = Color(0xFFF43F5E), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                    
                    if (item.status.equals("Unpaid", ignoreCase = true)) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .background(Color(0xFFE2E8F0).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text("UNPAID", color = Color(0xFFE2E8F0), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = String.format(Locale.US, "RM %.2f", item.amount),
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(2.dp))
                
                Text(
                    text = "${item.category} • ${item.type} • Vendor: ${item.vendor}",
                    color = Color(0xFF64748B),
                    fontSize = 11.sp
                )
                
                if (item.notes.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.notes,
                        color = Color(0xFFCBD5E1),
                        fontSize = 12.sp
                    )
                }
            }
            
            IconButton(onClick = onDeleteClick) {
                Text("🗑", color = Color(0xFFF43F5E), fontSize = 18.sp)
            }
        }
    }
}
