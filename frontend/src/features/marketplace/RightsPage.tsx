import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { request, type RightsRecord } from './api'
import AssetPicker from './AssetPicker'
import { PageHeading } from './ui'
import AuthorizationPanel from './AuthorizationPanel'
import AssetPreview from './AssetPreview'

function safeDraftReturn(value: string | null) {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/marketplace/')) return ''
    return url.pathname + url.search
  } catch { return '' }
}

export default function RightsPage({ assetId: suppliedAssetId, sourceHint, embedded = false, onUpdated }: { assetId?: number; sourceHint?: string; embedded?: boolean; onUpdated?: () => void } = {}) {
  const params = useParams()
  const assetId = suppliedAssetId ?? Number(params.id)
  const [query] = useSearchParams()
  const backTo = safeDraftReturn(query.get('return'))
  const [source, setSource] = useState('external')
  const [item, setItem] = useState<RightsRecord | null>(null)
  const [certificate, setCertificate] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [support, setSupport] = useState<{ available: boolean; name?: string; wechat?: string; hours?: string; message?: string } | null>(null)
  const [qr, setQr] = useState('')
  useEffect(() => { let active = true; request<RightsRecord>(`/assets/${assetId}/rights`).then(value => { if (active) { setItem(value); setSource(sourceHint ?? (value.id ? value.details?.source : query.get('source')) ?? 'external'); setCertificate(value.certificate_asset_id ?? null) } }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [assetId, revision, query, sourceHint])
  async function save(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault()
    const form = e ? new FormData(e.currentTarget) : null
    setBusy(true); setError(''); setMessage('')
    try {
      await request(`/assets/${assetId}/rights`, 'PUT', { version: item?.version ?? 0, details: { source, certificate_number: String(form?.get('certificate_number') ?? ''), dispute_ack: form?.get('dispute_ack') === 'on' }, certificate_asset_id: source === 'printfilm' ? null : certificate, evidence_ids: [] })
      setMessage(backTo ? 'บันทึกข้อมูลลิขสิทธิ์แล้ว สามารถกลับไปที่หน้าร่างเพื่อแก้ไขต่อหรือส่งตรวจสอบ' : 'บันทึกข้อมูลลิขสิทธิ์แล้ว โปรดกลับไปที่หน้าร่างแล้วคลิก "ส่งตรวจสอบ"')
      setRevision(v => v + 1); onUpdated?.()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function contact() {
    setError('')
    try {
      const result = await request<{ available: boolean; name?: string; wechat?: string; hours?: string; message?: string }>('/support')
      setSupport(result)
      if (result.available) setQr((await request<{ url: string }>('/media/support/1/qr')).url)
    } catch (err) { setError((err as Error).message) }
  }
  if (!item) return <p role={error ? 'alert' : 'status'}>{error || '正在加载版权信息…'}</p>
  return <>{!embedded && <PageHeading title="ยืนยันข้อมูลลิขสิทธิ์" description="ข้อมูลลิขสิทธิ์และผลงานจะส่งตรวจสอบพร้อมกัน รายการที่ระบุว่าจำเป็นต้องกรอกให้ครบถ้วนก่อนบันทึก" back={backTo || '/marketplace/mine'} backLabel={backTo ? 'กลับไปแก้ไขแบบร่างต่อ' : 'กลับไปที่ผลงานของฉัน'} />}
    <section className="pf-market-rights-route"><h2>ยืนยันแหล่งที่มาของผลงาน</h2><label>แพลตฟอร์มสร้างวิดีโอ<select value={source} disabled={Boolean(sourceHint)} onChange={e => setSource(e.target.value)}><option value="printfilm">สร้างจาก PrintFilm</option><option value="external">สร้างจากแพลตฟอร์มอื่น</option></select></label><details><summary>ดูวิดีโอปัจจุบัน</summary><AssetPreview id={assetId} /></details>
      {source === 'printfilm' ? <><AuthorizationPanel onSigned={() => { void save() }} /><button type="button" disabled={busy} onClick={() => { void save() }}>ใช้หนังสืออนุญาตสิทธิ์ที่ลงนามแล้ว</button><p>บัญชีลงนามตามข้อกำหนดปัจจุบันเพียงครั้งเดียว ผลงาน PrintFilm ถัดไปสามารถอ้างอิงหนังสืออนุญาตสิทธิ์ที่มีผลได้ โดยไม่ต้องลงนามหรืออัปโหลดใบรับรองทีละรายการ</p></> : <><form className="pf-market-form" key={`${item.version}-${source}`} onSubmit={save}><label>หมายเลขทะเบียนลิขสิทธิ์<span className="pf-req-mark">จำเป็นต้องระบุ</span><input name="certificate_number" required maxLength={200} defaultValue={item.details?.certificate_number} /></label><AssetPicker kind="image" required value={certificate} onChange={setCertificate} title="ภาพถ่ายหรือภาพหน้าจอใบรับรองลิขสิทธิ์" /><label><input type="checkbox" name="dispute_ack" required defaultChecked={Boolean(item.details?.dispute_ack)} />ฉันยืนยันว่าเอกสารเป็นความจริง ข้อพิพาททางลิขสิทธิ์ไม่เกี่ยวข้องกับแพลตฟอร์ม<span className="pf-req-mark">จำเป็นต้องระบุ</span></label><button type="submit" disabled={busy || !certificate}>บันทึกข้อมูลลิขสิทธิ์</button></form><p>ยังขาดเอกสารหลักฐานลิขสิทธิ์? ติดต่อฝ่ายบริการลูกค้าเพื่อศึกษาขั้นตอนการประสานงาน เมื่อเอกสารครบถ้วนแล้วจึงส่งตรวจสอบ</p><button type="button" onClick={() => { void contact() }}>ติดต่อฝ่ายบริการลูกค้าเพื่อประสานงาน</button></>}
      {support && <div role="status">{support.available ? <><p>{support.name} · {support.wechat} · {support.hours}</p>{qr && <img src={qr} alt="平台客服二维码" style={{ maxWidth: 240 }} />}</> : <p>{support.message || '客服暂不可用'}</p>}</div>}
    </section>{message && <p role="status">{message}{backTo && <> <Link to={backTo}>กลับไปแก้ไขแบบร่างต่อ</Link></>}</p>}{error && <p role="alert">{error}</p>}</>
}
