import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Film, Play, RefreshCw, UsersRound } from 'lucide-react'
import { date, labels, money, request, type Listing, type Row } from './api'
import { Media, Pager } from './shared'
import Button from '../../components/ui/Button'
import { EmptyState, PageHeading } from './ui'
import AssetPreview from './AssetPreview'
import { dialog } from '../../lib/dialog'
import { isFreeWork } from './playbackPolicy'
import { explainMarketplaceError } from './messages'

const fileKindNames: Record<string, string> = { video: 'วิดีโอ', image: 'รูปภาพ', document: 'เอกสาร' }

function mineHref(item: Row) {
  return item.kind === 'series' ? `/marketplace/series/${item.id}/edit` : `/marketplace/works/${item.id}/manage`
}

function mineStatus(item: Row) {
  if (item.blocked) return 'ถูกจำกัด'
  if (item.listed) return 'เผยแพร่แล้ว'
  return labels[item.audit_status || ''] || 'ฉบับร่าง'
}

function recruitStatus(item: Row) {
  if (item.blocked) return 'ถูกจำกัด'
  if (item.state === 'closed') return 'ปิดใช้งานแล้ว'
  if (item.state === 'expired') return 'หมดอายุแล้ว'
  return labels[item.audit_status || ''] || 'ฉบับร่าง'
}

function freeMine(item: Row) {
  return isFreeWork(item)
}

function MineRecruits({ listing, loading, page, changePage }: { listing: Listing | null; loading: boolean; page: number; changePage: (value: number) => void }) {
  return <section className="pf-market-discover pf-market-mine">
    <header className="pf-discover-heading"><div><span className="pf-market-kicker">ความต้องการผลงาน</span><h1>การเปิดรับสมัครของฉัน</h1><p>ฉบับร่าง, อยู่ระหว่างตรวจสอบ และรายการที่ผ่านการอนุมัติแล้วจะแสดงที่นี่</p></div><Button variant="dark" to="/marketplace/recruits/new" icon>สร้างประกาศรับสมัคร<ArrowUpRight size={17} /></Button></header>
    {loading || !listing ? <div key="loading" className="pf-market-grid" role="status">{[0, 1, 2].map(item => <div key={item} className="pf-market-skeleton"><div /><span /><span /></div>)}</div> : listing.items.length ? <div key="ready" className="pf-market-grid">{listing.items.map(item => {
      const href = `/marketplace/recruits/${item.id}/manage`
      return <article className="pf-market-item" key={`recruit-${item.id}`}>
        <div className="pf-market-item-cover">{item.image_ids?.length ? <Media kind="recruit" id={item.id} purpose="image-0" /> : <span className="pf-market-series-mark"><UsersRound size={36} strokeWidth={1.4} /></span>}<span className="pf-market-badge">{recruitStatus(item)}</span><Link className="pf-market-cover-play" to={href} aria-label={`จัดการ ${item.title}`}><ArrowUpRight size={16} /></Link></div>
        <div className="pf-market-item-body">
          <h3><Link to={href}>{item.title}</Link></h3>
          <p className="pf-market-author"><span>ความต้องการ</span>สิ้นสุด {date(item.deadline_at)} · รับ {item.wanted_count || 0} ชิ้น</p>
          <div className="pf-market-item-price"><div><strong>{money(item.budget_fen)}</strong><span>/ งบประมาณต่องาน</span></div><Link to={href} aria-label={`จัดการ ${item.title}`}><ArrowUpRight size={20} /></Link></div>
        </div>
      </article>
    })}</div> : <EmptyState title="ยังไม่มีประกาศรับสมัคร" description="เขียนความต้องการของผลงาน หลังจากผ่านการอนุมัติจะปรากฏในหน้ารวมการรับสมัคร" action="สร้างประกาศรับสมัคร" to="/marketplace/recruits/new" />}
    <Pager listing={listing} page={page} change={changePage} />
  </section>
}

