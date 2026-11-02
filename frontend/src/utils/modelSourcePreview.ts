import type { UploadFile } from 'antd/es/upload/interface';
import type { FileInfo } from '@/types/order';
import { orderService } from '@/services/orderService';
import { isLikelyRasterImageFile, resolveUploadFileImageSrc } from '@/utils/orderUploadFileList';

export type MeshPreviewKind = 'stl' | 'obj' | 'glb' | 'step' | 'none';

export function meshPreviewKind(fileName: string): MeshPreviewKind {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'stl') return 'stl';
  if (ext === 'obj') return 'obj';
  if (ext === 'glb' || ext === 'gltf') return 'glb';
  if (ext === 'step' || ext === 'stp') return 'step';
  return 'none';
}

export function canInlineMeshPreview(fileName: string): boolean {
  return meshPreviewKind(fileName) !== 'none';
}

export type ModelSourceFileRow = {
  id: number;
  name: string;
  url?: string;
  pieceId?: number;
  pieceName?: string;
};

/** 把订单里的 modelFiles 转成统一行；优先各单件，兼容订单级回退。 */
export function collectOrderModelSourceRows(order: {
  pieces?: { id: number; seq?: number; name?: string; model?: { modelFiles?: unknown } }[];
  modelInfo?: { modelFiles?: unknown };
}): ModelSourceFileRow[] {
  const rows: ModelSourceFileRow[] = [];
  const seen = new Set<number>();
  const pushRaw = (raw: unknown, pieceId?: number, pieceName?: string) => {
    if (!raw || !Array.isArray(raw)) return;
    for (const item of raw as { fileId?: number; id?: number; fileName?: string; fileUrl?: string; url?: string }[]) {
      const id = item.fileId ?? item.id;
      if (id == null || seen.has(Number(id))) continue;
      seen.add(Number(id));
      rows.push({
        id: Number(id),
        name: item.fileName || `file-${id}`,
        url: item.fileUrl || item.url,
        pieceId,
        pieceName,
      });
    }
  };
  for (const piece of order.pieces || []) {
    pushRaw(piece.model?.modelFiles, piece.id, piece.name || `单件${piece.seq ?? ''}`);
  }
  if (rows.length === 0) {
    pushRaw(order.modelInfo?.modelFiles);
  }
  return rows;
}

export function modelSourceRowToUploadFile(row: ModelSourceFileRow): UploadFile {
  return {
    uid: `src-${row.id}-${row.name}`,
    name: row.name,
    status: 'done',
    url: row.url,
    response: { id: row.id, fileName: row.name, fileUrl: row.url },
  };
}

export function fileIdFromUpload(file: UploadFile): number | undefined {
  const res = file.response as FileInfo | undefined;
  if (res?.id != null) return res.id;
  const uid = file.uid || '';
  const m = uid.match(/^src-(\d+)-/);
  if (m) return Number(m[1]);
  return undefined;
}

/** 同 fileId 共用一次下载，避免质量审核页重渲染时反复拉取 STEP 挤占连接、卡住驳回请求。 */
const modelSourceBufferCache = new Map<number, Promise<ArrayBuffer>>();

export async function resolveModelSourceArrayBuffer(file: UploadFile): Promise<ArrayBuffer> {
  const id = fileIdFromUpload(file);
  if (id != null) {
    let pending = modelSourceBufferCache.get(id);
    if (!pending) {
      pending = orderService
        .downloadFile(id)
        .then((blob) => blob.arrayBuffer())
        .catch((err) => {
          modelSourceBufferCache.delete(id);
          throw err;
        });
      modelSourceBufferCache.set(id, pending);
    }
    return pending;
  }
  const origin = file.originFileObj as File | undefined;
  if (origin) {
    return origin.arrayBuffer();
  }
  const url = resolveUploadFileImageSrc(file);
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('无法拉取文件内容');
    return res.arrayBuffer();
  }
  throw new Error('暂无可预览的文件数据，请重新上传或保存后重试');
}

export function isModelSourceRasterImage(file: UploadFile): boolean {
  return isLikelyRasterImageFile(file);
}
