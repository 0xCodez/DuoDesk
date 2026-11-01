// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The app's window, laid out like TwinDesk on the Mac: a sidebar with the TwinDesk logo and the
// pages in the Mac's groups (Display, Input, Share, More, then General and About), each page a
// heading with its main switch over cards of rows. On a phone held upright the sidebar becomes
// tabs along the bottom (the rest under More). The building blocks are in Ui.kt.
package com.twindesk.android

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.mimeTypes
import androidx.compose.ui.draganddrop.toAndroidDragEvent
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    private var resumed = mutableStateOf(0)

    override fun attachBaseContext(base: android.content.Context) = super.attachBaseContext(Lang.wrap(base))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(SystemBarStyle.dark(android.graphics.Color.TRANSPARENT), SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)) // always dark: light icons
        TwinService.start(this)
        setContent { Theme { App(Core.get(this), resumed.value) } }
    }

    override fun onResume() {
        super.onResume()
        shown = true
        resumed.value++ // permissions may have changed in Settings
        Core.get(this).adb.check() // back from Settings: is wireless debugging on now?
        Core.get(this).hub.let { if (it.callsOn || it.messagesOn || it.mediaOn || it.filesOn) it.permsChanged() }
        Core.get(this).share.let { if (it.on && it.serving != it.allowed) it.core.bg.execute { it.sync() } } // All files access just allowed (or taken away)
    }

    override fun onPause() {
        super.onPause()
        shown = false
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // In front: Android lets us read the clipboard now.
        if (hasFocus) Core.get(this).let { if (it.sync.get("clipboard", "out")) it.clip.sendCurrent(false) }
    }

    companion object {
        @Volatile var shown = false // on screen: Android lets us open a prompt (Hub.ask)
    }
}

// The pages, each with its one Aurora hue (the tile's icon colour) and the Mac's groups.
private enum class Tab(val title: String, val titleRes: Int, val icon: ImageVector, val colors: List<Color>, val group: String) {
    // Overview: the computer itself, only while connected; Connection: pairing, Nearby, the link.
    Overview("Overview", R.string.nav_overview, Ico.overview, listOf(Hue.grey), ""),
    Connection("Connection", R.string.nav_connection, Ico.link, listOf(Hue.violet), ""),
    // On the computer, from this phone (Hub.kt): their settings here.
    Calls("Calls", R.string.nav_calls, Ico.call, listOf(Hue.green), "Phone"),
    Messages("Messages", R.string.nav_messages, Ico.message, listOf(Hue.green), "Phone"),
    Photos("Photos", R.string.nav_photos, Ico.photo, listOf(Hue.amber), "Phone"),
    FileAccess("File access", R.string.nav_file_access, Ico.folder, listOf(Hue.green), "Phone"),
    Screen("Screen", R.string.nav_screen, Ico.display, listOf(Hue.pink), "Display"),
    Cursor("Mouse", R.string.nav_cursor, Ico.cursor, listOf(Hue.violet), "Input"),
    Keyboard("Keyboard", R.string.nav_keyboard, Ico.keyboard, listOf(Hue.violet), "Input"),
    Remote("Remote", R.string.nav_remote, Ico.remote, listOf(Hue.violet), "Input"),
    Clipboard("Clipboard", R.string.nav_clipboard, Ico.clipboard, listOf(Hue.cyan), "Share"),
    Notifications("Notifications", R.string.nav_notifications, Ico.bell, listOf(Hue.violet), "Share"),
    Files("Files", R.string.nav_files, Ico.files, listOf(Hue.green), "Share"),
    Rezume("ReZume", R.string.nav_rezume, Ico.rezume, listOf(Hue.cyan), "Share"),
    Sound("Sound", R.string.nav_sound, Ico.audio, listOf(Hue.pink), "More"),
    Camera("Camera", R.string.nav_camera, Ico.camera, listOf(Hue.amber), "More"),
    General("General", R.string.nav_general, Ico.general, listOf(Hue.grey), "bottom"),
    About("About", R.string.nav_about, Ico.about, listOf(Hue.grey), "bottom"),
}

// The bottom bar: Overview first while connected, Connection second; before that Connection first.
private fun bottom(core: Core) = if (core.host != null) listOf(Tab.Overview, Tab.Connection, Tab.Screen, Tab.Files) else listOf(Tab.Connection, Tab.Screen, Tab.Cursor, Tab.Files)
// Overview only while connected (elsewhere, Connection shows).
private fun shown(core: Core, t: Tab) = t != Tab.Overview || core.host != null

// The sidebar's green dot: the page's feature is on.
private fun isOn(core: Core, t: Tab): Boolean = when (t) {
    Tab.Screen -> core.screen.viewing
    Tab.Cursor -> core.kvm.linked && core.sync.get("cursor", "in")
    Tab.Keyboard -> core.sync.value("keyboard") == "true"
    Tab.Remote -> core.remote.active
    Tab.Clipboard -> core.sync.get("clipboard", "in") || core.sync.get("clipboard", "out")
    Tab.Notifications -> core.sync.get("notifs", "in") || core.sync.get("notifs", "out")
    Tab.Sound -> core.sync.get("audio", "in") || core.sync.get("audio", "out")
    Tab.Camera -> core.adb.camera.on
    Tab.Rezume -> core.rezume.on
    Tab.Calls -> core.hub.callsOn
    Tab.Messages -> core.hub.messagesOn
    Tab.Photos -> core.hub.mediaOn
    Tab.FileAccess -> core.hub.filesOn
    else -> false
} && core.host != null

@Composable
private fun them(core: Core) =core.host?.name ?: core.hosts().firstOrNull()?.name ?: stringResource(R.string.common_the_computer)

// Pages that can't work over Bluetooth and don't move the session onto Wi-Fi by themselves
// (sound streams over the network; the computer's Photos): shown as they are while the session
// is on Bluetooth, saying so, with Connect with Wi-Fi Direct (WifiGate).
private fun wifiOnly(core: Core, t: Tab) = (t == Tab.Sound || t == Tab.Photos) && core.host != null && core.link.ble

@Composable
fun App(core: Core, resumed: Int) {
    val v by core.version.collectAsState()
    @Suppress("UNUSED_EXPRESSION") v; @Suppress("UNUSED_EXPRESSION") resumed // re-read Core on every bump
    var tab by rememberSaveable { mutableStateOf(Tab.Connection) }
    // Connected: its Overview (from Connection); not connected: Connection in its place.
    val connected = core.host != null
    var wasConnected by rememberSaveable { mutableStateOf(false) }
    if (connected && !wasConnected && tab == Tab.Connection) tab = Tab.Overview
    wasConnected = connected
    if (!connected && tab == Tab.Overview) tab = Tab.Connection
    val BOTTOM = bottom(core)
    var more by rememberSaveable { mutableStateOf(false) }
    val wide = LocalConfiguration.current.screenWidthDp >= 600
    // Wireless debugging went off (MIUI / HyperOS): ask once per time it happens.
    var adbAsked by rememberSaveable { mutableStateOf(false) }
    if (!core.adb.off) adbAsked = false
    if (core.adb.off && !adbAsked && !core.link.ble) { // over Bluetooth it can't be used anyway
        val name = them(core)
        AlertDialog(
            onDismissRequest = { adbAsked = true },
            containerColor = pal.surface,
            title = { Text(stringResource(R.string.adb_dialog_title), color = pal.text) },
            text = {
                Text(
                    stringResource(R.string.adb_dialog_desc, name),
                    color = pal.muted,
                )
            },
            confirmButton = { TextButton(onClick = { adbAsked = true; core.adb.openSettings() }) { Text(stringResource(R.string.adb_dialog_settings), color = pal.accent) } },
            dismissButton = { TextButton(onClick = { adbAsked = true }) { Text(stringResource(R.string.adb_dialog_not_now), color = pal.muted) } },
        )
    }

    // A computer wants to pair, or its code is up: over whatever page is open, not only the
    // notification and the Overview.
    core.invite?.let { inv ->
        AlertDialog(
            onDismissRequest = {},
            containerColor = pal.surface,
            title = { Text(stringResource(R.string.pair_invite_title, inv.name), color = pal.text) },
            text = { Text(stringResource(R.string.pair_invite_desc, inv.name), color = pal.muted) },
            confirmButton = { TextButton(onClick = { core.pair(inv) }) { Text(stringResource(R.string.pair_btn_pair), color = pal.accent) } },
            dismissButton = { TextButton(onClick = { core.dismissInvite() }) { Text(stringResource(R.string.pair_btn_not_now), color = pal.muted) } },
        )
    }
    core.link.pair?.takeIf { it.phase == "code" && !it.wired }?.let { p ->
        AlertDialog(
            onDismissRequest = {},
            containerColor = pal.surface,
            title = { Text(stringResource(R.string.pair_title, p.name), color = pal.text) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.pair_code, p.name), color = pal.muted)
                    Text("${p.code.take(3)} ${p.code.drop(3)}", fontSize = 40.sp, fontFamily = GeistMono, fontWeight = FontWeight.Light, letterSpacing = 4.sp, color = pal.text)
                }
            },
            confirmButton = { TextButton(onClick = { core.link.confirmCode() }) { Text(stringResource(R.string.pair_match), color = pal.accent) } },
            dismissButton = { TextButton(onClick = { core.link.cancelPairing() }) { Text(stringResource(R.string.pair_cancel), color = pal.muted) } },
        )
    }

    // Setup first while something needed isn't allowed (Skip for now remembers what was skipped).
    val ctx = LocalContext.current
    var setupDone by rememberSaveable { mutableStateOf(false) }
    if (!setupDone && SetupCheck.shouldShow(ctx, core)) return SetupScreen(core, ctx, v + resumed) { setupDone = true }
    // The wireless debugging guide when opened from General › Setup / Cursor (Overview has it as a card).
    if (Guide.open.value) return WirelessGuide(core, ctx, v + resumed)

    Box(Modifier.fillMaxSize().background(pal.content)) {
        if (wide) {
            Row(Modifier.safeDrawingPadding()) {
                Sidebar(core, v, tab) { tab = it }
                Box(Modifier.width(1.dp).fillMaxHeight().background(pal.line))
                Page(core, v, tab, Modifier.weight(1f))
            }
        } else {
            Column(Modifier.safeDrawingPadding()) {
                TopIdentity(core, v)
                if (more) MoreList(core, v, BOTTOM, Modifier.weight(1f)) { tab = it; more = false }
                else Page(core, v, tab, Modifier.weight(1f))
                Box(Modifier.fillMaxWidth().height(1.dp).background(pal.line))
                NavigationBar(containerColor = pal.sidebar, tonalElevation = 0.dp) {
                    val item = @Composable { label: String, icon: ImageVector, colors: List<Color>, selected: Boolean, go: () -> Unit ->
                        NavigationBarItem(
                            selected = selected, onClick = go,
                            icon = { Tile(icon, colors, 28, on = selected) }, // in their colours, selected or not
                            label = { Text(label, maxLines = 1, fontSize = 11.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal) },
                            colors = NavigationBarItemDefaults.colors(selectedTextColor = pal.text, indicatorColor = Color(0x14FFFFFF), unselectedTextColor = pal.muted),
                        )
                    }
                    for (t in BOTTOM) item(stringResource(t.titleRes), t.icon, t.colors, !more && tab == t) { tab = t; more = false }
                    item(stringResource(R.string.nav_more), Ico.more, listOf(Hue.grey), more || tab !in BOTTOM) { more = true }
                }
            }
        }
    }
}

