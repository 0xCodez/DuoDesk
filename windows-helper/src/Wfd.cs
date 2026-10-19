// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// A Wi-Fi network for the other device to join (files and screens for a session through Bluetooth,
// shared/netlink.js): Wi-Fi Direct's "legacy" access point, which any device joins like any Wi-Fi
// (a Mac, a phone, another PC) while this PC stays on its own Wi-Fi.
using System;
using System.Threading.Tasks;
using Windows.Devices.Enumeration;
using Windows.Devices.WiFiDirect;
using Windows.Security.Credentials;

namespace MacShare
{
    class WfdHost
    {
        WiFiDirectAdvertisementPublisher pub;

        public async Task<bool> Can()
        {
            try
            {
                DeviceInformationCollection list = await DeviceInformation.FindAllAsync(WiFiDirectDevice.GetDeviceSelector());
                return list.Count > 0;
            }
            catch (Exception) { return false; }
        }

        public async Task Start(string ssid, string pass)
        {
            Stop();
            WiFiDirectAdvertisementPublisher p = new WiFiDirectAdvertisementPublisher();
            p.Advertisement.IsAutonomousGroupOwnerEnabled = true;
            p.Advertisement.LegacySettings.IsEnabled = true;
            p.Advertisement.LegacySettings.Ssid = ssid;
            PasswordCredential cred = new PasswordCredential();
            cred.Password = pass;
            p.Advertisement.LegacySettings.Passphrase = cred;
            TaskCompletionSource<string> started = new TaskCompletionSource<string>();
            p.StatusChanged += (s, e) =>
            {
                if (e.Status == WiFiDirectAdvertisementPublisherStatus.Started) started.TrySetResult(null);
                else if (e.Status == WiFiDirectAdvertisementPublisherStatus.Aborted) started.TrySetResult("aborted (" + e.Error + ")");
            };
            pub = p;
            p.Start();
            Task done = await Task.WhenAny(started.Task, Task.Delay(10000));
            if (done != started.Task) { Stop(); throw new Exception("Wi-Fi Direct didn't start"); }
            if (started.Task.Result != null) { Stop(); throw new Exception("Wi-Fi Direct " + started.Task.Result); }
            Net.Log("hosting " + ssid);
        }

        public void Stop()
        {
            WiFiDirectAdvertisementPublisher p = pub;
            pub = null;
            if (p != null) try { p.Stop(); } catch (Exception) { }
        }
    }
}
