import { useCategories } from './useCategories'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import SeriesEditor from './SeriesEditor'
import AssetPicker from './AssetPicker'
import { request, type Handoff, type Row } from './api'
import { Save } from 'lucide-react'
import Button from '../../components/ui/Button'
import { FormSection, PageHeading, PublishGuide } from './ui'
import { explainMarketplaceError } from './messages'

function PublishKindChooser({ choose }: { choose: (kind: 'video' | 'series') => void }) {
  const navigate = useNavigate()
  return <>
    <PageHeading title="เผยแพร่ผลงาน" description="วิดีโอเดี่ยวและซีรีส์ละครสั้นจะแสดงในหน้ารวมผลงาน หรือสามารถเลือกผลงานที่สร้างเสร็จแล้วใน PrintFilm ได้โดยตรง" back="/marketplace" />
    <div className="pf-market-kind-choice">
      <button type="button" onClick={() => choose('video')}><strong>วิดีโอเดี่ยว</strong><span>อัปโหลดวิดีโอและภาพปก กรอกข้อมูลลิขสิทธิ์แล้วส่งตรวจสอบ</span></button>
      <button type="button" onClick={() => choose('series')}><strong>ซีรีส์ละครสั้น</strong><span>เพิ่มตอนย่อยในหน้าเดียวกัน แต่ละตอนมีหนึ่งวิดีโอและภาพปก</span></button>
      <button type="button" onClick={() => navigate('/marketplace/from-printfilm')}><strong>เลือกจากผลงานของฉัน</strong><span>ซิงค์ผลงานวิดีโอหรือตอนย่อยของละครซีรีส์ที่สร้างใน PrintFilm เพิ่มเติมข้อมูลแล้วส่งตรวจสอบ หนังสือมอบอำนาจจะเชื่อมโยงให้อัตโนมัติ</span></button>
    </div>
  </>
}