// The top of the sidebar: the logo, TwinDesk, and who is connected (the Mac's `.identity`).
@Composable
private fun Identity(core: Core, v: Int, logo: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Logo(logo)
        Column(Modifier.padding(start = 12.dp)) {
            Text(stringResource(R.string.app_name), fontWeight = FontWeight.SemiBold, fontSize = 17.sp, letterSpacing = (-0.2).sp, color = pal.text)
            Row(verticalAlignment = Alignment.CenterVertically) {
                val h = core.host
                Dot(when { h != null -> pal.good; core.link.pair != null || core.link.state == "connecting" -> pal.warn; else -> pal.faint }, 7)
                Text(
                    when {
                        h != null -> h.name + " · " + core.net.via + (core.link.rttMs?.let { " · $it ms" } ?: "")
                        core.link.pair != null -> stringResource(R.string.pair_pairing)
                        core.link.state == "connecting" -> stringResource(R.string.pair_connecting)
                        else -> stringResource(R.string.pair_not_connected)
                    },
                    color = pal.muted, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun Sidebar(core: Core, v: Int, tab: Tab, go: (Tab) -> Unit) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    Column(Modifier.width(250.dp).fillMaxHeight().background(pal.sidebar).verticalScroll(rememberScrollState()).padding(horizontal = 10.dp, vertical = 14.dp)) {
        Box(Modifier.padding(start = 4.dp, bottom = 18.dp)) { Identity(core, v, 54) }
        var group: String? = null
        for (t in Tab.entries.filter { shown(core, it) }) {
            if (t.group == "bottom" && group != "bottom") Box(Modifier.padding(horizontal = 8.dp, vertical = 8.dp).fillMaxWidth().height(1.dp).background(pal.line))
            else if (group != null && t.group != group) Spacer(Modifier.height(10.dp))
            group = t.group
            NavItem(t.icon, t.colors, stringResource(t.titleRes), tab == t, isOn(core, t)) { go(t) }
        }
    }
}

@Composable
private fun TopIdentity(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    Box(Modifier.fillMaxWidth().background(pal.sidebar).padding(horizontal = 16.dp, vertical = 10.dp)) { Identity(core, v, 40) }
}

@Composable
private fun MoreList(core: Core, v: Int, BOTTOM: List<Tab>, modifier: Modifier, go: (Tab) -> Unit) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    Column(modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp)) {
        PageHead(stringResource(R.string.nav_more), "")
        MacCard {
            Tab.entries.filter { it !in BOTTOM && shown(core, it) }.forEachIndexed { i, t ->
                Column {
                    if (i > 0) Box(Modifier.padding(start = 58.dp).fillMaxWidth().height(1.dp).background(pal.line))
                    Row(Modifier.fillMaxWidth().clickable { go(t) }.padding(horizontal = 16.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                        Tile(t.icon, t.colors, 30)
                        Text(stringResource(t.titleRes), color = pal.text, fontSize = 16.sp, modifier = Modifier.padding(start = 12.dp).weight(1f))
                        if (wifiOnly(core, t)) Text(stringResource(R.string.wifi_direct), color = pal.muted, fontSize = 12.sp)
                        if (isOn(core, t)) Dot(pal.good, 7)
                        Text("›", color = pal.faint, fontSize = 20.sp, modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun Page(core: Core, v: Int, tab: Tab, modifier: Modifier) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    Column(modifier.fillMaxHeight().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 20.dp)) {
        Column(Modifier.widthIn(max = 820.dp)) {
            when (tab) {
                Tab.Overview -> OverviewPage(core, v, connection = false)
                Tab.Connection -> OverviewPage(core, v, connection = true)
                Tab.Calls -> CallsPage(core, v)
                Tab.Messages -> MessagesPage(core, v)
                Tab.Photos -> PhotosPage(core, v)
                Tab.FileAccess -> FileAccessPage(core, v)
                Tab.Screen -> ScreenPage(core, v)
                Tab.Cursor -> CursorPage(core, v)
                Tab.Keyboard -> KeyboardPage(core, v)
                Tab.Remote -> RemotePage(core, v)
                Tab.Clipboard -> ClipboardPage(core, v)
                Tab.Notifications -> NotificationsPage(core, v)
                Tab.Files -> FilesPage(core, v)
                Tab.Rezume -> RezumePage(core, v)
                Tab.Sound -> SoundPage(core, v)
                Tab.Camera -> CameraPage(core, v)
                Tab.General -> GeneralPage(core, v)
                Tab.About -> AboutPage(core, v)
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun Primary(label: String, onClick: () -> Unit) = PrimaryButton(label, onClick = onClick)

@Composable
private fun Secondary(label: String, onClick: () -> Unit) = SecondaryButton(label, onClick = onClick)

@Composable
private fun NotConnected(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    Note(stringResource(R.string.ov_not_connected_connect_to, them(core)), "warn")
}

// ---- Overview ----

@Composable
// One page, two halves: Connection (pairing, the link, Nearby, Switch to, Bluetooth, Scan QR code)
// and Overview (the link, the computer's controls, every feature's switches; only while connected).
private fun OverviewPage(core: Core, v: Int, connection: Boolean) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val link = core.link
    val host = core.host
    val me = core.store.deviceName
    val ip = remember(v) { core.adb.address() } // this phone's Wi-Fi address, for pairing by address on the computer
    if (!connection && host != null) PageHead(host.name, listOfNotNull(stringResource(R.string.pair_connected), core.net.via, link.rttMs?.let { "$it ms" }).joinToString(" · "))
    else if (LocalConfiguration.current.screenWidthDp >= 600) PageHead(stringResource(R.string.nav_connection), listOf(me, ip).filter { it.isNotEmpty() }.joinToString(" · "))
    else PageHead(stringResource(R.string.nav_connection), listOf(me, ip).filter { it.isNotEmpty() }.joinToString(" · "))

    if (connection) core.invite?.let { inv ->
        Note(stringResource(R.string.pair_invite_note, inv.name))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 16.dp)) {
            Primary(stringResource(R.string.pair_btn_pair)) { core.pair(inv) }
            Secondary(stringResource(R.string.pair_btn_not_now)) { core.dismissInvite() }
        }
    }
    if (connection) link.pair?.let { p ->
        MacCard(stringResource(R.string.pair_pairing_with, p.name)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                when (p.phase) {
                    "code", "waiting" -> if (p.wired) {
                        Text(stringResource(R.string.pair_usb_cable, p.name), color = pal.text)
                        Secondary(stringResource(R.string.pair_cancel)) { link.cancelPairing() }
                    } else {
                        Text(stringResource(R.string.pair_code, p.name), color = pal.text)
                        Text("${p.code.take(3)} ${p.code.drop(3)}", fontSize = 40.sp, fontFamily = GeistMono, fontWeight = FontWeight.Light, letterSpacing = 4.sp, color = pal.text)
                        if (p.phase == "code") Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Primary(stringResource(R.string.pair_match)) { link.confirmCode() }
                            Secondary(stringResource(R.string.pair_cancel)) { link.cancelPairing() }
                        } else Text(stringResource(R.string.pair_waiting, p.name), color = pal.muted)
                    }
                    "failed" -> {
                        Text(p.error, color = pal.bad)
                        Secondary(stringResource(R.string.pair_ok)) { link.cancelPairing() }
                    }
                    else -> {
                        Text(if (p.ble) stringResource(R.string.pair_connecting_ble) else stringResource(R.string.pair_connecting), color = pal.muted)
                        Secondary(stringResource(R.string.pair_cancel)) { link.cancelPairing() }
                    }
                }
            }
        }
    }

    // The hero: this device, the link, the computer (the Mac's `.hero`).
    MacCard(glow = host != null) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 22.dp), verticalAlignment = Alignment.CenterVertically) {
            Device(me, phone = true, Modifier.weight(1f))
            Column(Modifier.weight(0.9f), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)).background(
                    if (host != null) SpecBrush else Brush.horizontalGradient(listOf(pal.trackOff, pal.trackOff)),
                ))
                Text(
                    when { host != null -> listOfNotNull(core.net.via, link.rttMs?.let { "$it ms" }).joinToString(" · ").ifEmpty { stringResource(R.string.pair_connected) }; link.state == "connecting" -> stringResource(R.string.pair_connecting); link.pair != null -> stringResource(R.string.pair_pairing); else -> stringResource(R.string.pair_not_connected) },
                    color = pal.muted, fontSize = 11.sp, maxLines = 2, lineHeight = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp),
                )
            }
            Device(them(core), phone = false, Modifier.weight(1f))
        }
        Text(
            when {
                host != null -> stringResource(R.string.pair_connected)
                link.message.isNotEmpty() -> link.message
                core.hosts().isNotEmpty() -> stringResource(R.string.ov_tap_connect_or_click)
                else -> stringResource(R.string.ov_pick_a_computer_below)
            },
            color = pal.muted, fontSize = 12.5.sp, lineHeight = 17.sp, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
        )
        // Wireless debugging not set up (or off): one line under Connected, with the way to fix it.
        // Reached anyway (adb's TCP mode, on a direct Wi-Fi link): nothing to fix.
        // Over Bluetooth: greyed out, it only works over Wi-Fi.
        val adbBle = core.link.ble
        if (host != null && !core.adb.paired && (adbBle || core.adb.setupNeeded || !core.adb.wifiDebugging)) Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 14.dp).clip(RoundedCornerShape(14.dp)).background(if (adbBle) pal.hover else pal.warn.copy(alpha = 0.12f)).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (adbBle) stringResource(R.string.ov_wireless_debugging_only_available, host.name)
                else if (core.adb.setupNeeded) stringResource(R.string.ov_wireless_debugging_isn_t, host.name)
                else stringResource(R.string.ov_wireless_debugging_is_off, host.name),
                color = if (adbBle) pal.muted else pal.text, fontSize = 12.5.sp, lineHeight = 17.sp, modifier = Modifier.weight(1f).padding(end = 8.dp),
            )
            if (!adbBle) { if (core.adb.setupNeeded) Secondary(stringResource(R.string.common_set_up)) { Guide.open.value = true } else Secondary(stringResource(R.string.common_turn_on)) { core.adb.turnOn() } }
        }
        if (host != null) {
            val show = { core.ctx.startActivity(Intent(core.ctx, ViewerActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            // On Bluetooth: a direct Wi-Fi link on request, or made for files and screens: Back to Bluetooth ends it (both sides).
            val onWifi = core.net.wanted("user") || core.net.linked
            val wifiLabel = if (onWifi) stringResource(R.string.ov_back_to_bluetooth) else if (core.link.ble) stringResource(R.string.ov_connect_with_wi_fi) else null
            val wifiClick = { if (onWifi) core.net.drop() else core.net.need("user"); core.changed() }
            if (LocalConfiguration.current.screenWidthDp >= 600) {
                Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                    Primary(stringResource(R.string.ov_show_s_screen, host.name), show)
                    if (wifiLabel != null) Secondary(wifiLabel) { wifiClick() }
                    Secondary(stringResource(R.string.common_disconnect)) { core.disconnect() }
                }
            } else {
                // A phone: one button per line, inside the card's padding.
                Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PrimaryButton(stringResource(R.string.ov_show_s_screen, host.name), Modifier.fillMaxWidth(), onClick = show)
                    if (wifiLabel != null) SecondaryButton(wifiLabel, Modifier.fillMaxWidth()) { wifiClick() }
                    SecondaryButton(stringResource(R.string.common_disconnect), Modifier.fillMaxWidth()) { core.disconnect() }
                }
            }
        }
    }


    // The computer's own controls (dev.state, DevCtl.kt): ring, lock, sleep, Bluetooth, Do not disturb, volume.
    if (!connection && host != null) ComputerCard(core, host.name)

    // The other paired computers, while connected: Switch (Take over when nearby) lets this one go and connects that one.
    if (connection && host != null) {
        val others = core.hosts().filter { it.id != host.id }
        if (others.isNotEmpty()) MacCard(stringResource(R.string.ov_switch_to)) {
            others.forEachIndexed { i, h ->
                val near = core.isNear(h.id)
                MacRow(h.name, if (near && !core.discovery.found.containsKey(h.id)) stringResource(R.string.ov_nearby_over_bluetooth_paired) else if (near) stringResource(R.string.ov_nearby_paired) else stringResource(R.string.ov_paired_not_nearby), i == 0) {
                    Secondary(if (near) stringResource(R.string.common_take_over) else stringResource(R.string.ov_switch)) { core.switchTo(h) }
                }
            }
        }
        MacCard { BleSwitch(core, stringResource(R.string.ov_allow_nearby_devices_on), first = true) }
    }

    if (!connection && host != null) {
        val wide = LocalConfiguration.current.screenWidthDp >= 840
        val m2p = @Composable { mod: Modifier ->
            MacCard(modifier = mod) {
                DirHead(host.name, false, me, true)
                SwitchRow(stringResource(R.string.nav_screen), stringResource(R.string.ov_open_it_on_the), core.screen.viewing, first = true) { if (it) core.ctx.startActivity(Intent(core.ctx, ViewerActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                SwitchRow(stringResource(R.string.nav_sound), "", core.sync.get("audio", "in")) { core.sync.set("audio", "in", it) }
                SwitchRow(stringResource(R.string.ov_mouse_and_keyboard), "", core.sync.get("cursor", "in")) { core.sync.set("cursor", "in", it) }
                SwitchRow(stringResource(R.string.nav_clipboard), "", core.sync.get("clipboard", "in")) { core.sync.set("clipboard", "in", it) }
                SwitchRow(stringResource(R.string.nav_notifications), "", core.sync.get("notifs", "in")) { core.sync.set("notifs", "in", it) }
            }
        }
        val p2m = @Composable { mod: Modifier ->
            MacCard(modifier = mod) {
                DirHead(me, true, host.name, false)
                SwitchRow(stringResource(R.string.nav_sound), soundHint(core), core.sync.get("audio", "out"), first = true) { core.sync.set("audio", "out", it) }
                SoundStart(core)
                SwitchRow(stringResource(R.string.nav_clipboard), "", core.sync.get("clipboard", "out")) { core.sync.set("clipboard", "out", it) }
                SwitchRow(stringResource(R.string.nav_notifications), if (core.notifs.hasAccess) "" else if (!core.notifs.supported) stringResource(R.string.ov_needs_duodesk_with_notifications) else stringResource(R.string.ov_needs_notification_access_general), core.sync.get("notifs", "out")) { core.sync.set("notifs", "out", it) }
                // Calls, Messages and Photos, when the computer has them: what each needs is asked for as it's switched on.
                if (core.hub.peer) for (what in listOf("calls", "messages", "media", "files")) {
                    val perm = core.hub.perm(what)
                    val on = core.hub.on(what)
                    SwitchRow(
                        stringResource(Hub.labelRes(what)),
                        when {
                            perm == "none" && what == "files" -> stringResource(R.string.ov_needs_android_11_or)
                            perm == "none" -> stringResource(R.string.ov_needs_duodesk_with_notifications)
                            on && perm == "ask" && what == "files" -> stringResource(R.string.ov_allow_all_files_access)
                            on && perm == "ask" -> stringResource(R.string.ov_tap_allow_on_the)
                            on && perm == "partial" && what == "media" -> stringResource(R.string.ov_only_the_photos_you)
                            on && perm == "partial" -> stringResource(R.string.ov_some_access_is_missing)
                            what == "calls" -> stringResource(R.string.ov_answer_and_make_calls, host.name)
                            what == "messages" -> stringResource(R.string.ov_read_and_send_texts, host.name)
                            what == "files" -> stringResource(R.string.ov_browse_this_phone_s, host.name)
                            else -> stringResource(R.string.ov_see_and_save_them, host.name)
                        },
                        on, enabled = perm != "none",
                    ) {
                        core.hub.set(what, it)
                        if (it && perm != "ok") core.ctx.startActivity(Intent(core.ctx, PermActivity::class.java).putExtra("what", what).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                }
            }
        }
        if (wide) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) { m2p(Modifier.weight(1f)); p2m(Modifier.weight(1f)) }
        else { m2p(Modifier); p2m(Modifier) }
    }

    if (host == null) MacCard(stringResource(R.string.ov_nearby)) {
        val hosts = core.hosts()
        // The computer's QR code (Connection there): an extra way, next to these.
        val act = LocalContext.current
        MacRow(stringResource(R.string.ov_scan_a_qr_code), stringResource(R.string.ov_connection_pair_a_phone), true) { Secondary(stringResource(R.string.ov_scan)) { scanQr(act) } }
        var first = false
        for (h in hosts) {
            val near = core.isNear(h.id)
            MacRow(h.name, if (link.state == "connecting" && link.host?.id == h.id) stringResource(R.string.pair_connecting) else if (near && !core.discovery.found.containsKey(h.id)) stringResource(R.string.ov_nearby_over_bluetooth_paired) else if (near) stringResource(R.string.ov_nearby_paired) else stringResource(R.string.ov_paired_not_nearby), first) {
                TextButton(onClick = { core.forget(h.id) }) { Text(stringResource(R.string.pair_forget), color = pal.bad) }
                // Nearby: Take over (a phone's hello takes the computer from whoever has it).
                Primary(if (near) stringResource(R.string.common_take_over) else stringResource(R.string.common_connect)) { core.connect(h) }
            }
            first = false
        }
        for (f in core.nearby().filter { f -> hosts.none { it.id == f.id } }) {
            MacRow(f.name, "${if (f.os == "mac") "Mac" else if (f.os == "linux") "Linux" else "PC"} · ${if (f.address.startsWith("ble:") || f.address.startsWith("blp:")) "Bluetooth" else f.address}", first) { Secondary(stringResource(R.string.pair_btn_pair)) { core.pair(f) } }
            first = false
        }
        if (first) MacRow(stringResource(R.string.ov_looking_for_computers), if (core.bleOn && core.ble.allowed()) stringResource(R.string.ov_open_duodesk_on_your) else stringResource(R.string.ov_open_duodesk_on_your_2), true)
        BleSwitch(core, stringResource(R.string.ov_allow_nearby_devices_on))
        var addr by remember { mutableStateOf("") }
        Box(Modifier.padding(start = 16.dp).fillMaxWidth().height(1.dp).background(pal.line))
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.pair_by_address), color = pal.text, fontSize = 15.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(addr, { addr = it }, placeholder = { Text("192.168.1.20", color = pal.faint) }, singleLine = true, modifier = Modifier.weight(1f),
                    textStyle = LocalTextStyle.current.copy(fontSize = 15.sp, color = pal.text), shape = RoundedCornerShape(14.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
                Secondary(stringResource(R.string.pair_btn_pair)) { if (addr.isNotBlank()) core.pairAddress(addr) }
            }
        }
    }
}

// The connected computer's controls, when it has them (an older TwinDesk says nothing: no card).
@Composable
private fun ComputerCard(core: Core, name: String) {
    val c = core.dev.computer ?: return
    val can = c.optJSONObject("can") ?: return
    if (can.length() == 0) return
    MacCard(name) {
        val ringing = c.optBoolean("ringing")
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (can.optBoolean("ring")) SecondaryButton(if (ringing) stringResource(R.string.common_stop) else stringResource(R.string.dev_ring), Modifier.weight(1f), color = if (ringing) pal.bad else Color.Unspecified) {
                core.dev.ask(if (ringing) "ringStop" else "ring")
            }
            if (can.optBoolean("lock")) SecondaryButton(stringResource(R.string.dev_lock), Modifier.weight(1f)) { core.dev.ask("lock") }
            if (can.optBoolean("sleep")) SecondaryButton(stringResource(R.string.dev_sleep), Modifier.weight(1f)) { core.dev.ask("sleep") }
        }
        var first = true
        if (can.optBoolean("bluetooth") && c.has("bluetooth")) { SwitchRow("Bluetooth", stringResource(R.string.dev_on, name), c.optBoolean("bluetooth"), first = first) { core.dev.ask("bluetooth", "on" to it) }; first = false }
        if (can.optBoolean("dnd") && c.has("dnd")) { SwitchRow(stringResource(R.string.dev_do_not_disturb), stringResource(R.string.dev_on, name), c.optBoolean("dnd"), first = first) { core.dev.ask("dnd", "on" to it) }; first = false }
        if (can.optBoolean("volume") && c.has("volume")) {
            if (!first) Box(Modifier.padding(start = 16.dp).fillMaxWidth().height(1.dp).background(pal.line))
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text(stringResource(R.string.dev_volume), color = pal.text, fontSize = 15.sp)
                MacSlider(c.optDouble("volume").toFloat(), 0f..1f, 0, { "${(it * 100).toInt()}%" }) { core.dev.ask("volume", "level" to it.toDouble()) }
            }
        }
    }
}

