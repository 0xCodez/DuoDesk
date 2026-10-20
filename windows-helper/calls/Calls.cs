// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// macshare-calls: this PC as the phone's Bluetooth hands-free (a headset, as a car is), so a call's
// sound plays on the PC. Windows' one way is PhoneLineTransportDevice, which it lets only an app
// with a package identity and the phone line capabilities use: this .exe gets one from a sparse
// package (AppxManifest.xml, registered by windows/callaudio.js) that its own manifest names
// (macshare-calls.manifest). Windows' Bluetooth then carries the call's sound itself. A process of
// its own, run by windows/callaudio.js only while Calls and its Bluetooth option are on with a phone
// connected: macshare-winhelper never touches the phone line.
//
// JSON lines. In:  {"cmd": "info"} | {"cmd": "connect", "id"}
// Out: {"ev": "info", "identity", "address", "power", "devices": [{id, name}], "error"?}
//      {"ev": "state", "state": "connecting"|"connected"|"disconnected", "access"?, "error"?}
// stdin closed (TwinDesk gone, or the option off): the phone line is let go and this exits.
using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Windows.ApplicationModel.Calls;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;
using Windows.Devices.Radios;

[assembly: AssemblyTitle("TwinDesk")]
[assembly: AssemblyProduct("TwinDesk")]

namespace MacShare
{
    static class Calls
    {
        static readonly object gate = new object();
        static PhoneLineTransportDevice line; // the phone connected to, this app registered for it

        static int Main()
        {
            Console.InputEncoding = new UTF8Encoding(false);
            Console.OutputEncoding = new UTF8Encoding(false);
            string l;
            while ((l = Console.In.ReadLine()) != null)
            {
                Dictionary<string, object> m;
                try { m = Json.Parse(l); } catch (Exception) { continue; }
                string cmd = Json.Str(m, "cmd", "");
                try
                {
                    if (cmd == "info") Info().Wait();
                    else if (cmd == "connect") Connect(Json.Str(m, "id", "")).Wait();
                }
                catch (Exception e) { Console.Error.WriteLine(cmd + ": " + e.Message); }
            }
            Release();
            return 0;
        }

        static void Emit(Dictionary<string, object> d)
        {
            lock (gate)
            {
                Console.Out.Write(Json.Write(d) + "\n");
                Console.Out.Flush();
            }
        }

        static Dictionary<string, object> State(string state, string access, string error)
        {
            Dictionary<string, object> o = new Dictionary<string, object>();
            o["ev"] = "state";
            o["state"] = state;
            if (access != null) o["access"] = access;
            if (error != null) o["error"] = error;
            return o;
        }

        // Started through the sparse package's identity (else Windows refuses the phone line).
        static bool HasIdentity()
        {
            try { return Windows.ApplicationModel.Package.Current != null; }
            catch (Exception) { return false; }
        }

        // 0x001122AABBCC -> "00:11:22:AA:BB:CC" (the phone's way of writing it).
        static string Colons(ulong a)
        {
            string h = a.ToString("X12");
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < 12; i += 2) { if (i > 0) s.Append(':'); s.Append(h, i, 2); }
            return s.ToString();
        }

        // This PC's adapter and the phones Windows offers as hands-free gateways (paired, with HFP).
        static async Task Info()
        {
            Dictionary<string, object> o = new Dictionary<string, object>();
            o["ev"] = "info";
            o["identity"] = HasIdentity();
            o["address"] = "";
            o["power"] = false;
            List<object> devices = new List<object>();
            try
            {
                BluetoothAdapter a = await BluetoothAdapter.GetDefaultAsync();
                if (a != null)
                {
                    o["address"] = Colons(a.BluetoothAddress);
                    Radio r = await a.GetRadioAsync();
                    o["power"] = r != null && r.State == RadioState.On;
                }
            }
            catch (Exception e) { o["error"] = e.Message; }
            try
            {
                string sel = PhoneLineTransportDevice.GetDeviceSelector(PhoneLineTransport.Bluetooth);
                foreach (DeviceInformation d in await DeviceInformation.FindAllAsync(sel))
                {
                    Dictionary<string, object> x = new Dictionary<string, object>();
                    x["id"] = d.Id;
                    x["name"] = d.Name;
                    devices.Add(x);
                }
            }
            catch (Exception e) { o["error"] = e.Message; }
            o["devices"] = devices;
            Emit(o);
        }

        // Allowed, registered as the app for this phone line (in Phone Link's place), then the
        // hands-free link up: the phone lists this PC as a headset for calls.
        static async Task Connect(string id)
        {
            Emit(State("connecting", null, null));
            PhoneLineTransportDevice d;
            try { d = PhoneLineTransportDevice.FromId(id); }
            catch (Exception e) { Emit(State("disconnected", null, e.Message)); return; }
            if (d == null) { Emit(State("disconnected", null, "not found")); return; }
            DeviceAccessStatus acc;
            try { acc = await d.RequestAccessAsync(); }
            catch (Exception e) { Emit(State("disconnected", null, e.Message)); return; }
            if (acc != DeviceAccessStatus.Allowed) { Emit(State("disconnected", acc.ToString(), null)); return; }
            try
            {
                if (!d.IsRegistered()) d.RegisterApp();
                if (!await d.ConnectAsync()) { Emit(State("disconnected", "Allowed", "the phone didn't answer")); return; }
            }
            catch (Exception e) { Emit(State("disconnected", "Allowed", e.Message)); return; }
            if (line != null && line.DeviceId != d.DeviceId) Unregister(line);
            line = d;
            Emit(State("connected", null, null));
        }

        // Off means off: this app no longer the phone line's (Phone Link takes it again when it runs).
        static void Release()
        {
            if (line != null) Unregister(line);
            line = null;
        }

        static void Unregister(PhoneLineTransportDevice d)
        {
            try { if (d.IsRegistered()) d.UnregisterApp(); }
            catch (Exception e) { Console.Error.WriteLine("unregister: " + e.Message); }
        }
    }
}
