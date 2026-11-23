; OmniMail NSIS 进程守护退出、bootstrap.json 解析与 WebView2 环境检测

!macro OMNIMAIL_ENSURE_CLOSED
  !define _OMNI_EC_L ${__LINE__}
  _ec_recheck_${_OMNI_EC_L}:
    ${DisableX64FSRedirection}
    nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /FO CSV /NH'
    ${EnableX64FSRedirection}
    Pop $0
    Pop $1
    StrCpy $2 $1 14
    StrCmp $2 '"${APP_EXE}"' 0 _ec_done_${_OMNI_EC_L}

    ${If} ${Silent}
      Goto _ec_try_close_${_OMNI_EC_L}
    ${EndIf}

    MessageBox MB_ICONEXCLAMATION|MB_YESNOCANCEL "$(MSG_APP_RUNNING)" IDYES _ec_try_close_${_OMNI_EC_L} IDNO _ec_recheck_${_OMNI_EC_L}
    Quit

  _ec_try_close_${_OMNI_EC_L}:
    ReadRegStr $3 HKCU "Software\OmniMail" "InstallDir"
    ${If} $3 == ""
      ReadRegStr $3 HKLM "Software\OmniMail" "InstallDir"
    ${EndIf}
    ${If} $3 != ""
    ${AndIf} ${FileExists} "$3\${APP_EXE}"
      nsExec::ExecToStack '"$3\${APP_EXE}" --quit-existing'
      Pop $0
      Pop $1
      Sleep 1000
    ${ElseIf} ${FileExists} "$INSTDIR\${APP_EXE}"
      nsExec::ExecToStack '"$INSTDIR\${APP_EXE}" --quit-existing'
      Pop $0
      Pop $1
      Sleep 1000
    ${EndIf}

    ${DisableX64FSRedirection}
    nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /FO CSV /NH'
    Pop $0
    Pop $1
    StrCpy $2 $1 14
    ${If} $2 == '"${APP_EXE}"'
      nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /IM ${APP_EXE}'
      Pop $0
      Pop $1
      Sleep 900
      nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /FO CSV /NH'
      Pop $0
      Pop $1
      StrCpy $2 $1 14
      ${If} $2 == '"${APP_EXE}"'
        nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /F /IM ${APP_EXE}'
        Pop $0
        Pop $1
        Sleep 600
      ${EndIf}
    ${EndIf}
    ${EnableX64FSRedirection}

    ${IfNot} ${Silent}
      Goto _ec_recheck_${_OMNI_EC_L}
    ${EndIf}
  _ec_done_${_OMNI_EC_L}:
  !undef _OMNI_EC_L
!macroend

!macro OMNIMAIL_READ_BOOTSTRAP_DATADIR BOOT_PATH OUT_VAR
  !define _OMNI_RB_L ${__LINE__}
  StrCpy ${OUT_VAR} ""
  IfFileExists "${BOOT_PATH}" 0 _rb_end_${_OMNI_RB_L}
    System::Call 'kernel32::CreateFileW(w "${BOOT_PATH}", i 0x80000000, i 1, p 0, i 3, i 0x80, p 0) p .r2'
    IntCmp $2 -1 _rb_end_${_OMNI_RB_L}
    System::Alloc 4096
    Pop $3
    System::Call 'kernel32::ReadFile(p r2, p r3, i 4090, *i .r4, p 0) i'
    System::Call 'kernel32::CloseHandle(p r2) i'
    StrCpy $5 ""
    ${If} $4 > 0
      System::Call 'kernel32::MultiByteToWideChar(i 65001, i 0, p r3, i r4, w .r5, i 1020) i'
    ${EndIf}
    System::Free $3
    StrLen $7 $5
    StrCpy $6 0
  _rb_find_key_${_OMNI_RB_L}:
    IntCmp $6 $7 _rb_end_${_OMNI_RB_L} 0 _rb_end_${_OMNI_RB_L}
    StrCpy $8 $5 9 $6
    StrCmp $8 '"dataDir"' _rb_found_key_${_OMNI_RB_L}
    IntOp $6 $6 + 1
    Goto _rb_find_key_${_OMNI_RB_L}
  _rb_found_key_${_OMNI_RB_L}:
    IntOp $6 $6 + 9
  _rb_find_quote_${_OMNI_RB_L}:
    IntCmp $6 $7 _rb_end_${_OMNI_RB_L} 0 _rb_end_${_OMNI_RB_L}
    StrCpy $8 $5 1 $6
    IntOp $6 $6 + 1
    StrCmp $8 '"' _rb_read_val_${_OMNI_RB_L} _rb_find_quote_${_OMNI_RB_L}
  _rb_read_val_${_OMNI_RB_L}:
    IntCmp $6 $7 _rb_end_${_OMNI_RB_L} 0 _rb_end_${_OMNI_RB_L}
    StrCpy $8 $5 1 $6
    StrCmp $8 '"' _rb_end_${_OMNI_RB_L}
    ${If} $8 == "\"
      IntOp $6 $6 + 1
      StrCpy $8 $5 1 $6
    ${EndIf}
    StrCpy ${OUT_VAR} "${OUT_VAR}$8"
    IntOp $6 $6 + 1
    Goto _rb_read_val_${_OMNI_RB_L}
  _rb_end_${_OMNI_RB_L}:
  !undef _OMNI_RB_L
!macroend

Function CheckWebView2Runtime
  SetRegView 64
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ${IfNot} ${Silent}
      MessageBox MB_ICONINFORMATION|MB_YESNOCANCEL "$(MSG_WEBVIEW2_MISSING)" IDYES _wv2_open IDNO _wv2_done
      Quit
      _wv2_open:
        ExecShell "open" "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
      _wv2_done:
    ${EndIf}
  ${EndIf}
FunctionEnd
