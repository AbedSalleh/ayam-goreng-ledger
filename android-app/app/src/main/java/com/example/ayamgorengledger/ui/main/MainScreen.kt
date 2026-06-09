package com.example.ayamgorengledger.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ayamgorengledger.ui.screens.*

enum class AppTab {
    Dashboard,
    Sales,
    Expenses,
    Inventory,
    Settings
}

@Composable
fun MainScreen(
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: MainScreenViewModel = viewModel()
) {
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(AppTab.Dashboard) }

    LaunchedEffect(Unit) {
        viewModel.loadAllData(context)
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF1E293B)) {
                NavigationBarItem(
                    selected = selectedTab == AppTab.Dashboard,
                    onClick = { selectedTab = AppTab.Dashboard },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Dashboard", tint = Color.White) },
                    label = { Text("Dashboard", color = Color.White, fontSize = 10.sp) }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.Sales,
                    onClick = { selectedTab = AppTab.Sales },
                    icon = { Icon(Icons.Default.ShoppingCart, contentDescription = "Sales", tint = Color.White) },
                    label = { Text("Sales", color = Color.White, fontSize = 10.sp) }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.Expenses,
                    onClick = { selectedTab = AppTab.Expenses },
                    icon = { Icon(Icons.Default.List, contentDescription = "Expenses", tint = Color.White) },
                    label = { Text("Expenses", color = Color.White, fontSize = 10.sp) }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.Inventory,
                    onClick = { selectedTab = AppTab.Inventory },
                    icon = { Icon(Icons.Default.Build, contentDescription = "Inventory", tint = Color.White) },
                    label = { Text("Inventory", color = Color.White, fontSize = 10.sp) }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.Settings,
                    onClick = { selectedTab = AppTab.Settings },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.White) },
                    label = { Text("Settings", color = Color.White, fontSize = 10.sp) }
                )
            }
        },
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFF0F172A)
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedTab) {
                AppTab.Dashboard -> DashboardScreen(viewModel = viewModel)
                AppTab.Sales -> SalesScreen(viewModel = viewModel)
                AppTab.Expenses -> ExpensesScreen(viewModel = viewModel)
                AppTab.Inventory -> InventoryScreen(viewModel = viewModel)
                AppTab.Settings -> SettingsScreen(viewModel = viewModel, onSignOut = onSignOut)
            }
            
            val isLoading by viewModel.isLoading.collectAsState()
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.4f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFF0D9488))
                }
            }
        }
    }
}
