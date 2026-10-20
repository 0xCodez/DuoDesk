// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Calls, Messages, Photos and Files on the computer (shared/phonehub.js there). Each is off until it is
// switched on (its page on the computer, or Overview here), and while it's off nothing of it runs:
// no receiver, no observer, no thread, and the classes that do the work (Calls.kt, Messages.kt,
// Media.kt, FsBrowse.kt) aren't even made. Switched off, or the session gone: all of it stops at once.
// What each needs is asked for when it's switched on (here, or Allow at the top of its page on
// the computer), never in Setup.
package com.twindesk.android

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Process
import android.provider.Settings
import android.util.Log
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.concurrent.thread

class Hub(core: Core) : Feature(core) {
    // What the computer has on (hub.policy). Nothing until a computer that knows these says so.
    @Volatile var peer = false; private set
    @Volatile var callsOn = false; private set
    @Volatile var messagesOn = false; private set
    @Volatile var mediaOn = false; private set
    @Volatile var filesOn = false; private set // the computer browses this phone's storage (All files access)
    @Volatile var btAudio = false; private set // the computer takes calls' sound over Bluetooth
    @Volatile private var btAddress = "" // the computer's Bluetooth address (hub.bt)
    private var lastState = ""

    private var calls: Calls? = null
    private var messages: Messages? = null
    private var media: Media? = null
    private var fs: FsBrowse? = null

    // One background thread for the three's queries: made when one is first used, gone when all are off.
    private var io: ExecutorService? = null

    fun on(what: String) = when (what) { "calls" -> callsOn; "messages" -> messagesOn; "media" -> mediaOn; "files" -> filesOn; else -> false }

