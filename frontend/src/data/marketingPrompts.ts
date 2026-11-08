export interface MarketingPromptItem {
  id: string;
  category: string;
  categoryName: string;
  title: string;
  titleEn?: string;
  mode: string;
  suggested: string;
  aspectRatio: string;
  duration: string;
  badge?: string;
  prompt: string;
}

export const MARKETING_PROMPTS: MarketingPromptItem[] = [
  {
    "id": "featured_model_holding_product",
    "category": "featured",
    "categoryName": "⭐ พรอมต์แนะนำ (Featured)",
    "title": "นางแบบถือสินค้าโชว์รีวิว (Model Holding Product)",
    "titleEn": "Model Holding Product Commercial Review",
    "mode": "R2V / Multi-Ref",
    "suggested": "10 วินาที, 9:16 (แนวตั้ง TikTok/Reels)",
    "aspectRatio": "9:16",
    "duration": "10s",
    "badge": "ยอดนิยมสำหรับ UGC",
    "prompt": "10 วินาที, 9:16, วิดีโอรีวิวสินค้าสไตล์ UGC คมชัดระดับ 4K แสงธรรมชาติในห้องสตูดิโอสว่างสบายตา\n[ตัวแบบ]: ใช้รูปอ้างอิงอวตาร Reference 1 คงรูปหน้า รอยยิ้ม และสีผมไว้อย่างแม่นยำ\n[สินค้า]: ใช้รูปอ้างอิงสินค้า Reference 2 โดยนางแบบใช้มือขวาถือขวดเซรั่มบำรุงผิวขึ้นมาในระดับอก หันฉลากสินค้าเข้าหากล้องอย่างชัดเจน\n[การกระทำ]: 0-3 วิ นางแบบยิ้มมองกล้องและยกสินค้าขึ้นมาโชว์ 3-7 วิ เปิดฝาขวดแตะเนื้อเซรั่มลงบนหลังมือเบาๆ แสดงความชุ่มชื้น 7-10 วิ พยักหน้าด้วยความประทับใจและหันสินค้าให้กล้องโฟกัส\n[กล้อง]: เริ่มจาก Medium shot แล้ว Zoom In แบบนุ่มนวลเข้าหาตัวสินค้าและมือ\n[เสียง/บทพูด]: พูดภาษาไทยอย่างเป็นธรรมชาติ \"ทุกคนคะ เซรั่มตัวนี้เนื้อบางเบามาก ซึมไว ผิวฉ่ำสุดๆ แนะนำเลยค่ะ!\" เสียงใส ไม่มีเพลงทับคำพูด ห้ามสินค้าเปลี่ยนรูป ห้ามมือบิดเบี้ยว"
  },
  {
    "id": "featured_model_eating_restaurant",
    "category": "featured",
    "categoryName": "⭐ พรอมต์แนะนำ (Featured)",
    "title": "นางแบบนั่งกินอาหารในร้าน/คาเฟ่ (Model Eating & Cafe Review)",
    "titleEn": "Model Dining & Food Tasting Review",
    "mode": "R2V / Multi-Ref",
    "suggested": "12 วินาที, 9:16 (แนวตั้ง TikTok/Reels)",
    "aspectRatio": "9:16",
    "duration": "12s",
    "badge": "อาหาร & ท่องเที่ยว",
    "prompt": "12 วินาที, 9:16, วิดีโอรีวิวอาหารแนวตั้ง Mood & Tone อบอุ่น แสงแดดยามบ่ายส่องเข้ามาในคาเฟ่\n[ตัวแบบ]: ใช้รูปอ้างอิงอวตาร Reference 1 ล็อกอัตลักษณ์ใบหน้า เสื้อผ้า และทรงผมให้คงที่\n[สถานที่]: ใช้รูปอ้างอิงสถานที่ Reference 3 นั่งอยู่ริมหน้าต่างไม้ของร้าน บรรยากาศมีต้นไม้และโต๊ะอาหาร\n[การกระทำ]: 0-4 วิ นางแบบนั่งอยู่หน้าจานอาหาร ใช้ช้อนตักขนมเค้กขึ้นมาหนึ่งคำ 4-8 วิ เอาเข้าปากเคี้ยวช้าๆ แล้วยิ้มตาหยีด้วยความอร่อย 8-12 วิ ชูนิ้วโป้งให้กล้อง พร้อมยกแก้วกาแฟขึ้นมาจิบปิดท้าย\n[กล้อง]: กล้องแบบ Handheld เล็กน้อยให้ดูเรียลและเป็นธรรมชาติ มุม Medium Close-Up โฟกัสสีหน้าและจานอาหาร\n[เสียง/บทพูด]: เสียงเคี้ยวเบาๆ เสียงบรรยากาศร้านกาแฟ บทพูดภาษาไทย: \"อร่อยแสงออกปากมาก คาเฟ่นี้ต้องมาซ้ำแน่นอนค่ะ!\" ห้ามอาหารเปลี่ยนรูป ห้ามส้อมลอย"
  },
  {
    "id": "featured_model_travel_vlog",
    "category": "featured",
    "categoryName": "⭐ พรอมต์แนะนำ (Featured)",
    "title": "รีวิวเดินทางไปเที่ยว เช็คอินสถานที่ (Travel Vlog Check-in)",
    "titleEn": "Travel Destination Vlog & Check-in",
    "mode": "R2V / Multi-Ref",
    "suggested": "15 วินาที, 9:16 (แนวตั้ง TikTok/Reels)",
    "aspectRatio": "9:16",
    "duration": "15s",
    "badge": "ท่องเที่ยว Vlog",
    "prompt": "15 วินาที, 9:16, วิดีโอท่องเที่ยวสไตล์ Travel Vlog สมจริง ภาพคมชัดระดับ Cinematic\n[ตัวแบบ]: ล็อกหน้านางแบบตาม Reference 1 สวมชุดลำลองสำหรับเดินทาง สะพายกระเป๋าผ้า\n[สถานที่]: บรรยากาศสถานที่ท่องเที่ยวตาม Reference 3 ท้องฟ้าแจ่มใส มีวิวทิวทัศน์สวยงามด้านหลัง\n[การกระทำ]: 0-5 วิ นางแบบเดินหันหลังแล้วหมุนตัวกลับมาโบกมือทักทายกล้องอย่างสดใส 5-10 วิ เดินนำกล้องเข้าไปชมจุดไฮไลท์ของสถานที่ ชี้มือชมวิว 10-15 วิ หันหน้ากลับมาพูดยิ้มแย้มกับกล้อง\n[กล้อง]: กล้องกิมบอลตามติดแบบ Smooth Tracking Follow Shot แสงแดดธรรมชาตินุ่มนวล\n[เสียง/บทพูด]: เสียงลมธรรมชาติ เสียงใบไม้ไหว บทพูดภาษาไทย: \"วันนี้พามาเช็คอินที่นี่ สวยตรงปก อากาศดีมากๆ ใครชอบเที่ยวต้องปักหมุดเลยนะคะ!\""
  },
  {
    "id": "featured_model_unboxing",
    "category": "featured",
    "categoryName": "⭐ พรอมต์แนะนำ (Featured)",
    "title": "แกะกล่องสินค้าและรีวิวความประทับใจ (Unboxing & Review)",
    "titleEn": "Unboxing & First Impression Showcase",
    "mode": "R2V",
    "suggested": "15 วินาที, 9:16 (แนวตั้ง)",
    "aspectRatio": "9:16",
    "duration": "15s",
    "badge": "แกะกล่องสินค้า",
    "prompt": "15 วินาที, 9:16, วิดีโอแกะกล่องสินค้า UGC Unboxing ถ่ายบนโต๊ะสตูดิโอสีขาวมินิมอล\n[ตัวแบบ]: นางแบบตาม Reference 1 สวมเสื้อยืดมินิมอล นั่งอยู่หน้าโต๊ะ\n[สินค้า]: กล่องพัสดุและตัวสินค้าตาม Reference 2 รูปทรงและสีสันถูกต้อง 100%\n[การกระทำ]: 0-5 วิ กรีดเทปกล่องพัสดุออกอย่างระมัดระวัง หยิบกล่องสินค้าด้านในออกมา 5-10 วิ เปิดกล่องโชว์ตัวสินค้าขึ้นมาใกล้กล้อง พร้อมแกะพลาสติกกันรอยออก 10-15 วิ ถือสินค้าคู่กับใบหน้า ยิ้มกว้างอย่างตื่นเต้น\n[กล้อง]: Top-down สลับกับ Eye-level 45 องศา โฟกัสรายละเอียดของสินค้าคมชัด\n[เสียง/บทพูด]: เสียง ASMR แกะเทป แกะพลาสติก บทพูดภาษาไทย: \"ของมาส่งแล้วทุกคน! แพ็กเกจจิ้งหรูมาก เดี๋ยวลองใช้จริงให้ดูคลิปหน้านะคะ\""
  },
  {
    "id": "ugc_food_travel_1",
    "category": "ugc_food_travel",
    "categoryName": "UGC อาหาร & ท่องเที่ยว",
    "title": "清晨豆浆摊第一视角",
    "mode": "T2V",
    "suggested": "10 秒，9:16",
    "aspectRatio": "9:16",
    "duration": "10s",
    "prompt": "10 秒，9:16，第一视角手机探店，冬日清晨的街边豆浆摊。摄影者的双手偶尔进入画面，穿深棕针织袖口；摊主是戴白色棉帽、穿藏蓝围裙的中年女性，身份与服装保持一致。\r\n\r\n0–3 秒：手机从蒸汽后方靠近摊位，自动曝光因白色蒸汽短暂变暗后恢复；摊主掀开锅盖，蒸汽向上散开，镜头轻微后退躲避。\r\n3–7 秒：她用长柄勺将热豆浆倒进素白陶碗，液面上升真实，摄影者把一小碟酥脆油条推到旁边。手持微动自然，不进行电影式环绕。\r\n7–10 秒：摄影者双手捧起陶碗，镜头随之略微上升；背景自行车从左向右经过，摊主笑着说“慢点，烫。”\r\n\r\n对白普通话、亲切自然，无字幕。声音：锅盖、液体、街道自行车铃、远处早市交谈。冷晨光与摊位暖灯混合；不要品牌招牌、不要额外手指、不要夸张蒸汽遮满全程、不要让陶碗变成纸杯。"
  },
  {
    "id": "ugc_food_travel_2",
    "category": "ugc_food_travel",
    "categoryName": "UGC อาหาร & ท่องเที่ยว",
    "title": "海边民宿的 15 秒入住日记",
    "mode": "T2V",
    "suggested": "15 秒，9:16",
    "aspectRatio": "9:16",
    "duration": "15s",
    "prompt": "15 秒，9:16，自然手机旅行 Vlog，剪辑轻快但不炫技。主角锁定：短发女性旅行者，白色亚麻衬衫、卡其短裤、帆布托特包；只在镜面中短暂出现脸部。\r\n\r\n0–4 秒：第一视角推开浅蓝木门进入海边民宿，门轴轻响，室内从背光逐渐自动曝光；一只橘猫从右侧慢慢经过，不看镜头。\r\n4–8 秒：动作匹配切到托特包放在藤椅上，摄影者拉开白色窗帘，海面和小渔船出现；窗帘被海风吹向镜头形成遮挡。\r\n8–12 秒：遮挡后切到阳台桌面，手放下一杯冰柠檬水，杯壁凝露明显；镜头轻微俯拍记录明信片、钥匙和贝壳。\r\n12–15 秒：镜头转向栏杆外落日，橘猫跳上空椅但不打翻物品，尾巴掠过镜头结束。\r\n\r\n自然海风、木门、冰块和海鸟声，只有很轻的原声吉他。无对白、无字幕、无酒店品牌。保持房间方位、托特包和猫的花色一致；不要无人机镜头、不要过度稳定、不要快速 360 度旋转。"
  },
  {
    "id": "ugc_food_travel_3",
    "category": "ugc_food_travel",
    "categoryName": "UGC อาหาร & ท่องเที่ยว",
    "title": "夜市炭火烤玉米记录",
    "mode": "T2V",
    "suggested": "12 秒，16:9",
    "aspectRatio": "16:9",
    "duration": "12s",
    "prompt": "12 秒，16:9，近距离美食纪录片，热闹夜市但主体清晰。一位戴黑色头巾、灰色围裙的摊主在圆形炭炉上烤三根玉米，工具和玉米数量保持一致。\r\n\r\n0–4 秒：50mm 中近景，摊主用金属夹逐根翻面，炭火因油滴短暂冒出小火苗，火焰不超过玉米高度；摄影机轻微手持前移。\r\n4–8 秒：超近景刷上红褐色酱汁，刷毛弯曲、酱汁沿玉米纹理流动，炭灰与热浪造成真实空气扰动。背景灯笼只形成柔和散景，不出现可读文字。\r\n8–12 秒：摊主撒上芝麻和香草，把其中一根放入牛皮纸托递向镜头；焦点从玉米转到他满足的眼神，顾客的手从下方接住。\r\n\r\n声音：炭火噼啪、刷酱、金属夹、模糊人群，摊主只说“这一根刚好。”自然普通话，无字幕。不要火灾、不要食物无限增殖、不要手穿过玉米、不要品牌标识。"
  },
  {
    "id": "ugc_food_travel_4",
    "category": "ugc_food_travel",
    "categoryName": "UGC อาหาร & ท่องเที่ยว",
    "title": "旧城电车窗边的雨天旅行",
    "mode": "I2V",
    "suggested": "10 秒，4:3",
    "aspectRatio": "4:3",
    "duration": "4s",
    "prompt": "10 秒，4:3，怀旧旅行日记，坐在旧城有轨电车窗边。前景固定一只手握着浅绿色纸质车票，手腕戴棕色皮表；窗框、木椅和车票全程不变。\r\n\r\n摄影机始终坐姿高度朝窗外，轻微随车体摇晃。雨滴在玻璃上向后斜流，街景以合理视差经过：近处骑楼柱快速移动，中景行人撑伞缓慢移动，远处钟楼几乎不动。第 4 秒电车转弯，暖黄色车内倒影短暂覆盖窗外；第 7 秒对向电车经过形成自然遮挡，遮挡后手把车票轻轻翻到背面但不需要可读文字。最后停站，雨滴运动减缓。\r\n\r\n声音：轨道摩擦、雨、车厢木结构轻响、一次到站铃。无配乐、无对白。不要现代 LED 屏、不要乱码标牌、不要让手和车票漂移、不要把窗外变成高速公路。"
  },
  {
    "id": "ugc_food_travel_5",
    "category": "ugc_food_travel",
    "categoryName": "UGC อาหาร & ท่องเที่ยว",
    "title": "周末陶艺课的失败与修复",
    "mode": "T2V",
    "suggested": "12 秒，9:16",
    "aspectRatio": "9:16",
    "duration": "12s",
    "prompt": "12 秒，9:16，真实社交短视频，明亮陶艺工作室。主角是一名穿米色围裙的初学者，双手沾灰白陶泥；老师只出现穿深绿袖口的双手。陶轮、泥团与围裙全程一致。\r\n\r\n0–4 秒：手机固定在桌边略微俯拍。陶轮转动，主角试图拉高杯壁，杯口因压力不均向右塌下；她停顿一秒，发出无奈的轻笑，而不是夸张表情。\r\n4–8 秒：老师的双手从左侧进入，示范降低手掌、用拇指稳定中心；主角跟随动作，塌下部分被缓慢压回矮碗形，陶泥守恒、不凭空增加。\r\n8–12 秒：主角松开手，歪但完整的小碗继续旋转，她用沾泥的手背擦额头，留下一小道泥痕；镜头自动对焦短暂落在泥痕后回到作品。\r\n\r\n声音：陶轮电机、湿泥摩擦、两人轻笑，老师说“慢一点，先找中心。”无字幕、无音乐。不要额外手指、不要陶器突然完美、不要快速时间流逝、不要品牌。"
  },
  {
    "id": "ugc_food_travel_6",
    "category": "ugc_food_travel",
    "categoryName": "UGC อาหาร & ท่องเที่ยว",
    "title": "山村早餐的无旁白 ASMR",
    "mode": "T2V",
    "suggested": "15 秒，16:9",
    "aspectRatio": "16:9",
    "duration": "15s",
    "prompt": "15 秒，16:9，安静自然的山村早餐纪录片，无旁白。一名穿深蓝棉麻上衣、头发低低束起的女性在木窗旁准备一碗菌菇面；人物脸、服装与厨房陈设保持一致。\r\n\r\n0–5 秒：晨光穿过木窗，微距拍摄菜刀把两朵香菇切成薄片，刀每次完整接触木板，动作熟练但不加速；背景水壶开始冒出细蒸汽。\r\n5–10 秒：中近景，她把面条放入陶锅，用竹筷轻轻分开，汤面产生真实旋涡；摄影机沿灶台缓慢横移，焦点依次经过火苗、锅沿和她专注的侧脸。\r\n10–15 秒：碗放到窗边木桌，加入香菇和一小把葱。她坐下，先吹散蒸汽再尝一口，窗外远山被薄雾覆盖。镜头停住两秒让蒸汽自然上升。\r\n\r\n声音前景为刀与木板、汤水、筷子和轻呼吸；远景为鸡鸣和山风；无音乐、无对白。食材数量连续，蒸汽不遮脸，火焰受控；无古装表演感、无字幕、无商标。"
  },
  {
    "id": "ads_products_1",
    "category": "ads_products",
    "categoryName": "โฆษณาสินค้า & ดีไซน์",
    "title": "翡翠香氛液体雕塑",
    "mode": "I2V",
    "suggested": "8 秒，16:9",
    "aspectRatio": "16:9",
    "duration": "8s",
    "prompt": "8 秒，16:9，高端虚构香氛广告。产品锁定：深翡翠色矮方形切面玻璃瓶、圆角肩部、金色短圆瓶盖、正面空白标签区、液面位于瓶身 80%；所有镜头保持比例、颜色、瓶盖与标签位置不变。\r\n\r\n0–2 秒：黑色镜面水面上方，摄影机微距贴近玻璃棱线，一滴透明水珠向下滑动，折射出一条金色轮廓光。\r\n2–5 秒：摄影机顺时针环绕 60 度，产品本身不旋转。半透明叶片和细液体丝带被同一股气流从右后方卷起，沿瓶身后侧通过，不遮挡正面空白区。\r\n5–8 秒：瓶子缓慢下降但不接触水面，空气压力形成同心波纹；最后所有液体丝带在后方组成简洁拱形并停住。\r\n\r\n黑、翡翠绿、暖金，真实玻璃折射、焦散与微小划痕。声音：水滴、低沉气流、结尾一声细金属音。无文字、无手、无商标、无瓶体软化、无液体穿透玻璃、无突然爆炸。"
  },
  {
    "id": "ads_products_2",
    "category": "ads_products",
    "categoryName": "โฆษณาสินค้า & ดีไซน์",
    "title": "折叠耳机机械展开",
    "mode": "T2V",
    "suggested": "10 秒，16:9",
    "aspectRatio": "16:9",
    "duration": "10s",
    "prompt": "10 秒，16:9，精密工业设计广告。虚构头戴式耳机：哑光石墨灰椭圆耳罩、薄香槟金铰链、深灰织物头梁、无标志。产品几何、左右结构和材质全程固定。\r\n\r\n0–3 秒：耳机以折叠状态放在浅灰无缝台面，顶光在金属边缘形成细线。摄影机以 85mm 产品镜头缓慢推近，背景静止。\r\n3–7 秒：左右耳罩按真实铰链顺序展开：左侧先旋转 90 度并锁定，右侧随后镜像展开，头梁只上升少量。每次锁定都有可见的机械停顿，零件不分裂、不悬浮。\r\n7–10 秒：摄影机降低到与耳罩齐平，柔和声波可视化仅以背景空气中的细微同心折射出现；耳机保持静止，最终构图留出右侧文案空间但不生成文字。\r\n\r\n极简银灰与暖金，柔和高键灯光，金属拉丝和织物纹理清晰。声音：两次清脆机械卡扣、低频脉冲一次。不要额外按钮、不要电线、不要磁悬浮爆炸、不要品牌或乱码。"
  },
  {
    "id": "ads_products_3",
    "category": "ads_products",
    "categoryName": "โฆษณาสินค้า & ดีไซน์",
    "title": "冰茶从茶园到餐桌的匹配剪辑",
    "mode": "T2V",
    "suggested": "12 秒，9:16",
    "aspectRatio": "9:16",
    "duration": "12s",
    "prompt": "12 秒，9:16，清爽饮料社交广告，虚构无标签玻璃瓶。产品锁定：细长透明瓶、琥珀色茶液、银白瓶盖、瓶身无字。\r\n\r\n0–4 秒：清晨茶园微距，一片带露水的茶叶被手指轻摘；叶片向下移动经过镜头形成遮挡。\r\n4–8 秒：动作匹配切到透明冰块从上方落入高杯，茶液随后沿杯壁注入，冰块只碰撞两次，水汽在杯外凝结。摄影机保持竖屏中心构图，阳光从左后方穿过琥珀色液体。\r\n8–12 秒：同一片茶叶落在木桌边，焦点从叶片移到后方无标签茶瓶和杯子；一阵微风推动白色桌布但产品不移动。最后一个气泡沿冰块边缘上升并破裂。\r\n\r\n声音以采茶轻响连接冰块碰撞，再进入倒茶声与夏日远蝉。自然绿色、琥珀金、洁净白。无商标、无可读文字、无夸张液体飞溅、瓶盖不消失、杯中冰块不融化变形。"
  },
  {
    "id": "ads_products_4",
    "category": "ads_products",
    "categoryName": "โฆษณาสินค้า & ดีไซน์",
    "title": "模块化台灯的日夜变换",
    "mode": "首尾帧",
    "suggested": "10 秒，16:9",
    "aspectRatio": "16:9",
    "duration": "10s",
    "prompt": "10 秒，16:9，北欧感家居科技广告。产品锁定：奶白色圆盘底座、细黑立杆、可旋转半月形灯头、单个黄铜触控点；桌面位置和比例固定。\r\n\r\n0–3 秒：白天书桌，灯关闭。摄影机从书架空隙缓慢横移，显示纸张、陶杯与一株小蕨；所有物体真实投影。\r\n3–7 秒：一只手触碰黄铜点一次，灯头沿真实转轴向下旋转 35 度，暖光逐渐亮起。同时窗外天色以平滑时间流逝从下午过渡到蓝调夜晚，但桌上物体不跳位。\r\n7–10 秒：手离开，摄影机轻轻推近灯下书页和陶杯蒸汽；暖光只照亮工作区，背景保持冷蓝。右上角留空但不生成文字。\r\n\r\n声音：触控轻音、转轴微响、日间鸟鸣过渡到夜晚远车声。不要让灯自行拆分，不要多出按钮，不要改变书桌布局，不要品牌或字幕。"
  },
  {
    "id": "ads_products_5",
    "category": "ads_products",
    "categoryName": "โฆษณาสินค้า & ดีไซน์",
    "title": "巧克力薄片的声画节拍",
    "mode": "T2V",
    "suggested": "6 秒，1:1",
    "aspectRatio": "1:1",
    "duration": "10s",
    "prompt": "6 秒，1:1，精品黑巧克力微距广告，强调 ASMR。虚构产品：四乘四格深色巧克力薄片，每格只有抽象放射纹，无文字无标志。\r\n\r\n0–2 秒：超微距侧逆光，一把细刀沿格线缓慢施压，巧克力表面出现真实细裂纹，摄影机完全静止。\r\n2–4 秒：薄片在格线处干净断开，碎屑只向前落下少量；断裂声与画面精准同步，焦点从刀锋转到粗糙断面。\r\n4–6 秒：断开的方块落入一杯热可可，液面下沉后形成一次圆形回弹，一缕蒸汽遮住镜头作为结束。\r\n\r\n深棕、铜金、奶油色，高对比但不过曝，真实可食用质感。只出现一把刀和一只杯子；不要融化成塑料、不要无限碎裂、不要手指进入刀锋区域、不要包装或文字。"
  },
  {
    "id": "ads_products_6",
    "category": "ads_products",
    "categoryName": "โฆษณาสินค้า & ดีไซน์",
    "title": "概念电动车的风洞光绘",
    "mode": "T2V",
    "suggested": "10 秒，2.39:1",
    "aspectRatio": "9:16",
    "duration": "10s",
    "prompt": "10 秒，2.39:1，原创概念电动车发布片。车辆锁定：低矮四门快背轮廓、珍珠灰车漆、连续但无标志的前灯带、五辐封闭轮毂、无车牌文字；车身比例与轮毂始终一致。\r\n\r\n0–3 秒：黑色风洞内，车辆静止，只有一条白色扫描光从车头移动到车尾，揭示曲面与漆面微粒。摄影机在前左 3/4 角低位静止。\r\n3–7 秒：蓝白色空气流线从前方掠过，沿车顶和侧面弯曲，流线只表现气流不穿透车身；摄影机沿车辆侧面平稳滑轨移动，车轮不转。\r\n7–10 秒：气流熄灭，前灯从中心向两侧渐亮，摄影机停在后左 3/4 角；地面反射与车辆位置匹配，背景留出上方空间。\r\n\r\n声音：风洞低频、扫描电子音、灯光启动轻音；无引擎轰鸣。不要打开车门、不要车辆变形、不要驾驶员、不要品牌、不要文字、不要让摄影机穿过车体。"
  },
  {
    "id": "beauty_retail_1",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Linen overshirt fit-and-motion demonstration",
    "mode": "I2V",
    "suggested": "12 seconds, 9:16, optional sound",
    "aspectRatio": "9:16",
    "duration": "12s",
    "prompt": "Use the supplied full-body product image as the identity and garment reference. Create a natural vertical fitting-room demonstration of an unbranded sand-colored linen overshirt. 0–3s: the model faces camera, pinches the cuff once, and releases it so the fabric settles. 3–7s: they turn exactly 90 degrees to show the side seam and relaxed shoulder; the camera makes one slow waist-height arc in the opposite direction. 7–12s: they take two steps toward a window, roll one sleeve once, and stop in a clean three-quarter pose. Soft daylight reveals weave and wrinkles without artificial gloss. Sound: quiet room tone, cloth movement, two footsteps. Preserve face, body proportions, button count, pocket placement, hem length, and color. No body reshaping, morphing seams, added jewelry, logos, captions, jump cuts, or runway-speed movement."
  },
  {
    "id": "beauty_retail_2",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Modular lunchbox latch and capacity demo",
    "mode": "R2V",
    "suggested": "15 seconds, 16:9",
    "aspectRatio": "16:9",
    "duration": "15s",
    "prompt": "Reference Image 1 defines the lunchbox geometry and sage-green color; Image 2 defines the removable divider layout; Video 1 supplies hand-motion rhythm only. On a bright kitchen counter, demonstrate the fictional modular lunchbox in four connected actions. First, two hands release both side latches simultaneously and lift the lid straight up. Next, one hand moves a divider from the center slot to the right slot while the other stabilizes the base. Then three prepared foods are placed into separate compartments without spilling. Finally, close the lid and press each latch until one audible click. Camera: locked 45-degree tabletop view with a short macro push-in for the latch, then return to the original framing. Preserve dimensions, hinge side, latch count, divider slots, surface finish, and food placement between cuts. No floating parts, duplicated fingers, transparent plastic, brand marks, steam covering the product, or impossible capacity."
  },
  {
    "id": "beauty_retail_3",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Mineral sunscreen texture comparison",
    "mode": "T2V",
    "suggested": "10 seconds, 1:1",
    "aspectRatio": "1:1",
    "duration": "10s",
    "prompt": "Create an educational split-screen skincare texture demonstration using a fictional, unbranded mineral sunscreen. The same adult forearm appears on both sides under neutral studio daylight. At 0s, place one equal pea-sized amount on each side. Left: a thick application is rubbed in too quickly and leaves a visible uneven white cast. Right: the same amount is warmed between two fingertips, dotted across the skin, then blended in three slow passes to an even satin finish. Keep exposure, skin tone, amount, crop, and elapsed time identical so the technique is the only variable. Camera remains locked in macro top-down view; end on a two-second comparison hold. Sound: soft fingertip movement and one neutral chime at the final hold. No medical claims, before-and-after skin alteration, labels, text overlays, irritation, exaggerated whitening, extra hands, or beauty-filter smoothing."
  },
  {
    "id": "beauty_retail_4",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Ceramic pan heat-response demonstration",
    "mode": "I2V",
    "suggested": "14 seconds, 16:9",
    "aspectRatio": "16:9",
    "duration": "4s",
    "prompt": "Animate the supplied first frame of an unbranded cream ceramic pan on an induction hob. Preserve the exact pan, handle, hob, backsplash, and camera position. 0–4s: three droplets of water land near the center, gather into beads, and travel outward as the pan warms. 4–9s: a cook pours a thin ribbon of beaten egg from the right; it spreads from the center with physically accurate viscosity and begins setting at the edges. 9–14s: a silicone spatula makes one clean fold, revealing an intact matte cooking surface, and rests beside the fold. Camera: fixed close three-quarter angle with a very subtle push-in only. Sound: droplets, low induction hum, gentle sizzle, one spatula scrape. Keep handle orientation, pan color, liquid volume, hand identity, and action direction stable. No flames, oil flare, smoke, food teleportation, warped utensil, logo, caption, or unsupported durability claim."
  },
  {
    "id": "beauty_retail_5",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Handmade tea gift order from selection to parcel",
    "mode": "T2V",
    "suggested": "18 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "15s",
    "prompt": "Create a warm vertical micro-story for a fictional neighborhood tea studio, following one gift order without continuity breaks. Shot 1, 0–4s: a customer points to a small amber tea tin on a wooden shelf; the shopkeeper lifts that exact tin. Shot 2, 4–8s: macro view as the lid opens and dry curled leaves are measured into a paper sachet. Shot 3, 8–13s: the same tin and sachet are placed into a natural-cardboard box with a blank cream card and tied once with indigo cotton ribbon. Shot 4, 13–18s: the sealed parcel is handed across the counter; the customer receives it with both hands and smiles. Use match-on-action cuts and preserve tin dents, ribbon color, box size, clothing, hand positions, and left-to-right ownership transfer. Sound: wooden lid, leaves, paper, ribbon, quiet shop ambience. No readable branding, duplicated parcel, changing packaging, floating leaves, excessive steam, subtitles, or price claims."
  },
  {
    "id": "beauty_retail_6",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Compact projector setup in a small apartment",
    "mode": "R2V",
    "suggested": "12 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "12s",
    "prompt": "Image 1 defines the exact fictional compact projector; Image 2 defines the apartment layout; use no visual identity from other references. Make a fast but physically clear vertical setup demonstration. 0–3s: the device is placed on the marked shelf facing a blank wall. 3–6s: one cable is connected to the rear-left port, then a single button is pressed. 6–9s: the lens lights and a soft rectangular test image appears, initially skewed, then corrects once into a level 16:9 frame. 9–12s: curtains close halfway and the room becomes comfortable for viewing while the projector remains visible in the foreground. Camera makes one continuous side-to-front slide; do not cut during cable insertion. Sound: plug click, button click, quiet fan, short startup tone. Preserve device dimensions, port position, lens location, shelf, cable path, and room geometry. No brand UI, impossible wireless cable disappearance, light before power, blown-out projection, text, logo, or extra hands."
  },
  {
    "id": "beauty_retail_7",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Accessible shoe fastening demonstration",
    "mode": "I2V",
    "suggested": "12 seconds, 1:1",
    "aspectRatio": "1:1",
    "duration": "12s",
    "prompt": "Use the input image as the exact shoe, hand, and seated-body reference. Demonstrate a fictional adaptive sneaker with a wide pull tab and magnetic side closure, without making medical claims. 0–4s: the wearer holds the large heel loop, guides the foot into the shoe, and plants the sole on the floor. 4–8s: one hand brings the side flap toward the closure; the magnets align only when close and connect with a soft click. 8–12s: the wearer presses the flap once, rocks heel-to-toe to check the fit, and rests both feet parallel. Camera: stable low side close-up, then a small tilt down to the closure; no orbit. Preserve shoe silhouette, closure location, sole thickness, sock color, hand anatomy, and seated posture. Sound: fabric, closure click, sole on wood. No self-moving shoe, exaggerated magnetic force, body transformation, laces appearing, claims of treatment or universal suitability, logos, text, or inaccessible tiny controls."
  },
  {
    "id": "beauty_retail_8",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Fragrance layering consultation at a retail counter",
    "mode": "T2V",
    "suggested": "16 seconds, 16:9, dialogue",
    "aspectRatio": "16:9",
    "duration": "10s",
    "prompt": "At a refined but unbranded fragrance counter, stage a calm consultation between one advisor and one customer. Two fictional bottles remain fixed: tall clear bottle on the left, short amber bottle on the right. 0–5s: the advisor sprays the clear bottle once onto a paper strip, fans it twice, and places it horizontally. 5–10s: they spray the amber bottle onto a second strip, cross it beneath the first, and wait one beat. 10–16s: the customer smells both together and says in natural French, “Le bois adoucit vraiment les agrumes.” The advisor listens silently and gives one small nod. Camera: eye-level two-shot, macro insert on the crossed strips, return to two-shot. Warm side light with realistic glass reflections. Preserve bottle shapes, liquid levels, strip order, hand ownership, faces, wardrobe, and eyelines. No subtitles, lip movement from the silent advisor, extra sprays, floating mist, product labels, celebrity likeness, medical claims, or changing bottle positions."
  },
  {
    "id": "beauty_retail_9",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Humidity-resistant curl routine comparison",
    "mode": "Video",
    "suggested": "14 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "4s",
    "prompt": "Edit the supplied two-panel salon demonstration. Change only the right panel to show a clearly ordered humidity-care styling routine while preserving the original person, hair length, curl pattern, lighting, background, camera, and timing. On the right: apply one measured pump to wet palms, distribute from mid-length to ends, scrunch upward three times, diffuse at low speed from below, then hold the finished natural curls for two seconds. Keep the left panel unchanged as the untreated comparison. Add subtle bathroom humidity to both backgrounds equally; do not alter facial skin, body, hair density, or the left-panel motion. Sound: preserve room tone, add quiet product pump and low diffuser only on the right. No guaranteed performance claim, fake weather gauge, instant hair growth, strand teleportation, wet-to-dry jump without transition, label text, logo, subtitles, or beauty-filter changes."
  },
  {
    "id": "beauty_retail_10",
    "category": "beauty_retail",
    "categoryName": "คอมเมิร์ซ & บิวตี้",
    "title": "Interchangeable watch-strap batch campaign",
    "mode": "R2V",
    "suggested": "three 8-second clips, 1:1",
    "aspectRatio": "1:1",
    "duration": "8s",
    "prompt": "Create three matching catalog clips from one approved setup. Image 1 defines the fictional watch case and dial; Images 2–4 define cobalt textile, terracotta leather, and graphite silicone straps. The watch case, dial, crown, hands set to 10:08, tabletop, lighting, camera path, and timing must be identical in every clip. At 0–2s the watch lies centered without a strap. At 2–5s two strap halves slide in from top and bottom along the table, stop at the lugs, and attach with physically plausible spring bars; do not show parts passing through metal. At 5–8s the assembled watch rotates exactly 35 degrees while the camera pushes closer, then holds. Each render uses only its assigned strap material and color. Sound: two small mechanical clicks and a soft fabric/leather/silicone movement appropriate to the variant. No changing case geometry, dial text, extra straps, liquid morphing, inconsistent shadows, logos, captions, hands changing time, or mismatched camera speed."
  },
  {
    "id": "social_ugc_1",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "The self-checkout critiques indecision",
    "mode": "T2V",
    "suggested": "14 seconds, 9:16, phone-video look",
    "aspectRatio": "9:16",
    "duration": "4s",
    "prompt": "Create a fictional handheld grocery-store UGC clip from the shopper’s chest height. 0–4s: the shopper holds two visually distinct unbranded cereal boxes, one teal and one orange, moving each toward the self-checkout scanner but pulling back before contact. 4–8s: the machine says in a calm neutral voice, “You have compared these for four minutes.” The shopper freezes and looks toward the speaker; the screen stays abstract with no readable UI. 8–12s: they scan the teal box; the machine says, “Unexpected, but supported.” A nearby employee silently looks up, then returns to work. 12–14s: the shopper turns the camera toward themself and whispers, “It knows me.” End on one confirmation beep. Natural fluorescent light, mild phone autofocus breathing, no cinematic polish. Preserve boxes, hands, employee, scanner, cart, aisle, dialogue order, and camera ownership. No real retailer, subtitles, price text, sentient threat, employee lip movement, duplicated products, screen artifacts, extra fingers, brand logo, or public prank harassment."
  },
  {
    "id": "social_ugc_2",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "The elevator waits for the office plant",
    "mode": "I2V",
    "suggested": "15 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "15s",
    "prompt": "Animate the supplied office-elevator frame as a deadpan vertical comedy. Preserve the exact employee, wheeled desk plant, elevator, corridor, and phone-camera position. 0–5s: the employee steps into the empty elevator and presses the close button; the doors begin closing but stop with a polite chime when the plant remains in the corridor. 5–9s: the employee presses close again; the display stays blank, and the doors reopen wider as if waiting. 9–13s: after a suspicious glance, the employee rolls the plant inside beside them. Only then do the doors close normally. 13–15s: from behind the closing gap, one broad leaf gently taps the employee’s shoulder; they sigh at camera. Sound: wheels, two chimes, door motor, leaf rustle, no dialogue. Keep door physics, plant pot, leaf count, clothing, hand positions, and corridor consistent. No moving plant by itself, face in plant, readable floor number, trapped limbs, elevator malfunction danger, extra people, subtitles, logo, or jump cut."
  },
  {
    "id": "social_ugc_3",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "A personal rain cloud follows one commuter",
    "mode": "T2V",
    "suggested": "15 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "15s",
    "prompt": "Create a naturalistic phone vlog on a sunny pedestrian street with one impossible but consistent rule: a small gray rain cloud, two meters wide, stays exactly above one commuter in a yellow cardigan. 0–5s: front-facing selfie as the commuter walks; only they are wet while nearby pavement remains dry. They say, “It has followed me since breakfast.” 5–10s: camera flips outward; the commuter steps under a café awning, but the cloud stops at the edge and continues raining onto the now-empty spot. The commuter leans out carefully; the cloud slides above them and resumes. 10–15s: a stranger silently offers a tiny cocktail umbrella; the commuter accepts it, holds it over one shoulder, and says, “Perfect.” Keep the cloud’s scale, water direction, cardigan, wetness, street, sunlight, and camera ownership stable. Sound: localized rain, footsteps, two lines, light traffic. No lightning, storm damage, soaked bystanders, changing weather, floating umbrella, subtitles, logos, giant cloud face, or camera teleportation."
  },
  {
    "id": "social_ugc_4",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "The unboxing object refuses to leave",
    "mode": "R2V",
    "suggested": "12 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "12s",
    "prompt": "Image 1 defines a fictional unbranded desk lamp; Image 2 defines its kraft packaging; Video 1 defines the creator’s approved hand and camera rhythm only. Create a playful unboxing with believable object physics. 0–4s: top-down phone shot as the creator opens both box flaps and lifts the lamp by its protected stem. The lamp rises halfway, then its weighted base catches under one cardboard insert. 4–8s: the creator pauses, releases tension, removes the insert correctly with the free hand, and says, “Okay, you win.” 8–12s: the lamp lifts smoothly, unfolds one hinge, switches on only after its base touches the desk, and the empty box slowly tips backward. Preserve lamp geometry, hinge, cord, base weight, packaging inserts, hands, desk, and action order. Sound: cardboard, small thump, one line, switch click. No self-aware movement, object stretching, lamp on before contact, invisible cord, product logo, subtitles, extra hands, torn packaging, aggressive shaking, or fake review claim."
  },
  {
    "id": "social_ugc_5",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "Reverse recipe: the sandwich returns its ingredients",
    "mode": "Start/end",
    "suggested": "10 seconds, 1:1, seamless reverse loop",
    "aspectRatio": "1:1",
    "duration": "10s",
    "prompt": "Start frame: one neatly cut vegetable sandwich centered on a wooden board, with an empty plate behind it. End frame: two bread slices, three tomato slices, cucumber ribbons, lettuce, and one measured spoon of spread are separated in an orderly row on the same board. Create a physically legible reverse-preparation loop. The top bread rises and lands flat at the far right; lettuce unfolds rather than growing; cucumber ribbons slide out one at a time; tomato slices separate without duplicating; spread gathers from the bread into one spoon moving backward along its original path. A pair of hands performs every action in reverse with anatomically plausible joints. Camera locked top-down, even kitchen daylight, 50% slow motion. Sound design also reverses gently but ends with one normal plate tap to restart the loop. Preserve ingredient counts, moisture, crumbs, board, plate, hands, and first/last alignment. No food levitation without hand contact, regeneration, liquid teleportation, extra ingredients, knife, text, logo, jump cut, or messy spill."
  },
  {
    "id": "social_ugc_6",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "The park bench folds up after every excuse",
    "mode": "T2V",
    "suggested": "16 seconds, 16:9, mockumentary",
    "aspectRatio": "16:9",
    "duration": "10s",
    "prompt": "Film a dry mockumentary in a quiet city park. Two friends approach an ordinary slatted bench; Friend A carries a reusable water bottle and keeps making excuses about not exercising. 0–5s: A says, “I already walked from the bus,” and the right third of the bench folds vertically with one mechanical click. 5–10s: A adds, “Also, stretching is basically yoga,” and the left third folds, leaving only the middle seat. Friend B remains silent and points to the open walking path. 10–16s: A begins, “Tomorrow—” and the final seat folds before the word finishes. Both stare at the now-flat backrest; Friend B walks away, and A reluctantly follows. Camera: fixed medium-wide observational frame with one tiny corrective pan. Preserve friends, clothing, bottle, bench geometry, hinge sequence, park, and safe clearances. Sound: birds, three clicks, dialogue, footsteps. No bench trapping anyone, supernatural glow, brand logo, subtitles, audience laugh track, insulting body humor, extra pedestrians, shifting path, or moving bench without a completed line."
  },
  {
    "id": "social_ugc_7",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "Street interview with tomorrow’s answer",
    "mode": "Video",
    "suggested": "preserve 15-second source, 9:16",
    "aspectRatio": "9:16",
    "duration": "15s",
    "prompt": "Edit the supplied fictional street-interview clip by adding one surreal timing event while preserving the interviewer, participant, microphone, street, crowd, camera shake, lighting, and original ambience. 0–5s remains unchanged: interviewer asks, “What will you do differently tomorrow?” Participant thinks silently. At 5s, add a second version of the same participant passing in the deep background wearing the same jacket plus a small green scarf; the future version looks toward camera and says from a realistic distance, “Leave ten minutes earlier.” The foreground participant hears it, turns only their eyes toward the background, then answers, “Apparently, that.” The future version continues walking out of frame without interacting. Match identity carefully but keep depth, scale, reverb, and focus correct so the duplication reads as intentional. No body overlap, teleportation, freeze frame, subtitles, time-portal effect, altered crowd, microphone on the wrong speaker, voice doubling, brand signs, or changed foreground performance before 5s."
  },
  {
    "id": "social_ugc_8",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "The sock election in a laundromat",
    "mode": "T2V",
    "suggested": "15 seconds, 9:16, stop-motion/live-action blend",
    "aspectRatio": "9:16",
    "duration": "15s",
    "prompt": "Create a playful vertical laundromat clip combining live-action hands with restrained stop-motion. On a folding table are exactly six clean unmatched socks: two striped, two solid, one dotted, one plain white. 0–5s: a hand places a small blank cardboard box at center and leaves frame; the socks inch toward it through short stop-motion movements while machines turn normally behind them. 5–10s: each sock drops one colored clothespin into the box; the plain white sock pauses, takes back its pin, then places it beside the dotted sock. 10–15s: a hand returns, opens the box, counts five pins, and asks, “Who abstained?” All socks fall flat at once. Camera locked at table height, practical fluorescent light. Sound: dryers, clothespins, one line, fabric flop. Preserve sock patterns, count, pin count, box, hand, background machines, and stop-motion cadence. No faces on socks, political logos, readable ballots, extra garments, human-like limbs, floating without incremental motion, subtitles, or changing colors."
  },
  {
    "id": "social_ugc_9",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "A café cup keeps choosing the better light",
    "mode": "I2V",
    "suggested": "12 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "12s",
    "prompt": "Animate the supplied café tabletop image as a creator’s failed product-shot blooper. Preserve the exact unbranded ceramic cup, saucer, phone tripod, creator’s hands, table, window, and afternoon light. 0–4s: the creator slides the cup 15 centimeters left into the composed mark; when their hands leave, the cup slowly slides back toward the brighter window and stops without spilling. 4–8s: they move it right and place one coaster beneath it; the cup and coaster together rotate 20 degrees toward the light. 8–12s: the creator gives up, shifts the phone tripod to match the cup, and the cup remains still; one hand gives a reluctant thumbs-up. Treat the cup’s motion as subtle surrealism with consistent friction and shadow, not levitation. Sound: ceramic, table slide, room ambience, no speech. Preserve liquid level, handle direction, reflections, cup geometry, props, and camera. No face on cup, splash, sudden teleportation, extra hands, logos, captions, brand packaging, or moving window light."
  },
  {
    "id": "social_ugc_10",
    "category": "social_ugc",
    "categoryName": "โซเชียลคอมเมดี้ & UGC",
    "title": "Coffee spill reset seamless loop",
    "mode": "T2V",
    "suggested": "8 seconds, 1:1, exact loop",
    "aspectRatio": "1:1",
    "duration": "8s",
    "prompt": "Create a seamless square social loop at a shared office table. At frame one, a full unbranded coffee mug sits beside a closed notebook and one blue pen. 0–3s: an elbow enters from left, nudges the mug, and a small amount of coffee spills in a crescent toward the notebook; the hand catches the mug before it falls. 3–6s: the spill reaches the notebook edge, then the blue pen rolls through it and traces a circular path around the mug. As the pen completes the circle, the coffee follows behind it back into the mug in a continuous physically readable reverse flow. 6–8s: the pen returns to its exact starting place, the elbow exits left, and the full mug matches frame one for a perfect loop. Camera locked overhead, soft office daylight. Sound: ceramic tap, liquid, pen roll, final room tone aligned to first frame. Preserve mug, liquid volume, notebook, pen, hand, shadows, table grain, and loop timing. No endless liquid, stain left behind, object morphing, extra stationery, text, logo, cut, or visible reverse-time artifact outside the spill."
  },
  {
    "id": "dialogue_review_1",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Bilingual museum welcome with clean speaker turns",
    "mode": "T2V",
    "suggested": "15 seconds, 16:9, dialogue",
    "aspectRatio": "16:9",
    "duration": "15s",
    "prompt": "Inside a contemporary local-history gallery, a guide welcomes two visitors while standing beside a tactile map. 0–5s: medium shot; the guide looks at the visitors and says in natural English, “Welcome. You can begin with the map beside me.” 5–9s: the guide gestures once toward the map; both visitors stay silent and follow the gesture with their eyes. 9–15s: cut to a closer angle without crossing the eyeline; the guide repeats in Mandarin Chinese, “欢迎，请先从我身边的触摸地图开始。” One visitor nods only after the sentence ends. Quiet gallery ambience, soft footsteps, no music under speech. Preserve faces, clothing, positions, map geometry, left-right orientation, and voice identity across the cut. No subtitles, overlapping speech, mouth movement from listeners, invented exhibits, logos, text artifacts, exaggerated gestures, or camera crossing the 180-degree line."
  },
  {
    "id": "dialogue_review_2",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Remote support instruction matched to real action",
    "mode": "R2V",
    "suggested": "18 seconds, 16:9",
    "aspectRatio": "16:9",
    "duration": "15s",
    "prompt": "Image 1 defines the technician; Image 2 defines the customer and desk; Video 1 defines the screen-call layout only. Create a remote support exchange in which every spoken instruction is followed by one visible action. 0–5s: split view; technician says in Spanish, “Busca el cable azul, a la izquierda del router.” Customer listens with hands still. 5–10s: customer selects the single blue cable on the left, holds it up, and asks, “¿Este?” 10–14s: technician answers, “Sí. Conéctalo al puerto marcado dos.” 14–18s: close physical view as the customer inserts it into port 2 and the second status light turns green. Preserve faces, voices, blue cable, port numbering, hand ownership, screen layout, and desk objects. Sound includes natural room tone and connector click. No simultaneous speaking and action, changing cable colors, moving ports, unreadable fake interface text, extra fingers, subtitles, or indicator light before connection."
  },
  {
    "id": "dialogue_review_3",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Sign-language evacuation briefing",
    "mode": "I2V",
    "suggested": "16 seconds, 16:9",
    "aspectRatio": "16:9",
    "duration": "10s",
    "prompt": "Use the supplied image as the exact presenter, interpreter, room, and exit-map reference. Animate an accessible workplace evacuation briefing. The presenter stands on the left and speaks two short sentences at a measured pace; the sign-language interpreter stands on the right with both hands fully visible from waist to head. 0–7s: presenter says, “When the alarm sounds, leave by the nearest marked exit.” 7–9s: both pause while the camera gently pushes toward the map. 9–16s: presenter says, “Meet at the tree across the courtyard.” The interpreter signs continuously with natural facial grammar, beginning just after each spoken phrase and finishing before the next. Staff in the foreground watch silently. Preserve hand anatomy, identity, clothing, map, exit arrows, framing, and speaker positions. Clear speech, no music. No cropped hands, invented or gibberish signs, overlapping dialogue, subtitles covering hands, flashing lights, panic, running, text changes, or role swapping."
  },
  {
    "id": "dialogue_review_4",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Documentary voiceover with a silent subject",
    "mode": "T2V",
    "suggested": "18 seconds, 2.39:1",
    "aspectRatio": "9:16",
    "duration": "15s",
    "prompt": "Create a quiet observational documentary portrait of an elderly bicycle repairer opening a small workshop at dawn. Shot 1: hands unlock a corrugated shutter and lift it; the repairer does not speak. Shot 2: they wipe yesterday’s dust from a wooden bench, place three tools in order, and pump one tire. Shot 3: a shaft of sunlight reaches the spinning wheel as it slows. A separate adult narrator speaks off camera in restrained Japanese: “この店では、急ぐことより、長く使うことを大切にしている。” The subject’s mouth remains closed throughout and their natural breathing is visible only in the shoulders. Camera uses patient locked frames and one slow lateral slide. Sound: shutter, cloth, tools, pump, morning birds beneath the narration. Preserve workshop layout, tool order, clothing, hands, bicycle, and dawn light direction. No lip-sync on subject, sentimental music, subtitles, brand marks, staged eye contact, tool teleportation, or younger-face transformation."
  },
  {
    "id": "dialogue_review_5",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Two-camera community podcast with active listening",
    "mode": "R2V",
    "suggested": "20 seconds, 16:9",
    "aspectRatio": "16:9",
    "duration": "10s",
    "prompt": "Images 1 and 2 define the two guests; Image 3 defines the studio; Audio 1 defines Guest A’s approved voice, Audio 2 Guest B’s approved voice. Create a two-camera community podcast excerpt about a shared garden. 0–8s Camera A medium two-shot: Guest A says in Brazilian Portuguese, “A horta mudou quando as crianças começaram a escolher o que plantar.” Guest B listens with mouth closed, glances at A, then smiles. 8–12s Camera B close-up: Guest B waits half a beat and asks, “E o que elas escolheram primeiro?” 12–20s return to Camera A: Guest A answers, “Girassóis, porque queriam ver o verão crescer.” Keep microphones 15 centimeters from each speaker, eyelines consistent, and cuts only during pauses. Sound: clean close voices, faint room tone, no music. Preserve faces, voice assignments, wardrobe, chairs, microphone types, table objects, and left-right positions. No crosstalk, lip movement from listener, camera-axis reversal, subtitles, logo, voice blending, or shifting microphone geometry."
  },
  {
    "id": "dialogue_review_6",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Exact-timing localized dub edit",
    "mode": "Video",
    "suggested": "preserve source duration and aspect ratio",
    "aspectRatio": "9:16",
    "duration": "10s",
    "prompt": "Edit only the spoken performance of the supplied café clip for German localization. Preserve every frame’s camera movement, shot length, actor identity, face structure, wardrobe, hands, props, background patrons, lighting, cup positions, and ambient sound timing. Replace the original lead line with natural German: “Ich nehme den kleinen Tisch am Fenster, wenn er noch frei ist.” The actor begins speaking at the original first syllable, keeps one short pause after “Fenster,” and finishes before turning toward the window. Adapt mouth motion only as much as needed for plausible articulation; retain the original head turn and expression. The barista remains silent with a closed mouth and responds with the existing nod after the line ends. Mix the new voice into the same acoustic space and preserve cup and room sounds. No subtitles, translated signs, identity drift, new gestures, timing changes, voice on the wrong speaker, over-articulated jaw, or modified background action."
  },
  {
    "id": "dialogue_review_7",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Transparent newsroom correction segment",
    "mode": "T2V",
    "suggested": "14 seconds, 16:9, dialogue",
    "aspectRatio": "16:9",
    "duration": "4s",
    "prompt": "Create a fictional local-news correction delivered calmly by one presenter at a clean studio desk. 0–3s: wide shot establishes the presenter and a blank blue side panel with no readable text. 3–11s: medium shot; the presenter looks into lens and says in natural English, “A figure in our earlier report was incorrect. The meeting begins at six thirty, not six.” They pause briefly after “incorrect” and emphasize only the two times. 11–14s: the presenter lowers their notes, gives one neutral nod, and the camera holds. Voice is direct and unhurried; room is silent except for subtle studio ambience. Preserve face, hairstyle, jacket, papers, desk geometry, gaze, and lighting. No dramatic alert music, fake station logo, ticker, subtitles, changing numbers on screen, smile during the correction, repeated sentence, extra presenter, jump cut, or political branding."
  },
  {
    "id": "dialogue_review_8",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Pronunciation lesson with visible minimal pairs",
    "mode": "I2V",
    "suggested": "16 seconds, 9:16",
    "aspectRatio": "9:16",
    "duration": "10s",
    "prompt": "Animate the supplied vertical classroom frame. The language teacher demonstrates the English minimal pair “ship” and “sheep” for adult learners. 0–5s: teacher points to the left blank card, says “ship” once at natural speed, then repeats slowly while the camera stays on the full face. 5–10s: teacher points to the right blank card, says “sheep” once and repeats slowly, holding the longer vowel without exaggerating jaw motion. 10–16s: teacher alternates “ship, sheep” once, then stays silent while two students repeat off camera in order. Keep lips fully visible, hands below the chin, and audio clean. Preserve teacher identity, wardrobe, card positions, classroom, and camera. The cards remain blank to avoid text-generation artifacts. No subtitles, phonetic symbols, distorted mouth, tongue close-up, learner faces speaking out of sync, background music, accent mockery, extra repetitions, or camera cuts during a word."
  },
  {
    "id": "dialogue_review_9",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Family recipe oral-history archive",
    "mode": "R2V",
    "suggested": "20 seconds, 4:3",
    "aspectRatio": "4:3",
    "duration": "4s",
    "prompt": "Image 1 defines the grandmother’s identity and clothing; Image 2 defines the granddaughter; Image 3 defines the family kitchen; Audio 1 is the grandmother’s authorized Cantonese voice reference. Create a warm 4:3 oral-history moment while they fold dumplings. The grandmother demonstrates one fold slowly and says, “以前我们没有量匙，就用手记住分量。” The granddaughter keeps her mouth closed, watches the fingers, and mirrors the fold only after the sentence. She then asks softly, “那我这一个，像不像？” The grandmother looks at the dumpling, laughs once, and answers, “很像，边再压紧一点。” Camera alternates between a two-shot and one overhead hand insert without changing the left-right seating. Sound: dough, ceramic bowl, quiet refrigerator, natural voices. Preserve faces, voice assignment, hand ownership, filling amount, bowl placement, clothing, and dumpling count. No subtitles, translated speech, food teleportation, extra fingers, age changes, sentimental montage, logo, or laughter over dialogue."
  },
  {
    "id": "dialogue_review_10",
    "category": "dialogue_review",
    "categoryName": "คน & บทพูดรีวิว",
    "title": "Laundromat apology micro-drama",
    "mode": "T2V",
    "suggested": "20 seconds, 16:9",
    "aspectRatio": "16:9",
    "duration": "10s",
    "prompt": "Set a restrained two-person micro-drama in a quiet laundromat at night. A student in a navy raincoat has accidentally moved a baker’s folded apron from a dryer. 0–5s: the student notices the baker approaching, holds the apron carefully with both hands, and says in Korean, “죄송해요. 제 빨래인 줄 알았어요.” 5–10s: the baker glances from apron to student, keeps their mouth closed, and exhales; dryer drums turn behind them. 10–15s: the baker replies, “괜찮아요. 깨끗한 의자에 놓아 주세요.” 15–20s: the student places the apron on the indicated chair, smooths it once, and both give a small nod. Camera: static wide, slow push to medium during the pause, no reverse angle. Sound: dryer hum, rain on glass, two clear voices. Preserve faces, clothing, apron, chair, spatial positions, eyelines, and dialogue order. No subtitles, crosstalk, melodramatic crying, aggressive gesture, floating laundry, machine-door changes, logo, or mouth movement from the listener."
  }
];
