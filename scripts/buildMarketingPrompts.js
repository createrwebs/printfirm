const fs = require('fs');
const path = require('path');

const promptFiles = [
  { file: 'ugc-food-travel.md', category: 'ugc_food_travel', catName: 'UGC อาหาร & ท่องเที่ยว' },
  { file: 'ads-and-products.md', category: 'ads_products', catName: 'โฆษณาสินค้า & ดีไซน์' },
  { file: 'commerce-beauty-retail.md', category: 'beauty_retail', catName: 'คอมเมิร์ซ & บิวตี้' },
  { file: 'social-comedy-surreal-ugc.md', category: 'social_ugc', catName: 'โซเชียลคอมเมดี้ & UGC' },
  { file: 'people-dialogue-localization.md', category: 'dialogue_review', catName: 'คน & บทพูดรีวิว' }
];

const results = [];

// Add the custom featured templates directly targeting the user's exact requirements
results.push({
  id: 'featured_model_holding_product',
  category: 'featured',
  categoryName: '⭐ พรอมต์แนะนำ (Featured)',
  title: 'นางแบบถือสินค้าโชว์รีวิว (Model Holding Product)',
  titleEn: 'Model Holding Product Commercial Review',
  mode: 'R2V / Multi-Ref',
  suggested: '10 วินาที, 9:16 (แนวตั้ง TikTok/Reels)',
  aspectRatio: '9:16',
  duration: '10s',
  badge: 'ยอดนิยมสำหรับ UGC',
  prompt: `10 วินาที, 9:16, วิดีโอรีวิวสินค้าสไตล์ UGC คมชัดระดับ 4K แสงธรรมชาติในห้องสตูดิโอสว่างสบายตา
[ตัวแบบ]: ใช้รูปอ้างอิงอวตาร Reference 1 คงรูปหน้า รอยยิ้ม และสีผมไว้อย่างแม่นยำ
[สินค้า]: ใช้รูปอ้างอิงสินค้า Reference 2 โดยนางแบบใช้มือขวาถือขวดเซรั่มบำรุงผิวขึ้นมาในระดับอก หันฉลากสินค้าเข้าหากล้องอย่างชัดเจน
[การกระทำ]: 0-3 วิ นางแบบยิ้มมองกล้องและยกสินค้าขึ้นมาโชว์ 3-7 วิ เปิดฝาขวดแตะเนื้อเซรั่มลงบนหลังมือเบาๆ แสดงความชุ่มชื้น 7-10 วิ พยักหน้าด้วยความประทับใจและหันสินค้าให้กล้องโฟกัส
[กล้อง]: เริ่มจาก Medium shot แล้ว Zoom In แบบนุ่มนวลเข้าหาตัวสินค้าและมือ
[เสียง/บทพูด]: พูดภาษาไทยอย่างเป็นธรรมชาติ "ทุกคนคะ เซรั่มตัวนี้เนื้อบางเบามาก ซึมไว ผิวฉ่ำสุดๆ แนะนำเลยค่ะ!" เสียงใส ไม่มีเพลงทับคำพูด ห้ามสินค้าเปลี่ยนรูป ห้ามมือบิดเบี้ยว`
});

