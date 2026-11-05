/** 分 ตอนแก้ไข右侧：分段วิดีโอดูตัวอย่าง + 入口打开全屏分镜画布 */
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import DramaPublishModal from '../../features/marketplace/DramaPublishModal'
import { useMarketplace } from '../../features/marketplace/hooks'
import type { DramaFragment } from '../../api/drama'
import { DramaFragmentSegmentedVideoPlayer } from '../../components/drama/DramaFragmentSegmentedVideoPlayer'
import { triggerBlobDownload } from '../../lib/clientDownload'
import {
  composeEpisodeVideoClient,
  episodeComposeFilename,
  listEpisodeComposeClips,
  type EpisodeComposeProgress,
} from '../../lib/composeEpisodeVideoClient'
import { dialog } from '../../lib/dialog'

type Props = {
  fragments: DramaFragment[]
  playingFragmentId: number | null
  onPlayingFragmentChange: (fragmentId: number) => void
  aspectRatio: string
  episodeId?: number
  projectId?: string
  episodeName?: string
  onOpenStoryboard: () => void
  /** ดูตัวอย่าง历史版本时覆盖当前镜 video src */
  previewVideoUrl?: string | null
  previewPosterUrl?: string | null
  previewLabel?: string
  onClearPreview?: () => void
  onActivatePreview?: () => void
}

/** 把合成进度转成按钮文案 */
function composeProgressLabel(progress: EpisodeComposeProgress | null, busy: boolean) {
  if (!busy) return 'รวมวิดีโอทั้งตอนและดาวน์โหลด'
  if (!progress) return 'กำลังรวมวิดีโอทั้งตอน…'
  if (progress.phase === 'download') return `ดึงข้อมูลช็อต ${progress.done}/${progress.total}`
  if (progress.phase === 'server') return 'เซิร์ฟเวอร์กำลังแปลงรหัสและรวมวิดีโอ…'
  return 'กำลังเชื่อมต่อคลิปวิดีโอ…'
}

// เรนเดอร์分 ตอน右侧ดูตัวอย่าง与画布入口
export function EpisodeEditSidePane({
  fragments,
  playingFragmentId,
  onPlayingFragmentChange,
  aspectRatio,
  episodeId,
  projectId,
  episodeName = 'ตอนนี้',
  onOpenStoryboard,
  previewVideoUrl = null,
  previewPosterUrl = null,
  previewLabel = '',
  onClearPreview,
  onActivatePreview,
}: Props) {
  const hasSelection = playingFragmentId !== null
  /*
   * composeBusy 本地拼接中
   * composeProgress 拉取/拼接进度
   * composeError ล้มเหลว原因
   */
  const { capabilities } = useMarketplace()
  const [publishOpen, setPublishOpen] = useState(false)
  const [composeBusy, setComposeBusy] = useState(false)
  const [composeProgress, setComposeProgress] = useState<EpisodeComposeProgress | null>(null)
  const [composeError, setComposeError] = useState('')
  const composeClips = listEpisodeComposeClips(fragments)
  const missingCount = fragments.length - composeClips.length

  // 浏览器内拼接已生成镜头并ดาวน์โหลด成片
  async function handleComposeDownload() {
    if (composeBusy || composeClips.length === 0) return
    if (missingCount > 0) {
      const ok = await dialog.confirm({
        title: 'บางช็อตยังไม่ได้สร้างวิดีโอ',
        message: `มี ${missingCount} ช็อตที่ยังไม่มีวิดีโอ จะรวมเฉพาะ ${composeClips.length} ช็อตที่สร้างเสร็จแล้ว ต้องการดำเนินการต่อหรือไม่?`,
        confirmText: 'ดำเนินการรวมวิดีโอต่อ',
      })
      if (!ok) return
    }
    setComposeError('')
    setComposeBusy(true)
    setComposeProgress({ phase: 'download', done: 0, total: composeClips.length })
    try {
      const blob = await composeEpisodeVideoClient(composeClips, setComposeProgress, {
        episodeId,
      })
      triggerBlobDownload(blob, episodeComposeFilename(episodeName))
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'รวมวิดีโอทั้งตอนล้มเหลว')
    } finally {
      setComposeBusy(false)
      setComposeProgress(null)
    }
  }

  return (
    <aside className="drama-ep-preview">
      <div className="drama-ep-side-header">
        <div className="drama-ep-side-tabs" role="tablist" aria-label="พาเนลด้านขวา">
          <button type="button" role="tab" aria-selected className="active">
            ดูตัวอย่าง
          </button>
          <button type="button" role="tab" onClick={onOpenStoryboard}>
            แคนวาส
          </button>
        </div>
        <button
          type="button"
          className="drama-ep-compose-btn drama-ep-compose-btn--header"
          disabled={composeBusy || composeClips.length === 0}
          title={
            composeClips.length === 0
              ? 'กรุณาสร้างวิดีโอสตอรี่บอร์ดก่อน'
              : 'รวมวิดีโอของทุกช็อตในตอนนี้และดาวน์โหลด'
          }
          onClick={() => void handleComposeDownload()}
        >
          {composeBusy ? (
            <Loader2 size={14} className="drama-ep-compose-spin" />
          ) : (
            <Download size={14} strokeWidth={1.8} />
          )}
          {composeProgressLabel(composeProgress, composeBusy)}
        </button>
        {capabilities?.enabled && projectId && episodeId ? (
          <button
            type="button"
            className="drama-ep-compose-btn drama-ep-compose-btn--header"
            onClick={() => setPublishOpen(true)}
          >
            เผยแพร่สู่ตลาดดิจิทัลแอสเซท
          </button>
        ) : null}
      </div>
      {composeError ? <p className="drama-ep-compose-error drama-ep-compose-error--header">{composeError}</p> : null}

      {previewVideoUrl ? (
        <div className="drama-ep-preview-banner">
          <span>ดูตัวอย่างเวอร์ชันย้อนหลัง{previewLabel ? ` · ${previewLabel}` : ''}</span>
          <div className="drama-ep-preview-banner-actions">
            {onActivatePreview ? (
              <button type="button" className="drama-ep-preview-banner-btn" onClick={onActivatePreview}>
                ตั้งเป็นปัจจุบัน
              </button>
            ) : null}
            {onClearPreview ? (
              <button type="button" className="drama-ep-preview-banner-btn is-ghost" onClick={onClearPreview}>
                ออกจากโหมดดูตัวอย่าง
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!hasSelection || fragments.length === 0 ? (
        <p className="drama-ep-empty">กรุณาเลือกช็อตจากแถบด้านล่าง</p>
      ) : (
        <div className="drama-ep-preview-inner">
          <DramaFragmentSegmentedVideoPlayer
            fragments={fragments}
            playingFragmentId={playingFragmentId}
            onPlayingFragmentChange={onPlayingFragmentChange}
            aspectRatio={aspectRatio}
            overrideVideoUrl={previewVideoUrl}
            overridePosterUrl={previewPosterUrl}
          />
          {!fragments.some((f) => f.video) && (
            <button type="button" className="drama-ep-open-canvas" onClick={onOpenStoryboard}>
              เปิดแคนวาสสตอรี่บอร์ด
            </button>
          )}
        </div>
      )}
      {publishOpen && capabilities?.enabled && projectId && <DramaPublishModal projectId={Number(projectId)} initialEpisodeId={episodeId} onClose={() => setPublishOpen(false)} />}
    </aside>
  )
}
