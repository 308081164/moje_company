import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

/// 默认加载地址；构建时使用：
/// `flutter run --dart-define=WEB_APP_URL=https://你的域名`
const String kDefaultWebAppUrl = String.fromEnvironment(
  'WEB_APP_URL',
  defaultValue: 'http://62.234.174.95:8854',
);

const MethodChannel _fileChannel = MethodChannel('com.moje.shell/files');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  runApp(const MojeShellApp());
}

class MojeShellApp extends StatelessWidget {
  const MojeShellApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MOJE',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFC9A962)),
        useMaterial3: true,
      ),
      home: const WebShellPage(),
    );
  }
}

class WebShellPage extends StatefulWidget {
  const WebShellPage({super.key});

  @override
  State<WebShellPage> createState() => _WebShellPageState();
}

class _WebShellPageState extends State<WebShellPage> {
  late final WebViewController _controller;
  bool _handlingBack = false;
  DateTime? _lastRootBackAt;

  static const _rootPaths = <String>{
    '/',
    '/dashboard',
    '/login',
    '/chat',
    '/orders',
    '/workbench',
    '/workbench/tracker-follow-up',
    '/workbench/modeling-archive',
    '/social-publish',
  };

  @override
  void initState() {
    super.initState();
    final uri = Uri.parse(kDefaultWebAppUrl);
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..loadRequest(uri);
    if (_controller.platform is AndroidWebViewController) {
      final android = _controller.platform as AndroidWebViewController;
      android.setAllowFileAccess(true);
      android.setAllowContentAccess(true);
      android.setOnShowFileSelector((params) async {
        try {
          // 始终消费标记。capture 为 true 时若短路，标记会残留，下一次相册也会打开相机。
          final flagged = await _consumeCameraFlag();
          final wantsCamera = params.isCaptureEnabled || flagged;
          final paths = wantsCamera
              ? await _pickCameraPath()
              : await _pickAlbumPaths(params.mode == FileSelectorMode.openMultiple);
          if (paths == null) return <String>[];
          if (paths.isEmpty) {
            await _reportFileError('没有拿到照片文件');
            return <String>[];
          }
          final uris = await _contentUris(paths);
          if (uris.isEmpty) {
            await _pushFilesViaJs(paths, camera: wantsCamera);
            return <String>[];
          }
          try {
            await _controller.runJavaScript('window.__mojeFileIntake=""');
          } catch (_) {}
          unawaited(_confirmOrPush(paths, camera: wantsCamera));
          return uris;
        } catch (e) {
          await _reportFileError('选择照片失败：$e');
          return <String>[];
        }
      });
    }
  }

