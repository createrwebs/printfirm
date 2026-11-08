import type { DramaProject, DramaProjectListItem } from '../api/drama'

export type DramaWorkflow = 'script' | 'canvas'
export type DramaProjectFilter = 'all' | 'running' | 'done' | 'draft'

const CANVAS_SOURCE_MARKERS = ['โปรเจกต์สร้างสรรค์แคนวาสอิสระ', '自由画布创作โปรเจกต์']
const CANVAS_TITLE_MARKERS = ['แคนวาสอิสระ', '自由画布']

type WorkflowSource = {
  workflow?: string | null
  title?: string | null
  params?: Record<string, unknown> | null
  script?: { source?: string | null } | null
}

/** 解析ละครซีรีส์工作流：canvas=自由画布；script=大纲分集 */
export function resolveDramaWorkflow(item: WorkflowSource | null | undefined): DramaWorkflow {
  const raw = String(item?.workflow || item?.params?.workflow || '')
    .trim()
    .toLowerCase()
  if (raw === 'canvas' || raw === 'script') return raw

  const title = String(item?.title || '')
  if (CANVAS_TITLE_MARKERS.some(marker => title.includes(marker))) return 'canvas'

  const source = String(item?.script?.source || '')
  if (CANVAS_SOURCE_MARKERS.some(marker => source.includes(marker))) return 'canvas'

  return 'script'
}

/** 是否自由画布โปรเจกต์ */
export function isCanvasWorkflow(
  item: DramaProject | DramaProjectListItem | WorkflowSource | null | undefined,
): boolean {
  return resolveDramaWorkflow(item) === 'canvas'
}

/** โปรเจกต์入口路径：画布仅进 canvas，普通进เวิร์กสเตชัน */
export function dramaProjectEntryPath(
  item: DramaProject | DramaProjectListItem | WorkflowSource,
): string {
  const id = Number((item as { id?: number }).id)
  if (!Number.isFinite(id) || id <= 0) return '/drama'
  if (isCanvasWorkflow(item)) return `/drama/projects/${id}/canvas`
  return `/drama/projects/${id}`
}

/** 列表卡片 meta 文案 */
export function formatDramaCardMeta(item: DramaProjectListItem): string {
  if (isCanvasWorkflow(item)) {
    return `แคนวาสอิสระ · ${item.asset_count || 0} แอสเซท`
  }
  if (item.has_script) {
    return `เขียนบทแล้ว · ${item.episode_count || 0} ตอน · ${item.asset_count || 0} แอสเซท`
  }
  return `ฉบับร่าง · รอเขียนบท · ${item.asset_count || 0} แอสเซท`
}
