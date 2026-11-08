import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, LockKeyhole, Search, Wallet } from 'lucide-react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { teamsApi } from '../../api/teams'
import { useTeamPreview } from './useTeamPreview'
import { useTeamPage } from './useTeamPage'
import { TeamPagination } from './TeamPagination'
import type { Team, TeamRole, UsageSummary } from './types'
import './team-management.css'

function money(fen: number): string { return `¥${(fen / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export default function TeamBillingPanel({ team, role }: { team: Team; role: TeamRole }) {
  const [search, setSearch] = useState('')
  const [member, setMember] = useState('')
  const [project, setProject] = useState('')
  const [period, setPeriod] = useState('')
  const [page, setPage] = useState(1)
  const [summary, setSummary] = useState<UsageSummary | undefined>(team.usage)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [limit, setLimit] = useState('')
  const [unlimited, setUnlimited] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const { loadTeam } = useTeamPreview()
  const isOwner = role === 'owner'
  const listing = useTeamPage(`${team.id}:charges:${page}:${search}:${member}:${project}:${period}`, (signal) => teamsApi.charges(team.id, { page, page_size: 12, q: search, member_id: isOwner && member ? member : undefined, project_id: project || undefined, period: period || undefined }, signal), refresh)
  useEffect(() => { let active = true; void teamsApi.summary(team.id).then((data) => { if (active) setSummary(data) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลการใช้งานไม่สำเร็จ') }); return () => { active = false } }, [team.id, refresh])

  function openBudget() { setLimit(String((summary?.team_monthly_limit_fen ?? 0) / 100)); setUnlimited(summary?.team_monthly_limit_fen == null); setError(''); setBudgetOpen(true) }

  async function saveBudget() {
    if (busy || !isOwner) return
    if (!unlimited && !/^\d+(\.\d{1,2})?$/.test(limit.trim())) { setError('กรุณาระบุจำนวนเงินที่ถูกต้อง ทศนิยมไม่เกิน 2 ตำแหน่ง'); return }
    const value = unlimited ? null : Math.round(Number(limit) * 100)
    if (value !== null && (!Number.isSafeInteger(value) || value > 100000000)) { setError('วงเงินต้องไม่เกิน 1,000,000 หยวน'); return }
    setBusy(true); setError('')
    try { await teamsApi.update(team.id, { monthly_limit_fen: value }); setBudgetOpen(false); setRefresh((n) => n + 1); await loadTeam(team.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกวงเงินไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  return <div className="pf-team-billing"><div className="pf-team-billing-summary"><section className="pf-team-billing-wallet"><div className="pf-team-billing-wallet-top"><span><Wallet size={17} />{isOwner ? 'บัญชีส่วนตัวของเจ้าของ (Owner)' : 'ยอดใช้จ่ายของฉันในเดือนนี้'}</span><span className="pf-team-billing-wallet-badge">{isOwner ? 'ค่าใช้จ่ายของทีมจะถูกชำระจากที่นี่' : 'มองเห็นเฉพาะตนเอง'}</span></div><div className="pf-team-billing-wallet-amount"><span>{isOwner ? 'ยอดเงินคงเหลือที่ใช้ได้' : 'ยอดใช้จ่ายที่ชำระแล้ว'}</span><strong>{summary ? money(isOwner ? summary.balance_fen ?? 0 : summary.spent_fen) : '—'}</strong></div><div className="pf-team-billing-wallet-bottom"><span><LockKeyhole size={13} />{isOwner ? 'กันวงเงินสำหรับงาน' : 'กันวงเงินระหว่างดำเนินการ'} <strong>{summary ? money(isOwner ? summary.frozen_fen ?? 0 : summary.reserved_fen) : '—'}</strong></span>{isOwner && <Button variant="lime" size="sm" disabled={busy || !summary} onClick={openBudget}>ตั้งค่าขีดจำกัดรวม</Button>}</div><div className="pf-team-billing-wallet-pattern" aria-hidden="true">P/F</div></section><section className="pf-team-panel pf-team-billing-stat"><span className="pf-team-muted">{isOwner ? 'ยอดใช้จ่ายของทีมในเดือนนี้' : 'วงเงินรายเดือนของฉัน'}</span><strong>{summary ? isOwner ? money(summary.spent_fen) : summary.monthly_limit_fen === null ? 'ไม่จำกัด' : money(summary.monthly_limit_fen) : '—'}</strong><p>{summary?.period || 'กำลังโหลดสถิติ'}</p></section><section className="pf-team-panel pf-team-billing-stat"><span className="pf-team-muted">{isOwner ? 'ขีดจำกัดรายเดือนของทีม' : 'กันวงเงินระหว่างดำเนินการของฉัน'}</span><strong>{isOwner ? summary?.team_monthly_limit_fen == null ? 'ไม่จำกัด' : money(summary.team_monthly_limit_fen) : summary ? money(summary.reserved_fen) : '—'}</strong><p>{isOwner ? summary ? 'กันวงเงินไว้แล้ว ' + money(summary.reserved_fen) : 'ตั้งค่าขีดจำกัดรายบุคคลได้ในการจัดการสมาชิก' : 'จะคิดค่าบริการตามการใช้งานจริงเมื่องานเสร็จสิ้น'}</p></section></div><div className="pf-team-billing-info"><p>{isOwner ? 'ค่าใช้จ่ายของทีมจะถูกหักจากยอดเงินส่วนตัวของคุณโดยตรง พร้อมบันทึกสมาชิกที่ทำรายการจริง ขีดจำกัดรวมและขีดจำกัดรายบุคคลจะมีผลพร้อมกัน' : 'ค่าใช้จ่ายของทีมชำระจากยอดเงินส่วนตัวของเจ้าของ (Owner) คุณสามารถดูยอดใช้จ่ายและวงเงินของตนเองได้'}{summary && !summary.billing_enabled && ' ปัจจุบันยังไม่ได้เปิดใช้งานการคิดค่าบริการ จึงไม่มีการหักเงิน'}</p>{isOwner && <Link className="pf-link" to="/pricing">เติมเงินเข้าบัญชีส่วนตัว →</Link>}</div>{error && <div className="pf-team-alert" role="alert">{error}</div>}
    <section className="pf-team-panel"><div className="pf-team-section-head"><h2>{isOwner ? 'รายละเอียดการใช้จ่ายของทีม' : 'รายละเอียดการใช้จ่ายของฉัน'}</h2><span className="pf-team-tag">หยวน (CNY)</span></div><div className="pf-team-billing-toolbar"><label className="pf-team-billing-search"><Search size={16} /><input aria-label="ค้นหาค่าใช้จ่าย" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="ค้นหาเนื้อหาหรือโมเดล" /></label>{isOwner && <label className="pf-team-field">รหัสสมาชิก<input inputMode="numeric" value={member} onChange={(event) => { setMember(event.target.value); setPage(1) }} placeholder="สมาชิกทั้งหมด" /></label>}<label className="pf-team-field">รหัสโปรเจกต์<input inputMode="numeric" value={project} onChange={(event) => { setProject(event.target.value); setPage(1) }} placeholder="โปรเจกต์ทั้งหมด" /></label><label className="pf-team-field">เดือน<input type="month" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1) }} /></label></div>{listing.loading ? <p role="status">กำลังโหลดรายละเอียดการใช้จ่าย…</p> : listing.error ? <div className="pf-team-alert" role="alert">{listing.error}<Button onClick={listing.retry}>ลองใหม่</Button></div> : listing.items.length ? <div className="pf-team-table-wrap"><table className="pf-team-table"><thead><tr><th>เนื้อหาการสร้างสรรค์</th>{isOwner && <th>สมาชิก</th>}<th>โปรเจกต์</th><th>เวลา</th><th>จำนวนเงิน</th></tr></thead><tbody>{listing.items.map((charge) => <tr key={charge.id}><td><div className="pf-team-billing-charge"><CreditCard size={17} /><div><strong>{charge.label}</strong><small>{charge.model}</small></div></div></td>{isOwner && <td>{team.members.find((m) => m.id === charge.memberId)?.name || `สมาชิก #${charge.memberId}`}</td>}<td>#{charge.projectId}</td><td>{new Date(charge.createdAt).toLocaleString('th-TH')}</td><td>{money(charge.amountFen)}</td></tr>)}</tbody></table></div> : <div className="pf-team-empty">ยังไม่มีประวัติการใช้จ่ายที่ตรงกับเงื่อนไข</div>}<TeamPagination page={page} total={listing.meta.total} onChange={setPage} /></section>
    <Modal open={budgetOpen && isOwner} onClose={() => setBudgetOpen(false)} dismissible={!busy} title="ขีดจำกัดค่าใช้จ่ายรายเดือนของทีม"><div className="pf-team-form"><p>คำนวณตามเดือนปฏิทิน ยอดใช้จ่ายจริงและยอดที่กันไว้ระหว่างดำเนินการจะถูกนับรวมในวงเงิน หากตั้งค่าเป็น 0 หยวนจะระงับการสร้างงานใหม่ การลดวงเงินจะไม่ยกเลิกงานที่กำลังดำเนินการ</p><label><input type="checkbox" checked={unlimited} disabled={busy} onChange={(event) => setUnlimited(event.target.checked)} /> ไม่จำกัดวงเงิน</label><label className="pf-team-field">ขีดจำกัดต่อเดือน (หยวน)<input inputMode="decimal" disabled={unlimited || busy} value={limit} onChange={(event) => setLimit(event.target.value)} /></label>{error && <p className="pf-team-alert" role="alert">{error}</p>}<Button variant="lime" onClick={saveBudget} disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกขีดจำกัดค่าใช้จ่าย'}</Button></div></Modal>
  </div>
}
