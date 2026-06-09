package com.example.ayamgorengledger.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ayamgorengledger.data.models.DailySales
import com.example.ayamgorengledger.data.models.Expense
import com.example.ayamgorengledger.ui.main.MainScreenViewModel
import java.util.Calendar
import java.util.Locale

@Composable
fun DashboardScreen(
    viewModel: MainScreenViewModel,
    modifier: Modifier = Modifier
) {
    val salesList by viewModel.sales.collectAsState()
    val expensesList by viewModel.expenses.collectAsState()
    val targetProfit by viewModel.targetProfit.collectAsState()
    val selectedYear by viewModel.selectedYear.collectAsState()
    val selectedMonth by viewModel.selectedMonth.collectAsState()

    // Filter sales and expenses for the selected month
    val monthlySales = remember(salesList, selectedYear, selectedMonth) {
        salesList.filter {
            it.date.startsWith(String.format(Locale.US, "%04d-%02d", selectedYear, selectedMonth))
        }
    }

    val monthlyExpenses = remember(expensesList, selectedYear, selectedMonth) {
        expensesList.filter {
            it.date.startsWith(String.format(Locale.US, "%04d-%02d", selectedYear, selectedMonth))
        }
    }

    // Totals
    val totalCashSales = monthlySales.sumOf { it.cash }
    val totalQrSales = monthlySales.sumOf { it.qr }
    val totalSales = totalCashSales + totalQrSales
    val totalExpenses = monthlyExpenses.sumOf { it.amount }
    val netProfit = totalSales - totalExpenses

    val monthName = remember(selectedMonth) {
        val cal = Calendar.getInstance().apply { set(Calendar.MONTH, selectedMonth - 1) }
        cal.getDisplayName(Calendar.MONTH, Calendar.LONG, Locale.US) ?: ""
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Month Selector Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                if (selectedMonth == 1) {
                    viewModel.selectedMonth.value = 12
                    viewModel.selectedYear.value = selectedYear - 1
                } else {
                    viewModel.selectedMonth.value = selectedMonth - 1
                }
            }) {
                Text("◀", color = Color.White, fontSize = 20.sp)
            }

            Text(
                text = "$monthName $selectedYear",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )

            IconButton(onClick = {
                if (selectedMonth == 12) {
                    viewModel.selectedMonth.value = 1
                    viewModel.selectedYear.value = selectedYear + 1
                } else {
                    viewModel.selectedMonth.value = selectedMonth + 1
                }
            }) {
                Text("▶", color = Color.White, fontSize = 20.sp)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (monthlySales.isEmpty() && monthlyExpenses.isEmpty()) {
            // Empty State
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 32.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No entries recorded for this month.",
                        color = Color(0xFF94A3B8),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            // Summary Cards Grid
            Row(modifier = Modifier.fillMaxWidth()) {
                // Sales Summary Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 6.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("TOTAL SALES", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(String.format(Locale.US, "RM %.2f", totalSales), color = Color(0xFF0D9488), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = String.format(Locale.US, "Cash: %.0f | QR: %.0f", totalCashSales, totalQrSales),
                            color = Color(0xFF64748B),
                            fontSize = 8.sp
                        )
                    }
                }

                // Expenses Summary Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 6.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("TOTAL EXPENSES", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(String.format(Locale.US, "RM %.2f", totalExpenses), color = Color(0xFFF43F5E), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "From category logs",
                            color = Color(0xFF64748B),
                            fontSize = 8.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Net Profit Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("NET PROFIT", color = Color(0xFF94A3B8), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = String.format(Locale.US, "RM %.2f", netProfit),
                                color = if (netProfit >= 0) Color(0xFF0D9488) else Color(0xFFF43F5E),
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        
                        val marginPct = if (totalSales > 0) (netProfit / totalSales) * 100 else 0.0
                        Text(
                            text = String.format(Locale.US, "Margin: %.1f%%", marginPct),
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Target Progress Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "MONTHLY TARGET PROGRESS",
                        color = Color(0xFF94A3B8),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    val progress = if (targetProfit > 0) (netProfit / targetProfit).toFloat().coerceIn(0f, 2f) else 0f
                    val progressPercent = (progress * 100).toInt()

                    LinearProgressIndicator(
                        progress = { progress.coerceAtMost(1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp),
                        color = Color(0xFF0D9488),
                        trackColor = Color(0xFF334155),
                        strokeCap = StrokeCap.Round
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = String.format(Locale.US, "%d%% Achieved", progressPercent),
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = String.format(Locale.US, "Target: RM %.0f", targetProfit),
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Canvas Chart Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "DAILY TRANSACTIONS TREND",
                        color = Color(0xFF94A3B8),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    DailyTrendChart(sales = monthlySales, expenses = monthlyExpenses)
                }
            }
        }
    }
}

