package com.example.ayamgorengledger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.example.ayamgorengledger.data.models.DailySales
import com.example.ayamgorengledger.ui.main.MainScreenViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    viewModel: MainScreenViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val salesList by viewModel.sales.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var sortOrder by remember { mutableStateOf("Date Desc") }
    var showAddDialog by remember { mutableStateOf(false) }
    var itemToDelete by remember { mutableStateOf<DailySales?>(null) }

    // Filter and Sort Sales List
    val processedSales = remember(salesList, searchQuery, sortOrder) {
        var list = salesList.filter {
            searchQuery.isEmpty() || it.notes.contains(searchQuery, ignoreCase = true) || it.date.contains(searchQuery)
        }
        
        list = when (sortOrder) {
            "Date Asc" -> list.sortedWith(compareBy({ it.date }, { it.timestamp }))
            "Total Desc" -> list.sortedByDescending { it.total }
            "Total Asc" -> list.sortedBy { it.total }
            else -> list.sortedWith(compareByDescending<DailySales> { it.date }.thenByDescending { it.timestamp }) // Date Desc
        }
        list
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFF0F172A),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = Color(0xFF0D9488), // Teal 600
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
                    placeholder = { Text("Search sales...", color = Color(0xFF64748B), fontSize = 13.sp) },
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

                // Sort Dropdown button
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
                        listOf("Date Desc", "Date Asc", "Total Desc", "Total Asc").forEach { order ->
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

            if (processedSales.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No sales entries found.", color = Color(0xFF64748B))
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(processedSales) { item ->
                        SalesListItem(
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
        var cashVal by remember { mutableStateOf("") }
        var qrVal by remember { mutableStateOf("") }
        var notesVal by remember { mutableStateOf("") }
        var errorMsg by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Log Sales Entry", color = Color.White) },
            containerColor = Color(0xFF1E293B),
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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

                    OutlinedTextField(
                        value = cashVal,
                        onValueChange = { cashVal = it },
                        label = { Text("Cash Revenue (RM)", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = qrVal,
                        onValueChange = { qrVal = it },
                        label = { Text("QR/DuitNow Revenue (RM)", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true
                    )

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
                        val cash = cashVal.toDoubleOrNull() ?: 0.0
                        val qr = qrVal.toDoubleOrNull() ?: 0.0
                        
                        if (cash < 0 || qr < 0) {
                            errorMsg = "Amounts must be non-negative."
                            return@Button
                        }
                        if (cash == 0.0 && qr == 0.0) {
                            errorMsg = "Enter cash or QR revenue."
                            return@Button
                        }
                        if (!dateVal.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
                            errorMsg = "Date must be YYYY-MM-DD."
                            return@Button
                        }

                        viewModel.addSales(context, dateVal, cash, qr, notesVal) {
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
            text = { Text("Delete sales record of RM ${String.format(Locale.US, "%.2f", itemToDelete!!.total)} on ${itemToDelete!!.date}?", color = Color(0xFFCBD5E1)) },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteSales(context, itemToDelete!!.timestamp)
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
fun SalesListItem(
    item: DailySales,
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
                            .background(Color(0xFF0D9488).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text("CR", color = Color(0xFF0D9488), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = String.format(Locale.US, "RM %.2f", item.total),
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(2.dp))
                
                Text(
                    text = String.format(Locale.US, "Cash: RM %.0f | QR: RM %.0f", item.cash, item.qr),
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
