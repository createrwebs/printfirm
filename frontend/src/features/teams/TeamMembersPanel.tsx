import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Copy, Mail, Search, ShieldCheck, SlidersHorizontal, UserPlus, Users, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { useTeamPreview } from './useTeamPreview'
import { type PreviewMember, type PreviewTeam, type TeamRole } from './types'
import { teamsApi } from '../../api/teams'
import { useTeamPage } from './useTeamPage'
import { TeamPagination } from './TeamPagination'
import './team-management.css'

/* บทบาทสมาชิก的中文名称；金额始终使用分存储。 */
const ROLE_LABELS: Record<TeamRole, string> = { owner: 'เจ้าของ (Owner)', admin: 'ผู้ดูแลระบบ (Admin)', member: 'สมาชิก' }

/** 将分转换为清楚、固定两位小数的人民币展示。 */
function memberMoney(fen: number): string {
  return `¥${(fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** กลับ适合表格展示的日期，保留未知日期的可读降级。 */
function memberDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

/** 管理真实สมาชิกในทีม、邀请和月度额度。 */
export default function TeamMembersPanel({ team, role }: { team: PreviewTeam; role: TeamRole }) {
  const { inviteMember, revokeInvitation, updateMember, removeMember, revision } = useTeamPreview()
  /* search/roleFilter ตัวกรอง；dialog 控制弹窗；target 为额度或移除对象；notice/error 为本地反馈。 */
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [dialog, setDialog] = useState<'invite' | 'limit' | 'remove' | null>(null)
  const [target, setTarget] = useState<PreviewMember | null>(null)
  const [email, setEmail] = useState('')
  const [limit, setLimit] = useState('')
  const [unlimited, setUnlimited] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const dialogContent = useRef<HTMLDivElement>(null)
  const canInvite = role !== 'member'
  const [page, setPage] = useState(1)
  const [invitationPage, setInvitationPage] = useState(1)
  const [links, setLinks] = useState<Record<string, string>>({})
  const listing = useTeamPage(`${team.id}:members:${page}:${search}:${roleFilter}`, (signal) => teamsApi.members(team.id, { page, page_size: 12, q: search, role: roleFilter === 'all' ? undefined : roleFilter }, signal), revision)
  const invitationListing = useTeamPage(`${team.id}:invitations:${invitationPage}:${role}`, (signal) => canInvite ? teamsApi.invitations(team.id, { page: invitationPage, page_size: 12 }, signal) : Promise.resolve({ items: [], meta: { page: 1, page_size: 12, total: 0 } }), revision)
  const members = listing.items
  const invitations = invitationListing.items

  /** 将焦点保留在当前弹窗内，并在ปิด后กลับ打开弹窗的按钮。 */
  useEffect(() => {
    if (!dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = dialogContent.current?.closest<HTMLElement>('[role="dialog"]')
    if (!panel) return
    const first = panel.querySelector<HTMLElement>('[data-team-autofocus]')
      ?? panel.querySelector<HTMLElement>('button, input, select')
    first?.focus()
    /** 在首尾可聚焦元素之间循环 Tab，避免焦点落到遮罩下。 */
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'))
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem?.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem?.focus() }
    }
    panel.addEventListener('keydown', trapFocus)
    return () => { panel.removeEventListener('keydown', trapFocus); previous?.focus() }
  }, [dialog])

  /** 展示可读错误并清除上一次สำเร็จสถานะ。 */
  function showError(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'การดำเนินการยังไม่เสร็จสิ้น กรุณาลองใหม่อีกครั้ง')
    setNotice('')
  }

  /** ปิด当前弹窗并ล้างข้อมูล其中的校验反馈。 */
  function closeDialog() {
    setDialog(null)
    setTarget(null)
    setError('')
  }

  /** 打开邮箱邀请弹窗；邀请始终ค่าเริ่มต้น为สมาชิกทั่วไป。 */
  function openInvitation() {
    setEmail('')
    setError('')
    setDialog('invite')
  }

  /** 校验邮箱后สร้าง本地邀请，不发送邮件或生成真实加入链接。 */
  async function submitInvitation(event: FormEvent) {
    event.preventDefault()
    if (!canInvite) return
    try {
      const result = await inviteMember(team.id, email.trim())
      if (result.acceptUrl) setLinks((old) => ({ ...old, [result.id]: result.acceptUrl! }))
      closeDialog()
      setNotice(result.emailSent ? 'ส่งอีเมลคำเชิญเรียบร้อยแล้ว' : 'สร้างคำเชิญแล้ว กรุณาคัดลอกลิงก์เข้าร่วมส่งให้ผู้รับ')
    } catch (cause) { showError(cause) }
  }

  /** คัดลอก本次生成的真实邀请链接，历史令牌不从服务端重新暴露。 */
  async function copyInvitation(inviteId: string) {
    try {
      if (!links[inviteId]) throw new Error('โปรดกดส่งอีกครั้งเพื่อสร้างลิงก์คำเชิญใหม่')
      await navigator.clipboard.writeText(links[inviteId])
      setNotice('คัดลอกลิงก์เข้าร่วมแล้ว กรุณาส่งให้เฉพาะเจ้าของอีเมลที่ได้รับเชิญเท่านั้น')
    } catch (cause) { showError(cause) }
  }
  /** 重发会轮换邀请令牌，旧链接立即失效。 */
  async function resend(inviteId: string) {
    try { const result = await teamsApi.resend(team.id, inviteId); if (result.acceptUrl) setLinks((old) => ({ ...old, [inviteId]: result.acceptUrl! })); setNotice(result.emailSent ? 'ส่งอีเมลคำเชิญใหม่แล้ว ลิงก์เดิมหมดอายุ' : 'สร้างลิงก์ใหม่แล้ว สามารถคลิกคัดลอกได้'); invitationListing.retry() }
    catch (cause) { showError(cause) }
  }

  /** 撤回本地邀请；上下文负责验证การดำเนินการ者สิทธิ์。 */
  async function revoke(inviteId: string) {
    try {
      await revokeInvitation(team.id, inviteId)
      setError('')
      setNotice('ยกเลิกคำเชิญนี้แล้ว')
    } catch (cause) { showError(cause) }
  }

  /** 仅允许เจ้าของ (Owner)为非เจ้าของ (Owner)สมาชิก切换ผู้ดูแลระบบ (Admin)身份。 */
  async function changeRole(member: PreviewMember, nextRole: 'admin' | 'member') {
    if (role !== 'owner' || member.role === 'owner') return
    try {
      await updateMember(team.id, member.id, { role: nextRole })
      setError('')
      setNotice(`已将 ${member.name} 设为${ROLE_LABELS[nextRole]}。`)
    } catch (cause) { showError(cause) }
  }

  /** 打开额度弹窗，将已有分金额转换为输入框中的元。 */
  function openLimit(member: PreviewMember) {
    setTarget(member)
    setLimit(member.monthlyLimitFen === null ? '' : (member.monthlyLimitFen / 100).toFixed(2))
    setUnlimited(member.monthlyLimitFen === null)
    setError('')
    setDialog('limit')
  }

  /** บันทึก非负、最多两位小数的月额度，零额度表示禁止新增消费。 */
  async function saveLimit(event: FormEvent) {
    event.preventDefault()
    if (!target || role !== 'owner') return
    try {
      if (!unlimited && !/^\d+(\.\d{1,2})?$/.test(limit.trim())) throw new Error('请输入有效金额，最多保留两位小数')
      const amountFen = unlimited ? null : Math.round(Number(limit) * 100)
      if (amountFen !== null && (!Number.isSafeInteger(amountFen) || amountFen < 0)) throw new Error('จำนวนโควตาเกินช่วงที่สามารถตั้งค่าได้')
      await updateMember(team.id, target.id, { monthlyLimitFen: amountFen })
      closeDialog()
      setNotice('อัปเดตโควตารายเดือนของสมาชิกแล้ว')
    } catch (cause) { showError(cause) }
  }

  /** ยืนยันการนำออก有สิทธิ์管理的สมาชิก，เจ้าของ (Owner)与当前การดำเนินการ者不能被移除。 */
  async function confirmRemoval() {
    if (!target || target.id === team.viewerId || target.role === 'owner'
      || (role !== 'owner' && !(role === 'admin' && target.role === 'member'))) return
    try {
      await removeMember(team.id, target.id)
      closeDialog()
      setNotice('นำสมาชิกออกจากทีมแล้ว เนื้อหาในทีมของสมาชิกยังคงอยู่')
    } catch (cause) { showError(cause) }
  }

  return (
    <div className="pf-team-members">
      <section className="pf-team-panel">
        <div className="pf-team-section-head">
          <div><span className="pf-team-members-eyebrow">ร่วมมือกัน สร้างเรื่องราวให้ยอดเยี่ยม</span><h2>สมาชิกในทีม <span className="pf-team-members-count">{team.memberCount}</span></h2><p className="pf-team-muted">ทุกคนมีหน้าที่ของตนเอง ผลงานยังคงเป็นของทีมเสมอ</p></div>
          {canInvite && <Button variant="lime" onClick={openInvitation}><UserPlus size={16} /> เชิญสมาชิก</Button>}
        </div>
        <div className="pf-team-members-permissions"><ShieldCheck size={16} /><span>{role === 'owner' ? 'คุณคือเจ้าของ (Owner) สามารถจัดการบทบาท สมาชิก และโควตารายเดือน' : role === 'admin' ? 'คุณคือผู้ดูแลระบบ (Admin) สามารถเชิญและลบสมาชิกทั่วไป' : 'คุณสามารถดูสมาชิกในทีม บทบาทและโควตาจะจัดการโดยเจ้าของ (Owner)'}</span></div>
        <div className="pf-team-members-toolbar">
          <label className="pf-team-members-search"><Search size={17} /><span className="pf-team-members-sr">ค้นหาด้วยชื่อหรืออีเมล</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="ค้นหาด้วยชื่อหรืออีเมล" type="search" /></label>
          <label className="pf-team-members-filter"><SlidersHorizontal size={15} /><span className="pf-team-members-sr">กรองตามบทบาท</span><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1) }}><option value="all">ทุกบทบาท</option><option value="owner">เจ้าของ (Owner)</option><option value="admin">ผู้ดูแลระบบ (Admin)</option><option value="member">สมาชิก</option></select></label>
        </div>
        {!dialog && error && <div className="pf-team-alert" role="alert">{error}</div>}
        {notice && <div className="pf-team-members-notice" role="status"><Check size={15} />{notice}</div>}
        {listing.loading ? <p role="status">กำลังโหลดสมาชิก...</p> : listing.error ? <div className="pf-team-alert" role="alert">{listing.error}<Button onClick={listing.retry}>ลองใหม่</Button></div> : members.length ? <div className="pf-team-table-wrap"><table className="pf-team-table pf-team-members-table"><thead><tr><th scope="col">สมาชิก</th><th scope="col">บทบาท</th><th scope="col">โควตาและการใช้งานเดือนนี้</th><th scope="col">เวลาเข้าร่วม</th><th scope="col"><span className="pf-team-members-sr">การดำเนินการ</span></th></tr></thead><tbody>{members.map((member) => {
          /* 每行สิทธิ์与消费可见性：仅เจ้าของ (Owner)ดู全员消费。 */
          const isSelf = member.id === team.viewerId
          const canViewSpend = role === 'owner' || isSelf
          const canRemove = !isSelf && member.role !== 'owner' && (role === 'owner' || (role === 'admin' && member.role === 'member'))
          const commitment = (member.spentFen || 0) + (member.reservedFen || 0)
          const percent = member.monthlyLimitFen ? Math.min(100, commitment / member.monthlyLimitFen * 100) : 0
          return <tr key={member.id}><td><div className="pf-team-members-person"><span className="pf-team-avatar" style={{ background: member.color }}>{member.name.slice(0, 1)}</span><div><strong>{member.name}{isSelf && <span className="pf-team-members-self">คุณ</span>}</strong><small>{member.email}</small></div></div></td><td>{role === 'owner' && member.role !== 'owner' ? <select className="pf-team-members-role-select" aria-label={`ตั้งค่าบทบาทของ ${member.name}`} value={member.role} onChange={(event) => changeRole(member, event.target.value as 'admin' | 'member')}><option value="admin">ผู้ดูแลระบบ (Admin)</option><option value="member">สมาชิก</option></select> : <span className={`pf-team-tag pf-team-members-role-${member.role}`}>{ROLE_LABELS[member.role]}</span>}</td><td>{canViewSpend ? <div className="pf-team-members-budget"><span><strong>{memberMoney(member.spentFen || 0)}</strong><span> / {member.monthlyLimitFen === null ? 'ไม่จำกัด' : memberMoney(member.monthlyLimitFen)}</span></span>{member.monthlyLimitFen !== null && <div className="pf-team-members-meter" role="progressbar" aria-label={`สัดส่วนการใช้วงเงินของ ${member.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ width: `${percent}%` }} /></div>}{(member.reservedFen || 0) > 0 && <small>มีการสำรอง {memberMoney(member.reservedFen || 0)}</small>}</div> : <span className="pf-team-muted">เห็นได้เฉพาะตนเอง</span>}</td><td className="pf-team-members-date">{memberDate(member.joinedAt)}</td><td><div className="pf-team-members-actions">{role === 'owner' && <Button size="sm" variant="text" onClick={() => openLimit(member)}>วงเงิน</Button>}{canRemove && <Button size="sm" variant="text" className="pf-team-members-remove" onClick={() => { setTarget(member); setError(''); setDialog('remove') }}>นำออก</Button>}</div></td></tr>
        })}</tbody></table></div> : <div className="pf-team-empty"><Users size={30} /><h3>ไม่พบสมาชิก</h3><p>ลองค้นหาด้วยชื่อ อีเมล หรือบทบาทอื่น</p><Button variant="outline" size="sm" onClick={() => { setSearch(''); setRoleFilter('all') }}>ล้างตัวกรอง</Button></div>}
        <TeamPagination page={page} total={listing.meta.total} onChange={setPage} />
      </section>

      {canInvite && <section className="pf-team-panel pf-team-members-invitations"><div className="pf-team-section-head"><div><h2>ประวัติคำเชิญ <span className="pf-team-members-count">{invitationListing.meta.total}</span></h2><p className="pf-team-muted">คำเชิญมีอายุ 7 วัน สามารถยอมรับได้เฉพาะเมื่อเข้าสู่ระบบด้วยอีเมลที่ได้รับเชิญ</p></div><Mail size={21} /></div>{invitationListing.loading ? <p role="status">กำลังโหลดคำเชิญ…</p> : invitationListing.error ? <div className="pf-team-alert" role="alert">{invitationListing.error}<Button onClick={invitationListing.retry}>ลองใหม่</Button></div> : invitations.length ? <div className="pf-team-members-invite-list">{invitations.map((invite) => <div className="pf-team-members-invite-row" key={invite.id}><span className="pf-team-members-mail-icon"><Mail size={17} /></span><div className="pf-team-members-invite-info"><strong>{invite.email}</strong><small>{new Date(invite.expiresAt).getTime() < Date.now() ? 'หมดอายุแล้ว' : `${memberDate(invite.expiresAt)} หมดอายุ`} · สมาชิกทั่วไป · {{ pending: 'รอตอบรับ', accepted: 'ยอมรับแล้ว', revoked: 'ยกเลิกแล้ว', expired: 'หมดอายุแล้ว' }[invite.status] || invite.status}</small></div><Button variant="text" size="sm" disabled={!links[invite.id] || invite.status !== 'pending'} onClick={() => void copyInvitation(invite.id)} aria-label={`คัดลอกลิงก์คำเชิญของ ${invite.email}`}><Copy size={14} />คัดลอกลิงก์</Button>{['pending', 'expired'].includes(invite.status) && <Button variant="text" size="sm" onClick={() => void resend(invite.id)}>ส่งอีกครั้ง</Button>}<Button variant="ghost" size="sm" icon disabled={invite.status !== 'pending'} onClick={() => void revoke(invite.id)} aria-label={`ยกเลิกคำเชิญของ ${invite.email}`}><X size={16} /></Button></div>)}</div> : <div className="pf-team-members-invite-empty"><Mail size={22} /><p>ยังไม่มีสมาชิกรอตอบรับ</p><span>เชิญเพื่อนร่วมงาน เพื่อเริ่มต้นการสร้างสรรค์ร่วมกัน</span></div>}<TeamPagination page={invitationPage} total={invitationListing.meta.total} onChange={setInvitationPage} /></section>}

      <Modal open={dialog === 'invite'} onClose={closeDialog} title="เชิญเพื่อนร่วมงาน" className="pf-team-members-modal"><div ref={dialog === 'invite' ? dialogContent : undefined}><p className="pf-team-muted">เชิญสมาชิกทั่วไปเข้าร่วม「{team.name}」 เมื่อเข้าร่วมแล้วจะสามารถดูโปรเจกต์และแอสเซททั้งหมดของทีมได้</p><form className="pf-team-form" onSubmit={submitInvitation}><label className="pf-team-field" htmlFor="pf-team-invite-email">ที่อยู่อีเมล<input id="pf-team-invite-email" data-team-autofocus type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="partner@example.com" /></label><div className="pf-team-members-preview-note"><Mail size={16} /><span>เชิญผู้ใช้จริงที่มีอีเมลตรงกันเข้าร่วม หากไม่ได้ตั้งค่าบริการอีเมลกรุณาคัดลอกลิงก์เชิญส่งต่อ</span></div>{error && <div className="pf-team-alert" role="alert">{error}</div>}<div className="pf-team-members-modal-actions"><Button variant="outline" onClick={closeDialog}>ยกเลิก</Button><Button type="submit" variant="lime"><UserPlus size={16} />ส่งคำเชิญ</Button></div></form></div></Modal>
      <Modal open={dialog === 'limit'} onClose={closeDialog} title={`ตั้งค่า ${target?.name ?? 'สมาชิก'}  ของ `} className="pf-team-members-modal"><div ref={dialog === 'limit' ? dialogContent : undefined}><form className="pf-team-form" onSubmit={saveLimit}><p className="pf-team-muted">วงเงินใช้สำหรับจำกัดการใช้จ่ายรายเดือนของสมาชิกคนนี้ในทีม ไม่มีการโอนเงินไปยังกระเป๋าส่วนตัวของสมาชิก</p><label className="pf-team-members-checkbox"><input data-team-autofocus type="checkbox" checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} />ไม่จำกัดวงเงินรายเดือน</label><label className="pf-team-field" htmlFor="pf-team-monthly-limit">วงเงินต่อเดือน (หยวน)<input id="pf-team-monthly-limit" inputMode="decimal" type="text" disabled={unlimited} value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="เช่น 500.00" /></label><p className="pf-team-members-help">ตั้งเป็น 0 เพื่อระงับการสร้างงานใหม่ ค่าใช้จ่ายที่เกิดขึ้นแล้วและที่กันไว้จะยังคงอยู่ วงเงินจะมีผลกับงานสร้างในครั้งถัดไป</p>{error && <div className="pf-team-alert" role="alert">{error}</div>}<div className="pf-team-members-modal-actions"><Button variant="outline" onClick={closeDialog}>ยกเลิก</Button><Button type="submit" variant="lime">บันทึกวงเงิน</Button></div></form></div></Modal>
      <Modal open={dialog === 'remove'} onClose={closeDialog} title="นำสมาชิกออกจากทีม" className="pf-team-members-modal"><div ref={dialog === 'remove' ? dialogContent : undefined}><p className="pf-team-members-remove-copy">ต้องการนำ <strong>{target?.name}</strong> ออกจาก「{team.name}」ใช่หรือไม่?</p><p className="pf-team-muted">หลังจากนำออก สมาชิกคนนี้จะไม่สามารถเข้าถึงทีมได้อีก โปรเจกต์ แอสเซท และประวัติการใช้จ่ายที่สร้างไว้จะยังคงอยู่ในทีม</p><p className="pf-team-members-help">การนำออกจะยกเลิกสิทธิ์การเข้าถึงของสมาชิกทันที โดยไม่ลบเนื้อหาของทีม</p>{error && <div className="pf-team-alert" role="alert">{error}</div>}<div className="pf-team-members-modal-actions"><Button data-team-autofocus variant="outline" onClick={closeDialog}>คงสมาชิกไว้</Button><Button variant="dark" onClick={confirmRemoval}>ยืนยันการนำออก</Button></div></div></Modal>
    </div>
  )
}
