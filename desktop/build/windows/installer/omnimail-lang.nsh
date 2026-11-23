; OmniMail 安装向导双语文案（简体中文 / English，适配双轨版本与 Local Profiles 架构）

!if "${APP_CHANNEL}" == "beta"
  LangString WELCOME_TITLE ${LANG_SIMPCHINESE} "欢迎使用 OmniMail ${APP_VERSION} (Beta 测试版) 安装向导"
  LangString WELCOME_TITLE ${LANG_ENGLISH} "Welcome to OmniMail ${APP_VERSION} (Beta) Setup"

  LangString WELCOME_TEXT ${LANG_SIMPCHINESE} "即将安装 OmniMail ${APP_VERSION}（Beta 预览测试通道）。$\r$\n$\r$\n• 开源本地优先（Local-First）：无任何云端账号体系，多本地空间物理隔离，凭据经 Windows DPAPI 加密保护。$\r$\n• 程序与数据彻底解耦：升级或重装永不覆盖您的本地邮件库。$\r$\n$\r$\n【Beta 测试版提示】当前版本用于新特性先行验证；若从旧版覆盖升级，建议先在「设置 → 存储与数据」确认本地空间备份。点击「下一步」继续。"
  LangString WELCOME_TEXT ${LANG_ENGLISH} "This wizard will install OmniMail ${APP_VERSION} (Beta Channel).$\r$\n$\r$\n• Local-First & Open Source: Zero cloud login, isolated Local Profiles, and Windows DPAPI encrypted vault.$\r$\n• Decoupled Storage: Program upgrades never overwrite your local mail database.$\r$\n$\r$\n[Beta Notice] Please back up existing local profiles before upgrading across preview builds. Click Next to continue."
!else
  LangString WELCOME_TITLE ${LANG_SIMPCHINESE} "欢迎使用 OmniMail ${APP_VERSION} 安装向导"
  LangString WELCOME_TITLE ${LANG_ENGLISH} "Welcome to OmniMail ${APP_VERSION} Setup"

  LangString WELCOME_TEXT ${LANG_SIMPCHINESE} "即将安装 OmniMail ${APP_VERSION} 开源多源统一邮件桌面工作台。$\r$\n$\r$\n• 本地优先（Local-First）：无云端账号，多本地空间（Local Profiles）独立保存 SQLite 邮件库、离线附件缓存与 Windows DPAPI 加密凭据盒。$\r$\n• 程序与数据彻底分离：后续任意版本覆盖升级均不会清空或改动您的邮件数据。$\r$\n$\r$\n安装前建议关闭正在运行的邮件客户端，点击「下一步」继续。"
  LangString WELCOME_TEXT ${LANG_ENGLISH} "This wizard will install OmniMail ${APP_VERSION} Unified Desktop Mail Workspace.$\r$\n$\r$\n• Local-First & Open Source: Zero cloud login, isolated Local Profiles, SQLite WAL mail store, and Windows DPAPI encrypted credentials.$\r$\n• Decoupled Storage: Application updates never erase your local mail data.$\r$\n$\r$\nClick Next to continue."
!endif

LangString MSG_WIN10_X64_ONLY ${LANG_SIMPCHINESE} "OmniMail 仅支持 64 位 Windows 10 或 Windows 11 操作系统。"
LangString MSG_WIN10_X64_ONLY ${LANG_ENGLISH} "OmniMail requires a 64-bit edition of Windows 10 or Windows 11."

LangString MSG_WEBVIEW2_MISSING ${LANG_SIMPCHINESE} "未检测到 Microsoft Edge WebView2 Runtime 运行时组件。$\r$\n$\r$\nOmniMail 依赖系统内置 WebView2 渲染桌面界面。点击「是」将在默认浏览器中打开微软官方下载页并继续安装；点击「否」直接继续安装；点击「取消」退出向导。"
LangString MSG_WEBVIEW2_MISSING ${LANG_ENGLISH} "Microsoft Edge WebView2 Runtime was not detected.$\r$\n$\r$\nClick Yes to open Microsoft's official WebView2 download page and continue setup, No to continue without opening, or Cancel to abort."

