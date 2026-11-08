import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AssetPicker from './AssetPicker'
import { localDate, request, type Row } from './api'
import { Save } from 'lucide-react'
import Button from '../../components/ui/Button'
import { FormSection, PageHeading, PublishGuide } from './ui'

// 需求可以无附件发布；实质条款锁定由服务端最终校验。
export default function RecruitEditor() {
  /* item 需求快照；images ภาพอ้างอิง；error/busy บันทึก反馈。 */
  const { id } = useParams(); const navigate = useNavigate()
  const [item, setItem] = useState<Row | null>(null)
  const [images, setImages] = useState<number[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (id) request<Row>(`/recruits/${id}`).then(value => { setItem(value); setImages(value.image_ids ?? []) }).catch(e => setError(e.message)) }, [id])
  // 保留服务器版本，避免旧表单覆盖最新需求及审核结果。
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError('')
    const body = { title: form.get('title'), description: form.get('description'), category: form.get('category'), budget_fen: Math.round(Number(form.get('budget')) * 100), wanted_count: Number(form.get('count')), requirements: form.get('requirements'), license_scope: form.get('license_scope'), deadline_at: new Date(String(form.get('deadline'))).toISOString(), image_ids: images, ...(id ? { version: item?.version } : {}) }
    try { const result = await request<Row>(id ? `/recruits/${id}` : '/recruits', id ? 'PUT' : 'POST', body); navigate(`/marketplace/recruits/${result.id}/manage`) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  if (id && !item) return <p role={error ? 'alert' : 'status'}>{error || '正在加载…'}</p>
  return <><PageHeading title={id ? 'แก้ไขการรับสมัคร' : 'ลงประกาศรับสมัคร'} description="อธิบายความต้องการสร้างสรรค์ เมื่อผ่านการตรวจสอบแล้วฝ่ายบริการลูกค้าจะช่วยประสานงานกับครีเอเตอร์" back="/marketplace/recruits" />{Boolean(item?.submission_count) && <p className="pf-market-notice">ความต้องการนี้มีประวัติความร่วมมือในเวอร์ชันเดิม เพื่อรักษาข้อตกลงเดิม งบประมาณ วัตถุประสงค์ การอนุญาตสิทธิ์ การส่งมอบ และเงื่อนไขวันสิ้นสุดจะไม่สามารถแก้ไขได้ หากต้องการเปลี่ยนแปลงสำคัญ โปรดปิดประกาศแล้วสร้างใหม่</p>}<div className="pf-market-editor-layout"><form className="pf-market-form" onSubmit={save}>
    <FormSection step="01" title="อธิบายความต้องการสร้างสรรค์" description="ระบุให้ชัดเจนว่าต้องการทำอะไร และผลงานจะถูกนำไปใช้ในฉากหรือโอกาสใด"><label>หัวข้อ<input name="title" required maxLength={200} placeholder="ตัวอย่างเช่น: เปิดรับสมัครคลิปสั้นสำหรับโปรเจกต์ส่งเสริมการท่องเที่ยว" defaultValue={item?.title} /></label><label>รายละเอียดความต้องการ<textarea name="description" required maxLength={5000} placeholder="แนะนำเบื้องหลังโปรเจกต์ กลุ่มผู้ชมเป้าหมาย และทิศทางเนื้อหาที่คาดหวัง" defaultValue={item?.description} /></label><label>หมวดหมู่<input name="category" required maxLength={60} defaultValue={item?.category ?? 'ทั่วไป'} /></label></FormSection>
    <FormSection step="02" title="งบประมาณและการส่งมอบ" description="ระบุงบประมาณที่คาดการณ์และข้อกำหนดการส่งมอบ โดยเงื่อนไขความร่วมมือเฉพาะเจาะจงจะได้รับการประสานงานผ่านฝ่ายบริการลูกค้า"><div className="pf-market-field-row"><label>งบประมาณต่อชิ้น (บาท)<input name="budget" required type="number" min="0.01" max="1000000" step="0.01" placeholder="0.00" defaultValue={item?.budget_fen ? item.budget_fen / 100 : ''} /></label><label>จำนวนที่ต้องการรับสมัคร<input name="count" required type="number" min="1" max="10000" defaultValue={item?.wanted_count ?? 1} /></label></div><label>ข้อกำหนดการส่งมอบ (ความยาว, อัตราส่วนภาพ, วัตถุประสงค์ ฯลฯ)<textarea name="requirements" required maxLength={3000} placeholder="ตัวอย่างเช่น: 30 วินาที, จอแนวนอน 16:9, ใช้สำหรับประชาสัมพันธ์แบรนด์; ระบุรูปแบบไฟล์ส่งมอบให้ชัดเจน" defaultValue={item?.requirements} /></label><label>ขอบเขตการอนุญาตสิทธิ์และข้อจำกัด<textarea name="license_scope" required maxLength={3000} placeholder="ระบุช่องทางการใช้งาน, ระยะเวลา, ขอบเขตพื้นที่ และต้องการสิทธิ์แต่เพียงผู้เดียวหรือไม่" defaultValue={item?.license_scope} /></label><label>กำหนดเวลาสิ้นสุด (เขตเวลาท้องถิ่น)<input name="deadline" type="datetime-local" required defaultValue={localDate(item?.deadline_at ?? new Date(Date.now() + 30 * 86400000).toISOString())} /></label></FormSection>
    <FormSection step="03" title="เอกสารอ้างอิงและการยืนยัน" description="ภาพอ้างอิงเป็นตัวเลือกเสริม สูงสุด 6 ภาพ สามารถลงประกาศได้แม้ไม่มีไฟล์แนบ">{images.length > 0 && <div className="pf-market-actions">{images.map(image => <button key={image} type="button" onClick={() => setImages(images.filter(i => i !== image))}>ลบภาพอ้างอิง #{image}</button>)}</div>}{images.length < 6 && <AssetPicker kind="image" value={null} onChange={image => setImages(previous => [...new Set([...previous, image])].slice(0, 6))} title="เพิ่มภาพอ้างอิง (สูงสุด 6 ภาพ)" />}<label><input type="checkbox" required />ยืนยันว่ามีสิทธิ์แสดงเอกสารอ้างอิง และเข้าใจว่าการลงประกาศความต้องการและการปรึกษาฝ่ายบริการลูกค้าไม่ได้หมายความว่าเกิดข้อตกลงความร่วมมือแล้ว</label></FormSection>
    {error && <p role="alert">{error}</p>}<div className="pf-market-form-actions"><p>บันทึกแบบร่างก่อน ตรวจสอบเนื้อหาแล้วส่งตรวจสอบ เมื่อผ่านการตรวจสอบจะแสดงในตลาดรับสมัคร</p><Button type="submit" variant="lime" disabled={busy} icon><Save size={17} />{busy ? 'กำลังบันทึก…' : 'บันทึกแบบร่าง'}</Button></div>
  </form><PublishGuide recruit /></div></>
}

