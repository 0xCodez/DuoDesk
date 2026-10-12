// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Low-level hooks (capture + hotkey), Raw Input (edge push at home, local return-edge motion),
// dead-man timer and the safety rules of docs/KVM.md. Hook callbacks only decide and enqueue.
// Portions adapted from Beamer (https://github.com/kalkman-code/beamer), Copyright (C) Kalkman Code,
// GPL-3.0. Changed: C# port of win_app/capture_win.py hooks and raw-mouse edge push.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace MacShare
{
    class Capture
    {
        // config (kvmConfig)
        public string Side;          // crossing side of this PC (null = unknown)
        public double ResistancePx = 120;
        public uint HotkeyVk = 0xA3; // Right Ctrl
        public bool DriveOther;      // edge detection on
        public bool EdgeKeyboard = true; // an edge crossing also captures the keyboard
        public bool DragFiles = true; // file drags at the edge go to the Mac (drag.policy + the Files switches)
        public int DeadmanMs = 1500, DoubleTapMs = 400;

        // capture state
        bool capturing, capMouse, capKeys;
        Point saved, parked;
        readonly HashSet<uint> heldVks = new HashSet<uint>(), swallowVks = new HashSet<uint>();
        readonly HashSet<int> heldButtons = new HashSet<int>(), swallowButtons = new HashSet<int>();
        DateTime lastCmd = DateTime.UtcNow;

        // edge push (home) and return edge (driven)
        double push; DateTime lastPush;
        bool retArmed; string retSide; double retResistance, retPush; DateTime retLast;

        // hotkey double-tap
        bool hkDown; DateTime lastTapUp = DateTime.MinValue;

        readonly Action<Dictionary<string, object>> emit;
        Native.HookProc mouseProc, keyProc; // kept in fields so the GC never collects them
        IntPtr mouseHook, keyHook;
        RawWindow raw;
        readonly Timer timer = new Timer();

        public Capture(Action<Dictionary<string, object>> emit)
        {
            this.emit = emit;
        }

        public void Start()
        {
            mouseProc = MouseHook;
            keyProc = KeyHook;
            IntPtr mod = Native.GetModuleHandle(null);
            mouseHook = Native.SetWindowsHookEx(Native.WH_MOUSE_LL, mouseProc, mod, 0);
            keyHook = Native.SetWindowsHookEx(Native.WH_KEYBOARD_LL, keyProc, mod, 0);
            raw = new RawWindow(OnRawMove);
            timer.Interval = 100;
            timer.Tick += delegate { Tick(); };
            timer.Start();
        }

        public void Shutdown()
        {
            if (capturing) Stop(null, 0);
            timer.Stop();
            if (mouseHook != IntPtr.Zero) Native.UnhookWindowsHookEx(mouseHook);
            if (keyHook != IntPtr.Zero) Native.UnhookWindowsHookEx(keyHook);
            mouseHook = keyHook = IntPtr.Zero;
        }

        public void Touch() { lastCmd = DateTime.UtcNow; }

        static Dictionary<string, object> Ev(string name)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            d["event"] = name;
            return d;
        }

        void Forward(Dictionary<string, object> k)
        {
            Dictionary<string, object> d = Ev("ev");
            d["ev"] = k;
            emit(d);
        }

        static Dictionary<string, object> K(string t)
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            d["t"] = t;
            return d;
        }

        // ---- capture on/off ----

        public void Begin(bool mouse, bool keys)
        {
            if (capturing) { capMouse = mouse; capKeys = keys; return; }
            capturing = true; capMouse = mouse; capKeys = keys;
            heldVks.Clear(); heldButtons.Clear();
            Touch();
            if (mouse)
            {
                Native.POINT p;
                Native.GetCursorPos(out p);
                saved = new Point(p.x, p.y);
                // Park in the middle so outward motion isn't clamped by the screen edge.
                parked = Screens.Center();
                Native.SetCursorPos(parked.X, parked.Y);
            }
            push = 0;
        }

        // side == null: put the pointer back where capture began.
        public void Stop(string side, double offset)
        {
            if (!capturing) return;
            capturing = false;
            // Rule 5: whatever is still held was pressed remotely; its release stays swallowed here.
            foreach (uint vk in heldVks) swallowVks.Add(vk);
            foreach (int b in heldButtons) swallowButtons.Add(b);
            heldVks.Clear(); heldButtons.Clear();
            if (capMouse)
            {
                Point p = side != null ? Screens.EdgePoint(side, offset) : saved;
                Native.SetCursorPos(p.X, p.Y);
            }
            push = 0;
        }

        public bool Capturing { get { return capturing; } }

        public void ArmReturn(bool on, string side, double resistance)
        {
            retArmed = on && side != null;
            retSide = side;
            retResistance = resistance;
            retPush = 0;
        }

        void Tick()
        {
            if (capturing && (DateTime.UtcNow - lastCmd).TotalMilliseconds > DeadmanMs)
            {
                Stop(null, 0); // Rule 1: a hung main or a dead link never keeps the user's input
                Dictionary<string, object> d = Ev("captureEnded");
                d["reason"] = "deadman";
                emit(d);
            }
        }

        // ---- hooks ----

        IntPtr MouseHook(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode < 0) return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);
            Native.MSLLHOOKSTRUCT m = (Native.MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(Native.MSLLHOOKSTRUCT));
            if ((m.flags & Native.LLMHF_INJECTED) != 0 && m.dwExtraInfo == Native.MARK)
                return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam); // Rule 4: our own
            int msg = wParam.ToInt32();
            int button = ButtonOf(msg, m.mouseData);
            bool down = msg == Native.WM_LBUTTONDOWN || msg == Native.WM_RBUTTONDOWN || msg == Native.WM_MBUTTONDOWN || msg == Native.WM_XBUTTONDOWN;
            bool up = msg == Native.WM_LBUTTONUP || msg == Native.WM_RBUTTONUP || msg == Native.WM_MBUTTONUP || msg == Native.WM_XBUTTONUP;

            if (up && button >= 0 && swallowButtons.Remove(button)) return (IntPtr)1;
            if (!capturing || !capMouse) return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);

            if (msg == Native.WM_MOUSEMOVE)
            {
                int dx = m.pt.x - parked.X, dy = m.pt.y - parked.Y;
                if (dx != 0 || dy != 0)
                {
                    double s = Screens.Scale(parked.X, parked.Y);
                    Dictionary<string, object> k = K("k.mm");
                    k["dx"] = Math.Round(dx / s, 2);
                    k["dy"] = Math.Round(dy / s, 2);
                    Forward(k);
                }
            }
            else if (button >= 0 && (down || up))
            {
                if (down) heldButtons.Add(button); else heldButtons.Remove(button);
                Dictionary<string, object> k = K(down ? "k.md" : "k.mu");
                k["b"] = button;
                Forward(k);
            }
            else if (msg == Native.WM_MOUSEWHEEL || msg == Native.WM_MOUSEHWHEEL)
            {
                double notches = (short)((m.mouseData >> 16) & 0xFFFF) / 120.0;
                Dictionary<string, object> k = K("k.wh");
                k["dx"] = msg == Native.WM_MOUSEHWHEEL ? notches : 0.0;
                k["dy"] = msg == Native.WM_MOUSEWHEEL ? -notches : 0.0;
                k["mode"] = "line";
                Forward(k);
            }
            return (IntPtr)1; // swallow: the pointer stays parked
        }

        static int ButtonOf(int msg, uint mouseData)
        {
            switch (msg)
            {
                case Native.WM_LBUTTONDOWN: case Native.WM_LBUTTONUP: return 0;
                case Native.WM_RBUTTONDOWN: case Native.WM_RBUTTONUP: return 1;
                case Native.WM_MBUTTONDOWN: case Native.WM_MBUTTONUP: return 2;
                case Native.WM_XBUTTONDOWN: case Native.WM_XBUTTONUP:
                    return ((mouseData >> 16) & 0xFFFF) == Native.XBUTTON1 ? 3 : 4;
            }
            return -1;
        }

        IntPtr KeyHook(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode < 0) return Native.CallNextHookEx(keyHook, nCode, wParam, lParam);
            Native.KBDLLHOOKSTRUCT k = (Native.KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(Native.KBDLLHOOKSTRUCT));
            if ((k.flags & Native.LLKHF_INJECTED) != 0 && k.dwExtraInfo == Native.MARK)
                return Native.CallNextHookEx(keyHook, nCode, wParam, lParam); // Rule 4: our own
            int msg = wParam.ToInt32();
            bool down = msg == Native.WM_KEYDOWN || msg == Native.WM_SYSKEYDOWN;
            string code = Keys.Code(k.vkCode, k.scanCode, (k.flags & Native.LLKHF_EXTENDED) != 0);
            bool hotkey = DetectHotkey(k.vkCode, down);

            if (!down && swallowVks.Remove(k.vkCode)) return (IntPtr)1;

            if (capturing && capKeys)
            {
                // The hotkey key itself is never forwarded while capturing (docs/KVM.md).
                if (k.vkCode == HotkeyVk)
                {
                    if (hotkey) FireHotkey();
                    return (IntPtr)1;
                }
                if (down) heldVks.Add(k.vkCode); else heldVks.Remove(k.vkCode);
                if (code != null) { Dictionary<string, object> e = K(down ? "k.kd" : "k.ku"); e["code"] = code; Forward(e); }
                if (hotkey) FireHotkey();
                return (IntPtr)1;
            }
            if (hotkey) FireHotkey();
            return Native.CallNextHookEx(keyHook, nCode, wParam, lParam);
        }

        // Two clean taps (down+up, no other key between) within DoubleTapMs, in every mode.
        bool DetectHotkey(uint vk, bool down)
        {
            DateTime now = DateTime.UtcNow;
            if (vk != HotkeyVk)
            {
                if (down) lastTapUp = DateTime.MinValue;
                return false;
            }
            if (down) { hkDown = true; return false; }
            if (!hkDown) return false;
            hkDown = false;
            if (lastTapUp != DateTime.MinValue && (now - lastTapUp).TotalMilliseconds <= DoubleTapMs)
            {
                lastTapUp = DateTime.MinValue;
                return true;
            }
            lastTapUp = now;
            return false;
        }

        // Rule 2: stop capturing in the helper first, then tell main.
        void FireHotkey()
        {
            bool was = capturing;
            if (capturing) Stop(null, 0);
            Dictionary<string, object> d = Ev("hotkey");
            d["wasCapturing"] = was;
            emit(d);
        }

        // ---- raw input: edge push at home, local motion for the return edge ----

        static bool AnyButtonDown()
        {
            return (Native.GetAsyncKeyState(0x01) & 0x8000) != 0 || (Native.GetAsyncKeyState(0x02) & 0x8000) != 0 || (Native.GetAsyncKeyState(0x04) & 0x8000) != 0;
        }

        void OnRawMove(int dx, int dy)
        {
            if (capturing) return;
            Native.POINT p;
            Native.GetCursorPos(out p);
            if (retArmed) { FeedReturn(p.x, p.y, dx, dy); return; }
            if (!DriveOther || Side == null || AnyButtonDown()) { push = 0; return; } // Rule 6: no crossing mid-drag
            double outward = Screens.Outward(Side, dx, dy);
            if (outward <= 0 || !Screens.OnOuterEdge(p.x, p.y, Side)) { push = 0; return; }
            DateTime now = DateTime.UtcNow;
            if ((now - lastPush).TotalMilliseconds > 300) push = 0;
            lastPush = now;
            push += outward;
            if (push < ResistancePx) return;
            double offset = Screens.Offset(p.x, p.y, Side);
            Begin(true, EdgeKeyboard); // start capturing at once so no motion leaks, then tell main
            saved = new Point(p.x, p.y);
            Dictionary<string, object> d = Ev("edge");
            d["offset"] = Math.Round(offset, 4);
            emit(d);
        }

        // Injected moves report here too (Injector.Moved): the owner's hand reaches the edge.
        public void FeedReturn(int x, int y, double dx, double dy)
        {
            if (!retArmed) return;
            double outward = Screens.Outward(retSide, dx, dy);
            if (outward <= 0 || !Screens.OnOuterEdge(x, y, retSide)) { retPush = 0; return; }
            DateTime now = DateTime.UtcNow;
            if ((now - retLast).TotalMilliseconds > 300) retPush = 0;
            retLast = now;
            retPush += outward;
            if (retPush < retResistance) return;
            retArmed = false;
            Dictionary<string, object> d = Ev("return");
            d["offset"] = Math.Round(Screens.Offset(x, y, retSide), 4);
            emit(d);
        }

        // Message-only window that receives WM_INPUT for the mouse (usage page 1, usage 2).
        class RawWindow : NativeWindow
        {
            readonly Action<int, int> onMove;

            public RawWindow(Action<int, int> onMove)
            {
                this.onMove = onMove;
                CreateParams cp = new CreateParams();
                cp.Parent = new IntPtr(-3); // HWND_MESSAGE
                CreateHandle(cp);
                Native.RAWINPUTDEVICE[] d = new Native.RAWINPUTDEVICE[1];
                d[0].usUsagePage = 1;
                d[0].usUsage = 2;
                d[0].dwFlags = Native.RIDEV_INPUTSINK;
                d[0].hwndTarget = Handle;
                Native.RegisterRawInputDevices(d, 1, (uint)Marshal.SizeOf(typeof(Native.RAWINPUTDEVICE)));
            }

            protected override void WndProc(ref Message m)
            {
                if (m.Msg == Native.WM_INPUT) Read(m.LParam);
                base.WndProc(ref m);
            }

            void Read(IntPtr hRaw)
            {
                const uint header = 24; // RAWINPUTHEADER on x64
                uint size = 0;
                Native.GetRawInputData(hRaw, Native.RID_INPUT, IntPtr.Zero, ref size, header);
                if (size < header + 24) return;
                IntPtr buf = Marshal.AllocHGlobal((int)size);
                try
                {
                    if (Native.GetRawInputData(hRaw, Native.RID_INPUT, buf, ref size, header) == uint.MaxValue) return;
                    if (Marshal.ReadInt32(buf, 0) != 0) return; // RIM_TYPEMOUSE
                    int rm = (int)header;
                    ushort flags = (ushort)Marshal.ReadInt16(buf, rm);
                    int lx = Marshal.ReadInt32(buf, rm + 12), ly = Marshal.ReadInt32(buf, rm + 16);
                    uint extra = (uint)Marshal.ReadInt32(buf, rm + 20);
                    if ((flags & 1) != 0 || extra == 0x4D530000) return; // absolute devices / our own
                    if (lx != 0 || ly != 0) onMove(lx, ly);
                }
                finally { Marshal.FreeHGlobal(buf); }
            }
        }
    }
}
