import { VIEW_FACES, type ViewFace } from '@/types/multiView'
import type { DraftSnapshotInput, GenerationDraftPayload } from '@/composables/useGenerationDraft'
import { draftAssetKey, getDraftBlob } from '@/utils/draftStorage'

export const DRAFT_THUMBNAIL_ASSET = '__thumbnail__'
export const DRAFT_THUMBNAIL_MAX = 128

export function draftThumbnailKey(draftId: string): string {
  return draftAssetKey(draftId, DRAFT_THUMBNAIL_ASSET)
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

export async function createThumbnailBlob(
  source: File | Blob,
  maxSize = DRAFT_THUMBNAIL_MAX
): Promise<Blob> {
  const img = await loadImageFromBlob(source)
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('缩略图生成失败'))),
      'image/jpeg',
      0.82
    )
  })
}

export function pickThumbnailFromSnapshot(input: DraftSnapshotInput): File | Blob | null {
  if (input.processedImageFile) return input.processedImageFile
  if (input.selectedImage) return input.selectedImage

  for (const face of VIEW_FACES) {
    const file = input.processedViewFiles[face]
    if (file) return file
  }
  for (const face of VIEW_FACES) {
    const file = input.viewImages[face]
    if (file) return file
  }
  if (input.sheetSource) return input.sheetSource

  const cropBlobs = input.sheetState?.cropBlobs
  if (cropBlobs) {
    const first = Object.values(cropBlobs)[0]
    if (first) return first
  }
  return null
}

async function loadRefBlob(draftId: string, asset: string): Promise<Blob | null> {
  return getDraftBlob(draftAssetKey(draftId, asset))
}

export async function resolveThumbnailBlobFromPayload(
  draftId: string,
  payload: GenerationDraftPayload
): Promise<Blob | null> {
  if (payload.processedSingle) {
    const blob = await loadRefBlob(draftId, payload.processedSingle.asset)
    if (blob) return blob
  }
  if (payload.singleImage) {
    const blob = await loadRefBlob(draftId, payload.singleImage.asset)
    if (blob) return blob
  }

  for (const face of VIEW_FACES) {
    const ref = payload.processedViewFiles?.[face as ViewFace]
    if (ref) {
      const blob = await loadRefBlob(draftId, ref.asset)
      if (blob) return blob
    }
  }
  for (const face of VIEW_FACES) {
    const ref = payload.viewFiles?.[face as ViewFace]
    if (ref) {
      const blob = await loadRefBlob(draftId, ref.asset)
      if (blob) return blob
    }
  }
  if (payload.sheetSource) {
    const blob = await loadRefBlob(draftId, payload.sheetSource.asset)
    if (blob) return blob
  }
  if (payload.sheetState?.cropAssets) {
    for (const asset of Object.values(payload.sheetState.cropAssets)) {
      const blob = await loadRefBlob(draftId, asset)
      if (blob) return blob
    }
  }
  return null
}
