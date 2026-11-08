# 🎬 Google Colab Notebooks for PrintFilm

คู่มือการใช้งาน Google Colab สำหรับเรนเดอร์วิดีโอสตอรี่บอร์ดใน **PrintFilm**

---

## 🚀 แนะนำหลัก: MiniMax H3 (Ref2VA / FL2VA) + Audio (ตรงกับระบบ PrintFilm 100%)

ไฟล์: [`MiniMax_H3_Colab.ipynb`](file:///d:/codea/printfilm/notebooks/MiniMax_H3_Colab.ipynb)

สร้างขึ้นเพื่อรองรับสถาปัตยกรรม **Omni-Modal Reference-to-Video** ของ MiniMax H3:
* **รองรับ Multi-Reference ได้ถึง 9 รูป (`<Picture 1>` ถึง `<Picture 9>`):** ใส่รูป Character Turnaround, Scene Background, และ Props พร้อมกันได้ โมเดลเข้าใจบริบทแบบ Multimodal (ผ่าน Qwen3-VL 32B text/vision encoder) โดยไม่จำกัดแค่ 1-2 เฟรมแบบ Image-to-Video ทั่วไป
* **คุม First & Last Frame (`FL2VA`):** เจนคลิปที่รอยต่อภาพหัว-ท้ายเชื่อมกันอย่างสมบูรณ์
* **เจนเสียงและลิปซิงค์ในรอบเดียว (Native Audio + Lip-sync):** รองรับแท็ก `<d> Dialogue </d>` เจนทั้งภาพและเสียงพากย์สเตอริโอ 44.1kHz พร้อมกัน
* **รองรับ L4 GPU (24GB VRAM) บน Google Colab Pro:** ใช้โมเดล Quantized INT8 / PRISM พร้อม dynamic weight offload และ SageAttention/BlockSparseAttention
* **มี Form ทดสอบในตัว (เซลล์ ④):** อัปโหลดภาพ Ref, พิมพ์บทพูด และกดเรนเดอร์คลิป mp4 ดูได้ทันทีในหน้า Colab

### ข้อกำหนดฮาร์ดแวร์ใน Google Colab:
* **GPU:** **L4** (หรือ A100) — มี VRAM 24GB เพียงพอต่อโมเดล INT8
* **RAM:** **High-RAM** (~52GB System RAM) — จำเป็นสำหรับการโหลด Qwen3-VL text encoder ครั้งแรก

### ขั้นตอนการใช้งาน:
1. เข้า [Google Colab](https://colab.research.google.com/) $\rightarrow$ แถบ **Upload** $\rightarrow$ เลือก [`MiniMax_H3_Colab.ipynb`](file:///d:/codea/printfilm/notebooks/MiniMax_H3_Colab.ipynb)
2. เมนู **Runtime** $\rightarrow$ **Change runtime type** $\rightarrow$ เลือก **L4 GPU** และติ๊ก **High-RAM**
3. รันเซลล์ **① (ตรวจเครื่อง + ติดตั้ง ComfyUI & Custom Nodes):** เช็ค GPU/Driver ($\ge 580$), ติดตั้ง PyTorch `cu130` และโหนดงานละครครบชุด (`minimax-h3-audio-t8`, `comfyui-SelfLift`, `ComfyUI-H3-Motion-Context`, `ComfyUI-VideoHelperSuite`, `ComfyUI-KJNodes`, `ComfyUI-ListHelper`, `colab_userdata_slash_fix`)
4. รันเซลล์ **② (ดาวน์โหลดโมเดล + Drama LoRAs ~41 GB):** โหลดโมเดลหลัก H3 + ชุด Drama LoRA & Semantic Bridge ลงเครื่องให้ครบ **ก่อนสตาร์ท ComfyUI** เพื่อไม่ให้ขึ้นหน้าต่าง `Setup required`
5. รันเซลล์ **③ (สตาร์ท ComfyUI + ฝัง `H3_Drama_MultiRef.json`):** รัน ComfyUI เบื้องหลังพร้อมตรวจเช็คผ่าน `/object_info` ว่าโหนดและโมเดลครบ 100%
6. รันเซลล์ **④ (Colab Native Proxy)** เพื่อเปิดหน้าเว็บ ComfyUI ในแท็บใหม่ หรือรันเซลล์ **④-b (Cloudflare Tunnel)** เพื่อนำ URL (`https://xxxx.trycloudflare.com`) ไปวางในช่อง "ComfyUI URL" บนหน้า PrintFilm
7. **(ทางเลือก) เซลล์ ⑤ $\rightarrow$ ⑥ $\rightarrow$ ⑦ $\rightarrow$ 🔍:** อัปโหลดรูปอ้างอิง 1–9 รูป, วาง Prompt ในกล่อง `ipywidgets`, กดเจนคลิปพร้อมดูวิดีโอและตรวจ Log ใน Colab ได้ทันที

---

## 🌟 ทางเลือกสำรอง: Wan 2.2 FMLF + ComfyUI

ไฟล์: [`Wan2_2_FMLF_Colab.ipynb`](file:///d:/codea/printfilm/notebooks/Wan2_2_FMLF_Colab.ipynb)

สร้างขึ้นจากการนำโครงสร้างที่เสถียรของ `dseditor/minimax-h3-colab` มารวมกับระบบ **`wallen0322/ComfyUI-Wan22FMLF`**:
* **แนบภาพ Ref ได้หลายรูปจริง:** บังคับภาพต้นฉาก (First Frame) -> ท่าทางกลางคลิป (Middle Frame) -> ภาพจบ (Last Frame) พร้อมทั้งล็อกใบหน้าตัวละครตรงปกด้วย Spatial Gradient
* **คุม Prompt ได้ตามจริง:** ไม่หลอนเสียงพูดแทรกเอง สั่งตามบทแอคชั่นเป๊ะๆ
* **เปิดหน้าต่าง ComfyUI ตรงๆ ใน Colab (Native Proxy):** ในเซลล์ ④ คลิกเปิดดูหน้า UI ได้ทันที โหลดเร็ว 100% ไม่ติดปัญหา Cloudflare Error 1033 หรือหน้าขาวขึ้นแต่โลโก้
* **เร่งความเร็วด้วย LoRA 4-Step (LightX2V):** เจนเสร็จใน 4–6 steps (เร็วมาก 1–2 นาที)
* **มีฟอร์มทดสอบใน Colab (เซลล์ ⑥):** สามารถเลือกรูป พิมพ์ Prompt แล้วกด Render ดูคลิปผลลัพธ์ใน Colab ได้ทันที

### ขั้นตอนการใช้งาน:
1. เข้า [Google Colab](https://colab.research.google.com/) $\rightarrow$ แถบ **Upload (อัปโหลด)** $\rightarrow$ เลือก [`Wan2_2_FMLF_Colab.ipynb`](file:///d:/codea/printfilm/notebooks/Wan2_2_FMLF_Colab.ipynb)
2. เมนู **Runtime** $\rightarrow$ **Change runtime type** $\rightarrow$ เลือก **L4 GPU** (หรือ A100)
3. รันเซลล์ **①** (~1-2 นาที) เพื่อติดตั้ง ComfyUI, VHS, Manager, และ FMLF Nodes
4. รันเซลล์ **②** เพื่อดาวน์โหลดโมเดล Wan 2.2 14B Dual-Noise + LoRA 4-Step
5. รันเซลล์ **③** เพื่อสตาร์ท ComfyUI และฝัง FMLF Workflow
6. รันเซลล์ **④** เพื่อคลิกลิงก์เปิดหน้าเว็บ ComfyUI ใน Colab
7. รันเซลล์ **⑤** นำ URL Tunnel ไปวางในช่อง "ComfyUI URL" บนเว็บ PrintFilm เพื่อสั่งเรนเดอร์ฉากได้ทันที!

### คุณสมบัติเด่นของ Wan 2.2:
1. **ดึงโมเดลโดยตรงจาก Hugging Face ทางการ:** โหลดไฟล์จาก [`Comfy-Org/Wan-2.2`](https://huggingface.co/Comfy-Org/Wan-2.2) หรือ [`Comfy-Org/Bernini-R`](https://huggingface.co/Comfy-Org/Bernini-R)
2. **ตัวเลือกโมเดลในเซลล์ ②:**
   - **`Wan2.2-TI2V-5B` (แนะนำเริ่มต้น):** ดาวน์โหลดเร็ว (~9.3 GB) ควบคุมเฟรมแรกตรงปก ไม่หลอนพูดเอง
   - **`Bernini-R (Wan2.2-14B-FP8)` (แนะนำสำหรับเน้นคุม Reference):** ตัวโมเดลจาก ByteDance ที่จูนเรื่อง Reference-to-Video มาโดยเฉพาะ รักษารายละเอียดตัวละครและฉากได้นิ่งที่สุด
   - **`Wan2.2-14B-Dual`:** รุ่น 14B High + Low Noise สำหรับงานความละเอียดสูง
3. **ติดตั้ง ComfyUI-Wan22FMLF ในตัว:** มีโหนดคุมเฟรมต้น-กลาง-ท้าย (First-Middle-Last Frame) และ Spatial Gradient ล็อกใบหน้าไม่ให้หลุดลอย
4. **เปิดเชื่อมต่อภายนอก (Tunnel):** รองรับทั้ง **Cloudflare** และ **Ngrok** (แนะนำ Ngrok สำหรับการเชื่อมต่อที่เสถียร 100% ไม่หลุด)

---

### วิธีเปิดใช้งานใน Google Colab:
1. ไปที่ [Google Colab](https://colab.research.google.com/)
2. เลือกแถบ **Upload (อัปโหลด)** แล้วเลือกไฟล์ `notebooks/Wan2_2_Colab.ipynb`
3. ไปที่เมนู **Runtime (รันไทม์)** $\rightarrow$ **Change runtime type (เปลี่ยนประเภทฮาร์ดแวร์)** $\rightarrow$ เลือก **L4 GPU** (หรือ A100)
4. กดรันทีละเซลล์จากบนลงล่าง:
   - **เซลล์ ①:** ติดตั้ง ComfyUI (เวอร์ชันล่าสุดที่รองรับโหนด Wan 2.2) + VideoHelperSuite
   - **เซลล์ ②:** ดาวน์โหลดโมเดล Wan 2.2 จาก Hugging Face
   - **เซลล์ ③:** สตาร์ท ComfyUI และเปิด Cloudflare Tunnel
5. เมื่อเซลล์ ③ ทำงานเสร็จ จะแสดงข้อความ:
   ```
   🎯 Cloudflare URL ของคุณคือ:
      https://xxxx-xxxx-xxxx.trycloudflare.com
   ```
6. คัดลอก URL นั้นไปวางในปุ่ม **Render with Colab** บนเว็บ PrintFilm แล้วเริ่มเรนเดอร์ได้ทันที!
