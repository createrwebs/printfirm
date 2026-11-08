import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, UsersRound } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import ProjectCreateDialog, { type ProjectCreateValues } from '../../components/projects/ProjectCreateDialog'
import { useTeamPreview } from './useTeamPreview'
import { TEAM_COLORS } from './types'

/** สร้างทีมใหม่ */
export function CreateTeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createTeam } = useTeamPreview()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(TEAM_COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setName(''); setDescription(''); setColor(TEAM_COLORS[0]); setError('') } }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const id = await createTeam({ name, description, color })
      onClose()
      navigate(`/teams/${id}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'สร้างทีมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') }
    finally { setBusy(false) }
  }

  return <Modal open={open} onClose={onClose} dismissible={!busy} title="สร้างทีม">
    <form className="pf-team-form" onSubmit={submit}>
      <div className="pf-team-form-intro"><span className="pf-team-mark" style={{ background: color }}><UsersRound size={24} /></span><div><strong>เปลี่ยนแรงบันดาลใจให้กลายเป็นผลงานของทีม</strong><p>คุณจะเป็นเจ้าของทีม (Owner) จากนั้นสามารถเชิญเพื่อนมาร่วมสร้างสรรค์ได้</p></div></div>
      <label className="pf-team-field">ชื่อทีม<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="เช่น: ทีมครีเอทีฟสตอรี่บอร์ด" required /></label>
      <label className="pf-team-field">คำอธิบายทีม <span className="pf-team-muted">ไม่บังคับ</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={180} placeholder="เขียนสิ่งที่คุณอยากทำร่วมกัน" rows={3} /></label>
      <fieldset className="pf-team-colors"><legend>สีประจำทีม</legend>{TEAM_COLORS.map((item, index) => <button key={item} type="button" style={{ background: item }} aria-label={`เลือกสีประจำทีม ${index + 1}`} aria-pressed={color === item} onClick={() => setColor(item)}>{color === item && <Check size={16} />}</button>)}</fieldset>
      <p className="pf-team-form-note">ทีมมีโปรเจกต์ แอสเซท และการเงินเป็นของตนเอง หลังจากสร้างแล้วสามารถเชิญเพื่อนมาร่วมทีมได้</p>
      {error && <p className="pf-team-alert" role="alert">{error}</p>}
      <div className="pf-team-modal-actions"><Button onClick={onClose}>ยกเลิก</Button><Button variant="lime" type="submit" disabled={busy}>สร้างทีม <ArrowUpRight size={16} /></Button></div>
    </form>
  </Modal>
}

/** สร้างโปรเจกต์ของทีม */
export function CreateTeamProjectModal({ open, onClose, teamId }: { open: boolean; onClose: () => void; teamId: string }) {
  const { createProject } = useTeamPreview()
  const navigate = useNavigate()

  async function submit(values: ProjectCreateValues) {
    const id = await createProject(teamId, { title: values.title, description: values.description, source: values.source, episodes: values.episodeCount })
    onClose()
    navigate(`/drama/projects/${id}`)
  }

  return <ProjectCreateDialog key={teamId} open={open} onClose={onClose} kind="drama" contextLabel="โปรเจกต์ทีม · สมาชิกร่วมกันสร้างสรรค์" titleRequired titleMaxLength={60} sourceMaxLength={100000} allowImageStyle={false} onSubmit={submit} footerNote="การสร้างโปรเจกต์จะไม่เริ่มงานสร้างอัตโนมัติ ค่าใช้จ่ายในการสร้างจะถูกหักจากยอดเงินคงเหลือของเจ้าของทีม (Owner)" />
}
