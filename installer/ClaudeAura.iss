#ifndef AppVersion
  #error AppVersion must be supplied by scripts/build-installer.mjs
#endif
#ifndef AppFileVersion
  #error AppFileVersion must be supplied by scripts/build-installer.mjs
#endif
#ifndef SourceRoot
  #error SourceRoot must be supplied by scripts/build-installer.mjs
#endif
#ifndef OutputDir
  #error OutputDir must be supplied by scripts/build-installer.mjs
#endif
#ifndef OutputBaseFilename
  #error OutputBaseFilename must be supplied by scripts/build-installer.mjs
#endif
#if Ver < EncodeVer(7,0,0)
  #error Claude Aura requires Inno Setup 7 or newer
#endif

#define AppGuid "49DD4496-1ABF-5202-B127-3D7E919318C5"
#define ProductRoot "{localappdata}\ClaudeAura"
#define InstalledApp ProductRoot + "\app"
#define MaintenanceRoot ProductRoot + "\installer"
#define MaintenanceBackend MaintenanceRoot + "\backend-" + AppVersion
#define MaintenanceUninstall MaintenanceBackend + "\uninstall.ps1"
#define MaintenanceTransaction MaintenanceBackend + "\app-transaction.ps1"
#define TemporaryTransaction "{tmp}\app-transaction.ps1"
#define TransactionFinalized ProductRoot + "\.native-install-finalized"
#define NativeUninstallSubkey "Software\Microsoft\Windows\CurrentVersion\Uninstall\{" + AppGuid + "}_is1"
#define PowerShellExe "{sys}\WindowsPowerShell\v1.0\powershell.exe"
#define AuraScript InstalledApp + "\windows\aura-ui.ps1"
#define AuraIcon InstalledApp + "\assets\brand\claude-aura.ico"
#define MaintenanceIcon MaintenanceRoot + "\claude-aura.ico"
#define AuraAppUserModelId "ClaudeAura"

