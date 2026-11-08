import { useCallback, useEffect, useState } from 'react'
import { api, type UsageChargeRecord } from '../../api'
import Pagination from '../ui/Pagination'
import { pageCountOf } from '../../lib/pagination'

/** 格式化相对เวลา展示 */
function formatWhen(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 格式化 token 数量 */
function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
  return n.toLocaleString('zh-CN')
}

type UsageChargeRecordsProps = {
  /** 嵌入ตั้งค่า页时为 compact */
  variant?: 'panel' | 'compact'
}

/** 使用扣费记录列表：按次展示 LLM / 生图 / 生วิดีโอ等计费明细 */
export default function UsageChargeRecords({ variant = 'compact' }: UsageChargeRecordsProps) {
  /*
   * items 当前页记录
   * page 当前页码
   * pageSize 每页条数
   * total 总条数
   * loading กำลังโหลด
   * error 错误信息
   */
  const [items, setItems] = useState<UsageChargeRecord[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const pageCount = pageCountOf(total, pageSize)

  // 拉取指定页
  const loadPage = useCallback(async (nextPage: number, size: number) => {
    if (!localStorage.getItem('token')) {
      setItems([])
      setTotal(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.usageEvents(nextPage, size)
      setTotal(res.meta.total)
      setPage(nextPage)
      setItems(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดบันทึกการหักค่าใช้จ่ายล้มเหลว')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPage(page, pageSize)
  }, [loadPage, page, pageSize])

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize)
    setPage(1)
  }

  return (
    <section className={`pf-usage-records${variant === 'compact' ? ' is-compact' : ''}`}>
      <header className="pf-usage-records-head">
        <h3>บันทึกการหักค่าใช้จ่าย</h3>
        <p className="pf-muted">รายละเอียดการใช้โทเค็นและค่าธรรมเนียมสำหรับการเรียกใช้ AI แต่ละครั้ง</p>
      </header>

      {loading ? <p className="pf-muted">กำลังโหลด…</p> : null}
      {error ? <p className="pf-error">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="pf-settings-empty">
          <p>ยังไม่มีบันทึกการหักค่าใช้จ่าย</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="pf-settings-list pf-usage-records-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="pf-settings-list-row pf-usage-record-row">
                <span className="pf-settings-list-main">
                  <strong>{item.billing_label}</strong>
                  <em className="pf-muted">
                    {item.context}
                    {item.total_tokens > 0 ? ` · ${formatTokens(item.total_tokens)} tokens` : ''}
                    {item.estimated ? ' · ประมาณการ' : ''}
                  </em>
                </span>
                <span className="pf-settings-list-meta pf-usage-record-meta">
                  <strong className="pf-usage-record-charge">
                    {item.charge_fen > 0 ? `-¥${item.charge_yuan.toFixed(2)}` : '—'}
                  </strong>
                  <em className="pf-muted">{formatWhen(item.created_at)}</em>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && total > 0 ? (
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onChange={setPage}
          ariaLabel="การแบ่งหน้าบันทึกการหักค่าใช้จ่าย"
        />
      ) : null}
    </section>
  )
}
