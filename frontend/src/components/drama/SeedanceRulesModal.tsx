/** กฎการส่งค่าพารามิเตอร์และการใช้งาน Seedance (หน้าแก้ไขตอน) */
import { useState } from 'react'
import Modal from '../ui/Modal'
import {
  DRAMA_SEGMENT_DURATION_MAX,
  DRAMA_SEGMENT_DURATION_MIN,
  DRAMA_SHOT_DURATION_HARD_MAX,
  FRAGMENT_CONTENT_DURATION_MAX,
} from '../../lib/dramaEpisodePromptEditor'
import {
  DIALOGUE_PREFIX,
  DRAMA_NARRATION_PREFIX,
  DRAMA_SUBTITLE_CUE,
  VISUAL_PREFIX,
} from '../../lib/dramaEpisodeScriptValidate'

type Tab = 'payload' | 'script' | 'usage'

type Props = {
  open: boolean
  onClose: () => void
}

// เรนเดอร์ป๊อปอัปอธิบายกฎ Seedance
export function SeedanceRulesModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('payload')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="กฎการส่งค่าและการใช้งาน Seedance"
      size="lg"
      className="pf-help-modal seedance-rules-modal"
      footer={
        <button type="button" className="pf-btn pf-btn-lime pf-btn-sm" onClick={onClose}>
          เข้าใจแล้ว
        </button>
      }
    >
      <div className="pf-help">
        <p className="pf-help-lede">
          วิดีโอสตอรี่บอร์ดสร้างขึ้นผ่านอินเทอร์เฟซมัลติโมดอลของ Seedance รายละเอียดด้านล่างอธิบายวิธีที่ระบบนำบทละคร แอสเซท และพารามิเตอร์แถบด้านบนมารวมเป็นคำขอ รวมถึงแนวทางการเขียนบทสตอรี่บอร์ดสำหรับซีรีส์ละครสั้น
        </p>

        <div className="pf-help-tabs" role="tablist" aria-label="หมวดหมู่กฎ Seedance">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'payload'}
            className={tab === 'payload' ? 'active' : undefined}
            onClick={() => setTab('payload')}
          >
            กฎการส่งค่าพารามิเตอร์
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'script'}
            className={tab === 'script' ? 'active' : undefined}
            onClick={() => setTab('script')}
          >
            วิธีเขียนบทสตอรี่บอร์ด
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'usage'}
            className={tab === 'usage' ? 'active' : undefined}
            onClick={() => setTab('usage')}
          >
            คำแนะนำการใช้งาน
          </button>
        </div>

        {tab === 'payload' ? (
          <div className="seedance-rules-section">
            <h4>พารามิเตอร์แถบด้านบน → ฟิลด์ API</h4>
            <ul className="seedance-rules-list">
              <li>
                <strong>โมเดล</strong> → <code>model</code> (Seedance 2.5 / 1.5)
              </li>
              <li>
                <strong>สัดส่วนภาพ · ความละเอียด</strong> (ตั้งค่าที่แถบด้านบนของตอน) → <code>ratio</code>, <code>resolution</code>
              </li>
              <li>
                <strong>ความยาว</strong> → <code>duration</code>: ผลรวมแท็ก{' '}
                <code>@duration</code> ในบท (แนะนำ 4–{FRAGMENT_CONTENT_DURATION_MAX} วินาที); หากไม่มีแท็กจะใช้ค่าจากฟิลด์ «ความยาว» ของช็อตนี้
              </li>
              <li>
                <strong>สไตล์วิดีโอ</strong> → ประกอบลงในคำสั่งพร้อมท์บล็อก «ข้อจำกัดสไตล์ภาพแบบบังคับ»
              </li>
            </ul>

            <h4>อาร์เรย์มัลติโมดอล content (ส่งตามลำดับ)</h4>
            <ol className="seedance-rules-list">
              <li>
                <strong>text</strong>: คำสั่งพร้อมท์ที่ระบบประกอบให้โดยอัตโนมัติ (ดูบล็อกข้อจำกัดและเนื้อหาหลักด้านล่าง)
              </li>
              <li>
                <strong>reference_image</strong>: รูปภาพปกหรือภาพอ้างอิงหลักของตัวละคร / ฉาก / พร็อพที่อ้างอิงในช็อตนี้
              </li>
              <li>
                <strong>reference_audio</strong>: ไฟล์เสียงตัวอย่างของตัวละครที่มีบทพูดหรือเสียงบรรยายในช็อตนี้
              </li>
            </ol>
            <p className="seedance-rules-note">
              ระบบเปิด <code>generate_audio</code> เป็นค่าเริ่มต้น: เมื่อมีบทพูด Seedance จะสร้างเสียงพากย์จริงตามธรรมชาติ; ซับไตเติลตั้งค่าเริ่มต้นเป็นการซ้อนข้อความในการตัดต่อภายหลัง (ห้ามฝังลงในภาพโดยตรง); หากเป็นช็อตภาพล้วนจะมีเฉพาะเสียงบรรยากาศ
            </p>

            <h4>ลำดับการประกอบคำสั่งพร้อมท์อัตโนมัติ</h4>
            <ol className="seedance-rules-list">
              <li>【ข้อจำกัดบังคับ: สไตล์ภาพวิดีโอ】— คำอธิบายสไตล์ภาพที่เลือกในโปรเจกต์</li>
              <li>【ข้อจำกัดบังคับ: เสียง ซับไตเติล และดนตรีประกอบ】— วิเคราะห์จากเสียงบรรยาย / บทสนทนา / คิวภาพในบท</li>
              <li>【ข้อจำกัดบังคับ: เสียงพากย์ตัวละคร】— ชื่อตัวละคร → ลำดับเสียงอ้างอิง (ผูกเสียงแล้วและมีบทพูดในช็อตนี้)</li>
              <li>【ข้อจำกัดบังคับ: เสียงบรรยาย】— เสียงบรรยาย → ลำดับเสียงอ้างอิง (ผูกเสียงบรรยายของโปรเจกต์แล้ว)</li>
              <li>【ข้อจำกัดบังคับ: รูปลักษณ์ตัวละคร】— ชื่อตัวละคร → ลำดับภาพอ้างอิง</li>
              <li>【ข้อจำกัดบังคับ: ฉาก】— ชื่อฉาก → ลำดับภาพอ้างอิง</li>
              <li>【ข้อจำกัดบังคับ: พร็อพและสิ่งของ】— ชื่อพร็อพ → ลำดับภาพอ้างอิง</li>
              <li>
                เนื้อหาหลัก: แปลง <code>@asset:ID</code> เป็น «ชื่อ (ภาพอ้างอิง N)»; แปลง{' '}
                <code>@duration:N</code> เป็นช่วงเวลา (เช่น 00:00-00:04)
              </li>
            </ol>
          </div>
        ) : null}

        {tab === 'script' ? (
          <div className="seedance-rules-section">
            <h4>แท็กความยาวเวลา</h4>
            <ul className="seedance-rules-list">
              <li>
                <code>@duration:N</code>: ระบุความยาวของแต่ละช่วงเนื้อหา (วินาที) แนะนำช่วงละ{' '}
                {DRAMA_SEGMENT_DURATION_MIN}–{DRAMA_SEGMENT_DURATION_MAX} วินาที
              </li>
              <li>
                สตอรี่บอร์ดใหม่แนะนำความยาวรวมต่อช็อต ≤ {FRAGMENT_CONTENT_DURATION_MAX} วินาที (ช็อตเดิมรองรับสูงสุด {DRAMA_SHOT_DURATION_HARD_MAX} วินาที)
              </li>
              <li>พิมพ์ <code>@</code> เพื่อแทรกชิปความยาวเวลาหรือการอ้างอิงแอสเซท</li>
            </ul>

            <h4>การอ้างอิงแอสเซท</h4>
            <ul className="seedance-rules-list">
              <li>
                <code>@asset:123</code>: อ้างอิงตัวละคร / ฉาก / พร็อพ รหัส 123 ในเนื้อหาหลัก
              </li>
              <li>คลิกแอสเซทที่แถบด้านซ้าย หรือคลิกที่แถบ «แอสเซทที่เกี่ยวข้อง» ในช็อตนี้ เพื่อแทรกการอ้างอิงอัตโนมัติ</li>
              <li>ตัวละครที่ถูกอ้างอิงต้องมีภาพอ้างอิง ตัวละครที่มีบทพูดแนะนำให้ผูกเสียงตัวอย่าง หากไม่ผูกโมเดลจะสุ่มสร้างเสียงพากย์ตามบริบท</li>
            </ul>

            <h4>คิวคำสั่งที่ใช้บ่อยในซีรีส์</h4>
            <div className="seedance-rules-examples">
              <code>{DRAMA_SUBTITLE_CUE}</code>
              <code>【BGM: อลังการ นุ่มลึก ระดับเสียงเบากว่าเสียงพูด】</code>
              <code>@duration:4</code>
              <code>{VISUAL_PREFIX}ช็อตทัศนียภาพ: คลื่นแม่น้ำเชี่ยวกรากซัดกระทบโขดหินโบราณ...</code>
              <code>@duration:6</code>
              <code>{DIALOGUE_PREFIX}อู่อวี่: น้ำท่วมยังไม่สงบ ข้าจะถอยได้อย่างไร!</code>
              <code>{DRAMA_NARRATION_PREFIX}พันปีต่อมา ผู้คนยังคงจดจำศึกครั้งประวัติศาสตร์นี้</code>
            </div>
            <ul className="seedance-rules-list">
              <li>
                <strong>ช็อตทัศนียภาพและขนาดภาพ</strong>: เขียนเป็น «ช็อตทัศนียภาพ: …», «ภาพมุมกว้างมาก: …», «ภาพโคลสอัพ: …» หรือ{' '}
                <code>{VISUAL_PREFIX}</code>; <strong>ห้าม</strong>ระบุเป็นบทสนทนาหรือเสียงบรรยาย
              </li>
              <li>
                <strong>บทสนทนา</strong>: <code>ชื่อตัวละคร: บทพูด</code> หรือ {DIALOGUE_PREFIX}
              </li>
              <li>
                <strong>เสียงบรรยาย</strong>: {DRAMA_NARRATION_PREFIX}; ซับไตเติลจะสลับทีละประโยคตามเสียงพูด ห้ามขึ้นเต็มจอพร้อมกัน
              </li>
              <li>
                <strong>แนะนำตัวละคร</strong>: สำหรับตัวละครสำคัญที่ปรากฏตัวครั้งแรก ตัวอักษรจะแสดง<strong>ข้างตัวละครนั้น</strong> (ไม่ใช่ตรงกลางหรือด้านล่างจอ)
              </li>
              <li>
                <strong>เพลงประกอบ (BGM)</strong>: ระดับเสียงเบากว่าเสียงพูด ไม่กลบเสียงตัวละคร
              </li>
            </ul>

            <h4>ขนาดภาพและมุมกล้อง (@ → เครื่องมือช่วย)</h4>
            <ul className="seedance-rules-list">
              <li>
                ในกล่องข้อความพิมพ์ <code>@</code> → «เครื่องมือช่วย» → «ขนาดภาพ / การเคลื่อนกล้อง» สามารถคลิกแทรกคำนำหน้าได้ทันที เช่น «ช็อตทัศนียภาพ:», «ภาพโคลสอัพ:», «ดอลลี่อิน:»
              </li>
              <li>สูตรการเขียน: ประธาน + การกระทำ + ฉาก + (ขนาดภาพ/มุมกล้อง) + (แสงเงา); แนะนำแกนการเคลื่อนไหวไม่เกิน 2 แกนต่อช่วง</li>
              <li>ภาพระยะใกล้หากหมุนกล้องกว้างเกินไปใบหน้าอาจบิดเบี้ยว การหมุนกล้องรอบตัวควรใช้กับภาพระยะกลางขึ้นไป</li>
            </ul>
          </div>
        ) : null}

        {tab === 'usage' ? (
          <div className="seedance-rules-section">
            <h4>ตรวจสอบก่อนสร้าง</h4>
            <ul className="seedance-rules-list">
              <li>ตรวจสอบบท: ความยาวถูกต้องตามเกณฑ์, ช็อตทัศนียภาพไม่ถูกระบุเป็นบทสนทนาหรือเสียงบรรยาย (ระบบจะแจ้งเตือนทันทีและไม่อนุญาตให้สร้างหากมีข้อผิดพลาด)</li>
              <li>ตัวละครใน «แอสเซทที่เกี่ยวข้อง» ต้องมีภาพอ้างอิงแล้ว (หากไม่มีจะมีข้อความเตือน); ตัวละครที่มีบทพูดแนะนำให้ผูกเสียงตัวอย่าง</li>
              <li>ตรวจสอบสัดส่วนภาพและความละเอียดที่แถบด้านบน รวมถึงสไตล์วิดีโอและโมเดลก่อนกด «สร้าง»</li>
            </ul>

            <h4>คิวและการประมวลผลแบบขนาน</h4>
            <ul className="seedance-rules-list">
              <li>วิดีโอสตอรี่บอร์ดจะประมวลผลผ่านคิววิดีโออิสระ Seedance รองรับการประมวลผลพร้อมกันสูงสุด 10 ช่องทาง</li>
              <li>ขณะที่ช็อตใดช็อตหนึ่งกำลังสร้างอยู่ คุณยังสามารถแก้ไขบทของช็อตอื่น หรือเปิดดูวิดีโอของช็อตที่สร้างเสร็จแล้วได้ตามปกติ</li>
              <li>ปุ่ม «สร้างในคลิกเดียว» จะส่งทุกช็อตในตอนนี้เข้าคิวตามลำดับ ส่วนปุ่ม «สร้าง» ในแต่ละช็อตจะส่งเฉพาะช็อตปัจจุบันเท่านั้น</li>
            </ul>

            <h4>การเชื่อมต่อเฟรมท้ายระหว่างช็อต</h4>
            <ul className="seedance-rules-list">
              <li>
                ขณะสร้างระบบจะเปิด <code>return_last_frame=true</code> เป็นค่าเริ่มต้น เมื่อสำเร็จจะบันทึกเฟรมท้ายลงในสตอรี่บอร์ด{' '}
                <code>params.lastFrameUrl</code>
              </li>
              <li>
                เมื่อเปิดใช้งาน «การเชื่อมต่อระหว่างช็อต» ที่แถบด้านบน: หากช็อตนี้มีภาพอ้างอิงตัวละคร/ฉากหรือเสียง เฟรมท้ายจะถูกแนบเป็น <code>reference_image</code> ต่อท้าย (Seedance ห้ามใช้ปนกับ <code>first_frame</code>); จะใช้ <code>first_frame</code> ก็ต่อเมื่อไม่มีสื่ออ้างอิงอื่นเท่านั้น
              </li>
              <li>
                สำหรับการสร้างทั่วไป กรุณาอย่าเขียนคำว่า «แก้ไข / ขยายเวลา» ในบท เพื่อป้องกันไม่ให้งานถูกจัดประเภทผิด
              </li>
            </ul>

            <h4>เสียงพากย์และเสียงอ้างอิง</h4>
            <ul className="seedance-rules-list">
              <li>สามารถผูกไฟล์เสียงตัวอย่างให้ตัวละครได้จากคลังแอสเซท / หน้าตอน / แคนวาส เมื่อช็อตนี้มีบทพูดจะส่งเป็น reference_audio อัตโนมัติ</li>
              <li>หากไม่ได้ผูกเสียงตัวอย่าง Seedance generate_audio จะสุ่มสร้างเสียงพากย์ตามความเหมาะสม</li>
              <li>ตัวละคร/ฉาก/พร็อพที่เชื่อมโยงต้องมีภาพอ้างอิง (สร้างด้วย AI หรืออัปโหลด) ก่อนเสมอ มิฉะนั้นจะไม่สามารถสร้างวิดีโอได้</li>
            </ul>

            <h4>AI แบ่งสตอรี่บอร์ดใหม่</h4>
            <p className="seedance-rules-note">
              ระบบจะวางแผนบทและโครงสร้าง @duration ของแต่ละช็อตใหม่ทั้งหมดตามบทละครและแอสเซทที่มีอยู่ หากมีงานสร้างวิดีโอกำลังดำเนินอยู่ กรุณารอให้เสร็จสิ้นก่อนเริ่มดำเนินการ เพื่อป้องกันสถานะขัดแย้ง และควรเขียนช็อตภาพด้วยภาษาภาพ เช่น «ช็อตทัศนียภาพ: …» อย่าเขียนเป็นบทสนทนา
            </p>

          </div>
        ) : null}
      </div>
    </Modal>
  )
}
