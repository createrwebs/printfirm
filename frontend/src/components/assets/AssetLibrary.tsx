/** 从团队共享แอสเซท提取的统一展示组件，数据与业务การดำเนินการ由调用方提供。 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowUpRight, AudioLines, Check, Image, Layers3, Loader2, Search, Video } from 'lucide-react'
import { resolveDramaAssetPreviewUrl } from '../../api/drama'
import { isAudioUrl, isPlayableVideoUrl } from '../../lib/canvasNodeMedia'
import './asset-library.css'

export type AssetDisplay = {
  name?: string | null
  type: string
  asset_type?: string
  cover?: string | null
  url?: string | null
  updated_at?: string | null
  params?: Record<string, unknown> | null
}

type AssetCardProps = {
  asset: AssetDisplay
  subtitle?: string
  footer?: ReactNode
  updatedAt?: string | null
  onOpen?: () => void
  selected?: boolean
  busy?: boolean
  status?: string
  compact?: boolean
  children?: ReactNode
  actions?: ReactNode
}

// 展示แท็ก统一使用中文，兼容画布中的รูปภาพ与เสียงประเภท。
const ASSET_LABELS: Record<string, string> = { character: 'ตัวละคร', scene: 'ฉาก', prop: 'อุปกรณ์/พร็อพ', voice: 'น้ำเสียง', audio: 'เสียง', image: 'รูปภาพ', video: 'วิดีโอ' }

/** 日期缺失或无效时显示占位，不产生 Invalid Date。 */
function assetDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

