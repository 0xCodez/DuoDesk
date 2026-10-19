// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Bluetooth LE (shared/protocol.js P.BLE), for a device that isn't on this PC's network.
//   BleHost:  this PC hosts the session: a GATT server that advertises the TwinDesk service. A
//             guest reads INFO, says hello on CTRL, opens a pipe and writes UP; we notify DOWN.
//   BleGuest: this PC connects to a host: scan for the service, read INFO, open the pipe.
// main joins the pipe to the session's socket (shared/blepipe.js). Every device is keyed by a
// string: the host side's GattSession device id, the guest side's Bluetooth address in hex.
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;

namespace MacShare
{
    static class BleIds
    {
        public static readonly Guid Service = new Guid("b7f30001-2c4e-4d1a-9a57-3e8c2f6d0a91");
        public static readonly Guid Info = new Guid("b7f30002-2c4e-4d1a-9a57-3e8c2f6d0a91");
        public static readonly Guid Ctrl = new Guid("b7f30003-2c4e-4d1a-9a57-3e8c2f6d0a91");
        public static readonly Guid Up = new Guid("b7f30004-2c4e-4d1a-9a57-3e8c2f6d0a91");
        public static readonly Guid Down = new Guid("b7f30005-2c4e-4d1a-9a57-3e8c2f6d0a91");

        public static string Text(byte[] b)
        {
            return b == null ? "" : Encoding.UTF8.GetString(b);
        }
    }

    class BleHost
    {
        GattServiceProvider provider;
        GattLocalCharacteristic ctrl, down;
        readonly ConcurrentDictionary<string, GattSubscribedClient> clients = new ConcurrentDictionary<string, GattSubscribedClient>();
        readonly ConcurrentDictionary<string, Sender> senders = new ConcurrentDictionary<string, Sender>();
        // UP writes may finish out of order (each awaits its request): numbered as they arrive,
        // passed on in that order.
        readonly object upGate = new object();
        long upTicket, upNext = 1;
        readonly SortedDictionary<long, KeyValuePair<string, byte[]>> upDone = new SortedDictionary<long, KeyValuePair<string, byte[]>>();
        string lastState = "";

        void State(string s)
        {
            if (s == lastState) return;
            lastState = s;
            Net.Event("ble.state", null, "state", s);
        }

        public async Task Start(string info)
        {
            Stop();
            BluetoothAdapter a = await BluetoothAdapter.GetDefaultAsync();
            if (a == null) { State("unsupported"); throw new Exception("no Bluetooth"); }
            if (!a.IsPeripheralRoleSupported) { State("unsupported"); throw new Exception("this PC's Bluetooth can't advertise"); }
            GattServiceProviderResult r = await GattServiceProvider.CreateAsync(BleIds.Service);
            if (r.Error != BluetoothError.Success)
            {
                State(r.Error == BluetoothError.RadioNotAvailable ? "off" : "unsupported");
                throw new Exception("Bluetooth: " + r.Error);
            }
            GattServiceProvider p = r.ServiceProvider;

            GattLocalCharacteristicParameters ip = new GattLocalCharacteristicParameters();
            ip.CharacteristicProperties = GattCharacteristicProperties.Read;
            ip.ReadProtectionLevel = GattProtectionLevel.Plain;
            ip.StaticValue = Encoding.UTF8.GetBytes(info).AsBuffer();
            await p.Service.CreateCharacteristicAsync(BleIds.Info, ip);

            GattLocalCharacteristicParameters cp = new GattLocalCharacteristicParameters();
            cp.CharacteristicProperties = GattCharacteristicProperties.Write | GattCharacteristicProperties.Notify;
            cp.WriteProtectionLevel = GattProtectionLevel.Plain;
            GattLocalCharacteristic c = (await p.Service.CreateCharacteristicAsync(BleIds.Ctrl, cp)).Characteristic;

            GattLocalCharacteristicParameters upp = new GattLocalCharacteristicParameters();
            upp.CharacteristicProperties = GattCharacteristicProperties.Write | GattCharacteristicProperties.WriteWithoutResponse;
            upp.WriteProtectionLevel = GattProtectionLevel.Plain;
            GattLocalCharacteristic u = (await p.Service.CreateCharacteristicAsync(BleIds.Up, upp)).Characteristic;

            GattLocalCharacteristicParameters dp = new GattLocalCharacteristicParameters();
            dp.CharacteristicProperties = GattCharacteristicProperties.Notify;
            GattLocalCharacteristic d = (await p.Service.CreateCharacteristicAsync(BleIds.Down, dp)).Characteristic;

            c.WriteRequested += OnCtrl;
            u.WriteRequested += OnUp;
            d.SubscribedClientsChanged += OnSubscribers;
            p.AdvertisementStatusChanged += (s, e) =>
            {
                if (e.Status == GattServiceProviderAdvertisementStatus.Aborted) State("off");
                else if (e.Status == GattServiceProviderAdvertisementStatus.Started) State("on");
            };
            GattServiceProviderAdvertisingParameters ap = new GattServiceProviderAdvertisingParameters();
            ap.IsConnectable = true;
            ap.IsDiscoverable = true;
            ctrl = c;
            down = d;
            provider = p;
            p.StartAdvertising(ap);
            State("on");
        }