  String _jsString(Object? raw) {
    if (raw == null) return '';
    final text = raw.toString().trim();
    if (text.isEmpty || text == 'null') return '';
    try {
      final decoded = jsonDecode(text);
      if (decoded == null) return '';
      return decoded.toString();
    } catch (_) {
      if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
        return text.substring(1, text.length - 1);
      }
      return text;
    }
  }

  Future<String> _evalString(String source) async {
    final raw = await _controller.runJavaScriptReturningResult(source);
    return _jsString(raw);
  }

  /// 页面未注入 __mojeShellBack 时，按 hash 判断是不是底层页。
  bool _isRootHash(String hash) {
    var value = hash.trim();
    if (value.startsWith('#')) value = value.substring(1);
    final q = value.indexOf('?');
    var path = q >= 0 ? value.substring(0, q) : value;
    final query = q >= 0 ? value.substring(q + 1) : '';
    if (path.isEmpty) path = '/';
    if (!path.startsWith('/')) path = '/$path';
    if (path.length > 1 && path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }
    if (path == '/chat' && RegExp(r'(^|&)c=').hasMatch(query)) return false;
    return _rootPaths.contains(path);
  }

  /// consumed：页面自己消化了返回；root：底层页；back：应回到上一页。
  Future<String> _backAction() async {
    try {
      final action = await _evalString('''
(function(){
  try {
    if (typeof window.__mojeShellBack === "function") return window.__mojeShellBack();
  } catch (e) {}
  return "";
})()
''');
      if (action == 'consumed' || action == 'root' || action == 'back') {
        return action;
      }
    } catch (_) {}
    try {
      final hash = await _evalString('location.hash || ""');
      if (_isRootHash(hash)) return 'root';
      return 'back';
    } catch (_) {
      return 'root';
    }
  }

  Future<bool> _hrefMoved(String before) async {
    try {
      final after = await _evalString('location.href');
      return after.isNotEmpty && after != before;
    } catch (_) {
      return false;
    }
  }

  /// history.back / WebView.goBack 对 hash 路由是异步的，短暂轮询地址是否变化。
  Future<bool> _waitHrefMoved(String before) async {
    for (var i = 0; i < 8; i++) {
      if (await _hrefMoved(before)) return true;
      await Future<void>.delayed(const Duration(milliseconds: 40));
    }
    return false;
  }

  /// Hash 路由优先走 SPA history.back（和 React Router 同一条栈）。
  /// 地址没变时再试 WebView.canGoBack，覆盖整页跳转。
  Future<bool> _goBackOne() async {
    final before = await _evalString('location.href');
    try {
      await _controller.runJavaScript('history.back()');
      if (await _waitHrefMoved(before)) return true;
    } catch (_) {}
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      if (await _waitHrefMoved(before)) return true;
    }
    return false;
  }

  /// 历史退不动时收起全屏会话，避免停在聊天页却被当成退出。
  Future<bool> _collapseStuckOverlay() async {
    final action = await _evalString('''
(function(){
  try {
    var s = window.__mojeShellBackState || {};
    var hash = location.hash || "";
    var inThread = !!s.chatThreadOpen || (hash.indexOf("/chat") >= 0 && /(?:^|[?&])c=/.test(hash));
    if (inThread && typeof s.closeChatThread === "function") {
      s.closeChatThread();
      return "consumed";
    }
  } catch (e) {}
  return "";
})()
''');
    return action == 'consumed';
  }

  void _confirmExit() {
    final now = DateTime.now();
    if (_lastRootBackAt != null &&
        now.difference(_lastRootBackAt!) <= const Duration(seconds: 2)) {
      SystemNavigator.pop();
      return;
    }
    _lastRootBackAt = now;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        const SnackBar(
          content: Text('再按一次退出'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  Future<void> _handleSystemBack() async {
    if (_handlingBack) return;
    _handlingBack = true;
    try {
      final action = await _backAction();
      if (!mounted) return;
      if (action == 'consumed') {
        _lastRootBackAt = null;
        return;
      }
      if (action == 'root') {
        _confirmExit();
        return;
      }
      final moved = await _goBackOne();
      if (!mounted) return;
      if (!moved) {
        final collapsed = await _collapseStuckOverlay();
        if (!mounted) return;
        if (collapsed) {
          _lastRootBackAt = null;
          return;
        }
        _confirmExit();
        return;
      }
      _lastRootBackAt = null;
    } catch (_) {
      if (mounted) _confirmExit();
    } finally {
      _handlingBack = false;
    }
  }

  /// 用户取消返回 null；选到了但路径是空的返回空列表。
  Future<List<String>?> _pickCameraPath() async {
    final shot = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      imageQuality: 92,
    );
    if (shot == null) return null;
    if (shot.path.isEmpty) return <String>[];
    return <String>[shot.path];
  }

  Future<List<String>?> _pickAlbumPaths(bool multiple) async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.image,
      allowMultiple: multiple,
    );
    if (picked == null) return null;
    return picked.files
        .map((file) => file.path)
        .whereType<String>()
        .where((path) => path.isNotEmpty)
        .toList();
  }

  /// WebView 用 Uri.parse 接收选择结果。裸绝对路径没有 scheme，应用私有目录的
  /// file:// 又读不到，网页里的 File 会是空的。这里改成 FileProvider content URI。
  Future<List<String>> _contentUris(List<String> paths) async {
    try {
      final raw = await _fileChannel.invokeMethod<dynamic>('contentUris', {
        'paths': paths,
      });
      if (raw is! List) return <String>[];
      return raw
          .map((item) => '$item')
          .where((uri) => uri.startsWith('content://'))
          .toList();
    } catch (_) {
      return <String>[];
    }
  }

  /// content URI 交给 WebView 之后，确认 change 事件拿到了非空文件。
  /// 跟单页会把 window.__mojeFileIntake 设为 ok；否则把原图字节写进对应 input。
  Future<void> _confirmOrPush(List<String> paths, {required bool camera}) async {
    await Future<void>.delayed(const Duration(milliseconds: 1000));
    if (!mounted) return;
    try {
      final intake = await _evalString('window.__mojeFileIntake || ""');
      if (intake == 'ok') {
        await _controller.runJavaScript('window.__mojeFileIntake=""');
        return;
      }
      final selector = camera
          ? 'input[data-moje-file="camera"]'
          : 'input[data-moje-file="album"]';
      final hasTarget = await _evalString(
        'document.querySelector(${jsonEncode(selector)}) ? "yes" : ""',
      );
      if (hasTarget != 'yes') return;
      await _pushFilesViaJs(paths, camera: camera);
    } catch (_) {}
  }

  Future<void> _reportFileError(String message) async {
    if (!mounted) return;
    try {
      await _controller.runJavaScript(
        'window.dispatchEvent(new CustomEvent("moje-file-error",{detail:${jsonEncode(message)}}));',
      );
    } catch (_) {}
  }

  File _asFile(String path) {
    if (path.startsWith('file://')) {
      return File(Uri.parse(path).toFilePath());
    }
    return File(path);
  }

  String _baseName(String path) {
    final normalized = path.replaceAll('\\', '/');
    final name = normalized.split('/').last;
    if (name.isEmpty) return 'photo.jpg';
    if (!name.contains('.')) return '$name.jpg';
    return name;
  }

  String _mimeForName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.bmp')) return 'image/bmp';
    if (lower.endsWith('.heic')) return 'image/heic';
    if (lower.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
  }

  /// 把本地照片做成网页 File，并触发跟单页 input 的 change。相册按张追加，不覆盖已选。
  Future<void> _pushFilesViaJs(List<String> paths, {required bool camera}) async {
    final selector = camera
        ? 'input[data-moje-file="camera"]'
        : 'input[data-moje-file="album"]';
    var pushed = 0;
    for (final path in paths) {
      final file = _asFile(path);
      if (!file.existsSync()) continue;
      final bytes = await file.readAsBytes();
      if (bytes.isEmpty) continue;
      final name = _baseName(path);
      final mime = _mimeForName(name);
      final encoded = base64Encode(bytes);
      if (!mounted) return;
      try {
        await _controller.runJavaScript('window.__mojeB64="";');
        const chunkSize = 120000;
        for (var i = 0; i < encoded.length; i += chunkSize) {
          final end = i + chunkSize < encoded.length ? i + chunkSize : encoded.length;
          await _controller.runJavaScript(
            'window.__mojeB64+=${jsonEncode(encoded.substring(i, end))};',
          );
        }
        await _controller.runJavaScript('''
(function(){
  try {
    var b64 = window.__mojeB64 || "";
    window.__mojeB64 = "";
    if (!b64) throw new Error("空数据");
    var binary = atob(b64);
    var arr = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    var file = new File([arr], ${jsonEncode(name)}, {type: ${jsonEncode(mime)}});
    if (!file.size) throw new Error("空文件");
    var input = document.querySelector(${jsonEncode(selector)});
    if (!input) throw new Error("找不到上传控件");
    if (typeof DataTransfer !== "function") throw new Error("当前 WebView 不能接收照片");
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", {bubbles: true}));
  } catch (e) {
    window.dispatchEvent(new CustomEvent("moje-file-error", {detail: "照片没有交回页面：" + (e && e.message ? e.message : e)}));
  }
})();
''');
        pushed += 1;
      } catch (e) {
        await _reportFileError('照片没有交回页面：$e');
        return;
      }
    }
    if (pushed == 0) {
      await _reportFileError('照片内容为空，没有交回页面');
    }
  }

  /// 跟单「拍照」会在点击前把 window.__mojeWantCamera 设为 true。
  /// 部分系统 WebView 不回传 capture，用这个标记兜底打开相机。
  Future<bool> _consumeCameraFlag() async {
    try {
      final raw = await _controller.runJavaScriptReturningResult(
        'window.__mojeWantCamera === true',
      );
      await _controller.runJavaScript('window.__mojeWantCamera = false;');
      final text = raw.toString().toLowerCase().replaceAll('"', '').trim();
      return text == 'true';
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handleSystemBack();
      },
      child: Scaffold(
        body: SafeArea(
          child: WebViewWidget(controller: _controller),
        ),
      ),
    );
  }
}
