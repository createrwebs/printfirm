import { throwApiError } from '../lib/apiError'
import { createHttpTransport, resolveApiBase } from './http'
import type { ApiErrorHandler } from './http'
import { scopedRequestInit } from '../features/teams/workspaceScope'

/** 用户端统一 API 地址；空值为生产同源，未ตั้งค่า时使用开发端口 8000。 */
export const API_BASE = resolveApiBase(
  import.meta.env.VITE_API_BASE,
  typeof window === 'undefined' ? undefined : window.location,
)

/** ค่าเริ่มต้น保留全局计费คำแนะนำ，อัปโหลด和工具请求可以显式传入原有错误处理。 */
const transport = createHttpTransport({
  baseUrl: API_BASE,
  getToken: () => localStorage.getItem('token'),
  onError: (response, detail) => throwApiError(response.status, detail, response.statusText),
})

/** 共用鉴权与错误解析，กลับ原始响应以支持文件ดาวน์โหลด。 */
export const requestResponse: typeof transport.response = (path, init, onError) => transport.response(path, scopedRequestInit(path, init), onError)

/** 为业务模块绑定固定错误策略，同时复用 JSON 请求实现。 */
export function createJsonRequester(onError?: ApiErrorHandler) {
  // 对外保留泛型กลับ值，避免每个业务模块重复实现 fetch 包装器。
  return <T>(path: string, init?: RequestInit): Promise<T> => transport.json<T>(path, scopedRequestInit(path, init), onError)
}

/** 统一单文件อัปโหลด字段与 multipart 请求，业务模块只提供路径和错误策略。 */
export function uploadFile<T>(path: string, file: File, onError?: ApiErrorHandler): Promise<T> {
  const body = new FormData()
  body.append('file', file)
  return transport.json<T>(path, scopedRequestInit(path, { method: 'POST', body }), onError)
}
