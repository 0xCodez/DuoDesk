// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Event tap for shared cursor/keyboard (docs/KVM.md): edge push at home, Right-Option double-tap,
// capture (swallow + report as `ev`) per device class, dead-man, return edge while driven.
// Safety rules from Beamer's design: the callback only does cheap work and enqueues output; our
// own injections are skipped; the hotkey stops capture locally first; releases of keys pressed
// remotely are swallowed at home; no crossing during a drag.
import Cocoa

private let tapCallback: CGEventTapCallBack = { _, type, event, _ in
  Capture.shared.handle(type, event)
}

private func now() -> Double { ProcessInfo.processInfo.systemUptime }

final class Capture {
  static let shared = Capture()

  private var tap: CFMachPort?
  // kvmConfig
  private var side = "right"
  private var resistance = 120.0
  private var edgeEnabled = false   // driveOther && mouse && link up (main decides)
  private var cfgKeyboard = true    // capture the keyboard when crossing at the edge
  // capture
  private(set) var capturing = false
  private var capMouse = false, capKeyboard = false
  private var lastCommand = 0.0
  private var deadman: Timer?
  // edge / return edge push
  private var edge = (push: 0.0, at: 0.0)
  private var ret = (push: 0.0, at: 0.0)
  private var returnSide: String?
  private var returnResistance = 120.0
  private var buttonsHeld = 0
  // hotkey (Right Option, kVK 0x3D, device flag 0x40)
  private var hkStage = 0, hkAt = 0.0
  // keys
  private var remoteDown = Set<UInt16>()  // pressed while capturing (went to the other machine)
  private var swallowUps = Set<UInt16>()  // their releases, to swallow at home
  private var localDown = Set<UInt16>()   // pressed at home (their releases stay local)

  /// Any command from main counts as a keepalive.
  func touch() { lastCommand = now() }

