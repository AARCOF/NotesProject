package com.noteyou.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews
import org.json.JSONObject

class ExpensesWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if ("com.noteyou.app.action.REFRESH_EXPENSES_WIDGET".equals(intent.action) || 
            Intent.ACTION_BOOT_COMPLETED.equals(intent.action)) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(
                android.content.ComponentName(context, ExpensesWidgetProvider::class.java)
            )
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }
    }

    companion object {
        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_expenses)

            // Read variables from SharedPreferences
            try {
                val prefs: SharedPreferences = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                val jsonStr = prefs.getString("widget_expenses_json", "{}") ?: "{}"
                val data = JSONObject(jsonStr)

                val balance = data.optString("balance", "S/. 0.00")
                val income = data.optString("income", "S/. 0.00")
                val expenses = data.optString("expenses", "S/. 0.00")

                views.setTextViewText(R.id.widget_expenses_balance, balance)
                views.setTextViewText(R.id.widget_expenses_income, income)
                views.setTextViewText(R.id.widget_expenses_expenses, expenses)

            } catch (e: Exception) {
                e.printStackTrace()
                views.setTextViewText(R.id.widget_expenses_balance, "S/. 0.00")
                views.setTextViewText(R.id.widget_expenses_income, "S/. 0.00")
                views.setTextViewText(R.id.widget_expenses_expenses, "S/. 0.00")
            }

            // Click action to open MainActivity
            val openIntent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 1, openIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_expenses_balance, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