        public void Stop()
        {
            GattServiceProvider p = provider;
            provider = null;
            if (p != null) try { p.StopAdvertising(); } catch (Exception) { }
            foreach (string dev in clients.Keys) Net.Event("ble.gone", dev, null, null);
            clients.Clear();
            foreach (Sender s in senders.Values) s.Stop();
            senders.Clear();
        }

        // Bytes for a guest's pipe (DOWN). False: not one of our guests (BleGuest's, then).
        public bool Send(string dev, byte[] data)
        {
            GattSubscribedClient c;
            if (!clients.TryGetValue(dev, out c)) return false;
            SenderOf(dev, c).Add(down, data);
            return true;
        }

        public void Ctrl(string dev, string json)
        {
            GattSubscribedClient c;
            if (clients.TryGetValue(dev, out c)) SenderOf(dev, c).Add(ctrl, Encoding.UTF8.GetBytes(json));
        }

        Sender SenderOf(string dev, GattSubscribedClient c)
        {
            return senders.GetOrAdd(dev, k => new Sender(dev, c, down));
        }

        void OnSubscribers(GattLocalCharacteristic sender, object args)
        {
            HashSet<string> now = new HashSet<string>();
            foreach (GattSubscribedClient c in sender.SubscribedClients)
            {
                string dev = c.Session.DeviceId.Id;
                now.Add(dev);
                clients[dev] = c;
            }
            foreach (string dev in new List<string>(clients.Keys))
            {
                if (now.Contains(dev)) continue;
                GattSubscribedClient gone;
                clients.TryRemove(dev, out gone);
                Sender s;
                if (senders.TryRemove(dev, out s)) s.Stop();
                Net.Event("ble.gone", dev, null, null);
            }
        }

        void OnCtrl(GattLocalCharacteristic sender, GattWriteRequestedEventArgs args)
        {
            Windows.Foundation.Deferral d = args.GetDeferral();
            string dev = args.Session.DeviceId.Id;
            Task.Run(async () =>
            {
                string text = "";
                try
                {
                    GattWriteRequest req = await args.GetRequestAsync();
                    if (req != null)
                    {
                        text = BleIds.Text(req.Value.ToArray());
                        if (req.Option == GattWriteOption.WriteWithResponse) req.Respond();
                    }
                }
                catch (Exception e) { Net.Log("ctrl: " + e.Message); }
                finally { d.Complete(); }
                Dictionary<string, object> o = null;
                try { o = Json.Parse(text); } catch (Exception) { }
                string op = Json.Str(o, "op", "");
                if (op == "hello") Net.Event("ble.guest", dev, "hello", o);
                else if (op == "open")
                {
                    Sender s;
                    if (senders.TryRemove(dev, out s)) s.Stop(); // nothing from an old pipe goes out
                    Net.Event("ble.open", dev, null, null);
                }
                else if (op == "close") Net.Event("ble.close", dev, null, null);
                else if (op == "invite") Net.Event("ble.invite", dev, "id", Json.Str(o, "id", "")); // a Mac asks us to connect (BleGuest finds it by id)
            });
        }

