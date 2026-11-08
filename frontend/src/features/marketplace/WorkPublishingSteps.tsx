import { Link } from 'react-router-dom'
import { labels, type Row } from './api'
import RightsPage from './RightsPage'
import AuthorizationPanel from './AuthorizationPanel'
import { isFreeWork, previewStatusLabel } from './playbackPolicy'
import { explainMarketplaceError } from './messages'

// 发布步骤始终显示；缺少วิดีโอ时明确指向第一步，不再隐藏权属入口。
export default function WorkPublishingSteps({ item, onUpdated }: { item: Row; onUpdated: () => void }) {
  const mediaReady = Boolean(item.asset_id && item.media_status === 'ready')
  const internal = item.source === 'printfilm'
  const sourceKnown = internal || item.source === 'external'
  const rightsTitle = internal ? 'ยืนยันข้อมูลลิขสิทธิ์' : sourceKnown ? 'แนบเอกสารลิขสิทธิ์เพิ่มเติม' : 'ยืนยันแหล่งที่มาของผลงาน'
  return <section className="pf-market-publishing" id="publishing" aria-label="ขั้นตอนการเผยแพร่ผลงาน">
    <h2>ขั้นตอนการเผยแพร่</h2><p>ดำเนินการตามลำดับ: ตรวจสอบไฟล์ เอกสารอนุญาตสิทธิ์ และการตรวจสอบจากเจ้าหน้าที่ จากนั้นจึงวางจำหน่าย</p>
    <ol className="pf-market-publish-steps">
      <li data-complete={mediaReady}><span>01</span><div><h3>อัปโหลดไฟล์ผลงาน</h3><p>{mediaReady ? 'อัปโหลดวิดีโอแล้ว' : item.asset_id ? `วิดีโอ${labels[item.media_status || ''] || 'ยังไม่พร้อม'} โปรดตรวจสอบสถานะการอัปโหลด` : 'ยังไม่ได้อัปโหลดวิดีโอ โปรดอัปโหลดหรือซิงค์วิดีโอที่ตัดต่อเสร็จแล้วก่อน'}</p><Link to={`/marketplace/works/${item.id}/edit`}>{mediaReady ? 'แก้ไขไฟล์ผลงาน' : 'ไปที่หน้าอัปโหลดวิดีโอ'}</Link></div></li>
      <li data-complete={Boolean(item.rights_complete)}><span>02</span><div><h3>{rightsTitle}</h3><p>{internal ? 'บัญชีลงนามหนังสืออนุญาตสิทธิ์ตามข้อกำหนดปัจจุบันเพียงครั้งเดียว ผลงานประเภทเดียวกันในอนาคตสามารถใช้อ้างอิงได้โดยไม่ต้องใช้หลักฐานอื่น' : sourceKnown ? 'กรอกหมายเลขทะเบียนและอัปโหลดภาพถ่ายหรือภาพหน้าจอ หากยังขาดเอกสารสามารถติดต่อฝ่ายบริการลูกค้า' : 'โปรดระบุแพลตฟอร์มที่ใช้สร้างก่อน แล้วจึงแนบเอกสารตามขั้นตอน'}</p>{item.rights_ready ? <p>ตรวจสอบเอกสารลิขสิทธิ์แล้ว</p> : <p>{item.rights_complete ? 'กรอกข้อมูลลิขสิทธิ์แล้ว จะส่งตรวจสอบพร้อมกับผลงาน' : mediaReady ? 'เมื่อแนบเอกสารลิขสิทธิ์ครบถ้วนแล้ว จะส่งตรวจสอบพร้อมกับผลงาน' : 'โปรดดำเนินการขั้นตอนที่ 01 (อัปโหลดวิดีโอ) ให้เสร็จสิ้นก่อน'}</p>}</div></li>
      <li data-complete={item.audit_status === 'approved'}><span>03</span><div><h3>ส่งผลงานเพื่อตรวจสอบ</h3><p>ส่งผลงานและข้อมูลลิขสิทธิ์พร้อมกันเพื่อให้ผู้ดูแลระบบตรวจสอบ ผลงานฟรีที่ผ่านการอนุมัติและวางจำหน่ายแล้วสามารถรับชมได้เต็มเรื่อง สำหรับเนื้อหาที่มีค่าบริการ เมื่อส่งตรวจสอบระบบจะสร้างตัวอย่างแบบไม่มีลายน้ำความยาวไม่เกิน 15 วินาที (และไม่เกิน 30% ของความยาวเรื่อง) เมื่อผู้ใช้สั่งซื้อแล้วสามารถรับชมเวอร์ชันที่ซื้อได้ตลอดไป</p><p>การตรวจสอบผลงาน: {labels[item.audit_status || 'missing'] || 'รอส่ง'}</p><p>ตัวอย่างทดลองชม: {previewStatusLabel(item.preview_status, isFreeWork(item))}</p>{item.preview_error && !isFreeWork(item) && <p role="alert">{explainMarketplaceError(item.preview_error)}</p>}</div></li>
      <li data-complete={Boolean(item.listed)}><span>04</span><div><h3>วางจำหน่ายผลงาน</h3><p>{item.listed ? 'เผยแพร่แล้ว' : 'เมื่อผลงานและเอกสารลิขสิทธิ์ผ่านการอนุมัติ และไฟล์วิดีโอพร้อมเล่นแล้ว คุณสามารถเปิดวางจำหน่ายได้ทันที'}</p></div></li>
    </ol>
    {mediaReady ? <details className="pf-market-inline-rights" open={!item.rights_ready}><summary>{internal ? 'ลงนาม / ดูหนังสืออนุญาตสิทธิ์' : 'อัปโหลด / แนบเอกสารลิขสิทธิ์เพิ่มเติม หรือติดต่อฝ่ายบริการลูกค้า'}</summary><RightsPage key={`${item.asset_id}-${item.source}`} assetId={item.asset_id!} sourceHint={item.source} embedded onUpdated={onUpdated} /></details> : internal ? <AuthorizationPanel /> : <p className="pf-market-notice">เมื่ออัปโหลดวิดีโอแล้วจะสามารถกรอกเอกสารลิขสิทธิ์ที่เกี่ยวข้องได้ <Link to="/marketplace/authorization">ผลงาน PrintFilm สามารถลงนามหนังสืออนุญาตสิทธิ์ของบัญชีล่วงหน้าได้</Link></p>}
  </section>
}




