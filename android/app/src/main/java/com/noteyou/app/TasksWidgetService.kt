package com.noteyou.app

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONArray
import org.json.JSONObject

class TasksWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return TasksWidgetFactory(this.applicationContext)
    }
}

class TasksWidgetFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
    private var tasksList: List<JSONObject> = ArrayList()

    override fun onCreate() {
        loadData()
    }

    override fun onDataSetChanged() {
        loadData()
    }

    override fun onDestroy() {
        tasksList = ArrayList()
    }

    override fun getCount(): Int {
        return tasksList.size
    }

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_tasks_item)
        if (position >= tasksList.size) return views

        try {
            val task = tasksList[position]
            val title = task.optString("title", "Sin título")
            val priority = task.optString("priority", "baja").lowercase()

            views.setTextViewText(R.id.widget_item_title, title)

            // Select priority circle drawable
            val indicatorRes = when (priority) {
                "alta" -> R.drawable.widget_priority_circle_high
                "media" -> R.drawable.widget_priority_circle_medium
                else -> R.drawable.widget_priority_circle_low
            }
            views.setInt(R.id.widget_item_priority_indicator, "setBackgroundResource", indicatorRes)

            // Fill-in intent for click (opens the main app)
            val fillInIntent = Intent()
            views.setOnClickFillInIntent(R.id.widget_item_title, fillInIntent)

        } catch (e: Exception) {
            e.printStackTrace()
        }

        return views
    }

    override fun getLoadingView(): RemoteViews? {
        return null
    }

    override fun getViewTypeCount(): Int {
        return 1
    }

    override fun getItemId(position: Int): Long {
        return position.toLong()
    }

    override fun hasStableIds(): Boolean {
        return true
    }

    private fun loadData() {
        try {
            val prefs: SharedPreferences = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            // Capacitor Preferences writes keys directly without prefix on native Android SharedPreferences
            val tasksJsonStr = prefs.getString("widget_tasks_json", "[]") ?: "[]"
            
            val tempArray = JSONArray(tasksJsonStr)
            val temp = ArrayList<JSONObject>()
            for (i in 0 until tempArray.length()) {
                temp.add(tempArray.getJSONObject(i))
            }
            tasksList = temp
        } catch (e: Exception) {
            e.printStackTrace()
            tasksList = ArrayList()
        }
    }
}
