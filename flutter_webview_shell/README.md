# MOJE WebView 壳（Flutter）

在 **同一套 Web 前端**（已加 PWA：`manifest.webmanifest` + `sw.js`）之外，用 Flutter 包一层 **WebView**，便于上架应用商店、统一启动体验。

## 前置

- 安装 [Flutter SDK](https://docs.flutter.dev/get-started/install)（稳定版，并配置好 `flutter doctor`）。
- 本目录首次使用需生成 Android/iOS 工程文件（见下）。

## 1. 生成本地 Android / iOS 工程骨架

在本目录执行（只需一次）：

```bash
flutter create --org com.moje --project-name moje_webview_shell .
```

若提示目录非空，可先备份 `lib/`、`pubspec.yaml` 后清空再执行，或在新空目录 `flutter create` 再把本仓库的 `lib/main.dart` 与 `pubspec.yaml` 覆盖进去。

## 2. 指定要打开的 Web 地址

与部署后的 **HTTPS 管理端** 一致（需与后端 CORS / Cookie 策略匹配）：

```bash
flutter run --dart-define=WEB_APP_URL=https://your-domain.com
```

本地联调 Webpack dev server：

```bash
flutter run --dart-define=WEB_APP_URL=http://10.0.2.2:3000
```

（Android 模拟器访问宿主机常用 `10.0.2.2`；真机请用电脑局域网 IP。）

## 3. 发布构建

```bash
flutter build apk --release --dart-define=WEB_APP_URL=https://your-domain.com
flutter build ios --release --dart-define=WEB_APP_URL=https://your-domain.com
```

## 4. 与 PWA 的关系

- **PWA**：用户用系统浏览器打开同一 URL，可「添加到主屏幕」；仍是一套 React 业务代码。
- **Flutter 壳**：WebView 加载同一 URL；**业务仍只维护 Web**；壳负责应用图标、全屏、商店分发。

## 5. 常见问题

- **白屏 / 无法加载**：检查 `WEB_APP_URL`、HTTPS 证书、Android `usesCleartextTraffic`（仅调试 HTTP）。
- **登录态**：若使用 Cookie，需 Web 与壳内 WebView 同域；若使用 Bearer Token 存 localStorage，一般无额外改动。
- **文件上传**：依赖系统 WebView 与 Chrome 版本；请在真机验证「识图多图」上传。
