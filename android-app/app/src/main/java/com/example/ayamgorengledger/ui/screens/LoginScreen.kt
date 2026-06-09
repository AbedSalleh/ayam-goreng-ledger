package com.example.ayamgorengledger.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.ayamgorengledger.data.sheets.AyamSheets

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var showWebView by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF0F172A), // Slate 900
                        Color(0xFF1E293B)  // Slate 800
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "AYAM GORENG LEDGER",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                letterSpacing = 2.sp,
                fontFamily = FontFamily.Monospace,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Professional Daily Sales & Inventory Manager",
                fontSize = 14.sp,
                color = Color(0xFF94A3B8), // Slate 400
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(48.dp))
            
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF334155).copy(alpha = 0.5f)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Sign in with Google to establish your secure ledger file. The ledger resides completely in your own Google Drive spreadsheet (zero server cost/storage fees).",
                        color = Color(0xFFCBD5E1), // Slate 300
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp
                    )
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Button(
                        onClick = { showWebView = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF0D9488), // Teal 600
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                    ) {
                        Text(
                            text = "SIGN IN WITH GOOGLE",
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }
        }
    }

    if (showWebView) {
        Dialog(
            onDismissRequest = { showWebView = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Surface(modifier = Modifier.fillMaxSize()) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Title Bar with Close button
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF0F172A))
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Google Sign In",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(start = 8.dp)
                        )
                        IconButton(onClick = { showWebView = false }) {
                            Text(text = "✖", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                    
                    OAuthWebView(
                        clientId = AyamSheets.CLIENT_ID,
                        onTokenCaptured = { token, expiresAt ->
                            AyamSheets.saveToken(context, token, expiresAt)
                            showWebView = false
                            onLoginSuccess()
                        }
                    )
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun OAuthWebView(
    clientId: String,
    onTokenCaptured: (String, Long) -> Unit,
    modifier: Modifier = Modifier
) {
    val authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
            "?client_id=$clientId" +
            "&redirect_uri=http://localhost" +
            "&response_type=token" +
            "&scope=https://www.googleapis.com/auth/spreadsheets%20https://www.googleapis.com/auth/drive.file"

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                
                // Spoof Chrome UA to bypass google oauth Webview block
                val defaultUa = settings.userAgentString
                settings.userAgentString = defaultUa.replace("; wv", "")
                
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                        val url = request?.url?.toString() ?: return false
                        if (url.startsWith("http://localhost")) {
                            val fragment = request.url.fragment
                            if (!fragment.isNullOrEmpty()) {
                                val params = fragment.split("&").associate {
                                    val parts = it.split("=")
                                    if (parts.size >= 2) parts[0] to parts[1] else parts[0] to ""
                                }
                                val token = params["access_token"]
                                val expiresIn = params["expires_in"]?.toLongOrNull() ?: 3600L
                                if (!token.isNullOrEmpty()) {
                                    val expiresAt = System.currentTimeMillis() + (expiresIn * 1000)
                                    onTokenCaptured(token, expiresAt)
                                    return true
                                }
                            }
                        }
                        return false
                    }
                }
                loadUrl(authUrl)
            }
        },
        modifier = modifier.fillMaxSize()
    )
}
