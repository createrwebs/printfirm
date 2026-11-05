/** 分 ตอนวิดีโอ步骤：进页规则切分；支持全 ตอน规则重切与单 ตอน AI 分镜 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clapperboard, Film, Layers, Sparkles, Wand2 } from 'lucide-react'
import { dramaApi, resolveDramaMediaUrl, type DramaEpisode } from '../../api/drama'
import { dialog } from '../../lib/dialog'
import { loadDramaEpisodes } from '../../lib/dramaStoryboardNav'
import { readEpisodeSubtitleMode, subtitleModeUsesModelOutput } from '../../lib/dramaSubtitleSettings'
import { FragmentPlanSkillModal } from '../../components/drama/FragmentPlanSkillModal'
import { readFragmentGenerationStatus } from './dramaEpisodeEditUtils'

type EpisodesStepProps = {
  projectId: number
  onError: (m: string) => void
}

type EpisodeSummary = {
  epNo: number
  fragmentCount: number
  videoDone: number
  videoRunning: number
  videoFailed: number
  totalSec: number
  previewUrl: string
  planStatus: string
}

// 读取分 ตอน AI 分镜สถานะ
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

// 汇总单 ตอน分镜与วิดีโอ进度
function summarizeEpisode(ep: DramaEpisode): EpisodeSummary {
  const frags = ep.fragments || []
  const activeFragmentIds = new Set<number>()
  for (const task of ep.active_tasks || []) {
    if (
      task.task_type === 'fragment_video' &&
      typeof task.fragment_id === 'number' &&
      !task.cancel_requested &&
      ['pending', 'leased', 'running', 'awaiting_poll', 'awaiting_review'].includes(task.status)
    ) {
      activeFragmentIds.add(task.fragment_id)
    }
  }
  let videoDone = 0
  let videoRunning = 0
  let videoFailed = 0
  let totalSec = 0
  let previewUrl = ''
  for (const frag of frags) {
    totalSec += frag.duration_sec && frag.duration_sec > 0 ? frag.duration_sec : 8
    const st = readFragmentGenerationStatus(frag).status
    if (st === 'done') videoDone += 1
    else if (st === 'queued' || st === 'running' || st === 'generating' || activeFragmentIds.has(frag.id))
      videoRunning += 1
    else if (st === 'failed') videoFailed += 1
    if (!previewUrl) {
      const raw = (frag.cover || frag.video || '').trim()
      if (raw) previewUrl = resolveDramaMediaUrl(raw)
    }
  }
  const epNo = Number(ep.params?.episodeNumber) || 0
  return {
    epNo,
    fragmentCount: frags.length,
    videoDone,
    videoRunning,
    videoFailed,
    totalSec,
    previewUrl,
    planStatus: readPlanStatus(ep),
  }
}

// ชื่อเรื่องของตอน竖排展示用（过长截断）
function verticalTitleLabel(name: string, max = 14): string {
  const clean = (name || '').replace(/\s+/g, '')
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

// เรนเดอร์分 ตอนวิดีโอ步骤
export function EpisodesStep({ projectId, onError }: EpisodesStepProps) {
  const navigate = useNavigate()
  const [episodes, setEpisodes] = useState<DramaEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [reseeding, setReseeding] = useState(false)
  const [planningId, setPlanningId] = useState<number | null>(null)
  // planTarget 待确认 AI 分镜的分 ตอน
  const [planTarget, setPlanTarget] = useState<DramaEpisode | null>(null)
  const seeded = useRef(false)

  useEffect(() => {
    seeded.current = false
  }, [projectId])

  // 进页只读已有分 ตอน；force 才按剧本重切
  async function loadEpisodes(force = false) {
    const rows = await loadDramaEpisodes(projectId, force)
    setEpisodes(rows)
    return rows
  }

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function enter(initial: boolean) {
      if (initial) setLoading(true)
      try {
        let rows: DramaEpisode[]
        if (initial && !seeded.current) {
          seeded.current = true
          rows = await loadEpisodes(false)
        } else {
          rows = await dramaApi.listEpisodes(projectId)
          if (!cancelled) setEpisodes(rows)
        }
        if (cancelled) return
        const anyPlanning = rows.some((ep) => readPlanStatus(ep) === 'generating')
        if (anyPlanning) {
          timer = window.setTimeout(() => {
            void enter(false)
          }, 2500)
        }
      } catch (err) {
        if (initial) onError(err instanceof Error ? err.message : 'โหลดรายการตอนไม่สำเร็จ')
        try {
          const rows = await dramaApi.listEpisodes(projectId)
          if (!cancelled) setEpisodes(rows)
        } catch {
          /* ignore */
        }
      } finally {
        if (initial && !cancelled) setLoading(false)
      }
    }
    void enter(true)
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [projectId, onError])

  async function handleReseed() {
    if (reseeding || planningId != null) return
    const ok = await dialog.confirm({
      title: 'แบ่งสตอรี่บอร์ดทั้งหมดตามกฎใหม่',
      message:
        'ระบบจะแบ่งสตอรี่บอร์ดของทุกตอนใหม่ทั้งหมดตามกฎเกณฑ์อย่างรวดเร็ว (รวมถึงตอนที่แก้ไขหรือสร้างวิดีโอแล้ว) หากต้องการแบ่งแบบละเอียดเฉพาะตอนกรุณาใช้ «AI แบ่งสตอรี่บอร์ด» ต้องการดำเนินการต่อหรือไม่?',
      confirmText: 'ดำเนินการแบ่งใหม่',
      tone: 'danger',
    })
    if (!ok) return
    setReseeding(true)
    try {
      const rows = await loadEpisodes(true)
      await dialog.alert({
        title: 'แบ่งสตอรี่บอร์ดเสร็จสิ้น',
        message: `อัปเดตสตอรี่บอร์ดของ ${rows.length} ตอนเรียบร้อยแล้ว สามารถกดแก้ไขเพื่อดูรายละเอียดของแต่ละตอนได้`, 
        tone: 'success',
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'แบ่งสตอรี่บอร์ดใหม่ไม่สำเร็จ')
    } finally {
      setReseeding(false)
    }
  }

  // 打开 AI 分镜确认弹窗（勾选 Skill）
  function handlePlanEpisode(ep: DramaEpisode) {
    if (reseeding || planningId != null) return
    setPlanTarget(ep)
  }

  // 入队单 ตอน LLM 分镜并轮询（คำบรรยาย (ซับไตเติล)方式沿用该 ตอน当前ตั้งค่า）
  async function startPlanEpisode(ep: DramaEpisode, skillIds: number[]) {
    setPlanTarget(null)
    setPlanningId(ep.id)
    try {
      const subtitleMode = readEpisodeSubtitleMode(ep.params)
      await dramaApi.planEpisodeFragments(ep.id, {
        force: true,
        fallback_rules: true,
        skill_ids: skillIds,
        subtitle_enabled: subtitleModeUsesModelOutput(subtitleMode),
      })
      const started = Date.now()
      while (Date.now() - started < 10 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2500))
        const cur = await dramaApi.getEpisode(ep.id)
        const st = readPlanStatus(cur)
        if (st === 'completed') {
          setEpisodes((prev) => prev.map((row) => (row.id === cur.id ? cur : row)))
          const count = Number(cur.params?.fragment_plan_count) || (cur.fragments || []).length
          const mode = String(cur.params?.fragment_plan_mode || 'llm')
          await dialog.alert({
            title: 'แบ่งสตอรี่บอร์ดเสร็จสิ้น',
            message:
              mode === 'rules_fallback'
                ? `«${cur.name}» ใช้การแบ่งตามกฎเกณฑ์แทน รวม ${count} ช็อต`
                : `«${cur.name}» AI แบ่งสตอรี่บอร์ดเสร็จสิ้น รวม ${count} ช็อต`, 
            tone: 'success',
          })
          return
        }
        if (st === 'failed') {
          throw new Error(String(cur.params?.fragment_plan_error || 'AI แบ่งสตอรี่บอร์ดล้มเหลว'))
        }
      }
      throw new Error('AI แบ่งสตอรี่บอร์ดเกินเวลาที่กำหนด กรุณารีเฟรชในภายหลัง')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'AI แบ่งสตอรี่บอร์ดล้มเหลว')
    } finally {
      setPlanningId(null)
    }
  }

  const totalFragments = episodes.reduce((n, ep) => n + (ep.fragments?.length || 0), 0)
  const totalVideos = episodes.reduce(
    (n, ep) =>
      n + (ep.fragments || []).filter((f) => readFragmentGenerationStatus(f).status === 'done').length,
    0,
  )

  return (
    <div className="drama-episodes-step">
      <header className="drama-episodes-hero">
        <div className="drama-episodes-hero-main">
          <div className="drama-episodes-hero-icon" aria-hidden>
            <Film size={22} strokeWidth={1.75} />
          </div>
          <div>
            <h2>วิดีโอแต่ละตอน</h2>
            <p className="drama-episodes-hero-sub">
              รวม <strong>{episodes.length}</strong> ตอน ·{' '}
              <strong>{totalFragments}</strong> ช็อต · สร้างวิดีโอแล้ว{' '}
              <strong>{totalVideos}</strong>
            </p>
          </div>
        </div>
        <div className="drama-episodes-hero-actions">
          <button
            type="button"
            className="drama-btn-ghost drama-episodes-reseed-btn"
            disabled={reseeding || planningId != null || loading}
            onClick={() => void handleReseed()}
          >
            <Layers size={16} strokeWidth={1.75} aria-hidden />
            {reseeding ? 'กำลังแบ่ง…' : 'แบ่งตามกฎทั้งหมด'}
          </button>
        </div>
      </header>

      <div className="drama-episodes-tips" role="note">
        <Sparkles size={15} strokeWidth={1.75} aria-hidden />
        <span>สามารถกด <strong>AI แบ่งสตอรี่บอร์ด</strong> ในแต่ละตอนเพื่อวางแผนอย่างละเอียด หรือกด <strong>แก้ไข</strong> เพื่อปรับแก้บทและสร้างวิดีโอ</span>
      </div>

      {loading ? (
        <div className="drama-episode-grid" aria-busy="true" aria-label="กำลังโหลดรายการตอน">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="drama-ep-card drama-ep-card-skeleton" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <div className="drama-episodes-empty">
          <Clapperboard size={40} strokeWidth={1.25} aria-hidden />
          <p>ยังไม่มีตอน กรุณาเขียนบทละครแต่ละตอนให้เสร็จก่อน</p>
        </div>
      ) : (
        <div className="drama-episode-grid">
          {episodes.map((ep) => {
            const summary = summarizeEpisode(ep)
            const planning = planningId === ep.id || summary.planStatus === 'generating'
            const progress =
              summary.fragmentCount > 0
                ? Math.round((summary.videoDone / summary.fragmentCount) * 100)
                : 0
            const epLabel =
              summary.epNo > 0 ? `ตอนที่ ${summary.epNo}` : `ตอน ${ep.id}`
            const statusLabel = planning
              ? 'AI กำลังแบ่งสตอรี่บอร์ด…'
              : summary.planStatus === 'failed'
                ? 'แบ่งสตอรี่บอร์ดล้มเหลว'
                : summary.videoRunning > 0
                  ? `กำลังสร้าง ${summary.videoRunning} ช็อต`
                  : summary.videoFailed > 0
                    ? `ล้มเหลว ${summary.videoFailed} ช็อต`
                    : summary.videoDone > 0
                      ? `สร้างวิดีโอแล้ว ${summary.videoDone}/${summary.fragmentCount}`
                      : summary.planStatus === 'completed'
                        ? `${summary.fragmentCount} ช็อต`
                        : summary.fragmentCount > 0
                          ? `${summary.fragmentCount} ช็อต`
                          : 'รอ AI แบ่งสตอรี่บอร์ด'

            return (
              <article
                key={ep.id}
                className={`drama-ep-card${planning ? ' is-planning' : ''}${
                  summary.videoRunning > 0 ? ' is-generating' : ''
                }`}
              >
                <button
                  type="button"
                  className="drama-ep-card-poster"
                  onClick={() => navigate(`/drama/projects/${projectId}/episodes/${ep.id}`)}
                  aria-label={`แก้ไข ${ep.name}`}
                >
                  {summary.previewUrl ? (
                    <img src={summary.previewUrl} alt="" className="drama-ep-card-poster-img" />
                  ) : (
                    <div className="drama-ep-card-poster-fallback">
                      <span className="drama-ep-card-poster-vertical">
                        {verticalTitleLabel(ep.name)}
                      </span>
                    </div>
                  )}
                  <span className="drama-ep-card-ep-badge">{epLabel}</span>
                  {summary.previewUrl ? (
                    <span className="drama-ep-card-play" aria-hidden>
                      <Film size={18} strokeWidth={1.75} />
                    </span>
                  ) : null}
                  {summary.videoRunning > 0 ? (
                    <span className="drama-ep-card-busy" aria-hidden />
                  ) : null}
                </button>

                <div className="drama-ep-card-body">
                  <h3 className="drama-ep-card-title">{ep.name}</h3>
                  <div className="drama-ep-card-meta">
                    <span className="drama-ep-card-meta-item">
                      <Layers size={14} strokeWidth={1.75} aria-hidden />
                      {statusLabel}
                    </span>
                    {summary.totalSec > 0 ? (
                      <span className="drama-ep-card-meta-item">
                        <Clapperboard size={14} strokeWidth={1.75} aria-hidden />
                        ประมาณ {summary.totalSec} วินาที
                      </span>
                    ) : null}
                  </div>
                  {summary.fragmentCount > 0 ? (
                    <div className="drama-ep-card-progress" aria-hidden>
                      <div
                        className="drama-ep-card-progress-bar"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="drama-ep-card-actions">
                  <button
                    type="button"
                    className="drama-ep-card-ai-btn"
                    disabled={reseeding || planningId != null}
                    onClick={() => void handlePlanEpisode(ep)}
                  >
                    <Wand2 size={15} strokeWidth={1.75} aria-hidden />
                    {planning ? 'AI กำลังแบ่งสตอรี่บอร์ด…' : 'AI แบ่งสตอรี่บอร์ด'}
                  </button>
                  <button
                    type="button"
                    className="drama-btn-primary drama-ep-card-edit-btn"
                    disabled={planning}
                    onClick={() => navigate(`/drama/projects/${projectId}/episodes/${ep.id}`)}
                  >
                    แก้ไข
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <FragmentPlanSkillModal
        open={planTarget != null}
        message={`ระบบจะเรียกโมเดล AI เพื่อวางแผนสตอรี่บอร์ดของ «${planTarget?.name || ''}» ใหม่ (จะเขียนทับสตอรี่บอร์ดและวิดีโอเดิมของตอนนี้) ปกติใช้เวลาประมาณ 10-30 วินาที สามารถเลือกทักษะที่ต้องการใช้ได้ รูปแบบซับไตเติลจะใช้ตามการตั้งค่าปัจจุบันของตอนนี้`}
        onCancel={() => setPlanTarget(null)}
        onConfirm={(skillIds) => {
          if (planTarget) void startPlanEpisode(planTarget, skillIds)
        }}
      />
    </div>
  )
}
