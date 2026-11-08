import type { ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight, FolderOpen, ShieldCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'

/** 只接受站内相对地址，避免把กลับ链到外部网站。 */
export function internalReturn(value: string | null | undefined): string | undefined {
  if (!value) return
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('://')) return
  return path
}

/** 把来源页带到ถัดไป地址上，已有查询参数时追加 from。 */
export function withReturn(path: string, from: string | undefined): string {
  if (!from) return path
  return `${path}${path.includes('?') ? '&' : '?'}from=${encodeURIComponent(from)}`
}

// 模块内统一页头。地址带站内 from 时回到来源页，否则用调用方指定的广场。
export function PageHeading({ title, description, back, backLabel = 'กลับไปที่ตลาด' }: { title: string; description: string; back?: string; backLabel?: string }) {
  const [search] = useSearchParams()
  const from = internalReturn(search.get('from'))
  const href = from || back
  const label = from ? 'กลับไปหน้าก่อนหน้า' : backLabel
  return <header className="pf-market-page-heading">{href && <Link className="pf-market-back" to={href}><ArrowLeft size={15} />{label}</Link>}<h1>{title}</h1><p>{description}</p></header>
}

// 空数据、空ค้นหา和个人เวิร์กสเตชัน共用真实空态，不填充示例作品。
export function EmptyState({ title, description, action, to, children }: { title: string; description: string; action?: string; to?: string; children?: ReactNode }) {
  return <div className="pf-market-empty"><div className="pf-market-empty-icon" aria-hidden><FolderOpen size={30} strokeWidth={1.4} /></div><h3>{title}</h3><p>{description}</p>{action && to && <Button to={to} variant="dark" icon>{action}<ArrowUpRight size={16} /></Button>}{children}</div>
}

// 发布表单按内容分组，数字仅表示填写顺序。
export function FormSection({ step, title, description, children }: { step: string; title: string; description?: string; children: ReactNode }) {
  return <section className="pf-market-form-section"><header><span>{step}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></header><div className="pf-market-fields">{children}</div></section>
}

// 侧栏展示实际发布规则，不把流程说明显示为เสร็จสมบูรณ์สถานะ。
export function PublishGuide({ recruit = false, saleType = 'copyright_contact' }: { recruit?: boolean; saleType?: 'free' | 'copyright_contact' | 'platform_unlock' }) {
  const steps = recruit ? [['ระบุความต้องการ', 'เขียนวัตถุประสงค์ งบประมาณ และข้อกำหนดการส่งมอบให้ชัดเจน'], ['ส่งตรวจสอบ', 'เมื่อผ่านการตรวจสอบจะเข้าสู่ตลาดรับสมัคร'], ['ติดต่อฝ่ายบริการลูกค้า', 'ครีเอเตอร์ติดต่อฝ่ายบริการลูกค้าเพื่อแจ้งความจำนงในการรับงาน'], ['ร่วมงานแบบออฟไลน์', 'ฝ่ายบริการลูกค้าประสานงานความต้องการ งบประมาณ สัญญา และการส่งมอบ']] : [['เตรียมผลงานให้สมบูรณ์', 'อัปโหลดวิดีโอและภาพหน้าปก พร้อมกรอกคำแนะนำผลงาน'], ['ยืนยันลิขสิทธิ์', 'ผลงาน PrintFilm ใช้หนังสือมอบอำนาจที่มีผล ส่วนผลงานจากแพลตฟอร์มอื่นให้แนบหลักฐาน หากเอกสารไม่ครบติดต่อฝ่ายบริการลูกค้า'], ['ส่งตรวจสอบ', 'ส่งผลงานและข้อมูลลิขสิทธิ์พร้อมกัน โดยผู้ดูแลระบบตรวจสอบ'], ['วางจำหน่ายผลงาน', 'เมื่อผ่านการตรวจสอบแล้ว คุณสามารถกดวางจำหน่ายได้ด้วยตนเอง']]
  const saleNotice = saleType === 'free' ? 'เมื่อวางจำหน่ายแล้วสามารถรับชมฟรีได้เต็มเรื่อง การรับชมฟรีไม่ได้หมายความว่าสามารถนำไปใช้ในเชิงพาณิชย์ได้อย่างอิสระ การใช้งานยังคงต้องเป็นไปตามขอบเขตการอนุญาตของผู้สร้างสรรค์' : saleType === 'platform_unlock' ? 'ผู้ชมชำระเงินตามราคาที่กำหนดเพื่อรับสิทธิ์ในการรับชมออนไลน์เวอร์ชันที่ซื้อตลอดไป โดยไม่รวมการโอนลิขสิทธิ์ ครีเอเตอร์จะได้รับส่วนแบ่งรายได้ตามสัดส่วนที่ตกลงไว้' : 'ราคาอ้างอิงความร่วมมือด้านลิขสิทธิ์ใช้สำหรับการเจรจา ราคาขั้นสุดท้าย ขอบเขตการอนุญาต ขั้นตอนการโอนสิทธิ์ และค่าธรรมเนียมที่เกี่ยวข้อง โปรดยืนยันกับฝ่ายบริการลูกค้า การปรึกษาไม่ได้หมายถึงการปิดการขาย'
  return <aside className="pf-market-guide"><div className="pf-market-guide-heading"><ShieldCheck size={21} /><h2>{recruit ? 'จากความต้องการสู่ความร่วมมือ' : 'จากผลงานสู่ตลาด'}</h2></div><ol>{steps.map(([title, description], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol><div className="pf-market-guide-note"><strong>{recruit ? 'กำหนดให้ชัดเจนก่อนร่วมงาน' : 'เข้าใจรายได้และการอนุญาตสิทธิ์'}</strong><p>{recruit ? 'ครีเอเตอร์รับงานผ่านฝ่ายบริการลูกค้าของแพลตฟอร์ม เงื่อนไขความร่วมมือเฉพาะเจาะจงจะได้รับการประสานงานยืนยัน การปรึกษาไม่ได้หมายความว่าตกลงรับงานหรือปิดการขายแล้ว' : saleNotice}</p>{!recruit && <p>หลักฐานลิขสิทธิ์ไม่สามารถแทนที่การอนุญาตสิทธิ์ที่จำเป็นสำหรับเพลง ฟอนต์ บุคคล หรือองค์ประกอบอื่นๆ ได้</p>}</div></aside>
}

