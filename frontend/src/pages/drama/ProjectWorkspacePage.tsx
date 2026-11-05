import { useTeamEditLock } from '../../features/teams/useTeamEditLock'
import { isRequestAborted } from '../../api/http'
/** โปรเจกต์ละครซีรีส์工作流：โครงเรื่องหลัก → 分镜 → สร้างวิดีโอ；แอสเซท库为独立入口 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Boxes, ChevronLeft } from 'lucide-react'
import { DramaErrorNotice } from './DramaStatusNotice'
import AppShell from '../../components/layout/AppShell'
import { dramaApi, type DramaProject } from '../../api/drama'
import {
  getInitialProjectStep,
  isEpisodesRouteStep,
  isProjectStepKey,
  normalizeWorkspaceStep,
  type ProjectStepKey,
  type WorkspaceLocationState,
} from '../../lib/dramaProjectSteps'
import { formatDramaUsageBrief } from '../../lib/dramaUsage'
import { resolveStoryboardPath } from '../../lib/dramaStoryboardNav'
import { isCanvasWorkflow } from '../../lib/dramaWorkflow'
import { AssetsStep } from './AssetsStep'
import { OutlineStep } from './OutlineStep'
import RequireAuth from './RequireAuth'
import './drama.css'

export default function ProjectWorkspacePage() {
  return (
    <RequireAuth>
      <WorkspaceInner />
    </RequireAuth>
  )
}

// โปรเจกต์เวิร์กสเตชัน主体
function WorkspaceInner() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const navigate = useNavigate()
  const location = useLocation()
  /*
   * project โปรเจกต์รายละเอียด
   * activeStep 当前步骤（โครงร่าง / 分 ตอน）
   * assetsOpen แอสเซท库独立视图
   * titleDraft 可แก้ไข标题
   * editingTitle 是否在แก้ไข标题
   * loading / error 加载态
   */
  const [project, setProject] = useState<DramaProject | null>(null)
  const [activeStep, setActiveStep] = useState<ProjectStepKey>('outline')
  const [assetsOpen, setAssetsOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const locationApplied = useRef(false)
  const titleLock = useTeamEditLock({ projectId: id, type: 'structure', resourceId: 0 }, editingTitle, async (isCurrent) => { const fresh = await dramaApi.getProject(id); if (isCurrent()) { setProject(fresh); setTitleDraft(fresh.title) } })

  // 应用路由 state：assets / 分镜类步骤跳转
  function applyLocationState(state: WorkspaceLocationState | null) {
    const normalized = normalizeWorkspaceStep(state?.activeStep || state?.returnStep)
    if (normalized === 'assets' || state?.activeStep === 'assets') {
      setAssetsOpen(true)
      return
    }
    if (normalized && isEpisodesRouteStep(normalized)) {
      void resolveStoryboardPath(id)
        .then((path) => navigate(path, { replace: true }))
        .catch((err) => { if (!isRequestAborted(err)) setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่สตอรี่บอร์ดได้') })
      return
    }
    if (normalized && isProjectStepKey(normalized)) {
      setAssetsOpen(false)
      setActiveStep(normalized)
    }
  }

  // 加载โปรเจกต์；自由画布โปรเจกต์强制เข้าสู่画布页
  async function reload() {
    const p = await dramaApi.getProject(id)
    if (isCanvasWorkflow(p)) {
      navigate(`/drama/projects/${id}/canvas`, { replace: true })
      return null
    }
    setProject(p)
    setTitleDraft(p.title)
    setError('')
    return p
  }

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return
    setLoading(true)
    setError('')
    reload()
      .then((p) => {
        if (!p) return
        if (!locationApplied.current) {
          const state = location.state as WorkspaceLocationState | null
          if (state?.activeStep || state?.returnStep) applyLocationState(state)
          else {
            const initial = getInitialProjectStep(Boolean(p.script))
            if (isEpisodesRouteStep(initial)) {
              void resolveStoryboardPath(id)
                .then((path) => navigate(path, { replace: true }))
                .catch((err) => { if (!isRequestAborted(err)) setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่สตอรี่บอร์ดได้') })
              return
            }
            setActiveStep(initial)
          }
          locationApplied.current = true
        }
      })
      .catch((err) => { if (!isRequestAborted(err)) setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ') })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    applyLocationState(location.state as WorkspaceLocationState | null)
  }, [location.state])

  // 切换步骤时รีเฟรช用量（生图/生วิดีโอ后顶栏数字同步）
  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0 || loading || !project) return
    void dramaApi
      .getProject(id)
      .then((p) => {
        setProject((prev) => (prev ? { ...prev, usage: p.usage } : p))
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随视图变化รีเฟรช
  }, [activeStep, assetsOpen, id])

  // บันทึก标题
  async function saveTitle() {
    const next = titleDraft.trim()
    if (!next || !project) {
      setEditingTitle(false)
      setTitleDraft(project?.title || '')
      return
    }
    try {
      const updated = await dramaApi.updateProject(id, { title: next })
      setProject(updated)
      setTitleDraft(updated.title)
    } catch (err) {
      if (isRequestAborted(err)) return
      setError(err instanceof Error ? err.message : 'บันทึกชื่อเรื่องไม่สำเร็จ')
    } finally {
      setEditingTitle(false)
    }
  }

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <AppShell active="drama" flush>
        <div className="drama-workspace-status">รหัสโปรเจกต์ไม่ถูกต้อง</div>
      </AppShell>
    )
  }

  if (loading) {
    return (
      <AppShell active="drama" flush>
        <div className="drama-workspace-status">กำลังโหลด…</div>
      </AppShell>
    )
  }

  if (error && !project) {
    return (
      <AppShell active="drama" flush>
        <div className="drama-workspace-status drama-error">{error}</div>
      </AppShell>
    )
  }

  if (!project) {
    return (
      <AppShell active="drama" flush>
        <div className="drama-workspace-status">ไม่พบโปรเจกต์</div>
      </AppShell>
    )
  }

  return (
    <AppShell active="drama" flush wide>
      <div className="drama-workspace">
        <header className="drama-workspace-top">
          <div className="drama-workspace-top-left">
            <button
              type="button"
              className="drama-icon-btn"
              aria-label="กลับ"
              onClick={() => navigate(project.team_id ? `/teams/${project.team_id}?tab=projects` : '/drama/dramas')}
            >
              <ChevronLeft size={20} strokeWidth={1.75} />
            </button>
            {editingTitle ? (
              <input
                className="drama-title-input"
                disabled={titleLock.readOnly}
                value={titleDraft}
                autoFocus
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveTitle()
                  if (e.key === 'Escape') {
                    setTitleDraft(project.title)
                    setEditingTitle(false)
                  }
                }}
              />
            ) : (
              <button type="button" className="drama-title-display" onClick={() => setEditingTitle(true)}>
                {project.title}
              </button>
            )}
          </div>

          <div className="drama-workspace-top-right">
            {project.usage ? (
              <span className="drama-usage-chip" title="ค่าใช้จ่ายสะสมและจำนวนครั้งที่สร้างในเรื่องนี้">
                {formatDramaUsageBrief(project.usage)}
              </span>
            ) : null}
            <button
              type="button"
              className={`drama-assets-entry-btn${assetsOpen ? ' is-active' : ''}`}
              onClick={() => setAssetsOpen((open) => !open)}
            >
              <Boxes size={15} strokeWidth={2} aria-hidden />
              คลังแอสเซท
            </button>
          </div>
        </header>

        {titleLock.error && <p role="alert" className="pf-team-alert">{titleLock.error}<button type="button" onClick={titleLock.retry}>ขอสิทธิ์แก้ไขใหม่อีกครั้ง</button></p>}
        {error ? <DramaErrorNotice message={error} className="drama-workspace-alert" onDismiss={() => setError('')} /> : null}

        <main className="drama-workspace-main">
          {assetsOpen ? <AssetsStep projectId={id} onError={setError} /> : null}
          {!assetsOpen && activeStep === 'outline' ? (
            <OutlineStep
              projectId={id}
              project={project}
              onProjectChange={(p) => {
                setProject(p)
                setTitleDraft(p.title)
              }}
              onError={setError}
            />
          ) : null}
        </main>
      </div>
    </AppShell>
  )
}