[Setup]
AppId={{{#AppGuid}}
AppName=Claude Aura
AppVersion={#AppVersion}
AppVerName=Claude Aura {#AppVersion}
AppPublisher=I-Kai Huang
AppPublisherURL=https://github.com/erichuang1425/claude-aura
AppSupportURL=https://github.com/erichuang1425/claude-aura/issues
AppUpdatesURL=https://github.com/erichuang1425/claude-aura/releases
DefaultDirName={#ProductRoot}
DefaultGroupName=Claude Aura
DisableDirPage=yes
DisableProgramGroupPage=yes
UsePreviousAppDir=no
AllowNetworkDrive=no
AllowUNCPath=no
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=win64
MinVersion=10.0
SetupIconFile={#SourceRoot}\assets\brand\claude-aura.ico
UninstallDisplayIcon={#MaintenanceIcon}
UninstallDisplayName=Claude Aura
UninstallFilesDir={#MaintenanceRoot}
Uninstallable=yes
CreateUninstallRegKey=yes
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
VersionInfoVersion={#AppFileVersion}
VersionInfoProductVersion={#AppVersion}
VersionInfoProductName=Claude Aura
#ifdef UnsignedPublicBuild
VersionInfoDescription=Claude Aura Installer (Unsigned)
#else
VersionInfoDescription=Claude Aura Installer
#endif
VersionInfoCompany=I-Kai Huang
VersionInfoCopyright=Copyright (C) 2026 I-Kai Huang
VersionInfoOriginalFileName={#OutputBaseFilename}.exe
WizardStyle=modern dynamic windows11 hidebevels
WizardSizePercent=125,125
WizardImageFile=assets\wizard-light.png
WizardImageFileDynamicDark=assets\wizard-dark.png
WizardSmallImageFile=assets\wizard-small-light.png
WizardSmallImageFileDynamicDark=assets\wizard-small-dark.png
WizardImageBackColor=#332C3C
WizardImageBackColorDynamicDark=#17141C
DisableWelcomePage=no
DisableReadyPage=no
DisableFinishedPage=no
ShowLanguageDialog=auto
UsePreviousLanguage=yes
UsePreviousTasks=yes
CloseApplications=no
RestartApplications=no
RestartIfNeededByRun=no
SetupLogging=yes
UninstallLogging=yes
Compression=lzma2/max
SolidCompression=yes
#ifdef SignedBuild
SignTool=claudeaura
SignedUninstaller=yes
#else
SignedUninstaller=no
#endif

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl,locales\en.isl"
Name: "zh_CN"; MessagesFile: "compiler:Languages\ChineseSimplified.isl,locales\zh-CN.isl"
Name: "zh_HKTW"; MessagesFile: "compiler:Languages\ChineseTraditional.isl,locales\zh-HKTW.isl"

[Tasks]
Name: "desktopicons"; Description: "{cm:DesktopTask}"; GroupDescription: "{cm:DesktopTaskGroup}"; Flags: checkedonce

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{tmp}\claude-aura"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\windows\common.ps1"; DestDir: "{#MaintenanceBackend}"; Flags: ignoreversion
Source: "{#SourceRoot}\windows\uninstall.ps1"; DestDir: "{#MaintenanceBackend}"; Flags: ignoreversion
Source: "app-transaction.ps1"; DestDir: "{#MaintenanceBackend}"; Flags: ignoreversion
Source: "{#SourceRoot}\assets\brand\claude-aura.ico"; DestDir: "{#MaintenanceRoot}"; Flags: ignoreversion
Source: "app-transaction.ps1"; Flags: dontcopy
Source: "install-trigger.txt"; DestDir: "{tmp}\claude-aura-installer"; Flags: ignoreversion; AfterInstall: PrepareAuraAppTransaction

[Icons]
Name: "{group}\Claude Aura"; Filename: "{#PowerShellExe}"; Parameters: "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{#AuraScript}"""; WorkingDir: "{#InstalledApp}"; IconFilename: "{#AuraIcon}"; Comment: "{cm:AuraShortcutComment}"; AppUserModelID: "{#AuraAppUserModelId}"
Name: "{group}\Claude Aura Studio"; Filename: "{#PowerShellExe}"; Parameters: "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{#AuraScript}"" -OpenStudio"; WorkingDir: "{#InstalledApp}"; IconFilename: "{#AuraIcon}"; Comment: "{cm:StudioShortcutComment}"; AppUserModelID: "{#AuraAppUserModelId}"
Name: "{autodesktop}\Claude Aura"; Filename: "{#PowerShellExe}"; Parameters: "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{#AuraScript}"""; WorkingDir: "{#InstalledApp}"; IconFilename: "{#AuraIcon}"; Comment: "{cm:AuraShortcutComment}"; AppUserModelID: "{#AuraAppUserModelId}"; Tasks: desktopicons
Name: "{autodesktop}\Claude Aura Studio"; Filename: "{#PowerShellExe}"; Parameters: "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{#AuraScript}"" -OpenStudio"; WorkingDir: "{#InstalledApp}"; IconFilename: "{#AuraIcon}"; Comment: "{cm:StudioShortcutComment}"; AppUserModelID: "{#AuraAppUserModelId}"; Tasks: desktopicons
Name: "{group}\{cm:UninstallShortcut}"; Filename: "{uninstallexe}"; WorkingDir: "{#ProductRoot}"; IconFilename: "{uninstallexe}"; Comment: "{cm:UninstallShortcutComment}"

[Run]
Filename: "{#PowerShellExe}"; Parameters: "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{#AuraScript}"""; WorkingDir: "{#InstalledApp}"; Description: "{cm:LaunchAura}"; Flags: postinstall nowait skipifsilent runhidden runasoriginaluser

[Code]
const
  TransactionOutputPrefix = 'AURA_INSTALL_TRANSACTION=';
  NativeTransactionRegistryValue = 'ClaudeAuraTransactionId';
  WebView2ClientSubkey =
    'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

var
  TrustPage: TWizardPage;
  NodeStatusLabel: TNewStaticText;
  NodeDownloadLink: TNewLinkLabel;
  WebViewStatusLabel: TNewStaticText;
  WebViewDownloadLink: TNewLinkLabel;
  NodeVersion: String;
  WebViewVersion: String;
  NodeExecutablePath: String;
  CapturedLine: String;
  PreparedTransactionId: String;
  TransactionPrepared: Boolean;
  InstallFinalized: Boolean;
  RemoveLocalData: Boolean;

procedure AddTextLabel(Parent: TWinControl; const Caption: String;
  Left, Top, Width, Height: Integer; Bold: Boolean);
var
  LabelControl: TNewStaticText;
begin
  LabelControl := TNewStaticText.Create(Parent);
  LabelControl.Parent := Parent;
  LabelControl.Caption := Caption;
  LabelControl.AutoSize := False;
  LabelControl.WordWrap := True;
  LabelControl.SetBounds(Left, Top, Width, Height);
  LabelControl.Font.Name := 'Segoe UI';
  if Bold then
    LabelControl.Font.Style := [fsBold];
end;

procedure AddFact(const Title, Body: String; Left, Top, Width: Integer);
begin
  AddTextLabel(TrustPage.Surface, Title, Left, Top, Width, ScaleY(16), True);
  AddTextLabel(TrustPage.Surface, Body, Left, Top + ScaleY(17), Width, ScaleY(44), False);
end;

procedure CaptureFirstLine(const S: String; const Error, FirstLine: Boolean);
begin
  if Error then begin
    Log('Node.js check output could not be read: ' + S);
    Exit;
  end;
  if (CapturedLine = '') and (Trim(S) <> '') then
    CapturedLine := Trim(S);
  Log('Node.js check: ' + S);
end;

function NormalizePathCandidate(const Raw: String): String;
begin
  Result := Trim(Raw);
  if (Length(Result) >= 2) and (Result[1] = '"') and
    (Result[Length(Result)] = '"') then begin
    Delete(Result, Length(Result), 1);
    Delete(Result, 1, 1);
  end;
end;

function IsAbsoluteLocalPath(const Candidate: String): Boolean;
begin
  Result :=
    (Length(Candidate) >= 3) and
    (((Candidate[1] >= 'A') and (Candidate[1] <= 'Z')) or
      ((Candidate[1] >= 'a') and (Candidate[1] <= 'z'))) and
    (Candidate[2] = ':') and
    ((Candidate[3] = '\') or (Candidate[3] = '/')) and
    (Pos('%', Candidate) = 0);
end;

function ExistingNodeCandidate(const Raw: String): String;
var
  Candidate: String;
begin
  Result := '';
  Candidate := NormalizePathCandidate(Raw);
  if IsAbsoluteLocalPath(Candidate) and FileExists(Candidate) then
    Result := Candidate;
end;

function ResolveNodePath: String;
var
  PathEntries: TArrayOfString;
  Candidate: String;
  I: Integer;
begin
  Result := '';
  Candidate := ExistingNodeCandidate(
    ExpandConstant('{localappdata}\Programs\nodejs\node.exe'));
  if Candidate <> '' then begin Result := Candidate; Exit; end;
  Candidate := ExistingNodeCandidate(
    ExpandConstant('{%USERPROFILE}\.volta\bin\node.exe'));
  if Candidate <> '' then begin Result := Candidate; Exit; end;
  Candidate := ExistingNodeCandidate(
    ExpandConstant('{%USERPROFILE}\scoop\shims\node.exe'));
  if Candidate <> '' then begin Result := Candidate; Exit; end;
  Candidate := ExistingNodeCandidate(
    PathCombine(GetEnv('NVM_SYMLINK'), 'node.exe'));
  if Candidate <> '' then begin Result := Candidate; Exit; end;
  if IsWin64 then begin
    Candidate := ExistingNodeCandidate(
      ExpandConstant('{pf64}\nodejs\node.exe'));
    if Candidate <> '' then begin Result := Candidate; Exit; end;
  end;
  Candidate := ExistingNodeCandidate(
    ExpandConstant('{pf32}\nodejs\node.exe'));
  if Candidate <> '' then begin Result := Candidate; Exit; end;

  PathEntries := StringSplit(GetEnv('PATH'), [';'], stExcludeEmpty);
  for I := 0 to GetArrayLength(PathEntries) - 1 do begin
    Candidate := NormalizePathCandidate(PathEntries[I]);
    if not IsAbsoluteLocalPath(Candidate) then
      Continue;
    Candidate := ExistingNodeCandidate(PathCombine(Candidate, 'node.exe'));
    if Candidate <> '' then begin
      Result := Candidate;
      Exit;
    end;
  end;
end;

function DetectNode: Boolean;
var
  ResultCode: Integer;
  MajorEnd: Integer;
  MajorVersion: Integer;
  Candidate: String;
begin
  Result := False;
  NodeVersion := '';
  NodeExecutablePath := ResolveNodePath;
  if NodeExecutablePath = '' then begin
    Log('Node.js was not found in an approved absolute location.');
    Exit;
  end;
  CapturedLine := '';
  ResultCode := -1;
  try
    if not ExecAndLogOutput(NodeExecutablePath, '--version',
      ExtractFileDir(NodeExecutablePath), SW_HIDE,
      ewWaitUntilTerminated, ResultCode, @CaptureFirstLine) then begin
      Log('Node.js could not be started.');
      Exit;
    end;
  except
    Log('Node.js check failed: ' + GetExceptionMessage);
    Exit;
  end;
  if (ResultCode <> 0) or (CapturedLine = '') then
    Exit;
  Candidate := CapturedLine;
  if (Length(Candidate) > 0) and ((Candidate[1] = 'v') or (Candidate[1] = 'V')) then
    Delete(Candidate, 1, 1);
  MajorEnd := Pos('.', Candidate);
  if MajorEnd = 0 then
    MajorEnd := Length(Candidate) + 1;
  MajorVersion := StrToIntDef(Copy(Candidate, 1, MajorEnd - 1), 0);
  if MajorVersion < 22 then
    Exit;
  NodeVersion := CapturedLine;
  Result := True;
end;

function IsUsableWebViewVersion(const Value: String): Boolean;
begin
  Result := (Trim(Value) <> '') and
    (CompareText(Trim(Value), '0.0.0.0') <> 0);
end;

function DetectWebView2: Boolean;
var
  Candidate: String;
begin
  Result := False;
  WebViewVersion := '';
  if RegQueryStringValue(HKCU, WebView2ClientSubkey, 'pv', Candidate) and
      IsUsableWebViewVersion(Candidate) then begin
    WebViewVersion := Trim(Candidate);
    Result := True;
    Exit;
  end;
  if RegQueryStringValue(HKLM32, WebView2ClientSubkey, 'pv', Candidate) and
      IsUsableWebViewVersion(Candidate) then begin
    WebViewVersion := Trim(Candidate);
    Result := True;
    Exit;
  end;
  if IsWin64 and
      RegQueryStringValue(HKLM64, WebView2ClientSubkey, 'pv', Candidate) and
      IsUsableWebViewVersion(Candidate) then begin
    WebViewVersion := Trim(Candidate);
    Result := True;
  end;
end;

function CurrentUserSid: String;
var
  UserKeys: TArrayOfString;
  LocalAppData: String;
  I: Integer;
begin
  Result := '';
  if not RegGetSubkeyNames(HKEY_USERS, '', UserKeys) then
    Exit;
  for I := 0 to GetArrayLength(UserKeys) - 1 do begin
    if Pos('S-1-', UpperCase(UserKeys[I])) <> 1 then
      Continue;
    if RegQueryStringValue(
      HKEY_USERS,
      UserKeys[I] +
        '\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders',
      'Local AppData',
      LocalAppData) and
      (LowerCase(RemoveBackslashUnlessRoot(LocalAppData)) =
        LowerCase(RemoveBackslashUnlessRoot(ExpandConstant('{localappdata}')))) then begin
      Result := UserKeys[I];
      Exit;
    end;
  end;
end;

function IsAuraRunning: Boolean;
var
  Sid: String;
begin
  Sid := CurrentUserSid;
  Result := (Sid <> '') and
    CheckForMutexes('Local\ClaudeAura.' + Sid + '.Ui');
end;

procedure RefreshPrerequisiteStatus;
var
  Ready: Boolean;
begin
  Ready := DetectNode;
  if Ready then begin
    NodeStatusLabel.Caption := FmtMessage(CustomMessage('NodeReady'), [NodeVersion]);
    NodeStatusLabel.Font.Style := [fsBold];
    NodeStatusLabel.Visible := True;
    NodeDownloadLink.Visible := False;
  end else begin
    NodeStatusLabel.Caption := CustomMessage('NodeRequired');
    NodeStatusLabel.Font.Style := [fsBold];
    NodeStatusLabel.Visible := False;
    NodeDownloadLink.Visible := True;
  end;
  Ready := DetectWebView2;
  if Ready then begin
    WebViewStatusLabel.Caption :=
      FmtMessage(CustomMessage('WebViewReady'), [WebViewVersion]);
    WebViewStatusLabel.Font.Style := [fsBold];
    WebViewStatusLabel.Visible := True;
    WebViewDownloadLink.Visible := False;
  end else begin
    WebViewStatusLabel.Caption := CustomMessage('WebViewRequired');
    WebViewStatusLabel.Font.Style := [fsBold];
    WebViewStatusLabel.Visible := False;
    WebViewDownloadLink.Visible := True;
  end;
end;

procedure NodeLinkClick(Sender: TObject; const Link: String; LinkType: TSysLinkType);
var
  ErrorCode: Integer;
begin
  if not ShellExec('open', 'https://nodejs.org/en/download', '', '',
    SW_SHOWNORMAL, ewNoWait, ErrorCode) then
    Log('Could not open nodejs.org. Shell error: ' + IntToStr(ErrorCode));
end;

procedure WebViewLinkClick(Sender: TObject; const Link: String;
  LinkType: TSysLinkType);
var
  ErrorCode: Integer;
begin
  if not ShellExec('open',
    'https://developer.microsoft.com/en-us/microsoft-edge/webview2/', '', '',
    SW_SHOWNORMAL, ewNoWait, ErrorCode) then
    Log('Could not open the WebView2 download page. Shell error: ' +
      IntToStr(ErrorCode));
end;

procedure InitializeWizard;
var
  SurfaceWidth: Integer;
  ColumnGap: Integer;
  ColumnWidth: Integer;
  PathLabelWidth: Integer;
  AppPathEdit: TNewEdit;
  DataPathEdit: TNewEdit;
  WebviewPathEdit: TNewEdit;
begin
  ExtractTemporaryFile('app-transaction.ps1');
#ifdef UnsignedPublicBuild
  TrustPage := CreateCustomPage(wpWelcome,
    CustomMessage('UnsignedTrustPageTitle'), CustomMessage('UnsignedTrustPageSubtitle'));
#else
  TrustPage := CreateCustomPage(wpWelcome,
    CustomMessage('TrustPageTitle'), CustomMessage('TrustPageSubtitle'));
#endif
  SurfaceWidth := TrustPage.SurfaceWidth;
  ColumnGap := ScaleX(18);
  ColumnWidth := (SurfaceWidth - ColumnGap) div 2;

  AddTextLabel(TrustPage.Surface, CustomMessage('TrustIntro'), 0, 0,
    SurfaceWidth, ScaleY(22), True);
  AddFact(CustomMessage('FactLiveTitle'), CustomMessage('FactLiveBody'),
    0, ScaleY(30), ColumnWidth);
  AddFact(CustomMessage('FactAccountTitle'), CustomMessage('FactAccountBody'),
    ColumnWidth + ColumnGap, ScaleY(30), ColumnWidth);
  AddFact(CustomMessage('FactDesktopTitle'), CustomMessage('FactDesktopBody'),
    0, ScaleY(96), ColumnWidth);
  AddFact(CustomMessage('FactDataTitle'), CustomMessage('FactDataBody'),
    ColumnWidth + ColumnGap, ScaleY(96), ColumnWidth);

  AddTextLabel(TrustPage.Surface, CustomMessage('InstallPathsTitle'), 0,
    ScaleY(165), SurfaceWidth, ScaleY(18), True);
  PathLabelWidth := ScaleX(132);
  AddTextLabel(TrustPage.Surface, CustomMessage('AppPathLabel'), 0,
    ScaleY(188), PathLabelWidth, ScaleY(22), False);
  AppPathEdit := TNewEdit.Create(TrustPage.Surface);
  AppPathEdit.Parent := TrustPage.Surface;
  AppPathEdit.ReadOnly := True;
  AppPathEdit.TabStop := False;
  AppPathEdit.Text := ExpandConstant('{localappdata}\ClaudeAura\app');
  AppPathEdit.Font.Name := 'Consolas';
  AppPathEdit.SetBounds(PathLabelWidth, ScaleY(184),
    SurfaceWidth - PathLabelWidth, ScaleY(24));

  AddTextLabel(TrustPage.Surface, CustomMessage('DataPathLabel'), 0,
    ScaleY(218), PathLabelWidth, ScaleY(22), False);
  DataPathEdit := TNewEdit.Create(TrustPage.Surface);
  DataPathEdit.Parent := TrustPage.Surface;
  DataPathEdit.ReadOnly := True;
  DataPathEdit.TabStop := False;
  DataPathEdit.Text := ExpandConstant('{localappdata}\ClaudeAura\data');
  DataPathEdit.Font.Name := 'Consolas';
  DataPathEdit.SetBounds(PathLabelWidth, ScaleY(214),
    SurfaceWidth - PathLabelWidth, ScaleY(24));

  AddTextLabel(TrustPage.Surface, CustomMessage('WebviewPathLabel'), 0,
    ScaleY(248), PathLabelWidth, ScaleY(22), False);
  WebviewPathEdit := TNewEdit.Create(TrustPage.Surface);
  WebviewPathEdit.Parent := TrustPage.Surface;
  WebviewPathEdit.ReadOnly := True;
  WebviewPathEdit.TabStop := False;
  WebviewPathEdit.Text := ExpandConstant('{localappdata}\ClaudeAura\webview');
  WebviewPathEdit.Font.Name := 'Consolas';
  WebviewPathEdit.SetBounds(PathLabelWidth, ScaleY(244),
    SurfaceWidth - PathLabelWidth, ScaleY(24));

  NodeStatusLabel := TNewStaticText.Create(TrustPage.Surface);
  NodeStatusLabel.Parent := TrustPage.Surface;
  NodeStatusLabel.AutoSize := False;
  NodeStatusLabel.SetBounds(0, ScaleY(280), SurfaceWidth, ScaleY(22));
  NodeStatusLabel.Font.Name := 'Segoe UI';

  WebViewStatusLabel := TNewStaticText.Create(TrustPage.Surface);
  WebViewStatusLabel.Parent := TrustPage.Surface;
  WebViewStatusLabel.AutoSize := False;
  WebViewStatusLabel.SetBounds(0, ScaleY(304), SurfaceWidth, ScaleY(22));
  WebViewStatusLabel.Font.Name := 'Segoe UI';

  NodeDownloadLink := TNewLinkLabel.Create(TrustPage.Surface);
  NodeDownloadLink.Parent := TrustPage.Surface;
  NodeDownloadLink.Caption := '<a href="https://nodejs.org/en/download">' +
    CustomMessage('NodeDownloadLink') + '</a>';
  NodeDownloadLink.UseVisualStyle := True;
  NodeDownloadLink.OnLinkClick := @NodeLinkClick;
  NodeDownloadLink.SetBounds(0, ScaleY(280), SurfaceWidth, ScaleY(24));

  WebViewDownloadLink := TNewLinkLabel.Create(TrustPage.Surface);
  WebViewDownloadLink.Parent := TrustPage.Surface;
  WebViewDownloadLink.Caption :=
    '<a href="https://developer.microsoft.com/en-us/microsoft-edge/webview2/">' +
    CustomMessage('WebViewDownloadLink') + '</a>';
  WebViewDownloadLink.UseVisualStyle := True;
  WebViewDownloadLink.OnLinkClick := @WebViewLinkClick;
  WebViewDownloadLink.SetBounds(0, ScaleY(304), SurfaceWidth, ScaleY(24));

  RefreshPrerequisiteStatus;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID <> TrustPage.ID then
    Exit;
  RefreshPrerequisiteStatus;
  if NodeVersion = '' then begin
    SuppressibleTaskDialogMsgBox(
      CustomMessage('NodeBlockedTitle'),
      CustomMessage('NodeBlockedBody'),
      mbError, MB_OK, [], 0, IDOK);
    Result := False;
  end else if WebViewVersion = '' then begin
    SuppressibleTaskDialogMsgBox(
      CustomMessage('WebViewBlockedTitle'),
      CustomMessage('WebViewBlockedBody'),
      mbError, MB_OK, [], 0, IDOK);
    Result := False;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  NeedsRestart := False;
  if IsAdmin then
    Result := CustomMessage('AdminBlockedBody')
  else if IsAuraRunning then
    Result := CustomMessage('AuraRunningBody')
  else if not DetectNode then
    Result := CustomMessage('NodeBlockedBody')
  else if not DetectWebView2 then
    Result := CustomMessage('WebViewBlockedBody')
  else
    Result := '';
end;

procedure MaintenanceLog(const S: String; const Error, FirstLine: Boolean);
begin
  if Error then
    Log('Claude Aura maintenance output error: ' + S)
  else
    Log('Claude Aura maintenance: ' + S);
end;

function IsLowerHexTransactionId(const Value: String): Boolean;
var
  I: Integer;
begin
  Result := Length(Value) = 32;
  if not Result then
    Exit;
  for I := 1 to Length(Value) do begin
    if not (((Value[I] >= '0') and (Value[I] <= '9')) or
      ((Value[I] >= 'a') and (Value[I] <= 'f'))) then begin
      Result := False;
      Exit;
    end;
  end;
end;

procedure TransactionLog(const S: String; const Error, FirstLine: Boolean);
begin
  MaintenanceLog(S, Error, FirstLine);
  if (not Error) and (Pos(TransactionOutputPrefix, S) = 1) then
    PreparedTransactionId := Trim(
      Copy(S, Length(TransactionOutputPrefix) + 1, 32));
end;

function RunSetupTransaction(const Mode, Id: String): Boolean;
var
  ResultCode: Integer;
  Parameters: String;
  Started: Boolean;
begin
  Result := False;
  ResultCode := -1;
  Parameters := '-NoProfile -NonInteractive -WindowStyle Hidden ' +
    '-ExecutionPolicy Bypass -File ' +
    AddQuotes(ExpandConstant('{#TemporaryTransaction}')) +
    ' -Mode ' + Mode;
  if Mode = 'prepare' then
    Parameters := Parameters +
      ' -SourceRoot ' + AddQuotes(ExpandConstant('{tmp}\claude-aura')) +
      ' -TargetVersion ' + AddQuotes('{#AppVersion}')
  else
    Parameters := Parameters + ' -TransactionId ' + AddQuotes(Id);
  Started := False;
  try
    Started := ExecAndLogOutput(ExpandConstant('{#PowerShellExe}'), Parameters,
      ExpandConstant('{tmp}'), SW_HIDE, ewWaitUntilTerminated,
      ResultCode, @TransactionLog);
  except
    Log('Claude Aura app transaction failed to start: ' + GetExceptionMessage);
  end;
  if (not Started) or (ResultCode <> 0) then begin
    Log('Claude Aura app transaction exit code: ' + IntToStr(ResultCode));
    Exit;
  end;
  Result := True;
end;

procedure PrepareAuraAppTransaction;
begin
  PreparedTransactionId := '';
  if not RunSetupTransaction('prepare', '') then
    RaiseException(CustomMessage('InstallFailureBody'));
  if not IsLowerHexTransactionId(PreparedTransactionId) then begin
    Log('Claude Aura app transaction returned an invalid transaction id.');
    RaiseException(CustomMessage('InstallFailureBody'));
  end;
  TransactionPrepared := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  MarkerWritten: Boolean;
  RegistryWritten: Boolean;
begin
  if (CurStep <> ssPostInstall) or (not TransactionPrepared) then
    Exit;
  RegistryWritten := RegWriteStringValue(HKCU, '{#NativeUninstallSubkey}',
    NativeTransactionRegistryValue, PreparedTransactionId);
  if not RegistryWritten then
    Log('Claude Aura could not correlate the native installer registration.');
  MarkerWritten := SaveStringToFile(
    ExpandConstant('{#TransactionFinalized}'), PreparedTransactionId, False);
  if not MarkerWritten then
    Log('Claude Aura could not write the native installer finalization marker.');
  if (not RegistryWritten) and (not MarkerWritten) then
    RaiseException(CustomMessage('InstallFailureBody'));
  InstallFinalized := True;
  if not RunSetupTransaction('commit', PreparedTransactionId) then begin
    SuppressibleTaskDialogMsgBox(
      CustomMessage('InstallCleanupWarningTitle'),
      CustomMessage('InstallCleanupWarningBody'),
      mbError, MB_OK, [], 0, IDOK);
  end;
  TransactionPrepared := False;
end;

procedure DeinitializeSetup;
begin
  if TransactionPrepared and (not InstallFinalized) then begin
    if not RunSetupTransaction('rollback', PreparedTransactionId) then
      SuppressibleTaskDialogMsgBox(
        CustomMessage('InstallRollbackFailureTitle'),
        CustomMessage('InstallRollbackFailureBody'),
        mbError, MB_OK, [], 0, IDOK);
    TransactionPrepared := False;
  end;
end;

function InitializeUninstall: Boolean;
var
  Choice: Integer;
begin
  Choice := SuppressibleTaskDialogMsgBox(
    CustomMessage('UninstallChoiceTitle'),
    CustomMessage('UninstallChoiceBody'),
    mbConfirmation, MB_YESNOCANCEL, [
      CustomMessage('UninstallKeepButton') + #13#10 +
        CustomMessage('UninstallKeepHint'),
      CustomMessage('UninstallRemoveButton') + #13#10 +
        CustomMessage('UninstallRemoveHint')
    ],
    0, IDYES);
  RemoveLocalData := Choice = IDNO;
  Result := Choice <> IDCANCEL;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  Parameters: String;
  Started: Boolean;
begin
  if CurUninstallStep = usUninstall then begin
    UninstallProgressForm.StatusLabel.Caption := CustomMessage('UninstallStatus');
    ResultCode := -1;
    Parameters := '-NoProfile -NonInteractive -WindowStyle Hidden ' +
      '-ExecutionPolicy Bypass -File ' +
      AddQuotes(ExpandConstant('{#MaintenanceTransaction}')) +
      ' -Mode recover';
    Started := False;
    try
      Started := ExecAndLogOutput(ExpandConstant('{#PowerShellExe}'), Parameters,
        ExpandConstant('{#MaintenanceBackend}'), SW_HIDE,
        ewWaitUntilTerminated, ResultCode, @MaintenanceLog);
    except
      Log('Claude Aura transaction recovery failed to start: ' + GetExceptionMessage);
    end;
    if (not Started) or (ResultCode <> 0) then begin
      Log('Claude Aura transaction recovery exit code: ' + IntToStr(ResultCode));
      SuppressibleTaskDialogMsgBox(
        CustomMessage('UninstallFailureTitle'),
        CustomMessage('UninstallFailureBody'),
        mbError, MB_OK, [], 0, IDOK);
      Abort;
    end;

    ResultCode := -1;
    Parameters := '-NoProfile -NonInteractive -WindowStyle Hidden ' +
      '-ExecutionPolicy Bypass -File ' +
      AddQuotes(ExpandConstant('{#MaintenanceUninstall}')) +
      ' -NativeBackend';
    if RemoveLocalData then
      Parameters := Parameters + ' -RemoveData';
    Started := False;
    try
      Started := ExecAndLogOutput(ExpandConstant('{#PowerShellExe}'), Parameters,
        ExpandConstant('{#MaintenanceBackend}'), SW_HIDE,
        ewWaitUntilTerminated, ResultCode, @MaintenanceLog);
    except
      Log('Claude Aura uninstall failed to start: ' + GetExceptionMessage);
    end;
    if (not Started) or (ResultCode <> 0) then begin
      Log('Claude Aura uninstall backend exit code: ' + IntToStr(ResultCode));
      SuppressibleTaskDialogMsgBox(
        CustomMessage('UninstallFailureTitle'),
        CustomMessage('UninstallFailureBody'),
        mbError, MB_OK, [], 0, IDOK);
      Abort;
    end;
  end else if CurUninstallStep = usPostUninstall then begin
    RemoveDir(ExpandConstant('{group}'));
    RemoveDir(ExpandConstant('{#ProductRoot}'));
  end;
end;
