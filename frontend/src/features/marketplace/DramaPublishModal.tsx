import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2, Film, Loader2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { request } from './api'
import { internalReturn, withReturn } from './ui'
import { publishSelection, sourceRelation, type DramaPublishContext, type DramaPublishResult } from './dramaPublishing'
import './dramaPublishing.css'

/** หากไม่มี crypto.randomUUID ให้สร้าง idempotent key แบบสุ่ม */
function publishKey() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto?.getRandomValues === 'function') return Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, '0')).join('')
  return `pf${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
}

type Props = {
  projectId: number; initialEpisodeId?: number; targetSeriesId?: number; selectReady?: boolean
  onClose: () => void; onPublished?: (result: DramaPublishResult) => void
}

// ซีรีส์, พรีวิวตอนย่อย และหน้าแก้ไขในตลาด ใช้กระบวนการเผยแพร่เดียวกัน โดยส่งเฉพาะตอนที่ผ่านการตรวจสอบ
export default function DramaPublishModal({ projectId, initialEpisodeId, targetSeriesId, selectReady = false, onClose, onPublished }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [context, setContext] = useState<DramaPublishContext | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [updates, setUpdates] = useState<number[]>([])
  const [targetId, setTargetId] = useState(targetSeriesId ? String(targetSeriesId) : 'new')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const requestKey = useRef({ signature: '', key: '' })
  const submitting = useRef(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    request<DramaPublishContext>(`/printfilm/dramas/${projectId}/publish-context`).then(value => {
      if (!active) return
      setContext(value)
      setTitle(current => current || value.project.title)
      setSelected(current => {
        const readyIds = value.episodes.filter(item => item.ready).map(item => item.id)
        if (current.length) return current.filter(id => readyIds.includes(id))
        if (initialEpisodeId && readyIds.includes(initialEpisodeId)) return [initialEpisodeId]
        return selectReady ? readyIds : []
      })
      setUpdates([])
    }).catch(err => { if (active) setError((err as Error).message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, initialEpisodeId, selectReady, reload])
  const target = context?.series.find(item => String(item.id) === targetId)
  const changed = context?.episodes.filter(item => selected.includes(item.id) && sourceRelation(item, target).changed) || []
  const missingUpdates = changed.some(item => !updates.includes(item.id))
  const storageReady = context?.storage_configured === true
  async function publish() {
    if (!context || !storageReady || submitting.current || !selected.length) return
    submitting.current = true; setBusy(true); setError('')
    try {
      if (targetId !== 'new' && !target) throw new Error('ซีรีส์เป้าหมายมีการเปลี่ยนแปลง กรุณารีเฟรชแล้วเลือกใหม่อีกครั้ง')
      const episodes = publishSelection(context, selected, updates, target)
      const payload = { episodes, series_id: target?.id ?? null, ...(target ? { series_version: target.version } : { title: title.trim() || context.project.title }) }
      const signature = JSON.stringify(payload)
      // เมื่อเกิดข้อผิดพลาด ให้ใช้ idempotent key เดิม เว้นแต่ผู้ใช้จะเปลี่ยนข้อมูลที่เลือก
      if (requestKey.current.signature !== signature) requestKey.current = { signature, key: publishKey() }
      const result = await request<DramaPublishResult>(`/printfilm/dramas/${projectId}/publish`, 'POST', { ...payload, idempotency_key: requestKey.current.key })
      if (onPublished) onPublished(result)
      else navigate(withReturn(`/marketplace/series/${result.series_id}/edit`, internalReturn(`${location.pathname}${location.search}`)))
      onClose()
    } catch (err) { setError((err as Error).message) }
    finally { submitting.current = false; setBusy(false) }
  }
  return <Modal open title="เผยแพร่สู่ตลาดดิจิทัลแอสเซท" size="lg" className="pf-drama-publish" onClose={onClose} dismissible={!busy} footer={<>
    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>ยกเลิก</Button>
    <Button type="button" variant="lime" disabled={loading || busy || !storageReady || !selected.length || missingUpdates || (targetId !== 'new' && !target)} onClick={() => void publish()}>{busy ? <><Loader2 size={16} className="pf-drama-publish-spin" />กำลังสร้างงานซิงค์…</> : 'ซิงค์และดำเนินการแก้ไขต่อ'}</Button>
  </>}>
    <p className="pf-drama-publish-intro">ตอนที่เลือกจะถูกซิงค์ไปยังรายการในตลาด จากนั้นสามารถเพิ่มภาพปกและกำหนดราคา พร้อมยืนยันข้อมูลลิขสิทธิ์เพื่อส่งตรวจสอบต่อไป</p>
    {loading ? <p role="status">กำลังตรวจสอบตอนย่อยและสถานะตลาด…</p> : context ? <>
      {!storageReady && <p className="pf-drama-publish-warning" role="alert">บริการจัดเก็บไฟล์ยังไม่ได้กำหนดค่า ไม่สามารถซิงค์วิดีโอได้ชั่วคราว กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่าระบบไฟล์แล้วลองใหม่อีกครั้ง</p>}
      <div className="pf-drama-publish-project"><Film size={20} /><div><strong>{context.project.title}</strong><span>{context.episodes.length} ตอน · เฉพาะตอนที่สร้างเสร็จสมบูรณ์แล้วเท่านั้นที่สามารถเผยแพร่ได้</span></div></div>
      <div className="pf-drama-publish-episodes" aria-label="เลือกตอนที่จะเผยแพร่">{context.episodes.map(episode => {
        const relation = sourceRelation(episode, target)
        return <div key={episode.id} className={`pf-drama-publish-episode${!episode.ready ? ' is-disabled' : ''}`}>
          <label><input type="checkbox" disabled={busy || !episode.ready || !storageReady} checked={selected.includes(episode.id)} onChange={event => { setSelected(value => event.target.checked ? [...value, episode.id] : value.filter(id => id !== episode.id)); setUpdates(value => value.filter(id => id !== episode.id)) }} /><span><strong>ตอนที่ {episode.episode_number} · {episode.name}</strong><small>{episode.completed_count}/{episode.fragment_count} ช็อตเสร็จสมบูรณ์{!episode.ready ? ` · ${episode.reason || 'วิดีโอยังไม่พร้อม'}` : relation.existing ? relation.changed ? ' · พบเวอร์ชันใหม่' : ' · ซิงค์แล้ว เวอร์ชันนี้จะถูกนำมาใช้โดยตรง' : ''}</small></span></label>
          {relation.changed && selected.includes(episode.id) && <label className="pf-drama-publish-update"><input type="checkbox" disabled={busy} checked={updates.includes(episode.id)} onChange={event => setUpdates(value => event.target.checked ? [...value, episode.id] : value.filter(id => id !== episode.id))} />ยืนยันการอัปเดตเป็นตอนใหม่ที่สมบูรณ์</label>}
        </div>
      })}{context.episodes.length === 0 && <p>โปรเจกต์นี้ยังไม่มีตอนย่อย</p>}</div>
      <label className="pf-drama-publish-field">เผยแพร่ไปยัง<select disabled={busy || Boolean(targetSeriesId)} value={targetId} onChange={event => { setTargetId(event.target.value); setUpdates([]) }}><option value="new">สร้างซีรีส์ละครสั้นใหม่ในตลาด</option>{context.series.map(item => <option key={item.id} value={item.id}>{item.title}{item.listed ? ' (เผยแพร่แล้ว)' : ''}</option>)}</select></label>
      {targetId === 'new' ? <label className="pf-drama-publish-field">ชื่อซีรีส์ในตลาด<input value={title} disabled={busy} maxLength={200} onChange={event => setTitle(event.target.value)} placeholder={context.project.title} /></label> : <p className="pf-drama-publish-hint">คงรายละเอียด ภาพปก และการตั้งค่ารายได้เดิมไว้ ตอนใหม่จะถูกต่อท้ายตามลำดับตอน</p>}
      {(changed.length > 0 || (target && (target.listed || target.audit_status === 'approved' || target.audit_status === 'pending'))) && <p className="pf-drama-publish-warning">หลังจากซิงค์อัปเดตหรือเพิ่มตอนใหม่ ซีรีส์จะกลับสู่สถานะฉบับร่างและหยุดการวางจำหน่ายชั่วคราวเพื่อส่งตรวจสอบใหม่ ผู้ซื้อเดิมยังคงสามารถดูเวอร์ชันที่เคยซื้อได้</p>}
      <p className="pf-drama-publish-hint"><CheckCircle2 size={15} />{context.authorization_ready ? 'หนังสือมอบอำนาจในปัจจุบันมีผลบังคับใช้ ระบบจะเชื่อมโยงให้อัตโนมัติหลังการซิงค์ ไม่จำเป็นต้องลงนามทีละตอน' : 'สามารถซิงค์และบันทึกฉบับร่างไว้ก่อนได้ โดยจะลงนามหนังสือมอบอำนาจ PrintFilm เพียงครั้งเดียวก่อนส่งซีรีส์ตรวจสอบ'}</p>
    </> : null}
    {error && <div className="pf-drama-publish-error" role="alert"><p>{error}</p><button type="button" disabled={busy || loading} onClick={() => setReload(value => value + 1)}>รีเฟรชสถานะตอนย่อย</button></div>}
  </Modal>
}