        void OnUp(GattLocalCharacteristic sender, GattWriteRequestedEventArgs args)
        {
            long ticket = Interlocked.Increment(ref upTicket);
            Windows.Foundation.Deferral d = args.GetDeferral();
            string dev = args.Session.DeviceId.Id;
            Task.Run(async () =>
            {
                byte[] bytes = null;
                try
                {
                    GattWriteRequest req = await args.GetRequestAsync();
                    if (req != null)
                    {
                        bytes = req.Value.ToArray();
                        if (req.Option == GattWriteOption.WriteWithResponse) req.Respond();
                    }
                }
                catch (Exception e) { Net.Log("up: " + e.Message); }
                finally { d.Complete(); }
                lock (upGate)
                {
                    upDone[ticket] = new KeyValuePair<string, byte[]>(dev, bytes);
                    KeyValuePair<string, byte[]> next;
                    while (upDone.TryGetValue(upNext, out next))
                    {
                        upDone.Remove(upNext);
                        upNext++;
                        if (next.Value != null && next.Value.Length > 0) Net.Event("ble.data", next.Key, "data", Convert.ToBase64String(next.Value));
                    }
                }
            });
        }

        // One guest's notifications, in order, each waiting for the last (Windows queues them otherwise).
        class Sender
        {
            readonly BlockingCollection<KeyValuePair<GattLocalCharacteristic, byte[]>> q = new BlockingCollection<KeyValuePair<GattLocalCharacteristic, byte[]>>();
            readonly string dev;
            readonly GattSubscribedClient client;
            readonly GattLocalCharacteristic down;

            public Sender(string dev, GattSubscribedClient client, GattLocalCharacteristic down)
            {
                this.dev = dev;
                this.client = client;
                this.down = down;
                Thread t = new Thread(Loop);
                t.IsBackground = true;
                t.Start();
            }

            public void Add(GattLocalCharacteristic chr, byte[] data)
            {
                try { q.Add(new KeyValuePair<GattLocalCharacteristic, byte[]>(chr, data)); } catch (InvalidOperationException) { }
            }

            public void Stop()
            {
                q.CompleteAdding();
            }

            void Loop()
            {
                foreach (KeyValuePair<GattLocalCharacteristic, byte[]> item in q.GetConsumingEnumerable())
                {
                    int max = 20;
                    try { max = Math.Max(20, (int)client.MaxNotificationSize); } catch (Exception) { }
                    byte[] data = item.Value;
                    int sent = 0;
                    for (int i = 0; i < data.Length; i += max)
                    {
                        int n = Math.Min(max, data.Length - i);
                        byte[] chunk = new byte[n];
                        Buffer.BlockCopy(data, i, chunk, 0, n);
                        try
                        {
                            GattClientNotificationResult r = item.Key.NotifyValueAsync(chunk.AsBuffer(), client).AsTask().Result;
                            if (r.Status != GattCommunicationStatus.Success) { Net.Log("notify: " + r.Status); break; }
                        }
                        catch (Exception e) { Net.Log("notify: " + e.Message); break; }
                        sent += n;
                    }
                    if (item.Key == down && sent > 0) Net.Event("ble.sent", dev, "bytes", sent);
                }
            }
        }
    }

    class BleGuest
    {
        BluetoothLEAdvertisementWatcher watcher;
        readonly ConcurrentDictionary<string, string> infos = new ConcurrentDictionary<string, string>(); // dev -> INFO JSON
        readonly ConcurrentDictionary<string, DateTime> told = new ConcurrentDictionary<string, DateTime>(); // dev -> last ble.found
        readonly ConcurrentDictionary<string, DateTime> reading = new ConcurrentDictionary<string, DateTime>(); // dev -> started reading
        readonly ConcurrentDictionary<string, Pipe> pipes = new ConcurrentDictionary<string, Pipe>();

        public void Scan(bool on)
        {
            if (on && watcher == null)
            {
                BluetoothLEAdvertisementWatcher w = new BluetoothLEAdvertisementWatcher();
                w.ScanningMode = BluetoothLEScanningMode.Active;
                w.AdvertisementFilter.Advertisement.ServiceUuids.Add(BleIds.Service);
                w.Received += OnAdvertisement;
                w.Stopped += (s, e) =>
                {
                    if (e.Error != BluetoothError.Success) Net.Event("ble.state", null, "state", e.Error == BluetoothError.RadioNotAvailable ? "off" : "unsupported");
                };
                watcher = w;
                try
                {
                    w.Start();
                    Net.Event("ble.state", null, "state", "on");
                }
                catch (Exception e) { Net.Log("scan: " + e.Message); watcher = null; }
            }
            else if (!on && watcher != null)
            {
                try { watcher.Stop(); } catch (Exception) { }
                watcher = null;
            }
        }