LangString MSG_APP_RUNNING ${LANG_SIMPCHINESE} "检测到 OmniMail 正在运行（可能驻留在右下角系统托盘中）。$\r$\n$\r$\n为防止文件占用失败或损坏本地 SQLite WAL 邮件数据库，请先关闭程序：$\r$\n• 点击「是」：由向导自动温和退出正在运行的 OmniMail 并继续$\r$\n• 点击「否」：我已手动退出，重新检测$\r$\n• 点击「取消」：中止本次操作"
LangString MSG_APP_RUNNING ${LANG_ENGLISH} "OmniMail is currently running (possibly minimized in the system tray).$\r$\n$\r$\nTo prevent file lock conflicts or SQLite WAL corruption:$\r$\n• Click Yes to gracefully close OmniMail and continue$\r$\n• Click No to re-check after closing manually$\r$\n• Click Cancel to abort"

LangString TITLE_SecCore ${LANG_SIMPCHINESE} "OmniMail 核心程序（必选）"
LangString TITLE_SecCore ${LANG_ENGLISH} "OmniMail Core Application (Required)"

LangString TITLE_SecDesktop ${LANG_SIMPCHINESE} "创建桌面快捷方式"
LangString TITLE_SecDesktop ${LANG_ENGLISH} "Create Desktop Shortcut"

LangString TITLE_SecStartMenu ${LANG_SIMPCHINESE} "创建开始菜单快捷方式"
LangString TITLE_SecStartMenu ${LANG_ENGLISH} "Create Start Menu Shortcuts"

LangString TITLE_SecAutostart ${LANG_SIMPCHINESE} "登录 Windows 时自动启动"
LangString TITLE_SecAutostart ${LANG_ENGLISH} "Launch automatically on Windows login"

LangString TITLE_SecSilentTray ${LANG_SIMPCHINESE} "自启动时静默最小化到托盘"
LangString TITLE_SecSilentTray ${LANG_ENGLISH} "Start silently minimized to system tray on login"

LangString TITLE_SecProtocols ${LANG_SIMPCHINESE} "关联 mailto: 协议与 .eml / .ics 文件并注册为系统可选默认邮件客户端"
LangString TITLE_SecProtocols ${LANG_ENGLISH} "Associate mailto: & .eml / .ics and register as optional default mail client"

LangString DESC_SecCore ${LANG_SIMPCHINESE} "安装 OmniMail 主程序与图标资源（必选只读组件，覆盖升级时完整保留本地空间与邮件数据）。"
LangString DESC_SecCore ${LANG_ENGLISH} "Install OmniMail core binary and resources (required; upgrades preserve all local profiles and mail data)."

LangString DESC_SecDesktop ${LANG_SIMPCHINESE} "在当前桌面创建 OmniMail 启动快捷方式。"
LangString DESC_SecDesktop ${LANG_ENGLISH} "Create an OmniMail shortcut on the Desktop."

LangString DESC_SecStartMenu ${LANG_SIMPCHINESE} "在系统开始菜单创建 OmniMail 快捷方式与卸载入口。"
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Create OmniMail shortcuts in the Windows Start Menu."

LangString DESC_SecAutostart ${LANG_SIMPCHINESE} "写入当前用户启动项（--autostart），进入桌面后自动拉起 OmniMail 后台同步。"
LangString DESC_SecAutostart ${LANG_ENGLISH} "Register HKCU Run entry (--autostart) to start OmniMail automatically when signing in."

LangString DESC_SecSilentTray ${LANG_SIMPCHINESE} "开机自启时附加 --silent-tray 参数，跳过开屏动画并直接隐藏驻留系统托盘（不打断工作流）。"
LangString DESC_SecSilentTray ${LANG_ENGLISH} "Append --silent-tray on autostart to skip splash screen and stay minimized in the system tray."

