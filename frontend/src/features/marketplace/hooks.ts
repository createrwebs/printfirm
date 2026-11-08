import { useEffect, useState } from 'react'
import { request, type Capabilities } from './api'

// 菜单和页面以服务端开关为准，ล้มเหลว时不展示下游入口。
export function useMarketplace() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request<Capabilities>('/capabilities').then(value => { if (active) setCapabilities(value) }).catch(() => { if (active) setError('ไม่สามารถอ่านสถานะบริการปลายทางได้ โปรดลองใหม่อีกครั้งในภายหลัง') })
    return () => { active = false }
  }, [])
  return { capabilities, error }
}
