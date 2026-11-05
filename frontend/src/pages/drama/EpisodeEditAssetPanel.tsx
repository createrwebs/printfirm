/** 分 ตอนแก้ไข：左侧แอสเซท栏（本 ตอน/全 ตอน + 分类卡片） */
import { type DramaAsset } from '../../api/drama'
import { AssetCard, AssetEmpty, AssetGrid, AssetTypeFilter } from '../../components/assets/AssetLibrary'
import { CharacterVoicePreviewButton } from '../../components/drama/CharacterVoicePreviewButton'
import { readAssetVoiceBinding } from './CharacterVoiceBindModal'
import { useCharacterVoiceGenerationEnabled } from '../../hooks/usePublicCapabilities'
import {
  ASSET_TABS,
  normalizeAssetTab,
  type AssetScope,
  type AssetTab,
} from './dramaEpisodeEditUtils'

type Props = {
  readOnly?: boolean
  scope: AssetScope
  tab: AssetTab | null
  assets: DramaAsset[]
  activeIds?: Set<number>
  imageBusyIds?: ReadonlySet<number>
  createBusy?: boolean
  onScopeChange: (scope: AssetScope) => void
  onTabChange: (tab: AssetTab | null) => void
  onOpenCanvas: () => void
  /** 打开รายละเอียดแอสเซท：แก้ไขคำแนะนำ词 / สร้างใหม่ / อัปโหลด */
  onOpenAsset: (asset: DramaAsset) => void
  /** 插入 @asset 到当前บทสตอรี่บอร์ด */
  onMention: (asset: DramaAsset) => void
  /** ยกเลิก当前分镜对该แอสเซท的关联（不ลบแอสเซท） */
  onUnlinkAsset?: (assetId: number) => void
  onGenerateVoice?: (asset: DramaAsset) => void
  voiceBusyIds?: ReadonlySet<number>
  onVoiceError?: (message: string) => void
  /** กำหนดเองสร้างใหม่当前分类แอสเซท */
  onCreateAsset?: () => void
  /** 从ทั่วไปแอสเซท库导入 */
  onImportAsset?: () => void
}

// 当前分类สร้างใหม่按钮文案
function createLabel(tab: AssetTab | null): string {
  if (tab === 'scene') return 'เพิ่มฉาก'
  if (tab === 'prop') return 'เพิ่มอุปกรณ์/พร็อพ'
  return 'เพิ่มตัวละคร'
}

// เรนเดอร์分 ตอนแก้ไข左侧แอสเซท栏
export function EpisodeEditAssetPanel({
  readOnly = false,
  scope,
  tab,
  assets,
  activeIds,
  imageBusyIds,
  createBusy,
  onScopeChange,
  onTabChange,
  onOpenCanvas,
  onOpenAsset,
  onMention,
  onUnlinkAsset,
  onGenerateVoice,
  voiceBusyIds,
  onVoiceError,
  onCreateAsset,
  onImportAsset,
}: Props) {
  const voiceGenerationEnabled = useCharacterVoiceGenerationEnabled()
  return (
    <aside className="drama-ep-assets">
      <div className="drama-ep-assets-top">
        <div className="drama-ep-scope">
          <button
            type="button"
            className={scope === 'episode' ? 'active' : ''}
            onClick={() => onScopeChange('episode')}
          >
            ตอนนี้
          </button>
          <button
            type="button"
            className={scope === 'series' ? 'active' : ''}
            onClick={() => onScopeChange('series')}
          >
            ทุกตอน
          </button>
        </div>
        <button
          type="button"
          className="drama-ep-icon-btn solid"
          aria-label="เปิดแคนวาสสตอรี่บอร์ด"
          onClick={onOpenCanvas}
        >
          +
        </button>
      </div>
      <div className="drama-ep-asset-filters"><AssetTypeFilter options={ASSET_TABS.map((item) => ({ value: item.key, label: item.label }))} value={tab} onChange={(value) => onTabChange(tab === value ? null : value)} /></div>
      {onCreateAsset || onImportAsset ? (
        <div className="drama-ep-asset-actions">
          {onCreateAsset ? (
            <button
              type="button"
              className="drama-ep-asset-action-btn"
              disabled={readOnly || createBusy}
              onClick={onCreateAsset}
            >
              {createBusy ? 'กำลังสร้าง…' : createLabel(tab)}
            </button>
          ) : null}
          {onImportAsset ? (
            <button
              type="button"
              className="drama-ep-asset-action-btn is-ghost"
              disabled={readOnly || createBusy}
              onClick={onImportAsset}
            >
              นำเข้า
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="drama-ep-asset-list"><AssetGrid compact>
        {assets.length === 0 ? (
          <AssetEmpty>
            {scope === 'episode'
              ? 'ตอนนี้ยังไม่มีการอ้างอิงแอสเซท สามารถกดปุ่ม «เพิ่ม» ด้านบน หรือสลับไปที่ «ทุกตอน» เพื่อดูแอสเซททั้งหมด'
              : 'ยังไม่มีแอสเซท สามารถกดปุ่ม «เพิ่ม / นำเข้า» ด้านบน'}
          </AssetEmpty>
        ) : (
          assets.map((asset) => {
            const isCharacter = normalizeAssetTab(asset.type) === 'character'
            const voice = isCharacter ? readAssetVoiceBinding(asset) : null
            const isActive = activeIds?.has(asset.id)
            const voiceGenerating = voiceBusyIds?.has(asset.id) ?? false
            const imageBusy = imageBusyIds?.has(asset.id) ?? false
            return (
              <AssetCard
                key={asset.id}
                asset={asset}
                compact
                busy={imageBusy}
                selected={Boolean(isActive)}
                status={imageBusy ? 'กำลังสร้าง' : isActive ? 'เชื่อมโยงแล้ว' : undefined}
                subtitle={voice ? 'ผูกเสียงแล้ว' : undefined}
                onOpen={() => onOpenAsset(asset)}
                actions={<>
                  {isActive && onUnlinkAsset ? (
                    <button
                      type="button"
                      className="drama-ep-asset-op-btn"
                      disabled={readOnly}
                      onClick={() => onUnlinkAsset(asset.id)}
                      title="ยกเลิกการเชื่อมโยงกับช็อตปัจจุบันเท่านั้น (ไม่ลบแอสเซทออกจากโปรเจกต์)"
                    >
                      ยกเลิกการเชื่อมโยง
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="drama-ep-asset-op-btn"
                      disabled={readOnly}
                      onClick={() => onMention(asset)}
                      title="แทรกลงในบทสตอรี่บอร์ดปัจจุบัน"
                    >
                      แทรก
                    </button>
                  )}
                  {isCharacter ? (
                    voice ? (
                      <CharacterVoicePreviewButton
                        url={voice.url}
                        label={voice.label}
                        variant="inline"
                        className="drama-ep-asset-voice-btn is-bound"
                        onError={onVoiceError}
                      />
                    ) : voiceGenerationEnabled && onGenerateVoice ? (
                      <button
                        type="button"
                        className="drama-ep-asset-voice-btn"
                        disabled={readOnly || voiceGenerating}
                        onClick={() => onGenerateVoice(asset)}
                      >
                        {voiceGenerating ? 'กำลังสร้าง…' : 'สร้างเสียง'}
                      </button>
                    ) : null
                  ) : null}
                </>}
              />
            )
          })
        )}
      </AssetGrid></div>
    </aside>
  )
}
