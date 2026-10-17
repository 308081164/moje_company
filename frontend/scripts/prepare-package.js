/**
 * 打包前把社媒发布模块拷入 frontend/embedded，供 electron-builder extraResources 使用。
 * 源文件缺失时仍生成占位目录，避免 extraResources 因路径不存在而失败。
 */
const fs = require('fs');
const path = require('path');

const frontendRoot = path.join(__dirname, '..');
const destRoot = path.join(frontendRoot, 'embedded', 'social-publisher');
const destDist = path.join(destRoot, 'dist');
const destExe = path.join(destRoot, 'publisher-engine.exe');

const srcExe = path.join(frontendRoot, '..', 'social_publisher', 'sidecar', 'dist', 'publisher-engine.exe');
const srcDist = path.join(frontendRoot, '..', 'social_publisher', 'electron', 'dist');

fs.mkdirSync(destDist, { recursive: true });

function copyIfExists(from, to, isDir) {
  if (!fs.existsSync(from)) {
    console.warn('[prepare-package] skip missing:', from);
    return false;
  }
  if (isDir) {
    fs.cpSync(from, to, { recursive: true });
  } else {
    fs.copyFileSync(from, to);
  }
  console.log('[prepare-package] copied', from, '->', to);
  return true;
}

const hasExe = copyIfExists(srcExe, destExe, false);
const hasDist = copyIfExists(srcDist, destDist, true);

if (!hasExe && !hasDist) {
  fs.writeFileSync(
    path.join(destRoot, 'README.txt'),
    '社媒发布模块未找到。请先构建 social_publisher（sidecar exe + electron dist），再打包员工端。\n',
    'utf8'
  );
}

console.log('[prepare-package] social-publisher ready exe=%s dist=%s', hasExe, hasDist);
