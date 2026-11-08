/** 框架的通用 404 表示接口未加载；业务 404 则保留会话不存在等真实原因。 */
export function creationApiErrorDetail(status: number, detail: unknown): unknown {
  if (status !== 404) return detail
  if (typeof detail === 'string' && detail.trim().toLowerCase() === 'not found')
    return 'อินเทอร์เฟซบริการสร้างสรรค์ยังไม่พร้อมใช้งาน โปรดลองใหม่อีกครั้ง'
  if (detail === '创作会话不存在')
    return 'เซสชันการสร้างไม่มีอยู่หรือถูกลบแล้ว โปรดกลับไปที่คลิปสั้นของฉันหรือสร้างบทสนทนาใหม่'
  return detail
}
