/** 将โปรเจกต์แอสเซท与已บันทึก画布布局合并为 React Flow 节点/边 */
import type { Edge, Node } from '@xyflow/react'
import { resolveDramaMediaUrl, type DramaAsset } from '../../../api/drama'
import { readEditableVisualPrompt } from '../../../lib/dramaVisualPrompt'
import { readVideoGenerationOptions } from '../../../lib/dramaVideoGenerationOptions'
import { readAssetVoiceBinding } from '../CharacterVoiceBindModal'
import {
  CANVAS_NODE_DEFAULT_LABEL,
  CANVAS_NODE_SIZE,
  type CanvasAssetNodeData,
  type CanvasNodeKind,
} from './canvasTypes'
import { normalizeCanvasEdges, normalizeCanvasNodes } from './canvasNormalize'

/** Drama แอสเซท type → 画布节点 kind */
export function dramaAssetTypeToKind(type: string | null | undefined): CanvasNodeKind {
  const t = String(type || '').toLowerCase()
  if (t === 'character') return 'character'
  if (t === 'scene') return 'scene'
  if (t === 'video') return 'video'
  if (t === 'audio') return 'audio'
  if (t === 'text') return 'text'
  /* prop / material / none / 其他 → รูปภาพ卡片 */
  return 'image'
}

/** 根据แอสเซท ID 生成稳定节点 ID */
export function getCanvasNodeId(assetId: number) {
  return `asset-${assetId}`
}

/** 从 save_canvas 写入的 params.canvas.data.promptHint 读取（不过滤短คำแนะนำ词） */
function readSavedCanvasPromptHint(asset: DramaAsset): string {
  const params = (asset.params || {}) as Record<string, unknown>
  const canvas = params.canvas
  if (!canvas || typeof canvas !== 'object') return ''
  const data = (canvas as Record<string, unknown>).data
  if (!data || typeof data !== 'object') return ''
  return String((data as Record<string, unknown>).promptHint || '').trim()
}

/** 从แอสเซท构建节点 data */
export function buildNodeDataFromAsset(asset: DramaAsset): CanvasAssetNodeData {
  const kind = dramaAssetTypeToKind(asset.type)
  const params = (asset.params || {}) as Record<string, unknown>
  /* 弱占位过滤后为空时，回退布局里用户写过的原文 */
  const promptHint = readEditableVisualPrompt(asset) || readSavedCanvasPromptHint(asset)
  const canvasNodeData =
    params.canvas && typeof params.canvas === 'object'
      ? ((params.canvas as Record<string, unknown>).data as Record<string, unknown> | undefined)
      : undefined
  const videoOptions =
    kind === 'video'
      ? readVideoGenerationOptions(
          params.videoOptions || canvasNodeData?.videoOptions || params,
        )
      : undefined
  const imageOptions =
    kind === 'video'
      ? undefined
      : ((params.imageOptions as Record<string, unknown> | undefined) ||
          (canvasNodeData?.imageOptions as Record<string, unknown> | undefined) ||
          undefined)
  const label =
    (typeof asset.name === 'string' && asset.name.trim()) || CANVAS_NODE_DEFAULT_LABEL[kind]
  const voice = kind === 'character' ? readAssetVoiceBinding(asset) : null

  return {
    kind,
    label,
    assetId: asset.id,
    mediaUrl: resolveDramaMediaUrl(asset.url || asset.cover) || null,
    textContent: kind === 'text' ? String(params.textContent || '') : undefined,
    promptHint,
    videoOptions,
    imageOptions,
    characterName: kind === 'character' ? label : undefined,
    voiceLabel: voice?.label || null,
    voiceUrl: voice?.url || null,
  }
}

type SavedLayoutIndex = {
  byAssetId: Map<number, Node<CanvasAssetNodeData>>
  orphanNodes: Node<CanvasAssetNodeData>[]
  edges: Edge[]
}

/** 索引已บันทึก画布节点（按 assetId） */
function indexSavedLayout(rawNodes: unknown, rawEdges: unknown): SavedLayoutIndex {
  const nodes = normalizeCanvasNodes(rawNodes)
  const edges = normalizeCanvasEdges(rawEdges)
  const byAssetId = new Map<number, Node<CanvasAssetNodeData>>()
  const orphanNodes: Node<CanvasAssetNodeData>[] = []

  for (const node of nodes) {
    const assetId = node.data.assetId
    if (typeof assetId === 'number' && assetId > 0) {
      byAssetId.set(assetId, node)
    } else {
      orphanNodes.push(node)
    }
  }

  return { byAssetId, orphanNodes, edges }
}

