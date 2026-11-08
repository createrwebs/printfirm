/** ขั้นตอนโครงเรื่อง: สรุปเรื่องย่ออัตโนมัติ + สายการสร้างบทละคร */
import { isRequestAborted } from '../../api/http'
import { useEffect, useRef, useState } from 'react'
import {
  dramaApi,
  type DramaProject,
  type DramaScript,
} from '../../api/drama'
import { getImageStyleLabel, type ImageStyleId } from '../../lib/dramaImageStyles'
import {
  autoMissingEpisodeCount,
  getAssetsSeedStatus,
  getEpisodeContentStatus,
  getImageStyleId,
  getSummaryStatus,
  hasSubstantialEpisode,
  parseEpisodeBodies,
} from './dramaWorkspaceUtils'
import { dialog } from '../../lib/dialog'
import Modal from '../../components/ui/Modal'
import { DramaImageStyleModal } from './DramaImageStyleModal'
import { DramaProjectSettingsModal } from './DramaProjectSettingsModal'
import { OutlineEpisodePanel } from './OutlineEpisodePanel'
import { useTeamEditLock } from '../../features/teams/useTeamEditLock'

type MetaModalKey = 'source' | 'summary' | 'project'

export type OutlineStepProps = {
  projectId: number
  project: DramaProject
  onProjectChange: (p: DramaProject) => void
  /** 可选：โครงร่าง就绪回调（工作区已不再依赖「ถัดไป」） */
  onOutlineReadyChange?: (ready: boolean) => void
  onError: (msg: string) => void
}