LangString DESC_SecProtocols ${LANG_SIMPCHINESE} "安全注册 OmniMail.mailto、.eml、.ics 打开方式与系统默认邮件客户端列表（不强制篡改现有默认应用）。"
LangString DESC_SecProtocols ${LANG_ENGLISH} "Safely register mailto:, .eml, and .ics capabilities for Windows Default Apps without hijacking current defaults."

LangString DATADIR_TITLE ${LANG_SIMPCHINESE} "选择本地数据存储位置"
LangString DATADIR_TITLE ${LANG_ENGLISH} "Choose Local Data Storage Directory"

LangString DATADIR_SUBTITLE ${LANG_SIMPCHINESE} "多本地空间与程序目录彻底分离，推荐选择非系统盘（如 D:\OmniMailData）避免 C 盘爆满"
LangString DATADIR_SUBTITLE ${LANG_ENGLISH} "Isolate Local Profiles and mail storage from program files (non-OS drive like D:\OmniMailData recommended)"

LangString DATADIR_INFO ${LANG_SIMPCHINESE} "所有本地空间（profiles/）、SQLite 邮件库、附件缓存与 DPAPI 加密凭据都将保存在此，与程序安装目录彻底分离。引导配置记录于 %APPDATA%\OmniMail\bootstrap.json，后续也可在「设置 → 存储与数据」一键平滑迁移："
LangString DATADIR_INFO ${LANG_ENGLISH} "All Local Profiles (profiles/), SQLite mail databases, attachment caches, and DPAPI encrypted vaults are stored here, completely decoupled from the install directory:"

LangString DATADIR_LABEL ${LANG_SIMPCHINESE} "本地数据存储根目录（支持改到 D:\OmniMailData 等独立分区）："
LangString DATADIR_LABEL ${LANG_ENGLISH} "Local Data Root Directory (e.g., D:\OmniMailData):"

LangString DATADIR_BROWSE ${LANG_SIMPCHINESE} "浏览(&B)..."
LangString DATADIR_BROWSE ${LANG_ENGLISH} "Browse(&B)..."

LangString DATADIR_BROWSE_PROMPT ${LANG_SIMPCHINESE} "请选择存放 OmniMail 本地空间（profiles/）与邮件缓存的文件夹："
LangString DATADIR_BROWSE_PROMPT ${LANG_ENGLISH} "Select the folder for OmniMail Local Profiles and mail data:"

LangString DATADIR_SPACE_PREFIX ${LANG_SIMPCHINESE} "目标分区剩余可用空间："
LangString DATADIR_SPACE_PREFIX ${LANG_ENGLISH} "Available disk space on target drive: "

LangString DATADIR_SPACE_UNKNOWN ${LANG_SIMPCHINESE} "目标分区剩余可用空间：请输入有效的本地磁盘路径（如 D:\OmniMailData）"
LangString DATADIR_SPACE_UNKNOWN ${LANG_ENGLISH} "Available disk space: Please enter a valid local drive path (e.g., D:\OmniMailData)"

LangString DATADIR_ERR_EMPTY ${LANG_SIMPCHINESE} "数据存储目录不能为空且必须为合法本地绝对路径（例如 D:\OmniMailData）。"
LangString DATADIR_ERR_EMPTY ${LANG_ENGLISH} "Data directory must be a valid non-empty absolute path (e.g., D:\OmniMailData)."

LangString DATADIR_ERR_SAME ${LANG_SIMPCHINESE} "数据存储目录不能等于程序安装目录或位于其子目录下，请选择相互独立的文件夹。"
LangString DATADIR_ERR_SAME ${LANG_ENGLISH} "Data directory cannot be identical to or inside the program installation directory."

LangString DATADIR_ERR_SYSTEM ${LANG_SIMPCHINESE} "禁止将邮件数据直接存放在磁盘根目录或 Windows / Program Files 系统核心目录中，请指定独立子目录（如 D:\OmniMailData）。"
LangString DATADIR_ERR_SYSTEM ${LANG_ENGLISH} "Cannot store mail data directly in a drive root or Windows / Program Files system directory."

