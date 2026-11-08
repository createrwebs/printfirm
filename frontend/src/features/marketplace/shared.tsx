import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleUserRound, Grid2X2, Info, LockKeyhole, Plus, Store, UsersRound } from 'lucide-react'
import Button from '../../components/ui/Button'
import { EmptyState } from './ui'
import { request, media, money, type Listing } from './api'
import { useMarketplace } from './hooks'
import AssetPicker from './AssetPicker'

export function Gate({ children }: { children: ReactNode }) {
  const { capabilities, error } = useMarketplace()
  if (error) return <p role="alert">{error}</p>
  if (!capabilities) return <p role="status">กำลังตรวจสอบสถานะการให้บริการ…</p>
  if (!capabilities.enabled) return <p>ตลาดดิจิทัลแอสเซทยังไม่เปิดใช้งาน</p>
  return <><MarketNav />{!capabilities.storage_configured && <div className="pf-market-storage-note" role="note"><Info size={17} aria-hidden /><p><strong>ระบบจัดเก็บไฟล์ยังไม่ได้กำหนดค่า</strong><span>สามารถบันทึกฉบับร่างข้อความและความต้องการที่ไม่มีไฟล์แนบได้ การอัปโหลดและการเผยแพร่สื่อยังไม่พร้อมใช้งานชั่วคราว</span></p></div>}{children}</>
}

