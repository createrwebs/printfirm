/** 与后端播放策略保持一致；参考价为零不能替代明确的免费ประเภท。 */
export function isFreeWork(item: { sale_type?: string }) {
  return item.sale_type === 'free'
}

export function isFreeEpisode(series: { sale_type?: string; free_episode_count?: number }, episodeNo: number) {
  return isFreeWork(series) || (episodeNo > 0 && episodeNo <= (series.free_episode_count || 0))
}

export function previewStatusLabel(status: string | undefined, free: boolean) {
  if (free) return '无需试看'
  const labels: Record<string, string> = {
    none: 'ยังไม่ได้สร้าง', missing: 'ยังไม่ได้สร้าง', pending: 'กำลังรอคิว', running: 'กำลังสร้างตัวอย่างสั้น',
    done: 'ตัวอย่างสั้นพร้อมแล้ว', failed: 'สร้างไม่สำเร็จ สามารถลองใหม่ได้', cancelled: 'งานถูกยกเลิกแล้ว',
  }
  return labels[status || 'none'] || status
}
