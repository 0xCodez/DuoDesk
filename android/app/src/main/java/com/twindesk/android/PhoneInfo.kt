// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// What the Mac shows about the phone (its sidebar tile and Phone page): model, Android version,
// battery, the screen, the wallpaper's colours and, when Android lets us read it, a small copy
// of the wallpaper itself. The phone's apps for the Mac's app windows (phone.apps), and the state
// of wireless debugging, which the Mac's screen, input and app windows go through (adb.state).
package com.twindesk.android

import android.Manifest
import android.app.WallpaperManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.hardware.display.DisplayManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Base64
import android.view.Display
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.Inet4Address
import java.net.NetworkInterface

class PhoneInfo(core: Core) : Feature(core) {
    private var battery: Int? = null
    private var charging = false
    private var wallpaper: String? = null // data URL, made once per wallpaper change
    private var lastSent = ""

    init {
        core.ctx.registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
                val b = if (level >= 0 && scale > 0) level * 100 / scale else null
                val ch = i.getIntExtra(BatteryManager.EXTRA_STATUS, -1).let { it == BatteryManager.BATTERY_STATUS_CHARGING || it == BatteryManager.BATTERY_STATUS_FULL }
                if (b != battery || ch != charging) {
                    battery = b
                    charging = ch
                    sendInfo(false)
                }
            }
        }, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        @Suppress("DEPRECATION")
        core.ctx.registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                wallpaper = null
                sendInfo(true)
            }
        }, IntentFilter(Intent.ACTION_WALLPAPER_CHANGED))
        core.ctx.getSystemService(DisplayManager::class.java).registerDisplayListener(object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(id: Int) {}
            override fun onDisplayRemoved(id: Int) {}
            override fun onDisplayChanged(id: Int) { if (id == Display.DEFAULT_DISPLAY) sendInfo(false) }
        }, Handler(Looper.getMainLooper()))
    }

    override fun onWelcome(host: Host) {
        lastSent = ""
        // The Mac takes a peer that never says otherwise for an older viewer of its screen (and
        // starts sharing): say at once that the phone isn't watching its screen (MacSound tells
        // whether it plays the Mac's sound).
        if (!core.screen.viewing) core.send(msg("screen.policy", "accept" to false))
        sendInfo(true)
    }

    fun display(): JSONObject? {
        val d = core.ctx.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY) ?: return null
        val mode = d.mode
        val rot = d.rotation
        val (w, h) = if (rot % 2 == 0) mode.physicalWidth to mode.physicalHeight else mode.physicalHeight to mode.physicalWidth
        return JSONObject().put("w", w).put("h", h).put("rot", rot).put("dpi", core.ctx.resources.displayMetrics.densityDpi)
    }

    private fun colors(): List<String> {
        val wc = runCatching { WallpaperManager.getInstance(core.ctx).getWallpaperColors(WallpaperManager.FLAG_SYSTEM) }.getOrNull() ?: return emptyList()
        return listOfNotNull(wc.primaryColor, wc.secondaryColor, wc.tertiaryColor).map { "#%06x".format(it.toArgb() and 0xffffff) }
    }

    // The wallpaper image needs storage access on most Android versions; without it the Mac uses the colours.
    private fun wallpaperImage(): String? {
        wallpaper?.let { return it }
        val allowed = Build.VERSION.SDK_INT >= 30 && android.os.Environment.isExternalStorageManager() ||
            core.ctx.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        if (!allowed) return null
        return runCatching {
            @Suppress("MissingPermission")
            val dr: Drawable = WallpaperManager.getInstance(core.ctx).drawable ?: return null
            val src = (dr as? BitmapDrawable)?.bitmap ?: Bitmap.createBitmap(dr.intrinsicWidth.coerceAtLeast(1), dr.intrinsicHeight.coerceAtLeast(1), Bitmap.Config.ARGB_8888).also {
                val c = Canvas(it); dr.setBounds(0, 0, c.width, c.height); dr.draw(c)
            }
            val h = 360
            val w = (src.width * h / src.height.coerceAtLeast(1)).coerceIn(1, 1000)
            val small = Bitmap.createScaledBitmap(src, w, h, true)
            val out = ByteArrayOutputStream()
            small.compress(Bitmap.CompressFormat.JPEG, 72, out)
            "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        }.getOrNull()?.also { wallpaper = it }
    }

    fun sendInfo(withWallpaper: Boolean) {
        if (!core.link.connected) return
        core.bg.execute {
            val m = msg(
                Proto.T.PHONE_INFO, "model" to Build.MODEL, "maker" to Build.MANUFACTURER.replaceFirstChar { it.uppercase() },
                "release" to Build.VERSION.RELEASE, "sdk" to Build.VERSION.SDK_INT, "battery" to battery, "charging" to charging,
                "colors" to jsonArray(colors()), "display" to display(),
            )
            val key = m.toString()
            if (withWallpaper) wallpaperImage()?.let { m.put("wallpaper", it) }
            if (!withWallpaper && key == lastSent) return@execute
            lastSent = key
            core.send(m)
        }
    }
}

