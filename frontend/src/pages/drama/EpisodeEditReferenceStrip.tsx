/** 分镜顶部：已关联แอสเซท缩略图条 */
import type { FragmentRefStripItem } from './dramaEpisodeEditUtils'
import { DRAMA_VOICE_BINDING_ENABLED } from '../../lib/dramaVoiceBinding'

type Props = {
  items: FragmentRefStripItem[]
  onSelect?: (assetId: number) => void
}

// เรนเดอร์当前分镜关联แอสเซท条
export function EpisodeEditReferenceStrip({ items, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="drama-ep-ref-strip is-empty">
        <span className="drama-ep-ref-strip-hint">ยังไม่มีแอสเซทที่เชื่อมโยง · คลิกการ์ดทางซ้ายหรือพิมพ์ @asset:id</span>
      </div>
    )
  }

  return (
    <div className="drama-ep-ref-strip" aria-label="แอสเซทที่เชื่อมโยงในช็อตนี้">
      {items.map((item) => (
        <button
          key={item.assetId}
          type="button"
          className={`drama-ep-ref-chip${item.isCharacter ? ' is-character' : ''}${
            item.voiceUrl ? ' has-voice' : item.isCharacter ? ' no-voice' : ''
          }`}
          title={`${item.name}${item.type ? ` · ${item.type}` : ''}${
            DRAMA_VOICE_BINDING_ENABLED && item.isCharacter
              ? item.voiceLabel
                ? ` · น้ำเสียง：${item.voiceLabel}`
                : ' · ยังไม่ได้ผูกน้ำเสียง'
              : ''
          }`}
          onClick={() => onSelect?.(item.assetId)}
        >
          {item.previewUrl ? (
            <img src={item.previewUrl} alt="" draggable={false} />
          ) : (
            <span className="drama-ep-ref-chip-fallback">{(item.name || '?')[0]}</span>
          )}
          {DRAMA_VOICE_BINDING_ENABLED && item.isCharacter ? (
            <span className={`drama-ep-ref-voice-badge${item.voiceUrl ? ' bound' : ''}`}>
              {item.voiceUrl ? '音' : '无音'}
            </span>
          ) : null}
          <em>{item.name}</em>
        </button>
      ))}
    </div>
  )
}
