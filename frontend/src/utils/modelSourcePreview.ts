import type { UploadFile } from 'antd/es/upload/interface';
import type { FileInfo } from '@/types/order';
import { orderService } from '@/services/orderService';
import { isLikelyRasterImageFile, resolveUploadFileImageSrc } from '@/utils/orderUploadFileList';

export type MeshPreviewKind = 'stl' | 'obj' | 'none';

export function meshPreviewKind(fileName: string): MeshPreviewKind {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'stl') return 'stl';
  if (ext === 'obj') return 'obj';
  return 'none';
}

export function fileIdFromUpload(file: UploadFile): number | undefined {
  const res = file.response as FileInfo | undefined;
  if (res?.id != null) return res.id;
  const uid = file.uid || '';
  const m = uid.match(/^src-(\d+)-/);
  if (m) return Number(m[1]);
  return undefined;
}

export async function resolveModelSourceArrayBuffer(file: UploadFile): Promise<ArrayBuffer> {
  const id = fileIdFromUpload(file);
  if (id != null) {
    const blob = await orderService.downloadFile(id);
    return blob.arrayBuffer();
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
