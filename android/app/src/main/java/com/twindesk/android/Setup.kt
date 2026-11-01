// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The setup screen (like the Mac's): shown on start while something TwinDesk needs isn't allowed
// yet, one row per permission with its own Allow button. "Skip for now" hides it until something
// else goes missing (the skipped set is remembered); General › Setup has the same rows.
package com.twindesk.android

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object SetupCheck {
    class Item(val id: String, val title: String, val hint: String, val icon: ImageVector, val colors: List<Color>, val required: Boolean, val done: Boolean)

    fun items(ctx: Context, core: Core): List<Item> {
        val pm = ctx.getSystemService(PowerManager::class.java)
        val c = { h: Color -> listOf(h, h) }
        val list = mutableListOf<Item>()
        if (Build.VERSION.SDK_INT >= 33) list += Item(
            "notify", ctx.getString(R.string.nav_notifications), ctx.getString(R.string.setup_files_arriving_copies_from),
            Ico.bell, c(Hue.violet), true,
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED,
        )
        if (core.notifs.supported) list += Item("listener", ctx.getString(R.string.notifs_notification_access), ctx.getString(R.string.setup_this_device_s_notifications), Ico.bell, c(Hue.violet), true, core.notifs.hasAccess)
        list += Item("battery", ctx.getString(R.string.gen_run_in_the_background), ctx.getString(R.string.setup_so_your_computer_can), Ico.general, c(Hue.grey), true, pm.isIgnoringBatteryOptimizations(ctx.packageName))
        list += Item("overlay", ctx.getString(R.string.gen_show_the_pointer), ctx.getString(R.string.setup_your_computer_s_pointer), Ico.cursor, c(Hue.violet), true, core.pointer.allowed)
        list += Item("adb", ctx.getString(R.string.sc_adb_short), ctx.getString(R.string.setup_this_screen_on_your), Ico.display, c(Hue.pink), false, core.adb.wifiDebugging)
        if (Build.VERSION.SDK_INT >= 30) list += Item("wallpaper", ctx.getString(R.string.setup_wallpaper_on_your_computer), ctx.getString(R.string.setup_optional_android_shares_the), Ico.files, c(Hue.green), false, android.os.Environment.isExternalStorageManager())
        return list
    }

    // What is missing now, as a key: the screen shows unless that exact set was skipped.
    fun missingKey(items: List<Item>) = items.filter { it.required && !it.done }.joinToString(",") { it.id }

    fun shouldShow(ctx: Context, core: Core): Boolean {
        val key = missingKey(items(ctx, core))
        return key.isNotEmpty() && key != core.store.prefsString("setup.skipped", "")
    }

    fun skip(ctx: Context, core: Core) {
        core.store.setPrefsString("setup.skipped", missingKey(items(ctx, core)))
        core.changed()
    }

    fun open(ctx: Context, core: Core, id: String, askNotify: () -> Unit) {
        val pkg = Uri.parse("package:${ctx.packageName}")
        when (id) {
            "notify" -> askNotify()
            "listener" -> ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            "battery" -> @Suppress("BatteryLife") ctx.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg))
            "overlay" -> ctx.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg))
            "adb" -> core.adb.turnOn()
            "wallpaper" -> ctx.startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, pkg))
        }
    }
}

@Composable
fun SetupScreen(core: Core, ctx: Context, v: Int, done: () -> Unit) {
    @Suppress("UNUSED_EXPRESSION") v
    val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { core.changed() }
    val items = SetupCheck.items(ctx, core)
    val ready = items.none { it.required && !it.done }
    Box(Modifier.fillMaxSize().background(pal.content).safeDrawingPadding(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.widthIn(max = 620.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Logo(84)
            Text(stringResource(R.string.setup_set_up_duodesk), fontSize = 28.sp, fontWeight = FontWeight.Light, letterSpacing = (-0.8).sp, color = pal.text, modifier = Modifier.padding(top = 12.dp))
            Text(
                stringResource(R.string.setup_allow_these_so_this),
                color = pal.muted, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp, bottom = 22.dp),
            )
            MacCard {
                items.forEachIndexed { i, it ->
                    Column {
                        if (i > 0) Box(Modifier.padding(start = 58.dp).fillMaxWidth().height(1.dp).background(pal.line))
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Tile(it.icon, it.colors, 30)
                            Column(Modifier.weight(1f).padding(start = 12.dp, end = 10.dp)) {
                                Text(if (it.required) it.title else stringResource(R.string.setup_optional, it.title), color = pal.text, fontSize = 15.sp)
                                Text(it.hint, color = pal.muted, fontSize = 12.5.sp)
                            }
                            if (it.done) Pill(stringResource(R.string.common_allowed), "good")
                            else PrimaryButton(if (it.id == "adb") stringResource(R.string.common_turn_on) else stringResource(R.string.common_allow)) {
                                SetupCheck.open(ctx, core, it.id) { askNotify.launch(Manifest.permission.POST_NOTIFICATIONS) }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            if (ready) PrimaryButton(stringResource(R.string.setup_continue), Modifier.fillMaxWidth()) { done() }
            else SecondaryButton(stringResource(R.string.setup_skip_for_now), Modifier.fillMaxWidth()) { SetupCheck.skip(ctx, core) }
            if (!ready) Text(stringResource(R.string.setup_duodesk_works_without_these), color = pal.muted, fontSize = 12.5.sp, modifier = Modifier.padding(top = 8.dp))
        }
    }
}
