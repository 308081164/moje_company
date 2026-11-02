import { orderService } from '@/services/orderService';

export type ShareableFileRef = {
  id: number;
  name: string;
};

export type ShareFilesResult = {
  ok: boolean;
  method: 'web-share' | 'moje-shell' | 'electron-native' | 'electron-folder' | 'download' | 'cancelled' | 'none';
  message: string;
  batchId?: string;
  batchDir?: string;
};

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned || 'model.stl';
}

function mimeForName(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'stl') return 'model/stl';
  if (ext === 'obj') return 'text/plain';
  if (ext === 'step' || ext === 'stp') return 'application/step';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type MojeShellShare = (files: { name: string; mime: string; data: string }[]) => boolean | Promise<boolean>;

function getMojeShellShare(): MojeShellShare | undefined {
  const w = window as Window & { __mojeNativeShareFiles?: MojeShellShare };
  return typeof w.__mojeNativeShareFiles === 'function' ? w.__mojeNativeShareFiles : undefined;
}

async function tryWebShare(files: File[]): Promise<'ok' | 'cancelled' | 'unavailable'> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (!nav.share) return 'unavailable';
  const data: ShareData = { files, title: files[0]?.name || '建模文件' };
  try {
    if (typeof nav.canShare === 'function' && !nav.canShare(data)) {
      return 'unavailable';
    }
    await nav.share(data);
    return 'ok';
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'AbortError') return 'cancelled';
    return 'unavailable';
  }
}

function triggerBrowserDownload(file: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * 将订单源文件分享到个人微信选聊天页。
 * 优先：员工 App 壳（直达微信）→ Web Share → Electron 系统分享 → 本地下载兜底。
 */
export async function shareOrderFilesToWeChat(
  refs: ShareableFileRef[],
  options?: { displayNamePrefix?: string; batchId?: string }
): Promise<ShareFilesResult> {
  if (!refs.length) {
    return { ok: false, method: 'none', message: '没有可分享的文件' };
  }

  const batchId =
    options?.batchId?.trim()
    || `batch-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const prefix = options?.displayNamePrefix?.trim();
  const prepared: { name: string; mime: string; file: File; bytes: Uint8Array }[] = [];

  for (const ref of refs) {
    const blob = await orderService.downloadFile(ref.id);
    const baseName = sanitizeFileName(ref.name);
    const name = prefix
      ? sanitizeFileName(`${prefix}_${baseName}`)
      : baseName;
    const mime = mimeForName(name);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const file = new File([bytes], name, { type: mime });
    prepared.push({ name, mime, file, bytes });
  }

  const shell = getMojeShellShare();
  if (shell) {
    try {
      const payload = [];
      for (const p of prepared) {
        payload.push({ name: p.name, mime: p.mime, data: await blobToBase64(p.file) });
      }
      const accepted = await shell(payload);
      if (accepted) {
        return {
          ok: true,
          method: 'moje-shell',
          batchId,
          message: '已打开微信，请搜索并选择要发送的联系人或群聊',
        };
      }
    } catch {
      /* fall through */
    }
  }

  const web = await tryWebShare(prepared.map((p) => p.file));
  if (web === 'ok') {
    return {
      ok: true,
      method: 'web-share',
      batchId,
      message: '请选择微信，再搜索要发送的联系人或群聊',
    };
  }
  if (web === 'cancelled') {
    return { ok: false, method: 'cancelled', message: '已取消分享' };
  }

  const electronShare = window.electronAPI?.shareFilesForWeChat;
  if (electronShare) {
    try {
      const res = await electronShare(
        prepared.map((p) => ({
          name: p.name,
          // Electron IPC 可传 Uint8Array；这里用 number[] 保证类型跨 preload 稳定
          data: Array.from(p.bytes),
        })),
        batchId
      );
      if (res?.ok) {
        return {
          ok: true,
          method: res.method === 'folder' ? 'electron-folder' : 'electron-native',
          batchId: res.batchId || batchId,
          batchDir: res.batchDir,
          message:
            res.method === 'folder'
              ? res.message || '文件已准备好。请在微信中选择聊天后发送该文件'
              : res.message || '请在系统分享中选择微信，再搜索联系人或群聊',
        };
      }
    } catch {
      /* fall through */
    }
  }

  for (const p of prepared) {
    triggerBrowserDownload(p.file);
  }
  return {
    ok: true,
    method: 'download',
    batchId,
    message: '当前环境无法直接调起微信，文件已下载到本地，请打开微信发送',
  };
}

/** 优先 STL；没有 STL 时退回全部可下载源文件 */
export function pickShareCandidates(
  rows: { id: number; name: string }[]
): ShareableFileRef[] {
  const stls = rows.filter((r) => /\.stl$/i.test(r.name));
  if (stls.length) return stls.map((r) => ({ id: r.id, name: r.name }));
  return rows.map((r) => ({ id: r.id, name: r.name }));
}