export function NeedLogin({ children }: { children: ReactNode }) {
  if (!localStorage.getItem('token')) return <EmptyState title="เข้าสู่ระบบเพื่อเริ่มต้นโอกาสสร้างสรรค์ของคุณ" description="จัดการผลงาน ประกาศความต้องการ และสร้างความร่วมมือกับผู้สร้างสรรค์คนอื่นๆ" action="เข้าสู่ระบบ / ลงทะเบียน" to={`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} />
  return children
}

export function MarketNav() {
  return <><header className="pf-market-top"><div className="pf-market-brand"><span className="pf-market-brand-icon"><Store size={22} strokeWidth={1.7} /></span><div><p className="pf-market-eyebrow">PRINTFILM MARKETPLACE</p><p className="pf-market-title">ตลาดดิจิทัลแอสเซท</p></div></div><div className="pf-market-publish-actions"><Button to="/marketplace/recruits/new" variant="outline" size="sm" icon><Plus size={16} />สร้างประกาศรับสมัคร</Button><Button to="/marketplace/works/new" variant="lime" size="sm" icon><Plus size={16} />เผยแพร่ผลงาน</Button></div></header><div className="pf-market-nav-row"><nav className="pf-market-nav" aria-label="แถบนำทางตลาดดิจิทัลแอสเซท"><NavLink to="/marketplace" end><Grid2X2 size={17} />ผลงานในตลาด</NavLink><NavLink to="/marketplace/recruits" end><UsersRound size={18} />ประกาศรับสมัคร</NavLink><NavLink to="/marketplace/mine"><CircleUserRound size={17} />การเผยแพร่และการแจ้งเตือนของฉัน</NavLink></nav><span className="pf-market-nav-hint"><LockKeyhole size={13} />เอกสารลิขสิทธิ์ · ตรวจสอบร่วมกัน</span></div></>
}

export function Pager({ listing, page, change }: { listing: Listing | null; page: number; change: (value: number) => void }) {
  const pages = listing ? Math.max(1, Math.ceil(listing.meta.total / listing.meta.page_size)) : 1
  return <div className="pf-market-pagination"><span>ทั้งหมด {listing?.meta.total ?? 0} รายการ</span><div><button type="button" disabled={page <= 1} onClick={() => change(page - 1)}><ChevronLeft size={15} />หน้าก่อนหน้า</button><span>{page} / {pages}</span><button type="button" disabled={!listing || page >= pages} onClick={() => change(page + 1)}>หน้าถัดไป<ChevronRight size={15} /></button></div></div>
}

export function Media({ kind, id, purpose, video = false, autoPlay = false, onEnded }: { kind: string; id: number; purpose: string; video?: boolean; autoPlay?: boolean; onEnded?: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => { let active = true; setUrl(''); setError(''); media(kind, id, purpose).then(value => { if (active) setUrl(value) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [kind, id, purpose, reload])
  if (error) return <p role="alert">{error}<button type="button" onClick={() => setReload(reload + 1)}>ลองใหม่</button></p>
  if (!url) return <p role="status">กำลังโหลดสื่อ…</p>
  return video ? <video className="pf-market-video" src={url} controls controlsList="nodownload" preload="metadata" autoPlay={autoPlay} onEnded={onEnded} onError={() => setError('ลิงก์วิดีโออาจหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง')} /> : <img className="pf-market-cover" src={url} alt="ผลงานหรือไฟล์แนบ" onError={() => setError('ลิงก์รูปภาพอาจหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง')} />
}

export function Contact({ kind, id, disabled = false, label }: { kind: string; id: number; disabled?: boolean; label?: string }) {
  const [detail, setDetail] = useState<{ reference: string; title: string; price_fen: number | null; name: string; wechat: string; hours: string; notice: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  async function open() {
    setBusy(true); setError('')
    try { setDetail(await request('/consultations', 'POST', { target_type: kind, target_id: id })) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopyMessage('คัดลอกแล้ว') }
    catch { setCopyMessage('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความด้านล่างแล้วคัดลอกด้วยตนเอง') }
  }
  const text = detail ? `${detail.reference}｜${detail.title}｜${detail.price_fen === null ? '' : money(detail.price_fen)}｜${window.location.href}` : ''
  return <><button type="button" className="pf-market-buy" disabled={disabled || busy} onClick={open}>{disabled ? 'รอตรวจสอบเอกสารลิขสิทธิ์' : busy ? 'กำลังเชื่อมต่อฝ่ายบริการลูกค้า…' : label ? label : kind === 'case' ? 'ติดต่อฝ่ายบริการลูกค้าเพื่อประสานงาน' : kind === 'recruit' ? 'ติดต่อฝ่ายบริการลูกค้าเพื่อรับงาน' : 'ติดต่อฝ่ายบริการลูกค้าเพื่อซื้อ'}</button>{error && <p role="alert">{error}</p>}{detail && <div className="pf-market-modal" role="dialog" aria-modal="true" aria-label="ติดต่อฝ่ายบริการลูกค้า" onKeyDown={e => { if (e.key === 'Escape') setDetail(null) }}><section><button type="button" autoFocus onClick={() => setDetail(null)}>ปิด</button><h2>{detail.name}</h2><Media kind="support" id={1} purpose="qr" /><p>WeChat: {detail.wechat} · {detail.hours}</p><p>{detail.notice}</p>{(kind === 'work' || kind === 'submission' || kind === 'series_episode') && <div className="pf-market-purchase-notice"><strong>ข้อควรรู้ในการซื้อลิขสิทธิ์</strong><p>หากต้องการซื้อลิขสิทธิ์ผลงาน (การโอนทรัพย์สินทางปัญญา) จำเป็นต้องทำสัญญาเป็นลายลักษณ์อักษรแยกต่างหาก และดำเนินการโอนลิขสิทธิ์ตามข้อตกลง ซึ่งอาจมีค่าธรรมเนียมการโอน การจดทะเบียน หรือค่าบริการ โปรดตรวจสอบขั้นตอน รายการค่าใช้จ่าย และผู้รับผิดชอบกับฝ่ายบริการลูกค้าก่อน</p><p>ราคาอ้างอิงบนหน้าเว็บไม่รวมค่าธรรมเนียมดังกล่าว การซื้อสิทธิ์ใช้งานไม่เท่ากับการได้มาซึ่งลิขสิทธิ์ผลงาน</p></div>}<p className="pf-market-copy">{text}</p><button type="button" onClick={() => copy(text)}>คัดลอกข้อมูลการสอบถาม</button><p role="status">{copyMessage}</p><p>สามารถคลิกขวาหรือกดค้างที่ QR code เพื่อบันทึกรูปภาพ</p></section></div>}</>
}

export function ReportForm({ kind, id }: { kind: string; id: number }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [evidence, setEvidence] = useState<number[]>([])
  return <><button type="button" onClick={() => setOpen(!open)}>รายงาน</button>{open && <NeedLogin><form className="pf-market-form" onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); try { await request('/reports', 'POST', { target_type: kind, target_id: id, statement: form.get('statement'), contact: form.get('contact'), evidence_ids: evidence }); setMessage('ส่งรายงานเรียบร้อยแล้ว แพลตฟอร์มจะตรวจสอบและส่งการแจ้งเตือนในระบบให้ทราบ') } catch (error) { setMessage((error as Error).message) } }}><label>คำอธิบายการรายงาน (อย่างน้อย 10 ตัวอักษร)<textarea name="statement" required minLength={10} maxLength={5000} /></label><label>ช่องทางติดต่อ (ไม่เปิดเผยต่อสาธารณะ)<input name="contact" required maxLength={200} /></label><p>หลักฐานประกอบ: {evidence.map(value => <button type="button" key={value} onClick={() => setEvidence(evidence.filter(item => item !== value))}>นำออก #{value}</button>)}</p>{evidence.length < 10 && <AssetPicker kind="document" value={null} onChange={value => setEvidence(previous => [...new Set([...previous, value])].slice(0, 10))} title="เพิ่มหลักฐานการรายงาน (ไม่บังคับ)" />}<button type="submit">ส่งรายงาน</button><p role="status">{message}</p></form></NeedLogin>}</>
}
