// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Under the parked pointer while it drives the other computer: an invisible top-most square of
// our own, so the window under the pointer is never the user's. The wheel hook already swallows the
// wheel, but a precision touchpad's scrolling (DirectManipulation) and some drivers (Synaptics,
// TrackPoint middle-button scroll) send it straight to the window under the pointer, and with
// "Scroll inactive windows" on that scrolled the app in the middle of the screen (issue #17).
// Here it lands on this square and does nothing. Never activated: the focus stays where it was.
using System.Drawing;
using System.Windows.Forms;

namespace MacShare
{
    class ParkPad : Form
    {
        const int SIZE = 64; // px around the park point

        public ParkPad()
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.Black;
            Opacity = 0.01; // layered and practically invisible, but still the window under the pointer
            Size = new Size(1, 1);
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

        public void Cover(Point p)
        {
            Rectangle r = new Rectangle(p.X - SIZE / 2, p.Y - SIZE / 2, SIZE, SIZE);
            if (Bounds != r) Bounds = r;
            if (!Visible) Show();
            else BringToFront();
        }

        public void Uncover()
        {
            if (Visible) Hide();
        }
    }
}
