package com.twindesk.android

import android.app.Activity
import android.app.LocaleManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import java.util.Locale

// The app's language: "" follows the phone, otherwise a tag from `tags`. Android 13+ keeps it in the
// system (also shown in Settings › Apps › Language); older versions read it here in attachBaseContext.
object Lang {
    val tags = listOf("", "pt-BR", "en")
    private const val KEY = "lang"
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("twindesk", Context.MODE_PRIVATE)

    fun current(ctx: Context): String =
        if (Build.VERSION.SDK_INT >= 33) {
            val l = ctx.getSystemService(LocaleManager::class.java).applicationLocales
            if (l.isEmpty) "" else l[0].toLanguageTag().let { t -> tags.firstOrNull { it.isNotEmpty() && t.startsWith(it.substringBefore('-')) } ?: "" }
        } else prefs(ctx).getString(KEY, "") ?: ""

    fun wrap(ctx: Context): Context {
        if (Build.VERSION.SDK_INT >= 33) return ctx
        val tag = prefs(ctx).getString(KEY, "") ?: ""
        if (tag.isEmpty()) return ctx
        val loc = Locale.forLanguageTag(tag)
        Locale.setDefault(loc)
        val cfg = Configuration(ctx.resources.configuration).apply { setLocales(LocaleList(loc)) }
        return ctx.createConfigurationContext(cfg)
    }

    fun set(activity: Activity, tag: String) {
        if (Build.VERSION.SDK_INT >= 33) {
            // Recreates the activities by itself.
            activity.getSystemService(LocaleManager::class.java).applicationLocales = LocaleList.forLanguageTags(tag)
        } else {
            prefs(activity).edit().putString(KEY, tag).apply()
            activity.recreate()
        }
    }
}
