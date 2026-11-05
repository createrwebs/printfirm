/** 订阅ละครซีรีส์生图全局队列快照 */
import { useSyncExternalStore } from 'react'
import {
  getDramaImageGenQueue,
  subscribeDramaImageGenQueue,
  type DramaImageGenJob,
} from '../lib/dramaImageGenQueue'

// Hook：กลับ当前生图队列列表
export function useDramaImageGenQueue(): DramaImageGenJob[] {
  return useSyncExternalStore(subscribeDramaImageGenQueue, getDramaImageGenQueue, getDramaImageGenQueue)
}

// Hook：某แอสเซท是否在排队或กำลังสร้าง
export function useDramaAssetImageBusy(assetId: number): boolean {
  const queue = useDramaImageGenQueue()
  return queue.some(
    (job) =>
      job.assetId === assetId && (job.status === 'queued' || job.status === 'running'),
  )
}
