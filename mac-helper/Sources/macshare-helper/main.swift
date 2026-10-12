// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// macshare-helper: JSON lines on stdin (requests) / stdout (replies + events). Logs go to stderr.
// Request {"id":1,"cmd":"...",...} -> {"id":1,"ok":true,...} | {"id":1,"ok":false,"error":"..."}.
// Requests without "id" get no reply. Events: {"event":"..."}. Exits when stdin closes.
import Cocoa
import IOKit.hid

// One serial queue writes stdout, so lines never interleave.
let writerQueue = DispatchQueue(label: "macshare.writer")

func emit(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj) else {
    log("cannot encode \(obj)")
    return
  }
  writerQueue.async {
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
  }
}

func log(_ s: String) {
  FileHandle.standardError.write(Data("[helper] \(s)\n".utf8))
}

func reply(_ id: Any?, _ fields: [String: Any] = [:]) {
  guard let id = id else { return }
  var o = fields
  o["id"] = id
  o["ok"] = true
  emit(o)
}

func replyError(_ id: Any?, _ message: String) {
  if id == nil { log("error: \(message)"); return }
  emit(["id": id!, "ok": false, "error": message])
}

let virtualDisplay = VirtualDisplay()
let injector = Injector()
let pasteboardWatch = PasteboardWatch()

func handle(_ line: String) {
  guard let data = line.data(using: .utf8),
        let msg = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
        let cmd = msg["cmd"] as? String
  else {
    log("bad line: \(line.prefix(200))")
    return
  }
  let id = msg["id"]
  Capture.shared.touch() // every command is a keepalive for the capture dead-man
  let num = { (k: String, d: Double) in (msg[k] as? NSNumber)?.doubleValue ?? d }
  switch cmd {
  case "kvmConfig":
    guard Capture.shared.startTap() else { return replyError(id, "event tap failed (Accessibility / Input Monitoring)") }
    Capture.shared.configure(side: (msg["side"] as? String) ?? "right", resistance: num("resistancePx", 120),
                             edgeEnabled: (msg["driveOther"] as? Bool) ?? false, keyboard: (msg["keyboard"] as? Bool) ?? true)
    reply(id)
  case "capture":
    if (msg["on"] as? Bool) == true {
      Capture.shared.startCapture(mouse: (msg["mouse"] as? Bool) ?? true, keyboard: (msg["keyboard"] as? Bool) ?? true)
    } else {
      Capture.shared.stopCapture(side: msg["side"] as? String, offset: (msg["offset"] as? NSNumber)?.doubleValue)
    }
    reply(id)
  case "keepalive":
    break
  case "place":
    let center = (msg["center"] as? Bool) == true
    Capture.shared.warp(Screens.edgePoint(side: center ? nil : msg["side"] as? String,
                                          offset: center ? nil : (msg["offset"] as? NSNumber)?.doubleValue))
    reply(id)
  case "armReturn":
    Capture.shared.armReturn(on: (msg["on"] as? Bool) ?? false, side: (msg["side"] as? String) ?? "right",
                             resistance: num("resistancePx", 120))
    reply(id)
  case "inject":
    if let ev = msg["ev"] as? [String: Any] { injector.injectRel(ev) }
  case "ping":
    reply(id)
  case "permissions":
    reply(id, [
      "accessibility": AXIsProcessTrusted(),
      "inputMonitoring": IOHIDCheckAccess(kIOHIDRequestTypeListenEvent) == kIOHIDAccessTypeGranted,
    ])
  case "createDisplay":
    let width = (msg["width"] as? NSNumber)?.intValue ?? 1920
    let height = (msg["height"] as? NSNumber)?.intValue ?? 1080
    let hiDPI = (msg["hiDPI"] as? Bool) ?? false
    let hz = (msg["hz"] as? NSNumber)?.doubleValue ?? 60
    let name = (msg["name"] as? String) ?? "MacShare"
    virtualDisplay.create(width: width, height: height, hiDPI: hiDPI, hz: hz, name: name) { result in
      switch result {
      case .success(let info): reply(id, info)
      case .failure(let err): replyError(id, err.message)
      }
    }
  case "input":
    guard let ev = msg["ev"] as? [String: Any], let b = msg["bounds"] as? [String: Any],
          let x = (b["x"] as? NSNumber)?.doubleValue, let y = (b["y"] as? NSNumber)?.doubleValue,
          let w = (b["width"] as? NSNumber)?.doubleValue, let h = (b["height"] as? NSNumber)?.doubleValue
    else { return replyError(id, "input needs ev and bounds") }
    injector.input(ev, bounds: CGRect(x: x, y: y, width: w, height: h))
  case "releaseAll":
    injector.releaseAll()
    reply(id)
  case "clipboardWatch":
    pasteboardWatch.set(on: (msg["on"] as? Bool) ?? false)
    reply(id)
  case "clipboardInfo":
    reply(id, PasteboardWatch.info())
  case "destroyDisplay":
    virtualDisplay.destroy()
    reply(id)
  default:
    replyError(id, "unknown cmd \(cmd)")
  }
}

DispatchQueue.global().async {
  while let line = readLine() {
    if line.isEmpty { continue }
    DispatchQueue.main.async { handle(line) }
  }
  DispatchQueue.main.async {
    Capture.shared.stopCapture(side: nil, offset: nil)
    injector.releaseAll()
    virtualDisplay.destroy()
    exit(0)
  }
}

signal(SIGTERM) { _ in exit(0) }
NSApplication.shared.setActivationPolicy(.prohibited)
log("ready")
NSApplication.shared.run()