results.push({
  id: 'featured_model_eating_restaurant',
  category: 'featured',
  categoryName: '⭐ พรอมต์แนะนำ (Featured)',
  title: 'นางแบบนั่งกินอาหารในร้าน/คาเฟ่ (Model Eating & Cafe Review)',
  titleEn: 'Model Dining & Food Tasting Review',
  mode: 'R2V / Multi-Ref',
  suggested: '12 วินาที, 9:16 (แนวตั้ง TikTok/Reels)',
  aspectRatio: '9:16',
  duration: '12s',
  badge: 'อาหาร & ท่องเที่ยว',
  prompt: `12 วินาที, 9:16, วิดีโอรีวิวอาหารแนวตั้ง Mood & Tone อบอุ่น แสงแดดยามบ่ายส่องเข้ามาในคาเฟ่
[ตัวแบบ]: ใช้รูปอ้างอิงอวตาร Reference 1 ล็อกอัตลักษณ์ใบหน้า เสื้อผ้า และทรงผมให้คงที่
[สถานที่]: ใช้รูปอ้างอิงสถานที่ Reference 3 นั่งอยู่ริมหน้าต่างไม้ของร้าน บรรยากาศมีต้นไม้และโต๊ะอาหาร
[การกระทำ]: 0-4 วิ นางแบบนั่งอยู่หน้าจานอาหาร ใช้ช้อนตักขนมเค้กขึ้นมาหนึ่งคำ 4-8 วิ เอาเข้าปากเคี้ยวช้าๆ แล้วยิ้มตาหยีด้วยความอร่อย 8-12 วิ ชูนิ้วโป้งให้กล้อง พร้อมยกแก้วกาแฟขึ้นมาจิบปิดท้าย
[กล้อง]: กล้องแบบ Handheld เล็กน้อยให้ดูเรียลและเป็นธรรมชาติ มุม Medium Close-Up โฟกัสสีหน้าและจานอาหาร
[เสียง/บทพูด]: เสียงเคี้ยวเบาๆ เสียงบรรยากาศร้านกาแฟ บทพูดภาษาไทย: "อร่อยแสงออกปากมาก คาเฟ่นี้ต้องมาซ้ำแน่นอนค่ะ!" ห้ามอาหารเปลี่ยนรูป ห้ามส้อมลอย`
});

results.push({
  id: 'featured_model_travel_vlog',
  category: 'featured',
  categoryName: '⭐ พรอมต์แนะนำ (Featured)',
  title: 'รีวิวเดินทางไปเที่ยว เช็คอินสถานที่ (Travel Vlog Check-in)',
  titleEn: 'Travel Destination Vlog & Check-in',
  mode: 'R2V / Multi-Ref',
  suggested: '15 วินาที, 9:16 (แนวตั้ง TikTok/Reels)',
  aspectRatio: '9:16',
  duration: '15s',
  badge: 'ท่องเที่ยว Vlog',
  prompt: `15 วินาที, 9:16, วิดีโอท่องเที่ยวสไตล์ Travel Vlog สมจริง ภาพคมชัดระดับ Cinematic
[ตัวแบบ]: ล็อกหน้านางแบบตาม Reference 1 สวมชุดลำลองสำหรับเดินทาง สะพายกระเป๋าผ้า
[สถานที่]: บรรยากาศสถานที่ท่องเที่ยวตาม Reference 3 ท้องฟ้าแจ่มใส มีวิวทิวทัศน์สวยงามด้านหลัง
[การกระทำ]: 0-5 วิ นางแบบเดินหันหลังแล้วหมุนตัวกลับมาโบกมือทักทายกล้องอย่างสดใส 5-10 วิ เดินนำกล้องเข้าไปชมจุดไฮไลท์ของสถานที่ ชี้มือชมวิว 10-15 วิ หันหน้ากลับมาพูดยิ้มแย้มกับกล้อง
[กล้อง]: กล้องกิมบอลตามติดแบบ Smooth Tracking Follow Shot แสงแดดธรรมชาตินุ่มนวล
[เสียง/บทพูด]: เสียงลมธรรมชาติ เสียงใบไม้ไหว บทพูดภาษาไทย: "วันนี้พามาเช็คอินที่นี่ สวยตรงปก อากาศดีมากๆ ใครชอบเที่ยวต้องปักหมุดเลยนะคะ!"`
});