// TwinDesk's own Scan QR code: Google's code scanner where the phone has it (no camera permission
// here), else the camera app (it opens twindesk:// links too: QrActivity).
fun scanQr(ctx: android.content.Context) {
    val ok = runCatching {
        val opts = com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE).build()
        com.google.mlkit.vision.codescanner.GmsBarcodeScanning.getClient(ctx, opts).startScan()
            .addOnSuccessListener { b -> if (!QrActivity.open(ctx, b.rawValue.orEmpty())) android.widget.Toast.makeText(ctx, ctx.getString(R.string.dev_that_isn_t_a), android.widget.Toast.LENGTH_SHORT).show() }
            .addOnFailureListener { openCamera(ctx) }
    }.isSuccess
    if (!ok) openCamera(ctx)
}

private fun openCamera(ctx: android.content.Context) {
    android.widget.Toast.makeText(ctx, ctx.getString(R.string.dev_scan_it_with_the), android.widget.Toast.LENGTH_LONG).show()
    runCatching { ctx.startActivity(Intent(android.provider.MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

// Bluetooth with computers (Overview and General, as on the computers): for one that isn't on this
// network. Off by itself while the session is on the same Wi-Fi, on again when that drops (Core.bleTick).
@Composable
private fun BleSwitch(core: Core, askHint: String, first: Boolean = false) {
    val ctx = LocalContext.current
    val name = them(core)
    val link = core.link
    val allowed = (Ble.permissions() + BleServe.permissions() + Direct.permission()).all { ctx.checkSelfPermission(it) == android.content.pm.PackageManager.PERMISSION_GRANTED }
    SwitchRow(stringResource(R.string.ble_bluetooth_with_computers), when {
        !core.bleOn -> stringResource(R.string.ble_only_computers_on_this)
        !core.ble.radioOn -> stringResource(R.string.ble_bluetooth_is_off_on)
        !allowed -> askHint
        core.bleWifiOff && link.connected && core.net.via == "Wi-Fi" -> stringResource(R.string.ble_off_while_you_re, name)
        else -> stringResource(R.string.ble_connects_to_over_bluetooth, name)
    }, core.bleOn, first = first) { core.store.setFlag("ble", it); core.changed() }
}

@Composable
private fun Device(name: String, phone: Boolean, modifier: Modifier) {
    val k = if (LocalConfiguration.current.screenWidthDp >= 600) 1f else 0.72f // smaller drawings on a phone
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        if (phone) Box(Modifier.width((34 * k).dp).height((60 * k).dp).clip(RoundedCornerShape(8.dp)).border(3.dp, pal.text.copy(alpha = 0.85f), RoundedCornerShape(8.dp)))
        else Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.width((84 * k).dp).height((54 * k).dp).clip(RoundedCornerShape(6.dp)).border(3.dp, pal.text.copy(alpha = 0.85f), RoundedCornerShape(6.dp)))
            Box(Modifier.padding(top = 3.dp).width((104 * k).dp).height(5.dp).clip(RoundedCornerShape(bottomStart = 6.dp, bottomEnd = 6.dp)).background(pal.text.copy(alpha = 0.85f)))
        }
        Text(name, fontWeight = FontWeight.SemiBold, color = pal.text, fontSize = 13.sp, maxLines = 2, lineHeight = 16.sp, textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis,
            softWrap = name.contains(' '), modifier = Modifier.padding(top = 8.dp, start = 2.dp, end = 2.dp))
    }
}

// ---- Wi-Fi Direct ----

// Over Bluetooth, a page that needs Wi-Fi says so and offers the way there (the Overview's
// Connect with Wi-Fi Direct): the page itself stays as it is.
@Composable
private fun WifiGate(core: Core, what: String) {
    if (core.host == null || !core.link.ble) return
    val n = core.net
    val moving = n.state in listOf("asking", "hosting", "joining")
    Note(
        when {
            moving -> stringResource(R.string.wifi_is_only_available_over, what)
            n.state == "failed" -> stringResource(R.string.wifi_is_only_available_over_2, what, n.error.ifEmpty { stringResource(R.string.wifi_direct_failed) })
            else -> stringResource(R.string.wifi_is_only_available_over_3, what)
        },
        "warn",
    )
    if (!moving) Row(Modifier.padding(bottom = 14.dp)) {
        Primary(if (n.state == "failed") stringResource(R.string.wifi_try_again) else stringResource(R.string.ov_connect_with_wi_fi)) { core.net.need("user"); core.changed() }
    }
}

// ---- Calls, Messages, Photos, File access (on the computer, from this phone: Hub.kt) ----

// The top of each: the switch (the computer keeps it), and what's missing here, with Allow.
@Composable
private fun HubHead(core: Core, v: Int, what: String, title: String, desc: String): Boolean {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val hub = core.hub
    val name = them(core)
    val perm = hub.perm(what)
    val on = hub.on(what)
    PageHead(title, desc, if (core.host != null && hub.peer && perm != "none") on else null) {
        hub.set(what, it)
        if (it && perm != "ok") hub.askHere(what)
    }
    if (core.host == null) { NotConnected(core, v); return false }
    if (!hub.peer) { Note(stringResource(R.string.hub_duodesk_on_needs_to, name, title), "warn"); return false }
    when {
        perm == "none" && what == "files" -> Note(stringResource(R.string.hub_file_access_needs_android, name), "warn")
        perm == "none" -> Note(stringResource(R.string.hub_needs_duodesk_with_notifications, title, name), "warn")
        !on -> Note(stringResource(R.string.hub_off_switch_it_on, name))
        perm == "ask" -> {
            Note(
                when (what) {
                    "files" -> stringResource(R.string.hub_allow_all_files_access, name)
                    "media" -> stringResource(R.string.hub_allow_photos_and_videos, name)
                    else -> pluralStringResource(R.plurals.hub_allow_permissions, Hub.wanted(what).size, title, Hub.wanted(what).size)
                },
                "warn",
            )
            Row(Modifier.padding(bottom = 14.dp)) { Primary(stringResource(R.string.common_allow)) { hub.askHere(what) } }
        }
        perm == "partial" -> {
            Note(if (what == "media") stringResource(R.string.hub_only_the_photos_you, name) else stringResource(R.string.hub_some_of_needs_more, title))
            Row(Modifier.padding(bottom = 14.dp)) { Secondary(stringResource(R.string.hub_allow_more)) { hub.askHere(what) } }
        }
        else -> Note(stringResource(R.string.hub_on_from_this_phone, title, name))
    }
    return on && perm != "none"
}

@Composable
private fun CallsPage(core: Core, v: Int) {
    val name = them(core)
    if (!HubHead(core, v, "calls", stringResource(R.string.nav_calls), stringResource(R.string.calls_answer_make_and_end, them(core)))) return
    MacCard(stringResource(R.string.dev_on, name)) {
        MacRow(stringResource(R.string.calls_answer_and_decline), stringResource(R.string.calls_a_window_on_when, name), first = true)
        MacRow(stringResource(R.string.calls_make_calls), stringResource(R.string.calls_the_number_pad_contacts, name))
    }
    // The computer as this phone's headset: paired over classic Bluetooth by the person, in Bluetooth
    // settings (TwinDesk doesn't pair them itself). Forget at the bottom.
    val hub = core.hub
    if (hub.btAudio) MacCard(stringResource(R.string.calls_sound_on, name)) {
        val bt = hub.btState()
        val allowed = bt.optBoolean("allowed", true)
        val bonded = bt.optBoolean("bonded")
        MacRow(
            "Bluetooth",
            when {
                !allowed -> stringResource(R.string.calls_allow_nearby_devices_so, name)
                !bt.optBoolean("radio", true) -> stringResource(R.string.calls_bluetooth_is_off_on)
                bt.optBoolean("bonding") -> stringResource(R.string.calls_pairing_confirm_the_code, name)
                bt.optBoolean("forget") -> stringResource(R.string.calls_forget_in_bluetooth_settings, name)
                bonded -> stringResource(R.string.calls_paired_with_calls_can, name)
                bt.optBoolean("le") -> stringResource(R.string.calls_paired_over_bluetooth_le)
                !hub.btKnown -> stringResource(R.string.calls_waiting_for, name)
                else -> stringResource(R.string.calls_not_paired_with_over, name)
            },
            first = true,
        ) {
            if (!allowed) Primary(stringResource(R.string.common_allow)) { hub.askHere("bt") }
            else if (hub.btKnown && !bonded && !bt.optBoolean("bonding")) Secondary(stringResource(R.string.calls_open_bluetooth_settings)) { hub.btSettings() }
        }
        var sure by remember { mutableStateOf(false) }
        MacRow(stringResource(R.string.pair_forget), stringResource(R.string.calls_this_phone_and_forget, name)) {
            TextButton(onClick = { if (sure) { sure = false; hub.forgetBt() } else { sure = true } }) { Text(if (sure) stringResource(R.string.pair_forget_confirm) else stringResource(R.string.pair_forget), color = pal.bad) }
        }
    }
}

@Composable
private fun MessagesPage(core: Core, v: Int) {
    val name = them(core)
    if (!HubHead(core, v, "messages", stringResource(R.string.nav_messages), stringResource(R.string.msgs_read_and_send_this, them(core)))) return
    MacCard(stringResource(R.string.dev_on, name)) {
        MacRow(stringResource(R.string.msgs_conversations), stringResource(R.string.msgs_texts_and_mms_pictures, name), first = true)
        MacRow(stringResource(R.string.msgs_new_texts), stringResource(R.string.msgs_counted_on_the_messages, name))
    }
}

@Composable
private fun PhotosPage(core: Core, v: Int) {
    val name = them(core)
    WifiGate(core, stringResource(R.string.wifi_photos_on, name))
    if (!HubHead(core, v, "media", stringResource(R.string.nav_photos), stringResource(R.string.photos_see_this_phone_s, them(core)))) return
    MacCard(stringResource(R.string.dev_on, name)) {
        MacRow(stringResource(R.string.photos_photos_videos_and_screenshots), stringResource(R.string.photos_newest_first_on_s, name), first = true)
        MacRow(stringResource(R.string.common_save), stringResource(R.string.photos_copies_go_to_s, name))
    }
}

@Composable
private fun FileAccessPage(core: Core, v: Int) {
    val name = them(core)
    WifiGate(core, stringResource(R.string.wifi_phone_files_on, name))
    if (HubHead(core, v, "files", stringResource(R.string.nav_file_access), stringResource(R.string.fa_browse_this_phone_s, them(core)))) MacCard(stringResource(R.string.dev_on, name)) {
        MacRow(stringResource(R.string.fa_phone_files), stringResource(R.string.fa_folders_save_to_upload, name), first = true)
        MacRow(stringResource(R.string.fa_no_adb), stringResource(R.string.fa_duodesk_reads_and_writes, name))
        MacRow(stringResource(R.string.fa_where), stringResource(R.string.fa_on_usb_wi_fi, name))
    }
    if (core.host != null) SharedFolders(core, v)
}

// Shared folders, both ways (FolderShare.kt): this phone's in the computer's file manager, the
// computer's in the Files app here.
@Composable
private fun SharedFolders(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val ctx = LocalContext.current
    val sh = core.share
    val name = them(core)
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri -> if (uri != null) sh.choose(uri) }
    val ble = core.link.ble
    MacCard(stringResource(R.string.shared_shared_folders)) {
        SwitchRow(
            stringResource(R.string.shared_share_a_folder_with, name),
            when {
                !sh.allowed -> stringResource(R.string.shared_needs_all_files_access)
                ble && sh.on -> stringResource(R.string.shared_opens_it_over_wi, sh.shown(), name)
                sh.error.isNotEmpty() -> stringResource(R.string.shared_couldn_t_share, sh.error)
                sh.on && sh.serving -> stringResource(R.string.shared_open_on_phone_files, sh.shown(), name)
                else -> sh.shown()
            },
            sh.on, first = true,
        ) {
            sh.setOn(it)
            if (it && !sh.allowed) core.hub.askHere("files")
        }
        MacRow(stringResource(R.string.shared_folder), sh.shown()) { Secondary(stringResource(R.string.common_choose)) { pick.launch(null) } }
        val pc = sh.pc
        MacRow(
            stringResource(R.string.shared_s_shared_folder, name),
            when {
                ble && sh.opening -> stringResource(R.string.shared_connecting_with_wi_fi)
                ble && sh.pcServe -> stringResource(R.string.shared_open_connects_with_wi)
                pc != null -> stringResource(R.string.shared_in_the_files_app, pc.name)
                sh.pcServe -> stringResource(R.string.shared_opening)
                else -> stringResource(R.string.shared_off_switch_it_on, name)
            },
        ) {
            if (pc != null) Primary(stringResource(R.string.common_open)) { openPcShare(ctx) }
            else if (ble && sh.pcServe && !sh.opening) Primary(stringResource(R.string.common_open)) { sh.openOverWifi() }
            MacSwitch(sh.pcServe, { sh.setPcServe(it) })
        }
    }
}

