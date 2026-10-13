; MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
; NSIS hooks for electron-builder (installer/build.js). The installer runs elevated (per-machine),
; so it adds the same firewall rule the app's Fix button would (firewall.js), and the uninstaller
; removes it. A helper left running would lock its .exe, so it is stopped first.

!macro customInit
  nsExec::Exec 'taskkill /f /im macshare-winhelper.exe'
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /f /im macshare-winhelper.exe'
!macroend

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="MacShare" program="$INSTDIR\MacShare.exe"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="MacShare" dir=in action=allow program="$INSTDIR\MacShare.exe" profile=private enable=yes'
  ; Revision 4: this PC also listens (PC ↔ PC host), so the port gets its own rule.
  nsExec::Exec 'netsh advfirewall firewall delete rule name="MacShare (TCP 47800)"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="MacShare (TCP 47800)" dir=in action=allow protocol=TCP localport=47800 program="$INSTDIR\MacShare.exe" profile=private enable=yes'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="MacShare" program="$INSTDIR\MacShare.exe"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="MacShare (TCP 47800)"'
  ; Revision 6: the pinned Mac apps' Start menu folder is per user (the app makes it in Roaming).
  SetShellVarContext current
  RMDir /r "$APPDATA\Microsoft\Windows\Start Menu\Programs\MacShare Apps"
  ; Revision 7: Explorer › Send to › "<peer> (MacShare)" (sendto.js).
  Delete "$APPDATA\Microsoft\Windows\SendTo\* (MacShare).lnk"
  SetShellVarContext all
!macroend
