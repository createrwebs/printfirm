import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ChevronRight, FolderInput, FolderKanban, Images, LayoutDashboard, Plus, Settings2, UsersRound, Wallet } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import Button from '../../components/ui/Button'
import TeamDirectory from './TeamDirectory'
import { useTeamPreview } from './useTeamPreview'
import { TeamOverviewPanel, TeamProjectsPanel, TeamAssetsPanel } from './TeamCreativePanels'
import TeamMembersPanel from './TeamMembersPanel'
import TeamBillingPanel from './TeamBillingPanel'
import TeamSettingsPanel from './TeamSettingsPanel'
import { CreateTeamProjectModal } from './TeamForms'
import TransferProjectModal from './TransferProjectModal'
import { TEAM_ROLE_LABELS, viewerRole, type TeamTab } from './types'
import './teams.css'

const TABS = [
  { id: 'overview', label: 'ภาพรวมทีม', description: 'รวบรวมแรงบันดาลใจ ส่งต่อการสร้างสรรค์', icon: LayoutDashboard },
  { id: 'projects', label: 'โปรเจกต์ทีม', description: 'ให้ทุกเรื่องราวดีๆ กลายเป็นผลงานที่มั่นคง', icon: FolderKanban },
  { id: 'assets', label: 'แอสเซทที่แชร์', description: 'สั่งสมจินตนาการร่วมกัน เพื่อเป็นจุดเริ่มต้นของงานถัดไป', icon: Images },
  { id: 'members', label: 'จัดการสมาชิก', description: 'ค้นหาความถนัดของกันและกัน สร้างสรรค์เรื่องราวให้เสร็จสิ้นร่วมกัน', icon: UsersRound },
  { id: 'billing', label: 'ค่าใช้จ่ายและวงเงิน', description: 'ทุกการลงทุนในงานสร้างสรรค์ มองเห็นได้อย่างชัดเจน', icon: Wallet },
  { id: 'settings', label: 'การตั้งค่าทีม', description: 'จัดการข้อมูลทีมและแนวทางการทำงานร่วมกัน', icon: Settings2 },
] satisfies { id: TeamTab; label: string; description: string; icon: typeof LayoutDashboard }[]

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const [params, setParams] = useSearchParams()
  const { teams, selectTeam, loadTeam } = useTeamPreview()
  const [loading, setLoading] = useState(Boolean(teamId))
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const team = teams.find((item) => item.id === teamId)
  const tab = TABS.find((item) => item.id === params.get('tab')) ?? TABS[0]
  const role = team ? viewerRole(team) : 'member'
  const createOpen = Boolean(team && params.get('create') === '1')
  const transferOpen = Boolean(team && params.get('transfer') === '1')

  useEffect(() => {
    if (!teamId) { setLoading(false); return }
    let active = true
    selectTeam(teamId); setLoading(true); setError('')
    void loadTeam(teamId).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลทีมไม่สำเร็จ') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [teamId, selectTeam, loadTeam, retry])

  function changeTab(next: TeamTab) { setParams(next === 'overview' ? {} : { tab: next }) }
  function openCreateProject() { setParams({ tab: 'projects', create: '1' }) }
  function closeCreateProject() { setParams({ tab: 'projects' }, { replace: true }) }

  return <AppShell active="team" wide>
    <div className="pf-team-page">
      {!teamId ? <TeamDirectory /> : loading ? <div className="pf-team-panel pf-team-empty" role="status">กำลังโหลดพื้นที่ทีม…</div> : error || !team ? <div className="pf-team-panel pf-team-empty"><UsersRound size={36} /><h1>ไม่สามารถเปิดทีมได้</h1><p>{error || 'ทีมนี้ไม่มีอยู่หรือคุณไม่มีสิทธิ์เข้าถึง'}</p><Button onClick={() => setRetry((n) => n + 1)}>โหลดใหม่</Button><Button to="/teams" variant="dark">กลับหน้ารายการทีม</Button></div> : <>
        <div className="pf-team-breadcrumb"><Link to="/teams">ทีมของฉัน</Link><ChevronRight size={12} /><span>{team.name}</span></div>
        <div className="pf-team-layout">
          <aside className="pf-team-sidebar"><div className="pf-team-sidebar-identity"><span className="pf-team-mark" style={{ background: team.color }}>{team.name.slice(0, 1)}</span><div><strong>{team.name}</strong><span>สมาชิก {team.memberCount} คน · {TEAM_ROLE_LABELS[role]}</span></div></div>
            <nav aria-label="แถบนำทางทีม"><span className="pf-team-sidebar-caption">พื้นที่สร้างสรรค์</span>{TABS.map((item, index) => <div key={item.id}>{index === 3 && <span className="pf-team-sidebar-caption">จัดการทีม</span>}<button type="button" className={tab.id === item.id ? 'is-active' : ''} aria-current={tab.id === item.id ? 'page' : undefined} onClick={() => changeTab(item.id)}><item.icon size={17} /><span>{item.label}</span>{item.id === 'members' && <small>{team.memberCount}</small>}</button></div>)}</nav>
            <div className="pf-team-sidebar-foot"><div className="pf-team-avatar" style={{ background: '#dce9ce' }}>{(team.members.find((m) => m.id === team.viewerId)?.name || 'ฉัน').slice(0, 1)}</div><div><strong>{team.members.find((m) => m.id === team.viewerId)?.name || 'สมาชิกปัจจุบัน'}</strong><span>{TEAM_ROLE_LABELS[role]}</span></div></div>
            <Link to="/teams" className="pf-team-sidebar-back"><ArrowLeft size={14} />ทีมทั้งหมด</Link>
          </aside>
          <main className="pf-team-content"><header className="pf-team-content-header"><div><span className="pf-team-eyebrow">TEAM WORKSPACE</span><h1>{tab.label}</h1><p>{tab.description}</p></div>{tab.id === 'overview' && <Button variant="outline" onClick={() => changeTab('members')}><UsersRound size={16} />{role === 'member' ? 'ดูสมาชิก' : 'เชิญสมาชิก'}<ArrowUpRight size={14} /></Button>}{tab.id === 'projects' && <Button variant="outline" onClick={() => setParams({ tab: 'projects', transfer: '1' })}><FolderInput size={16} />ย้ายเข้าโปรเจกต์ส่วนตัว</Button>}{tab.id === 'assets' && <Button variant="outline" onClick={() => changeTab('projects')}><Plus size={16} />เพิ่มแอสเซทจากโปรเจกต์</Button>}</header>
            <div key={`${team.id}:${tab.id}`} className="pf-team-content-panel">
              {tab.id === 'overview' && <TeamOverviewPanel team={team} role={role} onTabChange={changeTab} onCreateProject={openCreateProject} />}
              {tab.id === 'projects' && <TeamProjectsPanel team={team} role={role} onTabChange={changeTab} onCreateProject={openCreateProject} />}
              {tab.id === 'assets' && <TeamAssetsPanel team={team} role={role} onTabChange={changeTab} onCreateProject={openCreateProject} />}
              {tab.id === 'members' && <TeamMembersPanel team={team} role={role} />}
              {tab.id === 'billing' && <TeamBillingPanel team={team} role={role} />}
              {tab.id === 'settings' && <TeamSettingsPanel team={team} role={role} />}
            </div>
            <div className="pf-team-page-foot"><span className="pf-team-preview-dot" />โหมดทีม · รวมตัวก่อน แล้วสร้างสรรค์<span>PRINTFILM / TOGETHER</span></div>
          </main>
        </div>
        <CreateTeamProjectModal open={createOpen} onClose={closeCreateProject} teamId={team.id} />
        <TransferProjectModal open={transferOpen} onClose={closeCreateProject} team={team} />
      </>}
    </div>
  </AppShell>
}
