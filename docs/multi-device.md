# Multi-device

TwinDesk is a one-to-one app: one computer with another computer, or with a phone. Multi-device is an
option on top of it, built on the mesh from pull request #29 by Erdoğan Yeşil (@erdodo): many computers
and phones connected at once, one clipboard and one notification pool for all of them, each screen edge
leading to a different device, a phone and a computer connected at the same time.

It is off by default, and while it is off TwinDesk runs exactly the code it runs today.

## Rules

1. **Off means today's app.** With Multi-device off nothing of the mesh is loaded: no module, no
   listener, no extra field on the wire. The one-to-one connection code (`server.js`, `link.js`,
   `peer.js`, `hostpair.js`/`pairing.js`, `kvm.js`, `clip.js`/`clipboard.js`, `notifs.js`, `phone*.js`,
   `wired.js`, …) is not changed for it. The one-to-one app only gains the switch: one line in
   `main.js`, `multi.js`, and the Multi-device tab.
2. **One switch, read at start.** Multi-device tab › *Use several devices at once* › Turn on / Turn off.
   It is `on` in `multi.json`; `main.js` reads it once, right after it sets the user data folder, and with
   it on hands over to `mesh/main.js`. Changing it restarts TwinDesk (as Quit, then start again), so the
   two never run side by side; the window comes back on the Multi-device tab.
3. **Everything for several devices is in the Multi-device tab**: the layout of the screens (which device
   each edge leads to) and *Join every device automatically*. The device list is the sidebar's. The
   other tabs stay as they are.
4. **Storage of its own.** The one-to-one app's files are read by the mesh, never written:

   | | one-to-one app | mesh |
   | --- | --- | --- |
   | hosts this computer dials | `pairing.json` (Windows), `hosts.json` (Mac) | `pairings.json`, `hosts-mesh.json` |
   | devices that dial this computer | `paired.json` | `paired-mesh.json` |
   | settings only the mesh has | – | `multi.json` (`layout`, `mesh`, Windows `kvm.edges`) |

   A pairing of the one-to-one app joins the mesh's list once (`multi.json` › `imported`): one forgotten
   in the mesh stays forgotten, one paired again in the one-to-one app joins again. Settings both have
   (speed, clipboard, …) stay in `settings.json`, the same choices in both; `kvm.pcSide` is kept.
   Switching off gives back exactly what was there.
5. **Older devices and devices with it off** are plain one-to-one peers to a multi-device one: no
   roster, no relayed items. Their `kvm.layout` places them where they say, as the one-to-one app does;
   between mesh devices the shared layout is the one map.
6. **Native helpers** are one binary each. What the mesh adds (several watched sides) is used only when
   the mesh sends it; without it a helper does what it does today. Until the helpers know several sides,
   the mesh sends the first one as `side` too, so today's helpers watch that one.
7. **Android, first release: unchanged.** A multi-device computer sees today's phone app as a plain
   one-to-one device. A phone with several computers at once comes later, behind its own switch.
8. **Linux** stays one-to-one for now: the mesh has no Linux link layer yet.
9. **Join every device automatically** is off by default: with it on, a paired device can add another
   device to this one without a pairing code.

## Where things are

- `shared/mesh.js`, `intro.js`, `layout.js`, `kvm-edges.js`, `screen-mesh.js`, `sidebar-model.js`,
  `notif-guard.js`: the mesh core, plain JS for every platform. Tests in `shared/test/`.
- `windows/multi.js`, `mac/multi.js`: the switch. `ui-multi.js`: the tab with it off.
- `windows/mesh/`: the Windows app with Multi-device on. `main.js`, `ipc.js`, `preload-app.js`; the link
  layer (`server`, `link`, `hostpair`, `links`, `session`, `hub`); the features (`clip`, `notifs`, `kvm`,
  `layout-sync`, `autojoin`, `phones`, `phone`, `phone-link`, `phone-bridge`, `wired`, `pcscreen`,
  `pcscreenset`, `sender`); `settings` and `store` (its files, rule 4); the window (`app.html` with
  `<base href="../">`, so everything it doesn't have loads from `windows/`, its `app.js`, pages and css,
  `ui-multi.js`).
- `mac/mesh/`: the same for the Mac (`services`, `pairing`, `clipboard`, `stream`/`streams`, `displays`,
  `control.html`, …).
- A file in `mesh/` named like one a folder up is its mesh version: when a fix there applies to both,
  make it in both.
- The design: [mesh.md](mesh.md) and [screen-mesh.md](screen-mesh.md).

Tests: `node <file>` for each of `shared/test/*.js`, `windows/mesh/test/*.js` and `mac/mesh/test/*.js`,
with `NODE_PATH` set to `windows/node_modules`. `switch.test.js` checks rule 1 (off: nothing of the
mesh is loaded) and the hand-over; `storage.test.js` checks rule 4. The installers leave `test` folders
out.

## Steps

1. Import the mesh as new files, its tests passing. *(done)*
2. Windows and Mac: the switch and the Multi-device tab, the mesh app in `mesh/`, its own storage,
   `kvm.layout` from older peers. *(done)*
3. Helpers: several watched sides (Windows `Capture.cs`, Mac `Capture.swift`), used only when `sides` is
   sent; the extra edge logging left out.
4. Real devices: two computers and a phone with the switch off (must match today), then on.
5. Android: several computers at once, behind its own switch.
6. Linux.

## Not part of this

- The clipboard rework in the mesh fork (images, files, the latest copy wins, a Recent list) changes
  today's clipboard: a pull request of its own.
- Pull request #28 (a phone and a computer at once, several edges) is what Multi-device does; here it
  lives behind the switch.
- The mesh fork's log file (`shared/logfile.js`).

## Credit

The mesh is Erdoğan Yeşil's work (@erdodo, pull request #29). Files he wrote or changed carry both
names; commits built on it carry `Co-authored-by: Erdoğan Yeşil <erdoganyesil3@gmail.com>`.
