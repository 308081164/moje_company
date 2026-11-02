package com.moje.moje_webview_shell

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.util.ArrayList
import java.util.Locale

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "contentUris" -> {
                        val paths = call.argument<List<String>>("paths").orEmpty()
                        try {
                            result.success(paths.mapNotNull { toContentUri(it) })
                        } catch (e: Exception) {
                            result.error("content_uri", e.message ?: "无法生成照片地址", null)
                        }
                    }
                    "shareFiles" -> {
                        val paths = call.argument<List<String>>("paths").orEmpty()
                        val preferWeChat = call.argument<Boolean>("preferWeChat") ?: true
                        try {
                            shareFiles(paths, preferWeChat)
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("share_files", e.message ?: "分享失败", null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun shareFiles(paths: List<String>, preferWeChat: Boolean) {
        val uris = ArrayList<Uri>()
        for (raw in paths) {
            val file = fileFromPath(raw) ?: continue
            if (!file.isFile || file.length() <= 0L) continue
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            grantRead(uri)
            // 额外授权给微信
            try {
                grantUriPermission(WECHAT_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (_: Exception) {
            }
            uris.add(uri)
        }
        if (uris.isEmpty()) {
            throw IllegalStateException("没有可分享的文件")
        }

        val intent = if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).apply {
                type = mimeForFileName(uris[0].lastPathSegment)
                putExtra(Intent.EXTRA_STREAM, uris[0])
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                type = "*/*"
                putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        }

        if (preferWeChat) {
            intent.setPackage(WECHAT_PACKAGE)
            try {
                startActivity(intent)
                return
            } catch (_: Exception) {
                intent.setPackage(null)
            }
        }
        startActivity(Intent.createChooser(intent, "分享到微信"))
    }

    private fun fileFromPath(raw: String): File? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null
        return if (trimmed.startsWith("file://")) {
            val path = Uri.parse(trimmed).path ?: return null
            File(path)
        } else {
            File(trimmed)
        }
    }

    private fun mimeForFileName(name: String?): String {
        val ext = name
            ?.substringAfterLast('.', "")
            ?.lowercase(Locale.US)
            ?.filter { it.isLetterOrDigit() }
            .orEmpty()
        if (ext.isEmpty()) return "application/octet-stream"
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
            ?: when (ext) {
                "stl" -> "model/stl"
                "step", "stp" -> "application/step"
                "obj" -> "text/plain"
                else -> "application/octet-stream"
            }
    }

    private fun toContentUri(raw: String): String? {
        return try {
            val trimmed = raw.trim()
            if (trimmed.isEmpty()) return null
            val dest = if (trimmed.startsWith("content://")) {
                copyContentUri(Uri.parse(trimmed))
            } else {
                val source = if (trimmed.startsWith("file://")) {
                    val path = Uri.parse(trimmed).path ?: return null
                    File(path)
                } else {
                    File(trimmed)
                }
                if (!source.isFile || source.length() <= 0L) return null
                copyFile(source, extensionOf(source.name, null))
            } ?: return null
            if (!dest.isFile || dest.length() <= 0L) return null
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", dest)
            grantRead(uri)
            uri.toString()
        } catch (_: Exception) {
            null
        }
    }

    private fun copyContentUri(uri: Uri): File? {
        val mime = contentResolver.getType(uri)
        val name = uri.lastPathSegment
        val dest = createDest(extensionOf(name, mime))
        contentResolver.openInputStream(uri)?.use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        } ?: return null
        return dest.takeIf { it.length() > 0L }
    }

    private fun copyFile(source: File, ext: String): File? {
        val dest = createDest(ext)
        source.inputStream().use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        }
        return dest.takeIf { it.length() > 0L }
    }

    private fun createDest(ext: String): File {
        val dir = File(cacheDir, "webview_upload").apply { mkdirs() }
        val cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L
        dir.listFiles()?.forEach { file ->
            if (file.isFile && file.lastModified() < cutoff) {
                file.delete()
            }
        }
        return File(dir, "photo_${System.nanoTime()}.$ext")
    }

    private fun extensionOf(name: String?, mime: String?): String {
        val fromName = name
            ?.substringAfterLast('.', "")
            ?.lowercase(Locale.US)
            ?.filter { it.isLetterOrDigit() }
            ?.take(8)
            .orEmpty()
        if (fromName.isNotEmpty() && fromName != name?.lowercase(Locale.US)) {
            return fromName
        }
        val fromMime = mime?.let {
            MimeTypeMap.getSingleton().getExtensionFromMimeType(it.lowercase(Locale.US))
        }?.lowercase(Locale.US)?.filter { it.isLetterOrDigit() }?.take(8).orEmpty()
        if (fromMime.isNotEmpty()) return fromMime
        return if (fromName.isNotEmpty()) fromName else "jpg"
    }

    private fun grantRead(uri: Uri) {
        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
        val packages = linkedSetOf(packageName, "com.google.android.webview", "com.android.chrome", WECHAT_PACKAGE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                WebView.getCurrentWebViewPackage()?.packageName?.let { packages.add(it) }
            } catch (_: Exception) {
            }
        }
        for (pkg in packages) {
            try {
                grantUriPermission(pkg, uri, flags)
            } catch (_: Exception) {
            }
        }
    }

    companion object {
        private const val CHANNEL = "com.moje.shell/files"
        private const val WECHAT_PACKAGE = "com.tencent.mm"
    }
}
