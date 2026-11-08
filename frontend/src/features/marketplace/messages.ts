const businessMessages: Record<string, string> = {
  MARKETPLACE_STORAGE_UNAVAILABLE: 'บริการจัดเก็บไฟล์ยังไม่ได้กำหนดค่าหรือไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลังหรือติดต่อฝ่ายบริการลูกค้า',
  MARKETPLACE_PAYMENT_UNAVAILABLE: 'ระบบชำระเงินไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง',
  MARKETPLACE_REVENUE_CONFIG_REQUIRED: 'ยังไม่เปิดบริการสร้างรายได้บนแพลตฟอร์ม กรุณาติดต่อฝ่ายบริการลูกค้า',
  MARKETPLACE_RIGHTS_REQUIRED: 'กรุณายืนยันข้อมูลลิขสิทธิ์ก่อน: ผลงาน PrintFilm ให้ลงนามหนังสือมอบอำนาจ ผลงานจากแพลตฟอร์มอื่นให้แนบหลักฐานลิขสิทธิ์',
  MARKETPLACE_EPISODE_NOT_READY: 'วิดีโอยังไม่พร้อมใช้งาน กรุณารีเฟรชเพื่อตรวจสอบอีกครั้ง',
  MARKETPLACE_ENTITLEMENT_REQUIRED: 'กรุณาซื้อสิทธิ์การรับชมออนไลน์สำหรับเวอร์ชันนี้ก่อน',
  MARKETPLACE_SOURCE_NOT_READY: 'ผลงานต้นทางยังไม่พร้อมใช้งาน กรุณารอสร้างวิดีโอให้เสร็จสิ้นก่อนซิงค์',
  MARKETPLACE_SOURCE_CHANGED: 'ผลงานต้นทางมีการอัปเดต กรุณารีเฟรชและเลือกใหม่ก่อนซิงค์',
  MARKETPLACE_TARGET_CHANGED: 'ผลงานในตลาดมีการอัปเดต กรุณารีเฟรชและยืนยันเนื้อหาที่จะซิงค์อีกครั้ง',
  MARKETPLACE_SOURCE_INCOMPATIBLE: 'สเปกของวิดีโอสตอรี่บอร์ดไม่ตรงกัน กรุณาปรับอัตราส่วนภาพและความละเอียดให้ตรงกันก่อนซิงค์ใหม่',
  MARKETPLACE_SYNC_IN_PROGRESS: 'กำลังซิงค์ผลงาน กรุณารอให้การซิงค์เสร็จสิ้นก่อนบันทึกหรือส่ง',
  MARKETPLACE_SUBMISSIONS_DISABLED: 'การรับงานทำผ่านฝ่ายบริการลูกค้า กรุณาติดต่อฝ่ายบริการลูกค้าในหน้ารายละเอียดการรับสมัคร',
}

