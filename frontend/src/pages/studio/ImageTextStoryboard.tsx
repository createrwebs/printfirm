import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clapperboard, Download, Pause, Pencil, RefreshCw, Volume2 } from 'lucide-react'
import { api, type Project, type Shot, type Template } from '../../api'
import { ProjectCard, ProjectGrid } from '../../components/projects/ProjectCard'
import { IMAGE_TEXT_STEPS, imageTextAssetReadiness, imageTextBoardStep, imageTextNextAction } from '../../lib/imageTextStoryboard'
import { formatMmSs, isProjectWideBusy, isShotGenerating, statusLabel } from '../../lib/status'
import { shotDisplayDurationSec } from '../../lib/segmentDuration'
import { scenePromptForDisplay } from '../../promptDisplay'
import './imageTextStoryboard.css'

type Props = {
  project: Project
  template: Template | null
  busy: boolean
  running: boolean
  busyShotIds: Set<number>
  onBack: () => void
  onSettings: () => void
  onGenerate: () => void
  onCompose: () => void
  onCancel: () => void
  onRestart: () => void
  onExport: () => void
  onDownload: () => void
  onEditor: () => void
  onEditShot: (shot: Shot, focus?: string) => void
  onPreviewShot: (shot: Shot) => void
  onRegenImage: (shot: Shot) => void
  onRegenAudio: (shot: Shot) => void
}

