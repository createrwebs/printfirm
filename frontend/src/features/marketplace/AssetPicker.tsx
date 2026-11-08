import { useEffect, useRef, useState } from 'react'
import { request, upload } from './api'
import { CheckCircle2, UploadCloud } from 'lucide-react'
import AssetPreview, { PreviewContent } from './AssetPreview'
import { explainMarketplaceError } from './messages'

// อัปโหลดสถานะ与“处理就绪”分开显示，只允许绑定 ready 文件。locked 时不提供手动เลือก。
export default function AssetPicker({ kind, value, onChange, title = 'เลือกหรืออัปโหลดไฟล์', required = false, locked = false, lockUntilPreview = false }: { kind: 'video' | 'document' | 'image'; value: number | null; onChange: (id: number) => void; title?: string; required?: boolean; locked?: boolean; lockUntilPreview?: boolean }) {
  /* 仅อัปโหลด并绑定当前文件，不加载历史文件列表。 */


  const [error, setError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)

  const [pending, setPending] = useState<number | null>(null)
  const controller = useRef<AbortController | null>(null)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [localAssetId, setLocalAssetId] = useState<number | null>(null)
  const [localUrl, setLocalUrl] = useState('')
  const [previewReady, setPreviewReady] = useState(false)
  useEffect(() => { setPreviewReady(false) }, [value])
  const waitingPreview = locked || (lockUntilPreview && (!value || !previewReady))
  useEffect(() => {
    if (!localFile) { setLocalUrl(''); return }
    const url = URL.createObjectURL(localFile); setLocalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [localFile])
  useEffect(() => {
    if (!pending) return
    let active = true
    // 独立查询处理สถานะ，离开页面即清理轮询。
    const check = async () => {
      try {
        const asset = await request<{ status: string; error: string }>(`/assets/${pending}`)
        if (!active) return
        if (asset.status === 'ready') { onChange(pending); setPending(null); setProgress(null) }
        if (asset.status === 'failed') { setError(asset.error ? explainMarketplaceError(asset.error) : 'ตรวจสอบไฟล์ล้มเหลว โปรดตรวจสอบไฟล์แล้วลองใหม่อีกครั้ง'); setPending(null); setProgress(null) }
      } catch (e) { if (active) { setError((e as Error).message); setPending(null); setProgress(null) } }
    }
    const interval = window.setInterval(check, 5000); void check()
    return () => { active = false; window.clearInterval(interval) }
  }, [pending, onChange])
  // 续传ล้มเหลว保留会话，重新เลือก同一文件即可继续。
  async function choose(file?: File) {
    if (!file) return
    const allowed = kind === 'video' ? /\.(mp4|mov|webm)$/i : kind === 'image' ? /\.(png|jpe?g|webp)$/i : /\.(pdf|png|jpe?g|webp)$/i
    if (file.size === 0) { setError('ไฟล์ว่างเปล่า โปรดเลือกใหม่อีกครั้ง'); return }
    if (!allowed.test(file.name)) { setError(kind === 'video' ? 'โปรดเลือกไฟล์วิดีโอ MP4, MOV หรือ WebM' : kind === 'image' ? 'โปรดเลือกไฟล์รูปภาพ PNG, JPG หรือ WebP' : 'โปรดเลือกไฟล์ PDF, PNG, JPG หรือ WebP'); return }
    if (file.size > (kind === 'video' ? 500 : 20) * 1024 * 1024) { setError(kind === 'video' ? 'วิดีโอต้องมีขนาดไม่เกิน 500MB โปรดเลือกวิดีโอที่เล็กลง' : 'ไฟล์ต้องมีขนาดไม่เกิน 20MB โปรดเลือกไฟล์ที่เล็กลง'); return }
    setLocalFile(file); setLocalAssetId(null)
    setError(''); setProgress(0)
    controller.current = new AbortController()
    try { const id = await upload(file, kind, setProgress, controller.current.signal); setLocalAssetId(id); onChange(id); setPending(id) }
    catch (e) { setError((e as Error).message); setProgress(null) }
    finally { controller.current = null }
  }
  return <fieldset><legend>{title}{required && <span className="pf-req-mark">จำเป็นต้องระบุ</span>}</legend>
    {waitingPreview ? <p className="pf-market-notice" role="status">กำลังโหลดตัวอย่าง...</p> : <label className="pf-market-upload-zone"><UploadCloud size={28} strokeWidth={1.4} /><strong>คลิกเพื่อเลือก{kind === 'video' ? 'วิดีโอ' : kind === 'image' ? 'รูปภาพ' : 'ไฟล์'}</strong><span>{kind === 'video' ? 'MP4 / MOV / WebM · สูงสุด 500MB · ความยาวไม่เกิน 30 นาที' : kind === 'image' ? 'PNG / JPG / WebP · สูงสุด 20MB' : 'PDF / PNG / JPG / WebP · สูงสุด 20MB'}</span><input aria-label={`อัปโหลด${title}`} type="file" disabled={progress !== null} accept={kind === 'video' ? '.mp4,.mov,.webm' : kind === 'image' ? '.png,.jpg,.jpeg,.webp' : '.pdf,.png,.jpg,.jpeg,.webp'} onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} /></label>}
    {!waitingPreview && progress !== null && <div className="pf-market-upload-progress" role="status"><p>{pending ? 'อัปโหลดเสร็จสิ้น กำลังยืนยันสถานะไฟล์ ตัวอย่างจะอัปเดตอัตโนมัติ' : `กำลังอัปโหลด ${progress}%`}</p><progress value={progress} max={100} aria-label="ความคืบหน้าการอัปโหลด" /></div>}
    {!waitingPreview && progress !== null && !pending && <button type="button" onClick={() => controller.current?.abort()}>ยกเลิกการอัปโหลด</button>}
    {localFile && localUrl && <div><p>ตัวอย่างไฟล์ในเครื่อง: {localFile.name} · {(localFile.size / 1024 / 1024).toFixed(2)} MB</p><p>ใช้สำหรับตรวจสอบไฟล์ที่เลือกเท่านั้น ยังไม่ได้อัปโหลดหรือผ่านการตรวจสอบ</p><PreviewContent key={localUrl} url={localUrl} filename={localFile.name} video={kind === 'video'} /><button type="button" onClick={() => setLocalFile(null)}>ปิดตัวอย่างไฟล์ในเครื่อง</button></div>}
    {value && <><p className="pf-market-upload-selection" hidden={waitingPreview}><CheckCircle2 size={14} /> เลือก{kind === 'video' ? 'วิดีโอ' : kind === 'image' ? 'รูปภาพ' : 'ไฟล์'}แล้ว ดูชื่อไฟล์และสถานะด้านล่าง</p><AssetPreview key={value} id={value} hideMedia={Boolean(localFile)} onReady={id => { if (id === localAssetId) { setLocalFile(null); setLocalAssetId(null) } }} onMediaReady={() => setPreviewReady(true)} /></>}{error && <p role="alert">{error}</p>}</fieldset>
}

