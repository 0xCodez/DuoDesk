// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Drag files across the edge, PC → Mac (docs/ROADMAP.md, revision 2 R4): while the left button is
// held at home, an invisible top-most strip covers the outer edge facing the Mac. A file drag that
// enters it is cancelled locally (Esc), capture starts (the button is still down, so its release
// goes to the Mac) and main gets `edge {offset, drag:{paths}}`.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace MacShare
{
    class DropEdge : Form
    {
        readonly Capture capture;
        readonly Action<Dictionary<string, object>> emit;
        readonly Timer timer = new Timer();
        const int STRIP = 3; // px

        public DropEdge(Capture capture, Action<Dictionary<string, object>> emit)
        {
            this.capture = capture;
            this.emit = emit;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.Black;
            Opacity = 0.01; // layered and practically invisible, but still a drop target
            AllowDrop = true;
            Size = new Size(1, 1);
            DragEnter += OnDragEnter;
            timer.Interval = 50;
            timer.Tick += delegate { Follow(); };
            timer.Start();
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x80 | 0x08000000 | 0x8; // TOOLWINDOW | NOACTIVATE | TOPMOST
                return cp;
            }
        }

        // Shown only while the left button is held at home with edge crossing on, along the outer
        // edge of the monitor under the pointer.
        void Follow()
        {
            string side = capture.Side;
            bool held = (Native.GetAsyncKeyState(0x01) & 0x8000) != 0;
            if (!held || side == null || !capture.DriveOther || !capture.DragFiles || capture.Capturing) { if (Visible) Hide(); return; }
            Native.POINT p;
            Native.GetCursorPos(out p);
            Rectangle m = Screen.FromPoint(new Point(p.x, p.y)).Bounds;
            Point probe = side == "left" ? new Point(m.Left, p.y) : side == "right" ? new Point(m.Right - 1, p.y)
                : side == "top" ? new Point(p.x, m.Top) : new Point(p.x, m.Bottom - 1);
            if (!Screens.OnOuterEdge(probe.X, probe.Y, side)) { if (Visible) Hide(); return; }
            Rectangle r = side == "left" ? new Rectangle(m.Left, m.Top, STRIP, m.Height)
                : side == "right" ? new Rectangle(m.Right - STRIP, m.Top, STRIP, m.Height)
                : side == "top" ? new Rectangle(m.Left, m.Top, m.Width, STRIP)
                : new Rectangle(m.Left, m.Bottom - STRIP, m.Width, STRIP);
            if (Bounds != r) Bounds = r;
            if (!Visible) Show();
        }

        void OnDragEnter(object sender, DragEventArgs e)
        {
            e.Effect = DragDropEffects.None;
            if (!e.Data.GetDataPresent(DataFormats.FileDrop) || capture.Capturing) return;
            string[] paths = e.Data.GetData(DataFormats.FileDrop) as string[];
            if (paths == null || paths.Length == 0) return;
            Hide();
            // Leave the drag loop's callback first, then cancel the local drag and cross.
            BeginInvoke((MethodInvoker)delegate
            {
                Injector.Escape(); // ends Explorer's drag (marked, so our own hooks ignore it)
                Native.POINT p;
                Native.GetCursorPos(out p);
                double offset = Screens.Offset(p.x, p.y, capture.Side);
                capture.Begin(true, capture.EdgeKeyboard);
                Dictionary<string, object> d = new Dictionary<string, object>();
                d["event"] = "edge";
                d["offset"] = Math.Round(offset, 4);
                Dictionary<string, object> drag = new Dictionary<string, object>();
                drag["paths"] = paths;
                d["drag"] = drag;
                emit(d);
            });
        }
    }
}
