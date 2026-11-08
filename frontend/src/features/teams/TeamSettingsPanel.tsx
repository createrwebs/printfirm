import { useState, type FormEvent } from 'react'
import { ArrowRightLeft, Check, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { dialog } from '../../lib/dialog'
import { useTeamPreview } from './useTeamPreview'
import { teamsApi } from '../../api/teams'
import { useTeamPage } from './useTeamPage'
import { TeamPagination } from './TeamPagination'
import { TEAM_COLORS, type PreviewTeam, type TeamRole } from './types'

/** การจัดการข้อมูลทีมและสิทธิ์ความเป็นเจ้าของ */
export default function TeamSettingsPanel({ team, role }: { team: PreviewTeam; role: TeamRole }) {
  const { updateTeam, transferOwnership, leaveTeam, deleteTeam } = useTeamPreview()
  const navigate = useNavigate()
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description)
  const [color, setColor] = useState(team.color)
  const [target, setTarget] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [memberPage, setMemberPage] = useState(1)
  const candidates = useTeamPage(`${team.id}:owner-candidates:${memberQuery}:${memberPage}`, (signal) => role === 'owner' ? teamsApi.members(team.id, { page: memberPage, page_size: 12, q: memberQuery }, signal) : Promise.resolve({ items: [], meta: { total: 0, page: 1, page_size: 12 } }))

  async function save(event: FormEvent) {
    event.preventDefault()
    try { await updateTeam(team.id, { name, description, color }); setSuccess(true); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ') }
  }

  async function transfer() {
    const member = candidates.items.find((item) => item.id === target)
    if (!member) { setError('กรุณาเลือกสมาชิกที่จะรับโอนสิทธิ์'); return }
    if (!await dialog.confirm({ title: 'โอนสิทธิ์ความเป็นเจ้าของทีม', message: `หลังจากโอนทีมให้แก่ ${member.name} แล้ว คุณจะกลายเป็นผู้ดูแลระบบ (Admin) และไม่สามารถจัดการงบประมาณหรือแต่งตั้ง/ปลดผู้ดูแลระบบได้อีก งานใหม่จะหักเครดิตจากยอดเงินส่วนตัวของเจ้าของใหม่ งานที่รอดำเนินการจะยังคงชำระด้วยยอดเงินเดิม การโอนสิทธิ์นี้ไม่สามารถย้อนกลับได้`, confirmText: 'ยืนยันการโอนสิทธิ์', tone: 'danger' })) return
    try { await transferOwnership(team.id, target); setTarget(''); setError(''); setSuccess(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'โอนสิทธิ์ล้มเหลว') }
  }

  async function leave() {
    if (!await dialog.confirm({ title: 'ออกจากทีม', message: `หลังจากออกจาก「${team.name}」คุณจะไม่สามารถเข้าถึงทีมนี้ได้อีก เนื้อหาของทีมจะยังคงอยู่ หากต้องการกลับเข้ามาต้องได้รับคำเชิญใหม่`, confirmText: 'ออกจากทีม', tone: 'danger' })) return
    try { await leaveTeam(team.id); navigate('/teams') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ออกจากทีมล้มเหลว') }
  }

  async function removeTeam() {
    if (deleting) return
    if (!await dialog.confirm({ title: 'ลบทีม', message: `ยืนยันการลบ「${team.name}」หรือไม่? สมาชิกทุกคนจะสูญเสียสิทธิ์การเข้าถึง และคำเชิญที่ยังไม่ได้ใช้จะถูกยกเลิกทันที ผลงานในอดีตและประวัติค่าใช้จ่ายจะถูกเก็บถาวรเท่านั้น การดำเนินการนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ยืนยันการลบทีม', tone: 'danger' })) return
    setDeleting(true); setError('')
    try { await deleteTeam(team.id); navigate('/teams', { replace: true }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ลบทีมไม่สำเร็จ') }
    finally { setDeleting(false) }
  }

  return <div className="pf-team-settings-grid">
    <section className="pf-team-panel"><div className="pf-team-section-head"><div><h2>ข้อมูลทีม</h2><p>ชื่อที่ชัดเจน ช่วยให้เพื่อนร่วมงานหากันเจอได้ง่ายขึ้น</p></div><ShieldCheck size={21} /></div>
      <form className="pf-team-form" onSubmit={save}>
        <div className="pf-team-form-intro"><span className="pf-team-mark" style={{ background: color }}>{name.slice(0, 1) || 'ท'}</span><div><strong>{team.name}</strong><p>สมาชิก {team.memberCount} คน · พื้นที่ทีม</p></div></div>
        <label className="pf-team-field">ชื่อทีม<input value={name} onChange={(event) => { setName(event.target.value); setSuccess(false) }} maxLength={40} required readOnly={role !== 'owner'} /></label>
        <label className="pf-team-field">คำอธิบายทีม<textarea value={description} onChange={(event) => { setDescription(event.target.value); setSuccess(false) }} rows={3} maxLength={180} readOnly={role !== 'owner'} /></label>
        <fieldset className="pf-team-colors" disabled={role !== 'owner'}><legend>สีประจำทีม</legend>{TEAM_COLORS.map((item, index) => <button type="button" key={item} style={{ background: item }} aria-label={`เลือกสีประจำทีม ${index + 1}`} aria-pressed={color === item} disabled={role !== 'owner'} onClick={() => { setColor(item); setSuccess(false) }}>{color === item && <Check size={16} />}</button>)}</fieldset>
        {role === 'owner' ? <div><Button type="submit" variant="dark">บันทึกการเปลี่ยนแปลง</Button>{success && <span className="pf-team-saved" role="status"><Check size={15} />บันทึกข้อมูลแล้ว</span>}</div> : <p className="pf-team-form-note">ข้อมูลทีมได้รับการจัดการโดยเจ้าของ (Owner)</p>}
      </form>
    </section>
    <div className="pf-team-settings-aside"><section className="pf-team-panel"><div className="pf-team-section-head"><div><h2>ข้อตกลงการทำงานร่วมกัน</h2><p>เพื่อให้การสร้างสรรค์มีระเบียบและคล่องตัว</p></div></div><ul className="pf-team-rules"><li><strong>ทีมเป็นเจ้าของผลงานร่วมกัน</strong><span>เมื่อสมาชิกออกจากทีม โปรเจกต์และแอสเซทจะยังคงอยู่ในทีม</span></li><li><strong>แบ่งงานกันทำ หลีกเลี่ยงการทับซ้อน</strong><span>แต่ละตอนสามารถทำพร้อมกันได้ เนื้อหาเดียวกันมีผู้แก้ไขครั้งละคน</span></li><li><strong>คัดลอกแอสเซทเพื่อแก้ไขอิสระ</strong><span>การปรับแก้ในโปรเจกต์อื่นจะไม่กระทบต่อแอสเซทของโปรเจกต์ปัจจุบัน</span></li><li><strong>ชำระค่าใช้จ่ายจากเครดิตของเจ้าของ (Owner)</strong><span>ระบบจะกันวงเงินตามประมาณการ และคิดค่าบริการตามการใช้งานจริง</span></li></ul><p className="pf-team-form-note">ระบบจะตรวจสอบการแก้ไขพร้อมกัน และคำนวณค่าบริการตามการใช้งานจริงเมื่อเสร็จสิ้น</p></section>
      <section className="pf-team-panel pf-team-settings-access"><h2>{role === 'owner' ? 'โอนสิทธิ์ความเป็นเจ้าของ' : 'ออกจากทีม'}</h2><p className="pf-team-muted">{role === 'owner' ? 'มอบหมายให้เพื่อนร่วมทีมคนอื่นเป็นเจ้าของ คุณจะกลายเป็นผู้ดูแลระบบ (Admin)' : 'เมื่อออกจากทีม ผลงานที่คุณสร้างจะยังคงเป็นของทีม'}</p>{role === 'owner' ? <><label className="pf-team-field">ค้นหาสมาชิกผู้รับโอน<input value={memberQuery} onChange={(event) => { setMemberQuery(event.target.value); setMemberPage(1); setTarget('') }} placeholder="กรอกชื่อหรืออีเมลสมาชิก" /></label>{candidates.error && <p role="alert">{candidates.error}</p>}<label className="pf-team-field">สมาชิกผู้รับโอน<select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">เลือกสมาชิกหนึ่งคน</option>{candidates.items.filter((member) => member.id !== team.viewerId).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><TeamPagination page={memberPage} total={candidates.meta.total} onChange={(page) => { setMemberPage(page); setTarget('') }} /><Button onClick={transfer} disabled={!target}><ArrowRightLeft size={15} />โอนสิทธิ์ความเป็นเจ้าของ</Button></> : <Button onClick={leave}><LogOut size={15} />ออกจากทีม</Button>}</section>
      {role === 'owner' && <section className="pf-team-panel pf-team-settings-access"><h2>ลบทีม</h2><p className="pf-team-muted">หลังจากลบ สมาชิกทุกคนจะไม่สามารถเข้าถึงทีมได้อีก ผลงานในอดีตและประวัติค่าใช้จ่ายจะถูกจัดเก็บถาวร การดำเนินการนี้ไม่สามารถย้อนกลับได้</p><Button disabled={deleting} onClick={() => void removeTeam()}><Trash2 size={15} />{deleting ? 'กำลังลบ…' : 'ลบทีม'}</Button></section>}
    </div>
    {error && <p className="pf-team-alert" role="alert">{error}</p>}
  </div>
}
