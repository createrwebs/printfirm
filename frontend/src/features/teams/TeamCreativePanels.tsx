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

/** 创作面板共享当前真实团队与导航การดำเนินการ。 */
type CreativePanelProps = { team: Team; role: TeamRole; onTabChange: (tab: TeamTab) => void; onCreateProject: () => void }
const statusLabels: Record<TeamProjectStatus, string> = { draft: '构思中', producing: '制作中', completed: 'เสร็จสมบูรณ์' }
const assetLabels: Record<TeamAsset['type'], string> = { character: 'ตัวละคร', scene: 'ฉาก', prop: 'อุปกรณ์/พร็อพ', voice: 'น้ำเสียง' }
/** 金额显示为元。 */
function money(amount: number): string { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount / 100) }
/** 日期为空时保持可读。 */
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) }
/** 展示真实参与者，未出现在首屏สมาชิก中的使用สมาชิก标识。 */
function Collaborators({ team, ids }: { team: Team; ids: string[] }) { return <span className="pf-team-project-people">{ids.slice(0, 3).map((id) => { const member = team.members.find((item) => item.id === id); return <span key={id} className="pf-team-avatar" title={member?.name || `สมาชิก ${id}`} style={{ background: member?.color || '#e8eddf' }}>{(member?.name || 'สมาชิก').slice(0, 1)}</span> })}{ids.length > 3 && <span className="pf-team-project-people-more">+{ids.length - 3}</span>}</span> }
/** โปรเจกต์卡片直接进入真实ละครซีรีส์เวิร์กสเตชัน，不构造假的分集与占用信息。 */
function TeamProjectCard({ project, team }: { project: TeamProject; team: Team }) {
  const navigate = useNavigate()
  const { loadTeam } = useTeamPreview()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** ลบ真实团队โปรเจกต์，历史账单仍由服务端保留。 */
  async function remove() {
    if (team.myRole === 'member' || busy) return
    if (!await dialog.confirm({ title: 'ลบ团队โปรเจกต์', message: `ยืนยันการลบ「${project.title}」及其分集和แอสเซท？此การดำเนินการ无法恢复，历史账单仍然保留。`, confirmText: 'ยืนยันการลบโปรเจกต์', tone: 'danger' })) return
    setBusy(true); setError('')
    try { await dramaApi.deleteProject(Number(project.id)); await loadTeam(team.id) } catch (cause) { setError(cause instanceof Error ? cause.message : 'ลบไม่สำเร็จ') } finally { setBusy(false) }
  }
  return <ProjectCard
    title={project.title}
    coverUrl={project.cover ? resolveDramaMediaUrl(project.cover) : undefined}
    kind="drama"
    category={`${project.genre} · ${project.episodes} 集`}
    status={{ label: statusLabels[project.status], tone: project.status }}
    description={project.description || '等待写下故事的下一章。'}
    progress={{ label: '分集进度', value: project.completedEpisodes, total: project.episodes }}
    footer={<><Collaborators team={team} ids={project.collaborators} /><span>{dateLabel(project.updatedAt)} 更新</span></>}
    actions={team.myRole !== 'member' || error ? <>{team.myRole !== 'member' && <Button variant="text" size="sm" disabled={busy} onClick={remove}><Trash2 size={13} />{busy ? '正在ลบ…' : 'ลบโปรเจกต์'}</Button>}{error && <p className="pf-team-alert" role="alert">{error}</p>}</> : undefined}
    onOpen={() => navigate(`/drama/projects/${project.id}`)}
  />
}

