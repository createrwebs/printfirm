/** วิดีโอ生成版权审核错误的展示文案；原始异常继续保留在任务记录中。 */
export type CopyrightErrorView = {
  title: string
  message: string
  suggestion: string
  requestId?: string
}

/** 只识别明确的输出版权审核，避免将其他敏感内容或网络错误归为版权问题。 */
export function formatCopyrightError(raw: string | null | undefined): CopyrightErrorView | null {
  const text = String(raw || '')
  if (!/OutputVideoSensitiveContentDetected\.PolicyViolation|output\s*video[\s\S]{0,180}?copyright\s*restrictions|(?:输出|生成)(?:的)?วิดีโอ[\s\S]{0,60}?版权(?:限制|保护)/i.test(text)) return null

  const match = text.match(/\brequest[\s_-]*id\b["'\s:：]*([a-z0-9][a-z0-9_-]*)|请求(?:\s*(?:id|编号))?\s*[:：]\s*([a-z0-9][a-z0-9_-]*)/i)
  const requestId = match?.[1] || match?.[2]
  return {
    title: 'วิดีโอไม่ผ่านการตรวจสอบลิขสิทธิ์',
    message: 'บริการวิดีโอแจ้งว่าผลลัพธ์อาจเกี่ยวข้องกับข้อจำกัดด้านลิขสิทธิ์ จึงไม่สามารถแสดงวิดีโอได้ในขณะนี้'
      + (requestId ? `\n请求编号：${requestId}` : ''),
    suggestion: 'โปรดปรับแต่งคำแนะนำ (Prompt) หรือแอสเซทอ้างอิงแล้วลองใหม่อีกครั้ง หากแอสเซทเป็นผลงานต้นฉบับของคุณหรือได้รับอนุญาตแล้ว โปรดติดต่อฝ่ายบริการลูกค้าเพื่อตรวจสอบ',
    requestId,
  }
}

/** 为通用错误区域提供版权审核说明与建议，其他错误保持原文。 */
export function formatGenerationErrorMessage(raw: string | null | undefined): string {
  const view = formatCopyrightError(raw)
  return view ? `${view.message}\n${view.suggestion}` : String(raw || '')
}
