// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The wireless debugging guide, on first launch (after setup) and from General › Setup: the steps
// to let the computer show this screen and use its mouse and keyboard here, each ticked off as
// it happens. The pairing code is typed in TwinDesk's notification (Settings' code dialog closes if
// you switch apps), or here when Settings is side by side; the phone sends it to the computer,
// which pairs (adb.pair), and says how it went (adb.bridge).
package com.twindesk.android

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Open from anywhere (General › Setup, the Cursor page): App shows the guide while this is true.
object Guide {
    val open = mutableStateOf(false)

    // First launch: once a computer is paired (the guide needs it), until done or skipped.
    fun firstTime(core: Core) = !core.store.flag("guide.seen", false) && !core.adb.paired && core.hosts().isNotEmpty()

    fun close(core: Core) {
        core.store.setFlag("guide.seen", true)
        open.value = false
        core.changed()
    }
}

private val xiaomi = Build.MANUFACTURER.equals("Xiaomi", true) || Build.BRAND.equals("POCO", true) || Build.BRAND.equals("Redmi", true)

@Composable
fun WirelessGuide(core: Core, ctx: Context, v: Int) {
    @Suppress("UNUSED_EXPRESSION") v
    val a = core.adb
    val name = core.host?.name ?: core.hosts().firstOrNull()?.name ?: "your computer"
    val connected = core.host != null

    Box(Modifier.fillMaxSize().background(pal.content).safeDrawingPadding(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Tile(Ico.display, listOf(Color(0xFF5AC8FA), Color(0xFF0A84FF)), 44)
                Column(Modifier.padding(start = 14.dp)) {
                    Text("Wireless debugging", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = pal.text)
                    Text("Once, so $name can show this screen and use its mouse and keyboard here", color = pal.muted, fontSize = 13.5.sp)
                }
            }
            Spacer(Modifier.height(20.dp))
            if (a.paired) Note("Done: $name is paired with this device’s wireless debugging.", "info")

            MacCard {
                Step(1, "Connect to $name", if (connected) "Connected" else "Open TwinDesk on $name, then tap Connect on Overview (or Pair if it’s new).", connected, first = true) {
                    if (!connected) core.hosts().firstOrNull()?.let { h -> Secondary("Connect") { core.connect(h) } }
                }
                Step(
                    2, "Turn on Developer options",
                    if (a.devOptions) "On" else if (xiaomi) "Settings › About phone › tap “MIUI version” (or “OS version”) 7 times." else "Settings › About phone › tap “Build number” 7 times.",
                    a.devOptions,
                ) { if (!a.devOptions) Secondary("About phone") { ctx.startActivity(Intent(Settings.ACTION_DEVICE_INFO_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
                if (xiaomi) Step(
                    3, "Allow it on Xiaomi phones",
                    "In Developer options: turn on “USB debugging (Security settings)” and “Install via USB”. Without them $name can’t use the mouse and keyboard here.",
                    false, optional = true,
                ) { Secondary("Open") { a.openSettings() } }
                val n = if (xiaomi) 4 else 3
                Step(n, "Turn on Wireless debugging", if (a.wifiDebugging) "On" else "Developer options › Wireless debugging: on (allow on this network).", a.wifiDebugging) {
                    if (!a.wifiDebugging) Secondary("Open") { a.turnOn() }
                }
                Step(
                    n + 1, "Pair with $name",
                    when {
                        a.paired -> "Paired"
                        a.pairing -> "Pairing…"
                        else -> "Tap Wireless debugging › “Pair device with pairing code”. TwinDesk’s notification asks for the 6-digit code: type it there."
                    },
                    a.paired,
                ) {
                    if (!a.paired) Primary("Pair") { a.askForCode(); a.openSettings() }
                }
                if (!a.paired && a.bridgeMessage.isNotEmpty() && a.bridge == "needsPair") Row(Modifier.padding(start = 58.dp, end = 16.dp, bottom = 12.dp)) {
                    Text(a.bridgeMessage, color = pal.muted, fontSize = 12.5.sp)
                }
            }

            // Settings side by side (tablets, split screen): type the code here instead.
            if (!a.paired && connected) MacCard("Or type the code here") {
                var code by remember { mutableStateOf("") }
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        code, { code = it.filter { c -> c.isDigit() }.take(6) }, placeholder = { Text("123456", color = pal.faint) }, singleLine = true,
                        modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp),
                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 18.sp, color = pal.text, letterSpacing = 3.sp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    )
                    Primary("Pair") { a.askForCode(); a.sendPairCode(code) }
                }
                Text("With Settings open next to TwinDesk (split screen), the code dialog stays open while you type here.", color = pal.muted, fontSize = 12.5.sp, modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 14.dp))
            }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { Guide.close(core) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = pal.accent, contentColor = Color.White),
            ) { Text(if (a.paired) "Done" else "Skip for now", modifier = Modifier.padding(vertical = 4.dp)) }
            if (!a.paired) Text(
                "Files, the clipboard and notifications work without it. You can come back here from General › Setup.",
                color = pal.faint, fontSize = 12.5.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        }
    }
}

// One numbered step, ticked when done (like the Mac's setup rows).
@Composable
private fun Step(n: Int, title: String, hint: String, done: Boolean, first: Boolean = false, optional: Boolean = false, action: @Composable () -> Unit) {
    Column {
        if (!first) Box(Modifier.padding(start = 58.dp).fillMaxWidth().height(1.dp).background(pal.line))
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(30.dp).clip(CircleShape).background(if (done) pal.good else if (optional) pal.trackOff else pal.accentSoft),
                contentAlignment = Alignment.Center,
            ) { Text(if (done) "✓" else "$n", color = if (done) Color.White else pal.accent, fontWeight = FontWeight.Bold) }
            Column(Modifier.weight(1f).padding(start = 12.dp, end = 10.dp)) {
                Text(title + if (optional) " (if asked)" else "", color = pal.text, fontSize = 15.sp)
                Text(hint, color = pal.muted, fontSize = 12.5.sp)
            }
            if (!done) action()
        }
    }
}

@Composable
private fun Primary(label: String, onClick: () -> Unit) = Button(onClick = onClick, colors = ButtonDefaults.buttonColors(containerColor = pal.accent, contentColor = Color.White), shape = RoundedCornerShape(8.dp)) { Text(label) }

@Composable
private fun Secondary(label: String, onClick: () -> Unit) = OutlinedButton(onClick = onClick, shape = RoundedCornerShape(8.dp)) { Text(label, color = pal.text) }