// The Files app at the computer's shared folder (its root; else the system's file picker there).
fun openPcShare(ctx: android.content.Context) {
    val root = android.provider.DocumentsContract.buildRootUri(PcShareProvider.authority(ctx), PcShareProvider.ROOT)
    val doc = android.provider.DocumentsContract.buildDocumentUri(PcShareProvider.authority(ctx), "/")
    val tries = listOf(
        Intent(Intent.ACTION_VIEW).setDataAndType(root, "vnd.android.document/root"),
        Intent(Intent.ACTION_VIEW).setDataAndType(doc, android.provider.DocumentsContract.Document.MIME_TYPE_DIR),
        Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI, doc),
    )
    for (i in tries) if (runCatching { ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)) }.isSuccess) return
}

// ---- Screen ----

// This device's camera on the computer (its Camera tab: phoneview.js openCamera, over wireless
// debugging): its picture in TwinDesk there, and with Virtual camera on there, a camera every app
// there can pick ("DuoDesk Camera").
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CameraPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val host = core.host
    val adb = core.adb
    val cam = adb.camera
    val name = them(core)
    val canShow = adb.paired || adb.known
    var facing by rememberSaveable { mutableStateOf("back") }
    val shown = if (cam.on) cam.facing ?: facing else facing
    PageHead(
        stringResource(R.string.nav_camera),
        stringResource(R.string.cam_this_device_s_camera, name),
        master = if (host != null && (canShow || cam.on)) cam.on else null,
        onMaster = { adb.cameraOnComputer(it, facing) },
    )
    if (host == null) return NotConnected(core, v)
    MacCard(stringResource(R.string.cam_this_camera_on, name)) {
        MacRow(
            stringResource(R.string.nav_camera),
            if (cam.on) stringResource(R.string.cam_switching_takes_a_moment) else stringResource(R.string.cam_the_one_it_starts),
            first = true,
        ) {
            SingleChoiceSegmentedButtonRow {
                val sides = listOf("back" to stringResource(R.string.cam_back), "front" to stringResource(R.string.cam_front))
                sides.forEachIndexed { i, (f, label) ->
                    SegmentedButton(
                        selected = shown == f,
                        onClick = { facing = f; if (cam.on) adb.cameraOnComputer(true, f) },
                        shape = SegmentedButtonDefaults.itemShape(i, sides.size),
                    ) { Text(label) }
                }
            }
        }
        MacRow(
            stringResource(R.string.dev_on, name),
            when {
                !canShow -> stringResource(R.string.cam_needs_wireless_debugging_set)
                cam.error.isNotEmpty() -> stringResource(R.string.cam_it_stopped, cam.error)
                cam.on && cam.virtual -> stringResource(R.string.cam_running_as_duodesk_camera)
                cam.on -> stringResource(R.string.cam_in_duodesk_s_camera)
                else -> stringResource(R.string.common_off)
            },
        )
    }
    Note(
        if (cam.virtual) stringResource(R.string.cam_s_virtual_camera_is, name)
        else stringResource(R.string.cam_turn_on_virtual_camera, name),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScreenPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val host = core.host
    val s = core.screen
    val ctx = LocalContext.current
    val name = them(core)
    PageHead(stringResource(R.string.nav_screen), stringResource(R.string.desc_screen, name))
    if (host == null) return NotConnected(core, v)
    // The other way round: this device's screen in a window on the computer, over wireless debugging.
    // Paired now or before: the computer brings it back by itself (on Bluetooth, onto Wi-Fi first).
    val adb = core.adb
    val canShow = adb.paired || adb.known
    MacCard(stringResource(R.string.screen_this_screen_on, name)) {
        MacRow(
            stringResource(R.string.screen_show_this_screen_on, name),
            when {
                !canShow -> stringResource(R.string.cam_needs_wireless_debugging_set)
                adb.viewed -> stringResource(R.string.screen_this_device_s_windows, name)
                else -> stringResource(R.string.screen_in_a_window_there)
            },
            first = true,
        ) {
            if (adb.viewed) Secondary(stringResource(R.string.common_close)) { adb.showOnComputer(false) }
            PrimaryButton(stringResource(R.string.common_show), enabled = canShow) { adb.showOnComputer(true) }
        }
    }
    Note(
        when {
            !s.sharing -> stringResource(R.string.screen_isn_t_sharing_its, name)
            s.mode == "extend" -> stringResource(R.string.screen_shares_a_second_screen, name)
            else -> stringResource(R.string.screen_shares_its_own_screen, name)
        },
    )
    MacCard {
        MacRow(stringResource(R.string.ov_show_s_screen, name),stringResource(R.string.screen_full_screen_tap_the), first = true) {
            Primary(stringResource(R.string.common_open)) { ctx.startActivity(Intent(ctx, ViewerActivity::class.java)) }
        }
        if (s.remote) MacRow(stringResource(R.string.screen_mode), stringResource(R.string.screen_extend_makes_a_second, name)) {
            // A phone: Mirror and Extend across the row's width, under the label.
            SingleChoiceSegmentedButtonRow(if (LocalConfiguration.current.screenWidthDp < 600) Modifier.fillMaxWidth() else Modifier) {
                val modes = listOf("mirror" to stringResource(R.string.common_mirror), "extend" to stringResource(R.string.common_extend))
                modes.forEachIndexed { i, (m, label) ->
                    SegmentedButton(selected = s.sharing && s.mode == m, onClick = { s.control(share = true, mode = m) }, shape = SegmentedButtonDefaults.itemShape(i, modes.size)) { Text(label) }
                }
            }
        } else MacRow(stringResource(R.string.screen_mode), stringResource(R.string.screen_starts_and_switches_its, name))
        if (s.sharing && s.remote) MacRow(stringResource(R.string.screen_sharing), "") { Secondary(stringResource(R.string.common_stop)) { s.control(share = false) } }
    }
    MacCard(stringResource(R.string.screen_touch)) {
        val pad = core.store.flag("screen.touchpad", true)
        SwitchRow(stringResource(R.string.screen_touchpad), stringResource(R.string.screen_slide_to_move_the), pad, first = true) { s.setOpt("screen.touchpad", it) }
        if (pad) {
            MacRow(stringResource(R.string.screen_slide), stringResource(R.string.screen_move_the_pointer))
            MacRow(stringResource(R.string.screen_tap), if (core.remote.tapClick) stringResource(R.string.screen_left_click) else stringResource(R.string.screen_nothing_remote_tap_to))
            MacRow(stringResource(R.string.screen_hold), stringResource(R.string.screen_right_click))
            MacRow(stringResource(R.string.screen_two_fingers), stringResource(R.string.screen_scroll))
        } else {
            MacRow(stringResource(R.string.screen_tap), stringResource(R.string.screen_click))
            MacRow(stringResource(R.string.screen_hold), stringResource(R.string.screen_right_click))
            MacRow(stringResource(R.string.screen_drag), stringResource(R.string.screen_drag_select_move_windows))
            MacRow(stringResource(R.string.screen_two_fingers), stringResource(R.string.screen_scroll))
        }
        if (!s.inputOn) MacRow(stringResource(R.string.screen_input_is_off), stringResource(R.string.screen_doesn_t_take_input, name))
    }
    MacCard(stringResource(R.string.screen_stylus)) {
        SwitchRow(stringResource(R.string.screen_pen), stringResource(R.string.screen_pressure_tilt_the_eraser, name), core.store.flag("screen.pen", true), first = true) { s.setOpt("screen.pen", it) }
    }
    MacCard(stringResource(R.string.screen_playback)) {
        SwitchRow(stringResource(R.string.screen_s_sound_with_the, name), stringResource(R.string.screen_when_shares_sound_with, name), core.store.flag("screen.sound", false), first = true) { s.setOpt("screen.sound", it) }
        SwitchRow(stringResource(R.string.screen_smooth), stringResource(R.string.screen_even_motion_about_one), core.store.flag("screen.smooth", false)) { s.setOpt("screen.smooth", it) }
    }
}

