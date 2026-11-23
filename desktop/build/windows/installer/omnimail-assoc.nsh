; OmniMail Windows 64 位注册表规范：App Paths、Uninstall 元数据、安全邮件协议与文件关联

!macro OMNIMAIL_REGISTER_ASSOCIATIONS
  SetRegView 64
  ; 1. 注册专属 ProgID：OmniMail.mailto / OmniMail.eml / OmniMail.ics（绝不暴力覆写全局 Classes\mailto）
  WriteRegStr SHCTX "Software\Classes\OmniMail.mailto" "" "URL:OmniMail MailTo Protocol"
  WriteRegStr SHCTX "Software\Classes\OmniMail.mailto" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\OmniMail.mailto\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
  WriteRegStr SHCTX "Software\Classes\OmniMail.mailto\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'

  WriteRegStr SHCTX "Software\Classes\OmniMail.eml" "" "OmniMail E-Mail Message (.eml)"
  WriteRegStr SHCTX "Software\Classes\OmniMail.eml\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
  WriteRegStr SHCTX "Software\Classes\OmniMail.eml\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'
  WriteRegStr SHCTX "Software\Classes\.eml\OpenWithProgids" "OmniMail.eml" ""

  WriteRegStr SHCTX "Software\Classes\OmniMail.ics" "" "OmniMail Calendar Invite (.ics)"
  WriteRegStr SHCTX "Software\Classes\OmniMail.ics\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
  WriteRegStr SHCTX "Software\Classes\OmniMail.ics\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'
  WriteRegStr SHCTX "Software\Classes\.ics\OpenWithProgids" "OmniMail.ics" ""

  ; 2. 注册 Windows 默认邮件客户端 Capabilities（供系统设置 -> 默认应用安全选用）
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail" "" "OmniMail"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\Capabilities" "ApplicationName" "OmniMail"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\Capabilities" "ApplicationIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\Capabilities" "ApplicationDescription" "OmniMail 本地优先多源统一邮件桌面工作台"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\Capabilities\URLAssociations" "mailto" "OmniMail.mailto"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\Capabilities\FileAssociations" ".eml" "OmniMail.eml"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\Capabilities\FileAssociations" ".ics" "OmniMail.ics"
  WriteRegStr SHCTX "Software\Clients\Mail\OmniMail\shell\open\command" "" '"$INSTDIR\${APP_EXE}"'
  WriteRegStr SHCTX "Software\RegisteredApplications" "OmniMail" "Software\Clients\Mail\OmniMail\Capabilities"

  ; 3. 通知 Windows 外壳刷新文件关联与图标缓存
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro OMNIMAIL_UNREGISTER_ASSOCIATIONS
  SetRegView 64
  DeleteRegValue SHCTX "Software\RegisteredApplications" "OmniMail"
  DeleteRegKey SHCTX "Software\Clients\Mail\OmniMail"
  DeleteRegKey SHCTX "Software\Classes\OmniMail.mailto"
  DeleteRegKey SHCTX "Software\Classes\OmniMail.eml"
  DeleteRegKey SHCTX "Software\Classes\OmniMail.ics"
  DeleteRegValue SHCTX "Software\Classes\.eml\OpenWithProgids" "OmniMail.eml"
  DeleteRegValue SHCTX "Software\Classes\.ics\OpenWithProgids" "OmniMail.ics"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXE}"
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro OMNIMAIL_WRITE_APP_AND_UNINSTALL_REG
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  SetRegView 64

  ; 1. 应用安装元数据与数据目录提示
  WriteRegStr SHCTX "Software\OmniMail" "InstallDir" "$INSTDIR"
  WriteRegStr SHCTX "Software\OmniMail" "Version" "${APP_VERSION}"
  WriteRegStr SHCTX "Software\OmniMail" "Channel" "${APP_CHANNEL}"
  WriteRegStr SHCTX "Software\OmniMail" "InstallMode" "$MultiUser.InstallMode"
  WriteRegStr HKCU "Software\OmniMail" "DataDir" "$SelectedDataDir"

  ; 2. App Paths 注册（支持 Win+R 输入 OmniMail 直接启动）
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXE}" "" "$INSTDIR\${APP_EXE}"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXE}" "Path" "$INSTDIR"

  ; 3. 计算安装日期 YYYYMMDD
  System::Call '*(&i2,&i2,&i2,&i2,&i2,&i2,&i2,&i2) p .r0'
  System::Call 'kernel32::GetLocalTime(p r0)'
  System::Call '*$0(&i2 .r1, &i2 .r2, &i2, &i2 .r3)'
  System::Free $0
  IntFmt $2 "%02d" $2
  IntFmt $3 "%02d" $3
  StrCpy $4 "$1$2$3"

  ; 4. 控制面板「应用和功能」标准卸载项
  WriteRegStr SHCTX "${UNINST_KEY}" "DisplayName" "${APP_UNINST_DISPLAY_NAME}"
  WriteRegStr SHCTX "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr SHCTX "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr SHCTX "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr SHCTX "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr SHCTX "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe" /$MultiUser.InstallMode'
  WriteRegStr SHCTX "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /$MultiUser.InstallMode /S'
  WriteRegStr SHCTX "${UNINST_KEY}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr SHCTX "${UNINST_KEY}" "InstallDate" "$4"
  WriteRegDWORD SHCTX "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD SHCTX "${UNINST_KEY}" "NoRepair" 1

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD SHCTX "${UNINST_KEY}" "EstimatedSize" "$0"
!macroend
