import { useEffect, useState } from 'react'
import { media, request, type Row } from './api'
import { explainMarketplaceError } from './messages'

const fileStatusNames: Record<string, string> = { ready: 'อัปโหลดเสร็จสิ้น', uploading: 'กำลังอัปโหลด', processing: 'กำลังตรวจสอบไฟล์', failed: 'ตรวจสอบไฟล์ล้มเหลว', cancelled: 'ยกเลิกการอัปโหลดแล้ว', expired: 'การอัปโหลดหมดอายุแล้ว' }

// 浏览器原生ดูตัวอย่าง；不把文件或签名链接บันทึก到 localStorage。
export function PreviewContent({ url, filename, video = false, onReady, onFailure }: { url: string; filename: string; video?: boolean; onReady?: () => void; onFailure?: () => void }) {
  const [failed, setFailed] = useState(false)
  function fail() { setFailed(true); onFailure?.() }
  const pdf = /\.pdf$/i.test(filename)
  return <div className="pf-market-file-preview">
    {video ? <video src={url} controls preload="metadata" onLoadedMetadata={onReady} onError={fail} /> : pdf ? <><iframe src={url} title={`ตัวอย่าง PDF: ${filename}`} onLoad={onReady} /><a href={url} target="_blank" rel="noreferrer">ดู PDF ในหน้าต่างใหม่</a></> : <img src={url} alt={filename} onLoad={onReady} onError={fail} />}
    {failed && <p role="alert">{video ? 'ไม่สามารถแสดงตัวอย่างวิดีโอได้ชั่วคราว โปรดโหลดใหม่ หากยังเล่นไม่ได้ อาจเป็นเพราะเบราว์เซอร์ไม่รองรับการเข้ารหัสวิดีโอนี้' : 'ไม่สามารถแสดงตัวอย่างไฟล์ได้ชั่วคราว โปรดโหลดใหม่ หากยังล้มเหลว โปรดลองอีกครั้งในภายหลังหรือติดต่อฝ่ายบริการลูกค้า'}</p>}
  </div>
}

export default function AssetPreview({ id, onReady, onMediaReady, hideMedia = false }: { id: number; onReady?: (id: number) => void; onMediaReady?: (id: number) => void; hideMedia?: boolean }) {
  const [asset, setAsset] = useState<Row | null>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true; setUrl(''); setError(''); setAsset(null)
    async function load() {
      try {
        const item = await request<Row>(`/assets/${id}`)
        if (!active) return
        setAsset(item)
        if (item.status === 'ready') {
          const link = await media('asset', id, 'original')
          if (active) {
            setUrl(link)
            // A signed cloud URL means the uploaded asset is ready to replace
            // the local object URL.  Notify the picker immediately so the
            // temporary local preview closes without another manual click.
            onReady?.(id)
          }
        } else if (item.status === 'failed') onMediaReady?.(id)
      } catch (e) { if (active) setError((e as Error).message) }
    }
    void load()
    return () => { active = false }
  }, [id, revision])
  useEffect(() => {
    if (!asset || !['uploading', 'processing'].includes(asset.status || '')) return
    const timer = window.setTimeout(() => setRevision(value => value + 1), 2000)
    return () => window.clearTimeout(timer)
  }, [asset])
  return <div className="pf-market-asset-preview"><p>{asset?.filename || 'กำลังอ่านข้อมูลไฟล์'} · {fileStatusNames[asset?.status || ''] || 'กำลังอ่านสถานะ'}</p>
    {url && <div hidden={hideMedia}><PreviewContent key={url} url={url} filename={asset?.filename || ''} video={asset?.kind === 'video'} onReady={() => { onReady?.(id); onMediaReady?.(id) }} onFailure={() => { onMediaReady?.(id); if (hideMedia) setError('ไม่สามารถแสดงตัวอย่างไฟล์ที่อัปโหลดได้ชั่วคราว โปรดคลิก "โหลดตัวอย่างใหม่" เพื่อลองอีกครั้ง') }} /></div>}
    {asset?.status === 'processing' && <p>อัปโหลดไฟล์แล้ว กำลังตรวจสอบข้อมูลไฟล์ สถานะจะอัปเดตอัตโนมัติ</p>}
    {asset?.error && <p role="alert">{explainMarketplaceError(asset.error)}</p>}{error && <p role="alert">{error}</p>}
    <button type="button" onClick={() => setRevision(v => v + 1)}>โหลดตัวอย่างใหม่</button>
  </div>
}