// ---- Cursor ----

@Composable
private fun CursorPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val host = core.host
    val name = them(core)
    val me = core.store.deviceName
    // Over Bluetooth (pair.sync "ble", the computer's kvm.js): off, nothing crosses while the session runs through Bluetooth.
    val paused = core.link.ble && core.sync.value("ble") == "false"
    val shared = core.kvm.linked && core.sync.get("cursor", "in") && !paused
    PageHead(stringResource(R.string.nav_cursor), stringResource(R.string.desc_cursor, name), if (host != null) shared else null) {
        // Through Bluetooth, with cursor sharing on, the switch is Over Bluetooth: off there leaves it on for Wi-Fi.
        if (core.link.ble && core.kvm.linked && core.sync.get("cursor", "in")) core.sync.setValue("ble", it)
        else {
            if (it && !core.sync.get("cursor", "in")) core.sync.set("cursor", "in", true)
            if (it && core.link.ble) core.sync.setValue("ble", true)
            core.kvm.setLinked(it)
        }
    }
    if (host == null) return NotConnected(core, v)
    // Accessibility (chosen, or a session on Bluetooth): no wireless debugging needed, only the service.
    // ADB reached without wireless debugging (its TCP mode, on a direct Wi-Fi link) counts as there.
    val adbOn = core.adb.wifiDebugging || core.adb.paired
    val viaPhone = core.input.via == "phone" || (core.input.via == "auto" || core.link.ble) && !adbOn
    val adbMissing = !viaPhone && !adbOn
    Note(
        when {
            viaPhone && !core.input.supported -> stringResource(R.string.cursor_this_build_of_duodesk, name)
            viaPhone && !core.input.on -> stringResource(R.string.cursor_allow_duodesk_in_accessibility, name)
            adbMissing -> stringResource(R.string.cursor_moves_the_pointer_here, name)
            !core.pointer.allowed -> stringResource(R.string.cursor_allow_show_the_pointer, name)
            !core.kvm.linked -> stringResource(R.string.cursor_cursor_sharing_is_off, core.kvm.hotkey, name)
            paused -> stringResource(R.string.cursor_cursor_sharing_is_off_2, core.kvm.hotkey, name)
            else -> stringResource(R.string.cursor_push_s_pointer_past, name, core.kvm.hotkey)
        },
        if (adbMissing || viaPhone && !core.input.on || !core.pointer.allowed) "warn" else "info",
    )
    if (viaPhone && !core.input.supported) Row(Modifier.padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (!adbOn) Primary(stringResource(R.string.sc_adb_long)) { core.adb.turnOn() }
        if (core.adb.setupNeeded) Secondary(stringResource(R.string.common_set_up)) { Guide.open.value = true }
    }
    else if (viaPhone && !core.input.on) Row(Modifier.padding(bottom = 14.dp)) { Primary(stringResource(R.string.common_allow)) { core.input.openSettings() } }
    else if (adbMissing || !viaPhone && core.adb.setupNeeded) Row(Modifier.padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (adbMissing) Primary(stringResource(R.string.sc_adb_long)) { core.adb.turnOn() }
        if (core.adb.setupNeeded) Secondary(stringResource(R.string.common_set_up)) { Guide.open.value = true }
    }
    MacCard {
        DirHead(name, false, me, true)
        SwitchRow(stringResource(R.string.cursor_use_s_mouse_and, name, me), stringResource(R.string.cursor_push_the_pointer_past), core.sync.get("cursor", "in"), first = true) { core.sync.set("cursor", "in", it) }
        MacRow(stringResource(R.string.cursor_through), when {
            core.input.via == "auto" && core.input.effective == "adb" -> stringResource(R.string.cursor_automatic_adb_wireless_debugging)
            core.input.via == "auto" -> stringResource(R.string.cursor_automatic_accessibility_until_wireles)
            core.input.via == "phone" -> stringResource(R.string.cursor_accessibility_duodesk_taps_and)
            else -> stringResource(R.string.cursor_adb_wireless_debugging_full)
        }) {
            SingleChoiceSegmentedButtonRow {
                val ways = listOf("adb" to "ADB", "phone" to stringResource(R.string.common_accessibility))
                ways.forEachIndexed { i, (w, label) ->
                    SegmentedButton(selected = core.input.effective == w, onClick = { core.input.setVia(w); core.changed() }, shape = SegmentedButtonDefaults.itemShape(i, ways.size)) { Text(label, maxLines = 1) }
                }
            }
        }
    }
    MacCard(stringResource(R.string.cursor_where_is, name)) { LayoutPicker(me, name, core.kvm.macSide) { core.kvm.setMacSide(it) } }
    MacCard(stringResource(R.string.cursor_feel)) {
        val speed = core.sync.value("speed").toFloatOrNull() ?: 1f
        MacRow(stringResource(R.string.cursor_pointer_speed_here), "", first = true) {
            MacSlider(speed, 0.25f..4f, 14, { "%.2f×".format(it) }) { v ->
                val steps = listOf(0.25f, 0.5f, 0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f, 2.5f, 3f, 3.5f, 4f)
                val snapped = steps.minBy { kotlin.math.abs(it - v) }
                core.sync.setValue("speed", if (snapped % 1f == 0f) snapped.toInt() else snapped)
            }
        }
        SwitchRow(stringResource(R.string.cursor_reverse_scrolling), stringResource(R.string.cursor_scroll_here_the_other), core.sync.value("reverseScroll") == "true") { core.sync.setValue("reverseScroll", it) }
        MacRow(stringResource(R.string.screen_right_click), stringResource(R.string.cursor_back))
        MacRow(stringResource(R.string.cursor_middle_click), stringResource(R.string.cursor_home))
    }
    MacCard(stringResource(R.string.cursor_not_on_the_same)) {
        SwitchRow(stringResource(R.string.cursor_over_bluetooth), stringResource(R.string.cursor_when_isn_t_on, name),
            core.sync.value("ble") != "false", first = true) { core.sync.setValue("ble", it) }
    }
}

