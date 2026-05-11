/** 常见栅格图扩展名（用于表格缩略图、Upload 预览等） */
export function isRasterImageFileName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(name.trim());
}
