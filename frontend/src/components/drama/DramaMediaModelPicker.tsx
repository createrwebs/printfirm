/** 图/วิดีโอ模型เลือก列表：图标 + คำอธิบายสั้น + เวลาที่ใช้ + 选用คำแนะนำ */
import type { ReactNode } from 'react'
import { Check, Clapperboard, Film, Image as ImageIcon, Sparkles, Wand2, Zap } from 'lucide-react'
import type { MediaModelOption } from '../../api'
import {
  mediaModelCapabilityBadge,
  mediaModelClipDurationLabel,
  mediaModelHoverText,
  mediaModelIconKind,
  type MediaModelIconKind,
} from '../../lib/dramaMediaModelMeta'

type Props = {
  models: MediaModelOption[]
  selectedId: string
  emptyHint?: string
  onSelect: (model: MediaModelOption) => void
}

/** 按模型族เรนเดอร์图标 */
function ModelIcon({ kind }: { kind: MediaModelIconKind }) {
  const common = { size: 16, strokeWidth: 1.9 } as const
  switch (kind) {
    case 'seedance25':
      return <Wand2 {...common} />
    case 'seedanceMini':
      return <Zap {...common} />
    case 'seedance':
      return <Clapperboard {...common} />
    case 'minimax':
      return <Sparkles {...common} />
    case 'seedream':
      return <ImageIcon {...common} />
    case 'gptImage':
      return <Film {...common} />
    default:
      return <Clapperboard {...common} />
  }
}

/** เรนเดอร์可选模型卡片列表 */
export function DramaMediaModelPicker({
  models,
  selectedId,
  emptyHint = 'กรุณาตั้งค่าโมเดลเริ่มต้นในระบบจัดการก่อน',
  onSelect,
}: Props) {
  if (models.length === 0) {
    return <p className="fc-gen-model-empty">{emptyHint}</p>
  }

  return (
    <div className="fc-gen-model-list fc-gen-model-list--rich">
      {models.map((m) => {
        const selected = selectedId === m.id
        const kind = mediaModelIconKind(m.id)
        const badge = mediaModelCapabilityBadge(m)
        const desc = (m.description || '').trim()
        const price = m.prices && Object.keys(m.prices).length ? Object.entries(m.prices).map(([resolution, amount]) => `${resolution} ¥${amount}/${m.billing_unit === 'second' ? 'วินาที' : 'ภาพ'}`).join(' · ') : (m.pricing_hint || '').trim()
        const eta = (m.eta_hint || '').trim()
        const clip = mediaModelClipDurationLabel(m)
        const metaBits = [clip, eta].filter(Boolean)
        return (
          <button
            key={m.id}
            type="button"
            disabled={m.available === false}
            className={`fc-gen-model-card${selected ? ' selected' : ''}`}
            title={mediaModelHoverText(m)}
            aria-label={`${m.label}${desc ? `，${desc}` : ''}${metaBits.length ? `，${metaBits.join('，')}` : ''}${price ? `，${price}` : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(m)}
          >
            <span className={`fc-gen-model-card-icon is-${kind}`} aria-hidden>
              <ModelIcon kind={kind} />
            </span>
            <span className="fc-gen-model-card-body">
              <span className="fc-gen-model-card-head">
                <strong>{m.label}</strong>
                {m.recommended ? <em className="fc-gen-model-card-rec">ค่าเริ่มต้น</em> : null}
                <em className="fc-gen-model-card-badge">{badge}</em>
                {selected ? (
                  <Check className="fc-gen-model-card-check" size={15} strokeWidth={2.4} aria-hidden />
                ) : null}
              </span>
              {desc ? <span className="fc-gen-model-card-desc">{desc}</span> : null}
              {metaBits.length ? (
                <span className="fc-gen-model-card-meta">{metaBits.join(' · ')}</span>
              ) : null}
              {price ? <span className="fc-gen-model-card-price">{price}</span> : null}
              {m.reference_limits ? (
                <span className="fc-gen-model-card-meta">
                  จำกัดสื่ออ้างอิง: รูปภาพ {m.reference_limits.images} · วิดีโอ {m.reference_limits.videos} · เสียง {m.reference_limits.audios}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** 供外部需要กำหนดเอง点击时复用图标节点 */
export function dramaMediaModelIconNode(modelId: string): ReactNode {
  return <ModelIcon kind={mediaModelIconKind(modelId)} />
}
