import { useCategories } from './useCategories'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Clock3, Film, Handshake, Play, Search, ShieldCheck, SlidersHorizontal, UsersRound } from 'lucide-react'
import Button from '../../components/ui/Button'
import { date, money, request, type Listing, type Row } from './api'
import { Media, Pager } from './shared'
import { EmptyState } from './ui'
import { isFreeWork } from './playbackPolicy'

function plazaHref(item: Row, recruits: boolean) {
  if (item.kind === 'series') return `/marketplace/series/${item.id}`
  return `/marketplace/${recruits ? 'recruits' : 'works'}/${item.id}`
}

function freeListing(item: Row) {
  return isFreeWork(item)
}

export default function Gallery({ recruits = false }: { recruits?: boolean }) {
  const { names: categories, error: categoryError } = useCategories()
  const [listing, setListing] = useState<Listing | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [category, setCategory] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    let active = true; setLoading(true); setError('')
    request<Listing>(`/${recruits ? 'recruits' : 'works'}?${query}&page=${page}`).then(value => { if (active) setListing(value) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, page, recruits, revision])

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); const params = new URLSearchParams()
    for (const key of ['q', 'category', 'sort']) if (form.get(key)) params.set(key, String(form.get(key)))
    for (const [field, key] of [['min', recruits ? 'min_budget' : 'min_price'], ['max', recruits ? 'max_budget' : 'max_price']]) if (form.get(field)) params.set(key, String(Math.round(Number(form.get(field)) * 100)))
    setPage(1); setQuery(params.toString()); setRevision(value => value + 1)
  }

  function reset() { setCategory(''); formRef.current?.reset(); setPage(1); setQuery(''); setRevision(value => value + 1) }
  const filtered = [...new URLSearchParams(query)].some(([key, value]) => key !== 'sort' && value)
  return <div className={recruits ? 'pf-market-recruit-gallery' : 'pf-market-discover'}>
    {!recruits && <header className="pf-discover-heading"><div><span className="pf-market-kicker">ผลงานมีคุณค่า · แรงบันดาลใจมีเสียงตอบรับ</span><h1>ค้นพบผลงานชั้นยอด</h1><p>จากเสี้ยววินาทีแห่งแรงบันดาลใจ สู่ความร่วมมือในครั้งถัดไป สำรวจดิจิทัลวิดีโอจากเหล่าผู้สร้างสรรค์</p></div><Button variant="dark" to="/marketplace/works/new" icon>เผยแพร่ผลงาน<ArrowUpRight size={17} /></Button></header>}
    <section className={`pf-market-hero${recruits ? ' is-recruit' : ''}`}>
      <div className="pf-market-hero-copy"><span className="pf-market-kicker">{recruits ? 'เชื่อมต่อความต้องการกับผู้สร้างสรรค์' : 'ให้การสร้างสรรค์ดำเนินต่อไป'}</span><h1>{recruits ? <>ค้นพบโอกาสสร้างสรรค์<br /><em>ที่คุ้มค่าแก่การลงมือทำ</em></> : <>ให้ผลงานชั้นยอด<br /><em>ได้พบกับคุณค่าใหม่</em></>}</h1><p>{recruits ? 'ค้นหาความต้องการที่เหมาะกับคุณ ติดต่อฝ่ายบริการลูกค้าเพื่อเริ่มต้นความร่วมมือ' : 'ค้นพบวิดีโอคุณภาพจากเหล่าผู้สร้างสรรค์ และทำให้ผลงานของคุณเป็นที่รู้จักมากยิ่งขึ้น'}</p><Button variant="dark" to={recruits ? '/marketplace/recruits/new' : '/marketplace/works/new'} icon>{recruits ? 'สร้างประกาศความต้องการ' : 'เผยแพร่ผลงานของฉัน'}<ArrowUpRight size={17} /></Button></div>
      <div className="pf-market-hero-art" aria-hidden="true"><div className="pf-market-art-orbit" /><div className="pf-market-art-frame pf-market-art-back"><Film size={27} /><span>CREATIVE ASSETS</span></div><div className="pf-market-art-frame pf-market-art-front"><div className="pf-market-art-top"><span>PRINTFILM</span><span>● ● ●</span></div><div className="pf-market-art-play">{recruits ? <UsersRound size={40} strokeWidth={1.3} /> : <Play size={38} strokeWidth={1.2} />}</div><div className="pf-market-art-bottom"><span>{recruits ? 'แรงบันดาลใจและความต้องการ มาบรรจบกันที่นี่' : 'ทุกผลงานสร้างสรรค์ มีความเป็นไปได้ใหม่เสมอ'}</span><ArrowUpRight size={20} /></div></div><span className="pf-market-art-label"><Handshake size={16} />เชื่อมโยงการสร้างสรรค์และความร่วมมือ</span></div>
    </section>
    <div className="pf-market-principles"><span><ShieldCheck size={17} />{recruits ? 'ตรวจสอบความต้องการรับสมัครโดยเจ้าหน้าที่' : 'ตรวจสอบเอกสารสิทธิ์โดยเจ้าหน้าที่'}</span><span><Film size={17} />{recruits ? 'สนใจรับงาน · ติดต่อฝ่ายบริการลูกค้า' : 'รับชมเต็มเรื่องฟรี · ชำระเงินเพื่อดูตัวอย่างก่อน'}</span><span><Handshake size={17} />{recruits ? 'ประสานงานโดยเจ้าหน้าที่ · ยืนยันความร่วมมือ' : 'จำหน่ายลิขสิทธิ์ · วางจำหน่ายบนแพลตฟอร์ม'}</span></div>
    <section className="pf-market-catalog" aria-labelledby="market-catalog-title">
      <header className="pf-market-section-heading"><div><h2 id="market-catalog-title">{recruits ? 'ตลาดการรับสมัคร' : 'ตลาดผลงาน'}</h2><p>{recruits ? 'ความต้องการที่ชัดเจน เพื่อค้นหาพันธมิตรที่เหมาะสม' : 'เลือกชมวิดีโอเดี่ยวและซีรีส์ละครสั้นที่ผ่านการตรวจสอบแล้ว'}</p></div><span className="pf-market-count">{loading ? 'กำลังอัปเดต' : `${listing?.meta.total ?? 0} ${recruits ? 'รายการความต้องการ' : 'ชิ้นงาน'}`}</span></header>
      {!recruits && categoryError && <p role="alert">{categoryError}</p>}<form ref={formRef} className="pf-market-filter-panel" onSubmit={search}>
        {!recruits && <div className="pf-discover-categories" aria-label="หมวดหมู่ผลงาน">{['', ...categories].map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); const params = new URLSearchParams(query); if (value) params.set('category', value); else params.delete('category'); setQuery(params.toString()); setPage(1) }}>{value || 'ผลงานทั้งหมด'}</button>)}</div>}
        <div className="pf-market-filter-top"><label className="pf-market-search"><Search size={18} aria-hidden /><input name="q" aria-label="คำค้นหา" placeholder={recruits ? 'ค้นหาความต้องการ เพื่อค้นพบโอกาสใหม่' : 'ค้นหาชื่อผลงาน เพื่อค้นพบความคิดสร้างสรรค์'} maxLength={100} /></label><select name="sort" aria-label="เรียงลำดับ"><option value="latest">ล่าสุด</option>{recruits ? <option value="deadline">ใกล้หมดเวลา</option> : <><option value="price_asc">ราคาต่ำไปสูง</option><option value="price_desc">ราคาสูงไปต่ำ</option></>}</select><Button variant="dark" type="submit"><Search size={16} />ค้นหา</Button></div>
        <div className="pf-market-filter-bottom"><span className="pf-market-filter-label"><SlidersHorizontal size={15} />ตัวกรอง</span><label className="pf-market-category"><span>หมวดหมู่</span><input name="category" value={category} onChange={e => setCategory(e.target.value)} aria-label="หมวดหมู่" placeholder="หมวดหมู่ทั้งหมด" list="market-categories" maxLength={60} /><datalist id="market-categories">{(recruits ? ['หนังสั้น', 'โฆษณา', 'แอนิเมชัน', 'ท่องเที่ยวและวัฒนธรรม', 'วิทยาศาสตร์และความรู้', 'ทั่วไป'] : categories).map(value => <option key={value} value={value} />)}</datalist></label><div className="pf-market-price-filter"><span>{recruits ? 'งบประมาณต่องาน' : 'ราคาอ้างอิง'}</span><input name="min" type="number" min="0" step="0.01" aria-label="ราคาต่ำสุด" placeholder="฿ ต่ำสุด" /><span>—</span><input name="max" type="number" min="0" step="0.01" aria-label="ราคาสูงสุด" placeholder="฿ สูงสุด" /></div><button type="button" className="pf-market-reset" onClick={reset}>รีเซ็ตตัวกรอง</button></div>
      </form>
      {error ? <div className="pf-market-error" role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>โหลดใหม่</Button></div> : loading ? <div className="pf-market-grid" role="status" aria-label="กำลังโหลดผลงานและความต้องการ">{[0, 1, 2].map(item => <div key={item} className="pf-market-skeleton"><div /><span /><span /></div>)}</div> : listing?.items.length ? <div className={`pf-market-grid${recruits ? ' is-recruits' : ''}`}>{listing.items.map(item => {
        const href = plazaHref(item, recruits)
        const free = !recruits && freeListing(item)
        return <article className="pf-market-item" key={`${item.kind || (recruits ? 'recruit' : 'work')}-${item.id}`}>
        {recruits ? <><div className="pf-market-item-cover">{item.image_ids?.length ? <Media kind="recruit" id={item.id} purpose="image-0" /> : <span className="pf-market-series-mark"><UsersRound size={36} strokeWidth={1.4} /></span>}<span className="pf-market-badge">กำลังเปิดรับ</span><Link className="pf-market-cover-play" to={href} aria-label={`ดูความต้องการ: ${item.title}`}><ArrowUpRight size={16} /></Link></div>
        <div className="pf-market-item-body"><span className="pf-market-category-tag">{item.category}</span><h3><Link to={href}>{item.title}</Link></h3><p className="pf-market-author"><span>{item.author?.slice(0, 1) || 'ผ'}</span>{item.author || 'ผู้สร้างสรรค์'}</p><div className="pf-market-item-price"><div><strong>{money(item.budget_fen)}</strong><span>/ งบประมาณต่องาน</span></div><Link to={href} aria-label={`ดูรายละเอียด ${item.title}`}><ArrowUpRight size={20} /></Link></div><div className="pf-market-item-foot"><Clock3 size={13} /><span>สิ้นสุด {date(item.deadline_at)} · รับ {item.wanted_count} ชิ้น</span></div></div></> : <><div className="pf-market-item-cover">{item.kind === 'series' && !item.cover_asset_id ? <span className="pf-market-series-mark"><Film size={36} /></span> : <Media kind={item.kind === 'series' ? 'series' : 'work'} id={item.id} purpose="cover" />}<Link className="pf-market-cover-play" to={href} aria-label={`ดูผลงาน: ${item.title}`}><Play size={16} /></Link></div>
        <div className="pf-market-item-body"><span className="pf-market-category-tag">{item.kind === 'series' ? 'ซีรีส์ละครสั้น' : item.category}</span><h3><Link to={href}>{item.title}</Link></h3><p className="pf-market-author"><span>{item.author?.slice(0, 1) || 'ผ'}</span>{item.author || 'ผู้สร้างสรรค์'}</p><div className="pf-market-item-price"><div><strong>{free ? 'ฟรี' : item.kind === 'series' && item.sale_type === 'platform_unlock' ? 'ปลดล็อกรายตอน' : money(item.sale_type === 'platform_unlock' ? item.unlock_price_fen : item.price_fen)}</strong>{item.kind === 'series' ? <span>{item.episode_count || 0} ตอน{item.free_episode_count ? ` · ดูฟรี ${item.free_episode_count} ตอนแรก` : ''}</span> : (!free) && <span>{item.sale_type === 'platform_unlock' ? 'ราคาปลดล็อก' : 'ราคาอ้างอิง'}</span>}</div><Link to={href} aria-label={`ดูรายละเอียด ${item.title}`}><ArrowUpRight size={20} /></Link></div><div className="pf-market-item-foot"><Check size={14} /><span>{item.kind === 'series' ? 'ซีรีส์ละครสั้น · ตรวจสอบเอกสารสิทธิ์แล้ว' : 'ตรวจสอบเอกสารสิทธิ์แล้ว'}</span></div></div></>}
      </article>})}</div> : <EmptyState title={filtered ? 'ไม่พบผลลัพธ์ที่ตรงกัน' : recruits ? 'ผลงานชั้นยอดชิ้นถัดไป เริ่มต้นจากความต้องการของคุณ' : 'ผลงานดีๆ คู่ควรกับการมีคนเห็นมากขึ้น'} description={filtered ? 'ลองค้นหาด้วยคำค้นอื่น หรือขยายหมวดหมู่และช่วงราคา' : recruits ? 'ขณะนี้ยังไม่มีประกาศรับสมัคร เขียนความต้องการของคุณเพื่อค้นหาผู้สร้างสรรค์ที่ตรงใจ' : 'ขณะนี้ยังไม่มีผลงานที่วางจำหน่าย อัปโหลดผลงานของคุณเพื่อเปิดแสดงหลังผ่านการตรวจสอบ'} action={filtered ? undefined : recruits ? 'ประกาศความต้องการแรก' : 'เผยแพร่ผลงานของฉัน'} to={recruits ? '/marketplace/recruits/new' : '/marketplace/works/new'}>{filtered && <Button variant="outline" onClick={reset}>ล้างตัวกรอง</Button>}</EmptyState>}
      <Pager listing={listing} page={page} change={setPage} />
    </section>
    <p className="pf-market-footnote">{recruits ? 'สนใจรับงานโปรดติดต่อฝ่ายบริการลูกค้าของแพลตฟอร์ม เงื่อนไขความร่วมมือจะเจรจาและยืนยันผ่านเจ้าหน้าที่' : 'ราคาอ้างอิงความร่วมมือด้านลิขสิทธิ์ขึ้นอยู่กับการเจรจาผ่านฝ่ายบริการลูกค้า ราคาปลดล็อกสำหรับผู้ชมใช้สำหรับซื้อสิทธิ์รับชมออนไลน์ ไม่รวมการโอนลิขสิทธิ์'}</p>
  </div>
}
