import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { listToolReferenceAssets, type ToolReferenceAsset } from '../../api/tools'
import { AssetBanner, AssetCard, AssetEmpty, AssetGrid, AssetSearch, AssetTypeFilter } from '../assets/AssetLibrary'
import BillingErrorNotice from '../billing/BillingErrorNotice'
import Modal from '../ui/Modal'
import { useGenerationText } from '../../lib/generationMedia'
import { toolReferenceAssetKind, type GenerationReferenceKind } from '../../lib/generationReferences'
import '../../styles/generation-references.css'

type Props = {
  open: boolean
  onClose: () => void
  allowedKinds: GenerationReferenceKind[]
  multiple?: boolean
  onPick: (assets: ToolReferenceAsset[]) => void | Promise<void>
}

export default function ToolReferenceAssetPicker({ open, onClose, allowedKinds, multiple = false, onPick }: Props) {
  const text = useGenerationText()
  const [items, setItems] = useState<ToolReferenceAsset[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<GenerationReferenceKind | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ToolReferenceAsset[]>([])
  const allowedKey = allowedKinds.join(',')
  const pageSize = 12

  useEffect(() => {
    if (!open) return
    setQuery(''); setPage(1); setSelected([]); setError(''); setItems([])
    const kinds = allowedKey.split(',').filter(Boolean) as GenerationReferenceKind[]
    setKind(kinds.length === 3 ? 'all' : kinds[0] || 'image')
  }, [open, allowedKey])

  function toggle(asset: ToolReferenceAsset) {
    if (!multiple) { setSelected([asset]); return }
    setSelected(previous => previous.some(item => item.id === asset.id)
      ? previous.filter(item => item.id !== asset.id)
      : [...previous, asset])
  }

  useEffect(() => {
    if (!open) return
    let active = true
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = window.setTimeout(() => {
      const requestKind = kind === 'all' ? undefined : kind
      void listToolReferenceAssets({ kind: requestKind, q: query, page, pageSize }, controller.signal).then(result => {
        if (!active) return
        setItems(result.items); setTotal(result.total)
      }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : text('โหลดคลังแอสเซทไม่สำเร็จ', 'Could not load assets')) })
        .finally(() => { if (active) setLoading(false) })
    }, 180)
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [open, kind, query, page, text])

  const visibleItems = items.filter(asset => allowedKinds.includes(toolReferenceAssetKind(asset)))
  const labels = { image: text('รูปภาพ', 'Images'), video: text('วิดีโอ', 'Videos'), audio: text('เสียง', 'Audio') }
  const options = [
    ...(allowedKinds.length === 3 ? [{ value: 'all' as const, label: text('ทั้งหมด', 'All') }] : []),
    ...allowedKinds.map(value => ({ value, label: labels[value] })),
  ]

  async function confirm() {
    if (!selected.length || busy || loading) return
    setBusy(true); setError('')
    try { await onPick(selected); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : text('เลือกแอสเซทไม่สำเร็จ', 'Could not use these assets')) }
    finally { setBusy(false) }
  }

  const resetSelection = () => { if (!multiple) setSelected([]) }

  return <Modal open={open} onClose={onClose} title={text('เลือกข้อมูลอ้างอิงจากคลังแอสเซท', 'Choose reference assets')} size="lg" dismissible={!busy} className="gen-reference-picker"
    footer={<>
      <button type="button" className="pf-btn" disabled={busy} onClick={onClose}>{text('ยกเลิก', 'Cancel')}</button>
      <button type="button" className="pf-btn pf-btn-lime" disabled={!selected.length || loading || busy} onClick={() => void confirm()}>{busy ? text('กำลังเลือก…', 'Selecting…') : multiple && selected.length > 1 ? text(`ยืนยันการใช้ ${selected.length} รายการ`, `Use ${selected.length} assets`) : text('ยืนยันการใช้', 'Use asset')}</button>
    </>}>
    <AssetBanner title={text('ใช้ทรัพยากรที่มีอยู่ต่อยอดการสร้างสรรค์', 'Create with your existing assets')}>{multiple ? text('สามารถเลือกรูปภาพ วิดีโอ หรือเสียงหลายรายการพร้อมกัน เพื่อใช้เป็นข้อมูลอ้างอิงในการสร้างครั้งนี้', 'Pick several images, videos or audio clips at once; all of them join this generation as references.') : text('เลือกรูปภาพ วิดีโอ หรือเสียงในพื้นที่ทำงานนี้ เพื่อใช้เป็นข้อมูลอ้างอิงในการสร้าง', 'Choose an image, video or audio asset available in this workspace.')}</AssetBanner>
    <div className="pf-library-toolbar">
      <AssetTypeFilter options={options} value={kind} disabled={busy} onChange={value => { setKind(value); setPage(1); resetSelection() }} />
      <AssetSearch value={query} onChange={value => { setQuery(value); setPage(1); resetSelection() }} placeholder={text('ค้นหาชื่อหรือคำอธิบายแอสเซท', 'Search assets')} />
    </div>
    {error && <BillingErrorNotice message={error} />}
    {loading ? <div className="gen-reference-picker-loading" role="status"><Loader2 size={20} className="gen-spin" />{text('กำลังโหลดแอสเซท…', 'Loading assets…')}</div> : <AssetGrid picker>
      {visibleItems.map(asset => <AssetCard key={asset.id} asset={{ ...asset, type: toolReferenceAssetKind(asset) }} selected={selected.some(item => item.id === asset.id)}
        subtitle={asset.project_id ? text(`โปรเจกต์ #${asset.project_id}`, `Project #${asset.project_id}`) : text('คลังแอสเซท', 'Asset library')}
        footer={labels[toolReferenceAssetKind(asset)]} onOpen={() => { if (!busy) toggle(asset) }} />)}
    </AssetGrid>}
    {!loading && !visibleItems.length && !error && <AssetEmpty>{text('ขณะนี้ไม่มีข้อมูลที่เลือกได้ ลองเลือกหมวดหมู่อื่นหรืออัปโหลดไฟล์จากเครื่อง', 'No assets found. Try another type or upload a local file.')}</AssetEmpty>}
    {total > pageSize && <div className="gen-reference-picker-pagination">
      <span>{text(`ทั้งหมด ${total} รายการ · หน้าที่ ${page} / ${Math.ceil(total / pageSize)}`, `${total} assets · Page ${page} of ${Math.ceil(total / pageSize)}`)}{multiple && selected.length ? text(` · เลือกแล้ว ${selected.length} รายการ`, ` · ${selected.length} selected`) : ''}</span>
      <button type="button" className="pf-btn pf-btn-sm" disabled={loading || busy || page <= 1} onClick={() => { setPage(value => value - 1); resetSelection() }}><ChevronLeft size={14} />{text('หน้าก่อนหน้า', 'Previous')}</button>
      <button type="button" className="pf-btn pf-btn-sm" disabled={loading || busy || page * pageSize >= total} onClick={() => { setPage(value => value + 1); resetSelection() }}>{text('หน้าถัดไป', 'Next')}<ChevronRight size={14} /></button>
    </div>}
  </Modal>
}