export default function WorkEditor() {
  const { id } = useParams(); const navigate = useNavigate(); const [search] = useSearchParams()
  const [publishKind, setPublishKind] = useState<'video' | 'series' | ''>(search.get('type') === 'series' ? 'series' : '')
  const { names: categories, error: categoryError } = useCategories()
  const [category, setCategory] = useState('')
  useEffect(() => { if (!id && !category && categories.length) setCategory(categories.includes('ทั่วไป') ? 'ทั่วไป' : categories[0]) }, [id, category, categories])
  const [item, setItem] = useState<Row | null>(null)
  const [assetId, setAssetId] = useState<number | null>(null)
  const [coverId, setCoverId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saleType, setSaleType] = useState<'free' | 'copyright_contact' | 'platform_unlock'>('copyright_contact')
  const [shareBps, setShareBps] = useState<number | null>(null)
  const [source, setSource] = useState('external')
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const handoffQuery = search.get('handoff')
  const syncing = handoff?.status === 'pending' || handoff?.status === 'running'
  useEffect(() => {
    if (!id && !handoffQuery) return
    let stop = false
    let timer = 0
    async function tick() {
      try {
        const value = handoffQuery
          ? await request<Handoff>(`/handoffs/${handoffQuery}`)
          : (await request<{ items: Handoff[] }>(`/handoffs?target_kind=work&target_id=${id}`)).items[0]
        if (stop || !value) return
        setHandoff(value)
        if (value.status === 'ready' && value.work_id) {
          const work = await request<Row>(`/works/${value.work_id}`)
          if (stop) return
          setAssetId(work.asset_id ?? null)
          setCoverId(work.cover_asset_id ?? null)
        }
        if (value.status === 'pending' || value.status === 'running') timer = window.setTimeout(tick, 3000)
      } catch (err) { if (!stop) setError((err as Error).message) }
    }
    void tick()
    return () => { stop = true; window.clearTimeout(timer) }
  }, [id, handoffQuery, handoff?.status])
  useEffect(() => { if (id) request<Row>(`/works/${id}`).then(value => { setItem(value); setCategory(value.category || 'ทั่วไป'); setSaleType((value.sale_type as typeof saleType) || 'copyright_contact'); setShareBps(typeof value.share_bps === 'number' ? value.share_bps : null); setSource(value.source || 'external'); setAssetId(value.asset_id ?? null); setCoverId(value.cover_asset_id ?? null) }).catch(e => setError(e.message)) }, [id])
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); const form = new FormData(e.currentTarget)
    const body = { title: form.get('title'), description: form.get('description'), category: form.get('category'), tags: String(form.get('tags')).split(/[,，]/).map(v => v.trim()).filter(Boolean), price_fen: saleType === 'free' ? 0 : Math.round(Number(form.get('price')) * 100), unlock_price_fen: saleType === 'platform_unlock' ? Math.round(Number(form.get('unlock_price')) * 100) : 0, share_bps: saleType === 'platform_unlock' ? shareBps : null, sale_type: saleType, source, license_scope: form.get('license_scope'), asset_id: assetId, cover_asset_id: coverId, ...(id ? { version: item?.version } : {}) }
    try { const result = await request<Row>(id ? `/works/${id}` : '/works', id ? 'PUT' : 'POST', body); navigate(`/marketplace/works/${result.id}/manage`) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  if (!id && publishKind === 'series') return <SeriesEditor />
  if (!id && !publishKind) return <PublishKindChooser choose={setPublishKind} />
  if (id && !item) return <p role={error ? 'alert' : 'status'}>{error || 'กำลังโหลดผลงาน…'}</p>
  return <><PageHeading title={id ? 'แก้ไขผลงาน' : 'เผยแพร่ผลงาน'} description="สร้างคำอธิบายที่ชัดเจนสำหรับผลงาน สามารถบันทึกเป็นฉบับร่างไว้ก่อนได้ เมื่อส่งจะตรวจสอบลิขสิทธิ์และส่งให้ผู้ดูแลระบบอนุมัติก่อนนำขึ้นแสดง" back="/marketplace" /><div className="pf-market-editor-layout"><div className="pf-market-editor-main"><form className="pf-market-form" onSubmit={save}>
    <p className="pf-market-notice">บันทึกเป็นฉบับร่างก่อนได้ แล้วค่อยยืนยันข้อมูลลิขสิทธิ์ก่อนส่งตรวจสอบ</p>
    {handoff && <p className={handoff.status === 'failed' ? '' : 'pf-market-notice'} role={handoff.status === 'failed' ? 'alert' : 'status'}>{handoff.label}{handoff.error ? `：${explainMarketplaceError(handoff.error)}` : ''}。{handoff.status === 'ready' && !handoff.authorization_ready ? <button type="button" onClick={() => navigate('/marketplace/authorization')}>ไปลงนามหนังสือมอบอำนาจ</button> : null}{handoff.status === 'failed' && handoff.retryable !== false ? <button type="button" onClick={() => void request<Handoff>(`/handoffs/${handoff.id}/retry`, 'POST').then(setHandoff).catch(err => setError((err as Error).message))}>ซิงค์ใหม่</button> : handoff.status === 'failed' ? <span>กรุณากลับไปหน้าเลือกผลงาน แล้วเลือกเวอร์ชันล่าสุดเพื่อซิงค์ใหม่</span> : null}</p>}    <FormSection step="01" title="ไฟล์ผลงาน" description="จำเป็นต้องมีวิดีโอและภาพปกก่อนส่งตรวจสอบ การบันทึกฉบับร่างสามารถเขียนเฉพาะข้อความก่อนได้">
      <AssetPicker kind="video" required value={assetId} onChange={setAssetId} title="วิดีโอผลงาน" /><AssetPicker kind="image" required value={coverId} onChange={setCoverId} title="ภาพปกผลงาน" />
    </FormSection>
    <FormSection step="02" title="แนะนำผลงานของคุณ" description="ชื่อเรื่องและคำอธิบายที่ชัดเจน จะช่วยให้ผู้ที่สนใจค้นพบคุณได้ง่ายขึ้น"><label>ชื่อเรื่อง<span className="pf-req-mark">จำเป็น</span><input name="title" required maxLength={200} placeholder="ตั้งชื่อผลงานให้กระชับและเป็นเอกลักษณ์" defaultValue={item?.title} /></label><label>คำแนะนำย่อ<textarea name="description" maxLength={5000} placeholder="แนะนำเนื้อหาผลงาน แนวคิดการสร้างสรรค์ และการนำไปใช้" defaultValue={item?.description} /></label><div className="pf-market-field-row"><label>หมวดหมู่ผลงาน<span className="pf-req-mark">จำเป็น</span><select name="category" required value={category} onChange={e => setCategory(e.target.value)} disabled={!categories.length}><option value="" disabled>กรุณาเลือกหมวดหมู่</option>{category && !categories.includes(category) && <option value={category}>{category} (หมวดหมู่เดิม)</option>}{categories.map(name => <option key={name} value={name}>{name}</option>)}</select>{categoryError && <span role="alert">{categoryError}</span>}</label><label>แหล่งที่มาของเนื้อหา<select name="source" value={source} onChange={e => setSource(e.target.value)}><option value="printfilm">สร้างจาก PrintFilm</option><option value="external">สร้างจากแพลตฟอร์มอื่น</option>{!['printfilm', 'external'].includes(source) && <option value={source}>แหล่งที่มาเดิม: {source}</option>}</select></label></div><label>แท็ก (คั่นด้วยเครื่องหมายจุลภาค สูงสุด 10 แท็ก)<input name="tags" placeholder="เช่น: เมือง, วิวมุมสูง, ไลฟ์สไตล์" defaultValue={item?.tags?.join(', ')} /></label></FormSection>
    <FormSection step="03" title="รายได้และการอนุญาต" description="เลือกรูปแบบรายได้ของผลงาน พร้อมกำหนดราคาอ้างอิงความร่วมมือและราคาปลดล็อกสำหรับผู้ชม"><label>รูปแบบรายได้<select value={saleType} onChange={e => { const next = e.target.value as typeof saleType; setSaleType(next); if (next !== 'platform_unlock') setShareBps(null) }}><option value="free">เปิดให้ดูฟรี</option><option value="copyright_contact">รายได้จากการจำหน่ายลิขสิทธิ์</option><option value="platform_unlock">รายได้จากการปลดล็อกบนแพลตฟอร์ม</option></select></label>{saleType === 'free' ? <p className="pf-market-notice">ผลงานฟรีหลังจากผ่านการตรวจสอบและนำขึ้นแสดง สามารถรับชมวิดีโอฉบับเต็มได้โดยไม่ต้องสร้างตัวอย่างสั้น ทั้งนี้ยังคงต้องปฏิบัติตามขอบเขตการอนุญาตของผู้สร้างสรรค์</p> : <><p className="pf-market-notice">{saleType === 'platform_unlock' ? 'เมื่อส่งตรวจสอบ ระบบจะสร้างตัวอย่างสั้นไม่มีลายน้ำ ความยาวไม่เกิน 15 วินาทีและไม่เกิน 30% ของความยาวเต็ม หลังจากผ่านการตรวจสอบจะเตรียมเวอร์ชันเล่นออนไลน์เต็มรูปแบบ ผู้ซื้อสามารถรับชมออนไลน์ได้ตลอดไป ไม่รวมการโอนลิขสิทธิ์' : 'เมื่อส่งตรวจสอบ ระบบจะสร้างตัวอย่างสั้นไม่มีลายน้ำ ความยาวไม่เกิน 15 วินาทีและไม่เกิน 30% ของความยาวเต็ม ความร่วมมือด้านลิขสิทธิ์จะเจรจาผ่านฝ่ายบริการลูกค้าเพื่อยืนยันราคา ขอบเขต และเอกสารสัญญา'}</p><label>ราคาอ้างอิง (หยวน)<input name="price" type="number" min="0" max="1000000" step="0.01" placeholder="0.00" defaultValue={item?.price_fen ? item.price_fen / 100 : ''} /><small>ใช้สำหรับเป็นข้อมูลอ้างอิงในการเจรจาความร่วมมือด้านลิขสิทธิ์ ไม่รวมค่าธรรมเนียมการโอนหรือจดทะเบียน</small></label>{saleType === 'platform_unlock' && <><label>ราคาปลดล็อกสำหรับผู้ชม (หยวน)<span className="pf-req-mark">จำเป็น</span><input name="unlock_price" type="number" required min="0.01" max="1000000" step="0.01" defaultValue={item?.unlock_price_fen ? item.unlock_price_fen / 100 : ''} /></label><label>ส่วนแบ่งรายได้ของแพลตฟอร์ม (หน่วยต่อหมื่น ว่างไว้เพื่อใช้ค่าเริ่มต้น)<input type="number" min="0" max="10000" step="1" value={shareBps ?? ''} onChange={e => setShareBps(e.target.value === '' ? null : Number(e.target.value))} placeholder="เช่น 2000 หมายถึงแพลตฟอร์ม 20%, ผู้สร้างสรรค์ 80%" /><small>10000 หมายถึง 100% หากเว้นว่างไว้จะใช้สัดส่วนเริ่มต้นของแพลตฟอร์ม</small></label></>}</>}<label>วัตถุประสงค์และข้อจำกัดในการอนุญาต<span className="pf-req-mark">จำเป็นก่อนส่งตรวจสอบ</span><textarea name="license_scope" maxLength={3000} placeholder="โปรดระบุวัตถุประสงค์ ขอบเขต ระยะเวลา และข้อห้ามในการใช้งาน สามารถเว้นว่างไว้ก่อนในฉบับร่างได้ แต่ต้องกรอกก่อนส่งตรวจสอบ" defaultValue={item?.license_scope} /></label></FormSection>
    {error && <p role="alert">{error}</p>}<div className="pf-market-form-actions"><p>{id ? 'หลังจากบันทึกการเปลี่ยนแปลง ผลงานจะออกจากหน้าแสดงสาธารณะและต้องรอการตรวจสอบใหม่' : 'การบันทึกฉบับร่างจะไม่เผยแพร่สู่สาธารณะ'}</p><Button variant="lime" type="submit" disabled={busy || syncing || !categories.length || !category} icon><Save size={17} />{busy ? 'กำลังบันทึก…' : syncing ? 'กำลังซิงค์ผลงาน…' : 'บันทึกฉบับร่าง'}</Button></div>
  </form></div><PublishGuide saleType={saleType} /></div></>
}
