import { ref, computed } from 'vue'
import type { GemPreset, InlayInfo, SplitMultiViewResult } from '@/api'
import type { ViewFace, ViewImages } from '@/types/multiView'
import type { ImageTransform } from '@/utils/imageTransform'
import {
  MAX_DRAFTS,
  blobToFile,
  deleteAllDraftBlobsForDraft,
  draftAssetKey,
  getDraftBlob,
  putDraftBlob,
  readDraftMetaList,
  writeDraftMetaList,
  type DraftMeta,
  type StoredFileMeta,
} from '@/utils/draftStorage'
import {
  createThumbnailBlob,
  draftThumbnailKey,
  pickThumbnailFromSnapshot,
  resolveThumbnailBlobFromPayload,
} from '@/utils/draftThumbnail'

export const DRAFT_PAYLOAD_VERSION = 1

export interface DraftFileRef {
  meta: StoredFileMeta
  asset: string
}

export interface DraftSheetState {
  splitResult: SplitMultiViewResult | null
  splitMode: 'auto' | 'manual'
  editorTool: 'select' | 'draw'
  assignments: Record<string, ViewFace | ''>
  transforms: Record<string, ImageTransform>
  cropAssets: Record<string, string>
}

export interface GenerationDraftPayload {
  version: typeof DRAFT_PAYLOAD_VERSION
  uploadMode: 'single' | 'sheet' | 'multi'
  generateParams: {
    prompt: string
    output_format: 'OBJ' | 'GLB' | 'STL'
    generation_mode?: 'fast' | 'quality'
  }
  inlayEnabled: boolean
  inlayPanelOpen: boolean
  selectedInlay: InlayInfo | null
  bgRemovalEnabled: boolean
  enableGemRepaint?: boolean
  gemRepaintSeed?: number
  gemPreset: GemPreset
  gemSensitivity: number
  lastGemCoverage: number | null
  preprocessSessionId: string
  preprocessSessionIds: Partial<Record<ViewFace, string>>
  singleImage?: DraftFileRef
  processedSingle?: DraftFileRef
  viewFiles?: Partial<Record<ViewFace, DraftFileRef>>
  processedViewFiles?: Partial<Record<ViewFace, DraftFileRef>>
  sheetSource?: DraftFileRef
  sheetState?: DraftSheetState
}

export interface RestoredDraftData {
  payload: GenerationDraftPayload
  selectedImage: File | null
  processedImageFile: File | null
  viewImages: ViewImages
  processedViewFiles: ViewImages
  sheetSource: File | null
  sheetCropBlobs: Record<string, Blob>
}

export interface DraftSnapshotInput {
  uploadMode: 'single' | 'sheet' | 'multi'
  generateParams: GenerationDraftPayload['generateParams']
  inlayEnabled: boolean
  inlayPanelOpen: boolean
  selectedInlay: InlayInfo | null
  bgRemovalEnabled: boolean
  enableGemRepaint?: boolean
  gemRepaintSeed?: number
  gemPreset: GemPreset
  gemSensitivity: number
  lastGemCoverage: number | null
  preprocessSessionId: string
  preprocessSessionIds: Partial<Record<ViewFace, string>>
  selectedImage: File | null
  processedImageFile: File | null
  viewImages: ViewImages
  processedViewFiles: ViewImages
  sheetSource: File | null
  sheetState: Omit<DraftSheetState, 'cropAssets'> & {
    cropBlobs: Record<string, Blob>
  } | null
}

const UPLOAD_MODE_LABELS: Record<GenerationDraftPayload['uploadMode'], string> = {
  single: '单图',
  sheet: '单图多视角',
  multi: '六面体',
}

