import { readEpisodeJob } from '../../lib/dramaEpisodeJobs'
import { isRequestAborted } from '../../api/http'
import { TeamEditingBoundary } from '../../features/teams/TeamEditingBoundary'
/** โครงเรื่องหลัก：左栏分 ตอน目录 + 右栏เรื่องย่อของตอนนี้/บทและหมายเหตุการสร้างสรรค์เพิ่มเติมที่ไม่บังคับ */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Lightbulb,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Maximize2,
  Pencil,
} from 'lucide-react'
import { dramaApi, resolveDramaMediaUrl, type DramaEpisode, type DramaEpisodeBody, type DramaProject, type DramaScript } from '../../api/drama'
import { FragmentPlanSkillModal } from '../../components/drama/FragmentPlanSkillModal'
import { dialog } from '../../lib/dialog'
import {
  buildOutlineDirectory,
  episodeBodyCharLen,
  isSubstantialEpisodeBody,
  isSubstantialEpisodeCreative,
  mergeDirectoryEpisodeBodies,
  MIN_EPISODE_BODY_CHARS,
  MIN_EPISODE_CREATIVE_CHARS,
  parseEpisodeBodies,
} from './dramaWorkspaceUtils'
import { sumFragmentContentDuration } from './dramaEpisodeEditUtils'
import { OutlineScriptParseModal, OutlineScriptPreview } from './outlineScriptPreview'
import DramaStatusNotice, { DramaErrorNotice } from './DramaStatusNotice'

type SectionKey = 'creative' | 'summary' | 'body'

const GENERATION_TITLES: Record<string, string> = {
  creative: 'กำลังสร้างแนวคิดการสร้างสรรค์ของตอนนี้',
  summary: 'กำลังสร้างเรื่องย่อของตอนนี้',
  brief: 'กำลังสกัดข้อมูลเรื่องย่อของตอนนี้',
  body: 'กำลังสร้างบทถ่ายทำ',
  full: 'กำลังสร้างใหม่ทั้งตอน',
}