function MineWorks({ listing, loading, page, changePage, remove }: { listing: Listing | null; loading: boolean; page: number; changePage: (value: number) => void; remove: (item: Row) => void }) {
  return <section className="pf-market-discover pf-market-mine">
    <header className="pf-discover-heading"><div><span className="pf-market-kicker">วิดีโอเดี่ยวและละครซีรีส์</span><h1>ผลงานของฉัน</h1><p>ฉบับร่าง, อยู่ระหว่างตรวจสอบ และผลงานที่เผยแพร่แล้วจะแสดงที่นี่</p></div><Button variant="dark" to="/marketplace/works/new" icon>เผยแพร่ผลงาน<ArrowUpRight size={17} /></Button></header>
    {loading || !listing ? <div key="loading" className="pf-market-grid" role="status">{[0, 1, 2].map(item => <div key={item} className="pf-market-skeleton"><div /><span /><span /></div>)}</div> : listing.items.length ? <div key="ready" className="pf-market-grid">{listing.items.map(item => {
      const href = mineHref(item)
      const free = freeMine(item)
      const copyrightPrice = item.kind === 'series' ? item.copyright_price_fen ?? item.price_fen : item.price_fen
      return <article className="pf-market-item" key={`${item.kind}-${item.id}`}>
        <div className="pf-market-item-cover">{item.cover_asset_id ? <Media kind={item.kind === 'series' ? 'series' : 'work'} id={item.id} purpose="cover" /> : <span className="pf-market-series-mark"><Film size={36} /></span>}<Link className="pf-market-cover-play" to={href} aria-label={`จัดการ ${item.title}`}><Play size={16} /></Link></div>
        <div className="pf-market-item-body">
          <h3><Link to={href}>{item.title}</Link></h3>
          <p className="pf-market-author"><span>{item.kind === 'series' ? 'ซีรีส์' : 'ผลงาน'}</span>{mineStatus(item)}{item.kind === 'series' ? ` · ${item.episode_count || 0} ตอน` : ''}</p>
          <div className="pf-market-item-price"><div><strong>{free ? 'ฟรี' : item.kind === 'series' && item.sale_type === 'platform_unlock' ? 'ปลดล็อกรายตอน' : money(item.sale_type === 'platform_unlock' ? item.unlock_price_fen : copyrightPrice)}</strong>{!free && <span>{item.sale_type === 'platform_unlock' ? item.kind === 'series' ? 'ราคาต่อตอน' : 'ราคาปลดล็อก' : 'ราคาอ้างอิง'}</span>}</div><button type="button" onClick={() => remove(item)}>ลบ</button><Link to={href} aria-label={`จัดการ ${item.title}`}><ArrowUpRight size={20} /></Link></div>
        </div>
      </article>
    })}</div> : <EmptyState title="ยังไม่มีผลงาน" description="วิดีโอเดี่ยวและซีรีส์ละครสั้นจะแสดงที่นี่ทั้งหมด" action="เผยแพร่ผลงานของฉัน" to="/marketplace/works/new" />}
    <Pager listing={listing} page={page} change={changePage} />
  </section>
}

