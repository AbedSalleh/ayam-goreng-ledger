package com.example.ayamgorengledger

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.example.ayamgorengledger.data.sheets.AyamSheets
import com.example.ayamgorengledger.ui.main.MainScreen
import com.example.ayamgorengledger.ui.screens.LoginScreen

@Composable
fun MainNavigation() {
    val context = LocalContext.current
    
    // Initialize token cache on startup
    LaunchedEffect(Unit) {
        AyamSheets.initToken(context)
    }

    var isAuthorized by remember { mutableStateOf(AyamSheets.isAuthorized()) }

    if (!isAuthorized) {
        LoginScreen(
            onLoginSuccess = { isAuthorized = true }
        )
    } else {
        MainScreen(
            onSignOut = { isAuthorized = false }
        )
    }
}

