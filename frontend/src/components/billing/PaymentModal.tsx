import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Modal from '../ui/Modal'
import PaymentBrandIcon from './PaymentBrandIcon'
import { api } from '../../api'
import { teamsApi } from '../../api/teams'
import { cnyAmountDisplay } from '../../lib/billingPayments'

export type PayCheckout = {
  out_trade_no: string
  sku_id: string
  sku_name: string
  pay_type: 'alipay' | 'wxpay' | string
  amount_fen: number
  credit_fen: number
  /** qr=สแกน QR ในหน้าต่าง; redirect=เปิดหน้าชำระเงิน */
  pay_mode?: 'qr' | 'redirect' | string
  qr_payload: string
  payurl?: string
  img?: string
  expire_seconds?: number
}

type Props = {
  teamId?: string
  open: boolean
  checkout: PayCheckout | null
  onClose: () => void
  onPaid: () => void
}

/** แปลงวินาทีที่เหลือเป็นรูปแบบนาที:วินาที */
function formatRemain(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** ป๊อปอัปชำระเงิน: แสดง QR code หรือรอผลการชำระเงิน พร้อมตรวจสอบสถานะออเดอร์ */
export default function PaymentModal({ open, checkout, onClose, onPaid, teamId }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [remain, setRemain] = useState(300)
  const [status, setStatus] = useState<'waiting' | 'paid' | 'expired'>('waiting')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const onPaidRef = useRef(onPaid)
  useLayoutEffect(() => {
    onPaidRef.current = onPaid
  }, [onPaid])

  /** ยกเลิกการชำระเงิน: ปิดหน้าต่าง และเปลี่ยนสถานะคำสั่งซื้อเป็น closed */
  async function handleCancel() {
    const tradeNo = checkout?.out_trade_no
    if (tradeNo && status !== 'paid') {
      try {
        await (teamId ? teamsApi.closeOrder(teamId, tradeNo) : api.closeBillingOrder(tradeNo))
      } catch {
        /* ข้ามข้อผิดพลาดในการยกเลิก ยังคงอนุญาตให้ปิดโมดอลได้ */
      }
    }
    onClose()
  }

  /** เปิดหน้าชำระเงินในหน้าต่างใหม่ */
  function openCashier() {
    const url = (checkout?.payurl || '').trim()
    if (!url) {
      setError('ไม่พบลิงก์ชำระเงิน กรุณาลองใหม่อีกครั้ง')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    if (!open || !checkout) return
    const expiredAt = Date.now() + (checkout.expire_seconds ?? 300) * 1000
    const payurl = (checkout.payurl || '').trim()
    const isRedirect = checkout.pay_mode === 'redirect' || (!checkout.qr_payload && !!payurl)
    setRemain(checkout.expire_seconds ?? 300)
    setStatus('waiting')
    setError('')
    setChecking(false)
    setQrDataUrl('')

    const payload = checkout.qr_payload || checkout.img || ''
    let cancelled = false

    /** แสดงรูปภาพคิวอาร์โค้ด หรือเปิดหน้าชำระเงิน */
    async function paintQr() {
      if (isRedirect) {
        if (!cancelled && payurl) {
          window.open(payurl, '_blank', 'noopener,noreferrer')
        }
        return
      }
      if (!payload) {
        setQrDataUrl('')
        setError('ไม่พบคิวอาร์โค้ดชำระเงิน กรุณาลองใหม่อีกครั้ง')
        return
      }
      if (/^https?:\/\//i.test(payload) && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(payload)) {
        if (!cancelled) setQrDataUrl(payload)
        return
      }
      try {
        const url = await QRCode.toDataURL(payload, {
          width: 220,
          margin: 2,
          color: { dark: '#111318', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setError('สร้างคิวอาร์โค้ดไม่สำเร็จ')
      }
    }

    void paintQr()

    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((expiredAt - Date.now()) / 1000))
      setRemain(left)
      if (left <= 0) {
        setStatus('expired')
        window.clearInterval(tick)
        void (teamId ? teamsApi.order(teamId, checkout.out_trade_no) : api.getBillingOrder(checkout.out_trade_no)).catch(() => undefined)
      }
    }, 250)

    const poll = window.setInterval(async () => {
      if (!checkout.out_trade_no) return
      try {
        const order = await (teamId ? teamsApi.order(teamId, checkout.out_trade_no) : api.getBillingOrder(checkout.out_trade_no))
        if (order.status === 'paid') {
          setStatus('paid')
          window.clearInterval(poll)
          window.clearInterval(tick)
          onPaidRef.current()
        } else if (order.status === 'closed') {
          setStatus('expired')
          window.clearInterval(poll)
          window.clearInterval(tick)
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 2000)

    return () => {
      cancelled = true
      window.clearInterval(tick)
      window.clearInterval(poll)
    }
  }, [open, checkout, teamId])

  /** ตรวจสอบสถานะการชำระเงิน */
  async function confirmPaid() {
    if (!checkout) return
    setChecking(true)
    setError('')
    try {
      const order = await (teamId ? teamsApi.order(teamId, checkout.out_trade_no) : api.getBillingOrder(checkout.out_trade_no))
      if (order.status === 'paid') {
        setStatus('paid')
        onPaidRef.current()
      } else {
        setError(
          checkout.pay_mode === 'redirect'
            ? 'ยังไม่พบผลการชำระเงิน กรุณาชำระเงินในหน้าต่างใหม่ให้เสร็จก่อนแล้วลองอีกครั้ง'
            : 'ยังไม่พบผลการชำระเงิน กรุณารอสักครู่หรือสแกนคิวอาร์โค้ดเพื่อชำระเงิน',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ตรวจสอบสถานะล้มเหลว')
    } finally {
      setChecking(false)
    }
  }

  if (!checkout) return null

  const isAlipay = checkout.pay_type === 'alipay'
  const isRedirect = checkout.pay_mode === 'redirect' || (!checkout.qr_payload && !!checkout.payurl)
  const title = isRedirect
    ? isAlipay
      ? 'ชำระเงินผ่าน Alipay'
      : 'ชำระเงินผ่าน WeChat Pay'
    : isAlipay
      ? 'สแกน QR เพื่อชำระเงินผ่าน Alipay'
      : 'สแกน QR เพื่อชำระเงินผ่าน WeChat Pay'
  const tip = isRedirect
    ? 'เปิดหน้าชำระเงินแล้ว กรุณาชำระเงินในหน้าต่างใหม่ให้เสร็จสิ้น จากนั้นกลับมารอการยืนยันที่หน้านี้'
    : isAlipay
      ? 'กรุณาใช้ Alipay สแกน QR code เพื่อชำระเงิน'
      : 'กรุณาใช้ WeChat สแกน QR code เพื่อชำระเงิน'

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={status !== 'waiting'}
      className="pf-pay-modal"
      size="md"
    >
      <div className="pf-pay-sheet">
        <header className="pf-pay-sheet-head">
          <div className="pf-pay-sheet-title">
            <PaymentBrandIcon brand={isAlipay ? 'alipay' : 'wxpay'} size="md" />
            <strong>{title}</strong>
          </div>
          <button type="button" className="pf-pay-sheet-close" onClick={() => void handleCancel()} aria-label="ปิด">
            ×
          </button>
        </header>

        <div className="pf-pay-sku-box">
          <strong>{checkout.sku_name}</strong>
          <span>ได้รับ {cnyAmountDisplay(checkout.credit_fen)}</span>
        </div>

        <div className="pf-pay-amount">
          <span>ยอดชำระ</span>
          <em>{cnyAmountDisplay(checkout.amount_fen)}</em>
        </div>

        <div className="pf-pay-qr-wrap">
          {isRedirect ? (
            <div className="pf-pay-qr is-empty pf-pay-redirect-box">
              <p>เปิดหน้าชำระเงินในหน้าต่างใหม่แล้ว</p>
              <button type="button" className="pf-pay-btn primary" onClick={openCashier}>
                เปิดหน้าชำระเงินอีกครั้ง
              </button>
            </div>
          ) : qrDataUrl ? (
            <div className="pf-pay-qr">
              <img src={qrDataUrl} alt="คิวอาร์โค้ดชำระเงิน" width={220} height={220} />
              <span className={`pf-pay-qr-badge ${isAlipay ? 'alipay' : 'wxpay'}`} aria-hidden />
            </div>
          ) : (
            <div className="pf-pay-qr is-empty">{error || 'กำลังโหลดคิวอาร์โค้ด…'}</div>
          )}
          <p className="pf-pay-tip">{tip}</p>
          <p className={`pf-pay-expire${status === 'expired' ? ' is-expired' : ''}`}>
            <span className="pf-pay-clock" aria-hidden />
            {status === 'expired'
              ? isRedirect
                ? 'คำสั่งซื้อหมดอายุแล้ว กรุณาปิดแล้วทำรายการใหม่'
                : 'คิวอาร์โค้ดหมดอายุแล้ว กรุณาปิดแล้วทำรายการใหม่'
              : isRedirect
                ? `กรุณาชำระเงินภายใน ${formatRemain(remain)}`
                : `คิวอาร์โค้ดจะหมดอายุใน ${formatRemain(remain)}`}
          </p>
          <p className={`pf-pay-wait${status === 'paid' ? ' is-paid' : ''}`}>
            <span className="pf-pay-dot" aria-hidden />
            {status === 'paid'
              ? 'ชำระเงินสำเร็จ กำลังอัปเดตยอดคงเหลือ'
              : status === 'expired'
                ? 'คำสั่งซื้อหมดเวลาแล้ว'
                : 'กำลังรอผลการชำระเงิน กรุณาอย่าปิดหน้านี้'}
          </p>
        </div>

        {error ? <p className="pf-error pf-pay-error">{error}</p> : null}

        <div className="pf-pay-actions">
          <button type="button" className="pf-pay-btn ghost" onClick={() => void handleCancel()}>
            ยกเลิกการชำระเงิน
          </button>
          <button
            type="button"
            className="pf-pay-btn primary"
            disabled={checking || status === 'paid' || status === 'expired'}
            onClick={() => void confirmPaid()}
          >
            {checking ? 'กำลังตรวจสอบ…' : status === 'paid' ? 'ยอดเงินเข้าแล้ว' : 'ฉันชำระเงินเสร็จสิ้นแล้ว'}
          </button>
        </div>

        <p className="pf-pay-secure-line">
          <span className="pf-pay-shield" aria-hidden />
          การชำระเงินมีความปลอดภัย ยอดเงินจะเข้าตามการแจ้งเตือนของระบบ
        </p>
      </div>
    </Modal>
  )
}