    fun run(block: () -> Unit) {
        val e = synchronized(this) {
            io ?: Executors.newSingleThreadExecutor { r ->
                Thread({ Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND); r.run() }, "td-hub").apply { isDaemon = true }
            }.also { io = it }
        }
        runCatching { e.execute { runCatching(block).onFailure { Log.e("TwinDesk", "hub", it) } } }
    }

    // A new session, or none: all off until the computer says (hub.policy).
    private fun reset() {
        peer = false
        callsOn = false; messagesOn = false; mediaOn = false; filesOn = false; btAudio = false
        btAddress = ""
        lastState = ""
        apply()
    }

    override fun onWelcome(host: Host) = reset()

    override fun onClosed() = reset()

    override fun onMessage(t: String, m: JSONObject): Boolean {
        when (t) {
            Proto.T.HUB_POLICY -> {
                peer = true
                callsOn = m.optBoolean("calls")
                messagesOn = m.optBoolean("messages")
                mediaOn = m.optBoolean("media")
                filesOn = m.optBoolean("files")
                btAudio = m.optBoolean("bt")
                apply()
                lastState = ""
                sendState()
                core.changed()
            }
            Proto.T.HUB_ASK -> ask(m.str("what", 20))
            Proto.T.HUB_BT -> {
                m.str("address", 17).uppercase().let { if (it.isNotEmpty()) btAddress = it }
                if (m.optBoolean("unpair")) core.bg.execute { unpairBt() }
                else if (m.optBoolean("bond")) bond()
                sendState()
            }
            Proto.T.CALL_DO -> calls?.act(m) ?: core.send(msg(Proto.T.CALL_DONE, "a" to m.str("a", 20), "ok" to false, "error" to "off"))
            Proto.T.CALL_LOG -> calls?.let { c -> run { core.send(msg(Proto.T.CALL_LOG, "items" to c.log(m.optInt("n", 100)))) } }
            Proto.T.CONTACTS -> calls?.let { c -> val q = m.str("q", 80); run { core.send(msg(Proto.T.CONTACTS, "q" to q, "items" to c.contacts(q))) } }
            Proto.T.SMS_THREADS -> messages?.let { s -> run { core.send(msg(Proto.T.SMS_THREADS, "items" to s.threads(m.optInt("n", 60)))) } }
            Proto.T.SMS_THREAD -> messages?.let { s -> run { core.send(s.thread(m)) } }
            Proto.T.SMS_PART -> messages?.let { s -> val id = m.str("id", 40); run { core.send(msg(Proto.T.SMS_PART, "id" to id, "data" to s.part(id))) } }
            Proto.T.SMS_SEND -> messages?.send(m) ?: core.send(msg(Proto.T.SMS_SENT, "ref" to m.str("ref", 60), "ok" to false, "error" to "off"))
            // Pictures never go through Bluetooth (they held up everything else): USB, Wi-Fi, Wi-Fi Direct.
            Proto.T.MEDIA_LIST -> if (mediaOn && !core.link.ble) media().let { md -> run { core.send(md.list(m)) } }
            Proto.T.MEDIA_THUMB -> if (mediaOn && !core.link.ble) media().thumbs(m.optJSONArray("ids"))
            Proto.T.MEDIA_VIEW -> if (mediaOn && !core.link.ble) media().let { md -> val id = m.str("id", 40); run { core.send(msg(Proto.T.MEDIA_VIEW, "id" to id, "data" to md.view(id))) } }
            Proto.T.MEDIA_SAVE -> if (mediaOn) media().let { md -> val ids = m.optJSONArray("ids"); run { md.save(ids) } }
            Proto.T.FS_LIST -> if (filesOn) fs().let { f -> run { core.send(f.list(m)) } }
            Proto.T.FS_DO -> if (filesOn) fs().let { f -> run { core.send(f.act(m)) } }
            Proto.T.FS_SAVE -> if (filesOn) fs().let { f -> val paths = m.optJSONArray("paths"); run { f.save(paths) } }
            Proto.T.FS_EXPECT -> if (filesOn) fs().expect(m.str("batch", 64), m.str("path", 1000))
            else -> return false
        }
        return true
    }

    private fun media(): Media = media ?: Media(this, core).also { media = it }

    private fun fs(): FsBrowse = fs ?: FsBrowse(core).also { fs = it }

    // Starts what's on (with what it needs allowed) and stops what's off. Called again when
    // permissions change: start() does nothing when already running.
    private fun apply() {
        val live = core.link.connected && peer
        if (live && callsOn) (calls ?: Calls(this, core).also { calls = it }).start() else { calls?.stop(); calls = null }
        if (live && messagesOn) (messages ?: Messages(this, core).also { messages = it }).start() else { messages?.stop(); messages = null }
        if (!(live && mediaOn)) { media?.stop(); media = null }
        if (!(live && filesOn)) fs = null
        if (!(live && (callsOn || messagesOn || mediaOn || filesOn))) synchronized(this) { io?.shutdownNow(); io = null }
    }

    // The person switched one here: the computer follows (it keeps the setting).
    fun set(what: String, on: Boolean) {
        when (what) { "calls" -> callsOn = on; "messages" -> messagesOn = on; "media" -> mediaOn = on; "files" -> filesOn = on; else -> return }
        apply()
        core.send(msg(Proto.T.HUB_SET, "what" to what, "on" to on))
        sendState()
        core.changed()
    }

    // Back from the permission prompt or Settings: start what can start now, and tell the computer.
    fun permsChanged() {
        if (!peer) return
        if (bondWanted && (Build.VERSION.SDK_INT < 31 || granted(Manifest.permission.BLUETOOTH_CONNECT))) bond() // Pair, waiting for Nearby devices
        apply()
        sendState()
        core.changed()
    }

    fun sendState() {
        if (!peer || !core.link.connected) return
        val st = msg(
            Proto.T.HUB_STATE,
            "calls" to JSONObject().put("perm", perm("calls")).put("missing", jsonArray(missing("calls"))),
            "messages" to JSONObject().put("perm", perm("messages")).put("missing", jsonArray(missing("messages"))),
            "media" to JSONObject().put("perm", perm("media")),
            "files" to JSONObject().put("perm", perm("files")),
            "bt" to if (callsOn) bt() else JSONObject(),
            "opens" to Settings.canDrawOverlays(core.ctx), // Allow on the computer opens the prompt here (else a notification)
        )
        val key = st.toString()
        if (key == lastState) return
        lastState = key
        core.send(st)
        core.changed() // the app's pages show the same (pairing for calls' sound)
    }

    fun granted(p: String) = core.ctx.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED

    // In this build at all (the SMS permissions are only in TwinDesk with notifications).
    private val declared: Set<String> by lazy {
        runCatching {
            core.ctx.packageManager.getPackageInfo(core.ctx.packageName, PackageManager.GET_PERMISSIONS).requestedPermissions?.toSet()
        }.getOrNull() ?: emptySet()
    }

    // 'ok' | 'partial' (works, with something missing) | 'ask' | 'none' (not in this build).
    fun perm(what: String): String {
        val want = wanted(what)
        if (what == "messages" && Manifest.permission.READ_SMS !in declared) return "none"
        if (what == "media" && Build.VERSION.SDK_INT >= 30 && Environment.isExternalStorageManager()) return "ok"
        if (what == "files") return if (Build.VERSION.SDK_INT < 30) "none" else if (FsBrowse.allowed()) "ok" else "ask"
        val have = want.filter { granted(it) }
        return when {
            have.size == want.size -> "ok"
            what == "media" && Build.VERSION.SDK_INT >= 34 && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) -> "partial"
            granted(main(what)) -> "partial"
            else -> "ask"
        }
    }

    // What's missing, by what it does: state, numbers, dial, answer, contacts; read, send.
    fun missing(what: String): List<String> = wanted(what).filter { !granted(it) }.map {
        when (it) {
            Manifest.permission.READ_PHONE_STATE -> "state"
            Manifest.permission.READ_CALL_LOG -> "numbers"
            Manifest.permission.CALL_PHONE -> "dial"
            Manifest.permission.ANSWER_PHONE_CALLS -> "answer"
            Manifest.permission.READ_CONTACTS -> "contacts"
            Manifest.permission.READ_SMS -> "read"
            Manifest.permission.SEND_SMS -> "send"
            else -> "media"
        }
    }

    // The person on the phone is asked (the computer's Allow): the prompt opens straight away when
    // Android lets us (display over other apps, or TwinDesk on screen), else a notification.
    private fun ask(what: String) {
        if (what !in listOf("calls", "messages", "media", "files", "bt")) return
        val i = Intent(core.ctx, PermActivity::class.java).putExtra("what", what).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Settings.canDrawOverlays(core.ctx) || MainActivity.shown) runCatching { core.ctx.startActivity(i) }
        else Notify.hubAsk(core.ctx, what, core.host?.name ?: "Your computer")
    }

    // ---- Bluetooth: calls' sound on the computer needs this phone paired with it ----
    // Over classic Bluetooth (BR/EDR): hands-free runs only there. A plain createBond() picks
    // Bluetooth LE for a computer this phone knows from TwinDesk's own LE link, and the result is
    // a pairing the phone counts as done and the computer can't use for calls (le below).

    @Volatile private var bonding = false
    @Volatile private var bondFailed = false
    @Volatile private var bondWanted = false // asked to pair before Nearby devices was allowed
    @Volatile private var forget = false // the old pairing has to be forgotten in Settings first

    // For the app's Calls page: the pairing as the computer sees it (bt()), and Pair from here.
    val btKnown get() = btAddress.isNotEmpty()
    fun btState(): JSONObject = bt()
    fun pairBt() { core.bg.execute { bond(); core.changed() } }

    // The app's own pages: ask here (the prompt, or All files access in Settings).
    fun askHere(what: String) = runCatching {
        core.ctx.startActivity(Intent(core.ctx, PermActivity::class.java).putExtra("what", what).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @SuppressLint("MissingPermission")
    private fun bt(): JSONObject {
        val o = JSONObject()
        if (Build.VERSION.SDK_INT >= 31 && !granted(Manifest.permission.BLUETOOTH_CONNECT)) return o.put("allowed", false)
        val a = core.ctx.getSystemService(BluetoothManager::class.java)?.adapter ?: return o.put("none", true)
        o.put("allowed", true).put("radio", a.isEnabled).put("name", runCatching { a.name }.getOrNull() ?: "")
            .put("bonding", bonding).put("failed", bondFailed).put("forget", forget)
        if (btAddress.isNotEmpty()) {
            val d = runCatching { a.bondedDevices.find { it.address.equals(btAddress, true) } }.getOrNull()
            val le = d != null && runCatching { d.type == BluetoothDevice.DEVICE_TYPE_LE }.getOrDefault(false)
            o.put("bonded", d != null && !le).put("le", le)
        }
        return o
    }

    // Pair with the computer from here over classic Bluetooth (it asks to confirm on both). The
    // computer asks only when it doesn't see this phone as a hands-free phone, so a pairing already
    // there (LE only, or one the computer forgot) is dropped and made again. Listens only while pairing.
    @SuppressLint("MissingPermission")
    private fun bond() {
        if (btAddress.isEmpty()) return
        if (Build.VERSION.SDK_INT >= 31 && !granted(Manifest.permission.BLUETOOTH_CONNECT)) { bondWanted = true; ask("bt"); return }
        bondWanted = false
        forget = false
        val a = core.ctx.getSystemService(BluetoothManager::class.java)?.adapter ?: return
        val d = runCatching { a.getRemoteDevice(btAddress) }.getOrNull() ?: return
        bondFailed = false
        if (d.bondState != BluetoothDevice.BOND_NONE) {
            if (!unbond(d)) {
                // Android keeps that one for itself: the person forgets it in Settings, then Pair again.
                Log.i("TwinDesk", "bt: can't drop the old pairing with $btAddress")
                runCatching { core.ctx.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                bondFailed = true
                forget = true
                sendState()
                return
            }
            // Gone: pair again once Android says so.
            watchBond(d) { if (it == BluetoothDevice.BOND_NONE) { createBredr(d); true } else false }
            return
        }
        createBredr(d)
    }

    // createBond(TRANSPORT_BREDR) isn't public (a system API from Android 12), and plain createBond()
    // pairs over LE with a computer this phone has only seen over LE (TwinDesk's own link): a pairing
    // that can't carry a call, and whose keys break TwinDesk's LE link once one side forgets them.
    // So the computer is reached over classic Bluetooth first (an RFCOMM look-up, which only runs
    // there; nothing has to answer it), after which Android knows it as classic and createBond()
    // pairs there. Still LE only: not paired at all. Off the main thread (the look-up takes seconds).
    @SuppressLint("MissingPermission")
    private fun createBredr(d: BluetoothDevice) {
        bonding = true
        sendState()
        watchBond(d) { s ->
            if (s == BluetoothDevice.BOND_BONDING) return@watchBond false
            bonding = false
            bondFailed = s != BluetoothDevice.BOND_BONDED
            sendState()
            true
        }
        thread(name = "td-bond", isDaemon = true) {
            val ok = runCatching { BluetoothDevice::class.java.getMethod("createBond", Int::class.javaPrimitiveType).invoke(d, BluetoothDevice.TRANSPORT_BREDR) as Boolean }
                .getOrElse {
                    Log.i("TwinDesk", "bt: createBond(BR/EDR): ${it.message}")
                    if (classic(d)) d.createBond() else { Log.i("TwinDesk", "bt: ${d.address} not reachable over classic Bluetooth"); false }
                }
            if (!ok) { bonding = false; bondFailed = true; sendState() }
        }
    }

    // True once Android knows the device over classic Bluetooth (BR/EDR).
    @SuppressLint("MissingPermission")
    private fun classic(d: BluetoothDevice): Boolean {
        val known = { runCatching { d.type == BluetoothDevice.DEVICE_TYPE_CLASSIC || d.type == BluetoothDevice.DEVICE_TYPE_DUAL }.getOrDefault(false) }
        if (known()) return true
        runCatching { core.ctx.getSystemService(BluetoothManager::class.java)?.adapter?.cancelDiscovery() }
        runCatching { d.createInsecureRfcommSocketToServiceRecord(PROBE).use { it.connect() } } // fails: no such service
        return known()
    }

    // The computer's Unpair: this phone forgets it too (when Android lets us).
    @SuppressLint("MissingPermission")
    private fun unpairBt() {
        if (btAddress.isEmpty() || Build.VERSION.SDK_INT >= 31 && !granted(Manifest.permission.BLUETOOTH_CONNECT)) return
        val a = core.ctx.getSystemService(BluetoothManager::class.java)?.adapter ?: return
        val d = runCatching { a.getRemoteDevice(btAddress) }.getOrNull() ?: return
        bondFailed = false
        forget = false
        if (d.bondState != BluetoothDevice.BOND_NONE && !unbond(d)) Log.i("TwinDesk", "bt: can't forget $btAddress here")
        core.bg.schedule({ lastState = ""; sendState() }, 1500, java.util.concurrent.TimeUnit.MILLISECONDS)
    }

    // Android's removeBond isn't public either: true when it took it.
    private fun unbond(d: BluetoothDevice): Boolean =
        runCatching { BluetoothDevice::class.java.getMethod("removeBond").invoke(d) as Boolean }.getOrDefault(false)

    // fn(bond state) for this device until it returns true (or 90 s).
    private fun watchBond(d: BluetoothDevice, fn: (Int) -> Boolean) {
        val r = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                @Suppress("DEPRECATION")
                val dev = i.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                if (dev != null && !dev.address.equals(d.address, true)) return
                if (fn(i.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, -1))) runCatching { core.ctx.unregisterReceiver(this) }
            }
        }
        core.ctx.registerReceiver(r, IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED))
        core.bg.schedule({
            if (runCatching { core.ctx.unregisterReceiver(r) }.isSuccess && bonding) { bonding = false; bondFailed = true; sendState() }
        }, 90, java.util.concurrent.TimeUnit.SECONDS)
    }

    companion object {
        // Looked up over classic Bluetooth only to reach the computer there (classic()): no one serves it.
        private val PROBE: UUID = UUID.fromString("b7f300ff-2c4e-4d1a-9a57-3e8c2f6d0a91")

        // Everything each one uses.
        fun wanted(what: String): List<String> = when (what) {
            "calls" -> listOf(Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG, Manifest.permission.CALL_PHONE,
                Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.READ_CONTACTS)
            "messages" -> listOf(Manifest.permission.READ_SMS, Manifest.permission.SEND_SMS, Manifest.permission.READ_CONTACTS)
            "bt" -> if (Build.VERSION.SDK_INT >= 31) listOf(Manifest.permission.BLUETOOTH_CONNECT) else emptyList()
            "media" -> if (Build.VERSION.SDK_INT >= 33) listOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO)
                else listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
            else -> emptyList()
        }

        // What's asked for (Android 14 adds "only the photos I choose").
        fun request(what: String): List<String> = wanted(what) +
            if (what == "media" && Build.VERSION.SDK_INT >= 34) listOf(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) else emptyList()

        // Without this one it doesn't work at all.
        fun main(what: String): String = when (what) {
            "calls" -> Manifest.permission.READ_PHONE_STATE
            "messages" -> Manifest.permission.READ_SMS
            else -> wanted(what).first()
        }

        fun label(what: String) = when (what) { "calls" -> "Calls"; "messages" -> "Messages"; "files" -> "Files"; "bt" -> "Calls on the computer"; else -> "Photos and videos" }
    }
}