// ---- Keyboard ----

@Composable
private fun KeyboardPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val host = core.host
    val name = them(core)
    val me = core.store.deviceName
    val on = core.sync.value("keyboard") == "true"
    PageHead(stringResource(R.string.nav_keyboard), stringResource(R.string.desc_keyboard), if (host != null) on else null) { core.sync.setValue("keyboard", it) }
    if (host == null) return NotConnected(core, v)
    Note(if (on) stringResource(R.string.kbd_s_keyboard_types_here, name) else stringResource(R.string.kbd_keyboard_sharing_is_off))
    MacCard(stringResource(R.string.kbd_hotkey)) {
        MacRow(core.kvm.hotkey, stringResource(R.string.kbd_double_tap_on_to, name), first = true)
    }
    MacCard {
        DirHead(name, false, me, true)
        MacRow(stringResource(R.string.kbd_shortcuts_here), stringResource(R.string.kbd_works_as_ctrl_so), first = true)
        MacRow(stringResource(R.string.kbd_typing), stringResource(R.string.kbd_every_key_goes_as))
    }
    MacCard(stringResource(R.string.kbd_in_the_screen_view)) {
        MacRow(stringResource(R.string.kbd_s_screen_here, name), stringResource(R.string.kbd_a_keyboard_on_this, name), first = true)
    }
}

// ---- Remote ----

// ReZume (Rezume.kt): the computer's tab or document here, this phone's tab or app there.
@Composable
private fun RezumePage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val r = core.rezume
    val ctx = LocalContext.current
    val name = them(core)
    PageHead(stringResource(R.string.nav_rezume), stringResource(R.string.desc_rezume, name), r.on) { r.set("on", it) }
    if (!r.on) return Note(stringResource(R.string.rezume_off_nothing_here_is, name))
    if (core.host == null) return NotConnected(core, v)
    val o = r.incoming
    if (o != null) MacCard(stringResource(R.string.rezume_continue_from, name)) {
        MacRow(o.title, if (o.kind == "web") (android.net.Uri.parse(o.url).host ?: o.url) else o.name, first = true) {
            Primary(stringResource(R.string.common_open)) { r.take(o, ctx) }
            Spacer(Modifier.width(8.dp))
            Secondary(stringResource(R.string.common_dismiss)) { r.dismiss() }
        }
    }
    val p = r.peer
    Note(when {
        p == null -> stringResource(R.string.rezume_has_no_rezume_yet, name)
        !p.optBoolean("on") -> stringResource(R.string.rezume_rezume_is_off_on, name)
        InputService.running == null && core.adb.wifiDebugging -> stringResource(R.string.rezume_ready_sees_this_phone, name)
        InputService.running == null -> stringResource(R.string.rezume_s_pages_and_documents, name)
        r.offered.isNotEmpty() -> stringResource(R.string.rezume_offered_to, name, r.offered)
        else -> stringResource(R.string.rezume_ready)
    }, if (p == null || !p.optBoolean("on")) "warn" else "info")
    if (r.message.isNotEmpty()) Note(r.message)
    if (InputService.running == null) MacCard {
        MacRow(stringResource(R.string.common_accessibility), stringResource(R.string.rezume_says_which_app_is), first = true) {
            Secondary(stringResource(R.string.rezume_open_settings)) { ctx.startActivity(Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }
    MacCard(stringResource(R.string.rezume_what_goes)) {
        SwitchRow(stringResource(R.string.rezume_web_pages), stringResource(R.string.rezume_the_tab_in_front, name), r.opt("web"), first = true) { r.set("web", it) }
        SwitchRow(stringResource(R.string.rezume_documents), stringResource(R.string.rezume_s_document_in_front, name), r.opt("docs")) { r.set("docs", it) }
        SwitchRow(stringResource(R.string.rezume_apps), stringResource(R.string.rezume_the_app_in_front, name), r.opt("apps")) { r.set("apps", it) }
    }
    MacCard(stringResource(R.string.rezume_which_ways)) {
        SwitchRow(stringResource(R.string.rezume_offer_what_s_in), stringResource(R.string.rezume_can_go_on_with, name), r.opt("send"), first = true) { r.set("send", it) }
        SwitchRow(stringResource(R.string.rezume_take_s, name), stringResource(R.string.rezume_what_s_in_use), r.opt("receive")) { r.set("receive", it) }
        SwitchRow(stringResource(R.string.rezume_open_what_s_sent), stringResource(R.string.rezume_send_to_on_opens, name), r.opt("push")) { r.set("push", it) }
    }
    MacCard(stringResource(R.string.rezume_where_s_shows, name)) {
        SwitchRow(stringResource(R.string.rezume_notification), stringResource(R.string.rezume_a_quiet_one_replaced), r.opt("notify"), first = true) { r.set("notify", it) }
    }
    Note(stringResource(R.string.rezume_share_a_link_to, name))
}

@Composable
private fun RemotePage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val r = core.remote
    val ctx = LocalContext.current
    val name = them(core)
    val me = core.store.deviceName
    PageHead(stringResource(R.string.nav_remote), stringResource(R.string.desc_remote, name))
    if (core.host == null) {
        NotConnected(core, v)
        return BtPadCard(core) // works without TwinDesk on the computer
    }
    if (r.unsupported) Note(stringResource(R.string.remote_doesn_t_answer_the, name), "warn")
    else if (r.allowed == false) Note(r.why.ifEmpty { stringResource(R.string.remote_doesn_t_take_input, name) }, "warn")
    val open = { mode: String -> ctx.startActivity(Intent(ctx, RemoteActivity::class.java).putExtra("mode", mode)) }
    MacCard {
        MacRow(stringResource(R.string.remote_touchpad_and_keyboard), stringResource(R.string.remote_slide_to_move_s, name), first = true) {
            Primary(stringResource(R.string.common_open)) { open("pad") }
        }
        MacRow(stringResource(R.string.remote_gamepad), stringResource(R.string.remote_held_sideways_like_a)) {
            Primary(stringResource(R.string.common_open)) { open("gamepad") }
        }
    }
    MacCard(stringResource(R.string.screen_touchpad)) {
        MacRow(stringResource(R.string.remote_pointer_speed), stringResource(R.string.remote_also_the_gamepad_s), first = true) {
            MacSlider(r.speed, 0.3f..3f, 0, { "%.1f×".format(java.util.Locale.ROOT, it) }) { r.setSpeed(it) }
        }
        SwitchRow(stringResource(R.string.remote_tap_to_click), stringResource(R.string.remote_a_quick_tap_left), r.tapClick) { r.setTapClick(it) }
        SwitchRow(stringResource(R.string.screen_smooth), stringResource(R.string.remote_even_pointer_motion_on, name), r.smooth) { r.setSmooth(it) }
    }
    BtPadCard(core)
    Note(
        when {
            core.link.wired -> stringResource(R.string.remote_on_the_usb_cable)
            core.link.ble -> stringResource(R.string.remote_through_bluetooth_the_pointer)
            else -> stringResource(R.string.remote_over_wi_fi_it)
        },
    )
}

// As a Bluetooth gamepad (BtPad.kt): any computer, the Mac too, no driver and no TwinDesk there.
@Composable
private fun BtPadCard(core: Core) {
    val ctx = LocalContext.current
    val made = core.btPadMade
    val on = core.store.flag("remote.btpad", false)
    val pad = if (made || on) core.btPad else null
    LaunchedEffect(on) { if (on) core.btPad.start() }
    val findable = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { core.changed() }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { got ->
        if (got.values.all { it }) { core.btPad.setOn(true); findable.launch(core.btPad.discoverableIntent()) }
        else ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")))
    }
    val state = pad?.state ?: "off"
    MacCard(stringResource(R.string.btpad_as_a_bluetooth_gamepad)) {
        SwitchRow(stringResource(R.string.btpad_as_a_bluetooth_gamepad), stringResource(R.string.btpad_a_game_controller_for), on, first = true) { v ->
            if (!v) core.btPad.setOn(false)
            else if (!core.btPad.allowed()) ask.launch(BtPad.permissions())
            else { core.btPad.setOn(true); findable.launch(core.btPad.discoverableIntent()) }
        }
        if (on) {
            MacRow(stringResource(R.string.btpad_now), when (state) {
                "starting" -> stringResource(R.string.btpad_starting)
                "unavailable" -> pad?.message ?: ""
                "connected" -> stringResource(R.string.btpad_connected_to_open_the, pad?.hostName.orEmpty())
                "ready" -> stringResource(R.string.btpad_ready_waiting_for_a)
                else -> pad?.message?.ifEmpty { stringResource(R.string.common_off) } ?: stringResource(R.string.common_off)
            }) { if (state == "connected") Primary(stringResource(R.string.common_open)) { ctx.startActivity(Intent(ctx, RemoteActivity::class.java).putExtra("mode", "gamepad")) } }
            if (state == "ready") {
                MacRow(stringResource(R.string.btpad_pair_it_once), stringResource(R.string.btpad_on_the_computer_bluetooth, core.store.deviceName)) {
                    Secondary(stringResource(R.string.btpad_let_computers_find_it)) { findable.launch(core.btPad.discoverableIntent()) }
                }
            }
        }
    }
}

// ---- Clipboard ----

@Composable
private fun ClipboardPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val name = them(core)
    val me = core.store.deviceName
    val ctx = LocalContext.current
    PageHead(stringResource(R.string.nav_clipboard), stringResource(R.string.desc_clipboard))
    if (core.host == null) NotConnected(core, v)
    MacCard {
        DirHead(name, false, me, true)
        SwitchRow(stringResource(R.string.clip_copies_on_land_here, name), stringResource(R.string.clip_at_once), core.sync.get("clipboard", "in"), first = true) { core.sync.set("clipboard", "in", it) }
    }
    MacCard {
        DirHead(me, true, name, false)
        SwitchRow(stringResource(R.string.clip_copies_here_go_to, name), stringResource(R.string.clip_while_duodesk_is_open), core.sync.get("clipboard", "out"), first = true) { core.sync.set("clipboard", "out", it) }
        if (core.host != null) MacRow(stringResource(R.string.clip_send_the_clipboard_now), stringResource(R.string.clip_also_the_send_clipboard)) { Secondary(stringResource(R.string.common_send)) { core.clip.sendCurrent(true) } }
    }
    // Pictures both ways, this device's screenshots among them (Clip.kt, Screenshots.kt). Finding
    // new screenshots needs photo access.
    val clip = core.clip
    val shots = core.shots
    val askPhotos = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (!granted && !shots.canRead) ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")))
        core.changed()
    }
    MacCard(stringResource(R.string.clip_pictures)) {
        SwitchRow(stringResource(R.string.clip_pictures), stringResource(R.string.clip_pictures_and_screenshots_up, name), clip.picturesOn, first = true) { clip.setPictures(it); shots.watch() }
        if (clip.picturesOn && core.host != null && !clip.peerImages) MacRow(stringResource(R.string.clip_off_on, name), stringResource(R.string.clip_turn_on_clipboard_pictures))
        if (clip.picturesOn) {
            SwitchRow(stringResource(R.string.clip_screenshots_go_to, name), stringResource(R.string.clip_each_one_taken_here, name), shots.on) { shots.setOn(it) }
            if (shots.on && !shots.canRead) MacRow(stringResource(R.string.clip_allow_photo_access), stringResource(R.string.clip_duodesk_looks_only_for)) { Primary(stringResource(R.string.common_allow)) { askPhotos.launch(shots.permission) } }
            if (shots.lastSent.isNotEmpty()) MacRow(stringResource(R.string.clip_last_screenshot_sent), shots.lastSent)
        }
    }
    if (clip.history.isNotEmpty()) MacCard(stringResource(R.string.clip_recent)) {
        clip.history.toList().take(12).forEachIndexed { i, item ->
            // A picture of ours isn't kept here: only the computer's copy again.
            val again = item.dir == "in" || item.picture == null
            MacRow(item.text.replace('\n', ' ').take(120), (if (item.dir == "in") stringResource(R.string.clip_from, name) else stringResource(R.string.clip_to, name)) + if (again) " · " + stringResource(R.string.clip_tap_to_copy) else "", first = i == 0, onClick = if (again) ({ clip.copyAgain(item) }) else null)
        }
    }
}

