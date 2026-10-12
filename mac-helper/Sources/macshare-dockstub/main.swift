// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Phase 13: the Dock icon of one PC app. MacShare copies this binary into a generated bundle per PC
// app (name + icon in Info.plist / Resources) and runs it while that app has windows on this Mac.
// stdout (lines): `activate` (Dock click, ⌘-Tab), `focus <i>` (Dock menu item), `quit` (Dock › Quit).
// stdin (lines): `menu <JSON array of window titles>`, `exit`. stdin closed → exit.
import Cocoa

final class Stub: NSObject, NSApplicationDelegate {
  var titles: [String] = []
  var parentExit = false

  func out(_ s: String) {
    FileHandle.standardOutput.write((s + "\n").data(using: .utf8)!)
  }

  func applicationDidFinishLaunching(_ n: Notification) {
    if let url = Bundle.main.url(forResource: "icon", withExtension: "png"), let img = NSImage(contentsOf: url) {
      NSApp.applicationIconImage = img
    }
  }

  func applicationDidBecomeActive(_ n: Notification) { out("activate") }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
    out("activate")
    return false
  }

  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    if !parentExit { out("quit") }
    return .terminateNow
  }

  func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
    let menu = NSMenu()
    for (i, t) in titles.enumerated() {
      let item = NSMenuItem(title: t.isEmpty ? "Window" : t, action: #selector(pick(_:)), keyEquivalent: "")
      item.tag = i
      item.target = self
      menu.addItem(item)
    }
    return menu
  }

  @objc func pick(_ item: NSMenuItem) { out("focus \(item.tag)") }

  func handle(_ line: String) {
    if line == "exit" {
      parentExit = true
      NSApp.terminate(nil)
    } else if line.hasPrefix("menu "), let data = line.dropFirst(5).data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [String] {
      titles = arr
    }
  }
}

let stub = Stub()
let app = NSApplication.shared
app.delegate = stub
app.setActivationPolicy(.regular)
DispatchQueue.global().async {
  while let line = readLine() { DispatchQueue.main.async { stub.handle(line) } }
  DispatchQueue.main.async { exit(0) }
}
app.run()
