import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, FolderOpen, Image, Plus, Search, ShieldCheck, Trash2, Users, Wallet } from 'lucide-react'
import Button from '../../components/ui/Button'
import { ProjectCard, ProjectGrid } from '../../components/projects/ProjectCard'
import { AssetBanner, AssetCard, AssetEmpty, AssetGrid, AssetSearch, AssetTypeFilter } from '../../components/assets/AssetLibrary'
import { AssetDetailDialog } from '../../components/assets/AssetDetailDialog'
import { teamsApi } from '../../api/teams'
import { dramaApi, resolveDramaMediaUrl } from '../../api/drama'
import { useTeamPreview } from './useTeamPreview'
import { useTeamPage } from './useTeamPage'
import { TeamPagination } from './TeamPagination'
import type { TeamAsset, TeamProject, Team, TeamProjectStatus, TeamRole, TeamTab } from './types'
import { dialog } from '../../lib/dialog'
import './team-creative.css'

/** แผงควบคุมงานสร้างสรรค์ของทีม */
type CreativePanelProps = { team: Team; role: TeamRole; onTabChange: (tab: TeamTab) => void; onCreateProject: () => void }
const statusLabels: Record<TeamProjectStatus, string> = { draft: 'ร่างบท', producing: 'กำลังผลิต', completed: 'เสร็จสมบูรณ์' }
const assetLabels: Record<TeamAsset['type'], string> = { character: 'ตัวละคร', scene: 'ฉาก', prop: 'อุปกรณ์/พร็อพ', voice: 'น้ำเสียง' }

/** แสดงยอดเงิน */
function money(amount: number): string { return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'CNY' }).format(amount / 100) }
/** แสดงวันที่ */
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('th-TH', { month: '2-digit', day: '2-digit' }) }

/** แสดงผู้ร่วมงาน */
function Collaborators({ team, ids }: { team: Team; ids: string[] }) { return <span className="pf-team-project-people">{ids.slice(0, 3).map((id) => { const member = team.members.find((item) => item.id === id); return <span key={id} className="pf-team-avatar" title={member?.name || `สมาชิก ${id}`} style={{ background: member?.color || '#e8eddf' }}>{(member?.name || 'สมาชิก').slice(0, 1)}</span> })}{ids.length > 3 && <span className="pf-team-project-people-more">+{ids.length - 3}</span>}</span> }

/** การ์ดโปรเจกต์ของทีม */
function TeamProjectCard({ project, team }: { project: TeamProject; team: Team }) {
  const navigate = useNavigate()
  const { loadTeam } = useTeamPreview()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (team.myRole === 'member' || busy) return
    if (!await dialog.confirm({ title: 'ลบโปรเจกต์ทีม', message: `ยืนยันการลบ「${project.title}」พร้อมทั้งตอนย่อยและแอสเซททั้งหมดหรือไม่? การดำเนินการนี้ไม่สามารถเรียกคืนได้ ประวัติการเรียกเก็บเงินจะยังคงอยู่`, confirmText: 'ยืนยันการลบโปรเจกต์', tone: 'danger' })) return
    setBusy(true); setError('')
    try { await dramaApi.deleteProject(Number(project.id)); await loadTeam(team.id) } catch (cause) { setError(cause instanceof Error ? cause.message : 'ลบไม่สำเร็จ') } finally { setBusy(false) }
  }

  return <ProjectCard
    title={project.title}
    coverUrl={project.cover ? resolveDramaMediaUrl(project.cover) : undefined}
    kind="drama"
    category={`${project.genre} · ${project.episodes} ตอน`}
    status={{ label: statusLabels[project.status], tone: project.status }}
    description={project.description || 'รอเริ่มเขียนบทเรื่องราวในตอนต่อไป'}
    progress={{ label: 'ความคืบหน้าตอน', value: project.completedEpisodes, total: project.episodes }}
    footer={<><Collaborators team={team} ids={project.collaborators} /><span>อัปเดตเมื่อ {dateLabel(project.updatedAt)}</span></>}
    actions={team.myRole !== 'member' || error ? <>{team.myRole !== 'member' && <Button variant="text" size="sm" disabled={busy} onClick={remove}><Trash2 size={13} />{busy ? 'กำลังลบ…' : 'ลบโปรเจกต์'}</Button>}{error && <p className="pf-team-alert" role="alert">{error}</p>}</> : undefined}
    onOpen={() => navigate(`/drama/projects/${project.id}`)}
  />
}

