; 当前用户安装；数据目录独立于程序目录，升级与卸载不删除邮件数据。
#if VER != 0x06070000
  #error Use the pinned Inno Setup 6.7.0 compiler
#endif
#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef BinaryDir
  #define BinaryDir "..\..\.task\verify-bin"
#endif
#ifndef OutputPath
  #define OutputPath "..\..\.task\packages"
#endif
; 程序与升级助手的文件名集中在此，安装、卸载和结束运行实例都用同一份定义。
; 可用 /DMainExe=... 覆盖，仅用于隔离的安装器探针，正式打包使用默认名。
#ifndef MainExe
  #define MainExe "OmniMail.exe"
#endif
#ifndef HelperExe
  #define HelperExe "OmniMailUpdate.exe"
#endif
#ifdef AllowUnsignedDevelopment
  #define SigningRequired "no"
  #define PackageVersion AppVersion + "-dev-unsigned"
  #define DisplayVersion AppVersion + "-dev (UNSIGNED DEVELOPMENT)"
  #define ProductName "OmniMail-Development"
  #define InstallKey "Software\OmniMail-Development\Installation"
  #define LegacyInstallKey "Software\OmniMail-Development"
  #define UninstallKey "Software\Microsoft\Windows\CurrentVersion\Uninstall\{33D8613D-72FB-412E-9838-C694DF14655E}_is1"
  #define ProductId "{{33D8613D-72FB-412E-9838-C694DF14655E}"
#else
  #define SigningRequired "yes"
  #define PackageVersion AppVersion
  #define DisplayVersion AppVersion
  #define ProductName "OmniMail"
  #define InstallKey "Software\OmniMail\Installation"
  #define LegacyInstallKey "Software\OmniMail"
  #define UninstallKey "Software\Microsoft\Windows\CurrentVersion\Uninstall\{C6F30D51-7B7C-4DA3-88C1-7C257A168160}_is1"
  #define ProductId "{{C6F30D51-7B7C-4DA3-88C1-7C257A168160}"
#endif