LangString DATADIR_ERR_UNWRITABLE ${LANG_SIMPCHINESE} "当前账户对该目标目录没有写入权限，或路径无效。请更换其他可写文件夹（如 D:\OmniMailData）。"
LangString DATADIR_ERR_UNWRITABLE ${LANG_ENGLISH} "The selected directory is not writable. Please choose another folder with write permissions."

LangString DATADIR_WARN_LOWSPACE ${LANG_SIMPCHINESE} "检测到目标分区剩余可用空间不足 500 MB，同步大量邮件与附件时可能导致空间耗尽。$\r$\n$\r$\n是否仍要继续使用该目录？"
LangString DATADIR_WARN_LOWSPACE ${LANG_ENGLISH} "Target drive has less than 500 MB of free space. Continue using this directory anyway?"

LangString FINISH_SUMMARY_TEXT ${LANG_SIMPCHINESE} "OmniMail ${APP_DISPLAY_TITLE} 已成功安装到您的计算机。$\r$\n$\r$\n• 程序安装目录：$INSTDIR$\r$\n• 本地数据目录：$SelectedDataDir$\r$\n$\r$\n点击「完成」退出安装向导。"
LangString FINISH_SUMMARY_TEXT ${LANG_ENGLISH} "OmniMail ${APP_DISPLAY_TITLE} has been installed on your computer.$\r$\n$\r$\n• Program Folder: $INSTDIR$\r$\n• Local Data Folder: $SelectedDataDir$\r$\n$\r$\nClick Finish to close Setup."

LangString FINISH_RUN_TEXT ${LANG_SIMPCHINESE} "立即启动 OmniMail"
LangString FINISH_RUN_TEXT ${LANG_ENGLISH} "Launch OmniMail now"

LangString UNINST_DATA_TITLE ${LANG_SIMPCHINESE} "安全卸载与本地空间数据保护"
LangString UNINST_DATA_TITLE ${LANG_ENGLISH} "Safe Uninstall & Local Profile Data Protection"

LangString UNINST_DATA_SUBTITLE ${LANG_SIMPCHINESE} "默认完整保留您的所有本地空间、邮件库与加密凭据，防止误删重要邮件"
LangString UNINST_DATA_SUBTITLE ${LANG_ENGLISH} "All Local Profiles, SQLite mail databases, and encrypted credentials are preserved by default"

LangString UNINST_DATA_DESC ${LANG_SIMPCHINESE} "向导即将移除 OmniMail 应用程序、快捷方式与系统关联注册表。若您计划重装、升级版本或保留历史邮件归档，请保持下方复选框处于【未勾选】状态："
LangString UNINST_DATA_DESC ${LANG_ENGLISH} "Setup will remove OmniMail program files, shortcuts, and registry associations. Leave the checkbox below UNCHECKED if you wish to keep your local mail archive:"

LangString UNINST_DATA_CHECKBOX ${LANG_SIMPCHINESE} "同时删除本地邮件数据、空间配置与加密凭据（不可恢复）"
LangString UNINST_DATA_CHECKBOX ${LANG_ENGLISH} "Also permanently delete local mail data, profiles, and encrypted credentials (irreversible)"

LangString UNINST_DATA_CURRENT ${LANG_SIMPCHINESE} "当前关联的本地数据存储目录（含 profiles/ 与 secrets.vault）："
LangString UNINST_DATA_CURRENT ${LANG_ENGLISH} "Current local data storage directory (includes profiles/ and secrets.vault):"

LangString UNINST_CONFIRM_PURGE ${LANG_SIMPCHINESE} "【高危操作确认】您勾选了彻底删除本地邮件数据与加密凭据：$\r$\n$UninstDataDir$\r$\n$\r$\n删除后所有离线邮件、规则与本地配置将无法恢复！确定要一并删除吗？"
LangString UNINST_CONFIRM_PURGE ${LANG_ENGLISH} "[Warning] You chose to permanently delete all local mail data and credentials in:$\r$\n$UninstDataDir$\r$\n$\r$\nThis action cannot be undone. Are you sure?"
