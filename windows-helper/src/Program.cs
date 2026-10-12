// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// macshare-winhelper: JSON lines on stdin (commands) / stdout (replies and events), docs/KVM.md
// "Helper interface". The main thread runs the WinForms message loop (hooks and raw input need
// it); a reader thread hands each line to it; one writer thread does all stdout I/O.
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Drawing;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace MacShare
{
    static class Program
    {
        static readonly BlockingCollection<string> outbox = new BlockingCollection<string>();
        static Control invoker;
        static Capture capture;
        static Injector injector;

        [STAThread]
        static int Main()
        {
            // Per-monitor v2: every coordinate is in physical pixels.
            try { if (!Native.SetProcessDpiAwarenessContext(new IntPtr(-4))) Native.SetProcessDPIAware(); }
            catch (Exception) { Native.SetProcessDPIAware(); }
            Console.InputEncoding = new UTF8Encoding(false);
            Console.OutputEncoding = new UTF8Encoding(false);

            invoker = new Control();
            invoker.CreateControl();
            IntPtr force = invoker.Handle; // the handle must exist before BeginInvoke from other threads

            capture = new Capture(Emit);
            injector = new Injector();
            injector.Moved = capture.FeedReturn;
            capture.Start();

            Thread writer = new Thread(WriteLoop);
            writer.IsBackground = true;
            writer.Start();
            Thread reader = new Thread(ReadLoop);
            reader.IsBackground = true;
            reader.Start();

            Dictionary<string, object> ready = new Dictionary<string, object>();
            ready["event"] = "ready";
            Emit(ready);
            Application.Run(new ApplicationContext());
            return 0;
        }

        public static void Emit(Dictionary<string, object> d)
        {
            outbox.Add(Json.Write(d));
        }

        static void WriteLoop()
        {
            foreach (string line in outbox.GetConsumingEnumerable())
            {
                Console.Out.Write(line + "\n");
                Console.Out.Flush();
            }
        }

        static void ReadLoop()
        {
            string line;
            while ((line = Console.In.ReadLine()) != null)
            {
                string l = line;
                if (l.Trim().Length == 0) continue;
                invoker.BeginInvoke((MethodInvoker)delegate { Dispatch(l); });
            }
            // stdin closed: main is gone. Give the user their input back and exit.
            invoker.BeginInvoke((MethodInvoker)delegate
            {
                capture.Shutdown();
                injector.ReleaseAll();
                Application.Exit();
            });
        }

        static void Dispatch(string line)
        {
            Dictionary<string, object> c;
            try { c = Json.Parse(line); }
            catch (Exception) { return; }
            if (c == null) return;
            capture.Touch(); // any command resets the dead-man timer
            string cmd = Json.Str(c, "cmd", "");
            string error = null;
            try
            {
                switch (cmd)
                {
                    case "ping": case "keepalive": break;
                    case "kvmConfig":
                        capture.Side = Json.Str(c, "side", null);
                        capture.ResistancePx = Json.Num(c, "resistancePx", 120);
                        capture.HotkeyVk = Json.Str(c, "hotkey", "ControlRight") == "ControlLeft" ? 0xA2u : 0xA3u;
                        capture.DriveOther = Json.Bool(c, "driveOther", false);
                        capture.EdgeKeyboard = Json.Bool(c, "keyboard", true);
                        capture.DeadmanMs = (int)Json.Num(c, "deadmanMs", 1500);
                        capture.DoubleTapMs = (int)Json.Num(c, "doubleTapMs", 400);
                        break;
                    case "capture":
                        if (Json.Bool(c, "on", false)) capture.Begin(Json.Bool(c, "mouse", true), Json.Bool(c, "keyboard", true));
                        else capture.Stop(Json.Has(c, "offset") ? Json.Str(c, "side", null) : null, Json.Num(c, "offset", 0));
                        break;
                    case "place":
                        Point p = Json.Bool(c, "center", false) ? Screens.Center() : Screens.EdgePoint(Json.Str(c, "side", "left"), Json.Num(c, "offset", 0.5));
                        Native.SetCursorPos(p.X, p.Y);
                        break;
                    case "armReturn":
                        capture.ArmReturn(Json.Bool(c, "on", false), Json.Str(c, "side", null), Json.Num(c, "resistancePx", 120));
                        break;
                    case "inject":
                        Dictionary<string, object> ev = Json.Obj(c, "ev");
                        if (ev != null) injector.Apply(ev);
                        break;
                    case "releaseAll": injector.ReleaseAll(); break;
                    case "info":
                        Native.POINT cur;
                        Native.GetCursorPos(out cur);
                        c["cursor"] = new int[] { cur.x, cur.y };
                        c["capturing"] = capture.Capturing;
                        break;
                    default: error = "unknown command"; break;
                }
            }
            catch (Exception e) { error = e.Message; }

            if (!Json.Has(c, "id")) return;
            Dictionary<string, object> reply = new Dictionary<string, object>();
            reply["id"] = c["id"];
            reply["ok"] = error == null;
            if (error != null) reply["error"] = error;
            if (cmd == "info") { reply["cursor"] = c["cursor"]; reply["capturing"] = c["capturing"]; }
            Emit(reply);
        }
    }
}