/** แผงภาพรวมทีม */
export function TeamOverviewPanel({ team, role, onTabChange, onCreateProject }: CreativePanelProps) {
  return <div className="pf-team-overview">
    <section className="pf-team-overview-welcome"><div><span className="pf-team-overview-eyebrow">ทีมเดียว รวมเรื่องราวดีๆ</span><h2>ให้แรงบันดาลใจมารวมกันที่นี่<span>.</span></h2><p>ตั้งแต่บทร่างแรกจนถึงช็อตสุดท้าย ร่วมขับเคลื่อนเรื่องราวไปพร้อมกับเพื่อนร่วมทีม</p></div><Button variant="dark" onClick={onCreateProject}><Plus size={17} />สร้างโปรเจกต์ทีมใหม่</Button><span className="pf-team-overview-welcome-mark" aria-hidden="true">PF<br /><i>TOGETHER.</i></span></section>
    <div className="pf-team-overview-stats">{[{ label: 'โปรเจกต์ทีม', value: team.projectCount, note: 'สมาชิกทุกคนมองเห็นร่วมกัน', icon: FolderOpen, tab: 'projects' as const }, { label: 'เพื่อนร่วมทีม', value: team.memberCount, note: 'ผสานความเชี่ยวชาญของแต่ละคน', icon: Users, tab: 'members' as const }, { label: 'แอสเซทที่แชร์', value: team.assetCount, note: 'สั่งสมแรงบันดาลใจสำหรับช็อตถัดไป', icon: Image, tab: 'assets' as const }, { label: role === 'owner' ? 'ยอดใช้จ่ายทีมเดือนนี้' : 'ยอดใช้จ่ายส่วนตัวเดือนนี้', value: team.usage ? money(team.usage.spent_fen) : '—', note: team.usage?.period || 'สถิติการใช้งาน', icon: Wallet, tab: 'billing' as const }].map((item) => <button type="button" className="pf-team-overview-stat" key={item.label} onClick={() => onTabChange(item.tab)}><span>{item.label}<item.icon size={18} /></span><strong>{item.value}</strong><small>{item.note}<ArrowUpRight size={14} /></small></button>)}</div>
    <section className="pf-team-panel"><div className="pf-team-section-head"><div><h3>ผลงานล่าสุด</h3><p className="pf-team-muted">สานต่อเรื่องราวที่ยังเล่าไม่จบ</p></div><Button variant="text" size="sm" onClick={() => onTabChange('projects')}>โปรเจกต์ทั้งหมด<ArrowRight size={15} /></Button></div>{team.projects.length ? <ProjectGrid>{team.projects.map((project) => <TeamProjectCard key={project.id} project={project} team={team} />)}</ProjectGrid> : <div className="pf-team-empty"><FolderOpen size={28} /><strong>เรื่องราวเริ่มต้นจากโปรเจกต์ใหม่</strong><p>สร้างพื้นที่สร้างสรรค์แรกของทีมคุณ</p><Button variant="lime" onClick={onCreateProject}>สร้างโปรเจกต์ทีมใหม่</Button></div>}</section>
    <div className="pf-team-overview-bottom"><section className="pf-team-panel"><div className="pf-team-section-head"><h3>ความเคลื่อนไหวในทีม</h3></div><div className="pf-team-overview-activities">{team.activities.map((activity) => { const member = team.members.find((item) => item.id === activity.memberId); return <div className="pf-team-overview-activity" key={activity.id}><span className="pf-team-avatar" style={{ background: member?.color || '#edf0e8' }}>{(member?.name || 'สมาชิก').slice(0, 1)}</span><div><p><strong>{member?.name || activity.memberName || 'สมาชิกในทีม'}</strong> {activity.action}</p><span>{activity.subject}</span></div><time>{dateLabel(activity.createdAt)}</time></div> })}{!team.activities.length && <p className="pf-team-empty">ยังไม่มีความเคลื่อนไหวในทีม</p>}</div></section><section className="pf-team-overview-rules"><span className="pf-team-overview-eyebrow"><ShieldCheck size={16} />แนวทางการทำงานร่วมกัน</span><h3>สร้างสรรค์ร่วมกัน<br />โดยยังคงจังหวะของตนเอง</h3><p>แต่ละตอน แต่ละแอสเซทสามารถดำเนินไปพร้อมกันได้ เนื้อหาเดียวกันมีสมาชิกคนเดียวแก้ไขเพื่อลดการทับซ้อน</p><ul><li><Check size={15} />โปรเจกต์ทีมสามารถมองเห็นได้โดยสมาชิกทุกคน</li><li><Check size={15} />เมื่อใช้แอสเซทซ้ำจะถูกคัดลอกไปยังโปรเจกต์ปัจจุบัน</li><li><Check size={15} />การเงินและค่าใช้จ่ายของทีมเฉพาะเจ้าของ (Owner) เท่านั้นที่จัดการได้</li></ul></section></div>
  </div>
}

