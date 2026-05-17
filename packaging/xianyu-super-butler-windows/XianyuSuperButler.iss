; Inno Setup 6. Build:
;   ISCC XianyuSuperButler.iss /DStagingDir="C:\path\to\staging\XianyuSuperButler"
#ifndef StagingDir
  #error Define StagingDir on the command line (see build-installer.ps1)
#endif

#define MyAppName "闲鱼超级管家"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "本地构建"
#define MyAppExeName "Launch.bat"

[Setup]
AppId={{C4E8A1F2-6B3D-4E9A-9C7D-1F2A3B4C5D6E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
UninstallDisplayName={#MyAppName}
DefaultDirName={autopf}\XianyuSuperButler
DisableProgramGroupPage=yes
DisableDirPage=no
UsePreviousAppDir=yes
DefaultGroupName={#MyAppName}
OutputDir=dist-installer
OutputBaseFilename=XianyuSuperButler-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
; Only Simplified Chinese wizard (install + uninstall)
ShowLanguageDialog=no

[Languages]
; Bundled under .\Languages\ — many Inno installs omit compiler:Languages\ChineseSimplified.isl
Name: "chinesesimplified"; MessagesFile: "Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加选项："; Flags: unchecked

[Files]
Source: "{#StagingDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Runtime dirs not fully in compile-time [Files] list. User data dirs use Check -> MsgBox in InitializeUninstall.
[UninstallDelete]
Type: filesandordirs; Name: "{app}\python_packages"
Type: filesandordirs; Name: "{app}\.venv"
Type: filesandordirs; Name: "{app}\__pycache__"
Type: filesandordirs; Name: "{app}\data"; Check: ShouldDeleteUserAppData
Type: filesandordirs; Name: "{app}\static\uploads"; Check: ShouldDeleteUserAppData
Type: filesandordirs; Name: "{app}\logs"; Check: ShouldDeleteUserAppData
Type: filesandordirs; Name: "{app}\backups"; Check: ShouldDeleteUserAppData

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "/nopause"; Description: "安装完成后启动应用"; Flags: nowait postinstall skipifsilent shellexec

[Code]
var
  UninstallDeleteUserData: Boolean;

function ShouldDeleteUserAppData: Boolean;
begin
  Result := UninstallDeleteUserData;
end;

function InitializeUninstall: Boolean;
var
  R: Integer;
begin
  Result := True;
  { Silent uninstall: default keep user data }
  if UninstallSilent then
  begin
    UninstallDeleteUserData := False;
    Exit;
  end;
  R := MsgBox(
    '是否同时删除应用数据？' + #13#10 + #13#10 +
    '选择「是」将删除：数据库目录 data、上传文件 static\uploads、日志 logs、备份 backups。' + #13#10 + #13#10 +
    '选择「否」将保留上述目录（仅卸载程序与运行时依赖）。' + #13#10 + #13#10 +
    '若需保留账号、订单等数据，请选择「否」。' + #13#10 + #13#10 +
    '（默认选项为「否」）',
    mbConfirmation, MB_YESNO or MB_DEFBUTTON2);
  UninstallDeleteUserData := (R = IDYES);
end;