function truncate(text: string, max = 24): string {
  const t = text.trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function buildDraftTitle(input: DraftSnapshotInput): string {
  if (input.selectedImage?.name) return truncate(input.selectedImage.name, 32)
  if (input.sheetSource?.name) return truncate(input.sheetSource.name, 32)
  const firstView = Object.values(input.viewImages).find(Boolean)
  if (firstView?.name) return truncate(firstView.name, 32)
  if (input.generateParams.prompt.trim()) return truncate(input.generateParams.prompt, 32)
  return '未命名草稿'
}

export function buildStageSummary(input: DraftSnapshotInput): string {
  const parts: string[] = [UPLOAD_MODE_LABELS[input.uploadMode]]

  if (input.uploadMode === 'sheet' && input.sheetState?.splitResult) {
    const cropCount = input.sheetState.splitResult.crops.length
    const assigned = Object.values(input.sheetState.assignments).filter(Boolean).length
    parts.push(`切分 ${cropCount} 块`)
    if (assigned > 0) parts.push(`已分配 ${assigned} 视角`)
  } else if (input.uploadMode === 'multi' || Object.keys(input.viewImages).length >= 2) {
    parts.push(`${Object.keys(input.viewImages).length} 张视角`)
  } else if (input.selectedImage) {
    parts.push('已上传')
  } else {
    parts.push('待上传')
  }

  if (input.bgRemovalEnabled) {
    const viewCount = Object.keys(input.viewImages).length
    const processedCount = Object.keys(input.processedViewFiles).length
    if (input.processedImageFile || processedCount > 0) {
      if (viewCount >= 2 && processedCount > 0 && processedCount < viewCount) {
        parts.push('部分预处理')
      } else {
        parts.push('已预处理')
      }
    } else {
      parts.push('待预处理')
    }
  }

  if (input.inlayEnabled && input.selectedInlay) {
    parts.push('含镶嵌')
  }

  if (input.generateParams.prompt.trim()) {
    parts.push('有提示词')
  }

  return parts.join(' · ')
}

export function hasDraftContent(input: DraftSnapshotInput): boolean {
  return !!(
    input.selectedImage
    || input.sheetSource
    || Object.keys(input.viewImages).length
    || input.generateParams.prompt.trim()
    || (input.inlayEnabled && input.selectedInlay)
  )
}

async function storeFile(
  draftId: string,
  asset: string,
  file: File | Blob,
  meta: StoredFileMeta
): Promise<DraftFileRef> {
  const key = draftAssetKey(draftId, asset)
  await putDraftBlob(key, file instanceof File ? file : file)
  return { asset, meta }
}

function payloadStorageKey(draftId: string): string {
  return draftAssetKey(draftId, '__payload__')
}

async function loadPayloadById(draftId: string): Promise<GenerationDraftPayload | null> {
  const blob = await getDraftBlob(payloadStorageKey(draftId))
  if (!blob) return null
  try {
    const text = await blob.text()
    const parsed = JSON.parse(text) as GenerationDraftPayload
    if (parsed.version !== DRAFT_PAYLOAD_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export async function getDraftThumbnailBlob(draftId: string): Promise<Blob | null> {
  const cached = await getDraftBlob(draftThumbnailKey(draftId))
  if (cached) return cached

  const payload = await loadPayloadById(draftId)
  if (!payload) return null

  const source = await resolveThumbnailBlobFromPayload(draftId, payload)
  if (!source) return null

  try {
    const thumb = await createThumbnailBlob(source)
    await putDraftBlob(draftThumbnailKey(draftId), thumb)
    return thumb
  } catch {
    return source
  }
}

export function useGenerationDraft() {
  const draftList = ref<DraftMeta[]>(readDraftMetaList())
  const activeDraftId = ref<string | null>(null)
  const drawerVisible = ref(false)
  const saving = ref(false)
  const restoring = ref(false)

  const activeDraft = computed(() =>
    draftList.value.find((d) => d.id === activeDraftId.value) ?? null
  )

  function refreshList() {
    draftList.value = readDraftMetaList().sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function persistPayload(draftId: string, payload: GenerationDraftPayload): Promise<void> {
    const json = JSON.stringify(payload)
    await putDraftBlob(payloadStorageKey(draftId), new Blob([json], { type: 'application/json' }))
  }

  async function loadPayload(draftId: string): Promise<GenerationDraftPayload | null> {
    return loadPayloadById(draftId)
  }

  async function loadFileRef(draftId: string, ref: DraftFileRef): Promise<File | null> {
    const blob = await getDraftBlob(draftAssetKey(draftId, ref.asset))
    if (!blob) return null
    return blobToFile(blob, ref.meta)
  }

  async function loadViewFiles(
    draftId: string,
    refs: Partial<Record<ViewFace, DraftFileRef>> | undefined
  ): Promise<ViewImages> {
    const views: ViewImages = {}
    if (!refs) return views
    for (const face of Object.keys(refs) as ViewFace[]) {
      const ref = refs[face]
      if (!ref) continue
      const file = await loadFileRef(draftId, ref)
      if (file) views[face] = file
    }
    return views
  }

  async function saveDraftFromSnapshot(
    input: DraftSnapshotInput,
    options?: { draftId?: string | null; forceNew?: boolean }
  ): Promise<string | null> {
    if (!hasDraftContent(input)) return null

    saving.value = true
    const draftId = options?.forceNew
      ? crypto.randomUUID()
      : (options?.draftId ?? activeDraftId.value ?? crypto.randomUUID())

    try {
      const payload: GenerationDraftPayload = {
        version: DRAFT_PAYLOAD_VERSION,
        uploadMode: input.uploadMode,
        generateParams: { ...input.generateParams },
        inlayEnabled: input.inlayEnabled,
        inlayPanelOpen: input.inlayPanelOpen,
        selectedInlay: input.selectedInlay ? { ...input.selectedInlay } : null,
        bgRemovalEnabled: input.bgRemovalEnabled,
        enableGemRepaint: input.enableGemRepaint ?? false,
        gemRepaintSeed: input.gemRepaintSeed ?? 42,
        gemPreset: input.gemPreset,
        gemSensitivity: input.gemSensitivity,
        lastGemCoverage: input.lastGemCoverage,
        preprocessSessionId: input.preprocessSessionId,
        preprocessSessionIds: { ...input.preprocessSessionIds },
      }

      if (input.selectedImage) {
        payload.singleImage = await storeFile(draftId, 'single', input.selectedImage, {
          name: input.selectedImage.name,
          type: input.selectedImage.type,
          lastModified: input.selectedImage.lastModified,
        })
      }

      if (input.processedImageFile) {
        payload.processedSingle = await storeFile(draftId, 'processed-single', input.processedImageFile, {
          name: input.processedImageFile.name,
          type: input.processedImageFile.type,
          lastModified: input.processedImageFile.lastModified,
        })
      }

      const viewRefs: Partial<Record<ViewFace, DraftFileRef>> = {}
      for (const [face, file] of Object.entries(input.viewImages) as [ViewFace, File][]) {
        viewRefs[face] = await storeFile(draftId, `view-${face}`, file, {
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
        })
      }
      if (Object.keys(viewRefs).length) payload.viewFiles = viewRefs

      const processedRefs: Partial<Record<ViewFace, DraftFileRef>> = {}
      for (const [face, file] of Object.entries(input.processedViewFiles) as [ViewFace, File][]) {
        processedRefs[face] = await storeFile(draftId, `processed-${face}`, file, {
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
        })
      }
      if (Object.keys(processedRefs).length) payload.processedViewFiles = processedRefs

      if (input.sheetSource && input.sheetState) {
        payload.sheetSource = await storeFile(draftId, 'sheet-source', input.sheetSource, {
          name: input.sheetSource.name,
          type: input.sheetSource.type,
          lastModified: input.sheetSource.lastModified,
        })

        const cropAssets: Record<string, string> = {}
        for (const [cropId, blob] of Object.entries(input.sheetState.cropBlobs)) {
          const asset = `sheet-crop-${cropId}`
          cropAssets[cropId] = asset
          await putDraftBlob(draftAssetKey(draftId, asset), blob)
        }

        payload.sheetState = {
          splitResult: input.sheetState.splitResult,
          splitMode: input.sheetState.splitMode,
          editorTool: input.sheetState.editorTool,
          assignments: { ...input.sheetState.assignments },
          transforms: { ...input.sheetState.transforms },
          cropAssets,
        }
      }

      await persistPayload(draftId, payload)

      const thumbSource = pickThumbnailFromSnapshot(input)
      if (thumbSource) {
        try {
          const thumb = await createThumbnailBlob(thumbSource)
          await putDraftBlob(draftThumbnailKey(draftId), thumb)
        } catch {
          // 缩略图失败不影响草稿保存
        }
      }

      const meta: DraftMeta = {
        id: draftId,
        title: buildDraftTitle(input),
        updatedAt: Date.now(),
        stageSummary: buildStageSummary(input),
        uploadMode: input.uploadMode,
      }

      let list = readDraftMetaList().filter((d) => d.id !== draftId)
      list.unshift(meta)
      if (list.length > MAX_DRAFTS) {
        const evicted = list.slice(MAX_DRAFTS)
        list = list.slice(0, MAX_DRAFTS)
        for (const item of evicted) {
          await deleteAllDraftBlobsForDraft(item.id)
        }
      }
      writeDraftMetaList(list)
      refreshList()
      activeDraftId.value = draftId
      return draftId
    } finally {
      saving.value = false
    }
  }

  async function loadDraftForRestore(draftId: string): Promise<RestoredDraftData | null> {
    restoring.value = true
    try {
      const payload = await loadPayload(draftId)
      if (!payload) return null

      const selectedImage = payload.singleImage
        ? await loadFileRef(draftId, payload.singleImage)
        : null
      const processedImageFile = payload.processedSingle
        ? await loadFileRef(draftId, payload.processedSingle)
        : null
      const viewImages = await loadViewFiles(draftId, payload.viewFiles)
      const processedViewFiles = await loadViewFiles(draftId, payload.processedViewFiles)
      const sheetSource = payload.sheetSource
        ? await loadFileRef(draftId, payload.sheetSource)
        : null

      const sheetCropBlobs: Record<string, Blob> = {}
      if (payload.sheetState?.cropAssets) {
        for (const [cropId, asset] of Object.entries(payload.sheetState.cropAssets)) {
          const blob = await getDraftBlob(draftAssetKey(draftId, asset))
          if (blob) sheetCropBlobs[cropId] = blob
        }
      }

      return {
        payload,
        selectedImage,
        processedImageFile,
        viewImages,
        processedViewFiles,
        sheetSource,
        sheetCropBlobs,
      }
    } finally {
      restoring.value = false
    }
  }

  async function deleteDraft(draftId: string): Promise<void> {
    await deleteAllDraftBlobsForDraft(draftId)
    const list = readDraftMetaList().filter((d) => d.id !== draftId)
    writeDraftMetaList(list)
    if (activeDraftId.value === draftId) activeDraftId.value = null
    refreshList()
  }

  function startNewDraft() {
    activeDraftId.value = null
  }

  function openDrawer() {
    refreshList()
    drawerVisible.value = true
  }

  function closeDrawer() {
    drawerVisible.value = false
  }

  function formatUpdatedAt(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    const isToday =
      d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate()
    if (isToday) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return {
    draftList,
    activeDraftId,
    activeDraft,
    drawerVisible,
    saving,
    restoring,
    refreshList,
    saveDraftFromSnapshot,
    loadDraftForRestore,
    deleteDraft,
    startNewDraft,
    openDrawer,
    closeDrawer,
    formatUpdatedAt,
    buildDraftTitle,
    buildStageSummary,
    hasDraftContent,
  }
}

export type UseGenerationDraftReturn = ReturnType<typeof useGenerationDraft>
