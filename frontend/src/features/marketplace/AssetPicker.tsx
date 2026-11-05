import { useEffect, useRef, useState } from 'react'
import { request, upload } from './api'
import { CheckCircle2, UploadCloud } from 'lucide-react'
import AssetPreview, { PreviewContent } from './AssetPreview'
import { explainMarketplaceError } from './messages'

// อัปโหลดสถานะ与“处理就绪”分开显示，只允许绑定 ready 文件。locked 时不提供手动เลือก。
export default function AssetPicker({ kind, value, onChange, title = 'เลือก或อัปโหลด文件', required = false, locked = false, lockUntilPreview = false }: { kind: 'video' | 'document' | 'image'; value: number | null; onChange: (id: number) => void; title?: string; required?: boolean; locked?: boolean; lockUntilPreview?: boolean }) {
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
        if (asset.status === 'failed') { setError(asset.error ? explainMarketplaceError(asset.error) : '文件校验ล้มเหลว，请检查文件后ลองใหม่。'); setPending(null); setProgress(null) }
      } catch (e) { if (active) { setError((e as Error).message); setPending(null); setProgress(null) } }
    }
    const interval = window.setInterval(check, 5000); void check()
    return () => { active = false; window.clearInterval(interval) }
  }, [pending, onChange])
  // 续传ล้มเหลว保留会话，重新เลือก同一文件即可继续。
  async function choose(file?: File) {
    if (!file) return
    const allowed = kind === 'video' ? /\.(mp4|mov|webm)$/i : kind === 'image' ? /\.(png|jpe?g|webp)$/i : /\.(pdf|png|jpe?g|webp)$/i
    if (file.size === 0) { setError('文件为空，请重新เลือก。'); return }
    if (!allowed.test(file.name)) { setError(kind === 'video' ? '请เลือก MP4、MOV 或 WebM วิดีโอ。' : kind === 'image' ? '请เลือก PNG、JPG 或 WebP รูปภาพ。' : '请เลือก PDF、PNG、JPG 或 WebP 文件。'); return }
    if (file.size > (kind === 'video' ? 500 : 20) * 1024 * 1024) { setError(kind === 'video' ? 'วิดีโอ不能超过 500MB，请เลือก较小的วิดีโอ。' : '文件不能超过 20MB，请เลือก较小的文件。'); return }
    setLocalFile(file); setLocalAssetId(null)
    setError(''); setProgress(0)
    controller.current = new AbortController()
    try { const id = await upload(file, kind, setProgress, controller.current.signal); setLocalAssetId(id); onChange(id); setPending(id) }
    catch (e) { setError((e as Error).message); setProgress(null) }
    finally { controller.current = null }
  }
  return <fieldset><legend>{title}{required && <span className="pf-req-mark">จำเป็นต้องระบุ</span>}</legend>
    {waitingPreview ? <p className="pf-market-notice" role="status">加载ดูตัวอย่าง中</p> : <label className="pf-market-upload-zone"><UploadCloud size={28} strokeWidth={1.4} /><strong>点击เลือก{kind === 'video' ? 'วิดีโอ' : kind === 'image' ? 'รูปภาพ' : '文件'}</strong><span>{kind === 'video' ? 'MP4 / MOV / WebM · 最大500MB · 最长30分钟' : kind === 'image' ? 'PNG / JPG / WebP · 最大20MB' : 'PDF / PNG / JPG / WebP · 最大20MB'}</span><input aria-label={`อัปโหลด${title}`} type="file" disabled={progress !== null} accept={kind === 'video' ? '.mp4,.mov,.webm' : kind === 'image' ? '.png,.jpg,.jpeg,.webp' : '.pdf,.png,.jpg,.jpeg,.webp'} onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} /></label>}
    {!waitingPreview && progress !== null && <div className="pf-market-upload-progress" role="status"><p>{pending ? 'อัปโหลดเสร็จสิ้น，正在确认文件สถานะ，ดูตัวอย่าง会自动更新。' : `正在อัปโหลด ${progress}%`}</p><progress value={progress} max={100} aria-label="อัปโหลด进度" /></div>}
    {!waitingPreview && progress !== null && !pending && <button type="button" onClick={() => controller.current?.abort()}>ยกเลิกอัปโหลด</button>}
    {localFile && localUrl && <div><p>本地ดูตัวอย่าง：{localFile.name} · {(localFile.size / 1024 / 1024).toFixed(2)} MB</p><p>仅供检查所选文件，不代表已อัปโหลด或ผ่านการตรวจสอบ。</p><PreviewContent key={localUrl} url={localUrl} filename={localFile.name} video={kind === 'video'} /><button type="button" onClick={() => setLocalFile(null)}>ปิด本地ดูตัวอย่าง</button></div>}
    {value && <><p className="pf-market-upload-selection" hidden={waitingPreview}><CheckCircle2 size={14} /> 当前{kind === 'video' ? 'วิดีโอ' : kind === 'image' ? 'รูปภาพ' : '文件'}已เลือก，文件名和สถานะ见下方。</p><AssetPreview key={value} id={value} hideMedia={Boolean(localFile)} onReady={id => { if (id === localAssetId) { setLocalFile(null); setLocalAssetId(null) } }} onMediaReady={() => setPreviewReady(true)} /></>}{error && <p role="alert">{error}</p>}</fieldset>
}