/** 真实เวิร์กสเตชัน概要，统计使用后端汇总而非分页条数。 */
export function TeamOverviewPanel({ team, role, onTabChange, onCreateProject }: CreativePanelProps) {
  return <div className="pf-team-overview">
    <section className="pf-team-overview-welcome"><div><span className="pf-team-overview-eyebrow">一个团队，เพิ่มเติม好故事</span><h2>让灵感在这里汇合<span>。</span></h2><p>从第一段剧本到最后一个镜头，与创作伙伴一起推进每个故事。</p></div><Button variant="dark" onClick={onCreateProject}><Plus size={17} />สร้างใหม่团队โปรเจกต์</Button><span className="pf-team-overview-welcome-mark" aria-hidden="true">PF<br /><i>TOGETHER.</i></span></section>
    <div className="pf-team-overview-stats">{[{ label: '团队โปรเจกต์', value: team.projectCount, note: '所有สมาชิก共享可见', icon: FolderOpen, tab: 'projects' as const }, { label: '创作伙伴', value: team.memberCount, note: '连接各自的擅长', icon: Users, tab: 'members' as const }, { label: '共享แอสเซท', value: team.assetCount, note: '为下一个镜头积累灵感', icon: Image, tab: 'assets' as const }, { label: role === 'owner' ? '本月团队消费' : '本月本人消费', value: team.usage ? money(team.usage.spent_fen) : '—', note: team.usage?.period || '消费统计', icon: Wallet, tab: 'billing' as const }].map((item) => <button type="button" className="pf-team-overview-stat" key={item.label} onClick={() => onTabChange(item.tab)}><span>{item.label}<item.icon size={18} /></span><strong>{item.value}</strong><small>{item.note}<ArrowUpRight size={14} /></small></button>)}</div>
    <section className="pf-team-panel"><div className="pf-team-section-head"><div><h3>最近创作</h3><p className="pf-team-muted">继续那个还没讲完的故事</p></div><Button variant="text" size="sm" onClick={() => onTabChange('projects')}>全部โปรเจกต์<ArrowRight size={15} /></Button></div>{team.projects.length ? <ProjectGrid>{team.projects.map((project) => <TeamProjectCard key={project.id} project={project} team={team} />)}</ProjectGrid> : <div className="pf-team-empty"><FolderOpen size={28} /><strong>故事从一个新โปรเจกต์开始</strong><p>建立团队的第一个创作空间。</p><Button variant="lime" onClick={onCreateProject}>สร้างใหม่团队โปรเจกต์</Button></div>}</section>
    <div className="pf-team-overview-bottom"><section className="pf-team-panel"><div className="pf-team-section-head"><h3>团队动态</h3></div><div className="pf-team-overview-activities">{team.activities.map((activity) => { const member = team.members.find((item) => item.id === activity.memberId); return <div className="pf-team-overview-activity" key={activity.id}><span className="pf-team-avatar" style={{ background: member?.color || '#edf0e8' }}>{(member?.name || 'สมาชิก').slice(0, 1)}</span><div><p><strong>{member?.name || activity.memberName || 'สมาชิกในทีม'}</strong> {activity.action}</p><span>{activity.subject}</span></div><time>{dateLabel(activity.createdAt)}</time></div> })}{!team.activities.length && <p className="pf-team-empty">暂时没有团队动态。</p>}</div></section><section className="pf-team-overview-rules"><span className="pf-team-overview-eyebrow"><ShieldCheck size={16} />协作方式</span><h3>一起创作，<br />也保留各自的节奏。</h3><p>不同分集、不同แอสเซท可以同时推进；同一内容由一位สมาชิกแก้ไข，减少互相覆盖。</p><ul><li><Check size={15} />团队โปรเจกต์对所有สมาชิก可见</li><li><Check size={15} />复用แอสเซท时คัดลอก到当前โปรเจกต์</li><li><Check size={15} />团队财务仅เจ้าของ (Owner)可管理</li></ul></section></div>
  </div>
}

