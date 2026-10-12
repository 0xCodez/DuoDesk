// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Input injection with CGEvent: absolute stream input (`input`, phase 3) and releaseAll.
// Every injected event is marked with eventSourceUserData = 0x4D53 so our own tap can skip it.
import Cocoa

let injectedMark: Int64 = 0x4D53

final class Injector {
  private let source: CGEventSource?
  private var heldKeys = Set<UInt16>()         // non-modifier keys we pressed
  private var heldMods = Set<String>()         // modifier DOM codes we pressed
  private var capsLock = false
  private var heldButtons = Set<Int>()         // P.BUTTON values
  private var lastDown: (at: TimeInterval, point: CGPoint, button: Int, count: Int64)?
  private var clickCount: [Int: Int64] = [:]   // button -> click state of its current press

  init() {
    source = CGEventSource(stateID: .hidSystemState)
    // Don't suppress the local mouse/keyboard for 0.25 s after each injected event.
    source?.localEventsSuppressionInterval = 0
  }

  private var flags: CGEventFlags {
    var f = CGEventFlags(rawValue: 0)
    for code in heldMods {
      if let m = KeyCodes.modifiers[code] { f.insert(m.flag); f.insert(CGEventFlags(rawValue: m.device)) }
    }
    if capsLock { f.insert(.maskAlphaShift) }
    return f
  }

  private func post(_ e: CGEvent?) {
    guard let e = e else { return }
    e.setIntegerValueField(.eventSourceUserData, value: injectedMark)
    e.post(tap: .cghidEventTap)
  }

  private func cgButton(_ b: Int) -> CGMouseButton {
    switch b { case 0: return .left; case 1: return .right; default: return .center }
  }

  private func mouseType(_ b: Int, down: Bool) -> CGEventType {
    switch b {
    case 0: return down ? .leftMouseDown : .leftMouseUp
    case 1: return down ? .rightMouseDown : .rightMouseUp
    default: return down ? .otherMouseDown : .otherMouseUp
    }
  }

  private func mouse(_ type: CGEventType, at p: CGPoint, button b: Int, clickState: Int64? = nil) {
    let e = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: p, mouseButton: cgButton(b))
    // P.BUTTON: 0 left, 1 right, 2 middle, 3 back, 4 forward -> CG button numbers 0, 1, 2, 3, 4.
    e?.setIntegerValueField(.mouseEventButtonNumber, value: Int64(b))
    if let c = clickState { e?.setIntegerValueField(.mouseEventClickState, value: c) }
    e?.flags = flags
    post(e)
  }

  private func point(_ ev: [String: Any], _ bounds: CGRect) -> CGPoint {
    let x = min(max((ev["x"] as? NSNumber)?.doubleValue ?? 0, 0), 1)
    let y = min(max((ev["y"] as? NSNumber)?.doubleValue ?? 0, 0), 1)
    return CGPoint(x: bounds.minX + min(x * bounds.width, bounds.width - 1),
                   y: bounds.minY + min(y * bounds.height, bounds.height - 1))
  }

  /// One `in.*` message (key codes already swapped by main) onto the display at `bounds`.
  func input(_ ev: [String: Any], bounds: CGRect) {
    guard let t = ev["t"] as? String else { return }
    switch t {
    case "in.mm":
      let p = point(ev, bounds)
      if let b = heldButtons.min() {
        let type: CGEventType = b == 0 ? .leftMouseDragged : b == 1 ? .rightMouseDragged : .otherMouseDragged
        mouse(type, at: p, button: b, clickState: clickCount[b])
      } else {
        mouse(.mouseMoved, at: p, button: 0)
      }
    case "in.md":
      let p = point(ev, bounds), b = (ev["b"] as? NSNumber)?.intValue ?? 0
      let now = ProcessInfo.processInfo.systemUptime
      var count: Int64 = 1
      if let l = lastDown, l.button == b, now - l.at < NSEvent.doubleClickInterval,
         abs(l.point.x - p.x) <= 4, abs(l.point.y - p.y) <= 4 {
        count = l.count + 1
      }
      lastDown = (now, p, b, count)
      clickCount[b] = count
      heldButtons.insert(b)
      mouse(mouseType(b, down: true), at: p, button: b, clickState: count)
    case "in.mu":
      let p = point(ev, bounds), b = (ev["b"] as? NSNumber)?.intValue ?? 0
      guard heldButtons.remove(b) != nil else { return }
      mouse(mouseType(b, down: false), at: p, button: b, clickState: clickCount[b] ?? 1)
    case "in.wh":
      // DOM sign: positive dy = see content further down. CG pixel scroll: negative = down.
      let dy = (ev["dy"] as? NSNumber)?.doubleValue ?? 0, dx = (ev["dx"] as? NSNumber)?.doubleValue ?? 0
      let clamp = { (v: Double) in Int32(max(-10000, min(10000, -v.rounded()))) }
      let e = CGEvent(scrollWheelEvent2Source: source, units: .pixel, wheelCount: 2,
                      wheel1: clamp(dy), wheel2: clamp(dx), wheel3: 0)
      e?.flags = flags
      post(e)
    case "in.kd", "in.ku":
      guard let code = ev["code"] as? String else { return }
      key(code, down: t == "in.kd")
    default:
      log("input: unknown \(t)")
    }
  }

  func key(_ code: String, down: Bool) {
    guard let vk = KeyCodes.toMac[code] else {
      log("no Mac key for \(code)")
      return
    }
    if KeyCodes.modifiers[code] != nil {
      if down { heldMods.insert(code) } else { guard heldMods.remove(code) != nil else { return } }
      let e = CGEvent(keyboardEventSource: source, virtualKey: vk, keyDown: down)
      e?.type = .flagsChanged
      e?.flags = flags
      post(e)
      return
    }
    if code == "CapsLock" {
      if down {
        capsLock.toggle()
        let e = CGEvent(keyboardEventSource: source, virtualKey: vk, keyDown: true)
        e?.type = .flagsChanged
        e?.flags = flags
        post(e)
      }
      return
    }
    let repeating = down && heldKeys.contains(vk)
    if down { heldKeys.insert(vk) } else { guard heldKeys.remove(vk) != nil else { return } }
    let e = CGEvent(keyboardEventSource: source, virtualKey: vk, keyDown: down)
    e?.flags = flags
    if repeating { e?.setIntegerValueField(.keyboardEventAutorepeat, value: 1) }
    post(e)
  }

  /// Key-up every key and button we hold, clear modifiers.
  func releaseAll() {
    for vk in heldKeys {
      let e = CGEvent(keyboardEventSource: source, virtualKey: vk, keyDown: false)
      e?.flags = flags
      post(e)
    }
    heldKeys.removeAll()
    for code in heldMods { key(code, down: false) }
    let p = CGEvent(source: nil)?.location ?? .zero
    for b in heldButtons { mouse(mouseType(b, down: false), at: p, button: b, clickState: clickCount[b] ?? 1) }
    heldButtons.removeAll()
  }
}
