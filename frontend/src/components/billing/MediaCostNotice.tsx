import { useMediaModelsCatalog } from '../../hooks/useMediaModelsCatalog'
import { mediaQuoteFen } from '../../lib/mediaQuote'

export function MediaCostNotice({ modelId, resolution, seconds, count = 1 }: {
  modelId?: string; resolution?: string; seconds?: number; count?: number
}) {
  const catalog = useMediaModelsCatalog()
  if (!catalog || catalog.billing_mode !== 'fixed_media') return null
  const model = [...catalog.image_models, ...catalog.video_models].find(item => item.id === modelId)
  const price = model?.prices?.[resolution || '']
  const amount = mediaQuoteFen(price, count, seconds ?? 1)
  return <span className="media-cost-notice" role="status">
    {model?.available === false ? 'โมเดลยังไม่พร้อมใช้งาน' : amount === null ? 'พารามิเตอร์ปัจจุบันไม่สามารถเสนอราคาได้ โปรดเลือกระดับราคาที่กำหนดไว้' :
      `฿${price}/${seconds === undefined ? 'ภาพ' : 'วินาที'} × ${seconds ?? count}${seconds === undefined ? ' ภาพ' : ' วินาที'}${seconds !== undefined && count > 1 ? ` × ${count} รายการ` : ''} = ประเมิน ฿${(amount / 100).toFixed(2)}`}
  </span>
}
