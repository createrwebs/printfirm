import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, FolderInput, LockKeyhole } from 'lucide-react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { teamsApi } from '../../api/teams'
import { resolveDramaMediaUrl } from '../../api/drama'
import { useTeamPreview } from './useTeamPreview'
import { useTeamPage } from './useTeamPage'
import { TeamPagination } from './TeamPagination'
import type { Team } from './types'

/** 真实个人โปรเจกต์整体转入；服务端二次校验任务、占用和所有权。 */
export default function TransferProjectModal({ open, onClose, team }: { open: boolean; onClose: () => void; team: Team }) {
  /* selectedId เลือกโปรเจกต์；accepted 归属确认；busy/error ส่ง反馈；page 服务端分页。 */
  const [selectedId, setSelectedId] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const { loadTeam } = useTeamPreview()
  const listing = useTeamPage(`${team.id}:transfer:${open}:${page}`, (signal) => open ? teamsApi.transferable(team.id, { page, page_size: 12 }, signal) : Promise.resolve({ items: [], meta: { total: 0, page: 1, page_size: 12 } }))
  useEffect(() => { if (open) { setSelectedId(''); setAccepted(false); setError(''); setPage(1) } }, [open, team.id])
  /** 用户明确确认后执行真实归属变更；ล้มเหลว时保留选项。 */
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selectedId || !accepted || busy) return
    setBusy(true); setError('')
    try { await teamsApi.transferProject(team.id, selectedId); await loadTeam(team.id); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'โอนย้ายล้มเหลว โปรดลองใหม่อีกครั้ง'); listing.retry() }
    finally { setBusy(false) }
  }
  return <Modal open={open} onClose={onClose} dismissible={!busy} title="โอนย้ายโปรเจกต์ส่วนตัว" size="lg"><form className="pf-team-form" onSubmit={submit}><div className="pf-team-form-intro"><span className="pf-team-mark"><FolderInput size={23} /></span><div><strong>นำเรื่องราวที่มีอยู่มาร่วมสร้างกับทีม</strong><p>เลือกโปรเจกต์ส่วนตัวที่คุณเป็นเจ้าของ เพื่อโอนย้ายมายังทีม</p></div></div>{listing.loading ? <p role="status">กำลังตรวจสอบโปรเจกต์ที่สามารถโอนย้ายได้…</p> : listing.error ? <div className="pf-team-alert" role="alert">{listing.error}<Button onClick={listing.retry}>ลองใหม่</Button></div> : listing.items.length ? <div className="pf-team-transfer-list" role="group" aria-label="เลือกโปรเจกต์ส่วนตัว">{listing.items.map((project) => <label key={project.id} className={`pf-team-transfer-item${selectedId === project.id ? ' is-selected' : ''}`}><input type="radio" name="transfer-project" value={project.id} checked={selectedId === project.id} disabled={!project.transferable || busy} onChange={() => setSelectedId(project.id)} />{project.cover && <img src={resolveDramaMediaUrl(project.cover)} alt="" />}<span><strong>{project.title}</strong><small>{project.episodes} ตอน · โปรเจกต์ส่วนตัว</small></span><em>{project.transferable ? 'สามารถโอนย้ายได้' : <><LockKeyhole size={12} />{project.reason || 'ยังไม่สามารถโอนย้ายได้'}</>}</em></label>)}</div> : <div className="pf-team-empty">คุณยังไม่มีโปรเจกต์ส่วนตัวที่สามารถแสดงรายการได้</div>}<TeamPagination page={page} total={listing.meta.total} onChange={setPage} /><div className="pf-team-transfer-target"><span>เวิร์กสเปซส่วนตัว</span><ArrowRight size={16} /><strong>{team.name}</strong></div><div className="pf-team-form-note">โปรเจกต์ ตอน และแอสเซททั้งหมดจะกลายเป็นของทีม สมาชิกทุกคนสามารถเข้าถึงได้ ประวัติค่าใช้จ่ายส่วนบุคคลจะยังคงเดิม เมื่อโอนย้ายแล้วจะไม่สามารถโอนย้ายกลับไปยังเวิร์กสเปซส่วนตัวได้</div><label className="pf-team-transfer-confirm"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required disabled={busy} />ฉันเข้าใจและยืนยันว่าความเป็นเจ้าของโปรเจกต์จะเปลี่ยนไปอย่างถาวร</label>{error && <p className="pf-team-alert" role="alert">{error}</p>}<div className="pf-team-modal-actions"><Button onClick={onClose} disabled={busy}>ยกเลิก</Button><Button variant="lime" type="submit" disabled={!selectedId || !accepted || busy}>{busy ? 'กำลังโอนย้าย…' : 'ยืนยันการโอนย้ายเข้าทีม'}</Button></div></form></Modal>
}