// ---- Notifications ----

@Composable
private fun NotificationsPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val name = them(core)
    val me = core.store.deviceName
    val ctx = LocalContext.current
    PageHead(stringResource(R.string.nav_notifications), stringResource(R.string.desc_notifications))
    if (core.host == null) NotConnected(core, v)
    if (!core.notifs.supported) Note(
        stringResource(R.string.notifs_this_build_of_duodesk, name),
        "warn",
    )
    else if (!core.notifs.hasAccess) Note(stringResource(R.string.notifs_allow_notification_access_so, name), "warn")
    MacCard {
        DirHead(me, true, name, false)
        SwitchRow(stringResource(R.string.notifs_show_this_device_s, name), pluralStringResource(R.plurals.notifs_sent, core.notifs.sent, core.notifs.sent), core.sync.get("notifs", "out"), first = true) { core.sync.set("notifs", "out", it) }
        SwitchRow(stringResource(R.string.notifs_hide_the_message_text), stringResource(R.string.notifs_only_the_app_and, name), core.store.flag("notifs.hideText", false)) { core.store.setFlag("notifs.hideText", it); core.changed() }
        if (core.notifs.supported && !core.notifs.hasAccess) MacRow(stringResource(R.string.notifs_notification_access), stringResource(R.string.notifs_needed_to_read_them)) { Primary(stringResource(R.string.common_allow)) { ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) } }
        if (!core.notifs.supported && !core.adb.paired) MacRow(stringResource(R.string.sc_adb_short), stringResource(R.string.notifs_set_it_up_first, name)) { Primary(stringResource(R.string.common_guide)) { Guide.open.value = true } }
    }
    MacCard {
        DirHead(name, false, me, true)
        SwitchRow(stringResource(R.string.notifs_show_s_notifications_here, name), pluralStringResource(R.plurals.notifs_shown, core.notifs.shown, core.notifs.shown), core.sync.get("notifs", "in"), first = true) { core.sync.set("notifs", "in", it) }
    }
}

