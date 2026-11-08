/** 空画布居中展示的ค่าเริ่มต้น节点เลือก器 */
import { MousePointer2 } from 'lucide-react'
import { CANVAS_NODE_OPTIONS, type CanvasNodeKind } from './canvasTypes'

type CanvasNodeSelectorProps = {
  onSelect: (kind: CanvasNodeKind) => void
}

/** เรนเดอร์ความเร็วสูงสร้างใหม่节点ประเภทเลือก器 */
export function CanvasNodeSelector({ onSelect }: CanvasNodeSelectorProps) {
  return (
    <div className="fc-overlay fc-node-selector">
      <div className="fc-node-selector-inner">
        <div className="fc-node-selector-row">
          {CANVAS_NODE_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                type="button"
                className="fc-node-chip"
                onClick={() => onSelect(option.id)}
              >
                <span className="fc-node-chip-icon">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
        <p className="fc-node-hint">
          <MousePointer2 size={16} strokeWidth={1.8} />
          คลิกเพื่อเพิ่มอย่างรวดเร็ว · ดับเบิลคลิกที่พื้นที่ว่างเพื่อสร้างใหม่ได้เช่นกัน
        </p>
      </div>
    </div>
  )
}