// แสดงขั้นตอนโครงเรื่อง
export function OutlineStep({
  projectId,
  project,
  onProjectChange,
  onOutlineReadyChange,
  onError,
}: OutlineStepProps) {
  const notifyOutlineReady = (ready: boolean) => onOutlineReadyChange?.(ready)
  const [script, setScript] = useState<DramaScript | null>(project.script || null)
  const [metaModal, setMetaModal] = useState<MetaModalKey | null>(null)
  // 进页即按服务端สถานะ展示，避免เรื่องย่อ/分 ตอนกำลังสร้าง外部一片空白
  const [summaryGenerating, setSummaryGenerating] = useState(
    () => getSummaryStatus(project.script || null) === 'generating',
  )
  const [assetsSeeding, setAssetsSeeding] = useState(
    () => getAssetsSeedStatus(project) === 'generating',
  )
  const [episodeGenerating, setEpisodeGenerating] = useState(
    () => getEpisodeContentStatus(project.script || null) === 'generating',
  )
  const [summaryError, setSummaryError] = useState('')
  const [episodeError, setEpisodeError] = useState('')
  const [progress, setProgress] = useState(() => {
    const prog = (project.script?.params || {}).episode_content_progress as
      | { done?: number; total?: number }
      | undefined
    return {
      done: Number(prog?.done) || 0,
      total: Number(prog?.total) || 0,
    }
  })
  const [summaryEditing, setSummaryEditing] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState<Record<string, unknown> | null>(null)
  const [summarySaving, setSummarySaving] = useState(false)
  const [sourceEditing, setSourceEditing] = useState(false)
  const [sourceDraft, setSourceDraft] = useState('')
  const [sourceSaving, setSourceSaving] = useState(false)
  const scriptLock = useTeamEditLock({ projectId, type: 'script', resourceId: 0 }, summaryEditing || sourceEditing, async (isCurrent) => { const fresh = await dramaApi.getScript(projectId); if (isCurrent()) { setScript(fresh); if (summaryEditing) setSummaryDraft(fresh.summary || {}); if (sourceEditing) setSourceDraft(fresh.source || '') } })
  const pipelineRef = useRef(0)
  const projectRef = useRef(project)
  projectRef.current = project

  const summary = (script?.summary || null) as Record<string, unknown> | null
  const summaryStatus = getSummaryStatus(script)
  const episodeStatus = getEpisodeContentStatus(script)
  const assetsSeedStatus = getAssetsSeedStatus(project)
  const episodeCount =
    Number(
      summary?.episodeCount ||
        (script?.params || {}).episode_count ||
        project.params?.episode_count,
    ) || 0
  const imageStyleId = getImageStyleId(script, project)

  function openSourceModal() {
    setSourceEditing(false)
    setSourceDraft(script?.source || '')
    setMetaModal('source')
  }

  function openSummaryModal() {
    setSummaryEditing(false)
    setMetaModal('summary')
  }

  function closeMetaModal() {
    setMetaModal(null)
    setSourceEditing(false)
    setSummaryEditing(false)
  }

  // ตรวจสอบสถานะบทจนเสร็จสมบูรณ์
  async function pollScriptUntil(
    predicate: (s: DramaScript) => boolean,
    runToken?: number,
  ): Promise<DramaScript | null> {
    const started = Date.now()
    while (Date.now() - started < 45 * 60 * 1000) {
      if (runToken !== undefined && runToken !== pipelineRef.current) return null
      const s = await dramaApi.getScript(projectId)
      setScript(s)
      const prog = (s.params || {}).episode_content_progress as
        | { done?: number; total?: number }
        | undefined
      if (prog && (prog.total || prog.done)) {
        setProgress({
          done: Number(prog.done) || 0,
          total: Number(prog.total) || 0,
        })
      }
      if (predicate(s)) return s
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('หมดเวลารอสร้าง กรุณารีเฟรชแล้วลองใหม่')
  }

  // เข้าคิวและรอสร้างบทสรุปเรื่องย่อ
  async function runSummary(runToken?: number) {
    setSummaryGenerating(true)
    setSummaryError('')
    try {
      const res = await dramaApi.scriptSummary({ project_id: projectId })
      setScript(res.script)
      const finished = await pollScriptUntil((s) => {
        const st = getSummaryStatus(s)
        return st === 'completed' || st === 'failed'
      }, runToken)
      if (!finished) return null
      if (getSummaryStatus(finished) === 'failed') {
        const msg =
          String((finished.params || {}).summary_error || '') || 'สร้างบทสรุปเรื่องย่อไม่สำเร็จ'
        setSummaryError(msg)
        onError(msg)
        throw new Error(msg)
      }
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
      return finished
    } catch (err) {
      if (isRequestAborted(err)) throw err
      const msg = err instanceof Error ? err.message : 'สร้างบทสรุปเรื่องย่อไม่สำเร็จ'
      setSummaryError(msg)
      onError(msg)
      throw err
    } finally {
      setSummaryGenerating(false)
    }
  }

  // รอสกัดแอสเซทหลังสรุปเรื่องย่อเสร็จ
  async function ensureAssetsSeeded(runToken?: number): Promise<boolean> {
    try {
      let p = await dramaApi.getProject(projectId)
      onProjectChange(p)
      let st = getAssetsSeedStatus(p)
      /* เสร็จสมบูรณ์/已ล้มเหลว直接กลับ，不置抽取态，避免进页闪一下“กำลังสกัดแอสเซท”。 */
      if (st === 'done') {
        setAssetsSeeding(false)
        return true
      }
      if (st === 'failed') {
        setAssetsSeeding(false)
        const msg = String((p.params as Record<string, unknown> | undefined)?.assets_seed_error || 'สกัดแอสเซทไม่สำเร็จ')
        setEpisodeError(msg)
        onError(msg)
        return false
      }
      if (st !== 'generating') {
        try {
          await dramaApi.seedAssets(projectId)
        } catch {
          /* 可能已在后台抽取，继续轮询 */
        }
      }
      setAssetsSeeding(true)
      const started = Date.now()
      while (Date.now() - started < 10 * 60 * 1000) {
        if (runToken !== undefined && runToken !== pipelineRef.current) return false
        p = await dramaApi.getProject(projectId)
        onProjectChange(p)
        st = getAssetsSeedStatus(p)
        if (st === 'done') {
          setAssetsSeeding(false)
          return true
        }
        if (st === 'failed') {
          setAssetsSeeding(false)
          const msg = String((p.params as Record<string, unknown> | undefined)?.assets_seed_error || 'สกัดแอสเซทไม่สำเร็จ')
          setEpisodeError(msg)
          onError(msg)
          return false
        }
        setAssetsSeeding(st === 'generating' || !st)
        await new Promise((r) => setTimeout(r, 2000))
      }
      setAssetsSeeding(false)
      const msg = 'หมดเวลารอสกัดแอสเซท กรุณาตรวจสอบสถานะแล้วลองใหม่'
      setEpisodeError(msg)
      onError(msg)
      return false
    } catch {
      setAssetsSeeding(false)
      const msg = 'ตรวจสอบสถานะแอสเซทไม่สำเร็จ'
      setEpisodeError(msg)
      onError(msg)
      return false
    }
  }

  // เข้าคิวและตรวจสอบบทแต่ละตอนจนเสร็จ
  async function runEpisodeScripts(runToken?: number, force = false) {
    setEpisodeGenerating(true)
    setEpisodeError('')
    try {
      const current = await dramaApi.getScript(projectId)
      setScript(current)
      const already = getEpisodeContentStatus(current)
      if (already !== 'generating' || force) {
        const res = await dramaApi.episodeScript({
          project_id: projectId,
          batch_size: 1,
          force,
        })
        setScript(res.script)
        setProgress({ done: res.total_generated, total: res.total_target })
      }
      const finished = await pollScriptUntil((s) => {
        const st = getEpisodeContentStatus(s)
        return st === 'completed' || st === 'failed'
      }, runToken)
      if (!finished) return
      if (getEpisodeContentStatus(finished) === 'failed') {
        const msg =
          String((finished.params || {}).episode_content_error || '') ||
          'สร้างบทละครแต่ละตอนไม่สำเร็จ'
        setEpisodeError(msg)
        onError(msg)
        notifyOutlineReady(false)
        return
      }
      notifyOutlineReady(true)
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
    } catch (err) {
      if (isRequestAborted(err)) return
      const msg = err instanceof Error ? err.message : 'สร้างบทละครแต่ละตอนไม่สำเร็จ'
      setEpisodeError(msg)
      onError(msg)
      notifyOutlineReady(false)
    } finally {
      setEpisodeGenerating(false)
    }
  }

  // บังคับสร้างเนื้อหาทุกตอนใหม่ด้วยตนเอง
  async function handleRegenerateEpisodes() {
    if (episodeGenerating) return
    const ok = await dialog.confirm({
      title: 'สร้างบทละครแต่ละตอนใหม่',
      message:
        'จะล้างเนื้อหาตอนปัจจุบันและสร้างใหม่ตามเรื่องย่อล่าสุด การแก้ไขก่อนหน้าจะสูญหาย ต้องการดำเนินการต่อหรือไม่?',
      confirmText: 'สร้างใหม่',
      tone: 'danger',
    })
    if (!ok) return
    notifyOutlineReady(false)
    await runEpisodeScripts(undefined, true)
  }

  // เริ่มกระบวนการ: สรุปเรื่องย่อ → สกัดแอสเซท → บทแต่ละตอน
  useEffect(() => {
    const token = ++pipelineRef.current
    async function pipeline() {
      let current = script
      let status = getSummaryStatus(current)

      // 1) ต้องสร้างบทสรุปเรื่องย่อให้เสร็จก่อน
      if (status !== 'completed') {
        const epStatusEarly = getEpisodeContentStatus(current)
        const bodiesEarly = parseEpisodeBodies(current)
        if (status === 'failed') {
          const msg =
            String((current?.params || {}).summary_error || '') || 'สร้างบทสรุปเรื่องย่อไม่สำเร็จ'
          setSummaryError(msg)
          onError(msg)
          // ติดตามความคืบหน้าของบทแต่ละตอนต่อเนื่อง
          if (
            epStatusEarly !== 'generating' &&
            epStatusEarly !== 'completed' &&
            !hasSubstantialEpisode(bodiesEarly)
          ) {
            setEpisodeGenerating(false)
            return
          }
        } else {
          try {
            if (status === 'generating') {
              setSummaryGenerating(true)
              current = await pollScriptUntil((s) => {
                const st = getSummaryStatus(s)
                return st === 'completed' || st === 'failed'
              }, token)
              setSummaryGenerating(false)
            } else {
              current = await runSummary(token)
            }
          } catch {
            setSummaryGenerating(false)
            return
          }
          if (!current || token !== pipelineRef.current) return
          status = getSummaryStatus(current)
          if (status === 'failed') {
            const msg =
              String((current.params || {}).summary_error || '') || 'สร้างบทสรุปเรื่องย่อไม่สำเร็จ'
            setSummaryError(msg)
            onError(msg)
            setEpisodeGenerating(false)
            return
          }
          if (status !== 'completed') return
        }
      }

      // 2) สกัดแอสเซทหลังสรุปเรื่องย่อเสร็จ
      if (token !== pipelineRef.current) return
      const assetsReady = await ensureAssetsSeeded(token)
      if (!assetsReady) return
      if (token !== pipelineRef.current) return

      const target =
        Number(
          (current?.summary as Record<string, unknown> | null)?.episodeCount ||
            (current?.params || {}).episode_count ||
            projectRef.current.params?.episode_count,
        ) || 0
      current = await dramaApi.getScript(projectId)
      setScript(current)
      const bodies = parseEpisodeBodies(current)
      const epStatus = getEpisodeContentStatus(current)
      const autoMissing = autoMissingEpisodeCount(bodies, target)
      const complete =
        epStatus !== 'failed' && autoMissing === 0 && hasSubstantialEpisode(bodies)
      if (complete) {
        notifyOutlineReady(true)
        return
      }

      // 3) บทแต่ละตอน: ตรวจสอบสถานะหรือเข้าคิวสร้าง
      if (epStatus === 'generating') {
        setEpisodeGenerating(true)
        const finished = await pollScriptUntil((s) => {
          const st = getEpisodeContentStatus(s)
          return st === 'completed' || st === 'failed'
        }, token)
        setEpisodeGenerating(false)
        if (!finished) return
        if (getEpisodeContentStatus(finished) === 'failed') {
          const msg =
            String((finished.params || {}).episode_content_error || '') ||
            'สร้างบทละครแต่ละตอนไม่สำเร็จ'
          setEpisodeError(msg)
          onError(msg)
          notifyOutlineReady(false)
          return
        }
        notifyOutlineReady(true)
        const p = await dramaApi.getProject(projectId)
        onProjectChange(p)
        return
      }
      await runEpisodeScripts(token)
    }
    void pipeline()
    return () => {
      pipelineRef.current += 1
      notifyOutlineReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // อัปเดตสไตล์ภาพ
  async function handleStyleChange(styleId: string) {
    try {
      const updated = await dramaApi.updateScript(projectId, {
        image_style_id: styleId || undefined,
      })
      setScript(updated)
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
    } catch (err) {
      if (isRequestAborted(err)) return
      onError(err instanceof Error ? err.message : 'อัปเดตสไตล์ล้มเหลว')
    }
  }

  // เข้าสู่สรุปเรื่องย่อแก้ไข
  function startSummaryEdit() {
    if (!summary) return
    setSummaryDraft(structuredClone(summary) as Record<string, unknown>)
    setSummaryEditing(true)
  }

  // บันทึกด้วยตนเองแก้ไข的สรุปเรื่องย่อ
  async function saveSummaryEdit() {
    if (!summaryDraft) return
    setSummarySaving(true)
    try {
      const updated = await dramaApi.updateScript(projectId, { summary: summaryDraft })
      setScript(updated)
      setSummaryEditing(false)
      setSummaryDraft(null)
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
    } catch (err) {
      if (isRequestAborted(err)) return
      onError(err instanceof Error ? err.message : 'เรื่องย่อบันทึกไม่สำเร็จ')
    } finally {
      setSummarySaving(false)
    }
  }

  const characters = Array.isArray(summary?.characters)
    ? (summary.characters as Array<Record<string, unknown>>)
    : []

  async function saveSourceEdit() {
    setSourceSaving(true)
    try {
      const updated = await dramaApi.updateScript(projectId, { source: sourceDraft })
      setScript(updated)
      setSourceEditing(false)
    } catch (err) {
      if (isRequestAborted(err)) return
      onError(err instanceof Error ? err.message : 'แนวคิดบันทึกไม่สำเร็จ')
    } finally {
      setSourceSaving(false)
    }
  }

  return (
    <div className="drama-outline-page">
      <div className="drama-outline-toolbar">
        <div className="drama-outline-toolbar-left">
          <DramaImageStyleModal
            variant="field"
            fieldLabel="สไตล์ภาพของโปรเจกต์"
            title="เลือกสไตล์ภาพของโปรเจกต์"
            emptyLabel="ยังไม่ได้เลือก"
            value={(imageStyleId as ImageStyleId | '') || ''}
            onChange={(id) => void handleStyleChange(id)}
          />
          <span className="drama-outline-toolbar-meta">
            {episodeCount ? `ทั้งหมด ${episodeCount} ตอน` : 'รอกำหนดจำนวนตอน'}
            {summaryGenerating || summaryStatus === 'generating'
              ? ' · สรุปเรื่องย่อทั้งเรื่องกำลังสร้าง…'
              : assetsSeeding || assetsSeedStatus === 'generating'
                ? ' · กำลังสกัดแอสเซท…'
                : episodeGenerating || episodeStatus === 'generating'
                  ? progress.total > 0
                    ? ` · ความคืบหน้าของเรื่อง ${progress.done}/${progress.total}`
                    : ' · บทละครแต่ละตอนกำลังสร้าง…'
                  : ''}
          </span>
        </div>
        <div className="drama-outline-toolbar-actions">
          <button
            type="button"
            className={`drama-outline-chip-btn${metaModal === 'source' ? ' is-on' : ''}`}
            onClick={openSourceModal}
          >
            แนวคิดเรื่องย่อทั้งหมด
          </button>
          <button
            type="button"
            className={`drama-outline-chip-btn${metaModal === 'project' ? ' is-on' : ''}`}
            onClick={() => setMetaModal('project')}
          >
            การตั้งค่าโปรเจกต์
          </button>
          <button
            type="button"
            className={`drama-outline-chip-btn${metaModal === 'summary' ? ' is-on' : ''}`}
            onClick={openSummaryModal}
          >
            การตั้งค่าทั่วไป
          </button>
          {(episodeError || episodeStatus === 'failed') && (
            <button type="button" className="drama-outline-chip-btn" onClick={() => void handleRegenerateEpisodes()}>
              รันใหม่ทุกตอน
            </button>
          )}
        </div>
      </div>

      <Modal
        open={metaModal === 'source'}
        onClose={closeMetaModal}
        title="แนวคิดเรื่องย่อทั้งหมด"
        size="lg"
        className="drama-outline-meta-modal"
        footer={
          sourceEditing ? (
            <>
              <button type="button" className="drama-btn-ghost" onClick={() => setSourceEditing(false)}>
                ยกเลิกการแก้ไข
              </button>
              <button
                type="button"
                className="drama-btn-primary"
                disabled={sourceSaving || scriptLock.readOnly}
                onClick={() => void saveSourceEdit()}
              >
                {sourceSaving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="drama-btn-ghost"
              onClick={() => {
                setSourceDraft(script?.source || '')
                setSourceEditing(true)
              }}
            >
              แก้ไข
            </button>
          )
        }
      >
        <div className="drama-outline-meta-modal-body">
          {scriptLock.readOnly && <p className="pf-team-alert" role="status">{scriptLock.checking ? 'กำลังตรวจสอบสิทธิ์การแก้ไข…' : scriptLock.error}<button type="button" onClick={scriptLock.retry}>รับสิทธิ์การแก้ไขอีกครั้งและรีเฟรช</button></p>}
        {sourceEditing ? (
            <textarea
              className="drama-ep-section-textarea"
              rows={16}
              value={sourceDraft}
              onChange={(e) => setSourceDraft(e.target.value)}
            />
          ) : (
            <p className="drama-pre">{script?.source?.trim() || 'ยังไม่มีเรื่องย่อทั้งหมด'}</p>
          )}
        </div>
      </Modal>

      <Modal
        open={metaModal === 'summary'}
        onClose={closeMetaModal}
        title="การตั้งค่าทั่วไป"
        size="lg"
        className="drama-outline-meta-modal"
        footer={
          summaryEditing ? (
            <>
              <button type="button" className="drama-btn-ghost" onClick={() => setSummaryEditing(false)}>
                ยกเลิกการแก้ไข
              </button>
              <button
                type="button"
                className="drama-btn-primary"
                disabled={summarySaving || scriptLock.readOnly}
                onClick={() => void saveSummaryEdit()}
              >
                {summarySaving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </>
          ) : summary && summaryStatus === 'completed' ? (
            <button type="button" className="drama-btn-ghost" onClick={() => startSummaryEdit()}>
              แก้ไข
            </button>
          ) : summaryError || summaryStatus === 'failed' ? (
            <button type="button" className="drama-btn-primary" onClick={() => void runSummary()}>
              สร้างใหม่
            </button>
          ) : null
        }
      >
        <div className="drama-outline-meta-modal-body">
          {scriptLock.readOnly && <p className="pf-team-alert" role="status">{scriptLock.checking ? 'กำลังตรวจสอบสิทธิ์การแก้ไข…' : scriptLock.error}<button type="button" onClick={scriptLock.retry}>รับสิทธิ์การแก้ไขอีกครั้งและรีเฟรช</button></p>}
          {summaryGenerating || summaryStatus === 'generating' ? (
            <p className="drama-loader">สรุปเรื่องย่อทั้งเรื่องกำลังสร้าง…</p>
          ) : null}
          {summaryError || summaryStatus === 'failed' ? (
            <p className="drama-error">{summaryError || 'เรื่องย่อสร้างไม่สำเร็จ'}</p>
          ) : null}
          {summaryEditing && summaryDraft ? (
            <div className="drama-outline-edit">
              <EditableSummaryField
                label="ชื่อเรื่อง"
                value={String(summaryDraft.seriesTitle || '')}
                onChange={(v) =>
                  setSummaryDraft((prev) => (prev ? { ...prev, seriesTitle: v } : prev))
                }
              />
              <EditableSummaryField
                label="กำหนดจำนวนตอนเอง"
                value={String(summaryDraft.episodeCount ?? '')}
                onChange={(v) =>
                  setSummaryDraft((prev) =>
                    prev ? { ...prev, episodeCount: v ? Number(v) || v : '' } : prev,
                  )
                }
              />
              <EditableSummaryField
                label="ประเภทเรื่องราว"
                value={String(summaryDraft.storyType || '')}
                onChange={(v) => setSummaryDraft((prev) => (prev ? { ...prev, storyType: v } : prev))}
              />
              <EditableSummaryField
                label="สรุปเรื่องในหนึ่งประโยค"
                value={String(summaryDraft.oneLineStory || '')}
                onChange={(v) =>
                  setSummaryDraft((prev) => (prev ? { ...prev, oneLineStory: v } : prev))
                }
                multiline
              />
              <EditableSummaryField
                label="เรื่องย่อ"
                value={String(summaryDraft.synopsis || '')}
                onChange={(v) => setSummaryDraft((prev) => (prev ? { ...prev, synopsis: v } : prev))}
                multiline
              />
            </div>
          ) : null}
          {!summaryEditing && summary && summaryStatus === 'completed' ? (
            <div className="drama-summary-structured">
              <SummaryField label="ชื่อเรื่อง" value={String(summary.seriesTitle || '')} />
              <SummaryField label="ประเภทเรื่องราว" value={String(summary.storyType || '')} />
              <SummaryField label="สรุปเรื่องในหนึ่งประโยค" value={String(summary.oneLineStory || '')} />
              <SummaryField label="เรื่องย่อ" value={String(summary.synopsis || '')} />
              {characters.length > 0 ? (
                <section>
                  <h4>ตัวละคร</h4>
                  <p className="drama-muted">
                    {characters.map((ch) => String(ch.name || '')).filter(Boolean).join(', ')}
                  </p>
                </section>
              ) : null}
            </div>
          ) : null}
          {!summaryEditing && !summary && summaryStatus !== 'generating' && !summaryError ? (
            <p className="drama-muted">ยังไม่มีการตั้งค่าส่วนกลาง กำลังรอสร้างเรื่องย่อหรือคลิกสร้างใหม่</p>
          ) : null}
        </div>
      </Modal>

      <DramaProjectSettingsModal
        open={metaModal === 'project'}
        projectId={projectId}
        project={project}
        script={script}
        onClose={closeMetaModal}
        onProjectChange={onProjectChange}
        onScriptChange={setScript}
        onError={onError}
      />

      {/* 外部ความคืบหน้าของเรื่อง：เรื่องย่อ → แอสเซท → 分 ตอน，主界面可见 */}
      {summaryGenerating ||
      summaryStatus === 'generating' ||
      assetsSeeding ||
      assetsSeedStatus === 'generating' ||
      episodeGenerating ||
      episodeStatus === 'generating' ? (
        <div className="drama-outline-pipeline" role="status" aria-live="polite">
          <div className="drama-outline-pipeline-main">
            <span className="drama-outline-pipeline-pulse" aria-hidden />
            <div>
              <strong>
                {summaryGenerating || summaryStatus === 'generating'
                  ? 'สรุปเรื่องย่อทั้งเรื่องกำลังสร้าง…'
                  : assetsSeeding || assetsSeedStatus === 'generating'
                    ? 'กำลังสกัดแอสเซท…'
                    : progress.total > 0
                      ? `บทละครแต่ละตอนกำลังสร้าง · ความคืบหน้าของเรื่อง ${progress.done}/${progress.total}`
                      : 'บทละครแต่ละตอนกำลังสร้าง…'}
              </strong>
              <p>
                {summaryGenerating || summaryStatus === 'generating'
                  ? 'ลำดับ: สรุปเรื่องย่อทั้งเรื่อง → สกัดแอสเซท → สร้างบทละครแต่ละตอน → แบ่งสตอรี่บอร์ด AI แต่ละตอนทันที'
                  : assetsSeeding || assetsSeedStatus === 'generating'
                    ? 'กำลังสกัดตัวละครและฉากจากเรื่องย่อไปยังคลังแอสเซท เมื่อเสร็จสิ้นจะเริ่มสร้างบทละครแต่ละตอน'
                    : 'เมื่อบทแต่ละตอนสร้างเสร็จ จะดำเนินการแบ่งสตอรี่บอร์ด AI ทันที สามารถดูสถานะได้ที่แถบด้านซ้าย'}
              </p>
            </div>
          </div>
          {!(summaryGenerating || summaryStatus === 'generating') &&
          !(assetsSeeding || assetsSeedStatus === 'generating') &&
          progress.total > 0 ? (
            <div className="drama-outline-pipeline-bar" aria-hidden>
              <div
                className="drama-outline-pipeline-bar-fill"
                style={{
                  width: `${Math.min(100, Math.round((100 * progress.done) / progress.total))}%`,
                }}
              />
            </div>
          ) : (
            <div className="drama-outline-pipeline-bar is-indeterminate" aria-hidden>
              <div className="drama-outline-pipeline-bar-fill" />
            </div>
          )}
        </div>
      ) : null}

      <OutlineEpisodePanel
        projectId={projectId}
        script={script}
        episodeCount={episodeCount}
        summaryReady={summaryStatus === 'completed'}
        summaryGenerating={summaryGenerating || summaryStatus === 'generating'}
        assetsSeeding={assetsSeeding || assetsSeedStatus === 'generating'}
        episodeGenerating={episodeGenerating || episodeStatus === 'generating'}
        episodeProgress={progress}
        imageStyleLabel={getImageStyleLabel(imageStyleId) || undefined}
        storyType={String(summary?.storyType || '') || undefined}
        onScriptChange={setScript}
        onProjectChange={onProjectChange}
        onError={onError}
        onOpenEpisodes={() => undefined}
      />
    </div>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <section className="drama-summary-field">
      <h4>{label}</h4>
      <p className="drama-pre">{value}</p>
    </section>
  )
}

function EditableSummaryField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  return (
    <label className="drama-outline-edit-field">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}
