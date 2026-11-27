; OmniMail Windows x64 交互式安装向导（NSIS v3 Unicode + MultiUser + MUI2 + 双轨版本号）
Unicode True
ManifestDPIAware true
SetCompressor /SOLID lzma

!ifndef APP_NAME
  !define APP_NAME "OmniMail"
!endif
!ifndef APP_VERSION
  !define APP_VERSION "v0.0.1"
!endif
!ifndef APP_FILE_VERSION
  !define APP_FILE_VERSION "0.0.1.0"
!endif
!ifndef APP_CHANNEL
  !define APP_CHANNEL "stable"
!endif
!ifndef APP_PUBLISHER
  !define APP_PUBLISHER "OmniMail"
!endif
!ifndef APP_URL
  !define APP_URL "https://github.com/mibgb65-cloud/OmniMail-APP"
!endif
!ifndef APP_EXE
  !define APP_EXE "OmniMail.exe"
!endif
!ifndef APP_BINARY
  !define APP_BINARY "..\..\..\bin\${APP_VERSION}\OmniMail-${APP_VERSION}.exe"
!endif
!ifndef APP_ICON
  !define APP_ICON "..\icon.ico"
!endif
!ifndef LICENSE_FILE
  !define LICENSE_FILE "..\..\..\..\LICENSE"
!endif
!ifndef INSTALLER_OUT
  !define INSTALLER_OUT "..\..\..\..\dist\release\${APP_VERSION}\OmniMail-windows-Setup-${APP_VERSION}.exe"
!endif

!if "${APP_CHANNEL}" == "beta"
  !define APP_DISPLAY_TITLE "${APP_VERSION} (Beta)"
  !define APP_UNINST_DISPLAY_NAME "${APP_NAME} ${APP_VERSION} (Beta)"
!else
  !if "${APP_CHANNEL}" == "alpha"
    !define APP_DISPLAY_TITLE "${APP_VERSION} (Alpha)"
    !define APP_UNINST_DISPLAY_NAME "${APP_NAME} ${APP_VERSION} (Alpha)"
  !else
    !define APP_DISPLAY_TITLE "${APP_VERSION}"
    !define APP_UNINST_DISPLAY_NAME "${APP_NAME}"
  !endif
!endif

!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\OmniMail"
!define MULTIUSER_EXECUTIONLEVEL Highest
!define MULTIUSER_MUI
!define MULTIUSER_INSTALLMODE_COMMANDLINE
!define MULTIUSER_USE_PROGRAMFILES64
!define MULTIUSER_INSTALLMODE_DEFAULT_CURRENTUSER
!define MULTIUSER_INSTALLMODE_INSTDIR "OmniMail"
!define MULTIUSER_INSTALLMODE_INSTDIR_REGISTRY_KEY "Software\OmniMail"
!define MULTIUSER_INSTALLMODE_INSTDIR_REGISTRY_VALUENAME "InstallDir"

!include "MultiUser.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!include "Sections.nsh"
!include "nsDialogs.nsh"

Name "${APP_NAME} ${APP_DISPLAY_TITLE}"
OutFile "${INSTALLER_OUT}"
BrandingText "${APP_NAME} ${APP_DISPLAY_TITLE} · Local-First Mail Workspace"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${APP_FILE_VERSION}"
VIFileVersion "${APP_FILE_VERSION}"
VIAddVersionKey "ProductName" "${APP_UNINST_DISPLAY_NAME}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "${APP_NAME} ${APP_DISPLAY_TITLE} Setup Wizard"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 ${APP_PUBLISHER}"

!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_WELCOMEPAGE_TITLE "$(WELCOME_TITLE)"
!define MUI_WELCOMEPAGE_TEXT "$(WELCOME_TEXT)"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE_FILE}"
!insertmacro MULTIUSER_PAGE_INSTALLMODE
!insertmacro MUI_PAGE_DIRECTORY
Page custom DataDirPageCreate DataDirPageLeave
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_TEXT "$(FINISH_SUMMARY_TEXT)"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "$(FINISH_RUN_TEXT)"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
UninstPage custom un.UninstDataPageCreate un.UninstDataPageLeave
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

