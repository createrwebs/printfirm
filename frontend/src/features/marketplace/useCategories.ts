import { useEffect, useState } from 'react'
import { request } from './api'

export function useCategories() {
  const [names, setNames] = useState<string[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request<{ names: string[] }>('/categories').then(value => { if (active) setNames(value.names) })
      .catch(e => { if (active) setError(`โหลดหมวดหมู่ไม่สำเร็จ: ${e.message} โปรดรีเฟรชเพื่อลองใหม่อีกครั้ง`) })
    return () => { active = false }
  }, [])
  return { names, error }
}
