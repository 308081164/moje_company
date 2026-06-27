export interface ImageTransform {
  flipH: boolean
  flipV: boolean
  /** 顺时针旋转角度：0 | 90 | 180 | 270 */
  rotation: number
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = {
  flipH: false,
  flipV: false,
  rotation: 0,
}

function normalizeRotation(deg: number): number {
  const n = ((deg % 360) + 360) % 360
  return n === 90 || n === 180 || n === 270 ? n : 0
}

export function rotateCW(transform: ImageTransform, steps = 1): ImageTransform {
  return {
    ...transform,
    rotation: normalizeRotation(transform.rotation + steps * 90),
  }
}

export function rotateCCW(transform: ImageTransform, steps = 1): ImageTransform {
  return rotateCW(transform, -steps)
}

export function toggleFlipH(transform: ImageTransform): ImageTransform {
  return { ...transform, flipH: !transform.flipH }
}

export function toggleFlipV(transform: ImageTransform): ImageTransform {
  return { ...transform, flipV: !transform.flipV }
}

export async function applyImageTransform(
  source: Blob | File,
  transform: ImageTransform
): Promise<Blob> {
  const rotation = normalizeRotation(transform.rotation)
  const img = await createImageBitmap(source)
  const swap = rotation === 90 || rotation === 270
  const canvasW = swap ? img.height : img.width
  const canvasH = swap ? img.width : img.height

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    img.close()
    throw new Error('无法创建画布上下文')
  }

  ctx.translate(canvasW / 2, canvasH / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  img.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  )
  if (!blob) throw new Error('图像变换失败')
  return blob
}
