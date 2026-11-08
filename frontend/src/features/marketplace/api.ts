import { explainMarketplaceError, marketplaceErrorCode } from './messages'

/** 下游独立客户端；不修改原 api.ts。金额统一以分传输。 */
export type Row = {
  id: number; title?: string; description?: string; category?: string; author?: string;
  price_fen?: number; copyright_price_fen?: number; unlock_price_fen?: number; sale_type?: 'free' | 'copyright_contact' | 'platform_unlock'; share_bps?: number | null; budget_fen?: number; quote_fen?: number; wanted_count?: number;
  requirements?: string; license_scope?: string; image_ids?: number[]; deadline_at?: string;
  version?: number; asset_id?: number | null; cover_asset_id?: number | null; source?: string; tags?: string[];
  audit_status?: string; listed?: boolean; blocked?: boolean; reason?: string; media_status?: string;
  preview_status?: string; preview_error?: string;
  basic_status?: string; full_status?: string; owner_id?: number; state?: string; status?: string;
  rights_complete?: boolean; rights_ready?: boolean; rights_source?: string | null;
  filename?: string; kind?: string; error?: string; fingerprint?: string; duration_seconds?: number; episode_count?: number; free_episode_count?: number;
  recruit_id?: number; recruit_title?: string; selection?: string; withdrawn?: boolean;
  can_review?: boolean; can_purchase?: boolean; submission_count?: number;
  is_owner?: boolean; is_open?: boolean; can_submit?: boolean; can_contact?: boolean;
  rights_id?: number; route?: string; official_reference?: string; note?: string;
  message?: string; link?: string; read?: boolean; created_at?: string;
}
export type Listing = { items: Row[]; meta: { page: number; page_size: number; total: number } }
export type Capabilities = { enabled: boolean; storage_configured: boolean }
export type Handoff = {
  id: number; status: string; label: string; error: string; authorization_ready: boolean
  target_kind: string; target_id: number; work_id: number | null; episode_id: number | null
  series_id: number | null; asset_id: number | null
  phase?: string; error_code?: string | null; retryable?: boolean; target_version?: number
}
export type RightsRecord = {
  id?: number; asset_id: number; version: number; details?: Record<string, string>;
  certificate_asset_id?: number | null; evidence_ids?: number[]; valid_until?: string | null;
  preview_status?: string; preview_error?: string;
  basic_status?: string; full_status?: string; reason?: string; blocked?: boolean;
}

// 使用与用户端相同的 API 域名约定，但隔离请求实现。
export const base = import.meta.env.VITE_API_BASE ?? `${window.location.protocol}//${window.location.hostname}:8000`

// 统一解析中文业务错误；不把原โปรเจกต์令牌发给 OSS。
export async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = localStorage.getItem('token')
  const binary = body instanceof Blob
  let response: Response
  try {
    response = await fetch(`${base}/api/marketplace${path}`, {
      method, signal, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': binary ? 'application/octet-stream' : 'application/json' } : {}) },
      body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
    })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new Error('การเชื่อมต่อเครือข่ายล้มเหลว โปรดตรวจสอบเครือข่ายแล้วลองใหม่อีกครั้ง', { cause })
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    const detail = result?.detail
    throw Object.assign(new Error(explainMarketplaceError(detail, response.status)), { code: marketplaceErrorCode(detail), status: response.status })
  }
  return result as T
}

