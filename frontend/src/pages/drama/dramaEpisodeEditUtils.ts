/** 分 ตอนแก้ไข页辅助：หมวดหมู่แอสเซท、引用解析、แท็ก文案 */
import type { DramaAsset, DramaFragment } from '../../api/drama'
import {
  DRAMA_RATIO_OPTIONS,
  DRAMA_RES_OPTIONS,
  readEpisodeAspectRatio,
  readEpisodeResolution,
  readProjectAspectRatio,
  readProjectResolution,
} from '../../lib/dramaProjectOutputSettings'

export type AssetScope = 'episode' | 'series'
export type AssetTab = 'character' | 'scene' | 'prop'

export const ASSET_TABS: Array<{ key: AssetTab; label: string }> = [
  { key: 'character', label: 'ตัวละคร' },
  { key: 'scene', label: 'ฉาก' },
  { key: 'prop', label: 'อุปกรณ์/พร็อพ' },
]

export const RATIO_OPTIONS = DRAMA_RATIO_OPTIONS
export const RES_OPTIONS = DRAMA_RES_OPTIONS
export { readProjectAspectRatio, readProjectResolution, readEpisodeAspectRatio, readEpisodeResolution }

// 从分镜เนื้อหาหลัก提取 @asset:id
export function extractAssetIds(content: string): number[] {
  const ids: number[] = []
  const re = /@asset:(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    ids.push(Number(m[1]))
  }
  return ids
}

// 合并เนื้อหาหลัก @asset 与 asset_ids，去重保序
export function collectFragmentAssetIds(frag: DramaFragment | null | undefined): number[] {
  if (!frag) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of [...extractAssetIds(frag.content || ''), ...(frag.asset_ids || [])]) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export type FragmentRefStripItem = {
  assetId: number
  name: string
  type: string
  previewUrl: string
  isCharacter?: boolean
  voiceLabel?: string
  voiceUrl?: string
}

// 组装当前分镜关联แอสเซท条
export function buildFragmentRefStripItems(
  frag: DramaFragment | null | undefined,
  assets: DramaAsset[],
  resolveUrl: (url: string | null | undefined) => string,
  readVoice?: (asset: DramaAsset) => { label: string; url: string } | null,
): FragmentRefStripItem[] {
  const byId = new Map(assets.map((a) => [a.id, a]))
  return collectFragmentAssetIds(frag).map((assetId) => {
    const asset = byId.get(assetId)
    const preview = asset ? resolveUrl(asset.cover || asset.url) : ''
    const isCharacter = asset ? normalizeAssetTab(asset.type) === 'character' : false
    const voice = asset && readVoice ? readVoice(asset) : null
    return {
      assetId,
      name: asset?.name || `แอสเซท ${assetId}`,
      type: asset?.type || '',
      previewUrl: preview,
      isCharacter,
      voiceLabel: voice?.label,
      voiceUrl: voice?.url,
    }
  })
}

// 规范化หมวดหมู่แอสเซท
export function normalizeAssetTab(type: string): AssetTab | null {
  const t = (type || '').toLowerCase()
  if (t === 'character' || t === 'ตัวละคร') return 'character'
  if (t === 'scene' || t === 'ฉาก') return 'scene'
  if (t === 'prop' || t === 'อุปกรณ์/พร็อพ') return 'prop'
  return null
}

// 从分镜เนื้อหาหลัก合计 @duration วินาที数（与后端 fragment_content_duration 一致）
export function sumFragmentContentDuration(content: string): number {
  const re = /@duration:(\d+)/g
  let total = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(content || ''))) {
    const sec = Number(m[1])
    if (sec > 0) total += sec
  }
  return total
}

// 解析分镜生成สถานะ（params.generation 优先于已有 video，支持สร้างใหม่）
export function readFragmentGenerationStatus(
  frag: DramaFragment,
): { status: string; error?: string; message?: string; phase?: string } {
  const gen = frag.params?.generation
  if (gen && typeof gen === 'object') {
    const row = gen as Record<string, unknown>
    const status = typeof row.status === 'string' ? row.status : 'idle'
    if (['queued', 'running', 'generating', 'failed', 'cancelled'].includes(status)) {
      const surface = typeof row.error === 'string' ? row.error : undefined
      const root = typeof row.root_error === 'string' ? row.root_error.trim() : ''
      const error =
        status === 'failed' &&
        root &&
        (!surface || /ลองใหม่超过|超过ลองใหม่/.test(surface))
          ? root
          : surface
      return {
        status,
        error,
        message: typeof row.message === 'string' ? row.message : undefined,
        phase: typeof row.phase === 'string' ? row.phase : undefined,
      }
    }
    if (status === 'done') {
      return {
        status: 'done',
        message: typeof row.message === 'string' ? row.message : undefined,
      }
    }
  }
  if (frag.video) return { status: 'done' }
  return { status: 'idle' }
}

// 是否处于排队/กำลังสร้าง
export function isFragmentGenerationBusy(status: string): boolean {
  return ['queued', 'running', 'generating', 'pending', 'leased', 'awaiting_poll', 'awaiting_review'].includes(
    status,
  )
}

export type FragmentVideoVersion = {
  id: string
  video: string
  cover?: string
  lastFrameUrl?: string | null
  createdAt?: string
  source?: string
}

// 读取分镜历史成片版本
export function readFragmentVideoVersions(frag: DramaFragment | null | undefined): FragmentVideoVersion[] {
  if (!frag?.params || typeof frag.params !== 'object') return []
  const raw = (frag.params as Record<string, unknown>).video_versions
  if (!Array.isArray(raw)) return []
  const out: FragmentVideoVersion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const video = typeof row.video === 'string' ? row.video.trim() : ''
    if (!id || !video) continue
    out.push({
      id,
      video,
      cover: typeof row.cover === 'string' ? row.cover : '',
      lastFrameUrl: typeof row.lastFrameUrl === 'string' ? row.lastFrameUrl : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
      source: typeof row.source === 'string' ? row.source : undefined,
    })
  }
  return out
}

// 分镜队列徽标文案
export function fragmentQueueBadgeLabel(status: string): string {
  if (status === 'queued' || status === 'pending' || status === 'leased') return '排队'
  if (status === 'running' || status === 'generating' || status === 'awaiting_poll') return 'กำลังสร้าง'
  if (status === 'failed') return 'ล้มเหลว'
  return ''
}

// บันทึก前：有 @duration แท็ก时用合计值作为 duration_sec
export function resolveFragmentDurationSec(
  content: string,
  durationSec: number | null | undefined,
): number {
  const fromTags = sumFragmentContentDuration(content)
  if (fromTags > 0) return Math.min(15, Math.max(4, fromTags))
  const fallback = durationSec && durationSec > 0 ? durationSec : 8
  return Math.min(15, Math.max(4, fallback))
}

// 格式化片段แท็ก
export function formatFragLabel(index: number, durationSec: number | null | undefined) {
  const n = String(index + 1).padStart(2, '0')
  const sec = durationSec && durationSec > 0 ? durationSec : 8
  return `片段 ${n} · ${sec}s`
}

// 按本 ตอน/全 ตอน与分类ตัวกรองแอสเซท
export function filterEpisodeAssets(
  assets: DramaAsset[],
  scope: AssetScope,
  tab: AssetTab | null,
  referencedIds: Set<number>,
): DramaAsset[] {
  let list = assets.filter((a) => normalizeAssetTab(a.type))
  if (scope === 'episode') {
    list = list.filter((a) => referencedIds.has(a.id))
  }
  if (tab) {
    list = list.filter((a) => normalizeAssetTab(a.type) === tab)
  }
  return list
}
