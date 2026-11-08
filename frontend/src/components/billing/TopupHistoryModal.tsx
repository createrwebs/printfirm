import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { api, type BillingOrder } from '../../api'
import { billingOrderChargeLabel, cnyAmountDisplay } from '../../lib/billingPayments'

type Props = {
  open: boolean
  onClose: () => void
}

const SKU_LABELS: Record<string, string> = {
  topup_10: '体验充值',
  topup_49: '基础充值',
  topup_99: '进阶充值',
  topup_199: '专业充值',
}

const STATUS_CN: Record<string, string> = {
  pending: '待支付',
  paid: '已到账',
  closed: 'ปิดใช้งานแล้ว',
}

const PAY_LABELS: Record<string, string> = { alipay: '支付宝', wxpay: '微信支付', stripe: 'Stripe' }

function formatTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ประวัติการเติมเงิน弹窗：列出近期订单与到账สถานะ（过期待支付由后台自动ปิด） */
export default function TopupHistoryModal({ open, onClose }: Props) {
  /*
   * orders 订单列表
   * loading กำลังโหลด
   * error 错误信息
   */
  const [orders, setOrders] = useState<BillingOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .listBillingOrders(50)
      .then((r) => {
        if (!cancelled) setOrders(r.orders || [])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="ประวัติการเติมเงิน" size="lg" className="pf-topup-history-modal">
      {loading ? <p className="pf-muted">กำลังโหลด…</p> : null}
      {error ? <p className="pf-error">{error}</p> : null}
      {!loading && !error && orders.length === 0 ? (
        <p className="pf-muted">ยังไม่มีประวัติการเติมเงิน</p>
      ) : null}
      {!loading && orders.length > 0 ? (
        <ul className="pf-topup-list">
          {orders.map((o) => (
            <li key={o.out_trade_no} className="pf-topup-item">
              <div className="pf-topup-main">
                <strong>{SKU_LABELS[o.sku_id] || o.sku_name}</strong>
                <span className="pf-muted">{formatTime(o.paid_at || o.created_at)}</span>
              </div>
              <div className="pf-topup-meta">
                <em>{billingOrderChargeLabel(o)}</em>
                <span className="pf-muted">到账 {cnyAmountDisplay(o.credit_fen)}</span>
                <span className="pf-muted">{PAY_LABELS[o.pay_type] || o.pay_type}</span>
                <span className={`pf-topup-status is-${o.status}`}>
                  {STATUS_CN[o.status] || o.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  )
}