// Invisible: Android's own prompt for what Calls, Messages or Photos need (or Nearby devices, to
// pair for calls' sound; Files: All files access in Settings). Refused for good
// before (Android won't ask again): TwinDesk's page in Settings instead.
class PermActivity : Activity() {
    private var what = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        what = intent.getStringExtra("what") ?: ""
        Notify.cancelHubAsk(this)
        val core = Core.get(this)
        // Files: All files access is a page in Settings, not a prompt (back: MainActivity.onResume).
        if (what == "files") {
            if (!FsBrowse.allowed()) runCatching {
                startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            core.hub.permsChanged()
            finish()
            return
        }
        val want = Hub.request(what).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (what.isEmpty() || want.isEmpty() || core.hub.perm(what) == "none") { core.hub.permsChanged(); finish(); return }
        if (core.store.flag("hub.refused.$what", false) && want.none { shouldShowRequestPermissionRationale(it) }) {
            runCatching {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            finish()
            return
        }
        requestPermissions(want.toTypedArray(), 1)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val core = Core.get(this)
        val refused = permissions.filterIndexed { i, _ -> grantResults.getOrNull(i) != PackageManager.PERMISSION_GRANTED }
        // Only some photos chosen: Android asks again next time (the person may want more).
        val chose = what == "media" && core.hub.perm("media") == "partial"
        core.store.setFlag("hub.refused.$what", !chose && refused.isNotEmpty() && refused.none { shouldShowRequestPermissionRationale(it) })
        core.hub.permsChanged()
        finish()
    }
}
