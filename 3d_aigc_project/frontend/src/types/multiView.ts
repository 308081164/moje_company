/** 六视图方位键（与后端 / hy3dgen 映射一致） */
export type ViewFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

export const VIEW_FACES: ViewFace[] = ['front', 'back', 'left', 'right', 'top', 'bottom']

/** hy3dgen MVImageProcessorV2 支持的视角（不含 top/bottom） */
export const HY3D_SUPPORTED_FACES: ViewFace[] = ['front', 'back', 'left', 'right']

export const VIEW_LABELS: Record<ViewFace, string> = {
  front: '正视图',
  back: '后视图',
  left: '左视图',
  right: '右视图',
  top: '俯视图',
  bottom: '仰视图',
}

export const VIEW_SHORT: Record<ViewFace, string> = {
  front: '正',
  back: '后',
  left: '左',
  right: '右',
  top: '俯',
  bottom: '仰',
}

export type ViewImages = Partial<Record<ViewFace, File>>

export function countViewImages(views: ViewImages): number {
  return VIEW_FACES.filter((f) => views[f]).length
}

export function hasMinimumViews(views: ViewImages, min = 2): boolean {
  return countViewImages(views) >= min
}
