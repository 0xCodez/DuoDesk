// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Notifications both ways: the phone's (read by NotifListener, which needs Notification access)
// go to the computer while it accepts them (`notif.policy`); the computer's show here as real
// notifications, one channel per computer app is overkill, so one "From the computer" channel.
package com.twindesk.android

import android.app.Notification
import android.content.ComponentName
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.provider.Settings
import android.util.Base64
import java.io.ByteArrayOutputStream
import android.service.notification.StatusBarNotification
import org.json.JSONObject

class Notifs(core: Core) : Feature(core) {
    @Volatile var peerAccepts = false; private set
    @Volatile var sent = 0; private set
    @Volatile var shown = 0; private set
    private val muted get() = core.store.prefsSet("notifs.muted")
    // App icons with notifications (shared/notificon.js): ours go with an app's first one in a
    // session; the computer's are kept by app (the computer sends each only once).
    private val iconsSent = HashSet<String>()
    private val iconsIn = object : LinkedHashMap<String, Bitmap>(16, 0.75f, true) {
        override fun removeEldestEntry(e: MutableMap.MutableEntry<String, Bitmap>?) = size > 100
    }

    // The standard build (what people download) has no notification listener: Play Protect blocks
    // sideloaded apps with one. The computer installs the full build over it (adb, not checked).
    val supported get() = BuildConfig.NOTIF_LISTENER

    val hasAccess: Boolean
        get() {
            if (!supported) return false
            val flat = Settings.Secure.getString(core.ctx.contentResolver, "enabled_notification_listeners") ?: return false
            val me = ComponentName(core.ctx, NotifListener::class.java).flattenToString()
            return flat.split(':').any { it == me }
        }

    fun sendPolicy() {
        core.send(msg(Proto.T.NOTIF_POLICY, "accept" to core.sync.get("notifs", "in")))
    }

    override fun onWelcome(host: Host) {
        peerAccepts = false
        sendPolicy()
    }

    override fun onClosed() {
        peerAccepts = false
        synchronized(iconsSent) { iconsSent.clear() }
    }

    // From NotifListener: a new notification on this phone.
    fun posted(sbn: StatusBarNotification) {
        if (!peerAccepts || !core.sync.get("notifs", "out") || !core.link.connected) return
        val n = sbn.notification ?: return
        if (sbn.packageName == core.ctx.packageName || sbn.isOngoing) return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return // the group's children come too
        if (n.category == Notification.CATEGORY_TRANSPORT || n.category == Notification.CATEGORY_PROGRESS || n.category == Notification.CATEGORY_SERVICE) return
        if (sbn.packageName in muted) return
        val x = n.extras
        val title = x.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = (x.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: x.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""
        if (title.isEmpty() && text.isEmpty()) return
        val pm = core.ctx.packageManager
        val appName = runCatching { pm.getApplicationLabel(pm.getApplicationInfo(sbn.packageName, 0)).toString() }.getOrDefault(sbn.packageName)
        val hide = core.store.flag("notifs.hideText", false)
        val icon = if (synchronized(iconsSent) { iconsSent.add(sbn.packageName) }) appIcon(sbn.packageName) else null
        core.send(
            msg(
                Proto.T.NOTIF, "id" to sbn.key.take(200), "app" to sbn.packageName, "appName" to appName,
                "title" to title.take(300), "subtitle" to (x.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: "").take(200),
                "body" to if (hide) "" else text.take(1000), "at" to sbn.postTime,
            ).apply { if (icon != null) put("icon", icon) },
        )
        sent++
        core.changed()
    }

    override fun onMessage(t: String, m: JSONObject): Boolean {
        when (t) {
            Proto.T.NOTIF_POLICY -> peerAccepts = m.optBoolean("accept")
            Proto.T.NOTIF -> {
                if (!core.sync.get("notifs", "in")) return true
                val app = m.str("appName", 80).ifEmpty { m.str("app", 80) }
                val title = m.str("title", 300)
                val body = listOf(m.str("subtitle", 200), m.str("body", 1000)).filter { it.isNotEmpty() }.joinToString("\n")
                Notify.fromComputer(core.ctx, m.str("id", 200), app, title, body, core.host?.name ?: "Computer", iconIn(m))
                shown++
            }
            else -> return false
        }
        core.changed()
        return true
    }

    // A 64 px PNG of the app's icon as a data: URL, or null.
    private fun appIcon(pkg: String): String? = runCatching {
        val d = core.ctx.packageManager.getApplicationIcon(pkg)
        val bmp = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        d.setBounds(0, 0, 64, 64)
        d.draw(Canvas(bmp))
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }.getOrNull()

    // The icon of a notification from the computer: the one it came with, else the app's last one.
    private fun iconIn(m: JSONObject): Bitmap? {
        val app = m.optString("app").take(300)
        val url = m.optString("icon")
        val head = "data:image/png;base64,"
        synchronized(iconsIn) {
            if (url.startsWith(head) && url.length <= 48000 && app.isNotEmpty()) {
                runCatching {
                    val b = Base64.decode(url.substring(head.length), Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(b, 0, b.size)
                }.getOrNull()?.let { iconsIn[app] = it }
            }
            return iconsIn[app]
        }
    }
}
