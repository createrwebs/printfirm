import { AudioLines, Image, Video } from 'lucide-react'
import type { MediaLibraryGenerationStatus } from '../../api/drama'
import { AssetTypeFilter } from './AssetLibrary'

export type MediaLibraryFilter = {
  kind: 'image' | 'video' | 'audio'
  imageType: 'all' | 'character' | 'scene' | 'prop'
  generationStatus: MediaLibraryGenerationStatus
}

const MEDIA_TYPES = [
  { value: 'image', label: 'รูปภาพ', icon: Image },
  { value: 'video', label: 'วิดีโอ', icon: Video },
  { value: 'audio', label: 'เสียง', icon: AudioLines },
] as const
const IMAGE_TYPES = [
  { value: 'all', label: 'รูปภาพทั้งหมด' },
  { value: 'character', label: 'ตัวละคร' },
  { value: 'scene', label: 'ฉาก' },
  { value: 'prop', label: 'อุปกรณ์/พร็อพ' },
] as const
const GENERATION_STATUSES = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'generated', label: 'สร้างแล้ว' },
  { value: 'ungenerated', label: 'ยังไม่สร้าง' },
] as const

/** 先选媒体大类，业务分类仅用于รูปภาพ；切换大类时ล้างข้อมูลรูปภาพ分类。 */
export default function MediaLibraryFilters({ value, onChange }: {
  value: MediaLibraryFilter
  onChange: (value: MediaLibraryFilter) => void
}) {
  return <div className="pf-library-filter-stack">
    <div className="pf-library-media-tabs" role="group" aria-label="กรองตามประเภทสื่อ">
      {MEDIA_TYPES.map(({ value: kind, label, icon: Icon }) => <button key={kind} type="button"
        className={`pf-library-pill${value.kind === kind ? ' is-active' : ''}`}
        aria-pressed={value.kind === kind}
        onClick={() => { if (value.kind !== kind) onChange({ ...value, kind, imageType: 'all' }) }}>
        <Icon size={17} aria-hidden />{label}
      </button>)}
    </div>
    {value.kind === 'image' && <div className="pf-library-image-categories">
      <span>หมวดหมู่รูปภาพ</span>
      <AssetTypeFilter options={IMAGE_TYPES} value={value.imageType} ariaLabel="按รูปภาพ分类ตัวกรอง"
        onChange={imageType => onChange({ ...value, kind: 'image', imageType })} />
    </div>}
    <div className="pf-library-generation-status">
      <span>สถานะการสร้าง</span>
      <AssetTypeFilter options={GENERATION_STATUSES} value={value.generationStatus} ariaLabel="กรองตามสถานะการสร้าง"
        onChange={generationStatus => onChange({ ...value, generationStatus })} />
    </div>
  </div>
}