  func startTap() -> Bool {
    if tap != nil { return true }
    let types: [CGEventType] = [.mouseMoved, .leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp,
                                .otherMouseDown, .otherMouseUp, .leftMouseDragged, .rightMouseDragged,
                                .otherMouseDragged, .scrollWheel, .keyDown, .keyUp, .flagsChanged]
    let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }
    guard let t = CGEvent.tapCreate(tap: .cghidEventTap, place: .headInsertEventTap, options: .defaultTap,
                                    eventsOfInterest: mask, callback: tapCallback, userInfo: nil) else {
      log("event tap failed: Accessibility / Input Monitoring not granted?")
      return false
    }
    tap = t
    CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(nil, t, 0), .commonModes)
    CGEvent.tapEnable(tap: t, enable: true)
    log("event tap on")
    return true
  }

  func configure(side: String, resistance: Double, edgeEnabled: Bool, keyboard: Bool) {
    self.side = side
    self.resistance = resistance
    self.edgeEnabled = edgeEnabled
    self.cfgKeyboard = keyboard
    edge.push = 0
  }

  // MARK: capture

  func startCapture(mouse: Bool, keyboard: Bool) {
    if capturing { stopCapture(side: nil, offset: nil) }
    capturing = true
    capMouse = mouse
    capKeyboard = keyboard
    if mouse { CGAssociateMouseAndMouseCursorPosition(0) } // pointer frozen, deltas still arrive
    touch()
    deadman?.invalidate()
    deadman = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
      guard let self = self, self.capturing, now() - self.lastCommand > 1.5 else { return }
      self.stopCapture(side: nil, offset: nil)
      emit(["event": "captureEnded", "reason": "deadman"])
    }
  }

  func stopCapture(side: String?, offset: Double?) {
    guard capturing else { return }
    capturing = false
    deadman?.invalidate()
    deadman = nil
    if capMouse { CGAssociateMouseAndMouseCursorPosition(1) }
    if let side = side, let offset = offset { warp(Screens.edgePoint(side: side, offset: offset)) }
    swallowUps.formUnion(remoteDown)
    remoteDown.removeAll()
    edge.push = 0
  }

  func warp(_ p: CGPoint) {
    CGWarpMouseCursorPosition(p)
    CGAssociateMouseAndMouseCursorPosition(1) // also ends the ~0.25 s local-event suppression after a warp
  }

  func armReturn(on: Bool, side: String, resistance: Double) {
    returnSide = on ? side : nil
    returnResistance = resistance
    ret.push = 0
  }

  /// Return-edge check while driven; called for local moves and for injected relative moves.
  func checkReturn(_ p: CGPoint, dx: Double, dy: Double) {
    guard let side = returnSide, let off = Capture.push(&ret, p, dx, dy, side, returnResistance) else { return }
    returnSide = nil
    emit(["event": "return", "offset": off])
  }

  /// Accumulate outward motion on an outer edge; returns the offset when it went through.
  private static func push(_ st: inout (push: Double, at: Double), _ p: CGPoint, _ dx: Double, _ dy: Double,
                           _ side: String, _ resistance: Double) -> Double? {
    let out = side == "right" ? dx : side == "left" ? -dx : side == "bottom" ? dy : -dy
    let t = now()
    if t - st.at > 0.3 { st.push = 0 }
    guard out > 0, Screens.isOuterEdge(p, side: side) else {
      st.push = 0
      return nil
    }
    st.push += out
    st.at = t
    guard st.push >= resistance else { return nil }
    st.push = 0
    return Screens.offset(p, side: side)
  }

  // MARK: tap callback

  func handle(_ type: CGEventType, _ event: CGEvent) -> Unmanaged<CGEvent>? {
    let pass = Unmanaged.passUnretained(event)
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
      if let t = tap { CGEvent.tapEnable(tap: t, enable: true) }
      return pass
    }
    if event.getIntegerValueField(.eventSourceUserData) == injectedMark { return pass }
    switch type {
    case .flagsChanged: return onFlags(event) ? nil : pass
    case .keyDown, .keyUp: return onKey(event, down: type == .keyDown) ? nil : pass
    default: return onMouse(type, event) ? nil : pass
    }
  }

  private func ev(_ fields: [String: Any]) {
    emit(["event": "ev", "ev": fields])
  }

  /// Returns true to swallow.
  private func onFlags(_ e: CGEvent) -> Bool {
    let kc = UInt16(e.getIntegerValueField(.keyboardEventKeycode))
    let flags = e.flags.rawValue
    if kc == 0x3D { // Right Option: the hotkey, never forwarded
      if hotkeyStep(down: flags & 0x40 != 0) {
        if capturing {
          stopCapture(side: nil, offset: nil) // stop locally first, even if main is stuck
          emit(["event": "hotkey", "local": true])
          return true
        }
        emit(["event": "hotkey"])
      }
      return capturing && capKeyboard
    }
    hkStage = 0
    guard let code = KeyCodes.fromMac[kc] else { return capturing && capKeyboard }
    if kc == 0x39 { // Caps Lock toggles: send a full press
      if capturing && capKeyboard { ev(["t": "k.kd", "code": code]); ev(["t": "k.ku", "code": code]); return true }
      return false
    }
    guard let m = KeyCodes.modifiers[code] else { return capturing && capKeyboard }
    let down = flags & m.device != 0
    if capturing && capKeyboard {
      if !down && localDown.remove(kc) != nil { return false } // pressed at home: release at home
      if down { remoteDown.insert(kc) } else { remoteDown.remove(kc) }
      ev(["t": down ? "k.kd" : "k.ku", "code": code])
      return true
    }
    if down { localDown.insert(kc) } else { localDown.remove(kc); swallowUps.remove(kc) }
    return false
  }

  private func onKey(_ e: CGEvent, down: Bool) -> Bool {
    hkStage = 0
    let kc = UInt16(e.getIntegerValueField(.keyboardEventKeycode))
    if capturing && capKeyboard {
      if !down && localDown.remove(kc) != nil { return false }
      guard let code = KeyCodes.fromMac[kc] else { return true }
      if down { remoteDown.insert(kc) } else { remoteDown.remove(kc) }
      ev(["t": down ? "k.kd" : "k.ku", "code": code])
      return true
    }
    if !down && swallowUps.remove(kc) != nil { return true } // pressed on the other machine
    if down { localDown.insert(kc) } else { localDown.remove(kc) }
    return false
  }

  private func onMouse(_ type: CGEventType, _ e: CGEvent) -> Bool {
    let dx = e.getDoubleValueField(.mouseEventDeltaX), dy = e.getDoubleValueField(.mouseEventDeltaY)
    let isDown = type == .leftMouseDown || type == .rightMouseDown || type == .otherMouseDown
    let isUp = type == .leftMouseUp || type == .rightMouseUp || type == .otherMouseUp
    if isDown { hkStage = 0 }

    if capturing && capMouse {
      if isDown || isUp {
        let b = type == .leftMouseDown || type == .leftMouseUp ? 0
          : type == .rightMouseDown || type == .rightMouseUp ? 1 : Int(e.getIntegerValueField(.mouseEventButtonNumber))
        ev(["t": isDown ? "k.md" : "k.mu", "b": b])
      } else if type == .scrollWheel {
        if e.getIntegerValueField(.scrollWheelEventIsContinuous) != 0 {
          ev(["t": "k.wh", "mode": "pixel",
              "dx": -e.getDoubleValueField(.scrollWheelEventPointDeltaAxis2),
              "dy": -e.getDoubleValueField(.scrollWheelEventPointDeltaAxis1)])
        } else {
          ev(["t": "k.wh", "mode": "line",
              "dx": -e.getDoubleValueField(.scrollWheelEventFixedPtDeltaAxis2),
              "dy": -e.getDoubleValueField(.scrollWheelEventFixedPtDeltaAxis1)])
        }
      } else if dx != 0 || dy != 0 {
        ev(["t": "k.mm", "dx": dx, "dy": dy])
      }
      return true
    }

    if isDown { buttonsHeld += 1 }
    if isUp { buttonsHeld = max(0, buttonsHeld - 1) }
    if type == .mouseMoved {
      if !capturing, edgeEnabled, buttonsHeld == 0,
         let off = Capture.push(&edge, e.location, dx, dy, side, resistance) {
        startCapture(mouse: true, keyboard: cfgKeyboard) // capture first, so no motion leaks
        emit(["event": "edge", "offset": off])
        return true
      }
      checkReturn(e.location, dx: dx, dy: dy)
    }
    return false
  }

  /// Double-tap: down, up, down, up — each step within the double-tap window.
  private func hotkeyStep(down: Bool) -> Bool {
    let t = now(), win = 0.4
    switch hkStage {
    case 0: if down { hkStage = 1; hkAt = t }
    case 1: if !down { hkStage = t - hkAt < win ? 2 : 0; hkAt = t }
    case 2: if down { if t - hkAt < win { hkStage = 3 } else { hkStage = 1 }; hkAt = t }
    case 3:
      if !down {
        hkStage = 0
        return t - hkAt < win
      }
    default: hkStage = 0
    }
    return false
  }
}