export default function ImageTextStoryboard({ project, template, busy, running, busyShotIds, onBack, onSettings, onGenerate, onCompose, onCancel, onRestart, onExport, onDownload, onEditor, onEditShot, onPreviewShot, onRegenImage, onRegenAudio }: Props) {
  const stage = imageTextBoardStep(project)
  // Remember a previous view only while the production stage is unchanged.
  const [view, setView] = useState<{ stage: number; step: number } | null>(null)
  const step = view?.stage === stage ? view.step : stage
  const readiness = imageTextAssetReadiness(project)
  const nextAction = imageTextNextAction(project)
  const shots = [...project.shots].sort((a, b) => a.shot_no - b.shot_no)
  const duration = shots.reduce((sum, shot) => sum + shotDisplayDurationSec(shot), 0)
  const targetDuration = project.target_duration_sec || 60
  const audioShot = shots.find((shot) => shot.audio_url)
  const cancelling = Boolean(project.active_tasks?.some((task) => task.cancel_requested))
  const failed = ['FAILED', 'CANCELLED', 'REJECTED'].includes(project.status)
  const locked = busy || running
  const actionLabel = nextAction === 'script' ? 'สร้างบทสตอรี่บอร์ด' : nextAction === 'assets'
    ? readiness.images || readiness.audio ? 'สร้างสื่อที่ขาดต่อ' : 'ยืนยันสตอรี่บอร์ดและสร้างภาพพร้อมเสียงพากย์'
    : nextAction === 'compose' ? 'ถัดไป: ตัดต่อรวมวิดีโอ' : 'ดูวิดีโอ'
  function next() {
    if (nextAction === 'preview') setView({ stage, step: 3 })
    else if (nextAction === 'compose') onCompose()
    else onGenerate()
  }

  return (
    <div className="pf-image-storyboard">
      <header className="pf-is-header">
        <div>
          <button type="button" className="pf-back" onClick={onBack}><ArrowLeft size={16} />我的短片</button>
          <h1>{project.title}</h1>
          <p>{template?.name || 'วิดีโอสั้นแอนิเมชัน'}<span>·</span>{project.output_ratio || '9:16'}<span>·</span>เป้าหมายประมาณ {targetDuration} วินาที{shots.length ? <><span>·</span>{shots.length} ช็อต · {formatMmSs(duration)}</> : null}</p>
        </div>
        <div className="pf-is-header-actions">
          <button type="button" className="pf-btn pf-btn-outline pf-btn-sm" disabled={locked} onClick={onSettings}><Pencil size={14} />แก้ไขการตั้งค่าการสร้าง</button>
          <button type="button" className="pf-btn pf-btn-outline pf-btn-sm" disabled={!shots.length || locked} onClick={onEditor}>เปิดตัวแก้ไข</button>
        </div>
      </header>

      <nav className="pf-is-steps" aria-label="短片创作步骤">
        {IMAGE_TEXT_STEPS.map((item, index) => (
          <button key={item.key} type="button" className={`${step === index ? 'is-current' : ''} ${index < stage ? 'is-complete' : ''}`}
            aria-current={step === index ? 'step' : undefined}
            disabled={index > stage || (index === 0 && locked)}
            onClick={() => index === 0 ? onSettings() : setView({ stage, step: index })}>
            <span>{index < stage ? <Check size={16} /> : index + 1}</span><strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      {running ? (
        <section className="pf-is-progress" aria-live="polite">
          <div><strong>{cancelling ? 'กำลังหยุด โปรดรอสักครู่…' : statusLabel(project)}</strong><p>ความคืบหน้าจะบันทึกโดยอัตโนมัติ คุณสามารถออกจากหน้านี้และกลับมาทำต่อได้จาก "คลิปสั้นของฉัน"</p></div>
          <div className="pf-is-progress-track"><span style={{ width: `${Math.max(2, Math.min(100, project.progress))}%` }} /></div>
          <span>{project.progress}%</span>
          <button type="button" className="pf-btn pf-btn-outline pf-btn-sm" disabled={busy || cancelling} onClick={onCancel}><Pause size={14} />停止</button>
        </section>
      ) : failed ? <p className="pf-is-resume-note">{project.status === 'CANCELLED' ? 'การผลิตหยุดลงแล้ว' : 'ขั้นตอนนี้ยังไม่เสร็จสิ้น'}แอสเซทที่เสร็จสมบูรณ์ได้รับการบันทึกแล้ว สามารถดำเนินการต่อจากขั้นตอนปัจจุบันได้</p> : null}

      {step === 1 ? (
        <section className="pf-is-section">
          <div className="pf-is-section-head"><div><span className="pf-is-eyebrow">STEP 02</span><h2>ยืนยันบทและสตอรี่บอร์ด</h2><p>ตรวจสอบช็อตทีละภาพ ปรับแต่งเสียงบรรยายและภาพ เมื่อพอใจแล้วจึงเริ่มสร้างแอสเซท</p></div><button type="button" className="pf-btn pf-btn-outline pf-btn-sm" disabled={!shots.length} onClick={onExport}><Download size={14} />ส่งออกบท</button></div>
          <details className="pf-is-copy" open={!shots.length}><summary>完整文案 <span>{project.source_text.length} 字</span></summary><p>{project.source_text}</p></details>
          {shots.length ? <ProjectGrid className="pf-is-script-grid">
            {shots.map((shot) => {
              const shotBusy = locked || busyShotIds.has(shot.id) || isShotGenerating(project, shot.id)
              return <article key={shot.id} className="pf-is-script-card">
                <header><span>镜头 {String(shot.shot_no).padStart(2, '0')}</span><span>{formatMmSs(shotDisplayDurationSec(shot))}</span></header>
                <h3>{shot.overlay_title || `ฉาก ${shot.shot_no}`}</h3>
                <div className="pf-is-script-field"><label>เสียงบรรยาย</label><p>{shot.narration || 'ยังไม่มีเสียงบรรยาย คลิกแก้ไขเพื่อเพิ่ม'}</p></div>
                <div className="pf-is-script-field"><label>ภาพ</label><p>{scenePromptForDisplay(shot.img_prompt) || 'ยังไม่มีคำบรรยายภาพ'}</p></div>
                <footer><button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" disabled={shotBusy} onClick={() => onEditShot(shot, 'narration')}><Pencil size={13} />แก้ไขเสียงบรรยาย</button><button type="button" className="pf-btn pf-btn-outline pf-btn-sm" disabled={shotBusy} onClick={() => onEditShot(shot)}>แก้ไขสตอรี่บอร์ด</button></footer>
              </article>
            })}
          </ProjectGrid> : <div className="pf-is-empty"><Clapperboard size={38} /><h3>{running ? 'กำลังแยกบทออกเป็นสตอรี่บอร์ด...' : 'บทพร้อมแล้ว'}</h3><p>{running ? 'หลังจากสร้างเสร็จ แต่ละช็อตจะแสดงเป็นการ์ดที่สามารถแก้ไขได้' : 'คลิกปุ่มด้านล่างเพื่อสร้างบทสตอรี่บอร์ด'}</p></div>}
        </section>
      ) : step === 2 ? (
        <section className="pf-is-section">
          <div className="pf-is-section-head"><div><span className="pf-is-eyebrow">STEP 03</span><h2>ตรวจสอบภาพและเสียงพากย์</h2><p>ภาพ {readiness.images}/{readiness.total} · เสียงพากย์ {readiness.audio === readiness.total && readiness.total ? 'เสร็จสมบูรณ์' : 'รอดำเนินการ'} เมื่อภาพครบถ้วนและพอใจกับเสียงตัวอย่างแล้ว ก็สามารถเรนเดอร์รวมคลิปได้ทันที</p></div></div>
          <div className="pf-is-audio"><div><Volume2 size={22} /><div><strong>เสียงบรรยายทั้งเรื่อง</strong><p>คลิปสำเร็จรูปจะจัดวางภาพตามความยาวเสียงพากย์จริง และเพิ่มคำบรรยาย (ซับไตเติล) อัตโนมัติ</p></div></div>{audioShot?.audio_url ? <audio aria-label="ทดลองฟังเสียงบรรยายทั้งเรื่อง" controls preload="metadata" src={api.assetUrl(audioShot.audio_url, project.updated_at)} /> : <span className="pf-muted">{running ? 'เสียงพากย์กำลังสร้าง…' : 'รอการสร้างเสียงพากย์'}</span>}<button type="button" className="pf-btn pf-btn-outline pf-btn-sm" disabled={locked || !shots.length} onClick={() => onRegenAudio(shots[0])}><RefreshCw size={13} />พากย์เสียงใหม่</button></div>
          <ProjectGrid>
            {shots.map((shot) => {
              const generating = busyShotIds.has(shot.id) || isShotGenerating(project, shot.id)
              const shotBusy = busy || isProjectWideBusy(project) || generating
              const imageReady = Boolean(shot.image_url)
              return <ProjectCard key={shot.id} className="pf-is-media-card" kind="drama" title={shot.overlay_title || `ฉาก ${shot.shot_no}`} category={`ช็อตที่ ${String(shot.shot_no).padStart(2, '0')} · ${formatMmSs(shotDisplayDurationSec(shot))}`}
                coverUrl={shot.image_url ? api.assetUrl(shot.image_url, shot.version) : undefined}
                status={{ label: generating ? 'กำลังสร้าง' : imageReady ? 'ภาพพร้อมแล้ว' : shot.status === 'FAILED' ? 'สร้างไม่สำเร็จ' : 'รอสร้าง', tone: generating ? 'producing' : imageReady ? 'completed' : 'draft' }}
                description={shot.narration} meta={<span>{shot.audio_url ? '✓ เสียงพากย์พร้อมแล้ว' : '○ รอสร้างเสียงพากย์'}</span>}
                onOpen={() => onPreviewShot(shot)} openLabel={`ดูตัวอย่างช็อตที่ ${shot.shot_no}`}
                actions={<><button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" disabled={shotBusy} onClick={() => onEditShot(shot)}>แก้ไข</button><button type="button" className="pf-btn pf-btn-outline pf-btn-sm" disabled={shotBusy} onClick={() => onRegenImage(shot)}><RefreshCw size={12} />{imageReady ? 'วาดภาพใหม่' : 'สร้างภาพ'}</button></>} />
            })}
          </ProjectGrid>
        </section>
      ) : (
        <section className="pf-is-section">
          <div className="pf-is-section-head"><div><span className="pf-is-eyebrow">STEP 04</span><h2>{project.final_video_url ? 'วิดีโอสั้นของคุณเสร็จสมบูรณ์' : 'ตัดต่อรวมวิดีโอ'}</h2><p>ภาพเคลื่อนไหว เสียงบรรยาย และคำบรรยาย รวมเป็นวิดีโอสั้นที่สมบูรณ์</p></div></div>
          {project.final_video_url ? <div className="pf-is-final"><div className="pf-is-final-player"><video controls preload="metadata" src={api.assetUrl(project.final_video_url, project.updated_at)} poster={project.cover_url ? api.assetUrl(project.cover_url) : undefined} /></div><div><span className="pf-is-complete"><Check size={15} />สร้างเสร็จสิ้น</span><h3>{project.title}</h3><p>{project.output_ratio || '9:16'} · MP4 · เสียงพากย์และคำบรรยาย</p><button type="button" className="pf-btn pf-btn-lime" disabled={busy} onClick={onDownload}><Download size={16} />{busy ? 'กำลังประมวลผล…' : 'ดาวน์โหลดวิดีโอ'}</button><button type="button" className="pf-btn pf-btn-outline" disabled={locked} onClick={() => setView({ stage, step: 2 })}>กลับไปแก้ไขสื่อ</button><button type="button" className="pf-btn pf-btn-ghost" disabled={locked || !readiness.ready} onClick={onCompose}>ตัดต่อรวมใหม่ด้วยสื่อปัจจุบัน</button></div></div>
            : <div className="pf-is-empty"><Clapperboard size={42} /><h3>{running ? 'กำลังตัดต่อรวมวิดีโอ' : 'เตรียมตัดต่อรวม'}</h3><p>{running ? 'กำลังจัดลำดับการเคลื่อนไหวของภาพ ซิงค์เสียงพากย์และคำบรรยาย เมื่อเสร็จสิ้นสามารถดูตัวอย่างและดาวน์โหลดได้ทันที' : 'หลังยืนยันภาพและเสียงพากย์แล้ว จะเริ่มตัดต่อรวมเป็นวิดีโอฉบับสมบูรณ์'}</p></div>}
        </section>
      )}

      <footer className="pf-is-next">
        <div><strong>{running ? cancelling ? 'กำลังหยุดการผลิต' : 'กำลังดำเนินการตามขั้นตอนปัจจุบัน' : nextAction === 'preview' ? 'บันทึกวิดีโอแล้ว' : actionLabel}</strong><p>{running ? 'เมื่อเสร็จแล้วจะหยุดอยู่ที่ขั้นตอนนี้เพื่อรอให้คุณตรวจสอบ' : nextAction === 'assets' && (readiness.images || readiness.audio) ? 'ใช้งานแอสเซทที่สร้างเสร็จแล้ว และสร้างส่วนที่เหลือต่อ' : nextAction === 'compose' ? 'ภาพและเสียงพากย์พร้อมแล้ว ขั้นตอนถัดไปคือเพิ่มการเคลื่อนไหวของภาพและคำบรรยาย' : 'ทุกขั้นตอนสามารถดูและปรับแต่งผลลัพธ์ได้'}</p></div>
        <div className="pf-is-next-buttons">{step > 1 ? <button type="button" className="pf-btn pf-btn-outline" onClick={() => setView({ stage, step: step - 1 })}><ArrowLeft size={14} />ย้อนกลับ</button> : <button type="button" className="pf-btn pf-btn-ghost" disabled={locked} onClick={onRestart}><RefreshCw size={14} />สร้างสตอรี่บอร์ดใหม่</button>}{nextAction === 'preview' && step === 3 ? null : <button type="button" className="pf-btn pf-btn-lime" disabled={locked} onClick={step === 1 && stage > 1 ? () => setView({ stage, step: 2 }) : next}>{running ? 'กำลังผลิต…' : step === 1 && stage > 1 ? 'ถัดไป: ภาพและเสียงพากย์' : actionLabel}<ArrowRight size={16} /></button>}</div>
      </footer>
    </div>
  )
}
