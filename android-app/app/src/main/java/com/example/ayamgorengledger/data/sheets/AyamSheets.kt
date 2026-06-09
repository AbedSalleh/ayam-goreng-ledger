package com.example.ayamgorengledger.data.sheets

import android.content.Context
import android.util.Log
import com.example.ayamgorengledger.data.models.DailySales
import com.example.ayamgorengledger.data.models.Expense
import com.example.ayamgorengledger.data.models.InventoryItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.time.Instant
import java.util.concurrent.TimeUnit

object AyamSheets {
    private const val TAG = "AyamSheets"
    const val CLIENT_ID = "905579408027-vbfp6i4asha3g4eeoros34605u92gos0.apps.googleusercontent.com"
    private const val SPREADSHEET_NAME = "Ayam_Goreng_Ledger"
    private const val DEFAULT_TARGET_PROFIT = 2000.0

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private var spreadsheetId: String? = null
    private var cachedToken: String? = null
    private var tokenExpiry: Long = 0

    // Tab names
    const val TAB_SALES = "Daily_Sales"
    const val TAB_EXPENSES = "Expenses"
    const val TAB_INVENTORY = "Inventory"
    const val TAB_SETTINGS = "Settings"

    class UnauthorizedException(message: String) : IOException(message)

    fun initToken(context: Context) {
        val prefs = context.getSharedPreferences("ayam_auth_prefs", Context.MODE_PRIVATE)
        cachedToken = prefs.getString("access_token", null)
        tokenExpiry = prefs.getLong("expires_at", 0)
        spreadsheetId = prefs.getString("spreadsheet_id", null)
    }

    fun saveToken(context: Context, token: String, expiresAt: Long) {
        cachedToken = token
        tokenExpiry = expiresAt
        context.getSharedPreferences("ayam_auth_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("access_token", token)
            .putLong("expires_at", expiresAt)
            .apply()
    }

    fun clearToken(context: Context) {
        cachedToken = null
        tokenExpiry = 0
        spreadsheetId = null
        context.getSharedPreferences("ayam_auth_prefs", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply()
    }

    fun isAuthorized(): Boolean {
        return cachedToken != null && System.currentTimeMillis() < tokenExpiry
    }

    fun getAccessToken(): String? = cachedToken

    fun getSpreadsheetId(): String? = spreadsheetId

    fun getSpreadsheetUrl(): String? {
        val id = spreadsheetId ?: return null
        return "https://docs.google.com/spreadsheets/d/$id/edit"
    }

    private fun getAuthHeaders(): Map<String, String> {
        val token = cachedToken ?: throw UnauthorizedException("No access token available")
        if (System.currentTimeMillis() >= tokenExpiry) {
            throw UnauthorizedException("Access token expired")
        }
        return mapOf("Authorization" to "Bearer $token")
    }

    // HTTP Request Helpers
    private suspend fun makeGetRequest(url: String): String = withContext(Dispatchers.IO) {
        val headers = getAuthHeaders()
        val requestBuilder = Request.Builder().url(url)
        headers.forEach { (k, v) -> requestBuilder.addHeader(k, v) }
        
        val request = requestBuilder.build()
        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: ""
            if (response.code == 401) {
                throw UnauthorizedException("API unauthorized response")
            }
            if (!response.isSuccessful) {
                throw IOException("GET Request failed: ${response.code} - ${response.message}\n$body")
            }
            body
        }
    }

    private suspend fun makePostRequest(url: String, jsonBody: String): String = withContext(Dispatchers.IO) {
        val headers = getAuthHeaders()
        val requestBody = jsonBody.toRequestBody(JSON_MEDIA_TYPE)
        val requestBuilder = Request.Builder().url(url).post(requestBody)
        headers.forEach { (k, v) -> requestBuilder.addHeader(k, v) }
        
        val request = requestBuilder.build()
        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: ""
            if (response.code == 401) {
                throw UnauthorizedException("API unauthorized response")
            }
            if (!response.isSuccessful) {
                throw IOException("POST Request failed: ${response.code} - ${response.message}\n$body")
            }
            body
        }
    }