/** โปรเจกต์ค้นหา、ตัวกรอง与分页均在服务端执行。 */
export function TeamProjectsPanel({ team, onCreateProject }: CreativePanelProps) {
  /* query/status/page 是服务器查询条件；revision 管理การดำเนินการ后的รีเฟรช代次。 */
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | TeamProjectStatus>('all')
  const [page, setPage] = useState(1)
  const { revision } = useTeamPreview()
  const listing = useTeamPage(`${team.id}:projects:${query}:${status}:${page}`, (signal) => teamsApi.projects(team.id, { page, page_size: 12, q: query, status: status === 'all' ? undefined : status }, signal), revision)
  return <section className="pf-team-panel pf-team-project-panel"><div className="pf-team-section-head"><div><h2>团队โปรเจกต์</h2><p className="pf-team-muted">共同的创作空间，让每个故事向前一步。</p></div><Button variant="lime" onClick={onCreateProject}><Plus size={17} />สร้างโปรเจกต์ใหม่</Button></div><div className="pf-team-project-toolbar"><div className="pf-team-project-filters" role="group" aria-label="按โปรเจกต์สถานะตัวกรอง">{(['all', 'producing', 'draft', 'completed'] as const).map((value) => <button type="button" className={`pf-team-pill${status === value ? ' is-active' : ''}`} aria-pressed={status === value} key={value} onClick={() => { setStatus(value); setPage(1) }}>{value === 'all' ? '全部โปรเจกต์' : statusLabels[value]}</button>)}</div><label className="pf-team-project-search"><Search size={17} /><input aria-label="ค้นหา团队โปรเจกต์" placeholder="ค้นหาชื่อโปรเจกต์或题材" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label></div>{listing.loading ? <p role="status">正在加载โปรเจกต์…</p> : listing.error ? <div role="alert" className="pf-team-alert">{listing.error}<Button onClick={listing.retry}>ลองใหม่</Button></div> : listing.items.length ? <ProjectGrid>{listing.items.map((project) => <TeamProjectCard key={project.id} project={project} team={team} />)}</ProjectGrid> : <div className="pf-team-empty"><FolderOpen size={30} /><strong>暂无符合条件的团队โปรเจกต์</strong><p>调整ตัวกรอง条件，或开始一个新的故事。</p></div>}<TeamPagination page={page} total={listing.meta.total} onChange={setPage} /></section>
}

/** 团队共享แอสเซท按页读取，รายละเอียด使用真实媒体与来源โปรเจกต์。 */
export function TeamAssetsPanel({ team }: CreativePanelProps) {
  /* query/type/page 为服务器ตัวกรอง；selected 为真实รายละเอียดแอสเซท；copyStatus 是คัดลอก反馈。 */
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | TeamAsset['type']>('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<TeamAsset | null>(null)
  const { revision } = useTeamPreview()
  const navigate = useNavigate()
  const listing = useTeamPage(`${team.id}:assets:${query}:${type}:${page}`, (signal) => teamsApi.assets(team.id, { page, page_size: 12, q: query, type: type === 'all' ? undefined : type }, signal), revision)
  return <section className="pf-team-panel pf-team-asset-panel"><div className="pf-team-section-head"><div><h2>团队แอสเซท库</h2><p className="pf-team-muted">ตัวละคร、ฉาก与อุปกรณ์/พร็อพ，沉淀团队共同的想象力。</p></div><span className="pf-team-tag"><Image size={14} />{listing.meta.total} 项แอสเซท</span></div><AssetBanner>在โปรเจกต์แอสเซทเลือก器中คัดลอก到目标โปรเจกต์，后续修改各自独立。</AssetBanner>
    <div className="pf-library-toolbar"><AssetTypeFilter options={[{ value: 'all' as const, label: '全部แอสเซท' }, ...(['character', 'scene', 'prop', 'voice'] as const).map((value) => ({ value, label: assetLabels[value] }))]} value={type} onChange={(value) => { setType(value); setPage(1) }} /><AssetSearch value={query} onChange={(value) => { setQuery(value); setPage(1) }} /></div>{listing.loading ? <p role="status">正在加载แอสเซท…</p> : listing.error ? <div className="pf-team-alert" role="alert">{listing.error}<Button onClick={listing.retry}>ลองใหม่</Button></div> : listing.items.length ? <AssetGrid>{listing.items.map((asset) => <AssetCard key={asset.id} asset={asset} subtitle={`โปรเจกต์ #${asset.projectId}`} footer="团队แอสเซท" updatedAt={asset.updatedAt} onOpen={() => { setSelected(asset) }} />)}</AssetGrid> : <AssetEmpty>โปรเจกต์中的ตัวละคร、ฉาก与อุปกรณ์/พร็อพ将汇集在这里。</AssetEmpty>}<TeamPagination page={page} total={listing.meta.total} onChange={setPage} />
    {selected && <AssetDetailDialog asset={{ id: Number(selected.id), type: selected.type, asset_type: selected.assetType, name: selected.name, cover: selected.cover, url: selected.url, params: selected.params, references: selected.references, project_id: Number(selected.projectId), updated_at: selected.updatedAt }} description={selected.description} onClose={() => setSelected(null)} actions={<Button variant="dark" onClick={() => navigate(`/drama/projects/${selected.projectId}`, { state: { activeStep: 'assets' } })}>打开来源โปรเจกต์</Button>} />}
  </section>
}