@Composable
fun DailyTrendChart(
    sales: List<DailySales>,
    expenses: List<Expense>,
    modifier: Modifier = Modifier
) {
    // Group totals by day of month (1..31)
    val maxDays = 31
    val dailyRevenue = FloatArray(maxDays) { 0f }
    val dailyCosts = FloatArray(maxDays) { 0f }

    for (s in sales) {
        val day = s.date.substringAfterLast("-").toIntOrNull() ?: 1
        if (day in 1..maxDays) {
            dailyRevenue[day - 1] += s.total.toFloat()
        }
    }

    for (e in expenses) {
        val day = e.date.substringAfterLast("-").toIntOrNull() ?: 1
        if (day in 1..maxDays) {
            dailyCosts[day - 1] += e.amount.toFloat()
        }
    }

    val maxVal = maxOf(dailyRevenue.maxOrNull() ?: 100f, dailyCosts.maxOrNull() ?: 100f, 100f)

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp)
            .background(Color(0xFF0F172A).copy(alpha = 0.5f))
    ) {
        val paddingLeft = 40.dp.toPx()
        val paddingRight = 10.dp.toPx()
        val paddingTop = 10.dp.toPx()
        val paddingBottom = 20.dp.toPx()
        
        val width = size.width - paddingLeft - paddingRight
        val height = size.height - paddingTop - paddingBottom
        val stepX = width / (maxDays - 1)

        // Draw horizontal grid lines
        val gridLines = 4
        for (g in 0..gridLines) {
            val ratio = g.toFloat() / gridLines
            val y = paddingTop + height * (1f - ratio)
            
            // Grid line
            drawLine(
                color = Color(0xFF334155).copy(alpha = 0.5f),
                start = Offset(paddingLeft, y),
                end = Offset(paddingLeft + width, y),
                strokeWidth = 1.dp.toPx()
            )
        }

        // Draw Sales Path (Teal)
        val salesPath = Path()
        var hasSalesData = false
        for (d in 0 until maxDays) {
            val valX = paddingLeft + d * stepX
            val valY = paddingTop + height - (dailyRevenue[d] / maxVal) * height
            
            if (d == 0) {
                salesPath.moveTo(valX, valY)
            } else {
                salesPath.lineTo(valX, valY)
            }
            if (dailyRevenue[d] > 0f) hasSalesData = true
        }

        if (hasSalesData) {
            drawPath(
                path = salesPath,
                color = Color(0xFF0D9488),
                style = Stroke(width = 2.dp.toPx())
            )
        }

        // Draw Expenses Path (Rose)
        val expensesPath = Path()
        var hasExpensesData = false
        for (d in 0 until maxDays) {
            val valX = paddingLeft + d * stepX
            val valY = paddingTop + height - (dailyCosts[d] / maxVal) * height
            
            if (d == 0) {
                expensesPath.moveTo(valX, valY)
            } else {
                expensesPath.lineTo(valX, valY)
            }
            if (dailyCosts[d] > 0f) hasExpensesData = true
        }

        if (hasExpensesData) {
            drawPath(
                path = expensesPath,
                color = Color(0xFFF43F5E),
                style = Stroke(width = 2.dp.toPx())
            )
        }

        // Draw axis details (0 and Max value labels, and basic timeline indicators)
        drawLine(
            color = Color(0xFF475569),
            start = Offset(paddingLeft, paddingTop + height),
            end = Offset(paddingLeft + width, paddingTop + height),
            strokeWidth = 1.dp.toPx()
        )
    }
    
    // Label legends
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.size(10.dp).background(Color(0xFF0D9488), RoundedCornerShape(2.dp)))
        Spacer(modifier = Modifier.width(4.dp))
        Text("Sales (Teal)", color = Color(0xFF94A3B8), fontSize = 11.sp)
        
        Spacer(modifier = Modifier.width(24.dp))
        
        Box(modifier = Modifier.size(10.dp).background(Color(0xFFF43F5E), RoundedCornerShape(2.dp)))
        Spacer(modifier = Modifier.width(4.dp))
        Text("Expenses (Rose)", color = Color(0xFF94A3B8), fontSize = 11.sp)
    }
}
