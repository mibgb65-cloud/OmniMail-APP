; OmniMail NSIS 安装组件节（Sections）、联动选择钩子与安全卸载节

Section "$(TITLE_SecCore)" SecCore
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "/oname=${APP_EXE}" "${APP_BINARY}"
  File "/oname=icon.ico" "${APP_ICON}"
  File "/oname=LICENSE.txt" "${LICENSE_FILE}"

  ; 按 Local Profiles 架构初始化根数据目录（不再新建废弃顶层 db/cache/index）
  CreateDirectory "$SelectedDataDir"
  CreateDirectory "$SelectedDataDir\profiles"
  CreateDirectory "$SelectedDataDir\logs"

  ; 安全写入 bootstrap.json：覆盖安装且未变更 dataDir 时保留既有活跃空间与启动策略
  CreateDirectory "$OmniRoamingDir\OmniMail"
  ${If} $ExistingBootDataDir == ""
  ${OrIf} $ExistingBootDataDir != $SelectedDataDir
    Push "$SelectedDataDir"
    Call EscapeJsonBackslashes
    Pop $0
    StrCpy $2 "false"
    IfFileExists "$SelectedDataDir\profiles.json" 0 +2
      StrCpy $2 "true"
    IfFileExists "$SelectedDataDir\preferences.json" 0 +2
      StrCpy $2 "true"
    Push "$OmniRoamingDir\OmniMail\bootstrap.json"
    Push '{$\r$\n  "dataDir": "$0",$\r$\n  "initialized": $2,$\r$\n  "activeProfileId": "personal",$\r$\n  "launchBehavior": "last-profile"$\r$\n}'
    Call WriteUtf8File
  ${EndIf}

  !insertmacro OMNIMAIL_WRITE_APP_AND_UNINSTALL_REG
SectionEnd

Section "$(TITLE_SecDesktop)" SecDesktop
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
SectionEnd

Section "$(TITLE_SecStartMenu)" SecStartMenu
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe" "/$MultiUser.InstallMode" "$INSTDIR\Uninstall.exe" 0
SectionEnd

Section /o "$(TITLE_SecAutostart)" SecAutostart
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "OmniMail" '"$INSTDIR\${APP_EXE}" --autostart'
SectionEnd

Section /o "$(TITLE_SecSilentTray)" SecSilentTray
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "OmniMail" '"$INSTDIR\${APP_EXE}" --autostart --silent-tray'
SectionEnd

Section "$(TITLE_SecProtocols)" SecProtocols
  !insertmacro OMNIMAIL_REGISTER_ASSOCIATIONS
SectionEnd

Function .onSelChange
  ${If} $PrevAutostartSel == 1
  ${AndIfNot} ${SectionIsSelected} ${SecAutostart}
    !insertmacro UnselectSection ${SecSilentTray}
    StrCpy $PrevAutostartSel 0
  ${ElseIf} ${SectionIsSelected} ${SecSilentTray}
  ${AndIfNot} ${SectionIsSelected} ${SecAutostart}
    !insertmacro SelectSection ${SecAutostart}
    StrCpy $PrevAutostartSel 1
  ${ElseIf} ${SectionIsSelected} ${SecAutostart}
    StrCpy $PrevAutostartSel 1
  ${Else}
    StrCpy $PrevAutostartSel 0
  ${EndIf}
FunctionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "$(DESC_SecCore)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "$(DESC_SecDesktop)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "$(DESC_SecStartMenu)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecAutostart} "$(DESC_SecAutostart)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecSilentTray} "$(DESC_SecSilentTray)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecProtocols} "$(DESC_SecProtocols)"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  SetRegView 64
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "OmniMail"
  !insertmacro OMNIMAIL_UNREGISTER_ASSOCIATIONS

  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\icon.ico"
  Delete "$INSTDIR\LICENSE.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey SHCTX "${UNINST_KEY}"
  DeleteRegValue SHCTX "Software\OmniMail" "InstallDir"
  DeleteRegValue SHCTX "Software\OmniMail" "Version"
  DeleteRegValue SHCTX "Software\OmniMail" "Channel"
  DeleteRegValue SHCTX "Software\OmniMail" "InstallMode"
  DeleteRegKey /ifempty SHCTX "Software\OmniMail"

  ${If} $DeleteLocalUserData == ${BST_CHECKED}
    ${If} $UninstDataDir != ""
      RMDir /r "$UninstDataDir"
    ${EndIf}
    RMDir /r "$OmniRoamingDir\OmniMail"
    RMDir /r "$OmniLocalDir\OmniMail\WebView2"
    RMDir "$OmniLocalDir\OmniMail"
    DeleteRegKey HKCU "Software\OmniMail"
    DeleteRegKey SHCTX "Software\OmniMail"
  ${EndIf}
SectionEnd