/** 分 ตอนข้อความรวมช็อตสำหรับไดเรกทอรี่ */
function formatOutlineShotDuration(sec: number): string {
  if (sec <= 0) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} นาที ${s} วินาที` : `${m}นาที`
}

type OutlineEpisodePanelProps = {
  projectId: number
  script: DramaScript | null
  episodeCount: number
  summaryReady: boolean
  /** สรุปเรื่องย่อทั้งเรื่องกำลังสร้าง（外部目录/空态需显示，不依赖弹窗） */
  summaryGenerating?: boolean
  /** ทั้งเรื่องเรื่องย่อ后กำลังสกัดแอสเซท */
  assetsSeeding?: boolean
  episodeGenerating: boolean
  /** ทั้งเรื่องบทละครแต่ละตอน进度 */
  episodeProgress?: { done: number; total: number }
  imageStyleLabel?: string
  storyType?: string
  onScriptChange: (script: DramaScript) => void
  onProjectChange: (project: DramaProject) => void
  onError: (msg: string) => void
  onOpenEpisodes: () => void
  children?: (parts: { directory: ReactNode; bodies: ReactNode }) => ReactNode
}

type SectionCardProps = {
  sectionKey: SectionKey
  icon: ReactNode
  title: string
  subtitle: string
  text: string
  editing: boolean
  draft: string
  open: boolean
  busy: boolean
  /** 禁用「生成」ปุ่ม；其他 ตอนกำลังสร้าง时仍可แก้ไข本 ตอน */
  generateBusy?: boolean
  placeholder: string
  regenerateLabel: string
  onToggle: () => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDraftChange: (v: string) => void
  onRegenerate?: () => void
  onCopy: () => void
  /** พื้นที่บทละคร：แยกวิเคราะห์ดูตัวอย่าง + แบ่งส่วนแก้ไข */
  scriptPreview?: ReactNode
}

// 分区卡片：图标标题 + แก้ไข/生成/คัดลอก/折叠
function SectionCard({
  sectionKey,
  icon,
  title,
  subtitle,
  text,
  editing,
  draft,
  open,
  busy,
  generateBusy,
  placeholder,
  regenerateLabel,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onDraftChange,
  onRegenerate,
  onCopy,
  scriptPreview,
}: SectionCardProps) {
  const genBusy = generateBusy ?? busy
  return (
    <article className={`drama-outline-section${open ? ' is-open' : ''}`}>
      <header className="drama-outline-section-head">
        <div className="drama-outline-section-title">
          <span className={`drama-outline-section-icon is-${sectionKey}`} aria-hidden>
            {icon}
          </span>
          <div>
            <strong>{title}</strong>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="drama-outline-section-actions">
          <button type="button" className="drama-outline-text-btn" disabled={busy} onClick={onEdit}>
            <Pencil size={14} strokeWidth={2} />
            แก้ไข
          </button>
          {onRegenerate ? (
            <button type="button" className="drama-outline-text-btn" disabled={genBusy} onClick={onRegenerate}>
              <RefreshCw size={14} strokeWidth={2} />
              {regenerateLabel}
            </button>
          ) : null}
          <button type="button" className="drama-outline-text-btn" onClick={onCopy}>
            <Copy size={14} strokeWidth={2} />
            คัดลอก
          </button>
          <button
            type="button"
            className="drama-outline-text-btn drama-outline-text-btn-icon"
            onClick={onToggle}
            aria-label={sectionKey === 'body' ? 'วิเคราะห์หน้าต่างป๊อปอัป' : open ? 'ย่อเก็บ' : 'ขยาย'}
          >
            {sectionKey === 'body' ? (
              <Maximize2 size={14} strokeWidth={2} />
            ) : open ? (
              <ChevronUp size={14} strokeWidth={2} />
            ) : (
              <ChevronDown size={14} strokeWidth={2} />
            )}
            {sectionKey === 'body' ? 'แยกวิเคราะห์ดูตัวอย่าง' : open ? 'ย่อเก็บ' : 'ขยาย'}
          </button>
        </div>
      </header>
      {open ? (
        <div className="drama-outline-section-body">
          {editing ? (
            <>
              <textarea
                className="drama-ep-section-textarea"
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                rows={sectionKey === 'body' ? 14 : 8}
                placeholder={placeholder}
                disabled={busy}
              />
              <div className="drama-ep-section-edit-actions">
                <button type="button" className="drama-btn-ghost" disabled={busy} onClick={onCancel}>
                  ยกเลิก
                </button>
                <button type="button" className="drama-btn-primary" disabled={busy} onClick={onSave}>
                  บันทึก
                </button>
              </div>
            </>
          ) : scriptPreview ? (
            scriptPreview
          ) : (
            <p className="drama-pre drama-outline-section-text">{text.trim() || placeholder}</p>
          )}
        </div>
      ) : null}
    </article>
  )
}
// 分 ตอน目录 + เรื่องย่อของตอนนี้、บทการถ่ายทำ、可选备注
export function OutlineEpisodePanel({
  projectId,
  script,
  episodeCount,
  summaryReady,
  summaryGenerating = false,
  assetsSeeding = false,
  episodeGenerating,
  episodeProgress = { done: 0, total: 0 },
  imageStyleLabel,
  storyType,
  onScriptChange,
  onProjectChange,
  onError,
  onOpenEpisodes,
  children,
}: OutlineEpisodePanelProps) {
  const navigate = useNavigate()
  const [activeEpisodeNumber, setActiveEpisodeNumber] = useState(1)
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    () => new Set(['summary', 'body']),
  )
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null)
  const [sectionDraft, setSectionDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [localJobs, setLocalJobs] = useState<Record<number, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [enterSkillOpen, setEnterSkillOpen] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localNotice, setLocalNotice] = useState('')
  const [scriptModalOpen, setScriptModalOpen] = useState(false)
  const [sceneEditing, setSceneEditing] = useState(false)
  const [episodeCovers, setEpisodeCovers] = useState<Record<number, string>>({})
  const [episodeShotStats, setEpisodeShotStats] = useState<
    Record<number, { episodeId: number; fragmentCount: number; totalSec: number; planStatus: string; scriptChanged: boolean }>
  >({})

  const episodeBodies = parseEpisodeBodies(script)
  const directoryEpisodes = buildOutlineDirectory(episodeBodies, episodeCount)
  const displayEpisodes = mergeDirectoryEpisodeBodies(directoryEpisodes, episodeBodies)
  const selected =
    displayEpisodes.find((ep) => ep.episodeNumber === activeEpisodeNumber) || displayEpisodes[0] || null

  const selectedJob = readEpisodeJob(script, selected?.episodeNumber || 0)
  const generatingMode = selected ? localJobs[selected.episodeNumber || 0] || selectedJob.mode || null : null
  const generatingEpisodeNumber = Number(Object.keys(localJobs).find((number) => Number(number) !== selected?.episodeNumber) || 0) || null

  useEffect(() => {
    if (!selected) return
    if (!displayEpisodes.some((ep) => ep.episodeNumber === activeEpisodeNumber) && displayEpisodes[0]) {
      setActiveEpisodeNumber(displayEpisodes[0].episodeNumber || 1)
    }
  }, [displayEpisodes, activeEpisodeNumber, selected])

  useEffect(() => {
    setEditingSection(null)
    setSectionDraft('')
    setTitleDraft(selected?.title || '')
    setLocalError('')
    setLocalNotice('')
    setScriptModalOpen(false)
    setSceneEditing(false)
  }, [selected?.episodeNumber])

  useEffect(() => {
    if (!editingSection) setTitleDraft(selected?.title || '')
  }, [selected?.title, editingSection])

  // อ่านสตอรี่บอร์ด ตอน AI 分ช็อตที่ สถานะ（รวมการเข้าคิวอัตโนมัติ）
  function readPlanStatus(ep: DramaEpisode): string {
    const active = (ep.active_tasks || []).find((task) => task.task_type === 'fragment_plan')
    if (
      active &&
      !active.cancel_requested &&
      ['pending', 'leased', 'running', 'awaiting_poll', 'awaiting_review'].includes(active.status)
    ) {
      return 'generating'
    }
    const st = ep.params?.fragment_plan_status
    return typeof st === 'string' ? st : ''
  }

  // 从分 ตอน列表รีเฟรช封面 / จำนวนช็อต / 分ช็อตที่ สถานะ
  function applyEpisodeRows(rows: DramaEpisode[]) {
    const map: Record<number, string> = {}
    const shotMap: Record<number, { episodeId: number; fragmentCount: number; totalSec: number; planStatus: string; scriptChanged: boolean }> =
      {}
    for (const ep of rows) {
      const epNo = Number(ep.params?.episodeNumber) || 0
      if (!epNo) continue
      const frags = [...(ep.fragments || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      const planStatus = readPlanStatus(ep)
      const totalSec =
        frags.length > 0
          ? frags.reduce((sum, f) => {
              const stored = Number(f.duration_sec)
              if (Number.isFinite(stored) && stored > 0) return sum + Math.round(stored)
              return sum + sumFragmentContentDuration(f.content || '')
            }, 0)
          : 0
      shotMap[epNo] = {
        episodeId: ep.id,
        fragmentCount: frags.length,
        totalSec,
        planStatus,
        scriptChanged: ep.params?.fragment_script_changed === true,
      }
      const first = frags.find((f) => (f.cover || '').trim() || (f.video || '').trim())
      if (!first) continue
      const raw = (first.cover || first.video || '').trim()
      if (raw) map[epNo] = resolveDramaMediaUrl(raw)
    }
    setEpisodeCovers(map)
    setEpisodeShotStats(shotMap)
  }

  // 只读已有分 ตอน行；อย่าข้ามกฎก่อนเวลา seed（มิฉะนั้นจะแสดงเท็จ「1 ช็อตที่ 」）。ในสตอรี่บอร์ด持续轮询。
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function refresh() {
      try {
        const rows: DramaEpisode[] = await dramaApi.listEpisodes(projectId)
        if (cancelled) return
        applyEpisodeRows(rows)
        const anyPlanning = rows.some((ep) => readPlanStatus(ep) === 'generating')
        // บทละครแต่ละตอน还在跑时也ดำเนินต่อ刷，以便每 ตอนเสร็จสิ้นเห็นทันทีหลังจาก「AI ในสตอรี่บอร์ด」
        if (anyPlanning || episodeGenerating) {
          timer = window.setTimeout(() => {
            void refresh()
          }, 2500)
        }
      } catch {
        if (!cancelled) {
          setEpisodeCovers({})
          setEpisodeShotStats({})
        }
      }
    }

    void refresh()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [projectId, script?.id, script?.episode_content, episodeCount, episodeGenerating, generatingMode])

  const selectedGenerating = Boolean(selected && localJobs[selected.episodeNumber || 0]) || ['queued', 'generating', 'running'].includes(selectedJob.status)
  const anyEpisodeGenerating = Object.keys(localJobs).length > 0
  const effectiveCreative =
    editingSection === 'creative' ? sectionDraft : selected?.creative || ''
  const effectiveSummary =
    editingSection === 'summary' ? sectionDraft : selected?.summary || ''
  const canGenerateBody =
    episodeBodyCharLen(effectiveCreative) >= 10 || episodeBodyCharLen(effectiveSummary) >= 40
  const canRegenerateEpisode =
    isSubstantialEpisodeCreative(effectiveCreative) || episodeBodyCharLen(effectiveSummary) >= 40
  const canAdd =
    summaryReady &&
    !episodeGenerating &&
    !adding &&
    !anyEpisodeGenerating &&
    !confirming &&
    directoryEpisodes.length < 120

  // ทั้งเรื่องสร้างพร้อมกัน时：已写完เนื้อหาหลัก的 ตอน可แก้ไข / 进分ช็อตที่  / สร้างใหม่；未เสร็จสิ้น ตอน仍锁生成
  // 单 ตอน任务按 ตอนเป็นอิสระ；只禁用ปัจจุบันกำลัง生成的一 ตอน
  const selectedBodyReady = isSubstantialEpisodeBody(selected?.body)
  const summaryGenerateMode = selectedBodyReady
    ? 'brief'
    : isSubstantialEpisodeCreative(selected?.creative) ? 'summary' : null
  const batchLocksThisEpisode = episodeGenerating && !selectedBodyReady
  const busy = selectedGenerating || confirming || saving || adding
  const generateBusy =
    selectedGenerating || batchLocksThisEpisode || confirming || saving || adding
  const enterBusy = busy || !selectedBodyReady

  async function pollOptimize(tokenEpisode: number) {
    const started = Date.now()
    let lastErr: Error | null = null
    while (Date.now() - started < 8 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 2000))
      let cur: DramaScript
      try { cur = await dramaApi.getScript(projectId) }
      catch (err) { if (isRequestAborted(err)) throw err; lastErr = err instanceof Error ? err : new Error('ดึงข้อมูลสถานะล้มเหลว'); continue }
      onScriptChange(cur)
      lastErr = null
      const job = readEpisodeJob(cur, tokenEpisode)
      if (job.status === 'completed') return cur
      if (job.status === 'failed' || job.status === 'cancelled') throw new Error(job.error || 'สร้างตอนนี้ไม่สำเร็จหรือถูกยกเลิกแล้ว')

    }
    throw lastErr || new Error('การสร้างหมดเวลา โปรดรีเฟรชในภายหลัง')
  }

  async function saveBodies(nextBodies: DramaEpisodeBody[]) {
    if (!selected?.episodeNumber) throw new Error('โปรดเลือกตอนก่อน')
    const current = nextBodies.find((item) => item.episodeNumber === selected.episodeNumber)
    if (!current) throw new Error('ไม่พบข้อมูลตอนนี้ โปรดรีเฟรช')
    await dramaApi.updateScriptEpisode(projectId, selected.episodeNumber, { title: current.title, creative: current.creative, summary: current.summary, body: current.body, version: Number((script?.params?.episode_versions as Record<string, number> | undefined)?.[String(selected.episodeNumber)] ?? 0) })
    const updated = await dramaApi.getScript(projectId)
    onScriptChange(updated)
    return updated
  }

  async function handleAddEpisode() {
    if (!canAdd) return
    setAdding(true)
    setLocalError('')
    try {
      const res = await dramaApi.addEpisode({ project_id: projectId })
      onScriptChange(res.script)
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
      setActiveEpisodeNumber(res.episode_number)
      setEditingSection('summary')
      setSectionDraft('')
      setOpenSections((prev) => new Set(prev).add('summary'))
      onOpenEpisodes()
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : 'เพิ่มตอนไม่สำเร็จ'
      setLocalError(msg)
      onError(msg)
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveSection(section: SectionKey) {
    if (!selected?.episodeNumber) return
    setSaving(true)
    setLocalError('')
    try {
      const num = selected.episodeNumber
      const next = displayEpisodes.map((ep) => {
        if (ep.episodeNumber !== num) return ep
        if (section === 'creative') return { ...ep, creative: sectionDraft, title: titleDraft || ep.title }
        if (section === 'summary') return { ...ep, summary: sectionDraft, title: titleDraft || ep.title }
        return { ...ep, body: sectionDraft, title: titleDraft || ep.title }
      })
      await saveBodies(next)
      setEditingSection(null)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'
      setLocalError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate(mode: 'summary' | 'body' | 'full' | 'brief') {
    if (!selected?.episodeNumber) return
    if (editingSection || sceneEditing) {
      setLocalError('โปรดบันทึกหรือยกเลิกการแก้ไขเนื้อหาก่อน แล้วจึงสร้างใหม่')
      return
    }
    const creative = selected.creative || ''
    const summary = selected.summary || ''
    if (mode === 'summary' && !isSubstantialEpisodeCreative(creative)) {
      setLocalError(`หมายเหตุการสร้างสรรค์สำหรับสร้างเรื่องย่อต้องมีอย่างน้อย ${MIN_EPISODE_CREATIVE_CHARS} ตัวอักษร`)
      return
    }
    if (mode === 'full' && !isSubstantialEpisodeCreative(creative) && episodeBodyCharLen(summary) < 40) {
      setLocalError(`โปรดระบุเรื่องย่อของตอนนี้อย่างน้อย 40 ตัวอักษร หรือหมายเหตุการสร้างสรรค์อย่างน้อย ${MIN_EPISODE_CREATIVE_CHARS} ตัวอักษร`)
      return
    }
    // 与后端 run_episode_body_from_brief 一致：แนวคิด≥10 或เรื่องย่อ≥40
    if (mode === 'body' && episodeBodyCharLen(creative) < 10 && episodeBodyCharLen(summary) < 40) {
      setLocalError('โปรดระบุเรื่องย่อของตอนนี้ก่อน แล้วจึงสร้างบทถ่ายทำ')
      return
    }
    if (mode === 'brief' && !isSubstantialEpisodeBody(selected.body)) {
      setLocalError(`บทถ่ายทำต้องมีอย่างน้อย ${MIN_EPISODE_BODY_CHARS} ตัวอักษรก่อนจึงจะสกัดเรื่องย่อของตอนนี้ได้`)
      return
    }
    if (mode === 'full') {
      const ok = await dialog.confirm({
        title: 'สร้างใหม่ทั้งตอน',
        message:
          'ระบบจะเขียนบทถ่ายทำใหม่ตามเรื่องย่อของตอนนี้ หากไม่มีเรื่องย่อจะใช้หมายเหตุการสร้างสรรค์ หากตอนนี้เคยเข้าสู่สตอรี่บอร์ดแล้ว การแบ่งสตอรี่บอร์ดใหม่จะเขียนทับและล้างข้อมูลช็อตเดิม ต้องการดำเนินการต่อหรือไม่?',
        confirmText: 'สร้างใหม่',
        tone: 'danger',
      })
      if (!ok) return
    }
    const targetEpisode = selected.episodeNumber
    setLocalJobs((jobs) => ({ ...jobs, [targetEpisode]: mode }))
    setLocalError('')
    setLocalNotice('')
    try {
      await dramaApi.episodeScript({
        project_id: projectId,
        episode_number: targetEpisode,
        generate_mode: mode,
        creative: creative || undefined,
        title: selected.title,
      })
      const cur = await pollOptimize(targetEpisode)
      const created = readEpisodeJob(cur, targetEpisode).assetsCreated
      if ((mode === 'body' || mode === 'full') && created > 0) {
        setLocalNotice(`สร้างตัวละคร/ฉากใหม่ ${created} รายการ บันทึกลงคลังแอสเซทแล้ว`)
      }
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : 'สร้างไม่สำเร็จ'
      setLocalError(msg)
      onError(msg)
    } finally {
      setLocalJobs((jobs) => { const next = { ...jobs }; delete next[targetEpisode]; return next })
    }
  }

  async function handleConfirmEnter() {
    if (!selected?.episodeNumber) return
    if (editingSection || sceneEditing) {
      setLocalError('โปรดบันทึกหรือยกเลิกการแก้ไขเนื้อหาก่อน แล้วจึงเข้าสู่สตอรี่บอร์ด')
      return
    }
    if (!isSubstantialEpisodeBody(selected.body)) {
      setLocalError(`เนื้อหาบทถ่ายทำต้องมีอย่างน้อย ${MIN_EPISODE_BODY_CHARS} ตัวอักษรก่อนจึงจะเข้าสู่สตอรี่บอร์ดได้`)
      return
    }
    setLocalError('')
    setConfirming(true)
    try {
      // 已自动入队/เสร็จสิ้น AI 分ช็อตที่ ：直接เข้าสู่แก้ไข页（页内会轮询「AI ในสตอรี่บอร์ด」）
      const rows = await dramaApi.listEpisodes(projectId)
      const existing = rows.find(
        (ep) => Number(ep.params?.episodeNumber) === Number(selected.episodeNumber),
      )
      const planSt = existing ? readPlanStatus(existing) : ''
      if (
        existing &&
        (planSt === 'generating' ||
          planSt === 'completed' ||
          (existing.fragments || []).length > 0)
      ) {
        navigate(`/drama/projects/${projectId}/episodes/${existing.id}`)
        return
      }
      setEnterSkillOpen(true)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : 'เข้าสู่สตอรี่บอร์ดไม่สำเร็จ'
      setLocalError(msg)
      onError(msg)
    } finally {
      setConfirming(false)
    }
  }

  // 首次เข้าสู่：确认剧本 + ตามการเลือก Skill 做 AI 分ช็อตที่ 
  async function startEnterWithSkills(skillIds: number[]) {
    if (!selected?.episodeNumber) return
    setEnterSkillOpen(false)
    setConfirming(true)
    setLocalError('')
    try {
      const res = await dramaApi.confirmEpisodeFromScript({
        project_id: projectId,
        episode_number: selected.episodeNumber,
      })
      const episodeId = res.episode.id
      try {
        await dramaApi.planEpisodeFragments(episodeId, {
          force: true,
          fallback_rules: true,
          skill_ids: skillIds,
        })
      } catch (planErr) {
        if (isRequestAborted(planErr)) return
        onError(planErr instanceof Error ? planErr.message : 'AI เริ่มสตอรี่บอร์ดล้มเหลว')
      }
      navigate(`/drama/projects/${projectId}/episodes/${episodeId}`)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : 'เข้าสู่สตอรี่บอร์ดไม่สำเร็จ'
      setLocalError(msg)
      onError(msg)
    } finally {
      setConfirming(false)
    }
  }

  async function handleSaveScenes(nextBody: string) {
    if (!selected?.episodeNumber) return
    setSaving(true)
    setLocalError('')
    try {
      const num = selected.episodeNumber
      const next = displayEpisodes.map((ep) =>
        ep.episodeNumber === num ? { ...ep, body: nextBody, title: titleDraft || ep.title } : ep,
      )
      await saveBodies(next)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'
      setLocalError(msg)
      onError(msg)
      throw err
    } finally {
      setSaving(false)
    }
  }

  function toggleSection(key: SectionKey) {
    if (key === 'body') {
      setScriptModalOpen(true)
      setOpenSections((prev) => new Set(prev).add('body'))
      return
    }
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function startEdit(section: SectionKey) {
    if (!selected) return
    if (sceneEditing) {
      setLocalError('โปรดบันทึกหรือยกเลิกการแก้ไขลำดับฉากก่อน')
      return
    }
    setEditingSection(section)
    setSectionDraft(
      section === 'creative'
        ? selected.creative || ''
        : section === 'summary'
          ? selected.summary || ''
          : selected.body || '',
    )
    setOpenSections((prev) => new Set(prev).add(section))
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text || '')
    } catch {
      setLocalError('คัดลอกล้มเหลว')
    }
  }

  const metaTags = useMemo(() => {
    const tags: string[] = []
    if (storyType) tags.push(storyType)
    if (selected?.origin === 'manual') tags.push('เพิ่มด้วยตนเอง')
    else if (selected?.body) tags.push('สร้างอัตโนมัติ')
    return tags
  }, [storyType, selected])

  const bodyReady = selectedBodyReady
  const selectedShot = episodeShotStats[selected?.episodeNumber || 0]
  const charHint = selected
    ? [
        selected.summary ? `เรื่องย่อ ${episodeBodyCharLen(selected.summary)} ตัวอักษร` : null,
        selected.body ? `บทถ่ายทำ ${episodeBodyCharLen(selected.body)} ตัวอักษร` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const directory = (
    <aside className="drama-outline-sidebar">
      <div className="drama-outline-sidebar-head">
        <div>
          <h3>สารบัญตอน</h3>
          <p>ทั้งหมด {directoryEpisodes.length} ตอน</p>
        </div>
        {summaryReady ? (
          <button
            type="button"
            className="drama-outline-add-btn"
            disabled={!canAdd}
            onClick={() => void handleAddEpisode()}
          >
            <Plus size={14} strokeWidth={2.5} />
            {adding ? 'กำลังเพิ่ม…' : 'เพิ่มตอน'}
          </button>
        ) : null}
      </div>
      <ul className="drama-outline-ep-list">
        {directoryEpisodes.map((ep) => {
          const body = displayEpisodes.find((x) => x.episodeNumber === ep.episodeNumber)
          const ready = isSubstantialEpisodeBody(body?.body)
          const active = activeEpisodeNumber === ep.episodeNumber
          const shot = episodeShotStats[ep.episodeNumber || 0]
          const statusLabel = summaryGenerating
            ? 'สรุปเรื่องย่อทั้งเรื่องกำลังสร้าง…'
            : assetsSeeding
              ? 'กำลังสกัดแอสเซท…'
              : shot?.planStatus === 'generating'
                ? 'AI ในสตอรี่บอร์ด…'
                : shot?.planStatus === 'failed'
                  ? 'สตอรี่บอร์ดล้มเหลว'
                  : shot?.scriptChanged && shot.fragmentCount > 0
                    ? `${shot.fragmentCount} ช็อต · ${formatOutlineShotDuration(shot.totalSec)} (ร่างเดิม)`
                    : shot?.planStatus === 'completed' &&
                      shot.fragmentCount > 0 &&
                      shot.totalSec > 0
                    ? shot.fragmentCount <= 1 && ready
                      ? `1 ช็อตที่  · ${formatOutlineShotDuration(shot.totalSec)}（ค่อนข้างน้อย）`
                      : `${shot.fragmentCount} ช็อต · ${formatOutlineShotDuration(shot.totalSec)}`
                    : episodeGenerating && !ready && !body?.summary && !body?.creative
                      ? episodeProgress.total > 0
                        ? `ความคืบหน้าของเรื่อง ${episodeProgress.done}/${episodeProgress.total}`
                        : 'รอสร้างบทถ่ายทำ…'
                      : ready
                        ? 'รอ AI แบ่งสตอรี่บอร์ด'
                        : body?.summary || body?.creative
                          ? 'บทละครรอการสร้าง'
                          : 'รอระบุเรื่องย่อ'
          return (
            <li key={ep.episodeNumber}>
              <button
                type="button"
                className={`drama-outline-ep-card${active ? ' is-active' : ''}`}
                onClick={() => {
                  onOpenEpisodes()
                  setActiveEpisodeNumber(ep.episodeNumber)
                }}
              >
                <span className="drama-outline-ep-thumb" aria-hidden>
                  {(() => {
                    const cover = episodeCovers[ep.episodeNumber || 0]
                    if (!cover) return ep.episodeNumber
                    if (/\.(mp4|webm|mov)(\?|$)/i.test(cover)) {
                      return <video src={cover} muted playsInline preload="metadata" />
                    }
                    return <img src={cover} alt="" />
                  })()}
                </span>
                <span className="drama-outline-ep-meta">
                  <strong>ตอนที่ {ep.episodeNumber}</strong>
                  <small>{ep.title || 'ยังไม่มีชื่อ'}</small>
                  <em
                    className={
                      summaryGenerating ||
                      assetsSeeding ||
                      shot?.planStatus === 'generating' ||
                      (episodeGenerating && !ready) ||
                      (ready && shot?.planStatus !== 'completed')
                        ? 'is-waiting'
                        : shot?.planStatus === 'completed' && shot.fragmentCount > 0
                          ? 'is-shot'
                          : undefined
                    }
                  >
                    {statusLabel}
                  </em>
                </span>
                <span className="drama-outline-ep-more" aria-hidden>
                  <MoreHorizontal size={16} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )

  const bodies = !selected ? (
    <div className="drama-outline-detail-empty">
      <p>
        {summaryGenerating
          ? 'สรุปเรื่องย่อทั้งเรื่องกำลังสร้าง เมื่อเสร็จแล้วจะสกัดแอสเซทและสร้างบทถ่ายทำแต่ละตอน…'
          : assetsSeeding
            ? 'กำลังสกัดคลังแอสเซท จากนั้นจะสร้างบทถ่ายทำแต่ละตอน…'
            : summaryReady
              ? 'ยังไม่มีตอน โปรดคลิก "เพิ่มตอน" หรือรอสร้างอัตโนมัติ'
              : 'โปรดระบุแนวคิดเรื่องย่อทั้งหมดและสรุปเรื่องย่อให้เสร็จก่อน'}
      </p>
    </div>
  ) : (
    <section className="drama-outline-detail">
      <header className="drama-outline-detail-head">
        <div className="drama-outline-detail-title">
          {editingSection ? (
            <input
              className="drama-title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="ชื่อตอน"
            />
          ) : (
            <h2>
              ตอนที่ {selected.episodeNumber}
              {selected.title ? `：${selected.title}` : ''}
            </h2>
          )}
          {imageStyleLabel ? <span className="drama-outline-style-badge">{imageStyleLabel}</span> : null}
          <div className="drama-outline-detail-meta">
            {charHint ? <span>{charHint}</span> : <span>ยังไม่ได้กรอกเนื้อหาของตอน</span>}
            {metaTags.map((tag) => (
              <span key={tag} className="drama-outline-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="drama-outline-detail-actions">
          <span className={`drama-outline-saved${bodyReady && !editingSection && !sceneEditing && !selectedShot?.scriptChanged ? ' is-ready' : ''}`}>
            <Check size={14} strokeWidth={2.5} />
            {editingSection || sceneEditing
              ? 'แก้ไขยังไม่บันทึก'
              : selectedShot?.scriptChanged
                ? 'สตอรี่บอร์ดรออัปเดต'
                : bodyReady
                  ? 'พร้อมเข้าสู่สตอรี่บอร์ด'
                  : saving ? 'กำลังบันทึก…' : 'ซิงค์แล้ว'}
          </span>
          {bodyReady && episodeBodyCharLen(selected.summary) < 40 ? (
            <button
              type="button"
              className="drama-btn-ghost"
              disabled={generateBusy}
              onClick={() => void handleGenerate('brief')}
            >
              {selectedGenerating && generatingMode === 'brief' ? 'กำลังสกัด…' : 'สกัดเรื่องย่อของตอนนี้'}
            </button>
          ) : null}
          <button
            type="button"
            className="drama-outline-regen-btn"
            disabled={generateBusy || !canRegenerateEpisode}
            onClick={() => void handleGenerate('full')}
            title={
              batchLocksThisEpisode
                ? 'บทถ่ายทำของตอนนี้ยังสร้างไม่เสร็จ โปรดรอสักครู่'
                : anyEpisodeGenerating
                  ? 'มีการสร้างตอนอื่นกำลังดำเนินการอยู่'
                  : undefined
            }
          >
            <RefreshCw size={15} strokeWidth={2.25} />
            {selectedGenerating && generatingMode === 'full' ? 'กำลังสร้าง…' : 'สร้างใหม่ทั้งตอน'}
          </button>
          {selectedShot?.episodeId && !editingSection && !sceneEditing ? (
            <Link className="drama-btn-primary" to={`/drama/projects/${projectId}/episodes/${selectedShot.episodeId}`}>
              เข้าสู่สตอรี่บอร์ด
            </Link>
          ) : (
          <button
            type="button"
            className="drama-btn-primary"
            disabled={enterBusy}
            onClick={() => void handleConfirmEnter()}
            title={!selectedBodyReady ? `เนื้อหาบทถ่ายทำต้องมีอย่างน้อย ${MIN_EPISODE_BODY_CHARS} ตัวอักษร` : undefined}
          >
            {confirming ? 'กำลังเข้าสู่…' : 'เข้าสู่สตอรี่บอร์ด'}
          </button>
          )}
        </div>
      </header>

      <div className="drama-outline-status-list">
        {localError ? <DramaErrorNotice message={localError} onDismiss={() => setLocalError('')} /> : null}
        {localNotice ? <DramaStatusNotice tone="success" title={localNotice} onDismiss={() => setLocalNotice('')} /> : null}
        {selectedShot?.scriptChanged ? (
          <DramaStatusNotice tone="warning" title="บทถ่ายทำอัปเดตแล้ว สตอรี่บอร์ดรอการซิงค์">
            สตอรี่บอร์ดปัจจุบันยังเป็นร่างเดิม หลังจากเข้าสู่สตอรี่บอร์ดแล้วโปรดแบ่งสตอรี่บอร์ดใหม่
          </DramaStatusNotice>
        ) : null}
        {summaryGenerating ? (
          <DramaStatusNotice tone="busy" title="กำลังสร้างสรุปเรื่องย่อทั้งเรื่อง">
            หลังจากเสร็จสิ้นจะสกัดตัวละครและแอสเซทฉาก แล้วจึงสร้างบทถ่ายทำของแต่ละตอน
          </DramaStatusNotice>
        ) : null}
        {assetsSeeding ? (
          <DramaStatusNotice tone="busy" title="กำลังสกัดตัวละครและแอสเซทฉาก">
            หลังจากบันทึกลงคลังแอสเซทแล้ว จะเริ่มสร้างบทถ่ายทำแต่ละตอน
          </DramaStatusNotice>
        ) : null}
        {episodeGenerating ? (
          <DramaStatusNotice tone="busy" title="กำลังสร้างบทแต่ละตอน">
            {episodeProgress.total > 0
              ? `เสร็จสมบูรณ์ ${episodeProgress.done} / ${episodeProgress.total} ตอน สามารถเปิดดูเนื้อหาที่เสร็จแล้วได้`
              : 'สามารถเปิดดูเนื้อหาของตอนที่เสร็จแล้วได้'}
          </DramaStatusNotice>
        ) : null}
        {selectedGenerating ? (
          <DramaStatusNotice tone="busy" title={GENERATION_TITLES[generatingMode || ''] || 'กำลังสร้างเนื้อหาของตอนนี้'}>
            ระบบจะอัปเดตเนื้อหาโดยอัตโนมัติหลังจากสร้างเสร็จ โปรดรอสักครู่
          </DramaStatusNotice>
        ) : anyEpisodeGenerating && generatingEpisodeNumber ? (
          <DramaStatusNotice tone="busy" title={`ตอนที่ ${generatingEpisodeNumber} กำลังสร้าง`}>
            คุณสามารถสร้างสรรค์เนื้อหาในตอนปัจจุบันต่อไปได้
          </DramaStatusNotice>
        ) : null}
        {selected && episodeShotStats[selected.episodeNumber || 0]?.planStatus === 'generating' ? (
          <DramaStatusNotice tone="busy" title="กำลังสร้าง AI สตอรี่บอร์ดของตอนนี้">
            เมื่อสร้างสตอรี่บอร์ดเสร็จแล้ว สามารถเข้าไปดูและแก้ไขได้
          </DramaStatusNotice>
        ) : null}
        {selected &&
        isSubstantialEpisodeBody(selected.body) &&
        !episodeShotStats[selected.episodeNumber || 0]?.planStatus &&
        !selectedGenerating &&
        !episodeGenerating &&
        !summaryGenerating &&
        !assetsSeeding ? (
          <DramaStatusNotice tone="busy" title="บทถ่ายทำของตอนนี้พร้อมแล้ว กำลังเตรียมสร้าง AI สตอรี่บอร์ด" />
        ) : null}
      </div>

      <div className="drama-outline-sections">
        <SectionCard
          sectionKey="summary"
          icon={<BookOpen size={18} strokeWidth={1.9} />}
          title="เรื่องย่อของตอนนี้"
          subtitle="ตัวละคร ความขัดแย้ง จุดหักมุม และบทสรุปของตอนนี้ ข้อมูลหลักสำหรับสร้างบทถ่ายทำ"
          text={selected.summary || ''}
          editing={editingSection === 'summary'}
          draft={sectionDraft}
          open={openSections.has('summary')}
          busy={busy}
          generateBusy={generateBusy}
          placeholder="ระบุเรื่องย่อของตอนนี้ (อย่างน้อย 40 ตัวอักษร) แล้วสร้างบทถ่ายทำ"
          regenerateLabel={
            selectedGenerating && generatingMode === 'brief'
              ? 'กำลังสกัด…'
              : selectedGenerating && generatingMode === 'summary'
                ? 'กำลังสร้าง…'
                : summaryGenerateMode === 'brief'
                  ? 'สกัดจากบทถ่ายทำ'
                  : 'สร้างจากหมายเหตุ'
          }
          onToggle={() => toggleSection('summary')}
          onEdit={() => startEdit('summary')}
          onCancel={() => setEditingSection(null)}
          onSave={() => void handleSaveSection('summary')}
          onDraftChange={setSectionDraft}
          onRegenerate={summaryGenerateMode ? () => void handleGenerate(summaryGenerateMode) : undefined}
          onCopy={() => void copyText(selected.summary || '')}
        />
        <SectionCard
          sectionKey="body"
          icon={<FileText size={18} strokeWidth={1.9} />}
          title="บทการถ่ายทำ"
          subtitle="เนื้อหาบทถ่ายทำหลักประกอบด้วยบทสนทนาและคำบรรยายภาพ (แยกตามลำดับฉาก สามารถแบ่งแก้ไขได้)"
          text={selected.body || ''}
          editing={editingSection === 'body'}
          draft={sectionDraft}
          open={openSections.has('body')}
          busy={busy}
          generateBusy={generateBusy || !canGenerateBody}
          placeholder={`เนื้อหาบทถ่ายทำ (เข้าสู่สตอรี่บอร์ดต้องมีอย่างน้อย ${MIN_EPISODE_BODY_CHARS} ตัวอักษร)`}
          regenerateLabel={selectedGenerating && generatingMode === 'body' ? 'กำลังสร้าง…' : 'สร้างบทถ่ายทำ'}
          onToggle={() => toggleSection('body')}
          onEdit={() => startEdit('body')}
          onCancel={() => setEditingSection(null)}
          onSave={() => void handleSaveSection('body')}
          onDraftChange={setSectionDraft}
          onRegenerate={() => void handleGenerate('body')}
          onCopy={() => void copyText(selected.body || '')}
          scriptPreview={
            <OutlineScriptPreview
              key={selected.episodeNumber}
              text={selected.body || ''}
              empty={`เนื้อหาบทถ่ายทำ (เข้าสู่สตอรี่บอร์ดต้องมีอย่างน้อย ${MIN_EPISODE_BODY_CHARS} ตัวอักษร)`}
              busy={busy}
              shotStats={episodeShotStats[selected.episodeNumber || 0] || null}
              onSaveScenes={handleSaveScenes}
              onEditingChange={setSceneEditing}
            />
          }
        />
        <SectionCard
          sectionKey="creative"
          icon={<Lightbulb size={18} strokeWidth={1.9} />}
          title="หมายเหตุการสร้างสรรค์ (ไม่บังคับ)"
          subtitle="เสริมทิศทางการสร้างสรรค์หรือเก็บแนวคิดเริ่มต้น; ไม่จำเป็นต้องกรอกเมื่อมีร่างไว้แล้ว"
          text={selected.creative || ''}
          editing={editingSection === 'creative'}
          draft={sectionDraft}
          open={openSections.has('creative')}
          busy={busy}
          placeholder="ไม่บังคับ: เพิ่มเติมแรงจูงใจของตัวละคร ทิศทางการสร้างสรรค์ หรือข้อกำหนดพิเศษ"
          regenerateLabel="สร้างเรื่องย่อ"
          onToggle={() => toggleSection('creative')}
          onEdit={() => startEdit('creative')}
          onCancel={() => setEditingSection(null)}
          onSave={() => void handleSaveSection('creative')}
          onDraftChange={setSectionDraft}
          onCopy={() => void copyText(selected.creative || '')}
        />
      </div>
      <OutlineScriptParseModal
        open={scriptModalOpen}
        onClose={() => setScriptModalOpen(false)}
        title={`ตอนที่ ${selected.episodeNumber} · วิเคราะห์บทถ่ายทำ`}
        text={selected.body || ''}
      />
    </section>
  )

  const editableBodies = <TeamEditingBoundary projectId={projectId} type="episode" resourceId={selected?.episodeNumber || 0} enabled={Boolean(selected)} showReadOnlyNotice={false} allowReadOnlyNavigation onAcquired={async (isCurrent) => { const fresh = await dramaApi.getScript(projectId); if (isCurrent()) onScriptChange(fresh) }}>{bodies}</TeamEditingBoundary>

  if (children) {
    return (
      <>
        {children({ directory, bodies: editableBodies })}
        <FragmentPlanSkillModal
          open={enterSkillOpen}
          title="เข้าสู่สตอรี่บอร์ด"
          message="ระบบจะยืนยันบทถ่ายทำของตอนนี้และเริ่มแบ่งช็อต สามารถเลือกใช้ Skill ได้ โดยหลังจากยืนยันจะเขียนทับสตอรี่บอร์ดและช็อตเดิม (ถ้ามี)"
          confirmText={confirming ? 'กำลังเข้าสู่…' : 'เริ่มแบ่งสตอรี่บอร์ด'}
          onCancel={() => {
            if (!confirming) setEnterSkillOpen(false)
          }}
          onConfirm={(skillIds) => void startEnterWithSkills(skillIds)}
        />
      </>
    )
  }
  return (
    <div className="drama-outline drama-outline-v2">
      {directory}
      <div className="drama-outline-main">{editableBodies}</div>
      <FragmentPlanSkillModal
        open={enterSkillOpen}
        title="เข้าสู่สตอรี่บอร์ด"
        message="ระบบจะยืนยันบทถ่ายทำของตอนนี้และเริ่มแบ่งช็อต สามารถเลือกใช้ Skill ได้ โดยหลังจากยืนยันจะเขียนทับสตอรี่บอร์ดและช็อตเดิม (ถ้ามี)"
        confirmText={confirming ? 'กำลังเข้าสู่…' : 'เริ่มแบ่งสตอรี่บอร์ด'}
        onCancel={() => {
          if (!confirming) setEnterSkillOpen(false)
        }}
        onConfirm={(skillIds) => void startEnterWithSkills(skillIds)}
      />
    </div>
  )
}
