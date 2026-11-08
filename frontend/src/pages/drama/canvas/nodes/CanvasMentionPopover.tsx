/** 画布คำแนะนำ词：键入 @ 后เลือกตัวละคร/ฉาก等节点插入（不 portal，避免点选时画布ยกเลิก选中） */
import { Landmark, UserRound, Image as ImageIcon, PlaySquare } from 'lucide-react'
import { resolveDramaMediaUrl } from '../../../../api/drama'
import type { CanvasNodeKind } from '../canvasTypes'

export type CanvasMentionItem = {
  nodeId: string
  assetId: number
  kind: CanvasNodeKind
  label: string
  mediaUrl?: string | null
}

type CanvasMentionPopoverProps = {
  open: boolean
  query: string
  items: CanvasMentionItem[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (item: CanvasMentionItem) => void
  onClose: () => void
}

/** 按节点ประเภทกลับ图标 */
function KindIcon({ kind }: { kind: CanvasNodeKind }) {
  if (kind === 'character') return <UserRound size={14} strokeWidth={1.8} />
  if (kind === 'scene') return <Landmark size={14} strokeWidth={1.8} />
  if (kind === 'video') return <PlaySquare size={14} strokeWidth={1.8} />
  return <ImageIcon size={14} strokeWidth={1.8} />
}

/** ประเภท中文แท็ก */
function kindLabel(kind: CanvasNodeKind) {
  if (kind === 'character') return 'ตัวละคร'
  if (kind === 'scene') return 'ฉาก'
  if (kind === 'video') return 'วิดีโอ'
  if (kind === 'image') return 'รูปภาพ'
  return 'แอสเซท'
}

/** 按查询过滤可引用节点 */
export function filterCanvasMentionItems(items: CanvasMentionItem[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    const label = item.label.toLowerCase()
    const type = kindLabel(item.kind)
    return label.includes(q) || type.includes(q) || String(item.assetId).includes(q)
  })
}

/** เรนเดอร์ @ 引用候选列表 */
export function CanvasMentionPopover({
  open,
  query,
  items,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClose,
}: CanvasMentionPopoverProps) {
  if (!open) return null

  const filtered = filterCanvasMentionItems(items, query)

  return (
    <div
      className="fc-mention-popover nodrag nopan nowheel"
      role="listbox"
      aria-label="引用画布节点"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="fc-mention-head">
        <span>引用节点</span>
        <button
          type="button"
          className="fc-mention-close"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }}
          aria-label="ปิด"
        >
          ×
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="fc-mention-empty">ไม่มีโหนดที่เชื่อมต่อ · ลากเส้นเชื่อมตัวละครหรือฉากมาที่โหนดนี้ก่อน</div>
      ) : (
        <ul className="fc-mention-list">
          {filtered.map((item, index) => {
            const thumb = resolveDramaMediaUrl(item.mediaUrl)
            const active = index === activeIndex
            return (
              <li key={item.nodeId}>
                <button
                  type="button"
                  className={`fc-mention-item${active ? ' is-active' : ''}`}
                  onMouseEnter={() => onActiveIndexChange(index)}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(item)
                  }}
                >
                  <span className="fc-mention-thumb">
                    {thumb ? <img src={thumb} alt="" /> : <KindIcon kind={item.kind} />}
                  </span>
                  <span className="fc-mention-meta">
                    <strong>{item.label}</strong>
                    <em>{kindLabel(item.kind)}</em>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
