import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { request, type Handoff } from './api'
import { internalReturn, PageHeading, withReturn } from './ui'
import Button from '../../components/ui/Button'
import DramaPublishModal from './DramaPublishModal'

type ProjectSource = { id: number; title: string; updated_at: string; has_cover: boolean; status: string }
type DramaSource = { id: number; title: string; episodes: { id: number; name: string; ready: boolean }[] }
type SeriesOption = { id: number; title: string }
type SeriesStep = { id: number; mode: 'pick' | 'existing' }

// 选了ละครสั้น之后，再决定สร้างใหม่一部，或加入已有ละครสั้น。
function SeriesStepPanel({ series, busy, mode, onCreate, onExisting, onJoin }: {
  series: SeriesOption[]
  busy: boolean
  mode: 'pick' | 'existing'
  onCreate: () => void
  onExisting: () => void
  onJoin: (id: number) => void
}) {
  const [existingId, setExistingId] = useState('')
  return <div className="pf-market-series-step">
    <p>这部成片会作为ละครสั้น的一集，不改已经发布过的旧版本。</p>
    {mode === 'pick' ? <div>
      <Button type="button" variant="lime" disabled={busy} onClick={onCreate}>สร้างใหม่ละครสั้น</Button>
      <button type="button" disabled={busy} onClick={onExisting}>加入已有ละครสั้น</button>
    </div> : series.length === 0 ? <div>
      <p>还没有ละครสั้น，请สร้างใหม่。</p>
      <Button type="button" variant="lime" disabled={busy} onClick={onCreate}>สร้างใหม่ละครสั้น</Button>
    </div> : <div>
      <label>已有ละครสั้น<select value={existingId} onChange={event => setExistingId(event.target.value)} disabled={busy}><option value="">请เลือกละครสั้น</option>{series.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <button type="button" disabled={busy || !existingId} onClick={() => onJoin(Number(existingId))}>เพิ่ม到这部ละครสั้น</button>
    </div>}
  </div>
}

// 从 PrintFilm 已生成成片发起转存。页面只ส่ง编号，不ส่งวิดีโอ地址。
export default function FromPrintfilm() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const focusProject = Number(search.get('project') || 0)
  const focusDrama = Number(search.get('drama') || 0)
  const focusEpisode = Number(search.get('episode') || 0)
  const origin = internalReturn(search.get('from'))
  const [projects, setProjects] = useState<ProjectSource[]>([])
  const [dramas, setDramas] = useState<DramaSource[]>([])
  const [series, setSeries] = useState<SeriesOption[]>([])
  const [dramaId, setDramaId] = useState(focusDrama ? String(focusDrama) : '')
  const [dramaPublishOpen, setDramaPublishOpen] = useState(Boolean(focusDrama))
  const [seriesStep, setSeriesStep] = useState<SeriesStep | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stop = false
    Promise.all([
      request<{ projects: ProjectSource[]; dramas: DramaSource[] }>('/printfilm/sources'),
      request<{ items: SeriesOption[] }>('/mine/series?page_size=100'),
    ]).then(([sources, mine]) => {
      if (stop) return
      setProjects(sources.projects)
      setDramas(sources.dramas)
      setSeries(mine.items)
      setDramaId(current => current || (sources.dramas[0] ? String(sources.dramas[0].id) : ''))
    }).catch(err => { if (!stop) setError((err as Error).message) }).finally(() => { if (!stop) setLoading(false) })
    return () => { stop = true }
  }, [])

  const drama = dramas.find(item => String(item.id) === dramaId)
  const focused = useMemo(() => projects.find(item => item.id === focusProject), [projects, focusProject])

  async function publishWork(project: ProjectSource) {
    setBusy(true); setError('')
    try {
      const handoff = await request<Handoff>('/works/from-printfilm', 'POST', {
        project_id: project.id,
        idempotency_key: `kepu-${project.id}-${project.updated_at}`,
      })
      navigate(withReturn(`/marketplace/works/${handoff.work_id}/edit?handoff=${handoff.id}`, origin))
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  async function addProject(project: ProjectSource, target: 'new' | number) {
    setBusy(true); setError('')
    try {
      const seriesTarget = target === 'new' ? (await request<SeriesOption>('/series', 'POST', {
        title: project.title || '未命名ละครสั้น', category: '其他', sale_type: 'copyright_contact', copyright_price_fen: 0, description: '',
      })).id : target
      const result = await request<{ handoffs: Handoff[] }>(`/series/${seriesTarget}/episodes/import-printfilm`, 'POST', {
        project_id: project.id,
        idempotency_key: `kepu-${project.id}-${project.updated_at}`,
      })
      const handoff = result.handoffs[0]
      navigate(withReturn(`/marketplace/series/${seriesTarget}/edit${handoff ? `?handoff=${handoff.id}` : ''}`, origin))
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  if (loading) return <p role="status">正在读取已生成的成片…</p>
  const heading = <PageHeading title="เผยแพร่สู่ตลาดดิจิทัลแอสเซท" description={focusProject ? '这部成片可以发布为单วิดีโอ，或作为一集加入ละครสั้น。同步后补充资料并ส่ง审核。' : 'เลือก PrintFilm 已生成的成片，同步到市场后补充资料并ส่ง审核。已签署有效授权函的账号会自动关联，未签署的请在ส่ง前เสร็จสิ้น一次签署。'} back="/marketplace/works/new" backLabel="กลับ发布作品" />
  if (focusProject) return <>
    {heading}
    {error && <p role="alert">{error}</p>}
    <section className="pf-market-form">
      <h2>{focused?.title || '当前成片'}</h2>
      {focused ? <>
        <p className="pf-market-notice">先เลือก发布成一条วิดีโอ，或作为一集放进ละครสั้น。</p>
        <div className="pf-market-publish-actions">
          <Button variant="lime" type="button" disabled={busy} onClick={() => void publishWork(focused)}>发布为单วิดีโอ</Button>
          <button type="button" disabled={busy} onClick={() => setSeriesStep({ id: focused.id, mode: 'pick' })}>发布为ละครสั้น</button>
        </div>
        {seriesStep?.id === focused.id && <SeriesStepPanel series={series} busy={busy} mode={seriesStep.mode} onCreate={() => void addProject(focused, 'new')} onExisting={() => setSeriesStep({ id: focused.id, mode: 'existing' })} onJoin={id => void addProject(focused, id)} />}
      </> : <p role="status">这部成片还没有生成เสร็จสิ้น，暂时不能发布。</p>}
    </section>
  </>
  return <>
    {heading}
    {error && <p role="alert">{error}</p>}
    <section className="pf-market-form">
      <h2>科普成片</h2>
      <p className="pf-market-notice">每部成片先เลือก发布为单วิดีโอ或ละครสั้น。选ละครสั้น后，再决定สร้างใหม่或加入已有ละครสั้น。</p>
      {projects.length === 0 ? <p>还没有可发布的科普成片。</p> : projects.map(project => <article key={project.id} className="pf-market-handoff">
        <strong>{project.title}</strong>
        <div className="pf-market-publish-actions">
          <Button variant="lime" type="button" disabled={busy} onClick={() => void publishWork(project)}>发布为单วิดีโอ</Button>
          <button type="button" disabled={busy} onClick={() => setSeriesStep({ id: project.id, mode: 'pick' })}>发布为ละครสั้น</button>
        </div>
        {seriesStep?.id === project.id && <SeriesStepPanel series={series} busy={busy} mode={seriesStep.mode} onCreate={() => void addProject(project, 'new')} onExisting={() => setSeriesStep({ id: project.id, mode: 'existing' })} onJoin={id => void addProject(project, id)} />}
      </article>)}
    </section>
    <section className="pf-market-form">
      <h2>ละครซีรีส์分集</h2>
      <p className="pf-market-notice">只同步勾选的完整分集。เสร็จสิ้น后，在ละครสั้นแก้ไข页补充封面、价格和作品介绍，再ส่ง审核；有效账号授权函会自动关联。</p>
      {dramas.length === 0 ? <p>还没有可导入的ละครซีรีส์分集。</p> : <>
        <label>โปรเจกต์ละครซีรีส์<select value={dramaId} onChange={event => setDramaId(event.target.value)}>{dramas.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <button type="button" disabled={busy || !drama} onClick={() => setDramaPublishOpen(true)}>เลือก完整分集并发布</button>
      </>}
    </section>
    {dramaPublishOpen && drama && <DramaPublishModal projectId={drama.id} initialEpisodeId={focusEpisode || undefined} onClose={() => setDramaPublishOpen(false)} />}
  </>
}
