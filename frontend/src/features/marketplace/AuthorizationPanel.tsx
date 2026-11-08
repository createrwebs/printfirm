import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Download, Eye, FileCheck2, ShieldCheck } from 'lucide-react'
import { date, letterFile, request } from './api'
import Modal from '../../components/ui/Modal'

type Signed = { id: number; signer_name: string; created_at: string; template_version: string }
type Status = { template: { version: string; title: string; notices: string[]; body: string }; current: Signed | null }
type Point = [number, number]
type Preview = { url: string; image: boolean }

/** 账号签署一次。条款在页面内阅读，已签署文件ค่าเริ่มต้น在线ดูตัวอย่าง，点ดาวน์โหลด才บันทึก。 */
export default function AuthorizationPanel({ onSigned }: { onSigned?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [name, setName] = useState('')
  const [adult, setAdult] = useState(false)
  const [readAll, setReadAll] = useState(false)
  const [acceptKey, setAcceptKey] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Point[][]>([])
  const drawing = useRef<number | null>(null)
  const ready = adult && readAll && acceptKey && name.trim().length >= 2
  useEffect(() => { let active = true; request<Status>('/authorization').then(value => { if (active) setStatus(value) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
  const previewUrl = useRef('')
  useEffect(() => {
    setPreview(null)
    setPreviewOpen(false)
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = ''
    }
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = ''
    }
  }, [status?.current?.id])
  function point(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return [Math.max(0, Math.min(800, (e.clientX - rect.left) / rect.width * 800)), Math.max(0, Math.min(240, (e.clientY - rect.top) / rect.height * 240))]
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (drawing.current !== e.pointerId) return
    const stroke = strokes.current[strokes.current.length - 1]
    if (stroke.length >= 1000) return
    const next = point(e), previous = stroke[stroke.length - 1]
    const ctx = canvas.current?.getContext('2d')
    if (ctx) { ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...previous); ctx.lineTo(...next); ctx.stroke() }
    stroke.push(next)
  }
  async function loadPreview() {
    if (preview) return preview
    const id = status?.current?.id
    if (!id) return null
    setPreviewBusy(true)
    setError('')
    try {
      const blob = await letterFile(id)
      const url = URL.createObjectURL(blob)
      previewUrl.current = url
      const value = { url, image: blob.type.startsWith('image/') }
      setPreview(value)
      return value
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setPreviewBusy(false)
    }
  }
  async function openPreview() {
    const value = await loadPreview()
    if (value) setPreviewOpen(true)
  }
  async function downloadLetter() {
    const value = await loadPreview()
    if (!value) return
    const link = document.createElement('a')
    link.href = value.url
    link.download = value.image ? 'หนังสืออนุญาตสิทธิ์.png' : 'หนังสืออนุญาตสิทธิ์.pdf'
    link.click()
    link.remove()
  }
  async function sign() {
    if (!status || !ready) return
    const valid = strokes.current.filter(stroke => stroke.length >= 2)
    if (valid.flat().length < 12) { setError('โปรดลงลายมือชื่อให้สมบูรณ์ในช่องลงนามก่อนกดยืนยันการลงนาม'); return }
    setBusy(true); setError('')
    try {
      const result = await request<Signed>('/authorization', 'POST', { template_version: status.template.version, signer_name: name.trim(), accepted_terms: true, adult: true, read_all: true, accept_key: true, strokes: valid })
      setStatus({ ...status, current: result }); onSigned?.()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="pf-market-authorization"><h2>หนังสืออนุญาตสิทธิ์ผลงาน PrintFilm</h2><p>ลงนามครั้งเดียวตามข้อกำหนดปัจจุบัน บัญชีนี้จะสามารถอ้างอิงผลงาน PrintFilm ได้ในอนาคต หนังสือฉบับนี้เป็นการอนุญาตให้ใช้งาน มิใช่การโอนลิขสิทธิ์</p>
    {status && <>
      <h3>{status.template.title}</h3>
      <p>版本 {status.template.version}</p>
      <ol className="pf-market-letter-notices">{status.template.notices.map(item => <li key={item}>{item}</li>)}</ol>
      <div className="pf-market-letter">{status.template.body}</div>
      {status.current ? <>
        <p className="pf-market-notice">ลงนามแล้ว: {status.current.signer_name} · {date(status.current.created_at)} สามารถคลิกดูตัวอย่างหรือดาวน์โหลดหนังสืออนุญาตสิทธิ์ที่ลงนามแล้ว</p>
        <div className="pf-market-letter-actions"><button type="button" onClick={() => { void openPreview() }} disabled={previewBusy}>{previewBusy ? 'กำลังเปิด…' : 'ดูตัวอย่างหนังสืออนุญาตสิทธิ์'}</button><button type="button" onClick={() => { void downloadLetter() }} disabled={previewBusy}>{previewBusy ? 'กำลังประมวลผล…' : 'ดาวน์โหลดหนังสืออนุญาตสิทธิ์'}</button></div>
        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="ดูตัวอย่างหนังสืออนุญาตสิทธิ์" size="xl" className="pf-market-letter-modal">
          <div className="pf-market-letter-modal-summary">
            <div className="pf-market-letter-modal-summary-top">
              <span className="pf-market-letter-modal-eyebrow"><ShieldCheck size={14} /> PRINTFILM · ตลาดดิจิทัลแอสเซท</span>
              <span className="pf-market-letter-modal-status"><FileCheck2 size={13} /> ลงนามแล้ว</span>
            </div>
            <strong>หนังสือมอบอำนาจบัญชี</strong>
            <span className="pf-market-letter-modal-meta">ผู้ลงนาม: {status.current.signer_name} · {date(status.current.created_at)} · ข้อกำหนด {status.current.template_version}</span>
            <p>ส่วนนี้แสดงข้อตกลงการอนุญาตสิทธิ์ที่ลงนามแล้ว ขอบเขตการอนุญาตเป็นไปตามเนื้อหาของข้อตกลง การดูตัวอย่างออนไลน์จะไม่ดาวน์โหลดไฟล์โดยอัตโนมัติ</p>
          </div>
          <div className="pf-market-letter-preview-surface">
            <div className="pf-market-letter-preview-label"><Eye size={14} /> ตัวอย่างเอกสาร</div>
            {preview && (preview.image ? <img className="pf-market-letter-image" src={preview.url} alt="หนังสืออนุญาตสิทธิ์ที่ลงนามแล้ว" /> : <iframe className="pf-market-letter-frame" src={preview.url} title="ดูตัวอย่างหนังสืออนุญาตสิทธิ์" />)}
          </div>
          <div className="pf-market-letter-modal-actions"><button type="button" className="pf-market-letter-modal-secondary" onClick={() => setPreviewOpen(false)}>ปิด</button><button type="button" className="pf-market-letter-modal-primary" onClick={() => { void downloadLetter() }} disabled={previewBusy}><Download size={14} /> {previewBusy ? 'กำลังประมวลผล…' : 'ดาวน์โหลดหนังสืออนุญาตสิทธิ์'}</button></div>
        </Modal>
      </> : <div className="pf-market-fields">
        <label>ชื่อ-นามสกุลจริงของผู้ลงนาม<input value={name} minLength={2} maxLength={80} onChange={e => setName(e.target.value)} disabled={busy} /></label>
        <p>ลงลายมือชื่อที่ช่องด้านล่าง (รองรับเมาส์หรือหน้าจอสัมผัส)</p>
        <canvas aria-label="พื้นที่ลงลายมือชื่อ" ref={canvas} width={800} height={240} className="pf-market-signature" onPointerDown={e => { if (busy || drawing.current !== null || strokes.current.length >= 40) return; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 当前指针无法捕获时仍记录笔画 */ } drawing.current = e.pointerId; strokes.current.push([point(e)]) }} onPointerMove={move} onPointerUp={e => { if (drawing.current === e.pointerId) drawing.current = null }} onPointerCancel={() => { drawing.current = null }} />
        <button type="button" disabled={busy} onClick={() => { strokes.current = []; canvas.current?.getContext('2d')?.clearRect(0, 0, 800, 240) }}>ล้างลายมือชื่อ</button>
        <label><input type="checkbox" checked={adult} disabled={busy} onChange={e => setAdult(e.target.checked)} />ฉันมีอายุครบ 18 ปีบริบูรณ์ มีความสามารถตามกฎหมาย และชื่อที่ระบุเป็นความจริง</label>
        <label><input type="checkbox" checked={readAll} disabled={busy} onChange={e => setReadAll(e.target.checked)} />ฉันได้อ่านข้อกำหนดของข้อตกลงนี้อย่างครบถ้วนแล้ว</label>
        <label><input type="checkbox" checked={acceptKey} disabled={busy} onChange={e => setAcceptKey(e.target.checked)} />ฉันได้อ่านและยอมรับข้อที่ 7, 8, 10, 11, 13 และ 15 เป็นกรณีพิเศษแล้ว</label>
        <button type="button" disabled={busy || !ready} onClick={sign}>{busy ? 'กำลังบันทึกข้อมูล…' : 'ยืนยันการลงนามและบันทึกหนังสืออนุญาตสิทธิ์'}</button>
      </div>}
    </>}
    {!status && !error && <p role="status">กำลังโหลดข้อกำหนดการอนุญาตสิทธิ์…</p>}{error && <p role="alert">{error}</p>}
  </section>
}