export default function Workspace() {
  const [kind, setKind] = useState('works')
  const [listing, setListing] = useState<Listing | null>(null)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mediaId, setMediaId] = useState<number | null>(null)
  useEffect(() => { let active = true; setLoading(true); setListing(null); setError(''); request<Listing>(`/mine/${kind}?page=${page}`).then(value => { if (active) setListing(value) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [kind, page, refresh])
  async function action(path: string) { try { await request(path, 'POST'); setRefresh(v => v + 1) } catch (e) { setError((e as Error).message) } }
  async function removeOwned(item: Row) {
    const ok = await dialog.confirm({ title: 'ลบผลงาน', message: `หลังจากลบ「${item.title || 'ผลงานที่ไม่มีชื่อ'}」จะถูกนำออกจากผลงานของฉันและหน้ารวมผลงาน ไฟล์และประวัติการตรวจสอบจะถูกเก็บไว้ แต่จะไม่แสดงผลอีกต่อไป`, confirmText: 'ลบ', tone: 'danger' })
    if (!ok || !item.id) return
    try { await request(item.kind === 'series' ? `/series/${item.id}` : `/works/${item.id}`, 'DELETE'); setRefresh(value => value + 1) } catch (e) { setError((e as Error).message) }
  }
  const tabs = { works: 'ผลงานของฉัน', series: 'ละครซีรีส์ของฉัน', recruits: 'การรับสมัครของฉัน', rights: 'เอกสารลิขสิทธิ์', assets: 'ไฟล์ของฉัน', notifications: 'การแจ้งเตือน' }
  return <><PageHeading title="การเผยแพร่และความคืบหน้าของฉัน" description="ตั้งแต่ฉบับร่างผลงานจนถึงโอกาสความร่วมมือ ติดตามการเผยแพร่และการตรวจสอบความต้องการได้ที่นี่ หากต้องการรับงานกรุณาติดต่อฝ่ายบริการลูกค้า" /><p><Link to="/marketplace/authorization">ลงนาม / ดูหนังสือมอบอำนาจ PrintFilm</Link></p>
    <div className="pf-market-workspace-toolbar"><nav className="pf-market-tabs" aria-label="หมวดหมู่ส่วนตัว">{Object.entries(tabs).map(([key, label]) => <button key={key} type="button" aria-pressed={key === kind} onClick={() => { setKind(key); setPage(1); setMediaId(null); setListing(null); setLoading(true) }}>{label}</button>)}</nav><button type="button" onClick={() => setRefresh(v => v + 1)}><RefreshCw size={14} />รีเฟรช</button></div>
    {error && <p role="alert">{error}</p>}
    {kind === 'works' ? <MineWorks listing={listing} loading={loading} page={page} changePage={setPage} remove={item => void removeOwned(item)} /> : kind === 'recruits' ? <MineRecruits listing={listing} loading={loading} page={page} changePage={setPage} /> : <>
      {kind === 'series' && <section className="pf-market-discover pf-market-mine"><header className="pf-discover-heading"><div><span className="pf-market-kicker">แอสเซทซีรีส์</span><h1>ละครซีรีส์ของฉัน</h1><p>ดูฉบับร่างละครซีรีส์, การตรวจสอบรวม และสถานะการวางจำหน่าย</p></div><Button variant="dark" to="/marketplace/works/new?type=series" icon>เผยแพร่ละครซีรีส์<ArrowUpRight size={17} /></Button></header>{loading || !listing ? <div key="loading" className="pf-market-grid" role="status">{[0, 1, 2].map(item => <div key={item} className="pf-market-skeleton"><div /><span /><span /></div>)}</div> : listing.items.length ? <div key="ready" className="pf-market-grid">{listing.items.map(item => { const href = `/marketplace/series/${item.id}/edit`; const free = item.sale_type === 'free'; const price = item.copyright_price_fen ?? item.price_fen; return <article className="pf-market-item" key={`series-${item.id}`}><div className="pf-market-item-cover">{item.cover_asset_id ? <Media kind="series" id={item.id} purpose="cover" /> : <span className="pf-market-series-mark"><Film size={36} /></span>}<Link className="pf-market-cover-play" to={href} aria-label={`จัดการ ${item.title}`}><Play size={16} /></Link></div><div className="pf-market-item-body"><h3><Link to={href}>{item.title}</Link></h3><p className="pf-market-author"><span>ซีรีส์</span>{mineStatus(item)} · {item.episode_count || 0} ตอน</p><div className="pf-market-item-price"><div><strong>{free ? 'ฟรี' : item.sale_type === 'platform_unlock' ? 'ปลดล็อกรายตอน' : money(price)}</strong>{!free && <span>{item.sale_type === 'platform_unlock' ? 'ราคาต่อตอน' : 'ราคาอ้างอิง'}</span>}</div><Link to={href} aria-label={`จัดการ ${item.title}`}><ArrowUpRight size={20} /></Link></div></div></article> })}</div> : <EmptyState title="ยังไม่มีละครซีรีส์" description="หลังจากสร้างซีรีส์แล้ว สามารถอัปโหลดทีละตอนหรือนำเข้าตอนจากโปรเจกต์ได้" action="เผยแพร่ละครซีรีส์" to="/marketplace/works/new?type=series" />}<Pager listing={listing} page={page} change={setPage} /></section>}
      {kind !== 'series' && kind !== 'recruits' && <>{loading ? <div className="pf-market-empty" role="status">กำลังโหลดความคืบหน้ารายการของคุณ…</div> : listing?.items.map(item => <article className="pf-market-workspace-item" key={item.id}>
        <div className="pf-market-record-head"><h2>{item.title || item.filename || item.recruit_title || item.message || `รายการ #${item.id}`}</h2><span className="pf-market-badge">{item.blocked ? 'ถูกจำกัด' : item.withdrawn ? 'ถอนคืนแล้ว' : labels[item.audit_status ?? item.status ?? item.state ?? item.selection ?? ''] || (kind === 'notifications' ? item.read ? 'อ่านแล้ว' : 'ยังไม่ได้อ่าน' : 'บันทึกรายการ')}</span></div>
        <p>{date(item.created_at)} · หมายเลข #{item.id}</p>
        {(item.reason || item.note || item.error) && <p className="pf-market-record-note">{item.reason || item.note || (item.error ? explainMarketplaceError(item.error) : '')}</p>}
        {kind === 'assets' && <><p>ประเภทไฟล์: {fileKindNames[item.kind || ''] || 'ไฟล์'}</p><button type="button" onClick={() => setMediaId(mediaId === item.id ? null : item.id)}>{mediaId === item.id ? 'ย่อพรีวิว' : 'ดูพรีวิวไฟล์'}</button>{mediaId === item.id && <AssetPreview id={item.id} />}{item.status === 'failed' && <button type="button" onClick={() => action(`/assets/${item.id}/retry`)}>ตรวจสอบไฟล์อีกครั้ง</button>}{item.kind === 'video' && item.status === 'ready' && <Link to={`/marketplace/assets/${item.id}/rights?return=${encodeURIComponent('/marketplace/mine')}`}>ดูเอกสารลิขสิทธิ์</Link>}</>}
        {kind === 'rights' && <><p>สถานะเอกสาร: {labels[item.full_status ?? ''] || 'รอข้อมูลเพิ่มเติม'}</p><p>เอกสารลิขสิทธิ์จะถูกส่งตรวจสอบพร้อมกับผลงาน ไม่จำเป็นต้องยื่นขอตรวจสอบแยกต่างหาก</p><Link to={`/marketplace/assets/${item.asset_id}/rights?return=${encodeURIComponent('/marketplace/mine')}`}>ดูและเพิ่มเอกสาร</Link></>}
        {kind === 'notifications' && <>{item.link && <Link to={item.link}>ไปที่เวิร์กสเปซ</Link>}<button type="button" disabled={item.read} onClick={() => action(`/notifications/${item.id}/read`)}>{item.read ? 'อ่านแล้ว' : 'ทำเครื่องหมายว่าอ่านแล้ว'}</button></>}
      </article>)}
      {!loading && !error && listing?.items.length === 0 && kind !== 'recruits' && <EmptyState title="ยังไม่มีรายการที่นี่" description={kind === 'notifications' ? 'เมื่อสถานะการเผยแพร่หรือการตรวจสอบเปลี่ยนแปลง การแจ้งเตือนจะแสดงขึ้นที่นี่' : 'ความต้องการและความคืบหน้าความร่วมมือของคุณจะถูกบันทึกไว้ที่นี่'} />}
      <Pager listing={listing} page={page} change={setPage} /></>}
    </>}
  </>
}
