import type { ToolReferenceAsset, ToolReferenceInput } from '../api/tools'

export type VideoGenerationMode = 'text_to_video' | 'first_last_frame' | 'omni_reference'
export type GenerationReferenceKind = 'image' | 'video' | 'audio'
export type GenerationReferenceLimits = { images: number; videos: number; audios: number }
export type GenerationReference = {
  id: string
  role: ToolReferenceInput['role']
  kind: GenerationReferenceKind
  name: string
  url: string
  file?: File
  assetId?: number
}

/** 混合参考下媒体ประเภท到ส่งตัวละคร的固定映射。 */
export const roleForReferenceKind: Record<GenerationReferenceKind, ToolReferenceInput['role']> = {
  image: 'reference_image',
  video: 'reference_video',
  audio: 'reference_audio',
}

/** 按แอสเซท真实媒体ประเภท分类，兼容ตัวละคร、ฉาก、อุปกรณ์/พร็อพ等业务ประเภท。 */
export function toolReferenceAssetKind(asset: ToolReferenceAsset): GenerationReferenceKind {
  if (asset.media_kind === 'audio' || asset.media_kind === 'video' || asset.media_kind === 'image') return asset.media_kind
  if (asset.asset_type === 'video' || asset.type === 'video') return 'video'
  if (asset.asset_type === 'audio' || asset.type === 'audio' || asset.type === 'voice') return 'audio'
  return 'image'
}

/** 把แอสเซท包装成参考资料条目，仅ส่งแอสเซท ID，媒体地址只用于本地ดูตัวอย่าง。 */
export function referenceFromAsset(asset: ToolReferenceAsset, role: ToolReferenceInput['role'], fallbackName: string): GenerationReference {
  return {
    id: crypto.randomUUID(),
    role,
    kind: toolReferenceAssetKind(asset),
    name: asset.name || fallbackName,
    url: asset.url || asset.cover || '',
    assetId: asset.id,
  }
}

/** 数量上限校验：กลับ双语错误文案，通过时กลับ null。 */
export function checkGenerationReferenceCounts(
  next: GenerationReference[],
  limits: GenerationReferenceLimits | undefined,
  frameMode: boolean,
  t: (zh: string, en: string) => string,
): string | null {
  const max = generationReferenceLimits(limits)
  const counts = { image: 0, video: 0, audio: 0 }
  for (const reference of next) counts[reference.kind] += 1
  if (counts.image > max.images || counts.video > max.videos || counts.audio > max.audios || (!frameMode && next.length > 12)) {
    return t(
      `参考资料超出上限：รูปภาพ ${max.images} 张、วิดีโอ ${max.videos} 段、เสียง ${max.audios} 段，最多 12 份。`,
      `Reference limit: ${max.images} images, ${max.videos} videos, ${max.audios} audio clips; 12 files in total.`,
    )
  }
  return null
}

/** 将模型参考上限收紧到混合参考协议允许的范围，保留 0 表示不支持。 */
export function generationReferenceLimits(limits?: GenerationReferenceLimits): GenerationReferenceLimits {
  const bounded = (value: number | undefined, cap: number) => Math.max(0, Math.min(cap, Math.floor(value ?? cap)))
  return { images: bounded(limits?.images, 9), videos: bounded(limits?.videos, 3), audios: bounded(limits?.audios, 3) }
}

/** 扩展名与 MIME 同时符合服务端格式范围，未提供 MIME 时按扩展名识别。 */
export function generationReferenceFileKind(file: Pick<File, 'type' | 'name'>): GenerationReferenceKind | null {
  const kind = /\.(png|jpe?g|webp)$/i.test(file.name) ? 'image'
    : /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name) ? 'audio'
    : /\.(mp4|mov|webm)$/i.test(file.name) ? 'video' : null
  if (!kind) return null
  const mime = file.type.toLowerCase()
  return !mime || mime === 'application/octet-stream' || mime.startsWith(`${kind}/`) ? kind : null
}

/** ส่ง前校验模式、资料ประเภท和数量，切换模型后同样保留并检查原有เลือก。 */
export function validateGenerationReferences(
  mode: VideoGenerationMode,
  value: GenerationReference[],
  limits?: GenerationReferenceLimits,
): string | null {
  if (mode === 'text_to_video') return value.length ? '文生วิดีโอ无需参考资料，请切换生成方式后使用。' : null
  const max = generationReferenceLimits(limits)
  const counts = { image: 0, video: 0, audio: 0 }
  for (const reference of value) {
    if (!reference.file && (!reference.assetId || reference.assetId < 1)) return '参考资料已失效，请重新อัปโหลด或从แอสเซท库เลือก。'
    if (reference.file && reference.file.size === 0) return '参考文件不能为空，请重新เลือก。'
    if (reference.file && reference.file.size > 40 * 1024 * 1024) return '单个参考文件不能超过 40MB。'
    if (reference.file && generationReferenceFileKind(reference.file) !== reference.kind) return '参考文件格式或媒体ประเภท不支持，请重新เลือก。'
    counts[reference.kind] += 1
    const expectedRole = reference.kind === 'image' ? 'reference_image' : reference.kind === 'video' ? 'reference_video' : 'reference_audio'
    if (mode === 'omni_reference' && reference.role !== expectedRole) return '全能参考请使用รูปภาพ、วิดีโอ或เสียง参考资料。'
    if (mode === 'first_last_frame' && (reference.kind !== 'image' || !['first_frame', 'last_frame'].includes(reference.role))) return '首尾帧仅支持首帧和尾帧รูปภาพ。'
  }
  if (counts.image > max.images) return max.images === 0 ? '当前模型不支持ภาพอ้างอิง片，请切换模型。' : `当前模型最多支持 ${max.images} 张ภาพอ้างอิง片，请移除多余รูปภาพ。`
  if (counts.video > max.videos) return max.videos === 0 ? '当前模型不支持วิดีโออ้างอิง，请切换模型。' : `当前模型最多支持 ${max.videos} 段วิดีโออ้างอิง，请移除多余วิดีโอ。`
  if (counts.audio > max.audios) return max.audios === 0 ? '当前模型不支持เสียงอ้างอิง，请切换模型。' : `当前模型最多支持 ${max.audios} 段เสียงอ้างอิง，请移除多余เสียง。`
  if (mode === 'first_last_frame') {
    if (max.images < 1) return '当前模型不支持首尾帧，请切换模型。'
    if (!value.some(item => item.role === 'first_frame')) return '请อัปโหลด或从แอสเซท库เลือก首帧รูปภาพ。'
    if (value.filter(item => item.role === 'first_frame').length > 1 || value.filter(item => item.role === 'last_frame').length > 1) return '首帧和尾帧分别只能เลือก一张รูปภาพ。'
  } else {
    if (!value.length) return '请อัปโหลด或从แอสเซท库เลือก至少一份参考资料。'
    if (value.length > 12) return '全能参考最多支持 12 份资料，请移除多余资料。'
  }
  return null
}

/** 文件索引对应实际 multipart 顺序；แอสเซท只ส่ง ID，由服务端校验归属。 */
export function serializeGenerationReferences(value: GenerationReference[]): { files: File[]; references: ToolReferenceInput[] } {
  const files: File[] = []
  const references = value.map(item => {
    if (item.file) {
      const file_index = files.length
      files.push(item.file)
      return { role: item.role, file_index }
    }
    return { role: item.role, asset_id: item.assetId }
  })
  return { files, references }
}
