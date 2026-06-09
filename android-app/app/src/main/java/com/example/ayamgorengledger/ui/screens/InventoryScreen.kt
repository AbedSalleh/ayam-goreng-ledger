package com.example.ayamgorengledger.ui.screens

import androidx.compose.foundation.background
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
import com.example.ayamgorengledger.data.models.InventoryItem
import com.example.ayamgorengledger.ui.main.MainScreenViewModel
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    viewModel: MainScreenViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val inventoryList by viewModel.inventory.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var showAddDialog by remember { mutableStateOf(false) }
    var itemToEdit by remember { mutableStateOf<InventoryItem?>(null) }
    var itemToDelete by remember { mutableStateOf<InventoryItem?>(null) }

    val filteredInventory = remember(inventoryList, searchQuery) {
        inventoryList.filter {
            searchQuery.isEmpty() || 
            it.itemName.contains(searchQuery, ignoreCase = true) || 
            it.notes.contains(searchQuery, ignoreCase = true)
        }
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
            
            // Search Input
            TextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search inventory...", color = Color(0xFF64748B), fontSize = 13.sp) },
                modifier = Modifier
                    .fillMaxWidth()
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

            Spacer(modifier = Modifier.height(16.dp))

            if (filteredInventory.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No inventory items found.", color = Color(0xFF64748B))
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredInventory) { item ->
                        InventoryListItem(
                            item = item,
                            onIncrement = {
                                viewModel.updateInventoryQuantity(context, item.itemName, item.quantity + 1.0)
                            },
                            onDecrement = {
                                if (item.quantity >= 1.0) {
                                    viewModel.updateInventoryQuantity(context, item.itemName, item.quantity - 1.0)
                                } else if (item.quantity > 0.0) {
                                    viewModel.updateInventoryQuantity(context, item.itemName, 0.0)
                                }
                            },
                            onEditClick = { itemToEdit = item },
                            onDeleteClick = { itemToDelete = item }
                        )
                    }
                }
            }
        }
    }

    // Add Item Dialog
    if (showAddDialog) {
        InventoryFormDialog(
            title = "Add Inventory Item",
            originalItem = null,
            onDismiss = { showAddDialog = false },
            onSave = { name, qty, unit, alert, notes ->
                viewModel.saveInventoryItem(context, null, name, qty, unit, alert, notes) {
                    showAddDialog = false
                }
            }
        )
    }

    // Edit Item Dialog
    if (itemToEdit != null) {
        InventoryFormDialog(
            title = "Edit Inventory Item",
            originalItem = itemToEdit,
            onDismiss = { itemToEdit = null },
            onSave = { name, qty, unit, alert, notes ->
                viewModel.saveInventoryItem(context, itemToEdit!!.itemName, name, qty, unit, alert, notes) {
                    itemToEdit = null
                }
            }
        )
    }

    // Delete Confirmation Dialog
    if (itemToDelete != null) {
        AlertDialog(
            onDismissRequest = { itemToDelete = null },
            title = { Text("Delete Item?", color = Color.White) },
            containerColor = Color(0xFF1E293B),
            text = { Text("Delete inventory record for \"${itemToDelete!!.itemName}\"? This will erase the item completely.", color = Color(0xFFCBD5E1)) },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteInventoryItem(context, itemToDelete!!.itemName)
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
fun InventoryListItem(
    item: InventoryItem,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isLowStock = item.quantity <= item.minAlertQuantity

    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = item.itemName,
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        
                        if (isLowStock) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .background(Color(0xFFF43F5E).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("LOW STOCK", color = Color(0xFFF43F5E), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    Text(
                        text = String.format(Locale.US, "Current Stock: %.1f %s", item.quantity, item.unit),
                        color = if (isLowStock) Color(0xFFF43F5E) else Color(0xFF0D9488),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    
                    Text(
                        text = String.format(Locale.US, "Min Alert Level: %.1f %s", item.minAlertQuantity, item.unit),
                        color = Color(0xFF64748B),
                        fontSize = 11.sp
                    )
                }

                // Inline Quantity Adjusters
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    FilledIconButton(
                        onClick = onDecrement,
                        colors = IconButtonDefaults.filledIconButtonColors(containerColor = Color(0xFF334155)),
                        modifier = Modifier.size(32.dp)
                    ) {
                        Text("-", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }

                    FilledIconButton(
                        onClick = onIncrement,
                        colors = IconButtonDefaults.filledIconButtonColors(containerColor = Color(0xFF0D9488)),
                        modifier = Modifier.size(32.dp)
                    ) {
                        Text("+", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (item.notes.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = item.notes,
                    color = Color(0xFFCBD5E1),
                    fontSize = 12.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Divider(color = Color(0xFF334155))
            Spacer(modifier = Modifier.height(4.dp))

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onEditClick) {
                    Text("Edit", color = Color(0xFF0D9488), fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.width(8.dp))
                TextButton(onClick = onDeleteClick) {
                    Text("Delete", color = Color(0xFFF43F5E), fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun InventoryFormDialog(
    title: String,
    originalItem: InventoryItem?,
    onDismiss: () -> Unit,
    onSave: (String, Double, String, Double, String) -> Unit
) {
    var nameVal by remember { mutableStateOf(originalItem?.itemName ?: "") }
    var qtyVal by remember { mutableStateOf(originalItem?.quantity?.toString() ?: "") }
    var unitVal by remember { mutableStateOf(originalItem?.unit ?: "kg") }
    var alertVal by remember { mutableStateOf(originalItem?.minAlertQuantity?.toString() ?: "") }
    var notesVal by remember { mutableStateOf(originalItem?.notes ?: "") }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, color = Color.White) },
        containerColor = Color(0xFF1E293B),
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (errorMsg != null) {
                    Text(errorMsg!!, color = Color(0xFFF43F5E), fontSize = 12.sp)
                }

                OutlinedTextField(
                    value = nameVal,
                    onValueChange = { nameVal = it },
                    label = { Text("Item Name", color = Color(0xFF94A3B8)) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF0D9488),
                        unfocusedBorderColor = Color(0xFF475569)
                    ),
                    singleLine = true,
                    enabled = originalItem == null // cannot change primary name once created
                )

                Row(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = qtyVal,
                        onValueChange = { qtyVal = it },
                        label = { Text("Quantity", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedTextField(
                        value = unitVal,
                        onValueChange = { unitVal = it },
                        label = { Text("Unit (e.g., kg)", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF0D9488),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = alertVal,
                    onValueChange = { alertVal = it },
                    label = { Text("Min Alert Quantity", color = Color(0xFF94A3B8)) },
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
                    val qty = qtyVal.toDoubleOrNull() ?: 0.0
                    val alert = alertVal.toDoubleOrNull() ?: 0.0
                    
                    if (nameVal.trim().isEmpty()) {
                        errorMsg = "Item name is required."
                        return@Button
                    }
                    if (qty < 0 || alert < 0) {
                        errorMsg = "Quantities must be positive."
                        return@Button
                    }

                    onSave(nameVal.trim(), qty, unitVal.trim(), alert, notesVal)
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D9488))
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Color(0xFF94A3B8))
            }
        }
    )
}
