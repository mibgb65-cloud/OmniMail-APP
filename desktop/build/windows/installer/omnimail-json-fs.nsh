; OmniMail NSIS 文件系统、磁盘空间计算与 UTF-8 JSON 工具函数

Function NormalizeDirPath
  Exch $0
  Push $1
  Push $2
  _trim_lead:
    StrCpy $1 $0 1
    ${If} $1 == " "
    ${OrIf} $1 == '"'
      StrCpy $0 $0 "" 1
      Goto _trim_lead
    ${EndIf}
  _trim_trail:
    StrLen $2 $0
    ${If} $2 > 0
      IntOp $2 $2 - 1
      StrCpy $1 $0 1 $2
      ${If} $1 == " "
      ${OrIf} $1 == '"'
      ${OrIf} $1 == "\"
      ${OrIf} $1 == "/"
        StrCpy $0 $0 $2
        Goto _trim_trail
      ${EndIf}
    ${EndIf}
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

Function GetDiskFreeSpaceMB
  Exch $0
  Push $1
  Push $2
  Push $3
  Push $4
  StrLen $1 $0
  ${If} $1 < 2
    StrCpy $0 -1
  ${Else}
    StrCpy $1 $0 2
    StrCpy $2 $1 1 1
    ${If} $2 == ":"
      StrCpy $1 "$1\"
      System::Call 'kernel32::GetDiskFreeSpaceExW(w r1, *l .r2, *l .r3, *l) i .r4'
      ${If} $4 != 0
        System::Int64Op $2 / 1048576
        Pop $0
      ${Else}
        StrCpy $0 -1
      ${EndIf}
    ${Else}
      StrCpy $0 -1
    ${EndIf}
  ${EndIf}
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

Function EscapeJsonBackslashes
  Exch $0
  Push $1
  Push $2
  Push $3
  Push $4
  StrCpy $1 ""
  StrLen $2 $0
  StrCpy $3 0
  _esc_loop:
    IntCmp $3 $2 _esc_done _esc_done
    StrCpy $4 $0 1 $3
    ${If} $4 == "\"
      StrCpy $1 "$1\\"
    ${ElseIf} $4 == '"'
      StrCpy $1 '$1\"'
    ${Else}
      StrCpy $1 "$1$4"
    ${EndIf}
    IntOp $3 $3 + 1
    Goto _esc_loop
  _esc_done:
  StrCpy $0 $1
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

Function WriteUtf8File
  Exch $1
  Exch
  Exch $0
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  System::Call 'kernel32::WideCharToMultiByte(i 65001, i 0, w r1, i -1, p 0, i 0, p 0, p 0) i .r6'
  ${If} $6 > 1
    System::Alloc $6
    Pop $3
    System::Call 'kernel32::WideCharToMultiByte(i 65001, i 0, w r1, i -1, p r3, i r6, p 0, p 0) i'
    IntOp $2 $6 - 1
    System::Call 'kernel32::CreateFileW(w r0, i 0x40000000, i 0, p 0, i 2, i 0x80, p 0) p .r4'
    ${If} $4 != -1
      System::Call 'kernel32::WriteFile(p r4, p r3, i r2, *i .r5, p 0) i'
      System::Call 'kernel32::CloseHandle(p r4) i'
    ${EndIf}
    System::Free $3
  ${EndIf}
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $0
  Pop $1
FunctionEnd