        void OnAdvertisement(BluetoothLEAdvertisementWatcher w, BluetoothLEAdvertisementReceivedEventArgs args)
        {
            ulong addr = args.BluetoothAddress;
            string dev = addr.ToString("X12");
            string info;
            if (infos.TryGetValue(dev, out info))
            {
                DateTime last;
                if (told.TryGetValue(dev, out last) && (DateTime.UtcNow - last).TotalSeconds < 3) return;
                told[dev] = DateTime.UtcNow;
                Net.Event("ble.found", dev, "info", info);
                return;
            }
            DateTime started;
            if (reading.TryGetValue(dev, out started) && (DateTime.UtcNow - started).TotalSeconds < 15) return; // also: tried and failed lately
            reading[dev] = DateTime.UtcNow;
            Task.Run(() => ReadInfo(addr, dev));
        }

        async Task ReadInfo(ulong addr, string dev)
        {
            BluetoothLEDevice d = null;
            try
            {
                d = await BluetoothLEDevice.FromBluetoothAddressAsync(addr);
                if (d == null) return;
                GattDeviceServicesResult sr = await d.GetGattServicesForUuidAsync(BleIds.Service, BluetoothCacheMode.Uncached);
                if (sr.Status != GattCommunicationStatus.Success || sr.Services.Count == 0) return;
                GattDeviceService svc = sr.Services[0];
                GattCharacteristicsResult cr = await svc.GetCharacteristicsForUuidAsync(BleIds.Info, BluetoothCacheMode.Uncached);
                if (cr.Status == GattCommunicationStatus.Success && cr.Characteristics.Count > 0)
                {
                    GattReadResult rr = await cr.Characteristics[0].ReadValueAsync(BluetoothCacheMode.Uncached);
                    if (rr.Status == GattCommunicationStatus.Success)
                    {
                        string info = BleIds.Text(rr.Value.ToArray());
                        infos[dev] = info;
                        told[dev] = DateTime.UtcNow;
                        Net.Event("ble.found", dev, "info", info);
                    }
                }
                svc.Dispose();
            }
            catch (Exception e) { Net.Log("read " + dev + ": " + e.Message); }
            finally { if (d != null) d.Dispose(); }
        }

        public void Open(string dev, string hello)
        {
            Close(dev);
            Pipe p = new Pipe(dev);
            pipes[dev] = p;
            Task.Run(async () =>
            {
                try { await p.Open(hello); }
                catch (Exception e)
                {
                    Net.Log("open " + dev + ": " + e.Message);
                    Pipe x;
                    if (pipes.TryGetValue(dev, out x) && x == p) pipes.TryRemove(dev, out x);
                    p.Dispose();
                    Net.Event("ble.close", dev, "error", e.Message);
                }
            });
        }

        public void Send(string dev, byte[] data)
        {
            Pipe p;
            if (pipes.TryGetValue(dev, out p)) p.Add(data);
        }

        public void Close(string dev)
        {
            Pipe p;
            if (pipes.TryRemove(dev, out p)) p.Dispose();
        }

        public void StopAll()
        {
            Scan(false);
            foreach (string dev in new List<string>(pipes.Keys)) Close(dev);
        }

        // One pipe to a host: its own connection, CTRL and DOWN notifications, UP writes in order.
        class Pipe
        {
            readonly string dev;
            BluetoothLEDevice device;
            GattSession session;
            GattDeviceService svc;
            GattCharacteristic ctrl, up, down;
            readonly BlockingCollection<byte[]> q = new BlockingCollection<byte[]>();
            volatile bool alive = true;

            public Pipe(string dev)
            {
                this.dev = dev;
            }