/** 已签署授权函的文件流。ค่าเริ่มต้น由接口 inline กลับ，页面再用本地对象地址ดูตัวอย่าง。 */
export async function letterFile(id: number): Promise<Blob> {
  const token = localStorage.getItem('token')
  let response: Response
  try {
    response = await fetch(`${base}/api/marketplace/authorizations/${id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new Error('授权函暂时无法打开')
  }
  if (!response.ok) {
    if (response.status === 401) window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    const result = await response.json().catch(() => ({}))
    const detail = result?.detail
    throw Object.assign(new Error(explainMarketplaceError(detail, response.status)), { code: marketplaceErrorCode(detail), status: response.status })
  }
  return response.blob()
}

// 只在需要观看时申请短时链接，不能把 object_key 放到前端。
export async function media(kind: string, id: number, purpose: string) {
  return (await request<{ url: string }>(`/media/${kind}/${id}/${purpose}`)).url
}

// 续传键只用本地指纹。HTTPS 用 SHA-256；HTTP 页面没有 crypto.subtle，改用同一段字节的纯计算。
async function sampleDigest(sample: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const hash = await subtle.digest('SHA-256', sample)
    return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
  }
  const bytes = new Uint8Array(sample)
  let high = 0x811c9dc5
  let low = 0x01000193
  for (let index = 0; index < bytes.length; index++) {
    high = Math.imul(high ^ bytes[index], 0x01000193)
    low = Math.imul(low ^ bytes[bytes.length - 1 - index], 0x01000193)
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, '0')
  return hex(high) + hex(low)
}

// 保留用户เลือก的文件；使用首尾片段指纹区分续传，不读取整段วิดีโอ。
export async function upload(file: File, kind: string, progress: (percent: number) => void, signal?: AbortSignal): Promise<number> {
  const sample = await new Blob([file.slice(0, 65536), file.slice(-65536)]).arrayBuffer()
  const digest = await sampleDigest(sample)
  const key = `marketplace-upload:${file.name}:${file.size}:${file.lastModified}:${digest}`
  type Session = { id: number; asset_id: number; state: string; part_size: number; uploaded_parts: number[]; expires_at: string }
  let session: Session | undefined
  signal?.throwIfAborted()
  try {
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const candidate = await request<Session>(`/uploads/${stored}`)
      if (candidate.state === 'uploading' && Date.parse(candidate.expires_at) > Date.now()) session = candidate
    } catch { localStorage.removeItem(key) }
  }
  if (!session) {
    session = await request<Session>('/uploads', 'POST', { filename: file.name, size_bytes: file.size, kind })
    localStorage.setItem(key, String(session.id))
  }
  const count = Math.ceil(file.size / session.part_size)
  const uploaded = new Set(session.uploaded_parts)
  for (let number = 1; number <= count; number++) {
    if (!uploaded.has(number)) {
      const part = file.slice((number - 1) * session.part_size, number * session.part_size)
      let success = false
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await request(`/uploads/${session.id}/parts/${number}`, 'PUT', part, signal); success = true; break }
        catch (error) { if (signal?.aborted || attempt === 2) throw error }
      }
      if (success) uploaded.add(number)
    }
    progress(Math.floor(uploaded.size / count * 100))
  }
  signal?.throwIfAborted()
  await request(`/uploads/${session.id}/complete`, 'POST', undefined, signal)
  localStorage.removeItem(key)
  return session.asset_id
  } catch (error) {
    if (signal?.aborted && session) {
      try { await request(`/uploads/${session.id}`, 'DELETE'); localStorage.removeItem(key) }
      catch { throw new Error('การยกเลิกยังไม่ได้รับการยืนยัน โปรดตรวจสอบสถานะในไฟล์ของฉัน การเลือกไฟล์เดิมซ้ำสามารถดำเนินการอัปโหลดต่อได้') }
      throw new Error('ยกเลิกแล้วอัปโหลด')
    }
    throw error
  }
}

// 以分展示人民币，避免浮点金额进入业务接口。
export const money = (value?: number) => `¥${((value ?? 0) / 100).toFixed(2)}`
// 北京เวลา展示，服务端保留 UTC。
export const date = (value?: string) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—'
// 将UTC转为当前浏览器datetime-local值，避免表单回填时改变时区。
export function localDate(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
// สถานะ不在客户端推断，仅翻译后端结果。
export const labels: Record<string, string> = { draft: 'ฉบับร่าง', preview_failed: 'สร้างตัวอย่างสั้นไม่สำเร็จ', pending: 'รอการตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธแล้ว', missing: 'ยังไม่ได้ส่ง', ready: 'พร้อมแล้ว', processing: 'กำลังประมวลผล', uploading: 'กำลังอัปโหลด', failed: 'ล้มเหลว', open: 'เปิดรับสมัคร', closed: 'ปิดใช้งานแล้ว', expired: 'หมดอายุแล้ว', to_review: 'รอตรวจดู', candidate: 'ผู้สมัครที่ผ่านเกณฑ์', not_selected: 'ไม่ได้รับเลือก', pending_materials: 'รอเอกสาร', reviewing: 'กำลังตรวจสอบเอกสาร', supplement: 'รอแก้ไขเอกสาร', applying: 'กำลังดำเนินการ', certificated: 'ได้รับใบรับรองแล้ว', cancelled: 'ยกเลิกแล้ว', existing: 'มีใบรับรองอยู่แล้ว', self_service: 'ดำเนินการเอง', assisted: 'ฝ่ายบริการลูกค้าประสานงาน' }


