import { notifyBillingErrorIfNeeded } from './billingError'
import { apiErrorMessage } from '../api/http'
import { workspaceScope } from '../features/teams/workspaceScope'

/** 解析 FastAPI detail 并抛出；401 清理失效令牌并跳转登录，402 / 余额不足时弹出充值引导 */
export function throwApiError(status: number, detail: unknown, fallback = 'คำขอล้มเหลว'): never {
  const finalMessage = apiErrorMessage(detail, fallback)
  if (status === 401 && typeof window !== 'undefined') {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
    const pathname = window.location.pathname
    const relPath = base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname
    if (!relPath.startsWith('/auth')) {
      localStorage.removeItem('token')
      const next = `${relPath}${window.location.search}${window.location.hash}`
      window.location.assign(`${base}/auth?next=${encodeURIComponent(next)}`)
    }
  }
  if (workspaceScope.teamId === null) notifyBillingErrorIfNeeded(status, finalMessage)
  throw Object.assign(new Error(finalMessage), { status })
}
