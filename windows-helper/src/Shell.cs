// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Where is the pointer, file-wise? The folder of the Explorer window under it, or the Desktop
// (docs/ROADMAP.md "Drag files across the screen edge": the receiver places files there).
using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

namespace MacShare
{
    static class Shell
    {
        [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Native.POINT p);
        [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);

        // path = an existing folder, or null; desktop = the pointer is on the desktop.
        public static void FolderAt(out string path, out bool desktop)
        {
            path = null;
            desktop = false;
            Native.POINT p;
            Native.GetCursorPos(out p);
            IntPtr root = GetAncestor(WindowFromPoint(p), 2); // GA_ROOT
            StringBuilder cls = new StringBuilder(64);
            GetClassName(root, cls, cls.Capacity);
            string c = cls.ToString();
            if (c == "Progman" || c == "WorkerW")
            {
                desktop = true;
                path = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                return;
            }
            if (c != "CabinetWClass" && c != "ExploreWClass") return;
            try
            {
                Type t = Type.GetTypeFromProgID("Shell.Application");
                object shell = Activator.CreateInstance(t);
                object windows = Call(shell, "Windows");
                int count = Convert.ToInt32(Get(windows, "Count"));
                for (int i = 0; i < count; i++)
                {
                    object w = Call(windows, "Item", i);
                    if (w == null) continue;
                    long h;
                    try { h = Convert.ToInt64(Get(w, "HWND")); } catch (Exception) { continue; }
                    if (h != root.ToInt64()) continue;
                    // Windows 11 tabs share one HWND; the first tab found wins.
                    string fp = Get(Get(Get(Get(w, "Document"), "Folder"), "Self"), "Path") as string;
                    if (fp != null && Directory.Exists(fp)) { path = fp; return; }
                }
            }
            catch (Exception) { /* no folder: the caller falls back to Downloads */ }
        }

        static object Get(object o, string name)
        {
            return o == null ? null : o.GetType().InvokeMember(name, BindingFlags.GetProperty, null, o, null);
        }

        static object Call(object o, string name, params object[] args)
        {
            return o == null ? null : o.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, o, args);
        }
    }
}