/** แผงโปรเจกต์ทีม */
export function TeamProjectsPanel({ team, onCreateProject }: CreativePanelProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | TeamProjectStatus>('all')
  const [page, setPage] = useState(1)
  const { revision } = useTeamPreview()
  const listing = useTeamPage(`${team.id}:projects:${query}:${status}:${page}`, (signal) => teamsApi.projects(team.id, { page, page_size: 12, q: query, status: status === 'all' ? undefined : status }, signal), revision)
  return <section className="pf-team-panel pf-team-project-panel"><div className="pf-team-section-head"><div><h2>โปรเจกต์ทีม</h2><p className="pf-team-muted">พื้นที่ทำงานร่วมกัน ให้เรื่องราวก้าวไปข้างหน้า</p></div><Button variant="lime" onClick={onCreateProject}><Plus size={17} />สร้างโปรเจกต์ใหม่</Button></div><div className="pf-team-project-toolbar"><div className="pf-team-project-filters" role="group" aria-label="กรองตามสถานะโปรเจกต์">{(['all', 'producing', 'draft', 'completed'] as const).map((value) => <button type="button" className={`pf-team-pill${status === value ? ' is-active' : ''}`} aria-pressed={status === value} key={value} onClick={() => { setStatus(value); setPage(1) }}>{value === 'all' ? 'โปรเจกต์ทั้งหมด' : statusLabels[value]}</button>)}</div><label className="pf-team-project-search"><Search size={17} /><input aria-label="ค้นหาโปรเจกต์ทีม" placeholder="ค้นหาชื่อโปรเจกต์หรือแนวเรื่อง" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label></div>{listing.loading ? <p role="status">กำลังโหลดโปรเจกต์…</p> : listing.error ? <div role="alert" className="pf-team-alert">{listing.error}<Button onClick={listing.retry}>ลองใหม่</Button></div> : listing.items.length ? <ProjectGrid>{listing.items.map((project) => <TeamProjectCard key={project.id} project={project} team={team} />)}</ProjectGrid> : <div className="pf-team-empty"><FolderOpen size={30} /><strong>ไม่พบโปรเจกต์ทีมที่ตรงกับเงื่อนไข</strong><p>ปรับเงื่อนไขตัวกรอง หรือเริ่มเรื่องราวใหม่</p></div>}<TeamPagination page={page} total={listing.meta.total} onChange={setPage} /></section>
}

/** แผงคลังแอสเซทรวมของทีม */
export function TeamAssetsPanel({ team }: CreativePanelProps) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | TeamAsset['type']>('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<TeamAsset | null>(null)
  const { revision } = useTeamPreview()
  const navigate = useNavigate()
  const listing = useTeamPage(`${team.id}:assets:${query}:${type}:${page}`, (signal) => teamsApi.assets(team.id, { page, page_size: 12, q: query, type: type === 'all' ? undefined : type }, signal), revision)
  return <section className="pf-team-panel pf-team-asset-panel"><div className="pf-team-section-head"><div><h2>คลังแอสเซทรวมของทีม</h2><p className="pf-team-muted">ตัวละคร ฉาก และอุปกรณ์/พร็อพ ที่รวบรวมจินตนาการของทีม</p></div><span className="pf-team-tag"><Image size={14} />{listing.meta.total} รายการแอสเซท</span></div><AssetBanner>เลือกแอสเซทจากหน้าต่างเลือกเพื่อคัดลอกไปยังโปรเจกต์เป้าหมาย การแก้ไขหลังจากนั้นจะเป็นอิสระต่อกัน</AssetBanner>
    <div className="pf-library-toolbar"><AssetTypeFilter options={[{ value: 'all' as const, label: 'แอสเซททั้งหมด' }, ...(['character', 'scene', 'prop', 'voice'] as const).map((value) => ({ value, label: assetLabels[value] }))]} value={type} onChange={(value) => { setType(value); setPage(1) }} /><AssetSearch value={query} onChange={(value) => { setQuery(value); setPage(1) }} /></div>{listing.loading ? <p role="status">กำลังโหลดแอสเซท…</p> : listing.error ? <div className="pf-team-alert" role="alert">{listing.error}<Button onClick={listing.retry}>ลองใหม่</Button></div> : listing.items.length ? <AssetGrid>{listing.items.map((asset) => <AssetCard key={asset.id} asset={asset} subtitle={`โปรเจกต์ #${asset.projectId}`} footer="แอสเซททีม" updatedAt={asset.updatedAt} onOpen={() => { setSelected(asset) }} />)}</AssetGrid> : <AssetEmpty>ตัวละคร ฉาก และอุปกรณ์/พร็อพในโปรเจกต์จะถูกรวบรวมไว้ที่นี่</AssetEmpty>}<TeamPagination page={page} total={listing.meta.total} onChange={setPage} />
    {selected && <AssetDetailDialog asset={{ id: Number(selected.id), type: selected.type, asset_type: selected.assetType, name: selected.name, cover: selected.cover, url: selected.url, params: selected.params, references: selected.references, project_id: Number(selected.projectId), updated_at: selected.updatedAt }} description={selected.description} onClose={() => setSelected(null)} actions={<Button variant="dark" onClick={() => navigate(`/drama/projects/${selected.projectId}`, { state: { activeStep: 'assets' } })}>เปิดโปรเจกต์ต้นทาง</Button>} />}
  </section>
}