class Apps(core: Core) : Feature(core) {
    override fun onMessage(t: String, m: JSONObject): Boolean {
        if (t != Proto.T.PHONE_APPS_LIST) return false
        core.bg.execute { core.send(msg(Proto.T.PHONE_APPS, "apps" to jsonArray(list()))) }
        return true
    }

    private fun list(): List<JSONObject> {
        val pm = core.ctx.packageManager
        val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val seen = mutableSetOf<String>()
        return pm.queryIntentActivities(main, 0).mapNotNull { ri ->
            val pkg = ri.activityInfo.packageName
            if (pkg == core.ctx.packageName || !seen.add(pkg)) return@mapNotNull null
            JSONObject().put("id", pkg).put("name", ri.loadLabel(pm).toString().take(100)).put("icon", icon(ri.loadIcon(pm)))
        }
    }

    private fun icon(d: Drawable): String = runCatching {
        val size = 96
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        d.setBounds(0, 0, size, size)
        d.draw(c)
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }.getOrDefault("")
}

// Wireless debugging: the Mac pairs with it once (the code from Developer options), then grants
// this app WRITE_SECURE_SETTINGS over adb, so after that we can switch it on by ourselves when
// the Mac asks (adb.enable) — after a reboot or on a new network — without anyone opening Settings.
class Adb(core: Core) : Feature(core) {
    private val cr get() = core.ctx.contentResolver
    private val main = Handler(Looper.getMainLooper())

    // Connected, and wireless debugging is off even after we tried to switch it on: the app asks
    // the person to turn it on (MIUI and HyperOS switch it off on every Wi-Fi change, screen lock or
    // reboot, and may refuse to let us switch it back).
    @Volatile var off = false; private set

    init {
        val obs = object : ContentObserver(main) {
            override fun onChange(selfChange: Boolean) {
                sendState()
                check()
            }
        }
        cr.registerContentObserver(Settings.Global.getUriFor("adb_wifi_enabled"), false, obs)
        cr.registerContentObserver(Settings.Global.getUriFor(Settings.Global.DEVELOPMENT_SETTINGS_ENABLED), false, obs)
    }

    val devOptions get() = Settings.Global.getInt(cr, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1
    val wifiDebugging get() = Settings.Global.getInt(cr, "adb_wifi_enabled", 0) == 1
    val canEnable get() = core.ctx.checkSelfPermission("android.permission.WRITE_SECURE_SETTINGS") == PackageManager.PERMISSION_GRANTED

    fun address(): String = runCatching {
        NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback && (it.name.startsWith("wlan") || it.name.startsWith("eth")) }
            .flatMap { it.inetAddresses.toList() }.firstOrNull { it is Inet4Address }?.hostAddress
    }.getOrNull() ?: ""

    fun sendState() {
        core.send(msg(Proto.T.ADB_STATE, "devOptions" to devOptions, "wifi" to wifiDebugging, "canEnable" to canEnable, "address" to address()))
        core.changed()
    }

    // Settings › Developer options with Wireless debugging highlighted (when we may not switch it ourselves).
    fun openSettings() {
        val i = android.content.Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
            .putExtra(":settings:fragment_args_key", "toggle_adb_wireless")
            .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { core.ctx.startActivity(i) }
    }

    // One tap: switch it on here if allowed, else open the setting.
    fun turnOn() {
        if (!enable(true)) openSettings()
        sendState()
    }

    fun enable(on: Boolean): Boolean {
        if (!canEnable) return false
        return runCatching {
            if (on) Settings.Global.putInt(cr, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 1)
            Settings.Global.putInt(cr, "adb_wifi_enabled", if (on) 1 else 0)
        }.isSuccess
    }

    // Is wireless debugging on while we're connected? If not: switch it on if we may, and if it is
    // still off a moment later, ask (the app's dialog and a notification, both open the setting).
    fun check() {
        main.removeCallbacksAndMessages(null)
        if (!core.link.connected || wifiDebugging) return settle(false)
        if (canEnable) enable(true)
        main.postDelayed({
            if (core.link.connected && !wifiDebugging) settle(true) else settle(false)
        }, 2000)
    }

    private fun settle(isOff: Boolean) {
        if (isOff == off) return
        off = isOff
        if (isOff) Notify.adbOff(core.ctx, core.host?.name ?: "your computer") else Notify.cancelAdbOff(core.ctx)
        core.changed()
    }

    override fun onWelcome(host: Host) {
        // Wireless debugging only works on Wi-Fi; switch it on for the Mac if we may, else ask.
        sendState()
        main.post { check() }
    }

    override fun onClosed() {
        main.post { check() }
    }

    override fun onMessage(t: String, m: JSONObject): Boolean {
        if (t != Proto.T.ADB_ENABLE) return false
        enable(m.optBoolean("on", true))
        sendState()
        return true
    }
}