!include /CHARSET=UTF8 "omnimail-lang.nsh"
!include /CHARSET=UTF8 "omnimail-assoc.nsh"
!include /CHARSET=UTF8 "omnimail-json-fs.nsh"
!include /CHARSET=UTF8 "omnimail-helpers.nsh"
!include /CHARSET=UTF8 "omnimail-pages.nsh"

Var OmniRoamingDir
Var OmniLocalDir
Var PrevAutostartSel
Var RelaunchAfterInstall

Function .onInit
  ${IfNot} ${RunningX64}
  ${OrIfNot} ${AtLeastWin10}
    ${IfNot} ${Silent}
      MessageBox MB_ICONSTOP|MB_OK "$(MSG_WIN10_X64_ONLY)"
    ${EndIf}
    Quit
  ${EndIf}
  SetRegView 64
  SetShellVarContext current
  StrCpy $OmniRoamingDir "$APPDATA"
  StrCpy $OmniLocalDir "$LOCALAPPDATA"
  StrCpy $PrevAutostartSel 0
  StrCpy $RelaunchAfterInstall 0
  !insertmacro MULTIUSER_INIT

  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} "$R0" "/RELAUNCH" $R2
  ${IfNot} ${Errors}
    StrCpy $RelaunchAfterInstall 1
  ${EndIf}

  ClearErrors
  ${GetOptions} "$R0" "/INSTDIR=" $R1
  ${IfNot} ${Errors}
  ${AndIf} $R1 != ""
    StrCpy $INSTDIR "$R1"
  ${EndIf}

  !insertmacro OMNIMAIL_READ_BOOTSTRAP_DATADIR "$OmniRoamingDir\OmniMail\bootstrap.json" $ExistingBootDataDir
  ${If} $ExistingBootDataDir != ""
    Push "$ExistingBootDataDir"
    Call NormalizeDirPath
    Pop $ExistingBootDataDir
  ${EndIf}

  ClearErrors
  ${GetOptions} "$R0" "/DATADIR=" $R1
  ${IfNot} ${Errors}
  ${AndIf} $R1 != ""
    StrCpy $SelectedDataDir "$R1"
  ${ElseIf} $ExistingBootDataDir != ""
    StrCpy $SelectedDataDir "$ExistingBootDataDir"
  ${Else}
    ReadRegStr $SelectedDataDir HKCU "Software\OmniMail" "DataDir"
    ${If} $SelectedDataDir == ""
      StrCpy $SelectedDataDir "$OmniLocalDir\OmniMail\Data"
    ${EndIf}
  ${EndIf}
  Push "$SelectedDataDir"
  Call NormalizeDirPath
  Pop $SelectedDataDir

  Call CheckWebView2Runtime
  !insertmacro OMNIMAIL_ENSURE_CLOSED
FunctionEnd

Function .onInstSuccess
  ${If} ${Silent}
  ${AndIf} $RelaunchAfterInstall == 1
  ${AndIf} ${FileExists} "$INSTDIR\${APP_EXE}"
    ${If} $MultiUser.InstallMode == "AllUsers"
    ${AndIf} ${FileExists} "$WINDIR\explorer.exe"
      Exec '"$WINDIR\explorer.exe" "$INSTDIR\${APP_EXE}"'
    ${Else}
      Exec '"$INSTDIR\${APP_EXE}"'
    ${EndIf}
  ${EndIf}
FunctionEnd

Function un.onInit
  SetRegView 64
  SetShellVarContext current
  StrCpy $OmniRoamingDir "$APPDATA"
  StrCpy $OmniLocalDir "$LOCALAPPDATA"
  StrCpy $DeleteLocalUserData ${BST_UNCHECKED}
  !insertmacro MULTIUSER_UNINIT
  !insertmacro OMNIMAIL_READ_BOOTSTRAP_DATADIR "$OmniRoamingDir\OmniMail\bootstrap.json" $UninstDataDir
  ${If} $UninstDataDir == ""
    ReadRegStr $UninstDataDir HKCU "Software\OmniMail" "DataDir"
  ${EndIf}
  ${If} $UninstDataDir == ""
    StrCpy $UninstDataDir "$OmniLocalDir\OmniMail\Data"
  ${EndIf}
  !insertmacro OMNIMAIL_ENSURE_CLOSED
FunctionEnd

!include /CHARSET=UTF8 "omnimail-sections.nsh"
