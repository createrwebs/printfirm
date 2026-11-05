import { useEffect, useState } from 'react'
import { media, request, type Row } from './api'
import { explainMarketplaceError } from './messages'

const fileStatusNames: Record<string, string> = { ready: 'อัปโหลดเสร็จสิ้น', uploading: 'กำลังอัปโหลด', processing: '正在校验文件', failed: '文件校验ล้มเหลว', cancelled: 'ยกเลิกแล้วอัปโหลด', expired: 'อัปโหลด已过期' }

// 浏览器原生ดูตัวอย่าง；不把文件或签名链接บันทึก到 localStorage。
export function PreviewContent({ url, filename, video = false, onReady, onFailure }: { url: string; filename: string; video?: boolean; onReady?: () => void; onFailure?: () => void }) {
  const [failed, setFailed] = useState(false)
  function fail() { setFailed(true); onFailure?.() }
  const pdf = /\.pdf$/i.test(filename)
  return <div className="pf-market-file-preview">
    {video ? <video src={url} controls preload="metadata" onLoadedMetadata={onReady} onError={fail} /> : pdf ? <><iframe src={url} title={`PDFดูตัวอย่าง：${filename}`} onLoad={onReady} /><a href={url} target="_blank" rel="noreferrer">在新窗口ดู PDF</a></> : <img src={url} alt={filename} onLoad={onReady} onError={fail} />}
    {failed && <p role="alert">{video ? 'วิดีโอ暂时无法ดูตัวอย่าง，请โหลดใหม่；若仍无法播放，可能是浏览器不支持该วิดีโอ编码。' : '文件暂时无法ดูตัวอย่าง，请โหลดใหม่；若仍ล้มเหลว，请稍后ลองใหม่或联系客服。'}</p>}
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
  return <div className="pf-market-asset-preview"><p>{asset?.filename || '正在读取文件信息'} · {fileStatusNames[asset?.status || ''] || '正在读取สถานะ'}</p>
    {url && <div hidden={hideMedia}><PreviewContent key={url} url={url} filename={asset?.filename || ''} video={asset?.kind === 'video'} onReady={() => { onReady?.(id); onMediaReady?.(id) }} onFailure={() => { onMediaReady?.(id); if (hideMedia) setError('อัปโหลด文件暂时无法ดูตัวอย่าง，请点击“โหลดใหม่ดูตัวอย่าง”ลองใหม่。') }} /></div>}
    {asset?.status === 'processing' && <p>文件已อัปโหลด，正在校验文件信息，สถานะ会自动更新。</p>}
    {asset?.error && <p role="alert">{explainMarketplaceError(asset.error)}</p>}{error && <p role="alert">{error}</p>}
    <button type="button" onClick={() => setRevision(v => v + 1)}>โหลดใหม่ดูตัวอย่าง</button>
  </div>
}