const fieldNames: Record<string, string> = {
  title: 'ชื่อเรื่อง', description: 'คำแนะนำย่อ', category: 'หมวดหมู่', tags: 'แท็ก', price_fen: 'ราคาอ้างอิง',
  copyright_price_fen: 'ราคาอ้างอิง', unlock_price_fen: 'ราคาปลดล็อก', share_bps: 'สัดส่วนส่วนแบ่งแพลตฟอร์ม',
  license_scope: 'ขอบเขตการอนุญาตและข้อจำกัด', scope: 'ขอบเขตสิทธิ์', asset_id: 'วิดีโอ', cover_asset_id: 'ภาพหน้าปก', source: 'แหล่งที่มาของเนื้อหา',
  certificate_number: 'เลขที่ใบรับรองลิขสิทธิ์', certificate_asset_id: 'ภาพหลักฐานลิขสิทธิ์', dispute_ack: 'คำประกาศลิขสิทธิ์',
  episode_no: 'ลำดับตอน', episodes: 'ตอนย่อย', episode_ids: 'ตอนที่เลือก', episode_id: 'ตอนย่อย', free_episode_count: 'จำนวนตอนฟรี',
  budget_fen: 'งบประมาณต่อรายการ', wanted_count: 'จำนวนที่ต้องการ', requirements: 'ข้อกำหนดการส่งมอบ', deadline_at: 'กำหนดเวลาสิ้นสุด',
  image_ids: 'ภาพอ้างอิง', evidence_ids: 'เอกสารหลักฐาน', valid_until: 'ระยะเวลาการอนุญาต', details: 'ข้อมูลลิขสิทธิ์',
  signer_name: 'ชื่อผู้ลงนาม', strokes: 'ลายเซ็น', accepted_terms: 'เงื่อนไขการอนุญาต', adult: 'ยืนยันบรรลุนิติภาวะ',
  read_all: 'ยืนยันการอ่าน', accept_key: 'ยืนยันข้อกำหนดสำคัญ', template_version: 'เวอร์ชันเงื่อนไขการอนุญาต',
  sale_type: 'รูปแบบรายได้', filename: 'ชื่อไฟล์', size_bytes: 'ขนาดไฟล์', kind: 'ประเภทไฟล์',
  statement: 'รายละเอียดการรายงาน', contact: 'ช่องทางติดต่อ', version: 'เวอร์ชันเนื้อหา', series_version: 'เวอร์ชันซีรีส์สั้น',
  drama_project_id: 'โปรเจกต์ซีรีส์', project_id: 'โปรเจกต์วิดีโอ', series_id: 'ตลาดซีรีส์สั้น', source_version: 'เวอร์ชันวิดีโอต้นทาง',
  idempotency_key: 'รหัสการดำเนินการ', target_type: 'ประเภทการสอบถาม', target_id: 'เนื้อหาการสอบถาม',
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function marketplaceErrorCode(detail: unknown): string | undefined {
  const value = record(detail)
  if (typeof value?.code === 'string') return value.code
  const message = typeof detail === 'string' ? detail : typeof value?.message === 'string' ? value.message : ''
  return message.match(/^(MARKETPLACE_[A-Z_]+)(?=[:：\s]|$)/)?.[1]
}

function readableText(text: string): string | undefined {
  const cleaned = text.trim().replace(/^Value error,\s*/i, '')
  return /[\u0e00-\u0e7f]/u.test(cleaned) ? cleaned : undefined
}

function limitText(value: unknown, field: string): string {
  if (typeof value !== 'number' && typeof value !== 'string') return 'ขอบเขตที่อนุญาต'
  if (field.endsWith('_fen') && Number.isFinite(Number(value))) return `¥${(Number(value) / 100).toFixed(2)}`
  return String(value)
}

function validationMessage(row: Record<string, unknown>, field: string): string {
  const type = row.type
  const ctx = record(row.ctx) ?? {}
  const raw = typeof row.msg === 'string' ? row.msg : ''
  const ownMessage = readableText(raw)
  if (ownMessage) return ownMessage
  switch (type) {
    case 'missing': return 'จำเป็นต้องระบุช่องนี้'
    case 'string_too_short': return `กรอกอย่างน้อย ${ctx.min_length} ตัวอักษร`
    case 'string_too_long': return `ไม่เกิน ${ctx.max_length} ตัวอักษร`
    case 'too_short': return `ต้องการอย่างน้อย ${ctx.min_length} รายการ`
    case 'too_long': return `อนุญาตได้สูงสุด ${ctx.max_length} รายการ`
    case 'greater_than': return `ต้องมากกว่า ${limitText(ctx.gt, field)}`
    case 'greater_than_equal': return `ต้องไม่น้อยกว่า ${limitText(ctx.ge, field)}`
    case 'less_than': return `ต้องน้อยกว่า ${limitText(ctx.lt, field)}`
    case 'less_than_equal': return `ต้องไม่เกิน ${limitText(ctx.le, field)}`
    case 'int_parsing': case 'int_type': case 'int_from_float': return 'กรุณากรอกจำนวนเต็ม'
    case 'float_parsing': case 'float_type': case 'finite_number': return 'กรุณากรอกตัวเลขที่ถูกต้อง'
    case 'literal_error': return ctx.expected === 'True' ? 'กรุณาทำเครื่องหมายเพื่อยืนยัน' : 'กรุณาเลือกตัวเลือกที่ถูกต้อง'
    case 'bool_parsing': case 'bool_type': return 'กรุณายืนยันตัวเลือกนี้'
    case 'datetime_parsing': case 'datetime_from_date_parsing': case 'timezone_aware': return 'กรุณาระบุวันที่และเวลาที่ถูกต้อง'
    case 'extra_forbidden': return 'ไม่รองรับการส่งฟิลด์นี้ กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง'
  }
  if (/field required/i.test(raw)) return 'จำเป็นต้องระบุช่องนี้'
  if (/at least 1 character/i.test(raw)) return 'ต้องไม่เป็นค่าว่าง'
  if (/valid integer/i.test(raw)) return 'กรุณากรอกจำนวนเต็ม'
  if (/valid number/i.test(raw)) return 'กรุณากรอกตัวเลขที่ถูกต้อง'
  return 'กรุณาตรวจสอบข้อมูลที่กรอก'
}

function explainValidation(detail: unknown[]): string {
  const lines = detail.flatMap(value => {
    const row = record(value)
    if (!row) return []
    const parts = (Array.isArray(row.loc) ? row.loc : []).filter(part => !['body', 'query', 'path'].includes(String(part)))
    const field = String(parts.at(-1) ?? '')
    const location = parts.map(part => typeof part === 'number' ? `รายการที่ ${part + 1}` : fieldNames[String(part)] || 'ข้อมูลที่กรอก').join(' ของ ')
    const message = validationMessage(row, field)
    return [location ? `${location}：${message}` : message]
  })
  return [...new Set(lines)].join('; ') || 'กรุณาตรวจสอบข้อมูลในแบบฟอร์มและฟิลด์ที่จำเป็นต้องระบุ'
}

export function explainMarketplaceError(detail: unknown, status?: number): string {
  if (Array.isArray(detail)) return explainValidation(detail)
  const value = record(detail)
  const raw = typeof detail === 'string' ? detail : typeof value?.message === 'string' ? value.message : ''
  const code = marketplaceErrorCode(detail)
  const message = readableText(raw.replace(/^MARKETPLACE_[A-Z_]+\s*[:：]?\s*/, ''))
  if (message) return message
  if (code && businessMessages[code]) return businessMessages[code]
  if (status === 401) return 'การเข้าสู่ระบบหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
  if (status === 403) return 'บัญชีปัจจุบันไม่มีสิทธิ์ในการดำเนินการนี้'
  if (status === 404) return 'ไม่พบเนื้อหาหรือยังไม่สามารถเข้าถึงได้ กรุณารีเฟรชแล้วลองใหม่อีกครั้ง'
  if (status === 409) return 'สถานะเนื้อหามีการเปลี่ยนแปลง กรุณารีเฟรชแล้วดำเนินการใหม่อีกครั้ง'
  if (status === 413) return 'ขนาดไฟล์เกินขีดจำกัดที่อนุญาต กรุณาเลือกไฟล์ที่มีขนาดเล็กลง'
  if (status === 422) return 'กรุณาตรวจสอบข้อมูลในแบบฟอร์มและฟิลด์ที่จำเป็นต้องระบุ'
  if (status === 429) return 'ดำเนินการถี่เกินไป กรุณารอครู่หนึ่งแล้วลองใหม่อีกครั้ง'
  return 'ไม่สามารถดำเนินการให้เสร็จสิ้นได้ในขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง'
}
