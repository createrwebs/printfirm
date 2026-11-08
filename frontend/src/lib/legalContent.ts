/** เอกสารทางกฎหมายและหน้าติดต่อ: ข้อกำหนดการใช้งาน, นโยบายความเป็นส่วนตัว, ช่องทางการติดต่อ */

export type LegalSection = {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export type LegalDoc = {
  slug: 'terms' | 'privacy'
  title: string
  updatedAt: string
  intro: string
  sections: LegalSection[]
}

export const LEGAL_DOCS: Record<'terms' | 'privacy', LegalDoc> = {
  terms: {
    slug: 'terms',
    title: 'ข้อกำหนดและเงื่อนไขการใช้บริการ',
    updatedAt: '2026-08-17',
    intro:
      'ยินดีต้อนรับสู่ PRINTFILM (ต่อไปนี้เรียกว่า "แพลตฟอร์ม") โปรดอ่านข้อตกลงนี้อย่างละเอียดก่อนลงทะเบียนหรือใช้บริการ การเริ่มต้นใช้งานถือว่าคุณได้อ่านและยอมรับข้อกำหนดต่อไปนี้ทั้งหมดแล้ว',
    sections: [
      {
        title: '1. คำอธิบายบริการ',
        paragraphs: [
          'PRINTFILM ให้บริการที่เกี่ยวข้องกับละครสั้น AI, วิดีโอสั้น AI และเครื่องมือสร้างสรรค์ (รวมถึงการสร้างรูปภาพจากข้อความ, ภาพต่อภาพ, และข้อความเป็นวิดีโอ) เนื้อหาบริการอาจมีการปรับเปลี่ยนตามการพัฒนาผลิตภัณฑ์ โดยเราจะระบุการเปลี่ยนแปลงสำคัญในหน้าเว็บหรือผ่านการประกาศ',
          'แพลตฟอร์มคิดค่าบริการตามปริมาณการใช้งานโมเดลจริง เครดิตที่เติมไม่มีวันหมดอายุ และไม่มีระบบสมัครสมาชิกรายเดือนแบบบังคับ อัตราค่าบริการและโปรโมชั่นเป็นไปตามที่แสดงในหน้าแสดงราคาและขั้นตอนการชำระเงิน',
        ],
      },
      {
        title: '2. บัญชีและความปลอดภัย',
        bullets: [
          'คุณต้องใช้ข้อมูลที่เป็นจริงและถูกต้องในการลงทะเบียน และต้องรับผิดชอบต่อการกระทำทั้งหมดภายใต้บัญชีของคุณ',
          'โปรดเก็บรักษาข้อมูลการเข้าสู่ระบบอย่างปลอดภัย ความเสียหายที่เกิดจากข้อมูลรั่วไหลหรือการแชร์บัญชีถือเป็นความรับผิดชอบของคุณเอง',
          'หากพบการใช้งานที่ไม่ได้รับอนุญาต โปรดแจ้งให้เราทราบทันทีผ่านหน้า "ติดต่อเรา"',
          'เราขอสงวนสิทธิ์ในการจำกัด ระงับ หรือยกเลิกบัญชีเมื่อพบการละเมิด การฉ้อโกง หรือการใช้งานที่ไม่เหมาะสม',
        ],
      },
      {
        title: '3. เนื้อหาและทรัพย์สินทางปัญญา',
        paragraphs: [
          'คำสั่ง (Prompt), บทละคร, และไฟล์มีเดียที่คุณป้อนยังคงเป็นกรรมสิทธิ์ของคุณหรือผู้ถือสิทธิ์เดิม คุณรับรองว่ามีสิทธิ์ตามกฎหมายในเนื้อหาที่อัปโหลด และไม่ละเมิดทรัพย์สินทางปัญญา สิทธิในภาพบุคคล หรือสิทธิความเป็นส่วนตัวของบุคคลภายนอก',
          'เนื้อหาที่สร้างโดย AI อาจมีความไม่ถูกต้อง ไม่สมบูรณ์ หรือไม่ตรงตามที่คาดหวัง โปรดตรวจสอบด้วยตนเองก่อนนำไปเผยแพร่อย่างเป็นทางการ ข้อพิพาทใดๆ ที่เกิดขึ้นจากการนำเนื้อหาไปเผยแพร่หรือใช้งานในเชิงพาณิชย์ถือเป็นความรับผิดชอบของคุณเอง',
          'ทรัพย์สินทางปัญญาในอินเทอร์เฟซ เครื่องหมายการค้า ซอฟต์แวร์ และเอกสารของแพลตฟอร์มเป็นของ PRINTFILM หรือผู้ให้อนุญาต ห้ามคัดลอก ทำวิศวกรรมย้อนกลับ หรือนำไปใช้ในเชิงพาณิชย์ที่ไม่เกี่ยวข้องโดยไม่ได้รับอนุญาต',
        ],
      },
      {
        title: '4. การคิดค่าบริการและการเติมเงิน',
        bullets: [
          'งานสร้างสรรค์จะคิดค่าบริการตามต้นทุนจริงของโมเดลต้นทาง โดยอาจมีการกันวงเงินประเมินไว้ล่วงหน้า และคิดค่าใช้จ่ายจริงเมื่อสร้างเสร็จสิ้น (คืนส่วนเกิน เรียกเก็บส่วนขาด)',
          'การเติมเงินดำเนินการผ่านช่องทางการชำระเงินที่รองรับ โดยยอดเงินจะเข้าบัญชีตามการบันทึกของระบบ',
          'ยอดเงินที่เติมแล้วไม่สามารถขอคืนเงินได้ เว้นแต่กฎหมายจะกำหนดไว้เป็นอย่างอื่นหรือมีข้อตกลงที่ชัดเจนกับแพลตฟอร์ม',
          'หากเกิดข้อผิดพลาดของระบบทำให้ถูกหักเงินซ้ำหรือไม่ได้รับเครดิต โปรดเก็บหมายเลขคำสั่งซื้อและติดต่อฝ่ายบริการลูกค้าเพื่อตรวจสอบ',
        ],
      },
      {
        title: '5. ข้อห้ามในการใช้งาน',
        bullets: [
          'ห้ามใช้บริการเพื่อสร้างหรือเผยแพร่เนื้อหาที่ผิดกฎหมาย ลามกอนาจาร รุนแรง สร้างความเกลียดชัง ฉ้อโกง หรือละเมิดสิทธิ์ของผู้อื่น',
          'ห้ามโจมตี เจาะระบบ หลีกเลี่ยงระบบคิดเงิน ใช้งาน API เกินขอบเขต หรือรบกวนผู้ใช้งานรายอื่น',
          'ห้ามจำหน่ายต่อบัญชี ลงทะเบียนจำนวนมาก หรือกระทำการใดๆ ที่ส่งผลเสียต่อการดำเนินงานอย่างเป็นธรรมของแพลตฟอร์ม',
        ],
      },
      {
        title: '6. ข้อจำกัดความรับผิด',
        paragraphs: [
          'ภายใต้ขอบเขตที่กฎหมายอนุญาต แพลตฟอร์มไม่ต้องรับผิดชอบต่อการหยุดชะงักของบริการหรือการสูญหายของข้อมูลที่เกิดจากปัญหาเครือข่าย การหยุดให้บริการของบุคคลภายนอก หรือเหตุสุดวิสัย',
          'ผลลัพธ์จาก AI เป็นเพียงเครื่องมือช่วยสร้างสรรค์ ไม่ถือเป็นคำแนะนำจากผู้เชี่ยวชาญ แพลตฟอร์มจะไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดจากการพึ่งพาเนื้อหาที่สร้างขึ้น เกินกว่าจำนวนค่าบริการที่คุณได้ชำระจริง',
        ],
      },
      {
        title: '7. การแก้ไขและการยกเลิกข้อตกลง',
        paragraphs: [
          'เราอาจแก้ไขข้อตกลงนี้เป็นครั้งคราว โดยเวอร์ชันที่แก้ไขจะประกาศในหน้านี้พร้อมระบุวันที่ปรับปรุง การใช้งานบริการต่อไปของคุณถือว่ายอมรับข้อตกลงฉบับปรับปรุง',
          'คุณสามารถหยุดใช้บริการและขอลบบัญชีได้ตลอดเวลา และเราสามารถยุติการให้บริการแก่คุณได้หากคุณละเมิดข้อตกลงนี้อย่างร้ายแรง',
        ],
      },
      {
        title: '8. การติดต่อ',
        paragraphs: [
          'หากมีข้อสงสัยเกี่ยวกับข้อตกลงนี้ โปรดไปที่หน้า "ติดต่อเรา" เพื่อส่งข้อเสนอแนะ หรือส่งอีเมลมาที่ support@printfilm.com',
        ],
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'นโยบายความเป็นส่วนตัว',
    updatedAt: '2026-08-17',
    intro:
      'PRINTFILM ให้ความสำคัญกับความเป็นส่วนตัวของคุณ นโยบายนี้อธิบายวิธีที่เรารวบรวม ใช้งาน จัดเก็บ และปกป้องข้อมูลส่วนบุคคลของคุณ การใช้งานแพลตฟอร์มถือว่าคุณเข้าใจและยอมรับการประมวลผลข้อมูลตามที่ระบุไว้ในนโยบายนี้',
    sections: [
      {
        title: '1. ข้อมูลที่เราเก็บรวบรวม',
        bullets: [
          'ข้อมูลบัญชี: อีเมลที่ลงทะเบียน ชื่อที่แสดง รูปโปรไฟล์ ข้อมูลการเข้าสู่ระบบและการยืนยันตัวตน',
          'ข้อมูลการใช้งาน: โปรเจกต์ที่สร้าง คำสั่ง (Prompt) สถานะงานสร้างสรรค์ ประวัติการทำงานของเครื่องมือ และเนื้อหาในคลังแอสเซท',
          'ข้อมูลการชำระเงิน: ยอดคงเหลือ ยอดที่กันไว้ คำสั่งซื้อเติมเงิน รายการหักค่าใช้จ่าย (การชำระเงินประมวลผลโดยบุคคลภายนอก เราไม่เก็บหมายเลขบัตรเครดิตเต็มจำนวน)',
          'บันทึกทางเทคนิค: ที่อยู่ IP ประเภทของเบราว์เซอร์ เวลาที่เข้าชม สำหรับความปลอดภัยและการวินิจฉัยปัญหา',
        ],
      },
      {
        title: '2. วัตถุประสงค์ในการใช้ข้อมูล',
        bullets: [
          'เพื่อให้บริการ บำรุงรักษา และปรับปรุงบริการสร้างสรรค์ละครสั้น วิดีโอสั้น และเครื่องมือ AI',
          'เพื่อยืนยันตัวตน คำนวณค่าบริการ ตรวจสอบคำสั่งซื้อ และให้บริการสนับสนุนลูกค้า',
          'เพื่อรักษาความปลอดภัยของบัญชีและระบบ ป้องกันการฉ้อโกงและการใช้งานในทางที่ผิด',
          'เพื่อส่งการแจ้งเตือนเกี่ยวกับบริการหรือการอัปเดตผลิตภัณฑ์ เมื่อได้รับความยินยอมหรือตามที่กฎหมายอนุญาต',
        ],
      },
      {
        title: '3. การจัดเก็บข้อมูลและบุคคลภายนอก',
        paragraphs: [
          'ไฟล์มีเดียและงานสร้างสรรค์ของคุณอาจจัดเก็บในบริการคลาวด์อ็อบเจกต์สตอเรจ (เช่น OSS) เพื่อให้สามารถดูตัวอย่างและดาวน์โหลดได้',
          'การชำระเงินได้รับการประมวลผลโดยพันธมิตรผู้ให้บริการชำระเงิน การประมวลผลโมเดล AI ดำเนินการโดยผู้ให้บริการโมเดลต้นทาง เราจะส่งเฉพาะข้อมูลที่จำเป็นต่อการให้บริการเท่านั้น และกำหนดให้ปกป้องข้อมูลตามมาตรฐาน',
          'เราจะไม่ขายข้อมูลส่วนบุคคลของคุณให้แก่บุคคลภายนอกที่ไม่เกี่ยวข้อง เว้นแต่จะเป็นไปตามข้อกำหนดทางกฎหมาย ได้รับความยินยอมจากคุณ หรือเพื่อปกป้องสิทธิ์ที่ชอบด้วยกฎหมายของแพลตฟอร์มและผู้ใช้งาน',
        ],
      },
      {
        title: '4. คุกกี้และการจัดเก็บในเครื่อง',
        paragraphs: [
          'เราอาจใช้คุกกี้หรือพื้นที่จัดเก็บในเบราว์เซอร์ (เช่น โทเค็น) เพื่อคงสถานะการเข้าสู่ระบบและบันทึกการตั้งค่าของคุณ คุณสามารถล้างข้อมูลเหล่านี้ในเบราว์เซอร์ได้ แต่อาจต้องเข้าสู่ระบบใหม่อีกครั้ง',
        ],
      },
      {
        title: '5. สิทธิ์ของคุณ',
        bullets: [
          'ตรวจสอบและแก้ไขข้อมูลบัญชีของคุณ (ดำเนินการได้ในหน้าโปรไฟล์ส่วนตัว)',
          'ส่งออกหรือดาวน์โหลดผลงานสร้างสรรค์ที่คุณมีสิทธิ์เข้าถึง (ภายในขอบเขตการทำงานของผลิตภัณฑ์)',
          'ขอลบบัญชีผู้ใช้ โดยเราจะลบหรือทำให้ข้อมูลส่วนบุคคลไม่สามารถระบุตัวตนได้ตามกฎหมาย ยกเว้นข้อมูลที่กฎหมายกำหนดให้ต้องเก็บรักษา',
          'สอบถามหรือร้องเรียนเกี่ยวกับปัญหาความเป็นส่วนตัว',
        ],
      },
      {
        title: '6. การคุ้มครองผู้เยาว์',
        paragraphs: [
          'แพลตฟอร์มนี้มีวัตถุประสงค์สำหรับผู้มีความสามารถตามกฎหมาย หากคุณยังเป็นผู้เยาว์ โปรดอ่านนโยบายนี้และใช้บริการภายใต้การดูแลของผู้ปกครอง',
        ],
      },
      {
        title: '7. การอัปเดตนโยบาย',
        paragraphs: [
          'เราอาจปรับปรุงนโยบายนี้และประกาศเวอร์ชันล่าสุดพร้อมระบุวันที่ปรับปรุงในหน้านี้ สำหรับการเปลี่ยนแปลงสำคัญ เราจะแจ้งให้ทราบผ่านระบบแจ้งเตือนภายในแพลตฟอร์มเท่าที่สามารถทำได้',
        ],
      },
      {
        title: '8. ติดต่อเรา',
        paragraphs: [
          'หากมีข้อสงสัยเกี่ยวกับนโยบายนี้ โปรดไปที่หน้า "ติดต่อเรา" หรือส่งอีเมลมาที่ support@printfilm.com',
        ],
      },
    ],
  },
}

export const LEGAL_DOCS_EN: Record<'terms' | 'privacy', LegalDoc> = {
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    updatedAt: '2026-08-17',
    intro:
      'Welcome to PRINTFILM (“the Platform”). Please read these terms before you register or use the service. Using the Platform means you have read and agree to them.',
    sections: [
      {
        title: '1. The service',
        paragraphs: [
          'PRINTFILM provides AI drama, explainer video, and creation tools (including text-to-image, image-to-image, and text-to-video). Features may change as the product evolves; we will try to note material changes on the site or in notices.',
          'Billing follows actual upstream model usage. Topped-up balance does not expire and there is no forced subscription. Prices and bonuses follow the Pricing page and the checkout screen.',
        ],
      },
      {
        title: '2. Accounts and security',
        bullets: [
          'Register with accurate information and you are responsible for activity under the account.',
          'Keep credentials safe. Losses from leaks or sharing are yours to bear.',
          'If you see unauthorized use, tell us via Contact.',
          'We may limit, freeze, or close accounts for abuse, fraud, or policy violations.',
        ],
      },
      {
        title: '3. Content and IP',
        paragraphs: [
          'Prompts, scripts, and uploads remain yours or the original rights holder’s. You warrant you have the right to upload them and will not infringe IP, portrait, or privacy rights.',
          'AI output may be inaccurate or unexpected. Review it before publishing. Disputes from your public or commercial use are your responsibility.',
          'The Platform UI, marks, software, and docs belong to PRINTFILM or licensors. Do not copy, reverse-engineer, or use them outside this service without permission.',
        ],
      },
      {
        title: '4. Billing and top-ups',
        bullets: [
          'Generation jobs are billed by upstream tokens or agreed unit prices. We may pre-authorize an estimate and settle the real usage afterward.',
          'Top-ups go through Alipay, WeChat Pay, and similar channels. Arrival follows system records.',
          'Except where law requires otherwise or we explicitly agree, arrived credits are generally non-refundable.',
          'If a fault causes a double charge or missing credit, keep the order ID and contact support.',
        ],
      },
      {
        title: '5. Prohibited use',
        bullets: [
          'Do not create or spread illegal, pornographic, violent, hateful, fraudulent, or otherwise infringing content.',
          'Do not attack, scrape, bypass billing, abuse APIs, or disrupt other users.',
          'Do not resell accounts, bulk-register, or otherwise harm fair operation.',
        ],
      },
      {
        title: '6. Disclaimers',
        paragraphs: [
          'To the extent allowed by law, we are not liable for outages or data loss from network faults, third-party interruptions, or force majeure.',
          'AI output is a creation aid, not professional advice. We are not liable beyond fees you paid for losses from relying on generated content, except where law requires otherwise.',
        ],
      },
      {
        title: '7. Changes and termination',
        paragraphs: [
          'We may revise these terms and post the new version here with an updated date. Continued use means you accept the revision.',
          'You may stop using the service and request account deletion. We may also stop serving you if you seriously breach these terms.',
        ],
      },
      {
        title: '8. Contact',
        paragraphs: [
          'Questions about these terms: use Contact or email support@printfilm.com.',
        ],
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    updatedAt: '2026-08-17',
    intro:
      'PRINTFILM respects your privacy. This policy explains how we collect, use, store, and protect personal information. Using the Platform means you understand this processing.',
    sections: [
      {
        title: '1. Information we collect',
        bullets: [
          'Account data: email, display name, avatar, and authentication data.',
          'Usage data: projects, prompts, job status, tool runs, and asset library content.',
          'Billing data: balance, holds, top-up orders, and usage ledgers (payment is handled by third parties; we do not store full card numbers).',
          'Technical logs: IP, browser type, and access time for security and debugging.',
        ],
      },
      {
        title: '2. How we use it',
        bullets: [
          'Provide, maintain, and improve drama, explainer, and tool services.',
          'Identity checks, billing, order queries, and support.',
          'Account and system security, fraud and abuse prevention.',
          'Service notices or product updates where you consent or law allows.',
        ],
      },
      {
        title: '3. Storage and third parties',
        paragraphs: [
          'Media and project files may live in cloud object storage (such as Alibaba Cloud OSS) for preview and download.',
          'Payments go through partners such as Epay; model inference goes through upstream providers. We share only what is needed to complete the service.',
          'We do not sell personal information to unrelated third parties except as required by law, with your consent, or to protect the Platform and users.',
        ],
      },
      {
        title: '4. Cookies and local storage',
        paragraphs: [
          'We may use cookies or local storage (such as a token) to keep you signed in and remember preferences. Clearing them may require signing in again.',
        ],
      },
      {
        title: '5. Your rights',
        bullets: [
          'View and correct profile data in Account.',
          'Export or download creative output where the product allows.',
          'Request account deletion; we will delete or anonymize personal data as required, except records the law keeps.',
          'Ask questions or complain about privacy.',
        ],
      },
      {
        title: '6. Children',
        paragraphs: [
          'The Platform is intended for users with full civil capacity. If you are a minor, read this policy and use the service with a guardian.',
        ],
      },
      {
        title: '7. Policy updates',
        paragraphs: [
          'We may update this policy and post the latest version and date here. For material changes we will try to notify you in-product.',
        ],
      },
      {
        title: '8. Contact',
        paragraphs: [
          'Questions: use Contact or email support@printfilm.com.',
        ],
      },
    ],
  },
}

// เลือกข้อกำหนดการใช้งาน / นโยบายความเป็นส่วนตัวตามภาษาของอินเทอร์เฟซ
export function getLegalDoc(slug: 'terms' | 'privacy', locale: string): LegalDoc {
  const pack = locale === 'en' ? LEGAL_DOCS_EN : LEGAL_DOCS
  return pack[slug]
}

export type ContactChannel = {
  title: string
  desc: string
  href?: string
  actionLabel?: string
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    title: 'ฝ่ายสนับสนุนทางอีเมล',
    desc: 'ตอบกลับภายใน 1–2 วันทำการ โปรดระบุอีเมลบัญชีและหมายเลขคำสั่งซื้อ (หากมี)',
    href: 'mailto:support@printfilm.com',
    actionLabel: 'support@printfilm.com',
  },
  {
    title: 'ศูนย์ช่วยเหลือ',
    desc: 'คำถามที่พบบ่อยเกี่ยวกับการเติมเงิน ดาวน์โหลด ละครสั้น และเครื่องมือ สามารถค้นหาคำตอบเบื้องต้นได้ที่ศูนย์ช่วยเหลือ',
    href: '/help',
    actionLabel: 'ไปยังศูนย์ช่วยเหลือ',
  },
  {
    title: 'ความร่วมมือระดับองค์กร / ชำระผ่านบัญชีนิติบุคคล',
    desc: 'สำหรับการเติมเครดิตจำนวนมาก ความร่วมมือทาง API หรือการออกใบกำกับภาษี โปรดส่งอีเมลระบุชื่อบริษัทและความต้องการ',
    href: 'mailto:support@printfilm.com?subject=PRINTFILM%20ความร่วมมือระดับองค์กร',
    actionLabel: 'ส่งอีเมลความร่วมมือ',
  },
]

export const CONTACT_TOPICS = [
  'บัญชีและการเข้าสู่ระบบ',
  'การเติมเงินและยอดเครดิต',
  'ปัญหาการสร้างสรรค์',
  'การดาวน์โหลดและแอสเซท',
  'ความเป็นส่วนตัวและการลบบัญชี',
  'อื่นๆ',
] as const
