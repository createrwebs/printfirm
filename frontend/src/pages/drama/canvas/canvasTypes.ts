/** 画布节点ประเภท与เลือก器选项定义 */
import type { LucideIcon } from 'lucide-react'
import {
  AudioLines,
  Image as ImageIcon,
  Landmark,
  PlaySquare,
  Text,
  UserRound,
} from 'lucide-react'

export type CanvasNodeKind = 'character' | 'scene' | 'video' | 'image' | 'text' | 'audio'

export type CanvasNodeOption = {
  id: CanvasNodeKind
  label: string
  icon: LucideIcon
}

export type CanvasAssetNodeData = {
  kind: CanvasNodeKind
  label: string
  assetId?: number
  mediaUrl?: string | null
  textContent?: string
  generating?: boolean
  /** วิดีโอ节点 Seedance 生成参数 */
  videoOptions?: Record<string, unknown>
  /** ตัวละคร/ฉาก/รูปภาพ节点生图参数（模型/อัตราส่วน/ความคมชัด） */
  imageOptions?: Record<string, unknown>
  [key: string]: unknown
}

/** 支持本地媒体อัปโหลด的节点ประเภท */
export const CANVAS_UPLOADABLE_KINDS = new Set<CanvasNodeKind>([
  'character',
  'scene',
  'image',
  'video',
  'audio',
])

/** 支持คำแนะนำ词 + AI 生成的节点ประเภท */
export const CANVAS_GENERATABLE_KINDS = new Set<CanvasNodeKind>([
  'character',
  'scene',
  'image',
  'video',
])

/** 节点ประเภท对应的 Drama asset_type */
export function canvasKindToAssetType(kind: CanvasNodeKind): string {
  if (kind === 'video') return 'video'
  if (kind === 'audio') return 'audio'
  if (kind === 'text') return 'text'
  return 'image'
}

/** 空画布居中ความเร็วสูงสร้างใหม่选项（顺序与设计稿一致） */
export const CANVAS_NODE_OPTIONS: CanvasNodeOption[] = [
  { id: 'character', label: 'ตัวละคร', icon: UserRound },
  { id: 'scene', label: 'ฉาก', icon: Landmark },
  { id: 'video', label: 'วิดีโอ', icon: PlaySquare },
  { id: 'image', label: 'รูปภาพ', icon: ImageIcon },
  { id: 'text', label: '文本', icon: Text },
  { id: 'audio', label: 'เสียง', icon: AudioLines },
]

/** 左侧เพิ่ม面板选项 */
export const ADD_NODE_OPTIONS: CanvasNodeOption[] = [
  { id: 'character', label: 'ตัวละคร', icon: UserRound },
  { id: 'scene', label: 'ฉาก', icon: Landmark },
  { id: 'text', label: '文本', icon: Text },
  { id: 'image', label: 'รูปภาพ', icon: ImageIcon },
  { id: 'video', label: 'วิดีโอ', icon: PlaySquare },
  { id: 'audio', label: 'เสียง', icon: AudioLines },
]

export const CANVAS_NODE_OPTION_BY_KIND = Object.fromEntries(
  CANVAS_NODE_OPTIONS.map((option) => [option.id, option]),
) as Record<CanvasNodeKind, CanvasNodeOption>

/** 各ประเภทค่าเริ่มต้น展示名 */
export const CANVAS_NODE_DEFAULT_LABEL: Record<CanvasNodeKind, string> = {
  character: 'ตัวละครใหม่',
  scene: 'ฉากใหม่',
  video: 'วิดีโอใหม่',
  image: 'รูปภาพใหม่',
  text: '文本',
  audio: 'เสียงใหม่',
}

/**
 * 为สร้างใหม่画布节点生成不与现有节点ความขัดแย้ง的名称。
 * 后端同ประเภท同名会去重复用แอสเซท，导致 asset-{id} ความขัดแย้ง并覆盖旧节点。
 */
export function nextCanvasNodeLabel(
  kind: CanvasNodeKind,
  existing: Array<{ data: { kind: CanvasNodeKind; label?: string } }>,
): string {
  const base = CANVAS_NODE_DEFAULT_LABEL[kind]
  const used = new Set(
    existing
      .filter((n) => n.data.kind === kind)
      .map((n) => (typeof n.data.label === 'string' ? n.data.label.trim() : '')),
  )
  if (!used.has(base)) return base
  let i = 2
  while (used.has(`${base} ${i}`)) i += 1
  return `${base} ${i}`
}

/** 节点卡片尺寸（宽 × 高，用于落点居中；含页脚约 +40） */
export const CANVAS_NODE_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  character: { width: 200, height: 280 },
  scene: { width: 200, height: 280 },
  video: { width: 160, height: 240 },
  image: { width: 160, height: 240 },
  text: { width: 280, height: 140 },
  audio: { width: 240, height: 120 },
}

/** ดูตัวอย่าง区ค่าเริ่มต้น尺寸（不含页脚；无媒体时用แนวตั้ง (9:16)占位） */
export const CANVAS_MEDIA_BODY_SIZE: Record<
  Exclude<CanvasNodeKind, 'text' | 'audio'>,
  { width: number; height: number }
> = {
  character: { width: 200, height: 240 },
  scene: { width: 200, height: 240 },
  video: { width: 160, height: 220 },
  image: { width: 160, height: 220 },
}

/**
 * 按媒体宽高比计算ดูตัวอย่าง框尺寸：แนวนอน (16:9)变宽、แนวตั้ง (9:16)保持竖向。
 * aspect = naturalWidth / naturalHeight
 */
export function canvasMediaFrameSize(
  kind: CanvasNodeKind,
  aspect: number | null | undefined,
): { width: number; height: number } {
  if (kind === 'text') return { width: 280, height: 100 }
  if (kind === 'audio') return { width: 240, height: 96 }
  const fallback = CANVAS_MEDIA_BODY_SIZE[kind]
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return { ...fallback }

  const a = Math.min(Math.max(aspect, 9 / 21), 21 / 9)
  const shortSide = kind === 'character' || kind === 'scene' ? 200 : 160
  const maxLong = kind === 'character' || kind === 'scene' ? 320 : 280

  if (a >= 1) {
    // แนวนอน (16:9) / 正สี่เหลี่ยมจัตุรัส (1:1)：以短边为高
    const height = shortSide
    const width = Math.min(maxLong, Math.round(height * a))
    return { width, height: Math.max(120, Math.round(width / a)) }
  }
  // แนวตั้ง (9:16)：以短边为宽
  const width = shortSide
  const height = Math.min(maxLong, Math.round(width / a))
  return { width, height: Math.max(140, height) }
}

/** 网格吸附步长 */
export const CANVAS_SNAP_GRID: [number, number] = [20, 20]

/** 自动บันทึก防抖毫วินาที */
export const CANVAS_AUTO_SAVE_MS = 2000

/** 历史栈最大深度 */
export const MAX_CANVAS_HISTORY = 50