/** 兼容业务分类与媒体分类；น้ำเสียง仍然保留独立的展示名称。 */
function assetMediaType(asset: AssetDisplay): 'image' | 'video' | 'audio' {
  if (asset.type === 'voice' || asset.type === 'audio' || asset.asset_type === 'audio') return 'audio'
  const url = asset.url || asset.cover || ''
  if (asset.type === 'video' || asset.asset_type === 'video' || isPlayableVideoUrl(url) || /^data:video\//i.test(url)) return 'video'
  return isAudioUrl(url) || /^data:audio\//i.test(url) ? 'audio' : 'image'
}

/** 音วิดีโอ只使用真实รูปภาพ封面，无封面时不把媒体 URL 传给 img。 */
export function AssetVisual({ asset }: { asset: AssetDisplay }) {
  const kind = assetMediaType(asset)
  const cover = asset.cover || ''
  const coverIsMedia = isPlayableVideoUrl(cover) || isAudioUrl(cover) || /^data:(?:audio|video)\//i.test(cover)
  const src = resolveDramaAssetPreviewUrl({
    ...asset,
    cover: !coverIsMedia && (kind === 'image' || cover !== asset.url) ? cover : '',
    url: kind === 'image' ? asset.url : '',
  })
  const [failedSrc, setFailedSrc] = useState('')
  return src && failedSrc !== src ? (
    <img key={src} src={src} alt={asset.name || ''} loading="lazy" decoding="async" draggable={false} onError={() => setFailedSrc(src)} />
  ) : (
    <span className="pf-library-art">
      {kind === 'audio' ? <AudioLines size={48} aria-hidden="true" /> : kind === 'video' ? <Video size={46} aria-hidden="true" /> : <Image size={44} aria-hidden="true" />}
      <small>{kind === 'audio' ? asset.type === 'voice' ? 'น้ำเสียงแอสเซท' : 'เสียงแอสเซท' : kind === 'video' ? 'วิดีโอแอสเซท' : 'ไม่มีภาพตัวอย่าง'}</small>
    </span>
  )
}

/** รูปภาพ卡片与画布节点共用封面，画布可传入วิดีโอ播放器或可แก้ไข文本。 */
export function AssetCover({ asset, subtitle, onOpen, selected, busy, status, children, className = '', style, showLabels = true }: Pick<AssetCardProps, 'asset' | 'subtitle' | 'onOpen' | 'selected' | 'busy' | 'status' | 'children'> & { className?: string; style?: CSSProperties; showLabels?: boolean }) {
  const name = asset.name || 'แอสเซทไม่มีชื่อ'
  const cover = <>
    {children ?? <AssetVisual asset={asset} />}
    {showLabels && <><span className="pf-library-shade" />
    <span className="pf-library-type">{['character', 'scene', 'prop', 'voice'].includes(asset.type) ? ASSET_LABELS[asset.type] : asset.type === 'text' ? 'ข้อความ' : ASSET_LABELS[assetMediaType(asset)]}</span>
    {(selected || busy || status) && <span className="pf-library-status" role={busy ? 'status' : undefined}>
      {busy ? <Loader2 size={13} className="pf-library-spinner" /> : selected ? <Check size={13} /> : null}
      {status || (busy ? 'กำลังสร้าง' : 'เลือกแล้ว')}
    </span>}
    <span className="pf-library-name"><strong>{name}</strong>{subtitle && <small>{subtitle}</small>}</span>
    {onOpen && <span className="pf-library-open"><ArrowUpRight size={18} /></span>}</>}
  </>
  return onOpen ? <button type="button" className={`pf-library-cover ${className}`} style={style} onClick={onOpen} aria-label={`${selected ? 'เลือกแล้ว ' : ''}เปิด ${name}`} aria-pressed={selected === undefined ? undefined : selected}>{cover}</button> : <div className={`pf-library-cover ${className}`} style={style}>{cover}</div>
}

/** สี่เหลี่ยมจัตุรัส (1:1)封面、渐变标题与ที่มา页脚；การดำเนินการ区独立于主按钮，支持键盘和เลือก态。 */
export function AssetCard({ asset, subtitle, footer, updatedAt, onOpen, selected, busy, status, compact, children, actions }: AssetCardProps) {
  return <article className={`pf-library-card${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}`}>
    <AssetCover asset={asset} subtitle={subtitle} onOpen={onOpen} selected={selected} busy={busy} status={status} />
    {(footer || updatedAt) && <div className="pf-library-card-foot"><span>{footer}</span>{updatedAt && <time dateTime={updatedAt}>{assetDate(updatedAt)}</time>}</div>}
    {children && <div className="pf-library-card-body">{children}</div>}
    {actions && <div className="pf-library-card-actions">{actions}</div>}
  </article>
}

/** แอสเซท列表网格在普通页面、เลือก弹窗和窄侧栏中共用。 */
export function AssetGrid({ children, compact = false, picker = false }: { children: ReactNode; compact?: boolean; picker?: boolean }) {
  return <div className="pf-library-collection"><div className={`pf-library-grid${compact ? ' is-compact' : ''}${picker ? ' is-picker' : ''}`}>{children}</div></div>
}

/** 统一分类按钮；分类与数据ตัวกรอง仍由调用方控制。 */
export function AssetTypeFilter<T extends string>({ options, value, onChange, disabled = false, ariaLabel = 'กรองตามประเภทแอสเซท' }: { options: readonly { value: T; label: string }[]; value: T | null; onChange: (value: T) => void; disabled?: boolean; ariaLabel?: string }) {
  return <div className="pf-library-filters" role="group" aria-label={ariaLabel}>{options.map((item) => <button type="button" key={item.value} className={`pf-library-pill${value === item.value ? ' is-active' : ''}`} disabled={disabled} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>
}

/** 与共享แอสเซท一致的ค้นหา框，保留原有查询与加载方式。 */
export function AssetSearch({ value, onChange, placeholder = 'ค้นหาชื่อแอสเซทหรือคำอธิบาย' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="pf-library-search"><Search size={17} aria-hidden="true" /><input aria-label="ค้นหาแอสเซท" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

/** 共享แอสเซท的คำแนะนำ横幅，允许โปรเจกต์แก้ไข页说明自己的การดำเนินการ方式。 */
export function AssetBanner({ title = 'สร้างสรรค์ครั้งเดียว ต่อยอดแรงบันดาลใจได้ไม่รู้จบ', children }: { title?: string; children: ReactNode }) {
  return <div className="pf-library-banner" role="note"><span className="pf-library-banner-icon"><Layers3 size={23} aria-hidden="true" /></span><div><strong>{title}</strong><p>{children}</p></div></div>
}

/** 各แอสเซท入口共用的空态。 */
export function AssetEmpty({ children }: { children?: ReactNode }) {
  return <div className="pf-library-empty"><Image size={30} aria-hidden="true" /><strong>ไม่พบแอสเซทที่ตรงกับเงื่อนไข</strong><p>{children || 'ปรับเปลี่ยนเงื่อนไขตัวกรอง หรือเพิ่มแอสเซทใหม่ในโปรเจกต์'}</p></div>
}
