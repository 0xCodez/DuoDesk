# Multi-device

TwinDesk is a one-to-one app: one computer with another computer, or with a phone. Multi-device is an
option on top of it, built on the mesh from pull request #29 by Erdoğan Yeşil (@erdodo): many computers
and phones connected at once, one clipboard and one notification pool for all of them, each screen edge
leading to a different device, a phone and a computer connected at the same time.

It is off by default, and while it is off TwinDesk runs exactly the code it runs today.

## Rules

1. **Off means today's app.** With Multi-device off nothing of the mesh is loaded: no module, no
   listener, no extra field on the wire. The one-to-one files (`server.js`, `link.js`, `peer.js`,
   `hostpair.js`, `kvm.js`, `clip.js`, `notifs.js`, `phone*.js`, `wired.js`, …) are not changed for it.
2. **One switch, read at start.** Multi-device tab › *Use several devices at once*. Changing it restarts
   TwinDesk, so the two never run side by side.
3. **Everything for several devices is in the Multi-device tab**: the device list, the layout of the
   screens, *Join every device automatically*, screen sharing per device, clipboard and notifications
   for all. The other tabs stay as they are.
4. **Storage of its own.** The mesh keeps its pairings, layout and settings apart. It starts from
   today's pairing but never rewrites or deletes it, nor `kvm.pcSide`: switching off gives back exactly
   what was there.
5. **Older devices and devices with it off** are plain one-to-one peers to a multi-device one: no
   roster, no relayed items, `kvm.layout` answered as today.
6. **Native helpers** are one binary each. What the mesh adds (several watched sides) is used only when
   the mesh sends it; without it a helper does what it does today.
7. **Android, first release: unchanged.** A multi-device computer sees today's phone app as a plain
   one-to-one device. A phone with several computers at once comes later, behind its own switch.
8. **Linux** stays one-to-one for now.
9. **Join every device automatically** is off by default: with it on, a paired device can add another
   device to this one without a pairing code.

## Where things are

- `shared/mesh.js`, `intro.js`, `layout.js`, `kvm-edges.js`, `screen-mesh.js`, `sidebar-model.js`,
  `notif-guard.js`: the mesh core, plain JS for every platform. Tests in `shared/test/`.
- `windows/mesh/`: the Windows mesh stack, loaded only with Multi-device on. The link layer (`server`,
  `link`, `hostpair`, `links`, `session`, `hub`), the features (`clip`, `notifs`, `kvm`, `layout-sync`,
  `autojoin`, `phones`, `phone`, `phone-link`, `pcscreenset`) and `settings`. Files named like one in
  `windows/` are its mesh version: when a fix there applies to both, make it in both. Tests in
  `windows/mesh/test/` (left out of the installer).
- `mac/mesh/`: to come, the same way.
- The design: [mesh.md](mesh.md) and [screen-mesh.md](screen-mesh.md).

Tests: `node shared/test/<file>.js` and `node windows/mesh/test/<file>.js`, with `NODE_PATH` set to
`windows/node_modules`.

## Steps

1. Import the mesh as new files, its tests passing. *(done)*
2. Windows: the switch and the Multi-device tab; `main.js` starts the mesh stack instead of today's when
   it is on (one branch, read at start); its own storage.
3. Windows: `kvm.layout` from older peers answered; the helper's extra logging left out.
4. The Mac, the same way.
5. Real devices: two computers and a phone with the switch off (must match today), then on.
6. Android: several computers at once, behind its own switch.
7. Linux.

## Not part of this

- The clipboard rework in the mesh fork (images, files, the latest copy wins, a Recent list) changes
  today's clipboard: a pull request of its own.
- Pull request #28 (a phone and a computer at once, several edges) is what Multi-device does; here it
  lives behind the switch.

## Credit

The mesh is Erdoğan Yeşil's work (@erdodo, pull request #29). Files he wrote or changed carry both
names; commits built on it carry `Co-authored-by: Erdoğan Yeşil <erdoganyesil3@gmail.com>`.