[Setup]
AppId={#ProductId}
AppName={#ProductName}
AppVersion={#AppVersion}
AppVerName=OmniMail {#DisplayVersion}
VersionInfoVersion={#AppVersion}.0
VersionInfoTextVersion={#DisplayVersion}
VersionInfoProductVersion={#AppVersion}.0
VersionInfoProductTextVersion={#DisplayVersion}
AppPublisher=OmniMail
AppPublisherURL=https://github.com/mibgb65-cloud/OmniMail-APP
DefaultDirName={localappdata}\Programs\{#ProductName}
AppendDefaultDirName=no
DefaultGroupName=OmniMail
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
ShowLanguageDialog=yes
DisableWelcomePage=yes
DisableProgramGroupPage=yes
OutputDir={#OutputPath}
OutputBaseFilename=OmniMail-{#PackageVersion}-windows-amd64-setup
SetupIconFile=..\..\frontend\public\brand\omnimail.ico
UninstallDisplayIcon={app}\{#MainExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; 运行中的 OmniMail 会锁住程序文件；安装前先按名字结束，再由 Restart Manager 兜底，
; 避免出现 DeleteFile 访问被拒绝。升级后不自动重启，由安装完成页的选项决定。
CloseApplications=force
RestartApplications=no
UsePreviousAppDir=yes
UsePreviousTasks=yes
SignedUninstaller={#SigningRequired}
#if SigningRequired == "yes"
SignTool=omnimail
#endif

[Languages]
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
chinesesimp.DataTitle=选择邮件数据位置
chinesesimp.DataDescription=数据库、附件、缓存、日志及更新文件将存放于此。
chinesesimp.DataPrompt=请选择当前用户可写的独立本地目录，推荐非 C 盘。程序和数据目录不能相互包含。
chinesesimp.DataLabel=数据目录:
chinesesimp.InvalidData=数据目录必须是可写的本地绝对路径，不能使用磁盘根、网络或重解析目录。
chinesesimp.SystemData=你选择了系统盘。邮件附件和缓存可能占用大量空间。确认使用此位置？
chinesesimp.Overlap=程序与数据目录不能相同或相互包含，请更换目录。
chinesesimp.DesktopIcon=创建桌面快捷方式
chinesesimp.RunNow=安装完成后启动 OmniMail
chinesesimp.MissingData=原数据磁盘或目录不可用。请恢复磁盘后重试，安装器不会回退到 C 盘。
chinesesimp.FixedInstall=升级必须保留原程序目录；如需迁移，请先备份并卸载。
chinesesimp.Downgrade=不能用旧版本覆盖当前安装。请使用相同或更新的版本。
chinesesimp.CloseFailed=正在运行的 OmniMail 无法自动关闭。请从托盘图标退出后重试；安装程序未改动任何文件。
english.DataTitle=Choose mail data location
english.DataDescription=Database, attachments, caches, logs and update files are stored here.
english.DataPrompt=Choose a dedicated writable local folder, preferably outside C:. Program and data directories must not contain one another.
english.DataLabel=Data directory:
english.InvalidData=Choose a writable local absolute path, not a drive root, network or reparse folder.
english.SystemData=This is the system drive. Mail and caches may use significant space. Use this location?
english.Overlap=Program and data folders must be separate and must not contain one another.
english.DesktopIcon=Create a desktop shortcut
english.RunNow=Start OmniMail after installation
english.MissingData=The original data drive/folder is unavailable. Restore it and retry. No fallback directory will be created.
english.FixedInstall=Keep the original program directory when upgrading. Back up and uninstall before moving it.
english.Downgrade=Cannot replace this installation with an older version.
english.CloseFailed=The running OmniMail instance could not be closed automatically. Quit it from the tray icon and retry; no files were changed.

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; Flags:

[Files]
Source: "{#BinaryDir}\{#MainExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#BinaryDir}\{#HelperExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#BinaryDir}\RELEASE_NOTES.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userprograms}\{#ProductName}"; Filename: "{app}\{#MainExe}"
Name: "{userdesktop}\{#ProductName}"; Filename: "{app}\{#MainExe}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "{#InstallKey}"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: uninsdeletevalue uninsdeletekeyifempty
Root: HKCU; Subkey: "{#InstallKey}"; ValueType: string; ValueName: "DataDir"; ValueData: "{code:DataPath}"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "{#InstallKey}"; ValueType: string; ValueName: "Language"; ValueData: "{code:InitialLanguage}"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "{#InstallKey}"; ValueType: string; ValueName: "Version"; ValueData: "{#AppVersion}"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MainExe}"; Description: "{cm:RunNow}"; Flags: postinstall nowait skipifsilent unchecked

[Code]
var DataPage: TInputDirWizardPage; OriginalData, OriginalInstall, OriginalLanguage, OriginalVersion: String;
var ClosedRunningInstance: Boolean;
function GetFileAttributes(Path: String): LongWord; external 'GetFileAttributesW@kernel32.dll stdcall';
function GetDriveType(RootPath: String): LongWord; external 'GetDriveTypeW@kernel32.dll stdcall';

{ 结束同名进程：先请求正常退出，再强制结束；返回 False 表示仍可能有实例锁住文件。 }
function StopImage(const Image: String): Boolean;
var Code: Integer; Started: Boolean;
begin
  Result := True;
  Started := Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM '+Image, '', SW_HIDE, ewWaitUntilTerminated, Code);
  { 128 = 没有同名进程；0 = 已结束。只有确实存在实例时才等待正常退出。 }
  if Started and (Code = 0) then begin
    ClosedRunningInstance := True;
    Sleep(3000);
  end else if not Started then
    Exit;
  { 托盘常驻或“关闭时询问”偏好不会响应正常关闭，这里强制结束。 }
  Started := Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM '+Image, '', SW_HIDE, ewWaitUntilTerminated, Code);
  if Started and (Code = 0) then begin
    ClosedRunningInstance := True;
    Sleep(500);
    Started := Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM '+Image, '', SW_HIDE, ewWaitUntilTerminated, Code);
  end;
  { 128 说明已无同名进程，可以安全替换文件。 }
  if Started then Result := (Code = 0) or (Code = 128);
end;

function CloseRunningInstances: Boolean;
begin
  Result := StopImage('{#MainExe}');
  if Result then Result := StopImage('{#HelperExe}');
end;

function DataPath(Param: String): String;
begin Result := RemoveBackslashUnlessRoot(DataPage.Values[0]); end;

function InitialLanguage(Param: String): String;
begin
  Result := OriginalLanguage;
  if Result='' then begin
    if ActiveLanguage = 'chinesesimp' then Result := 'zh-CN' else Result := 'en';
  end;
end;

function LocalPathValid(Path: String): Boolean; forward;

procedure InitializeWizard;
var DefaultData, RecordKey: String;
begin
  RecordKey := '{#InstallKey}';
  { 开发运行会创建通用父键；仅专用安装键或匹配本 AppId 的卸载记录才表示已安装。 }
  if not RegKeyExists(HKCU,RecordKey) and RegKeyExists(HKCU,'{#UninstallKey}') then
    RecordKey := '{#LegacyInstallKey}';
  if RegKeyExists(HKCU,RecordKey) then begin
    if not RegQueryStringValue(HKCU,RecordKey,'DataDir',OriginalData) or (OriginalData='') then
      RaiseException(CustomMessage('MissingData'));
    if not RegQueryStringValue(HKCU,RecordKey,'InstallDir',OriginalInstall) or (OriginalInstall='') then
      RaiseException(CustomMessage('FixedInstall'));
    RegQueryStringValue(HKCU,RecordKey,'Language',OriginalLanguage);
    RegQueryStringValue(HKCU,RecordKey,'Version',OriginalVersion);
    if (OriginalLanguage<>'zh-CN') and (OriginalLanguage<>'en') then OriginalLanguage := '';
  end else if RegKeyExists(HKCU,'{#UninstallKey}') then begin
    RaiseException(CustomMessage('MissingData'));
  end;
  { 空的新目录名称会隐藏原生新建文件夹按钮；False 保持用户所选路径，不自动追加目录。 }
  DataPage := CreateInputDirPage(wpWelcome,CustomMessage('DataTitle'),CustomMessage('DataDescription'),CustomMessage('DataPrompt'),False,SetupMessage(msgNewFolderName));
  DataPage.Add(CustomMessage('DataLabel'));
  DefaultData := ExpandConstant('{param:DATADIR|}');
  { 路径输入控件会把相对路径自动转绝对路径，必须在赋值前校验原始参数。 }
  if (OriginalData='') and (DefaultData<>'') and not LocalPathValid(DefaultData) then
    RaiseException(CustomMessage('InvalidData'));
  if (OriginalData<>'') and not LocalPathValid(OriginalData) then
    RaiseException(CustomMessage('InvalidData'));
  if OriginalData <> '' then DefaultData := OriginalData
  else if (DefaultData = '') and DirExists('D:\') then DefaultData := 'D:\{#ProductName}\Data';
  DataPage.Values[0] := DefaultData;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin Result := (PageID = DataPage.ID) and (OriginalData <> '') and DirExists(OriginalData); end;

function LocalPathValid(Path: String): Boolean;
var Parent, Part: String; Attributes: LongWord; I: Integer;
begin
  Result := False;
  if (Length(Path)<4) or (Length(Path)>240) or (Copy(Path,2,2)<>':\') then Exit;
  if GetDriveType(Copy(Path,1,3)) <> 3 then Exit;
  if CompareText(ExpandFileName(Path),Path)<>0 then Exit;
  Part := '';
  for I := 4 to Length(Path)+1 do begin
    if I<=Length(Path) then begin
      if (Ord(Path[I])<32) or (Pos(Path[I],':"*?<>|/')>0) then Exit;
    end;
    if (I>Length(Path)) or (Path[I]='\') then begin
      if (Part='') or (Part='.') or (Part='..') then Exit;
      if (Part[Length(Part)]='.') or (Part[Length(Part)]=' ') then Exit;
      Part := '';
    end else Part := Part+Path[I];
  end;
  Parent := Path;
  while Length(Parent)>3 do begin
    if DirExists(Parent) then begin
      Attributes := GetFileAttributes(Parent);
      if (Attributes and $400) <> 0 then Exit;
    end;
    Parent := ExtractFileDir(Parent);
  end;
  Result := True;
end;

function LocalDataValid(Path: String): Boolean;
var Probe: String;
begin
  Result := False;
  if not LocalPathValid(Path) then Exit;
  if not ForceDirectories(Path) then Exit;
  Probe := AddBackslash(Path)+'.omnimail-write-probe';
  if FileExists(Probe) then Exit;
  if not SaveStringToFile(Probe,'',False) then Exit;
  Result := DeleteFile(Probe);
end;

function Overlap(A,B: String): Boolean;
begin
  A := Lowercase(AddBackslash(RemoveBackslashUnlessRoot(A)));
  B := Lowercase(AddBackslash(RemoveBackslashUnlessRoot(B)));
  Result := (Pos(A,B)=1) or (Pos(B,A)=1);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var Path: String;
begin
  Result := True;
  { 静默模式统一交由 PrepareToInstall 拒绝并返回退出码，不能停在无人可点的向导页。 }
  if WizardSilent then Exit;
  if CurPageID = DataPage.ID then begin
    Path := DataPath('');
    if not LocalDataValid(Path) then begin MsgBox(CustomMessage('InvalidData'),mbError,MB_OK); Result := False; Exit; end;
    if (OriginalData='') and (CompareText(ExtractFileDrive(Path),ExtractFileDrive(ExpandConstant('{sys}')))=0) then
      Result := MsgBox(CustomMessage('SystemData'),mbConfirmation,MB_YESNO or MB_DEFBUTTON2)=IDYES;
  end;
  if CurPageID = wpSelectDir then begin
    if Overlap(WizardDirValue,DataPath('')) then begin MsgBox(CustomMessage('Overlap'),mbError,MB_OK);Result := False;end;
  end;
end;

function TakeVersionPart(var Value: String): Integer;
var Separator: Integer; Part: String;
begin
  Separator := Pos('.',Value);
  if Separator=0 then begin Part:=Value;Value:='';end
  else begin Part:=Copy(Value,1,Separator-1);Delete(Value,1,Separator);end;
  Result := StrToIntDef(Part,-1);
  if IntToStr(Result)<>Part then Result := -1;
end;

function VersionAllowed(Candidate, Previous: String): Boolean;
var I, X, Y, Comparison: Integer;
begin
  Result := False;
  if (Length(Candidate)>17) or (Length(Previous)>17) then Exit;
  Comparison := 0;
  { 不用有符号 Int64 比较打包版本：主版本 >=32768 时最高位会反转顺序。 }
  for I := 1 to 3 do begin
    if (I<3) and ((Pos('.',Candidate)=0) or (Pos('.',Previous)=0)) then Exit;
    if (I=3) and ((Pos('.',Candidate)<>0) or (Pos('.',Previous)<>0)) then Exit;
    X := TakeVersionPart(Candidate); Y := TakeVersionPart(Previous);
    if (X<0) or (X>65535) or (Y<0) or (Y>65535) then Exit;
    if (Comparison=0) and (X<>Y) then begin
      if X>Y then Comparison := 1 else Comparison := -1;
    end;
  end;
  Result := Comparison>=0;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if (OriginalData<>'') and not DirExists(OriginalData) then begin Result:=CustomMessage('MissingData');Exit;end;
  if (OriginalInstall<>'') and (CompareText(OriginalInstall,ExpandConstant('{app}'))<>0) then begin Result:=CustomMessage('FixedInstall');Exit;end;
  if not LocalPathValid(ExpandConstant('{app}')) then begin Result:=CustomMessage('InvalidData');Exit;end;
  if WizardSilent and (OriginalData='') and
    (CompareText(ExtractFileDrive(DataPath('')),ExtractFileDrive(ExpandConstant('{sys}')))=0) and
    (ExpandConstant('{param:ALLOWC|0}')<>'1') then begin Result:=CustomMessage('SystemData');Exit;end;
  if OriginalVersion<>'' then begin
    if not VersionAllowed('{#AppVersion}',OriginalVersion) then begin Result:=CustomMessage('Downgrade');Exit;end;
  end;
  if not LocalDataValid(DataPath('')) then begin Result:=CustomMessage('InvalidData');Exit;end;
  if Overlap(ExpandConstant('{app}'),DataPath('')) then begin Result:=CustomMessage('Overlap');Exit;end;
  // 运行中的实例会锁住程序目录里的文件；先关掉它，再让复制阶段接管。
  if not CloseRunningInstances then Result:=CustomMessage('CloseFailed');
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  { 升级时关闭了正在运行的应用，默认勾选完成后启动，让用户回到原来的使用状态。 }
  if (CurPageID <> wpFinished) or WizardSilent or (not ClosedRunningInstance) then Exit;
  if WizardForm.RunList = nil then Exit;
  if WizardForm.RunList.Items.Count > 0 then WizardForm.RunList.Checked[0] := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var Command: String;
begin
  if CurUninstallStep=usUninstall then begin
    // 卸载同样会删除程序目录下的文件，先结束运行中的实例。
    StopImage('{#MainExe}');
    StopImage('{#HelperExe}');
    if RegQueryStringValue(HKCU,'Software\Microsoft\Windows\CurrentVersion\Run','{#ProductName}',Command) then
      if Command='"'+ExpandConstant('{app}\{#MainExe}')+'" --startup' then
        RegDeleteValue(HKCU,'Software\Microsoft\Windows\CurrentVersion\Run','{#ProductName}');
  end;
end;
