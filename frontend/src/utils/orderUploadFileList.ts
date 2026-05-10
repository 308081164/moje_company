import type { UploadFile } from 'antd/es/upload/interface';
import type { FileInfo } from '@/types/order';

export function resolveUploadFileImageSrc(file: UploadFile): string | undefined {
  const fromFile = (file.url || file.thumbUrl || '').trim();
  if (fromFile) return fromFile;
  const res = file.response as (FileInfo & { url?: string }) | undefined;
  const r = (res?.url || res?.fileUrl || '').trim();
  if (r) return r;
  const origin = file.originFileObj as File | undefined;
  if (origin && origin.type?.startsWith('image/')) {
    return URL.createObjectURL(origin);
  }
  return undefined;
}

/** 用于建模源文件等场景：仅对常见栅格图扩展名走图片预览，其余走新标签打开。 */
export function isLikelyRasterImageFile(file: UploadFile): boolean {
  if (file.type?.startsWith('image/')) return true;
  const origin = file.originFileObj as File | undefined;
  if (origin?.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name || '');
}

/** 设计图 / 效果图等：done 后写入 url、thumbUrl 便于列表缩略图与预览。 */
export function normalizeDoneImageUploadFileList(fileList: UploadFile[]): UploadFile[] {
  const mapped = fileList.map((f) => {
    if (f.status === 'done') {
      const res = f.response as (FileInfo & { url?: string }) | undefined;
      const url = (f.url || res?.url || res?.fileUrl || '').trim();
      if (url) {
        return { ...f, url, thumbUrl: f.thumbUrl || url };
      }
    }
    return f;
  });
  const seen = new Set<string>();
  return mapped.filter((f) => {
    if (f.status !== 'done') return true;
    const u = (f.url || '').trim();
    if (!u) return true;
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

export function savedImageUrlsToUploadFileList(urls: string[], namePrefix: string): UploadFile[] {
  return urls
    .map((u) => u.trim())
    .filter(Boolean)
    .map((url, i) => ({
      uid: `${namePrefix}-loaded-${i}`,
      name: `${namePrefix}${i + 1}`,
      status: 'done' as const,
      url,
      thumbUrl: url,
    }));
}

export function collectDoneImageUrlsFromFileList(fileList: UploadFile[]): string[] {
  const urls = fileList
    .filter((f) => f.status === 'done')
    .map((f) => {
      const res = f.response as (FileInfo & { url?: string }) | undefined;
      return (f.url || res?.url || res?.fileUrl || '').trim();
    })
    .filter(Boolean);
  return [...new Set(urls)];
}

export function normalizeModelSourceUploadFileList(fileList: UploadFile[]): UploadFile[] {
  return fileList.map((f) => {
    if (f.status === 'done') {
      const res = f.response as FileInfo | undefined;
      const url = (f.url || res?.fileUrl || '').trim();
      if (url) {
        const isImg = isLikelyRasterImageFile(f);
        return { ...f, url, thumbUrl: isImg ? f.thumbUrl || url : f.thumbUrl };
      }
    }
    return f;
  });
}
