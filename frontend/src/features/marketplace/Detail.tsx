import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { date, labels, money, request, type Row } from './api'
import { Contact, Media, NeedLogin, ReportForm } from './shared'
import { PageHeading } from './ui'
import WorkPublishingSteps from './WorkPublishingSteps'
import { dialog } from '../../lib/dialog'
import { isFreeWork } from './playbackPolicy'

// หน้ารายละเอียดสาธารณะแยกจากการจัดการของผู้สร้างสรรค์
export default function Detail({ recruit = false, manage = false }: { recruit?: boolean; manage?: boolean }) {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const [item, setItem] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [preview, setPreview] = useState(false)
  const [retryingPreview, setRetryingPreview] = useState(false)
  const previewActive = Boolean(item && !isFreeWork(item) && (item.preview_status === 'pending' || item.preview_status === 'running'))
  useEffect(() => { let active = true; setItem(null); setError(''); request<Row>(`/${recruit ? 'recruits' : 'works'}/${id}`).then(value => { if (active) setItem(value) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [id, recruit, refresh])
  async function action(path: string, body?: unknown) {
    setError(''); setMessage('')
    try { await request(path, 'POST', body); setMessage('ดำเนินการสำเร็จ'); setRefresh(v => v + 1) }
    catch (err) { setError((err as Error).message) }
  }
  useEffect(() => {
    if (!manage || recruit || (item?.audit_status !== 'processing' && !previewActive)) return
    let active = true
    const timer = window.setInterval(() => {
      request<Row>(`/works/${id}`).then(fresh => { if (active) setItem(fresh) }).catch(err => { if (active) setError(err.message) })
    }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [id, manage, recruit, item?.audit_status, previewActive])
  if (!item) return <p role={error ? 'alert' : 'status'}>{error || 'กำลังโหลด…'}</p>
  const privateView = manage && item.version !== undefined
  const submitIssues = [
    !item.asset_id ? 'กรุณาอัปโหลดและบันทึกวิดีโอผลงานก่อน' : item.media_status !== 'ready' ? 'วิดีโอผลงานยังไม่พร้อมใช้งาน กรุณาตรวจสอบสถานะการอัปโหลด' : '',
    !item.rights_complete ? 'กรุณาแนบเอกสารลิขสิทธิ์ให้ครบถ้วน (หนังสือมอบอำนาจ PrintFilm หรือหลักฐานลิขสิทธิ์จากแพลตฟอร์มอื่น)' : '',
    !item.license_scope?.trim() ? 'กรุณาระบุ «วัตถุประสงค์และข้อจำกัดในการอนุญาต» ในหน้าแก้ไขฉบับร่าง' : '',
    item.blocked ? 'ผลงานถูกระงับการใช้งาน กรุณาติดต่อฝ่ายบริการลูกค้า' : '',
  ].filter(Boolean)
  const canSubmitWork = submitIssues.length === 0
  async function refreshProgress() {
    try { setItem(await request<Row>(`/works/${id}`)) } catch (e) { setError((e as Error).message) }
  }
  async function retryPreview() {
    if (!item || retryingPreview || previewActive) return
    setRetryingPreview(true); setError(''); setMessage('')
    try {
      setItem(await request<Row>(`/works/${id}/preview/retry`, 'POST', { version: item.version }))
      setMessage('จัดคิวสร้างตัวอย่างสั้นใหม่แล้ว สามารถติดตามความคืบหน้าได้ที่นี่')
    } catch (err) { setError((err as Error).message) } finally { setRetryingPreview(false) }
  }
  async function removeWork() {
    const ok = await dialog.confirm({ title: 'ลบผลงาน', message: 'หลังจากลบ ผลงานจะถูกนำออกจากผลงานของฉันและหน้ารวมผลงาน ไฟล์และประวัติการตรวจสอบจะถูกเก็บไว้ แต่จะไม่แสดงผลอีกต่อไป', confirmText: 'ลบ', tone: 'danger' })
    if (!ok) return
    try { await request(`/works/${id}`, 'DELETE'); navigate('/marketplace/mine') } catch (err) { setError((err as Error).message) }
  }
  if (manage && !privateView) return <p role="alert">ไม่มีสิทธิ์จัดการรายการนี้ กรุณาดูรายละเอียดสาธารณะจากหน้ารวมผลงาน</p>
  if (!recruit && !manage) return <>
    <PageHeading title={item.title || 'รายละเอียดผลงาน'} description={`${item.author || 'ผู้สร้างสรรค์'} · ${item.category || 'ทั่วไป'}`} back="/marketplace" />
    <div className="pf-market-buyer-layout">
      <section className="pf-market-buyer-player" aria-label="พรีวิววิดีโอผลงาน"><Media kind="work" id={id} purpose="preview" video /></section>
      <aside className="pf-market-buyer-info"><span className="pf-market-badge">ผลงานวิดีโอ</span><h2>{item.title}</h2><p>ผู้สร้างสรรค์ · {item.author || 'ผู้สร้างสรรค์'}</p><div className="pf-market-buyer-price"><span>{isFreeWork(item) ? 'เปิดให้ดูฟรี' : item.sale_type === 'platform_unlock' ? 'ราคาปลดล็อกสำหรับผู้ชม' : 'ราคาอ้างอิง'}</span><strong>{isFreeWork(item) ? 'ฟรี' : money(item.sale_type === 'platform_unlock' ? item.unlock_price_fen : item.price_fen)}</strong></div>{item.sale_type === 'copyright_contact' && <Contact kind="work" id={id} />}<small>{isFreeWork(item) ? 'ผลงานฟรีสามารถรับชมได้เต็มความยาว การนำไปใช้ต้องปฏิบัติตามขอบเขตการอนุญาตของผู้เขียน' : item.sale_type === 'platform_unlock' ? 'หลังจากซื้อแล้วสามารถรับชมออนไลน์ได้ตลอดไป ไม่รวมการโอนลิขสิทธิ์ หน้านี้แสดงเพียงตัวอย่างสั้น' : 'ปัจจุบันเป็นตัวอย่างสั้นไม่มีลายน้ำ ความยาวไม่เกิน 15 วินาทีและไม่เกิน 30% ของความยาวเดิม สนใจความร่วมมือด้านลิขสิทธิ์โปรดติดต่อฝ่ายบริการลูกค้า เพื่อยืนยันราคา ขอบเขต และการส่งมอบ'}</small><ReportForm kind="work" id={id} /></aside>
    </div>
    <section className="pf-market-detail-section"><h2>คำแนะนำผลงาน</h2><p className="pf-market-text">{item.description || 'ยังไม่ได้ระบุรายละเอียด'}</p><h2>วัตถุประสงค์และขอบเขตการอนุญาต</h2><p className="pf-market-text">{item.license_scope || 'กรุณาติดต่อฝ่ายบริการลูกค้าเพื่อยืนยันขอบเขตการอนุญาต'}</p><p>ผ่านการตรวจสอบเนื้อหาและเอกสารลิขสิทธิ์แล้ว {item.sale_type === 'copyright_contact' ? 'การอนุญาตหรือโอนลิขสิทธิ์เป็นไปตามสัญญาที่ทำขึ้นระหว่างสองฝ่าย' : 'สิทธิ์ในการรับชมไม่เท่ากับการได้มาซึ่งลิขสิทธิ์ การนำไปใช้ยังคงต้องอยู่ภายใต้ขอบเขตที่ผู้เขียนกำหนด'}</p></section>
  </>
  if (recruit && !manage) return <>
    <PageHeading title={item.title || 'รายละเอียดการรับสมัคร'} description={`${item.author || 'ผู้ประกาศความต้องการ'} · ${item.category || 'ทั่วไป'} · ${date(item.created_at)}`} back="/marketplace/recruits" />
    <div className="pf-market-detail-intro">
      <div><span className="pf-market-category-tag">ความต้องการสร้างสรรค์</span><p className="pf-market-text">{item.description || 'ยังไม่ได้ระบุรายละเอียด'}</p></div>
      <div className="pf-market-detail-price"><span>งบประมาณต่องาน</span><strong>{money(item.budget_fen)}</strong><small>เงื่อนไขความร่วมมือจะได้รับการยืนยันโดยฝ่ายบริการลูกค้า</small></div>
    </div>
    <section className="pf-market-detail-section"><h2>ความต้องการและข้อกำหนดการส่งมอบ</h2><p>จำนวนที่ต้องการ {item.wanted_count} ชิ้น · สิ้นสุด {date(item.deadline_at)}</p><p className="pf-market-text">{item.requirements}</p><h2>วัตถุประสงค์และขอบเขตการอนุญาต</h2><p className="pf-market-text">{item.license_scope || 'ข้อกำหนดการอนุญาตเฉพาะกรุณาติดต่อฝ่ายบริการลูกค้าเพื่อยืนยัน'}</p>{Boolean(item.image_ids?.length) && <><h2>รูปภาพอ้างอิง</h2>{item.image_ids?.map((image, index) => <Media key={image} kind="recruit" id={id} purpose={`image-${index}`} />)}</>}</section>
    <section className="pf-market-detail-section"><h2>{item.is_owner ? 'ความต้องการรับสมัครของคุณ' : 'ต้องการรับงานนี้ใช่หรือไม่?'}</h2>
      {item.is_owner ? <p>ผู้สร้างสรรค์จะติดต่อรับงานผ่านฝ่ายบริการลูกค้าของแพลตฟอร์ม โดยเจ้าหน้าที่จะช่วยประสานงาน <Link to={`/marketplace/recruits/${id}/manage`}>จัดการการรับสมัครของฉัน</Link></p> : !item.is_open ? <p className="pf-market-notice">การรับสมัครนี้สิ้นสุดแล้ว ไม่รับการสอบถามใหม่ในขณะนี้</p> : <><p>ติดต่อฝ่ายบริการลูกค้าของแพลตฟอร์ม แจ้งหมายเลขการรับสมัครและความตั้งใจของคุณ เจ้าหน้าที่จะช่วยยืนยันความต้องการ งบประมาณ ลิขสิทธิ์ และการส่งมอบ</p><div className="pf-market-actions"><NeedLogin><Contact kind="recruit" id={id} /></NeedLogin></div><small>การพูดคุยรายละเอียดจะดำเนินการผ่านเจ้าหน้าที่ การติดต่อไม่ได้หมายความว่าได้รับงานหรือตกลงการซื้อขายแล้ว</small></>}
    </section>
    <ReportForm kind="recruit" id={id} />
  </>
  return <><PageHeading title={item.title || (recruit ? 'รายละเอียดการรับสมัคร' : 'รายละเอียดผลงาน')} description={`${item.author || 'ผู้สร้างสรรค์'} · ${item.category || 'ทั่วไป'} · ${date(item.created_at)}`} back={manage ? '/marketplace/mine' : recruit ? '/marketplace/recruits' : '/marketplace'} /><div className="pf-market-detail-intro"><div><span className="pf-market-category-tag">{recruit ? 'ความต้องการสร้างสรรค์' : 'ผลงานวิดีโอ'}</span><p className="pf-market-text">{item.description || 'ยังไม่ได้ระบุรายละเอียด'}</p></div><div className="pf-market-detail-price"><span>{recruit ? 'งบประมาณต่องาน' : isFreeWork(item) ? 'เปิดให้ดูฟรี' : item.sale_type === 'platform_unlock' ? 'ราคาปลดล็อกสำหรับผู้ชม' : 'ราคาอ้างอิง'}</span><strong>{!recruit && isFreeWork(item) ? 'ฟรี' : money(recruit ? item.budget_fen : item.sale_type === 'platform_unlock' ? item.unlock_price_fen : item.price_fen)}</strong><small>{recruit || item.sale_type === 'copyright_contact' ? 'ความร่วมมือและการอนุญาตจะประสานงานผ่านฝ่ายบริการลูกค้า' : item.sale_type === 'platform_unlock' ? 'สิทธิ์รับชมออนไลน์ตลอดไปตามเวอร์ชันที่ซื้อ ไม่รวมการโอนลิขสิทธิ์' : 'รับชมฟรีเต็มเรื่อง การนำไปใช้ต้องปฏิบัติตามขอบเขตที่ผู้เขียนกำหนด'}</small></div></div><section className="pf-market-detail-section"><h2>วัตถุประสงค์และขอบเขตการอนุญาต</h2><p className="pf-market-text">{item.license_scope || 'กรุณาติดต่อผู้เผยแพร่เพื่อขอข้อมูลการอนุญาตเพิ่มเติม'}</p>
    {recruit ? <><p>รับสมัคร {item.wanted_count} ชิ้น · สิ้นสุด {date(item.deadline_at)}</p><p className="pf-market-text">{item.requirements}</p>{item.image_ids?.map((_, index) => <Media key={index} kind="recruit" id={id} purpose={`image-${index}`} />)}</> : <><p>ผลงานและเอกสารลิขสิทธิ์จะถูกส่งพร้อมกันเพื่อให้ผู้ดูแลระบบตรวจสอบ หลังจากอนุมัติแล้วคุณสามารถนำขึ้นแสดงได้ด้วยตนเอง</p><button type="button" disabled={privateView && (!item.asset_id || item.media_status !== 'ready')} onClick={() => setPreview(!preview)}>เล่น / ปิดพรีวิวผลงาน</button>{preview && <Media kind={privateView ? 'asset' : 'work'} id={privateView ? item.asset_id ?? 0 : id} purpose="preview" video />}</>}
    </section>{privateView && !recruit && <WorkPublishingSteps item={item} onUpdated={() => { void refreshProgress() }} />}{privateView && <section><h2>การจัดการเผยแพร่</h2>{!recruit && submitIssues.length > 0 && <div className="pf-market-notice" role="status"><strong>ก่อนส่งต้องดำเนินการให้เสร็จสิ้น:</strong><ul>{submitIssues.map(issue => <li key={issue}>{issue}</li>)}</ul><Link to={`/marketplace/works/${id}/edit`}>ไปที่การแก้ไขฉบับร่าง</Link></div>}{item.audit_status === 'processing' && <p role="status">กำลังสร้างตัวอย่างสั้น เมื่อเสร็จแล้วจะเข้าสู่สถานะรอการตรวจสอบโดยอัตโนมัติ สามารถปิดหน้านี้แล้วกลับมาดูภายหลังได้</p>}<p>{recruit ? 'การตรวจสอบรับสมัคร' : 'การตรวจสอบผลงาน'}：{labels[item.audit_status ?? ''] || item.audit_status} · {recruit ? labels[item.state ?? ''] : item.listed ? 'เผยแพร่แล้ว' : 'ยังไม่ได้นำขึ้นแสดง'}{item.blocked ? ' · ถูกระงับ' : ''}</p><p>{item.reason}</p><div className="pf-market-actions"><Link to={`/marketplace/${recruit ? 'recruits' : 'works'}/${id}/edit`}>แก้ไขฉบับร่าง</Link><button type="button" disabled={!recruit && (!canSubmitWork || item.audit_status === 'processing' || item.audit_status === 'pending' || item.audit_status === 'approved')} onClick={() => action(`/${recruit ? 'recruits' : 'works'}/${id}/submit`, { version: item.version })}>{item.audit_status === 'processing' ? 'กำลังสร้างตัวอย่างสั้น…' : item.audit_status === 'preview_failed' ? 'ลองสร้างตัวอย่างสั้นใหม่และส่ง' : 'ส่งตรวจสอบ'}</button>{recruit ? <button type="button" onClick={() => { if (window.confirm('หลังจากปิดจะออกจากตลาดการรับสมัคร และหยุดการสอบถามรับงานใหม่ ยืนยันปิด?')) void action(`/recruits/${id}/close`) }}>ปิดการรับสมัคร</button> : <><button type="button" disabled={!item.listed && (!canSubmitWork || item.audit_status !== 'approved')} onClick={() => action(`/works/${id}/listing?listed=${!item.listed}`, { version: item.version })}>{item.listed ? 'นำลง' : 'นำขึ้นแสดง'}</button>{item.asset_id && <Link to={`/marketplace/assets/${item.asset_id}/rights?source=${item.source || 'external'}&return=${encodeURIComponent(`/marketplace/works/${id}/edit`)}`}>ยืนยันข้อมูลลิขสิทธิ์</Link>}<button type="button" onClick={() => void removeWork()}>ลบผลงาน</button></>}</div></section>}
    {privateView && !recruit && item.audit_status === 'approved' && !isFreeWork(item) && (item.preview_status === 'failed' || previewActive) && <section aria-label="แก้ไขตัวอย่างสั้น"><p role="status">{previewActive ? 'กำลังสร้างตัวอย่างสั้น สามารถปิดหน้านี้แล้วกลับมาดูภายหลังได้' : 'สร้างตัวอย่างสั้นไม่สำเร็จ สามารถลองใหม่ได้ทันที'}</p><button type="button" disabled={retryingPreview || previewActive || item.blocked} onClick={() => void retryPreview()}>{retryingPreview || previewActive ? 'กำลังสร้างตัวอย่างสั้น…' : 'ลองสร้างตัวอย่างสั้นใหม่'}</button></section>}
    {recruit && <p className="pf-market-notice">หลังผ่านการตรวจสอบ ผู้สร้างสรรค์สามารถติดต่อสื่อสารรับงานผ่านฝ่ายบริการลูกค้า ข้อตกลง สัญญา และการส่งมอบจะยืนยันตามขั้นตอน</p>}
    <div className="pf-market-actions">{(recruit || (item.sale_type === 'copyright_contact')) && <Contact kind={recruit ? 'recruit' : 'work'} id={id} label={recruit ? 'ติดต่อฝ่ายบริการลูกค้า' : undefined} />}<ReportForm kind={recruit ? 'recruit' : 'work'} id={id} /></div>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}</>
}
