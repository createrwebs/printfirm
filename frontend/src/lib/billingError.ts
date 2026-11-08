import { dialog } from './dialog'
import { workspaceScope } from '../features/teams/workspaceScope'

export const PRICING_PATH = '/pricing'
export const TORAAPI_TOPUP_URL = 'https://www.toraapi.com'

/** 是否为余额不足 / 计费拦截类错误 */
export function isBillingError(message: string) {
  return /เครดิตไม่เพียงพอ|กรุณาเติมเครดิต|余额不足|请先充值|402|insufficient_balance/i.test(message)
}

/** 跳转定价页充值 */
export function goToTopup() {
  if (typeof window !== 'undefined') {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
    const target = workspaceScope.teamId === null ? PRICING_PATH : `/teams/${workspaceScope.teamId}?tab=billing`
    window.location.assign(`${base}${target}`)
  }
}

/**
 * 弹出余额不足คำแนะนำ；若用户เลือก去充值则เปิดหน้าเติมเครดิต ToraAPI และ跳转定价页。
 * @returns 是否已按计费错误处理
 */
export async function handleBillingError(
  err: unknown,
  navigate?: (path: string) => void,
): Promise<boolean> {
  const message = err instanceof Error ? err.message : String(err || '')
  if (!isBillingError(message)) return false
  if (workspaceScope.teamId !== null) {
    await dialog.alert({ title: 'เครดิตทีมไม่เพียงพอ', message: `${message} กรุณาตรวจสอบโควตาในกระเป๋าเงินทีม`, confirmText: 'รับทราบ' })
    return true
  }
  const go = await dialog.confirm({
    title: 'เครดิตไม่เพียงพอ (ToraAPI)',
    message: `${message || 'เครดิตคงเหลือไม่เพียงพอสำหรับการทำงานนี้'}\n\nกรุณาเติมเครดิตที่ https://www.toraapi.com ก่อนจึงจะสามารถใช้งานต่อได้`,
    confirmText: 'ไปเติมเงินที่ ToraAPI',
    cancelText: 'ปิด',
    tone: 'danger',
  })
  if (go) {
    if (typeof window !== 'undefined') {
      window.open(TORAAPI_TOPUP_URL, '_blank', 'noopener,noreferrer')
    }
    if (navigate) navigate(PRICING_PATH)
    else goToTopup()
  }
  return true
}

/**
 * API 层全局拦截：402 / 余额不足时弹出充值引导（不吞掉原错误）。
 */
export function notifyBillingErrorIfNeeded(status: number, message: string) {
  if (status === 402 || isBillingError(message)) {
    void handleBillingError(new Error(message))
  }
}
