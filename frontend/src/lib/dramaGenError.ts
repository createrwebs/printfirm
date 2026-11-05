/** 漫剧生成队列：把上游/平台原始错误翻成可读中文，并附处理建议 */

import { dialog } from './dialog'
import { isBillingError } from './billingError'
import { formatCopyrightError } from './generationError.ts'

export type DramaGenErrorView = {
  /** 短标题 */
  title: string
  /** 用户可读说明 */
  message: string
  /** 建议操作 */
  suggestion?: string
  /** 是否余额不足（展示充值跳转） */
  billingBlocked?: boolean
  /** 是否上游模型账户欠费（提醒管理员，非用户钱包） */
  upstreamAccountBlocked?: boolean
}

/** 是否为上游 Seedream 账户欠费 */
export function isUpstreamAccountError(message: string): boolean {
  return /AccountOverdueError|上游 Seedream 账户欠费|上游.*账户欠费/i.test(message)
}

// 从 Seedance JSON 文案里取出 content[n]
function extractContentIndex(raw: string): number | null {
  const m = raw.match(/content\[(\d+)\]/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/** 判断文案是否像「具体根因」（优先于「重试上限」等包装句） */
function looksLikeRootCause(text: string): boolean {
  if (formatCopyrightError(text)) return true
  return /PrivacyInformation|InputImageSensitive|SensitiveContentDetected|参考图疑似|参考音频过短|参考音频过长|无法读取参考音频时长|may contain real person|Seedance create error|上一镜失败|无法衔接|分镜已变更|分镜上下文|InputTextSensitive|resource download failed|audio_url|audio duration|Credits insufficient|File type not supported|参考图格式不支持|invalid image format|参考图格式无效|未开通/i.test(
    text,
  )
}

// 从错误里尽量抽出已标注的槽位名（后端 content_labels）
function extractNamedSlot(text: string): string | null {
  const named = text.match(/(角色|场景|道具|旁白|参考图|音色)「([^」]+)」/)
  if (named) return `${named[1]}「${named[2]}」`
  return null
}

/**
 * 从多条候选错误里挑出最具体的根因（例如隐私图审核），
 * 避免只展示「重试超过上限」这类包装文案。
 */
export function pickRootDramaGenError(
  candidates: Array<string | null | undefined>,
): string {
  const cleaned = candidates.map((c) => String(c || '').trim()).filter(Boolean)
  const root = cleaned.find(looksLikeRootCause)
  if (root) return root
  return cleaned[0] || ''
}

/**
 * 将任务 error / error_message 转为前端展示文案。
 * 已是中文短句时尽量保留，仅补建议。
 */
export function formatDramaGenError(raw: string | null | undefined): DramaGenErrorView {
  const text = String(raw || '').trim()
  const copyright = formatCopyrightError(text)
  if (copyright) return copyright
  if (!text) {
    return {
      title: 'การสร้างล้มเหลว',
      message: 'งานไม่สามารถทำจนเสร็จสิ้นได้ และไม่มีการบันทึกข้อความข้อผิดพลาดที่ชัดเจน',
      suggestion: 'กรุณาลองใหม่อีกครั้งในภายหลัง หากยังล้มเหลวซ้ำ กรุณาตรวจสอบการเชื่อมต่อเครือข่ายและคีย์ API ของโมเดล',
    }
  }

  if (/ReadTimeout|WriteTimeout|等待上游超时|响应超时/i.test(text)) {
    return {
      title: 'เซิร์ฟเวอร์ปลายทางตอบสนองเกินเวลา',
      message: text.length > 200 ? `${text.slice(0, 200)}…` : text,
      suggestion: 'เชื่อมต่อบริการได้แล้ว แต่การสร้างรูปภาพหรือวิดีโอใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้งในภายหลัง สาเหตุส่วนใหญ่เกิดจากคิวของเซิร์ฟเวอร์ปลายทางหนาแน่น',
    }
  }

  if (/网络错误|ConnectError|ConnectTimeout|无法连接上游|tokenfree\.com/i.test(text)) {
    return {
      title: 'ไม่สามารถเชื่อมต่อบริการรูปภาพหรือวิดีโอได้',
      message: text.length > 200 ? `${text.slice(0, 200)}…` : text,
      suggestion: 'ไม่สามารถเชื่อมต่อไปยังผู้ให้บริการปลายทางได้ กรุณาตรวจสอบเครือข่ายอินเทอร์เน็ตและยืนยันว่าคีย์ API ใช้งานได้',
    }
  }

  if (/^生图失败$/.test(text)) {
    return {
      title: 'สร้างรูปภาพไม่สำเร็จ',
      message: 'การสร้างรูปภาพไม่สำเร็จ (การเชื่อมต่อไปยังบริการล้มเหลว)',
      suggestion: 'กรุณาลองสร้างใหม่อีกครั้ง หากยังไม่สำเร็จให้ตรวจสอบเครือข่ายและคีย์ API',
    }
  }

  if (isUpstreamAccountError(text) || (/Seedream error 403/i.test(text) && /AccountOverdue/i.test(text))) {
    return {
      title: 'ยอดเงินในบัญชีบริการโมเดลหมด',
      message: 'ยอดเงินคงเหลือในบัญชีบริการโมเดลปลายทางไม่เพียงพอ คำขอจึงถูกปฏิเสธ ปัญหานี้เกิดจากยอดเงินของระบบโมเดลหลัก ไม่ใช่กระเป๋าเงินของผู้ใช้',
      suggestion: 'กรุณาติดต่อผู้ดูแลระบบเพื่อเติมเครดิตในคอนโซลโมเดล เมื่อเติมแล้วสามารถกดสร้างใหม่ได้ทันที',
      upstreamAccountBlocked: true,
    }
  }

  if (isBillingError(text)) {
    return {
      title: 'ยอดเงินคงเหลือไม่เพียงพอ',
      message: /余额不足|请先充值/.test(text) ? text : 'ยอดเงินคงเหลือของคุณไม่เพียงพอ ไม่สามารถดำเนินการสร้างต่อได้',
      suggestion: 'กรุณาเติมเงินก่อนลองทำรายการใหม่อีกครั้ง',
      billingBlocked: true,
    }
  }

  if (
    /参考图疑似真人|PrivacyInformation|InputImageSensitive|SensitiveContentDetected|may contain real person/i.test(
      text,
    )
  ) {
    const idx = extractContentIndex(text)
    const named = text.match(/(角色|场景|道具|参考图)「([^」]+)」/)
    if (named) {
      return {
        title: 'ภาพอ้างอิงคล้ายบุคคลจริง',
        message: `ไม่ผ่านการตรวจสอบความปลอดภัยของบริการวิดีโอ: ภาพอ้างอิงของ ${named[1]} «${named[2]}» อาจมีใบหน้าบุคคลจริง ระบบจึงปฏิเสธการสร้าง`,
        suggestion: `กรุณาเปิด «${named[2]}» ที่แถบแอสเซทด้านซ้าย แล้วสร้างใหม่หรืออัปโหลดภาพสไตล์อนิเมะ/ภาพวาดประกอบแทนภาพถ่ายจริง`,
      }
    }
    const where =
      idx != null
        ? ` (รายการที่ส่งลำดับที่ ${idx + 1} / content[${idx}] มักเป็นภาพอ้างอิงตัวละครหรือฉาก)`
        : ' (ภาพอ้างอิงบางภาพ)'
    return {
      title: 'ภาพอ้างอิงคล้ายบุคคลจริง',
      message: `ไม่ผ่านการตรวจสอบความปลอดภัยของบริการวิดีโอ: ภาพอ้างอิง${where}อาจมีใบหน้าบุคคลจริง ระบบจึงปฏิเสธการสร้าง`,
      suggestion: 'กรุณาเปิดแถบแอสเซทด้านซ้าย แล้วสร้างภาพตัวละครหรือฉากใหม่ด้วยสไตล์อนิเมะหรือภาพประกอบ (หลีกเลี่ยงภาพถ่ายบุคคลจริง) แล้วจึงกดสร้างช็อตนี้อีกครั้ง',
    }
  }

  if (/重试超过上限|超过重试上限|内部自动重试超过上限/.test(text)) {
    return {
      title: 'การสร้างล้มเหลวหลายครั้งติดต่อกัน',
      message: text,
      suggestion: 'ระบบพยายามลองใหม่อัตโนมัติจนครบจำนวนครั้งแล้ว กรุณาตรวจสอบสาเหตุ เช่น การตรวจสอบภาพบุคคลจริง แล้วแก้ไขสื่อหรือบทก่อนกดสร้างใหม่อีกครั้ง',
    }
  }

  if (/上一镜失败|无法衔接尾帧/.test(text)) {
    return {
      title: 'ไม่สามารถเชื่อมต่อกับช็อตก่อนหน้าได้',
      message: 'ช็อตนี้ต้องใช้เฟรมท้ายของช็อตก่อนหน้าเพื่อเชื่อมต่อ แต่ช็อตก่อนหน้ายังสร้างไม่สำเร็จ จึงยังไม่เริ่มสร้างช็อตนี้',
      suggestion: 'กรุณาสร้างช็อตก่อนหน้าให้สำเร็จก่อน แล้วจึงสร้างช็อตถัดไปตามลำดับ',
    }
  }

  if (/分镜已变更|分镜上下文丢失|分镜不存在/.test(text)) {
    return {
      title: 'สตอรี่บอร์ดได้รับการอัปเดตแล้ว',
      message: 'สตอรี่บอร์ดถูกบันทึกหรือแบ่งใหม่ระหว่างการสร้าง งานเก่าจึงถูกยกเลิก',
      suggestion: 'กรุณากดสร้างใหม่จากรายการสตอรี่บอร์ดปัจจุบัน',
    }
  }

  if (/InputTextSensitive|text.*sensitive|敏感/i.test(text) && /Seedance|create error/i.test(text)) {
    return {
      title: 'ข้อความไม่ผ่านการตรวจสอบความปลอดภัย',
      message: 'บทสตอรี่บอร์ดหรือคำสั่งพร้อมท์มีคำที่ตรวจพบว่าเป็นเนื้อหาที่ไม่ปลอดภัย',
      suggestion: 'กรุณาปรับแก้ข้อความในบทสตอรี่บอร์ดแล้วลองใหม่อีกครั้ง',
    }
  }

  if (/resource download failed|audio_url/i.test(text) && !/audio duration/i.test(text)) {
    return {
      title: 'ไม่สามารถดาวน์โหลดไฟล์เสียงอ้างอิงได้',
      message: 'ที่อยู่ไฟล์เสียงอ้างอิงไม่ถูกต้องหรือไม่สามารถเข้าถึงได้ชั่วคราว',
      suggestion: 'กรุณาตรวจสอบไฟล์เสียงตัวอย่างที่ผูกไว้กับตัวละคร สร้างใหม่หรือเปลี่ยนเสียงแล้วลองอีกครั้ง',
    }
  }

  if (/无法读取参考音频时长|参考音频地址为空/i.test(text)) {
    const named = extractNamedSlot(text)
    return {
      title: 'ไม่สามารถตรวจสอบไฟล์เสียงอ้างอิงได้',
      message: named
        ? `ไม่สามารถตรวจสอบความยาวหรือที่อยู่ไฟล์เสียงของ ${named} ได้`
        : text.length > 160
          ? `${text.slice(0, 160)}…`
          : text,
      suggestion: 'กรุณาตรวจสอบไฟล์เสียงตัวอย่างว่าเข้าถึงได้หรือไม่ อัปโหลดหรือสร้างใหม่ก่อนกดสร้างช็อตนี้',
    }
  }

  if (/参考音频过长/i.test(text)) {
    const named = extractNamedSlot(text)
    const dur = text.match(/当前约\s*([\d.]+)\s*秒/)
    return {
      title: 'ไฟล์เสียงอ้างอิงยาวเกินไป',
      message: named
        ? `ไฟล์เสียงอ้างอิงของ ${named} ยาวเกินไป${dur ? ` (ประมาณ ${dur[1]} วินาที)` : ''} ต้อง ≤ 30 วินาที`
        : text.length > 160
          ? `${text.slice(0, 160)}…`
          : text,
      suggestion: 'กรุณาตัดความยาวไฟล์เสียงของตัวละครหรือเสียงบรรยายให้สั้นลง (ไม่เกิน 30 วินาที)',
    }
  }

  // Seedance r2v：reference_audio 须 ≥ 1.8 秒（不是参考图）
  if (
    /参考音频过短/i.test(text) ||
    (/audio duration|1\.8/i.test(text) && /audio|音色|reference_audio|content\[/i.test(text))
  ) {
    const idx = extractContentIndex(text)
    const named = extractNamedSlot(text)
    const dur = text.match(/当前约\s*([\d.]+)\s*秒/)
    const where =
      named ||
      (idx != null ? `รายการที่ส่งลำดับที่ ${idx + 1} / content[${idx}] (ไฟล์เสียงอ้างอิง ไม่ใช่รูปภาพ)` : 'เสียงของตัวละครหรือเสียงบรรยาย')
    return {
      title: 'ไฟล์เสียงอ้างอิงสั้นเกินไป',
      message: dur
        ? `ไฟล์เสียงอ้างอิง ${where} ยาวประมาณ ${dur[1]} วินาที ต้อง ≥ 1.8 วินาที`
        : `บริการวิดีโอกำหนดให้เสียงอ้างอิงต้องยาวอย่างน้อย 1.8 วินาที ขณะนี้สั้นเกินไป: ${where}`,
      suggestion: 'กรุณาเปิดแอสเซทตัวละครหรือเสียงบรรยาย แล้วสร้างหรืออัปโหลดไฟล์เสียงที่มีความยาวมากขึ้น (แนะนำ ≥ 2 วินาที)',
    }
  }

  if (/only support adaptive aspect ratio|adaptive aspect ratio/i.test(text)) {
    return {
      title: 'สัดส่วนภาพไม่เข้ากัน',
      message: 'สัดส่วนภาพที่ระบุไม่เข้ากันกับโมเดลการสร้างวิดีโอจากภาพเฟรมแรก',
      suggestion: 'กรุณากดสร้างช็อตนี้ใหม่อีกครั้ง ระบบจะปรับสัดส่วนภาพให้เหมาะสมโดยอัตโนมัติ',
    }
  }

  if (/Credits insufficient|积分不足|余额不足.*[Kk]ie|Kie.*积分/i.test(text)) {
    return {
      title: 'เครดิตของช่องทางวิดีโอไม่เพียงพอ',
      message: 'เครดิตในบัญชีบริการวิดีโอปลายทางไม่เพียงพอ ไม่สามารถสร้างงานวิดีโอได้',
      suggestion: 'กรุณาติดต่อผู้ดูแลระบบเพื่อเติมเครดิตในคอนโซลผู้ให้บริการ แล้วลองสร้างใหม่อีกครั้ง',
      upstreamAccountBlocked: true,
    }
  }

  if (/未开通|无可用渠道|distributor/i.test(text)) {
    return {
      title: 'โมเดลรูปภาพยังไม่เปิดใช้งาน',
      message: text.length > 180 ? `${text.slice(0, 180)}…` : text,
      suggestion: 'กรุณาให้ผู้ดูแลระบบเปิดใช้งานโมเดลนี้ในคอนโซลก่อนสร้างงาน',
    }
  }

  if (/File type not supported|参考图格式不支持|不支持 SVG/i.test(text)) {
    return {
      title: 'รูปแบบภาพอ้างอิงไม่รองรับ',
      message: 'บริการปลายทางปฏิเสธภาพอ้างอิง: รูปแบบไฟล์ไม่รองรับ (ต้องเป็นไฟล์บิตแมป เช่น PNG/JPG/WEBP)',
      suggestion: 'ตรวจสอบว่าภาพของตัวละคร ฉาก หรือพร็อพ เป็นไฟล์ PNG, JPG หรือ WEBP หรือไม่ หากยังเป็นรูป placeholder กรุณาสร้างภาพหรืออัปโหลดรูปภาพใหม่ก่อน',
    }
  }

  // 参考图槽位收到非图片（常见：音色 mp3 误进 image_url）
  if (/invalid image format|参考图格式无效/i.test(text)) {
    const idx = extractContentIndex(text)
    const named = extractNamedSlot(text)
    const where =
      named ||
      (idx != null ? `รายการที่ส่งลำดับที่ ${idx + 1} / content[${idx}]` : 'ภาพอ้างอิงบางภาพ')
    return {
      title: 'รูปแบบภาพอ้างอิงไม่ถูกต้อง',
      message: `การตรวจสอบรูปภาพล้มเหลว: ${where}`,
      suggestion: 'กรุณาตรวจสอบว่ารูปภาพเป็นไฟล์ PNG/JPG/WEBP ที่ถูกต้อง แล้วกดสร้างใหม่อีกครั้ง',
    }
  }

  if (/Seedance create error\s*400|Kie createTask error/i.test(text)) {
    const idx = extractContentIndex(text)
    const named = extractNamedSlot(text)
    const where =
      named ||
      (idx != null ? ` (รายการที่ส่งลำดับที่ ${idx + 1} / content[${idx}])` : '')
    return {
      title: 'บริการวิดีโอปฏิเสธคำขอ',
      message: `เซิร์ฟเวอร์ปลายทางแจ้งข้อผิดพลาดของพารามิเตอร์หรือเนื้อหา ไม่สามารถสร้างงานได้${where}`,
      suggestion: 'กรุณาตรวจสอบภาพอ้างอิงและไฟล์เสียงว่าถูกต้องและเข้าถึงได้หรือไม่ หากยังไม่สำเร็จกรุณาติดต่อผู้ดูแลระบบ',
    }
  }

  if (/Seedance|上游生成失败/i.test(text)) {
    return {
      title: 'สร้างวิดีโอล้มเหลว',
      message: text.length > 160 ? `${text.slice(0, 160)}…` : text,
      suggestion: 'กรุณาลองใหม่อีกครั้ง หากล้มเหลวซ้ำให้ลองเปลี่ยนภาพอ้างอิงหรือปรับบทให้เรียบง่ายขึ้น',
    }
  }

  if (/跳过重复任务|分镜已生成完成/.test(text)) {
    return {
      title: 'ข้ามงานเดิมที่ซ้ำซ้อนแล้ว',
      message: 'ระบบตรวจพบว่าช็อตนี้มีวิดีโอที่สร้างเสร็จแล้ว จึงยกเลิกงานที่ส่งซ้ำในคิว',
      suggestion: 'หากคุณต้องการสร้างใหม่ สามารถกดปุ่ม «สร้างใหม่» เพื่อเริ่มงานใหม่ได้ทันที',
    }
  }

  if (/已取消|任务已中断/.test(text)) {
    return {
      title: text.includes('取消') ? 'ยกเลิกแล้ว' : 'งานถูกขัดจังหวะ',
      message: text,
      suggestion: 'เมื่อต้องการวิดีโอ สามารถกดส่งเข้าคิวสร้างใหม่อีกครั้ง',
    }
  }

  // 成片下载被对端掐断（TokenFree content / CDN），不是参考图或脚本问题
  if (/RemoteProtocolError|peer closed|complete message body|incomplete download/i.test(text)) {
    return {
      title: 'การดาวน์โหลดวิดีโอถูกขัดจังหวะ',
      message: 'สร้างวิดีโอที่เซิร์ฟเวอร์ปลายทางเสร็จแล้ว แต่การดาวน์โหลดกลับมายังเซิร์ฟเวอร์ถูกขัดจังหวะ',
      suggestion: 'ระบบจะพยายามดาวน์โหลดใหม่อัตโนมัติ กรุณาอย่าเพิ่งกดสร้างใหม่',
    }
  }

  // 浏览器层断连：不是脚本/参考图问题，常因后端热重载或瞬时网络
  if (/failed to fetch|networkerror|load failed|connection reset|连接被重置/i.test(text)) {
    return {
      title: 'การเชื่อมต่อเครือข่ายขัดข้อง',
      message: 'ไม่สามารถติดต่อเซิร์ฟเวอร์แบ็กเอนด์ได้ (Failed to fetch) งานอาจยังอยู่ในคิวหรือเสร็จสิ้นแล้ว',
      suggestion: 'กรุณารีเฟรชหน้าจอเพื่อตรวจสอบสถานะล่าสุด',
    }
  }

  // 已是较短中文：原样展示，补通用建议
  if (!/[{\\[\]"]/.test(text) && text.length <= 120 && /[\u4e00-\u9fff]/.test(text)) {
    return {
      title: 'การสร้างล้มเหลว',
      message: text,
      suggestion: 'กรุณาแก้ไขตามคำแนะนำแล้วกดสร้างช็อตนี้ใหม่อีกครั้ง',
    }
  }

  return {
    title: 'การสร้างล้มเหลว',
    message: text.length > 200 ? `${text.slice(0, 200)}…` : text,
    suggestion: 'กรุณาตรวจสอบภาพอ้างอิงและบทของช็อตนี้ แล้วลองใหม่อีกครั้ง',
  }
}

/** 弹窗展示生成失败（含上游欠费 / 用户余额不足等） */
export async function alertDramaGenError(raw: unknown): Promise<void> {
  const text = raw instanceof Error ? raw.message : String(raw || '')
  const view = formatDramaGenError(text)
  const body = [view.message, view.suggestion].filter(Boolean).join('\n\n')
  await dialog.alert({
    title: view.title,
    message: body || view.title,
    tone: 'danger',
  })
}
