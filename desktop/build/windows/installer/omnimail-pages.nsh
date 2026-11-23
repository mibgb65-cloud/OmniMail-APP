; OmniMail 自定义本地数据存储向导页（实时磁盘空间计算与五重边界校验）及安全卸载页

Var DataDirDialog
Var DataDirInput
Var DataDirBrowseBtn
Var DataDirSpaceLabel
Var SelectedDataDir
Var ExistingBootDataDir

Var UninstDialog
Var UninstDeleteDataCheck
Var DeleteLocalUserData
Var UninstDataDir

Function RefreshDataDirSpaceLabel
  ${NSD_GetText} $DataDirInput $0
  Push "$0"
  Call GetDiskFreeSpaceMB
  Pop $1
  ${If} $1 < 0
    ${NSD_SetText} $DataDirSpaceLabel "$(DATADIR_SPACE_UNKNOWN)"
  ${ElseIf} $1 >= 1024
    IntOp $2 $1 / 1024
    ${NSD_SetText} $DataDirSpaceLabel "$(DATADIR_SPACE_PREFIX)$2 GB ($1 MB)"
  ${Else}
    ${NSD_SetText} $DataDirSpaceLabel "$(DATADIR_SPACE_PREFIX)$1 MB"
  ${EndIf}
FunctionEnd

Function DataDirPageCreate
  !insertmacro MUI_HEADER_TEXT "$(DATADIR_TITLE)" "$(DATADIR_SUBTITLE)"
  nsDialogs::Create 1018
  Pop $DataDirDialog
  ${If} $DataDirDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 38u "$(DATADIR_INFO)"
  Pop $0
  ${NSD_CreateLabel} 0 44u 100% 12u "$(DATADIR_LABEL)"
  Pop $0

  ${NSD_CreateText} 0 58u 77% 13u "$SelectedDataDir"
  Pop $DataDirInput
  ${NSD_OnChange} $DataDirInput RefreshDataDirSpaceLabel

  ${NSD_CreateButton} 79% 57u 21% 15u "$(DATADIR_BROWSE)"
  Pop $DataDirBrowseBtn
  ${NSD_OnClick} $DataDirBrowseBtn DataDirPageBrowse

  ${NSD_CreateLabel} 0 78u 100% 14u ""
  Pop $DataDirSpaceLabel
  Call RefreshDataDirSpaceLabel

  nsDialogs::Show
FunctionEnd

Function DataDirPageBrowse
  ${NSD_GetText} $DataDirInput $0
  nsDialogs::SelectFolderDialog "$(DATADIR_BROWSE_PROMPT)" "$0"
  Pop $1
  ${If} $1 != "error"
  ${AndIf} $1 != ""
    ${NSD_SetText} $DataDirInput "$1"
    Call RefreshDataDirSpaceLabel
  ${EndIf}
FunctionEnd

Function DataDirPageLeave
  ${NSD_GetText} $DataDirInput $SelectedDataDir
  Push "$SelectedDataDir"
  Call NormalizeDirPath
  Pop $SelectedDataDir

  StrLen $0 $SelectedDataDir
  ${If} $0 == 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_EMPTY)"
    Abort
  ${EndIf}
  ${If} $0 <= 2
    StrCpy $1 $SelectedDataDir 1 1
    ${If} $1 == ":"
      MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_SYSTEM)"
      Abort
    ${EndIf}
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_EMPTY)"
    Abort
  ${EndIf}
  StrCpy $1 $SelectedDataDir 1 1
  StrCpy $2 $SelectedDataDir 1 2
  ${If} $1 != ":"
  ${OrIf} $2 != "\"
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_EMPTY)"
    Abort
  ${EndIf}

  ; 禁止等于 $INSTDIR 或互相位于对方子目录内
  Push "$INSTDIR"
  Call NormalizeDirPath
  Pop $0
  ${If} $SelectedDataDir == $0
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_SAME)"
    Abort
  ${EndIf}
  StrCpy $1 "$0\"
  StrLen $2 $1
  StrCpy $3 $SelectedDataDir $2
  ${If} $3 == $1
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_SAME)"
    Abort
  ${EndIf}
  StrCpy $1 "$SelectedDataDir\"
  StrLen $2 $1
  StrCpy $3 $0 $2
  ${If} $3 == $1
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_SAME)"
    Abort
  ${EndIf}

  ; 禁止 Windows / Program Files 等系统核心目录
  Push "$WINDIR"
  Call NormalizeDirPath
  Pop $0
  StrCpy $1 "$0\"
  StrLen $2 $1
  StrCpy $3 $SelectedDataDir $2
  ${If} $SelectedDataDir == $0
  ${OrIf} $3 == $1
  ${OrIf} $SelectedDataDir == $PROGRAMFILES64
  ${OrIf} $SelectedDataDir == $PROGRAMFILES32
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_SYSTEM)"
    Abort
  ${EndIf}

  ; 可写权限探针校验
  StrCpy $4 0
  IfFileExists "$SelectedDataDir\*.*" 0 +2
    StrCpy $4 1
  ClearErrors
  CreateDirectory "$SelectedDataDir"
  FileOpen $5 "$SelectedDataDir\.omnimail_probe.tmp" w
  ${If} ${Errors}
  ${OrIf} $5 == ""
    ${If} $4 == 0
      RMDir "$SelectedDataDir"
    ${EndIf}
    MessageBox MB_ICONEXCLAMATION|MB_OK "$(DATADIR_ERR_UNWRITABLE)"
    Abort
  ${EndIf}
  FileWrite $5 "ok"
  FileClose $5
  Delete "$SelectedDataDir\.omnimail_probe.tmp"
  ${If} $4 == 0
    RMDir "$SelectedDataDir"
  ${EndIf}

  ; 剩余空间 < 500 MB 确认提醒
  Push "$SelectedDataDir"
  Call GetDiskFreeSpaceMB
  Pop $6
  ${If} $6 >= 0
  ${AndIf} $6 < 500
    MessageBox MB_ICONEXCLAMATION|MB_YESNO "$(DATADIR_WARN_LOWSPACE)" IDYES +2
    Abort
  ${EndIf}
FunctionEnd

Function un.UninstDataPageCreate
  !insertmacro MUI_HEADER_TEXT "$(UNINST_DATA_TITLE)" "$(UNINST_DATA_SUBTITLE)"
  nsDialogs::Create 1018
  Pop $UninstDialog
  ${If} $UninstDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 30u "$(UNINST_DATA_DESC)"
  Pop $0
  ${NSD_CreateCheckbox} 0 36u 100% 14u "$(UNINST_DATA_CHECKBOX)"
  Pop $UninstDeleteDataCheck
  ${NSD_SetState} $UninstDeleteDataCheck ${BST_UNCHECKED}

  ${NSD_CreateLabel} 0 58u 100% 12u "$(UNINST_DATA_CURRENT)"
  Pop $0
  ${NSD_CreateText} 0 72u 100% 14u "$UninstDataDir"
  Pop $1
  SendMessage $1 ${EM_SETREADONLY} 1 0

  nsDialogs::Show
FunctionEnd

Function un.UninstDataPageLeave
  ${NSD_GetState} $UninstDeleteDataCheck $DeleteLocalUserData
  ${If} $DeleteLocalUserData == ${BST_CHECKED}
  ${AndIfNot} ${Silent}
    MessageBox MB_ICONEXCLAMATION|MB_YESNO|MB_DEFBUTTON2 "$(UNINST_CONFIRM_PURGE)" IDYES +2
    Abort
  ${EndIf}
FunctionEnd
