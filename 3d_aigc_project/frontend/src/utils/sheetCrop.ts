export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

const MIN_CROP_SIZE = 16

export function clampRect(
  rect: CropRect,
  sourceWidth: number,
  sourceHeight: number,
  minSize = MIN_CROP_SIZE
): CropRect {
  const width = Math.max(minSize, Math.min(rect.width, sourceWidth))
  const height = Math.max(minSize, Math.min(rect.height, sourceHeight))
  const x = Math.max(0, Math.min(rect.x, sourceWidth - width))
  const y = Math.max(0, Math.min(rect.y, sourceHeight - height))
  return { x, y, width, height }
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('无法加载图像'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function cropImageRegion(
  sourceFile: File,
  region: CropRect
): Promise<Blob> {
  const img = await loadImageFromFile(sourceFile)
  const clamped = clampRect(region, img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = clamped.width
  canvas.height = clamped.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.drawImage(
    img,
    clamped.x,
    clamped.y,
    clamped.width,
    clamped.height,
    0,
    0,
    clamped.width,
    clamped.height
  )
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  )
  if (!blob) throw new Error('裁剪失败')
  return blob
}

export function normalizeDrawRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sourceWidth: number,
  sourceHeight: number
): CropRect | null {
  const left = Math.min(x0, x1)
  const top = Math.min(y0, y1)
  const width = Math.abs(x1 - x0)
  const height = Math.abs(y1 - y0)
  if (width < MIN_CROP_SIZE || height < MIN_CROP_SIZE) return null
  return clampRect({ x: left, y: top, width, height }, sourceWidth, sourceHeight)
}