// ---- Files ----

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun FilesPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val host = core.host
    val ctx = LocalContext.current
    val name = them(core)
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris -> if (uris.isNotEmpty()) core.files.send(core.files.describe(uris), "send") }
    val pickCopy = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris -> if (uris.isNotEmpty()) core.fclip.copy(core.files.describe(uris)) }
    PageHead(stringResource(R.string.nav_files), stringResource(R.string.desc_files))
    if (host == null) return NotConnected(core, v)

    core.fclip.incoming?.let { o ->
        MacCard(stringResource(R.string.files_copied_on, name)) {
            MacRow(if (o.names.size == 1) o.names[0] else pluralStringResource(R.plurals.files_items, o.names.size, o.names.size), FileClip.size(o.bytes), first = true) {
                Primary(stringResource(R.string.common_copy)) { core.fclip.fetch(o.id, save = false) }
                Secondary(stringResource(R.string.common_save)) { core.fclip.fetch(o.id, save = true) }
            }
        }
    }

    MacCard(stringResource(R.string.files_send_to, name)) {
        MacRow(stringResource(R.string.files_send_files), stringResource(R.string.files_they_land_in_s, name), first = true) { Primary(stringResource(R.string.common_choose)) { pick.launch("*/*") } }
        MacRow(stringResource(R.string.files_copy_files), stringResource(R.string.files_paste_them_on_with, name)) { Secondary(stringResource(R.string.common_choose)) { pickCopy.launch("*/*") } }
        // Drag files here from another app (split screen or a floating window).
        var over by remember { mutableStateOf(false) }
        val target = remember {
            object : DragAndDropTarget {
                override fun onEntered(event: DragAndDropEvent) { over = true }
                override fun onExited(event: DragAndDropEvent) { over = false }
                override fun onEnded(event: DragAndDropEvent) { over = false }
                override fun onDrop(event: DragAndDropEvent): Boolean {
                    over = false
                    val e = event.toAndroidDragEvent()
                    (ctx as? android.app.Activity)?.requestDragAndDropPermissions(e)
                    val clip = e.clipData ?: return false
                    val uris = (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
                    if (uris.isNotEmpty()) core.bg.execute { core.files.send(core.files.describe(uris), "send") }
                    else clip.getItemAt(0)?.text?.toString()?.let { core.clip.sendText(it) }
                    return true
                }
            }
        }
        Box(
            Modifier.padding(16.dp).fillMaxWidth().height(100.dp).clip(RoundedCornerShape(20.dp))
                .border(if (over) 2.dp else 1.dp, if (over) pal.accent else pal.line2, RoundedCornerShape(20.dp))
                .background(if (over) pal.accentSoft else Color.Transparent)
                .dragAndDropTarget(shouldStartDragAndDrop = { ev -> ev.mimeTypes().isNotEmpty() }, target = target),
            contentAlignment = Alignment.Center,
        ) { Text(if (over) stringResource(R.string.files_drop_to_send_to, name) else stringResource(R.string.files_drag_files_here_to, name), color = pal.muted) }
    }
    MacCard(stringResource(R.string.clip_from, name)) {
        MacRow(stringResource(R.string.files_drag_across_the_edge), stringResource(R.string.files_files_dragged_onto_this), first = true)
        MacRow(stringResource(R.string.files_c_on, name), stringResource(R.string.files_this_device_offers_to))
        MacRow(stringResource(R.string.files_drop_on_the_phone), stringResource(R.string.files_files_dropped_on_this, name))
    }

    val moving = core.files.sending.map { stringResource(R.string.files_sending, it.name) to Files.pct(it.sent, it.bytes) } +
        core.files.receiving.map { pluralStringResource(R.plurals.files_receiving, it.count, it.count) to Files.pct(it.got, it.bytes) }
    if (moving.isNotEmpty() || core.fclip.status.isNotEmpty()) MacCard(stringResource(R.string.btpad_now)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((label, pct) in moving) {
                Text("$label · $pct%", color = pal.text)
                LinearProgressIndicator(progress = { pct / 100f }, modifier = Modifier.fillMaxWidth(), color = pal.accent, trackColor = pal.trackOff)
            }
            if (core.fclip.status.isNotEmpty()) Text(core.fclip.status, color = pal.muted)
        }
    }
    if (core.files.recent.isNotEmpty()) MacCard(stringResource(R.string.clip_recent)) {
        core.files.recent.take(10).forEachIndexed { i, r -> MacRow(r, "", first = i == 0) }
        MacRow(stringResource(R.string.files_downloads), "") { Secondary(stringResource(R.string.common_show)) { ctx.startActivity(Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
    }
}

// ---- Sound ----

@Composable
private fun SoundPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val name = them(core)
    val me = core.store.deviceName
    PageHead(stringResource(R.string.nav_sound), stringResource(R.string.desc_sound))
    if (core.host == null) NotConnected(core, v)
    else WifiGate(core, stringResource(R.string.nav_sound))
    MacCard {
        DirHead(name, false, me, true)
        SwitchRow(stringResource(R.string.sound_play_s_sound_here, name), if (core.macSound.playing) stringResource(R.string.sound_playing) else "", core.sync.get("audio", "in"), first = true) { core.sync.set("audio", "in", it) }
    }
    MacCard {
        DirHead(me, true, name, false)
        SwitchRow(stringResource(R.string.sound_play_this_device_s, name), soundHint(core), core.sync.get("audio", "out"), first = true) { core.sync.set("audio", "out", it) }
        SoundStart(core)
    }
    Note(stringResource(R.string.sound_sound_that_comes_with))
}

// This device's sound there: through wireless debugging, else captured here (Sound.kt).
@Composable
private fun soundHint(core: Core) = when {
    core.sound.on -> stringResource(R.string.sound_playing_there_captured_here)
    core.sound.error.isNotEmpty() -> core.sound.error
    else -> stringResource(R.string.sound_through_wireless_debugging_else)
}

// The computer is waiting for the capture: Start here, as in the notification.
@Composable
private fun SoundStart(core: Core) {
    val ctx = LocalContext.current
    if (core.sound.wanted && !core.sound.on) MacRow(stringResource(R.string.sound_start_the_sound), stringResource(R.string.sound_android_asks_to_allow)) { Primary(stringResource(R.string.common_start)) { core.sound.start(ctx) } }
    else if (core.sound.on) MacRow(stringResource(R.string.sound_captured_sound), stringResource(R.string.sound_plays_here_too_only)) { Secondary(stringResource(R.string.common_stop)) { core.sound.stop() } }
}

// ---- General ----

@Composable
private fun GeneralPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    val ctx = LocalContext.current
    val name = them(core)
    var dev by remember { mutableStateOf(core.store.deviceName) }
    PageHead(stringResource(R.string.nav_general), "")
    MacCard(stringResource(R.string.gen_this_device)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.gen_name), color = pal.text, fontSize = 15.sp)
            Text(stringResource(R.string.gen_what_your_computers_call), color = pal.muted, fontSize = 12.5.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(dev, { dev = it }, singleLine = true, modifier = Modifier.weight(1f),
                    textStyle = LocalTextStyle.current.copy(fontSize = 15.sp, color = pal.text), shape = RoundedCornerShape(14.dp))
                Secondary(stringResource(R.string.common_save)) { core.store.setDeviceName(dev); core.changed() }
            }
        }
    }
    MacCard(stringResource(R.string.gen_language)) {
        val cur = Lang.current(ctx)
        for ((i, tag) in Lang.tags.withIndex()) {
            val label = when (tag) { "" -> stringResource(R.string.gen_language_auto); "pt-BR" -> "Português"; else -> "English" }
            MacRow(label, if (tag.isEmpty()) stringResource(R.string.gen_language_auto_hint) else "", i == 0,
                onClick = { if (cur != tag) (ctx as? android.app.Activity)?.let { Lang.set(it, tag) } }) {
                if (cur == tag) Pill("✓", "good")
            }
        }
    }
    val pm = ctx.getSystemService(PowerManager::class.java)
    @Composable
    fun Setup(label: String, hint: String, done: Boolean, action: String, first: Boolean = false, onClick: () -> Unit) =
        MacRow(label, hint, first) { if (done) Pill(stringResource(R.string.common_allowed), "good") else Primary(action, onClick) }
    // Bluetooth and Wi-Fi Direct, for a computer not on this network.
    val nearbyPerms = (Ble.permissions() + BleServe.permissions() + Direct.permission()).distinct().toTypedArray()
    val nearbyAllowed = nearbyPerms.all { ctx.checkSelfPermission(it) == android.content.pm.PackageManager.PERMISSION_GRANTED }
    val askNearby = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions(),
    ) { core.changed() }
    val askNotify = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { core.changed() }
    // Every permission and feature in one place: each is asked for only when switched on elsewhere,
    // or here.
    MacCard(stringResource(R.string.common_allow)) {
        if (Build.VERSION.SDK_INT >= 33) Setup(stringResource(R.string.nav_notifications), stringResource(R.string.gen_files_arriving_invites_from, name),
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED, stringResource(R.string.common_allow)) {
            askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        // Calls, Messages, Photos and Files on $name (Hub): what each needs, asked here too.
        for ((what, hint) in listOf(
            "calls" to stringResource(R.string.ov_answer_and_make_calls, name),
            "messages" to stringResource(R.string.ov_read_and_send_texts, name),
            "media" to stringResource(R.string.gen_your_photos_and_videos, name),
            "files" to stringResource(R.string.gen_this_device_s_storage, name),
        )) {
            val perm = core.hub.perm(what)
            val lbl = stringResource(Hub.labelRes(what))
            if (perm == "none") MacRow(lbl, if (what == "files") stringResource(R.string.ov_needs_android_11_or) else stringResource(R.string.gen_needs_duodesk_with_notifications, name))
            else Setup(lbl, if (perm == "partial") stringResource(R.string.gen_some_access_is_missing, hint) else hint, perm == "ok", stringResource(R.string.common_allow)) { core.hub.askHere(what) }
        }
        if (core.notifs.supported) Setup(stringResource(R.string.notifs_notification_access), stringResource(R.string.gen_to_show_this_device, name), core.notifs.hasAccess, stringResource(R.string.common_allow)) {
            ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        } else MacRow(stringResource(R.string.notifs_notification_access), stringResource(R.string.gen_comes_with_duodesk_with, name))
        Setup(stringResource(R.string.gen_run_in_the_background), stringResource(R.string.gen_so_can_reach_this, name), pm.isIgnoringBatteryOptimizations(ctx.packageName), stringResource(R.string.common_allow)) {
            @Suppress("BatteryLife")
            ctx.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}")))
        }
        MacRow(
            stringResource(R.string.sc_adb_short),
            when {
                core.adb.paired -> stringResource(R.string.gen_paired_with_this_screen, name)
                core.link.ble -> stringResource(R.string.gen_only_available_over_wi)
                core.adb.wifiDebugging && !core.adb.setupNeeded -> stringResource(R.string.gen_paired_with_reconnecting, name)
                core.adb.wifiDebugging -> stringResource(R.string.gen_on_pair_it_with, name)
                else -> stringResource(R.string.gen_for_this_screen_and, name)
            },
        ) {
            if (core.adb.paired) Pill(stringResource(R.string.common_paired), "good")
            else if (core.link.ble) Pill(stringResource(R.string.gen_wi_fi_only), "muted")
            else {
                if (!core.adb.wifiDebugging) Secondary(stringResource(R.string.common_turn_on)) { core.adb.turnOn() }
                Primary(stringResource(R.string.common_guide)) { Guide.open.value = true }
            }
        }
        // Off until switched on (Adb.autoOffEnabled): only what TwinDesk switched on goes off again.
        SwitchRow(
            stringResource(R.string.gen_turn_off_wireless_debugging),
            when {
                !core.adb.canEnable -> stringResource(R.string.gen_once_paired_with_off, name)
                core.adb.autoOffEnabled -> stringResource(R.string.gen_2_minutes_after_disconnects, name)
                else -> stringResource(R.string.gen_wireless_debugging_stays_on, name)
            },
            core.adb.autoOffEnabled, enabled = core.adb.canEnable,
        ) { core.adb.setAutoOff(it) }
        Setup(stringResource(R.string.gen_nearby_devices), stringResource(R.string.gen_bluetooth_and_wi_fi, name), nearbyAllowed, stringResource(R.string.common_allow)) {
            askNearby.launch(nearbyPerms)
        }
        if (core.input.supported) Setup(stringResource(R.string.ov_mouse_and_keyboard), stringResource(R.string.gen_accessibility_s_cursor_on, name), core.input.on, stringResource(R.string.common_allow)) { core.input.openSettings() }
        else MacRow(stringResource(R.string.ov_mouse_and_keyboard), stringResource(R.string.gen_through_wireless_debugging_without, name))
        Setup(stringResource(R.string.gen_show_the_pointer), stringResource(R.string.gen_draws_s_pointer_over, name), core.pointer.allowed, stringResource(R.string.common_allow)) {
            ctx.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${ctx.packageName}")))
        }
        if (Build.VERSION.SDK_INT >= 30) Setup(stringResource(R.string.gen_all_files_access), stringResource(R.string.gen_your_wallpaper_on_files, name), android.os.Environment.isExternalStorageManager(), stringResource(R.string.common_allow)) {
            ctx.startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${ctx.packageName}")))
        }
    }
    MacCard(stringResource(R.string.cursor_not_on_the_same)) {
        BleSwitch(core, stringResource(R.string.gen_allow_nearby_devices_above), first = true)
        SwitchRow(stringResource(R.string.gen_turn_off_bluetooth_on), if (core.bleWifiOff) stringResource(R.string.gen_on_the_same_wi, name)
            else stringResource(R.string.gen_bluetooth_stays_on_beside), core.bleWifiOff) { core.store.setFlag("bleWifiOff", it); core.changed() }
        val n = core.net
        if (n.state != "idle") MacRow("Wi-Fi", when (n.state) {
            "asking", "hosting" -> stringResource(R.string.gen_starting_a_direct_wi)
            "joining" -> stringResource(R.string.gen_joining_s_wi_fi, name)
            "joined" -> stringResource(R.string.gen_on_a_direct_wi, name)
            "failed" -> n.error
            else -> ""
        })
    }
    if (core.hosts().isNotEmpty()) MacCard(stringResource(R.string.common_paired)) {
        core.hosts().forEachIndexed { i, h ->
            MacRow(h.name, if (core.host?.id == h.id) (if (core.link.wired) stringResource(R.string.gen_connected_over_usb) else if (core.link.ble) stringResource(R.string.gen_connected_over_bluetooth) else stringResource(R.string.pair_connected)) else stringResource(R.string.gen_last_address, h.address), first = i == 0) {
                if (core.host?.id == h.id) Pill(stringResource(R.string.gen_online), "good")
                TextButton(onClick = { core.forget(h.id) }) { Text(stringResource(R.string.pair_forget), color = pal.bad) }
            }
        }
    }
}

// ---- About ----

@Composable
private fun AboutPage(core: Core, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v // redraw on every Core change (Compose skips unread parameters)
    Column(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Logo(110)
        Text(stringResource(R.string.app_name), fontSize = 32.sp, fontWeight = FontWeight.Light, letterSpacing = (-0.8).sp, color = pal.text, modifier = Modifier.padding(top = 10.dp))
        Text(stringResource(R.string.about_version, BuildConfig.VERSION_NAME), color = pal.muted)
        Text(stringResource(R.string.about_tagline), color = pal.muted, modifier = Modifier.padding(top = 6.dp, bottom = 20.dp))
    }
    val ctx = LocalContext.current
    val open = { url: String -> ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    val u = core.updates
    MacCard(stringResource(R.string.about_card_updates)) {
        MacRow(
            "DuoDesk",
            when {
                u.checking -> stringResource(R.string.about_checking)
                u.error.isNotEmpty() -> stringResource(R.string.about_couldn_t_check, u.error)
                u.available -> stringResource(R.string.about_update_available, u.latest, u.current) + " " + (u.download?.let { stringResource(R.string.about_download_file, it.name) } ?: stringResource(R.string.about_opens_release_page))
                u.noReleases -> stringResource(R.string.about_version_no_releases_published, u.current)
                u.checkedAt > 0 -> stringResource(R.string.about_up_to_date, java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(java.util.Date(u.checkedAt)))
                else -> stringResource(R.string.about_version, u.current)
            },
            first = true,
        ) {
            if (u.available) Primary(stringResource(R.string.common_download)) { u.open() }
            if (!u.checking) Secondary(stringResource(R.string.about_check_now)) { u.checkNow() }
        }
        SwitchRow(stringResource(R.string.about_check_automatically), stringResource(R.string.about_looks_for_new_releases), u.auto) { u.auto = it }
    }
    MacCard(stringResource(R.string.about_card_made_by)) {
        MacRow("0xCodez", "github.com/0xCodez", first = true) { Secondary(stringResource(R.string.about_profile)) { open("https://github.com/0xCodez") } }
        MacRow(stringResource(R.string.about_website), "getduodesk.vercel.app") { Secondary(stringResource(R.string.common_open)) { open("https://getduodesk.vercel.app") } }
        MacRow(stringResource(R.string.about_source_code), "github.com/0xCodez/DuoDesk") { Secondary("GitHub") { open("https://github.com/0xCodez/DuoDesk") } }
        MacRow(stringResource(R.string.about_releases), stringResource(R.string.about_new_versions_for_every)) { Secondary(stringResource(R.string.common_open)) { open(Updates.RELEASES) } }
        MacRow(stringResource(R.string.about_report_a_problem), stringResource(R.string.about_open_an_issue_on)) { Secondary(stringResource(R.string.about_issues)) { open("https://github.com/0xCodez/DuoDesk/issues") } }
    }
    MacCard(stringResource(R.string.about_card_license)) {
        MacRow(stringResource(R.string.about_gnu_general_public_license), stringResource(R.string.about_free_and_open_source), first = true) {
            Secondary(stringResource(R.string.about_read)) { open("https://github.com/0xCodez/DuoDesk/blob/main/LICENSE") }
        }
        MacRow(stringResource(R.string.about_original_source), stringResource(R.string.about_the_gpl_3_0)) { Secondary(stringResource(R.string.common_open)) { open("https://github.com/InukaAsith/TwinDesk") } }
        MacRow(stringResource(R.string.about_screen_input_and_sound), "scrcpy-server (Apache-2.0)")
        MacRow(stringResource(R.string.about_network), "OkHttp (Apache-2.0)")
        MacRow(stringResource(R.string.about_fonts), "Geist and Geist Mono (SIL OFL 1.1)")
    }
}