    private suspend fun makePutRequest(url: String, jsonBody: String): String = withContext(Dispatchers.IO) {
        val headers = getAuthHeaders()
        val requestBody = jsonBody.toRequestBody(JSON_MEDIA_TYPE)
        val requestBuilder = Request.Builder().url(url).put(requestBody)
        headers.forEach { (k, v) -> requestBuilder.addHeader(k, v) }
        
        val request = requestBuilder.build()
        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: ""
            if (response.code == 401) {
                throw UnauthorizedException("API unauthorized response")
            }
            if (!response.isSuccessful) {
                throw IOException("PUT Request failed: ${response.code} - ${response.message}\n$body")
            }
            body
        }
    }

    // Ledger Initialisation
    suspend fun initLedger(context: Context): String = withContext(Dispatchers.IO) {
        Log.i(TAG, "Initializing Ledger...")
        val existingId = findLedger()
        if (existingId != null) {
            spreadsheetId = existingId
            Log.i(TAG, "Found existing ledger: $spreadsheetId")
            context.getSharedPreferences("ayam_auth_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("spreadsheet_id", spreadsheetId)
                .apply()
            ensureInventoryTabExists()
        } else {
            val newId = createLedger()
            spreadsheetId = newId
            Log.i(TAG, "Created new ledger: $spreadsheetId")
            context.getSharedPreferences("ayam_auth_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("spreadsheet_id", spreadsheetId)
                .apply()
        }
        repairColumnAlignments()
        spreadsheetId!!
    }

    private suspend fun findLedger(): String? {
        val query = "name='$SPREADSHEET_NAME' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
        val url = "https://www.googleapis.com/drive/v3/files?q=${java.net.URLEncoder.encode(query, "UTF-8")}&fields=files(id,name)"
        try {
            val response = makeGetRequest(url)
            val json = JSONObject(response)
            val files = json.optJSONArray("files")
            if (files != null && files.length() > 0) {
                return files.getJSONObject(0).getString("id")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error finding ledger", e)
        }
        return null
    }

    private suspend fun createLedger(): String {
        val url = "https://sheets.googleapis.com/v4/spreadsheets"
        val body = JSONObject().apply {
            put("properties", JSONObject().apply { put("title", SPREADSHEET_NAME) })
            put("sheets", JSONArray().apply {
                put(JSONObject().apply { put("properties", JSONObject().apply { put("title", TAB_SALES); put("index", 0) }) })
                put(JSONObject().apply { put("properties", JSONObject().apply { put("title", TAB_EXPENSES); put("index", 1) }) })
                put(JSONObject().apply { put("properties", JSONObject().apply { put("title", TAB_INVENTORY); put("index", 2) }) })
                put(JSONObject().apply { put("properties", JSONObject().apply { put("title", "Monthly_Summary"); put("index", 3) }) })
                put(JSONObject().apply { put("properties", JSONObject().apply { put("title", TAB_SETTINGS); put("index", 4) }) })
            })
        }
        val response = makePostRequest(url, body.toString())
        val id = JSONObject(response).getString("spreadsheetId")
        
        // Write headers
        writeInitialHeaders(id)
        return id
    }

    private suspend fun writeInitialHeaders(id: String) {
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values:batchUpdate"
        
        val settingsValues = JSONArray().apply {
            put(JSONArray().apply { put("Key"); put("Value") })
            put(JSONArray().apply { put("target_profit"); put(DEFAULT_TARGET_PROFIT.toString()) })
        }

        val requestBody = JSONObject().apply {
            put("valueInputOption", "RAW")
            put("data", JSONArray().apply {
                put(JSONObject().apply {
                    put("range", "$TAB_SALES!A1:F1")
                    put("values", JSONArray().apply {
                        put(JSONArray().apply {
                            put("Date"); put("Cash Revenue (RM)"); put("QR/DuitNow Revenue (RM)"); put("Total Revenue (RM)"); put("Notes"); put("Timestamp")
                        })
                    })
                })
                put(JSONObject().apply {
                    put("range", "$TAB_EXPENSES!A1:H1")
                    put("values", JSONArray().apply {
                        put(JSONArray().apply {
                            put("Date"); put("Category"); put("Amount (RM)"); put("Type"); put("Vendor"); put("Status"); put("Notes"); put("Timestamp")
                        })
                    })
                })
                put(JSONObject().apply {
                    put("range", "$TAB_INVENTORY!A1:F1")
                    put("values", JSONArray().apply {
                        put(JSONArray().apply {
                            put("Item Name"); put("Quantity"); put("Unit"); put("Min Alert Quantity"); put("Notes"); put("Timestamp")
                        })
                    })
                })
                put(JSONObject().apply {
                    put("range", "Monthly_Summary!A1")
                    put("values", JSONArray().apply {
                        put(JSONArray().apply {
                            put("Auto-generated summary — do not edit manually")
                        })
                    })
                })
                put(JSONObject().apply {
                    put("range", "$TAB_SETTINGS!A1:B2")
                    put("values", settingsValues)
                })
            })
        }
        makePostRequest(url, requestBody.toString())
    }

    private suspend fun ensureInventoryTabExists() {
        val id = spreadsheetId ?: return
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id?fields=sheets.properties"
        val response = makeGetRequest(url)
        val json = JSONObject(response)
        val sheets = json.optJSONArray("sheets") ?: return
        var hasInventory = false
        for (i in 0 until sheets.length()) {
            val title = sheets.getJSONObject(i).getJSONObject("properties").getString("title")
            if (title == TAB_INVENTORY) {
                hasInventory = true
                break
            }
        }

        if (!hasInventory) {
            Log.i(TAG, "Inventory tab not found, creating it...")
            val addSheetUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id:batchUpdate"
            val body = JSONObject().apply {
                put("requests", JSONArray().apply {
                    put(JSONObject().apply {
                        put("addSheet", JSONObject().apply {
                            put("properties", JSONObject().apply { put("title", TAB_INVENTORY) })
                        })
                    })
                })
            }
            makePostRequest(addSheetUrl, body.toString())

            // Write Inventory headers
            val headerUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_INVENTORY!A1:F1?valueInputOption=RAW"
            val headerBody = JSONObject().apply {
                put("values", JSONArray().apply {
                    put(JSONArray().apply {
                        put("Item Name"); put("Quantity"); put("Unit"); put("Min Alert Quantity"); put("Notes"); put("Timestamp")
                    })
                })
            }
            makePutRequest(headerUrl, headerBody.toString())
        }
    }

    // Daily Sales CRUD
    suspend fun getSalesData(): List<DailySales> = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext emptyList()
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_SALES!A2:F"
        try {
            val response = makeGetRequest(url)
            val json = JSONObject(response)
            val values = json.optJSONArray("values") ?: return@withContext emptyList()
            val list = mutableListOf<DailySales>()
            for (i in 0 until values.length()) {
                val row = values.getJSONArray(i)
                if (row.length() < 1) continue
                val date = row.optString(0, "")
                val cash = row.optString(1, "0").toDoubleOrNull() ?: 0.0
                val qr = row.optString(2, "0").toDoubleOrNull() ?: 0.0
                val total = row.optString(3, "0").toDoubleOrNull() ?: (cash + qr)
                val notes = row.optString(4, "")
                val timestamp = row.optString(5, "")
                list.add(DailySales(date, cash, qr, total, notes, timestamp))
            }
            list
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching sales", e)
            emptyList()
        }
    }

    suspend fun appendSalesRow(date: String, cash: Double, qr: Double, notes: String): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        val rowCountUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_SALES!A:A"
        val countResponse = makeGetRequest(rowCountUrl)
        val countJson = JSONObject(countResponse)
        val rows = countJson.optJSONArray("values")
        val nextRow = (rows?.length() ?: 0) + 1

        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_SALES!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"
        val body = JSONObject().apply {
            put("values", JSONArray().apply {
                put(JSONArray().apply {
                    put(date)
                    put(cash)
                    put(qr)
                    put("=B$nextRow+C$nextRow")
                    put(notes)
                    put(Instant.now().toString())
                })
            })
        }
        makePostRequest(url, body.toString())
        true
    }

    // Expenses CRUD
    suspend fun getExpensesData(): List<Expense> = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext emptyList()
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_EXPENSES!A2:H"
        try {
            val response = makeGetRequest(url)
            val json = JSONObject(response)
            val values = json.optJSONArray("values") ?: return@withContext emptyList()
            val list = mutableListOf<Expense>()
            for (i in 0 until values.length()) {
                val row = values.getJSONArray(i)
                if (row.length() < 1) continue
                val date = row.optString(0, "")
                val category = row.optString(1, "")
                val amount = row.optString(2, "0").toDoubleOrNull() ?: 0.0
                val type = row.optString(3, "Direct (COGS)")
                val vendor = row.optString(4, "General")
                val status = row.optString(5, "Paid")
                val notes = row.optString(6, "")
                val timestamp = row.optString(7, "")
                list.add(Expense(date, category, amount, type, vendor, status, notes, timestamp))
            }
            list
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching expenses", e)
            emptyList()
        }
    }

    suspend fun appendExpenseRow(
        date: String,
        category: String,
        amount: Double,
        type: String,
        vendor: String,
        status: String,
        notes: String
    ): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_EXPENSES!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"
        val body = JSONObject().apply {
            put("values", JSONArray().apply {
                put(JSONArray().apply {
                    put(date)
                    put(category)
                    put(amount)
                    put(type)
                    put(vendor)
                    put(status)
                    put(notes)
                    put(Instant.now().toString())
                })
            })
        }
        makePostRequest(url, body.toString())
        true
    }

    // Inventory CRUD
    suspend fun getInventoryData(): List<InventoryItem> = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext emptyList()
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_INVENTORY!A2:F"
        try {
            val response = makeGetRequest(url)
            val json = JSONObject(response)
            val values = json.optJSONArray("values") ?: return@withContext emptyList()
            val list = mutableListOf<InventoryItem>()
            for (i in 0 until values.length()) {
                val row = values.getJSONArray(i)
                if (row.length() < 1) continue
                val name = row.optString(0, "")
                val qty = row.optString(1, "0").toDoubleOrNull() ?: 0.0
                val unit = row.optString(2, "")
                val minAlert = row.optString(3, "0").toDoubleOrNull() ?: 0.0
                val notes = row.optString(4, "")
                val timestamp = row.optString(5, "")
                list.add(InventoryItem(name, qty, unit, minAlert, notes, timestamp))
            }
            list
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching inventory", e)
            emptyList()
        }
    }

    suspend fun saveInventoryItem(
        originalName: String?,
        name: String,
        quantity: Double,
        unit: String,
        minAlert: Double,
        notes: String
    ): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        val rows = getInventoryData()
        val searchName = originalName ?: name

        var foundIndex = -1
        for (i in rows.indices) {
            if (rows[i].itemName.equals(searchName, ignoreCase = true)) {
                foundIndex = i
                break
            }
        }

        val values = JSONArray().apply {
            put(JSONArray().apply {
                put(name)
                put(quantity)
                put(unit)
                put(minAlert)
                put(notes)
                put(Instant.now().toString())
            })
        }

        if (foundIndex != -1) {
            val rowNum = foundIndex + 2
            val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_INVENTORY!A$rowNum:F$rowNum?valueInputOption=USER_ENTERED"
            val body = JSONObject().apply { put("values", values) }
            makePutRequest(url, body.toString())
        } else {
            // Check if name already exists (if we didn't specify originalName)
            if (originalName == null) {
                val exists = rows.any { it.itemName.equals(name, ignoreCase = true) }
                if (exists) {
                    throw IOException("An item named \"$name\" already exists.")
                }
            }
            val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_INVENTORY!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"
            val body = JSONObject().apply { put("values", values) }
            makePostRequest(url, body.toString())
        }
        true
    }

    suspend fun updateInventoryQuantity(name: String, newQuantity: Double): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        val rows = getInventoryData()
        var foundIndex = -1
        for (i in rows.indices) {
            if (rows[i].itemName.equals(name, ignoreCase = true)) {
                foundIndex = i
                break
            }
        }
        if (foundIndex == -1) {
            throw IOException("Inventory item \"$name\" not found.")
        }
        val rowNum = foundIndex + 2
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values:batchUpdate"
        val body = JSONObject().apply {
            put("valueInputOption", "USER_ENTERED")
            put("data", JSONArray().apply {
                put(JSONObject().apply {
                    put("range", "$TAB_INVENTORY!B$rowNum")
                    put("values", JSONArray().apply { put(JSONArray().apply { put(newQuantity) }) })
                })
                put(JSONObject().apply {
                    put("range", "$TAB_INVENTORY!F$rowNum")
                    put("values", JSONArray().apply { put(JSONArray().apply { put(Instant.now().toString()) }) })
                })
            })
        }
        makePostRequest(url, body.toString())
        true
    }

    suspend fun deleteInventoryItem(name: String): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        val rows = getInventoryData()
        var foundIndex = -1
        for (i in rows.indices) {
            if (rows[i].itemName.equals(name, ignoreCase = true)) {
                foundIndex = i
                break
            }
        }
        if (foundIndex == -1) {
            return@withContext false
        }

        val sheetIndex = foundIndex + 1 // +1 for header offset in sheet index
        val sheetId = getSheetIdByName(TAB_INVENTORY) ?: throw IOException("Sheet $TAB_INVENTORY not found.")

        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id:batchUpdate"
        val body = JSONObject().apply {
            put("requests", JSONArray().apply {
                put(JSONObject().apply {
                    put("deleteDimension", JSONObject().apply {
                        put("range", JSONObject().apply {
                            put("sheetId", sheetId)
                            put("dimension", "ROWS")
                            put("startIndex", sheetIndex)
                            put("endIndex", sheetIndex + 1)
                        })
                    })
                })
            })
        }
        makePostRequest(url, body.toString())
        true
    }

    // Row deletion by timestamp
    suspend fun deleteRowByTimestamp(tabName: String, timestamp: String): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$tabName!A:H"
        val response = makeGetRequest(url)
        val json = JSONObject(response)
        val values = json.optJSONArray("values") ?: return@withContext false
        
        var foundIndex = -1
        for (i in 1 until values.length()) { // skip header
            val row = values.getJSONArray(i)
            var hasTimestamp = false
            for (j in 0 until row.length()) {
                if (row.getString(j) == timestamp) {
                    hasTimestamp = true
                    break
                }
            }
            if (hasTimestamp) {
                foundIndex = i
                break
            }
        }

        if (foundIndex == -1) {
            Log.w(TAG, "Row with timestamp $timestamp not found in $tabName")
            return@withContext false
        }

        val sheetId = getSheetIdByName(tabName) ?: throw IOException("Sheet $tabName not found.")
        val deleteUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id:batchUpdate"
        val body = JSONObject().apply {
            put("requests", JSONArray().apply {
                put(JSONObject().apply {
                    put("deleteDimension", JSONObject().apply {
                        put("range", JSONObject().apply {
                            put("sheetId", sheetId)
                            put("dimension", "ROWS")
                            put("startIndex", foundIndex)
                            put("endIndex", foundIndex + 1)
                        })
                    })
                })
            })
        }
        makePostRequest(deleteUrl, body.toString())
        true
    }

    // Settings CRUD
    suspend fun getTargetProfit(): Double = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext DEFAULT_TARGET_PROFIT
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_SETTINGS!B2"
        try {
            val response = makeGetRequest(url)
            val json = JSONObject(response)
            val values = json.optJSONArray("values")
            if (values != null && values.length() > 0 && values.getJSONArray(0).length() > 0) {
                return@withContext values.getJSONArray(0).getString(0).toDoubleOrNull() ?: DEFAULT_TARGET_PROFIT
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching target profit", e)
        }
        DEFAULT_TARGET_PROFIT
    }

    suspend fun setTargetProfit(amount: Double): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_SETTINGS!B2?valueInputOption=RAW"
        val body = JSONObject().apply {
            put("values", JSONArray().apply { put(JSONArray().apply { put(amount) }) })
        }
        makePutRequest(url, body.toString())
        true
    }

    // Auto-repair shifted columns
    suspend fun repairColumnAlignments(): Boolean = withContext(Dispatchers.IO) {
        val id = spreadsheetId ?: return@withContext false
        Log.i(TAG, "Running auto-repair check for column alignments...")

        // 1. Repair Expenses (A2:P)
        try {
            val expUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_EXPENSES!A2:P"
            val response = makeGetRequest(expUrl)
            val json = JSONObject(response)
            val values = json.optJSONArray("values") ?: JSONArray()
            val updates = JSONArray()
            
            for (i in 0 until values.length()) {
                val row = values.getJSONArray(i)
                val rowNum = i + 2
                
                // Shifted row check: columns 0 to 6 are empty, but column 7 has data
                var isEmptyBeforeH = true
                val checkLimit = minOf(row.length(), 7)
                for (c in 0 until checkLimit) {
                    if (row.optString(c, "").trim().isNotEmpty()) {
                        isEmptyBeforeH = false
                        break
                    }
                }
                
                val hasDataInH = row.length() > 7 && row.optString(7, "").trim().isNotEmpty()
                
                if (hasDataInH && isEmptyBeforeH) {
                    val shiftedData = JSONArray()
                    for (c in 7 until row.length()) {
                        shiftedData.put(row.get(c))
                    }
                    // pad to 8 columns
                    while (shiftedData.length() < 8) {
                        shiftedData.put("")
                    }
                    
                    Log.i(TAG, "Repairing shifted Expense row $rowNum")
                    updates.put(JSONObject().apply {
                        put("range", "$TAB_EXPENSES!A$rowNum:H$rowNum")
                        put("values", JSONArray().apply { put(shiftedData) })
                    })
                    
                    // Clear the shifted columns (H onwards)
                    val clearLength = row.length() - 8
                    if (clearLength > 0) {
                        val emptyRow = JSONArray()
                        for (c in 0 until clearLength) emptyRow.put("")
                        val endLetter = ('I'.code + clearLength - 1).toChar()
                        updates.put(JSONObject().apply {
                            put("range", "$TAB_EXPENSES!I$rowNum:${endLetter}$rowNum")
                            put("values", JSONArray().apply { put(emptyRow) })
                        })
                    }
                }
            }
            
            if (updates.length() > 0) {
                val batchUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values:batchUpdate"
                val body = JSONObject().apply {
                    put("valueInputOption", "USER_ENTERED")
                    put("data", updates)
                }
                makePostRequest(batchUrl, body.toString())
                Log.i(TAG, "Expenses column repair complete.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Expenses repair failed", e)
        }

        // 2. Repair Daily_Sales (A2:L)
        try {
            val salesUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_SALES!A2:L"
            val response = makeGetRequest(salesUrl)
            val json = JSONObject(response)
            val values = json.optJSONArray("values") ?: JSONArray()
            val updates = JSONArray()
            
            for (i in 0 until values.length()) {
                val row = values.getJSONArray(i)
                val rowNum = i + 2
                
                var isEmptyBeforeF = true
                val checkLimit = minOf(row.length(), 5)
                for (c in 0 until checkLimit) {
                    if (row.optString(c, "").trim().isNotEmpty()) {
                        isEmptyBeforeF = false
                        break
                    }
                }
                
                val hasDataInF = row.length() > 5 && row.optString(5, "").trim().isNotEmpty()
                
                if (hasDataInF && isEmptyBeforeF) {
                    val shiftedData = JSONArray()
                    for (c in 5 until row.length()) {
                        shiftedData.put(row.get(c))
                    }
                    while (shiftedData.length() < 6) {
                        shiftedData.put("")
                    }
                    Log.i(TAG, "Repairing shifted Sales row $rowNum")
                    updates.put(JSONObject().apply {
                        put("range", "$TAB_SALES!A$rowNum:F$rowNum")
                        put("values", JSONArray().apply { put(shiftedData) })
                    })
                    
                    val clearLength = row.length() - 6
                    if (clearLength > 0) {
                        val emptyRow = JSONArray()
                        for (c in 0 until clearLength) emptyRow.put("")
                        val endLetter = ('G'.code + clearLength - 1).toChar()
                        updates.put(JSONObject().apply {
                            put("range", "$TAB_SALES!G$rowNum:${endLetter}$rowNum")
                            put("values", JSONArray().apply { put(emptyRow) })
                        })
                    }
                }
            }

            if (updates.length() > 0) {
                val batchUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values:batchUpdate"
                val body = JSONObject().apply {
                    put("valueInputOption", "USER_ENTERED")
                    put("data", updates)
                }
                makePostRequest(batchUrl, body.toString())
                Log.i(TAG, "Daily_Sales column repair complete.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Daily_Sales repair failed", e)
        }

        // 3. Repair Inventory (A2:L)
        try {
            val invUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values/$TAB_INVENTORY!A2:L"
            val response = makeGetRequest(invUrl)
            val json = JSONObject(response)
            val values = json.optJSONArray("values") ?: JSONArray()
            val updates = JSONArray()
            
            for (i in 0 until values.length()) {
                val row = values.getJSONArray(i)
                val rowNum = i + 2
                
                var isEmptyBeforeF = true
                val checkLimit = minOf(row.length(), 5)
                for (c in 0 until checkLimit) {
                    if (row.optString(c, "").trim().isNotEmpty()) {
                        isEmptyBeforeF = false
                        break
                    }
                }
                
                val hasDataInF = row.length() > 5 && row.optString(5, "").trim().isNotEmpty()
                
                if (hasDataInF && isEmptyBeforeF) {
                    val shiftedData = JSONArray()
                    for (c in 5 until row.length()) {
                        shiftedData.put(row.get(c))
                    }
                    while (shiftedData.length() < 6) {
                        shiftedData.put("")
                    }
                    Log.i(TAG, "Repairing shifted Inventory row $rowNum")
                    updates.put(JSONObject().apply {
                        put("range", "$TAB_INVENTORY!A$rowNum:F$rowNum")
                        put("values", JSONArray().apply { put(shiftedData) })
                    })
                    
                    val clearLength = row.length() - 6
                    if (clearLength > 0) {
                        val emptyRow = JSONArray()
                        for (c in 0 until clearLength) emptyRow.put("")
                        val endLetter = ('G'.code + clearLength - 1).toChar()
                        updates.put(JSONObject().apply {
                            put("range", "$TAB_INVENTORY!G$rowNum:${endLetter}$rowNum")
                            put("values", JSONArray().apply { put(emptyRow) })
                        })
                    }
                }
            }

            if (updates.length() > 0) {
                val batchUrl = "https://sheets.googleapis.com/v4/spreadsheets/$id/values:batchUpdate"
                val body = JSONObject().apply {
                    put("valueInputOption", "USER_ENTERED")
                    put("data", updates)
                }
                makePostRequest(batchUrl, body.toString())
                Log.i(TAG, "Inventory column repair complete.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Inventory repair failed", e)
        }

        true
    }

    private suspend fun getSheetIdByName(tabName: String): Int? {
        val id = spreadsheetId ?: return null
        val url = "https://sheets.googleapis.com/v4/spreadsheets/$id?fields=sheets.properties"
        val response = makeGetRequest(url)
        val json = JSONObject(response)
        val sheets = json.optJSONArray("sheets") ?: return null
        for (i in 0 until sheets.length()) {
            val prop = sheets.getJSONObject(i).getJSONObject("properties")
            if (prop.getString("title") == tabName) {
                return prop.getInt("sheetId")
            }
        }
        return null
    }
}
