import { dialog } from './dialog'
import { workspaceScope } from '../features/teams/workspaceScope'

export const PRICING_PATH = '/pricing'

/** 是否为余额不足 / 计费拦截类错误 */
export function isBillingError(message: string) {
  return /余额不足|请先充值|402|insufficient_balance/i.test(message)
}

/** 跳转定价页充值 */
export function goToTopup() {
  if (typeof window !== 'undefined') {
    window.location.assign(workspaceScope.teamId === null ? PRICING_PATH : `/teams/${workspaceScope.teamId}?tab=billing`)
  }
}

/**
 * 弹出余额不足คำแนะนำ；若用户เลือก去充值则跳转定价页。
 * @returns 是否已按计费错误处理
 */
export async function handleBillingError(
  err: unknown,
  navigate?: (path: string) => void,
): Promise<boolean> {
  const message = err instanceof Error ? err.message : String(err || '')
  if (!isBillingError(message)) return false
  if (workspaceScope.teamId !== null) {
    await dialog.alert({ title: '团队消费受限', message: `${message}。请在团队钱包ดู本人额度；团队余额与充值由เจ้าของ (Owner)管理。`, confirmText: '知道了' })
    return true
  }
  const go = await dialog.confirm({
    title: '余额不足',
    message: message || '当前余额不足以เริ่มสร้าง，请先充值。',
    confirmText: '去充值',
    cancelText: '知道了',
    tone: 'danger',
  })
  if (go) {
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
