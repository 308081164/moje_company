export type MeshFormat = 'GLB' | 'OBJ' | 'STL'

/** 根据 result_file 扩展名推断格式，避免 output_format 与真实文件不一致 */
export function inferMeshFormat(
  resultFile?: string | null,
  outputFormat?: string | null,
): MeshFormat {
  if (resultFile) {
    const ext = resultFile.split('.').pop()?.toLowerCase()
    if (ext === 'glb') return 'GLB'
    if (ext === 'obj') return 'OBJ'
    if (ext === 'stl') return 'STL'
  }
  const fmt = (outputFormat || 'GLB').toUpperCase()
  if (fmt === 'OBJ' || fmt === 'STL') return fmt
  return 'GLB'
}

/** 从二进制内容嗅探 mesh 格式（用于 download 接口格式与声明不符时） */
export function sniffMeshFormatFromBuffer(buffer: ArrayBuffer): MeshFormat | null {
  if (buffer.byteLength < 4) return null
  const head = new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength))
  const magic = String.fromCharCode(head[0], head[1], head[2], head[3])
  if (magic === 'glTF') return 'GLB'

  const text = new TextDecoder().decode(head).trimStart()
  if (text.startsWith('solid') || text.startsWith('SOLID')) return 'STL'
  if (text.startsWith('v ') || text.startsWith('v\t') || text.startsWith('#') || text.startsWith('o ')) {
    return 'OBJ'
  }

  // 二进制 STL：80 字节头 + uint32 面数
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer)
    const triCount = view.getUint32(80, true)
    if (triCount > 0 && 84 + triCount * 50 <= buffer.byteLength) {
      return 'STL'
    }
  }
  return null
}