/**
 * 合并โปรเจกต์แอสเซท与已บันทึก布局：
 * - 普通โปรเจกต์：แอสเซท列表决定节点；已บันทึก布局提供位置与连线
 * - 自由画布：仅恢复「已บันทึก在画布上」的แอสเซท节点，避免ลบ后รีเฟรช又冒出来
 */
export function mergeAssetsWithCanvasLayout(
  assets: DramaAsset[],
  savedNodes: unknown,
  savedEdges: unknown,
  options?: { freeCanvas?: boolean },
): { nodes: Node<CanvasAssetNodeData>[]; edges: Edge[] } {
  const freeCanvas = Boolean(options?.freeCanvas)
  const saved = indexSavedLayout(savedNodes, savedEdges)
  const nodes: Node<CanvasAssetNodeData>[] = []
  let maxRight = 0
  const assetById = new Map(assets.map((a) => [a.id, a]))

  if (freeCanvas) {
    /* 自由画布：只เรนเดอร์布局里仍存在、且แอสเซท未删的节点（不按แอสเซท列表回补） */
    for (const [assetId, savedNode] of saved.byAssetId) {
      const asset = assetById.get(assetId)
      if (!asset) continue
      const data = buildNodeDataFromAsset(asset)
      const size = CANVAS_NODE_SIZE[data.kind]
      nodes.push({
        ...savedNode,
        id: getCanvasNodeId(asset.id),
        type: 'asset',
        data: {
          ...savedNode.data,
          ...data,
          label: (savedNode.data.label as string) || data.label,
          /* แอสเซท弱คำแนะนำ词可能为空，优先保留布局里用户写过的 promptHint */
          promptHint: data.promptHint || savedNode.data.promptHint || '',
          videoOptions: data.videoOptions || savedNode.data.videoOptions,
          imageOptions: data.imageOptions || savedNode.data.imageOptions,
          textContent:
            data.kind === 'text'
              ? savedNode.data.textContent ?? data.textContent
              : data.textContent,
        },
      })
      maxRight = Math.max(maxRight, savedNode.position.x + size.width + 40)
    }
    /* 无 assetId 的孤儿节点仍保留 */
    for (const orphan of saved.orphanNodes) {
      nodes.push(orphan)
    }
  } else {
    for (const asset of assets) {
      const data = buildNodeDataFromAsset(asset)
      const kind = data.kind
      const size = CANVAS_NODE_SIZE[kind]
      const savedNode = saved.byAssetId.get(asset.id)

      if (savedNode) {
        nodes.push({
          ...savedNode,
          id: getCanvasNodeId(asset.id),
          type: 'asset',
          data: {
            ...savedNode.data,
            ...data,
            promptHint: data.promptHint || savedNode.data.promptHint || '',
            videoOptions: data.videoOptions || savedNode.data.videoOptions,
            imageOptions: data.imageOptions || savedNode.data.imageOptions,
            textContent:
              kind === 'text'
                ? savedNode.data.textContent ?? data.textContent
                : data.textContent,
          },
        })
        maxRight = Math.max(maxRight, savedNode.position.x + size.width + 40)
      } else {
        nodes.push({
          id: getCanvasNodeId(asset.id),
          type: 'asset',
          position: {
            x: maxRight,
            y: 80,
          },
          data,
        })
        maxRight += size.width + 40
      }
    }

    /* 无 assetId 的旧自由节点仍保留，排在แอสเซท行下方 */
    for (const orphan of saved.orphanNodes) {
      nodes.push({
        ...orphan,
        position: {
          x: orphan.position.x,
          y: Math.max(orphan.position.y, 420),
        },
      })
    }

    /* 首次เข้าสู่（无任何已บันทึก位置）时整行横向排布 */
    if (saved.byAssetId.size === 0 && assets.length > 0) {
      let i = 0
      for (const node of nodes) {
        if (typeof node.data.assetId !== 'number') continue
        const size = CANVAS_NODE_SIZE[node.data.kind]
        node.position = { x: i * (size.width + 40), y: 80 }
        i += 1
      }
    }
  }

  /* 过滤掉指向已ลบแอสเซท的边 */
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = saved.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

  return { nodes, edges }
}
