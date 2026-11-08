/** แอสเซท库「น้ำเสียง」Tab 单卡：คำอธิบายแก้ไข、试听与合成 */
import { Trash2 } from 'lucide-react'
import { resolveDramaMediaUrl, type DramaAsset } from '../../api/drama'
import { CharacterVoicePreviewButton } from '../../components/drama/CharacterVoicePreviewButton'
import { AssetCard } from '../../components/assets/AssetLibrary'

type Props = {
  asset: DramaAsset
  promptValue: string
  synthBusy: boolean
  onPromptChange: (value: string) => void
  onPromptBlur: () => void
  onSynth?: () => void
  onDelete: () => void
  onError: (message: string) => void
}

// เรนเดอร์น้ำเสียงแอสเซท卡片
export function DramaVoiceAssetCard({
  asset,
  promptValue,
  synthBusy,
  onPromptChange,
  onPromptBlur,
  onSynth,
  onDelete,
  onError,
}: Props) {
  const audioSrc = resolveDramaMediaUrl(asset.url)
  const hasAudio = Boolean(audioSrc)

  return (
    <AssetCard
      asset={asset}
      subtitle={`โปรเจกต์ #${asset.project_id}`}
      footer="โปรเจกต์แอสเซท"
      updatedAt={asset.updated_at}
      busy={synthBusy}
      status={synthBusy ? '合成中' : hasAudio ? '已合成' : '待合成'}
      actions={<>
        {hasAudio && <CharacterVoicePreviewButton url={asset.url || ''} label={asset.name || undefined} variant="button" size="sm" onError={onError} />}
        {onSynth && <button type="button" className="pf-btn pf-btn-lime pf-btn-sm" disabled={synthBusy || !promptValue.trim()} onClick={onSynth}>
          {synthBusy ? 'กำลังสร้างเสียง...' : hasAudio ? 'สร้างเสียงใหม่' : 'สร้างเสียงตามพรอมต์'}
        </button>}
        <button type="button" className="pf-btn pf-btn-sm drama-btn-danger-text" aria-label={`ลบ ${asset.name || 'น้ำเสียง'}`} disabled={synthBusy} onClick={onDelete}><Trash2 size={14} />ลบ</button>
      </>}
    >
        <label className="pf-library-voice-field">
          <span>น้ำเสียงคำอธิบาย</span>
          <textarea
            rows={3}
            value={promptValue}
            disabled={synthBusy}
            onChange={(e) => onPromptChange(e.target.value)}
            onBlur={onPromptBlur}
            placeholder="อธิบายน้ำเสียง: อายุ, เพศ, อารมณ์, ความเร็วเสียง..."
          />
        </label>

        {hasAudio && <audio className="pf-library-audio" controls preload="none" src={audioSrc} />}
    </AssetCard>
  )
}