results.push({
  id: 'featured_model_unboxing',
  category: 'featured',
  categoryName: '⭐ พรอมต์แนะนำ (Featured)',
  title: 'แกะกล่องสินค้าและรีวิวความประทับใจ (Unboxing & Review)',
  titleEn: 'Unboxing & First Impression Showcase',
  mode: 'R2V',
  suggested: '15 วินาที, 9:16 (แนวตั้ง)',
  aspectRatio: '9:16',
  duration: '15s',
  badge: 'แกะกล่องสินค้า',
  prompt: `15 วินาที, 9:16, วิดีโอแกะกล่องสินค้า UGC Unboxing ถ่ายบนโต๊ะสตูดิโอสีขาวมินิมอล
[ตัวแบบ]: นางแบบตาม Reference 1 สวมเสื้อยืดมินิมอล นั่งอยู่หน้าโต๊ะ
[สินค้า]: กล่องพัสดุและตัวสินค้าตาม Reference 2 รูปทรงและสีสันถูกต้อง 100%
[การกระทำ]: 0-5 วิ กรีดเทปกล่องพัสดุออกอย่างระมัดระวัง หยิบกล่องสินค้าด้านในออกมา 5-10 วิ เปิดกล่องโชว์ตัวสินค้าขึ้นมาใกล้กล้อง พร้อมแกะพลาสติกกันรอยออก 10-15 วิ ถือสินค้าคู่กับใบหน้า ยิ้มกว้างอย่างตื่นเต้น
[กล้อง]: Top-down สลับกับ Eye-level 45 องศา โฟกัสรายละเอียดของสินค้าคมชัด
[เสียง/บทพูด]: เสียง ASMR แกะเทป แกะพลาสติก บทพูดภาษาไทย: "ของมาส่งแล้วทุกคน! แพ็กเกจจิ้งหรูมาก เดี๋ยวลองใช้จริงให้ดูคลิปหน้านะคะ"`
});

promptFiles.forEach(({ file, category, catName }) => {
  const p = path.join('awesome_wan-3-0-prompts/prompts', file);
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  
  const sections = content.split(/\n##\s+/);
  sections.shift();
  
  sections.forEach((sec, idx) => {
    const lines = sec.trim().split('\n');
    const titleLine = lines[0] || '';
    const cleanTitle = titleLine.replace(/^\d+[\s｜\|]+/, '').trim();
    
    const modeMatch = sec.match(/\*\*(?:模式|Mode)[\*:\s]+([^\n\r·\s]+)/i);
    const mode = modeMatch ? modeMatch[1].replace(/[　\s]/g, '') : 'I2V / R2V';
    
    const suggMatch = sec.match(/\*\*(?:建议|Suggested)[\*:\s]+([^\n\r]+)/i);
    const sugg = suggMatch ? suggMatch[1].replace(/^[：:\s]+/, '').trim() : '10 วินาที, 9:16';
    
    const codeMatch = sec.match(/```(?:text)?[\r\n]+([\s\S]*?)```/);
    if (!codeMatch) return;
    const promptText = codeMatch[1].trim();
    
    let ratio = '9:16';
    if (sugg.includes('16:9')) ratio = '16:9';
    else if (sugg.includes('1:1')) ratio = '1:1';
    else if (sugg.includes('4:3')) ratio = '4:3';
    
    let duration = '10s';
    if (sugg.includes('15') || sugg.includes('15s') || sugg.includes('18')) duration = '15s';
    else if (sugg.includes('12') || sugg.includes('12s')) duration = '12s';
    else if (sugg.includes('8') || sugg.includes('8s')) duration = '8s';
    else if (sugg.includes('5') || sugg.includes('5s') || sugg.includes('4') || sugg.includes('4s')) duration = '4s';
    
    results.push({
      id: category + '_' + (idx + 1),
      category,
      categoryName: catName,
      title: cleanTitle,
      mode: mode.replace(/^：/, ''),
      suggested: sugg,
      aspectRatio: ratio,
      duration: duration,
      prompt: promptText
    });
  });
});

console.log('Total prompts ready:', results.length);

const outContent = `export interface MarketingPromptItem {
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

export const MARKETING_PROMPTS: MarketingPromptItem[] = ${JSON.stringify(results, null, 2)};
`;

fs.mkdirSync('frontend/src/data', { recursive: true });
fs.writeFileSync('frontend/src/data/marketingPrompts.ts', outContent, 'utf8');
console.log('Saved to frontend/src/data/marketingPrompts.ts successfully');
