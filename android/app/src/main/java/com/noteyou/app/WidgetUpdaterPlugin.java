package com.noteyou.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetUpdater")
public class WidgetUpdaterPlugin extends Plugin {

    @PluginMethod
    public void refreshWidgets(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.resolve();
            return;
        }

        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);

            // 1. Refresh Tasks Widget in Real Time
            ComponentName tasksWidget = new ComponentName(context, TasksWidgetProvider.class);
            int[] tasksIds = appWidgetManager.getAppWidgetIds(tasksWidget);
            if (tasksIds != null && tasksIds.length > 0) {
                Intent tasksIntent = new Intent(context, TasksWidgetProvider.class);
                tasksIntent.setAction("com.noteyou.app.action.REFRESH_WIDGET");
                tasksIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, tasksIds);
                context.sendBroadcast(tasksIntent);

                appWidgetManager.notifyAppWidgetViewDataChanged(tasksIds, R.id.widget_tasks_list);
                for (int id : tasksIds) {
                    TasksWidgetProvider.Companion.updateAppWidget(context, appWidgetManager, id);
                }
            }

            // 2. Refresh Expenses Widget in Real Time
            ComponentName expensesWidget = new ComponentName(context, ExpensesWidgetProvider.class);
            int[] expensesIds = appWidgetManager.getAppWidgetIds(expensesWidget);
            if (expensesIds != null && expensesIds.length > 0) {
                Intent expensesIntent = new Intent(context, ExpensesWidgetProvider.class);
                expensesIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                expensesIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, expensesIds);
                context.sendBroadcast(expensesIntent);

                for (int id : expensesIds) {
                    ExpensesWidgetProvider.Companion.updateAppWidget(context, appWidgetManager, id);
                }
            }

            call.resolve();
        } catch (Exception e) {
            e.printStackTrace();
            call.resolve();
        }
    }
}
