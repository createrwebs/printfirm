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

// 选了ละครสั้น之后，再决定สร้างใหม่一部，或เพิ่มในซีรีส์สั้นที่มีอยู่。
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
    <p>วิดีโอนี้จะกลายเป็นตอนหนึ่งของซีรีส์สั้น โดยไม่กระทบต่อเวอร์ชันเดิมที่เคยเผยแพร่ไปแล้ว</p>
    {mode === 'pick' ? <div>
      <Button type="button" variant="lime" disabled={busy} onClick={onCreate}>สร้างใหม่ละครสั้น</Button>
      <button type="button" disabled={busy} onClick={onExisting}>เพิ่มในซีรีส์สั้นที่มีอยู่</button>
    </div> : series.length === 0 ? <div>
      <p>ยังไม่มีซีรีส์สั้น กรุณาสร้างใหม่</p>
      <Button type="button" variant="lime" disabled={busy} onClick={onCreate}>สร้างใหม่ละครสั้น</Button>
    </div> : <div>
      <label>ซีรีส์สั้นที่มีอยู่<select value={existingId} onChange={event => setExistingId(event.target.value)} disabled={busy}><option value="">กรุณาเลือกซีรีส์สั้น</option>{series.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <button type="button" disabled={busy || !existingId} onClick={() => onJoin(Number(existingId))}>เพิ่มในซีรีส์สั้นเรื่องนี้</button>
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
        title: project.title || 'ซีรีส์สั้นไม่มีชื่อ', category: 'ทั่วไป', sale_type: 'copyright_contact', copyright_price_fen: 0, description: '',
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
  const heading = <PageHeading title="เผยแพร่สู่ตลาดดิจิทัลแอสเซท" description={focusProject ? 'วิดีโอนี้สามารถเผยแพร่เป็นวิดีโอเดี่ยว หรือเพิ่มเป็นตอนหนึ่งในซีรีส์สั้น หลังจากซิงค์แล้วให้กรอกข้อมูลเพิ่มเติมและส่งตรวจทาน' : 'เลือกวิดีโอที่สร้างจาก PrintFilm เพื่อซิงค์ไปยังตลาดผลงาน กรอกข้อมูลเพิ่มเติมแล้วส่งตรวจทาน บัญชีที่ลงนามมอบอำนาจแล้วจะเชื่อมโยงให้อัตโนมัติ'} back="/marketplace/works/new" backLabel="กลับไปหน้าเผยแพร่ผลงาน" />
  if (focusProject) return <>
    {heading}
    {error && <p role="alert">{error}</p>}
    <section className="pf-market-form">
      <h2>{focused?.title || '当前成片'}</h2>
      {focused ? <>
        <p className="pf-market-notice">เลือกเผยแพร่เป็นวิดีโอเดี่ยว หรือเพิ่มเป็นตอนหนึ่งในซีรีส์สั้น</p>
        <div className="pf-market-publish-actions">
          <Button variant="lime" type="button" disabled={busy} onClick={() => void publishWork(focused)}>เผยแพร่เป็นวิดีโอเดี่ยว</Button>
          <button type="button" disabled={busy} onClick={() => setSeriesStep({ id: focused.id, mode: 'pick' })}>เผยแพร่เป็นซีรีส์สั้น</button>
        </div>
        {seriesStep?.id === focused.id && <SeriesStepPanel series={series} busy={busy} mode={seriesStep.mode} onCreate={() => void addProject(focused, 'new')} onExisting={() => setSeriesStep({ id: focused.id, mode: 'existing' })} onJoin={id => void addProject(focused, id)} />}
      </> : <p role="status">วิดีโอนี้ยังสร้างไม่เสร็จสมบูรณ์ จึงยังไม่สามารถเผยแพร่ได้</p>}
    </section>
  </>
  return <>
    {heading}
    {error && <p role="alert">{error}</p>}
    <section className="pf-market-form">
      <h2>科普成片</h2>
      <p className="pf-market-notice">แต่ละคลิปที่ตัดต่อเสร็จแล้ว ให้เลือกเผยแพร่เป็นวิดีโอเดี่ยวหรือซีรีส์สั้นก่อน หากเลือกซีรีส์สั้น ให้ตัดสินใจว่าจะสร้างซีรีส์ใหม่หรือเพิ่มในซีรีส์สั้นที่มีอยู่</p>
      {projects.length === 0 ? <p>还没有可发布的科普成片。</p> : projects.map(project => <article key={project.id} className="pf-market-handoff">
        <strong>{project.title}</strong>
        <div className="pf-market-publish-actions">
          <Button variant="lime" type="button" disabled={busy} onClick={() => void publishWork(project)}>เผยแพร่เป็นวิดีโอเดี่ยว</Button>
          <button type="button" disabled={busy} onClick={() => setSeriesStep({ id: project.id, mode: 'pick' })}>เผยแพร่เป็นซีรีส์สั้น</button>
        </div>
        {seriesStep?.id === project.id && <SeriesStepPanel series={series} busy={busy} mode={seriesStep.mode} onCreate={() => void addProject(project, 'new')} onExisting={() => setSeriesStep({ id: project.id, mode: 'existing' })} onJoin={id => void addProject(project, id)} />}
      </article>)}
    </section>
    <section className="pf-market-form">
      <h2>ตอนของซีรีส์</h2>
      <p className="pf-market-notice">ซิงค์เฉพาะตอนฉบับเต็มที่เลือก เมื่อเสร็จสิ้นสามารถเพิ่มภาพหน้าปก ราคา และคำอธิบายในหน้าแก้ไขซีรีส์สั้น แล้วส่งตรวจทาน</p>
      {dramas.length === 0 ? <p>ยังไม่มีตอนของซีรีส์ที่สามารถนำเข้าได้</p> : <>
        <label>โปรเจกต์ละครซีรีส์<select value={dramaId} onChange={event => setDramaId(event.target.value)}>{dramas.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <button type="button" disabled={busy || !drama} onClick={() => setDramaPublishOpen(true)}>เลือกตอนฉบับเต็มและเผยแพร่</button>
      </>}
    </section>
    {dramaPublishOpen && drama && <DramaPublishModal projectId={drama.id} initialEpisodeId={focusEpisode || undefined} onClose={() => setDramaPublishOpen(false)} />}
  </>
}
