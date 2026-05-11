import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 默认加载地址；构建时使用：
/// `flutter run --dart-define=WEB_APP_URL=https://你的域名`
const String kDefaultWebAppUrl = String.fromEnvironment(
  'WEB_APP_URL',
  defaultValue: 'http://127.0.0.1:3000',
);

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

  @override
  void initState() {
    super.initState();
    final uri = Uri.parse(kDefaultWebAppUrl);
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: WebViewWidget(controller: _controller),
      ),
    );
  }
}
