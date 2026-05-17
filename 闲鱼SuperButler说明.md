# 闲鱼 Super Butler（第三方）在本仓库中的说明

## 文档目的

本文档为本 monorepo 在**完成对上游项目 `xianyu-super-butler` 的代码阅读与路径核对之后**的备忘摘要，便于后续在本仓库内引用其能力边界、多账号结论与启动方式，**不替代上游官方 README**。

## 克隆位置与上游

- **本仓库内路径**：`third_party/xianyu-super-butler/`（已验证该目录存在，内含 `Start.py`、`README.md`、`requirements.txt`、`cookie_manager.py`、`db_manager.py`、`utils/browser_pool.py`、`XianyuAutoAsync.py` 等）。
- **上游仓库**：https://github.com/23Star/xianyu-super-butler.git  
- **Git 跟踪**：本仓库根目录 `.gitignore` 已忽略 `third_party/xianyu-super-butler/`（因目录内通常带嵌套 `.git`，避免误提交整块克隆）；若需纳入版本控制，可改为使用 **`git submodule`** 等方式单独管理该路径。
- **Windows 安装包（本仓库维护）**：`packaging/xianyu-super-butler-windows/` — 内嵌官方 **Python 3.12 embed**、Inno Setup 可选安装目录、安装结束/首次启动可打开浏览器；构建脚本 `build-installer.ps1` 需指向本机克隆的上游根目录（`-SourceRoot`）。

## 多账号（多账号并行）结论

**结论：支持并行多账号**（每个闲鱼账号以独立 `cookie_id` 为键并行运行）。

依据摘要（与代码/文档一致，无展开大段源码）：

- **官方 README**：在「核心功能 / 账号管理」中写明「多账号支持」及扫码、密码、Cookie 等登录方式。
- **`cookie_manager.CookieManager`**：类文档字符串为「管理多账号 Cookie 及其对应的 XianyuLive 任务和关键字」；内存结构按 `cookie_id` 维护 cookies、任务锁、关键字与启用状态，并从数据库批量加载。
- **SQLite `cookies` 表**：`db_manager.py` 初始化建表时定义 `cookies` 及多表 `FOREIGN KEY (cookie_id) REFERENCES cookies(id)`，数据模型按账号维度拆分。
- **`XianyuLive`**：`get_instance(cookie_id)` 按 `cookie_id` 从类级注册表取实例，多账号对应多实例。
- **`utils/browser_pool.BrowserPool`**：按 `cookie_id` 维护浏览器池条目与锁，实现「同一账号复用、不同账号隔离」的 Playwright 实例策略。

## 如何运行上游项目（概要）

与上游根目录 `README.md`「快速启动」一致（已核对 README 仍写 **8080** 与 **`frontend` 构建**；本克隆下存在 `frontend/package.json`）：

1. **Python**：安装依赖 `pip install -r requirements.txt`（上游标明 Python 3.11+）。
2. **前端**：进入 `frontend/`，执行 `npm install` 与 `npm run build`（产物进入 `static/`，由后端一并提供）。
3. **启动**：回到项目根目录执行 `python Start.py`。
4. **访问**：浏览器打开 `http://localhost:8080`（README 当前描述）。

前端若需热更新开发模式，README 另述：终端一运行 `Start.py`，终端二在 `frontend` 下 `npm run dev`，开发服务器端口以 README 为准（如 3000）。

## 免责声明与安全提示

- 该项目为**第三方开源软件**，许可证与免责条款以**上游仓库**为准；本说明仅作本 monorepo 内部技术备忘。
- **安全**：README 提供默认后台账号（如 `admin` / `admin123`），**务必在首次登录后修改默认密码**，并注意 Cookie、账号与服务器暴露面的风险管控。