            public async Task Open(string hello)
            {
                device = await BluetoothLEDevice.FromBluetoothAddressAsync(Convert.ToUInt64(dev, 16));
                if (device == null) throw new Exception("not found");
                session = await GattSession.FromDeviceIdAsync(device.BluetoothDeviceId);
                session.MaintainConnection = true;
                GattDeviceServicesResult sr = await device.GetGattServicesForUuidAsync(BleIds.Service, BluetoothCacheMode.Uncached);
                if (sr.Status != GattCommunicationStatus.Success || sr.Services.Count == 0) throw new Exception("no TwinDesk service (" + sr.Status + ")");
                svc = sr.Services[0];
                ctrl = await Chr(BleIds.Ctrl);
                up = await Chr(BleIds.Up);
                down = await Chr(BleIds.Down);
                ctrl.ValueChanged += OnCtrl;
                down.ValueChanged += OnDown;
                foreach (GattCharacteristic c in new[] { ctrl, down })
                {
                    GattCommunicationStatus st = await c.WriteClientCharacteristicConfigurationDescriptorAsync(GattClientCharacteristicConfigurationDescriptorValue.Notify);
                    if (st != GattCommunicationStatus.Success) throw new Exception("subscribe: " + st);
                }
                device.ConnectionStatusChanged += (s, e) =>
                {
                    if (s.ConnectionStatus == BluetoothConnectionStatus.Disconnected && alive) Net.Event("ble.gone", dev, null, null);
                };
                Dictionary<string, object> h = null;
                try { h = Json.Parse(hello); } catch (Exception) { }
                if (h == null) h = new Dictionary<string, object>();
                h["op"] = "hello";
                await Write(ctrl, Json.Write(h));
                await Write(ctrl, "{\"op\":\"open\"}");
                Thread t = new Thread(Loop);
                t.IsBackground = true;
                t.Start();
                Net.Event("ble.opened", dev, null, null);
            }

            async Task<GattCharacteristic> Chr(Guid id)
            {
                GattCharacteristicsResult r = await svc.GetCharacteristicsForUuidAsync(id, BluetoothCacheMode.Uncached);
                if (r.Status != GattCommunicationStatus.Success || r.Characteristics.Count == 0) throw new Exception("characteristic missing");
                return r.Characteristics[0];
            }

            async Task Write(GattCharacteristic c, string text)
            {
                GattWriteResult r = await c.WriteValueWithResultAsync(Encoding.UTF8.GetBytes(text).AsBuffer(), GattWriteOption.WriteWithResponse);
                if (r.Status != GattCommunicationStatus.Success) throw new Exception("write: " + r.Status);
            }

            readonly object downGate = new object();

            void OnDown(GattCharacteristic c, GattValueChangedEventArgs args)
            {
                lock (downGate) Net.Event("ble.data", dev, "data", Convert.ToBase64String(args.CharacteristicValue.ToArray()));
            }

            void OnCtrl(GattCharacteristic c, GattValueChangedEventArgs args)
            {
                Dictionary<string, object> o = null;
                try { o = Json.Parse(BleIds.Text(args.CharacteristicValue.ToArray())); } catch (Exception) { }
                string op = Json.Str(o, "op", "");
                if (op == "invite") Net.Event("ble.invite", dev, null, null);
                else if (op == "closed") Net.Event("ble.close", dev, null, null);
            }

            public void Add(byte[] data)
            {
                try { q.Add(data); } catch (InvalidOperationException) { }
            }

            void Loop()
            {
                foreach (byte[] data in q.GetConsumingEnumerable())
                {
                    int max = 20;
                    try { max = Math.Min(512, Math.Max(20, session.MaxPduSize - 3)); } catch (Exception) { } // an attribute value is at most 512 bytes
                    for (int i = 0; i < data.Length && alive; i += max)
                    {
                        int n = Math.Min(max, data.Length - i);
                        byte[] chunk = new byte[n];
                        Buffer.BlockCopy(data, i, chunk, 0, n);
                        bool ok = false;
                        for (int tries = 0; tries < 20 && !ok && alive; tries++)
                        {
                            // With response: a write without response may be dropped, and one lost byte breaks the TLS.
                            try { ok = up.WriteValueWithResultAsync(chunk.AsBuffer(), GattWriteOption.WriteWithResponse).AsTask().Result.Status == GattCommunicationStatus.Success; }
                            catch (Exception) { }
                            if (!ok) Thread.Sleep(20);
                        }
                        if (!ok) // a lost chunk breaks the session's TLS: end this pipe, main opens another
                        {
                            if (alive) Net.Event("ble.close", dev, "error", "write failed");
                            Dispose();
                            return;
                        }
                    }
                    Net.Event("ble.sent", dev, "bytes", data.Length);
                }
            }

            public void Dispose()
            {
                if (!alive) return;
                alive = false;
                q.CompleteAdding();
                if (ctrl != null)
                {
                    try { ctrl.WriteValueWithResultAsync(Encoding.UTF8.GetBytes("{\"op\":\"close\"}").AsBuffer(), GattWriteOption.WriteWithResponse); } catch (Exception) { }
                }
                try { if (session != null) session.Dispose(); } catch (Exception) { }
                try { if (svc != null) svc.Dispose(); } catch (Exception) { }
                try { if (device != null) device.Dispose(); } catch (Exception) { }
            }
        }
    }
}
