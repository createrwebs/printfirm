# -*- coding: utf-8 -*-
"""Build notebooks/MiniMax_H3_Colab.ipynb with Models Downloaded BEFORE ComfyUI Starts (Zero 'Setup required' popup)."""
import io
import json
from pathlib import Path

REPO_TMP = Path(r"C:\Users\theer\AppData\Local\Temp\minimax-h3-colab")
fix_src = (REPO_TMP / "tools" / "userdata_slash_fix.py").read_text(encoding="utf-8")
wf_drama_api = json.loads((REPO_TMP / "toybox" / "WF.json").read_text(encoding="utf-8"))
sample_drama_prompt = wf_drama_api["265"]["inputs"]["prompt"]

# Build a clean ComfyUI UI-format workflow (nodes + links) for H3 Drama Multi-Ref
# Every model and input file referenced here is downloaded/created in Cell ② BEFORE ComfyUI starts in Cell ③,
# so ComfyUI NEVER pops up "Setup required".
ui_base = json.loads((REPO_TMP / "workflows" / "H3_digital_human.json").read_text(encoding="utf-8"))
for node in ui_base["nodes"]:
    if node["id"] == 5:  # LoadImage
        node["widgets_values"] = ["sample_ref.jpg", "image"]
        if "widgets_values_named" in node:
            node["widgets_values_named"]["image"] = "sample_ref.jpg"
    elif node["id"] == 7:  # MiniMaxH3ReferenceToVideo
        node["widgets_values"] = [sample_drama_prompt, 480, 832, 193, "match"]
        if "widgets_values_named" in node:
            node["widgets_values_named"].update({
                "prompt": sample_drama_prompt,
                "width": 480,
                "height": 832,
                "length": 193,
                "ref_image_size": "match",
            })
        # Remove links 71/72 from GetImageSize so width/height stay fixed at 480x832 (9:16 Drama)
        for inp in node.get("inputs", []):
            if inp.get("name") in ("width", "height"):
                inp["link"] = None
    elif node["id"] == 16:  # SaveVideo
        node["widgets_values"] = ["h3_drama/shot", "auto", "auto", "auto"]
        if "widgets_values_named" in node:
            node["widgets_values_named"]["filename_prefix"] = "h3_drama/shot"

# Strip nodes 60 (GetImageSize) and 61 (ImageScaleToTotalPixels) and links 69, 70, 71, 72
ui_base["nodes"] = [n for n in ui_base["nodes"] if n["id"] not in (60, 61)]
ui_base["links"] = [lk for lk in ui_base["links"] if lk[0] not in (69, 70, 71, 72)]


def md(s: str):
    lines = s.strip("\n").split("\n")
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": [l + "\n" for l in lines[:-1]] + [lines[-1]],
    }


def code(s: str):
    lines = s.strip("\n").split("\n")
    return {
        "cell_type": "code",
        "metadata": {"cellView": "form"},
        "execution_count": None,
        "outputs": [],
        "source": [l + "\n" for l in lines[:-1]] + [lines[-1]],
    }


HEAD_MD = """# 🎬 MiniMax H3 (Hailuo 3)｜Drama & Multi-Reference Studio สำหรับ PrintFilm

สมุดงาน Colab สำหรับสร้าง **ละครสั้น / สตอรี่บอร์ด (Drama & Multi-Reference 1–9 รูป + First/Last Frame + เสียงพูด Lip-sync)**
รันเรียงตามลำดับ **① $\rightarrow$ ② $\rightarrow$ ③ $\rightarrow$ ④ (หรือ ④-b)** โดยดาวน์โหลดโมเดลและโหนดให้ครบในเซลล์ ①–② **ก่อนสตาร์ท ComfyUI ในเซลล์ ③** เพื่อไม่ให้ขึ้นหน้าต่าง **"Setup required"** ตอนเปิดหน้าเว็บ ComfyUI

| ขั้นตอน | ทำอะไร | เวลาที่ใช้ (บน L4) |
|---|---|---|
| ① ตรวจเครื่อง + ติดตั้ง | เช็ค GPU (≥ 8.0) & Driver (≥ 580) + ลง PyTorch CUDA 13 (`cu130`) + ComfyUI + **โหนดงานละครครบชุด (`Semantic Bridge T8`, `SelfLift`, `H3-Motion-Context`, `VideoHelperSuite`, `KJNodes`, `ListHelper`)** | ~1–2 นาที |
| ② ดาวน์โหลดโมเดล + Drama LoRAs | โหลดโมเดลหลัก H3 (~37 GB) + **ชุด Drama LoRA (`pika_h3_flex_ref2va`, `MysticXXX_MMH3`, `DasiwaREF2VA`, `H3_Combat_V2`, `Motion_Repair`) + `ActionLogic Semantic Bridge`** ให้ครบก่อนเริ่ม ComfyUI | ~2–4 นาที |
| ③ สตาร์ท ComfyUI + เช็คความพร้อม | รัน ComfyUI เบื้องหลัง + ฝัง `H3_Drama_MultiRef.json` + **ตรวจสอบผ่าน `/object_info` ว่าโมเดลและโหนดครบ 100% (ไม่ขึ้น Setup required)** | ~1 นาที |
| ④ เปิดหน้าเว็บ ComfyUI | เปิดผ่าน Colab Native Proxy (`serve_kernel_port_as_window`) เร็ว เสถียร โมเดลทุกตัวพร้อมใช้งานทันที | ไม่กี่วินาที |
| ④-b เปิด Cloudflare Tunnel | สร้างลิงก์ `https://xxxx.trycloudflare.com` สำหรับนำไปวางในหน้าเว็บ **PrintFilm** (ปุ่ม ⚡ Colab / ComfyUI) | ~10 วินาที |
| ⑤ อัปโหลดรูปอ้างอิง (1–9 รูป) | (ทางเลือก) อัปโหลดรูปตัวละครหลายตัว, ฉาก, หรือ First/Last Frame เพื่อทดสอบเจนใน Colab | — |
| ⑥ วาง Prompt บทละคร + ตั้งค่า | (ทางเลือก) กล่องข้อความ 6 ส่วน (`subject_definitions`, `summary`, `retention_analysis`, `detailed_description` ฯลฯ) + เลือกสัดส่วนจอ `9:16` / `16:9` | — |
| ⑦ สั่งเจนวิดีโอละครใน Colab | (ทางเลือก) เจนด้วย Drama Stack เต็มรูปแบบ (LoRA ละคร + Semantic Bridge + SigmaShift) พร้อมเล่นคลิปและดาวน์โหลด `.mp4` | ~3–4 นาที |
| 🔍 ตรวจสอบ Log & GPU | เช็คสถานะ `nvidia-smi`, RAM และกรอง Error จาก `/content/comfyui.log` เมื่อเกิดปัญหา | ทันที |

* **ใช้งานร่วมกับ PrintFilm**: รันแค่เซลล์ **① $\rightarrow$ ② $\rightarrow$ ③ $\rightarrow$ ④-b** แล้วนำลิงก์จาก **④-b** ไปวางในเว็บ PrintFilm ได้เลย!
"""

CELL_1 = (
    "#@title ① ตรวจสภาพแวดล้อม + ติดตั้ง ComfyUI, PyTorch CUDA 13 และ Custom Nodes ครบทุกตัว\n"
    "FIX_SRC = " + repr(fix_src) + """
import torch, shutil, subprocess, sys, os, psutil
from pathlib import Path

if not torch.cuda.is_available():
    raise RuntimeError('❌ ไม่พบ GPU: กรุณาไปที่เมนู Runtime → Change runtime type → เลือก L4 GPU แล้วรันเซลล์นี้ใหม่')

cap = torch.cuda.get_device_capability(0)
drv = subprocess.run(['nvidia-smi', '--query-gpu=driver_version', '--format=csv,noheader'], capture_output=True, text=True).stdout.strip()
ram_gb = psutil.virtual_memory().total / (2**30)
print('GPU:', torch.cuda.get_device_name(0), '| capability', cap, '| VRAM', round(torch.cuda.get_device_properties(0).total_memory / 2**30, 1), 'GiB')
print('Driver:', drv, '| PyTorch CUDA ปัจจุบัน:', torch.version.cuda, '| System RAM:', round(ram_gb, 1), 'GiB | พื้นที่ว่าง:', round(shutil.disk_usage('/content').free / 2**30, 1), 'GiB')

if cap < (8, 0):
    raise RuntimeError(f'❌ การ์ดจอนี้ (capability {cap}) ไม่รองรับโมเดล INT8 ConvRot กรุณาเปลี่ยนเป็น L4 (หรือ A100) แล้วรันใหม่')
if int(drv.split('.')[0]) < 580:
    raise RuntimeError(f'❌ Driver {drv} ไม่รองรับ CUDA 13 (ต้องการ 580 ขึ้นไป) กรุณา Disconnect and delete runtime เพื่อสุ่มเครื่อง L4 ใหม่')
if ram_gb < 25.0:
    print('⚠️ คำเตือน: แนะนำให้เปิด High-RAM (Runtime → Change runtime type → High-RAM) เพื่อป้องกัน RAM เต็มตอนโหลด Qwen3-VL 32B')

print('✅ ผ่านการตรวจสอบสภาพแวดล้อม เริ่มทำการติดตั้ง...')

try:
    from google.colab import userdata
    tok = userdata.get('HF_TOKEN')
    if tok:
        os.environ['HF_TOKEN'] = tok
        print('🔑 อ่านค่า HF_TOKEN จาก Colab Secrets เรียบร้อยแล้ว')
except Exception:
    print('ℹ️ ไม่ได้ตั้งค่า HF_TOKEN (จะใช้การดาวน์โหลดแบบไม่ระบุตัวตนแทน)')

def clone(url, dest):
    if not Path(dest).exists():
        subprocess.run(['git', 'clone', '--depth', '1', url, str(dest)], check=True)
    else:
        subprocess.run(['git', '-C', str(dest), 'pull', '--ff-only'], check=False)

COMFY = Path('/content/ComfyUI')
clone('https://github.com/Comfy-Org/ComfyUI.git', COMFY)

# โมเดล int8_convrot ของ MiniMax H3 ต้องใช้ PyTorch รุ่น CUDA 13 (cu130) เท่านั้น
if not (torch.version.cuda or '').startswith('13'):
    print('⏳ กำลังติดตั้ง PyTorch รุ่น CUDA 13 (จำเป็นสำหรับ weights แบบ int8_convrot)...')
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'torch', 'torchvision', 'torchaudio',
                    '--index-url', 'https://download.pytorch.org/whl/cu130'], check=True)

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-r', str(COMFY / 'requirements.txt'), 'huggingface_hub', 'hf_xet'], check=True)

# ติดตั้ง Custom Nodes ทั้งหมดที่ใช้ในระบบ Drama / Multi-Ref เพื่อไม่ให้ ComfyUI แจ้ง Missing Nodes ใน Setup required
CUSTOM_NODES = {
    'ComfyUI-MiniMax-H3-Turbo': 'https://github.com/Larryvrh/ComfyUI-MiniMax-H3-Turbo.git',
    'minimax-h3-audio-t8': 'https://github.com/T8mars/comfyui-minimax-h3-audio-T8',
    'comfyui-SelfLift': 'https://github.com/facok/comfyui-SelfLift',
    'ComfyUI-H3-Motion-Context': 'https://github.com/NikoDemon80/ComfyUI-H3-Motion-Context',
    'ComfyUI-VideoHelperSuite': 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git',
    'ComfyUI-KJNodes': 'https://github.com/kijai/ComfyUI-KJNodes.git',
    'ComfyUI-ListHelper': 'https://github.com/dseditor/ComfyUI-ListHelper.git',
}
for name, url in CUSTOM_NODES.items():
    node_dir = COMFY / 'custom_nodes' / name
    clone(url, node_dir)
    req_txt = node_dir / 'requirements.txt'
    if req_txt.exists():
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-r', str(req_txt)], check=False)

# ติดตั้งโหนดแก้บั๊ก Colab Proxy ที่แปลง %2F เป็น / ทำให้เปิดรายการ Workflow ในแถบซ้ายแล้วขึ้น 404
FIX = COMFY / 'custom_nodes' / 'colab_userdata_slash_fix'
FIX.mkdir(parents=True, exist_ok=True)
(FIX / '__init__.py').write_text(FIX_SRC, encoding='utf-8')

if (COMFY / 'manager_requirements.txt').exists():
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-r', str(COMFY / 'manager_requirements.txt')], check=True)

out = subprocess.run([sys.executable, '-c', 'import torch;print(torch.__version__, torch.version.cuda, torch.cuda.is_available())'],
                     capture_output=True, text=True)
print('✅ ติดตั้งเสร็จสมบูรณ์! PyTorch ที่ ComfyUI จะใช้งาน:', out.stdout.strip(), out.stderr[-300:])
print('👉 กรุณารันเซลล์ ② เพื่อดาวน์โหลดโมเดลให้ครบก่อนสตาร์ท ComfyUI ในเซลล์ ③')
"""
)

CELL_2 = """#@title ② ดาวน์โหลดโมเดล MiniMax H3 + ชุด Drama LoRA & ActionLogic Semantic Bridge (~41 GB)
# ⚠️ ต้องรันเซลล์นี้ให้เสร็จก่อนสตาร์ท ComfyUI ในเซลล์ ③ เพื่อไม่ให้ ComfyUI ขึ้นหน้าต่าง "Setup required" ฟ้องว่าโมเดลหาย!
USE_DRIVE_CACHE = False  #@param {type:"boolean"}
INCLUDE_DRAMA_LORAS = True  #@param {type:"boolean"}

from huggingface_hub import hf_hub_download
from pathlib import Path
from PIL import Image, ImageDraw
import shutil, time

COMFY = Path('/content/ComfyUI')
CACHE = None
if USE_DRIVE_CACHE:
    from google.colab import drive
    drive.mount('/content/drive')
    CACHE = Path('/content/drive/MyDrive/H3_models'); CACHE.mkdir(parents=True, exist_ok=True)

# สร้างภาพตัวอย่าง sample_ref.jpg ไว้ใน /content/ComfyUI/input ล่วงหน้า ताकि LoadImage ใน Workflow ไม่ฟ้องไฟล์หาย
inp_dir = COMFY / 'input'
inp_dir.mkdir(parents=True, exist_ok=True)
sample_img_path = inp_dir / 'sample_ref.jpg'
if not sample_img_path.exists():
    im = Image.new('RGB', (480, 832), color=(28, 32, 48))
    dr = ImageDraw.Draw(im)
    dr.ellipse((150, 180, 330, 360), fill=(235, 190, 145))
    dr.rectangle((120, 370, 360, 760), fill=(60, 95, 165))
    im.save(sample_img_path, quality=92)

ASSETS = 'dseditor/minimax-h3-studio-assets'
files = [
    ('OliviaRossi/Minimax-h3_Singularity-x-10Eros-Max_PRISM', 'Minimax-h3_Singularity_x_10Eros-Max_PRISM_int8.safetensors', 'diffusion_models'),
    ('Comfy-Org/MiniMax-H3', 'text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', 'text_encoders'),
    ('Comfy-Org/MiniMax-H3', 'vae/minimax_h3_video_vae_int8_convrot.safetensors', 'vae'),
    ('Comfy-Org/MiniMax-H3', 'vae/minimax_h3_audio_vae_fp32.safetensors', 'vae'),
]

if INCLUDE_DRAMA_LORAS:
    files += [
        ('larryvrh/MiniMax-H3-Turbo-Lora', 'minimax_h3_turbo_v4_step600_ema.safetensors', 'loras'),
        ('Comfy-Org/MiniMax-H3', 'loras/pika_h3_flex_ref2va_v1_bf16.safetensors', 'loras'),
    ] + [(ASSETS, f, str(Path(f).parent)) for f in [
        'loras/minimax_h3_turbo_v4_step600_ema_DasiwaREF2VAHybridV1_0_curveproj1025_compat_v001.safetensors',
        'loras/Motion_Repair.safetensors',
        'loras/H3_SPEED_slider.safetensors',
        'semantic_bridge/t8_compat/BUNNY_H3_ActionLogic_Bridge_V1_T8_Compat.safetensors',
        'latent_upscale_models/minimax_h3_latent_upscaler_3d_fp16_V2.safetensors',
    ]]

t0 = time.time()
for repo, name, folder in files:
    target = COMFY / 'models' / folder / Path(name).name
    target.parent.mkdir(parents=True, exist_ok=True)
    cached = CACHE / Path(name).name if CACHE else None
    if not target.is_file():
        if cached and cached.is_file():
            print('📂 คัดลอกจาก Google Drive:', cached.name); shutil.copy(str(cached), str(target))
        else:
            got = Path(hf_hub_download(repo_id=repo, filename=name, local_dir='/content/hf'))
            shutil.move(str(got), str(target))
    if cached and not cached.is_file():
        print('💾 สำรองไฟล์ลง Google Drive:', cached.name); shutil.copy(str(target), str(cached))
    print(f'✅ {folder:<26} {target.name[:56]:<56} {target.stat().st_size / 2**30:5.2f} GiB')

print(f'\\n🎉 ดาวน์โหลดโมเดลและชุด Drama Stack ครบทุกไฟล์ใน {(time.time() - t0) / 60:.1f} นาที! รันเซลล์ ③ เพื่อสตาร์ท ComfyUI ได้เลย')
"""

CELL_3 = (
    "#@title ③ สตาร์ท ComfyUI (ทำงานเบื้องหลัง) + ฝัง H3_Drama_MultiRef.json + ตรวจสอบความครบถ้วน (Zero Setup Required)\n"
    "DRAMA_UI_WORKFLOW = " + repr(json.dumps(ui_base, ensure_ascii=False, indent=2)) + """
import subprocess, time, urllib.request, json, sys
from pathlib import Path

COMFY = Path('/content/ComfyUI')
# ตรวจเช็คก่อนสตาร์ทว่าดาวน์โหลดโมเดลในเซลล์ ② แล้วหรือยัง
required_files = [
    COMFY / 'models' / 'diffusion_models' / 'Minimax-h3_Singularity_x_10Eros-Max_PRISM_int8.safetensors',
    COMFY / 'models' / 'text_encoders' / 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
    COMFY / 'models' / 'vae' / 'minimax_h3_video_vae_int8_convrot.safetensors',
    COMFY / 'models' / 'vae' / 'minimax_h3_audio_vae_fp32.safetensors',
]
missing_files = [str(p.name) for p in required_files if not p.is_file()]
if missing_files:
    raise RuntimeError(f'❌ ยังไม่ได้ดาวน์โหลดโมเดล ({missing_files})! กรุณารันเซลล์ ② ให้เสร็จก่อนรันเซลล์ ③ เพื่อไม่ให้ติด Setup required')

if 'server' in globals() and server.poll() is None:
    server.terminate(); server.wait(); print('🔄 ปิด ComfyUI ตัวเดิมและกำลังสตาร์ทใหม่...')

cfg = COMFY / 'user' / '__manager' / 'config.ini'
cfg.parent.mkdir(parents=True, exist_ok=True)
if not cfg.exists():
    cfg.write_text('[default]\\nsecurity_level = normal-\\n', encoding='utf-8')

wf_dir = COMFY / 'user' / 'default' / 'workflows'
wf_dir.mkdir(parents=True, exist_ok=True)
for old_f in ('H3_digital_human.json', 'H3數字人.json'):
    if (wf_dir / old_f).exists():
        (wf_dir / old_f).unlink()
(wf_dir / 'H3_Drama_MultiRef.json').write_text(DRAMA_UI_WORKFLOW, encoding='utf-8')

log = open('/content/comfyui.log', 'w')
server = subprocess.Popen(
    [sys.executable, 'main.py', '--listen', '127.0.0.1', '--port', '8188',
     '--enable-cors-header', '--enable-manager', '--enable-compress-response-body'],
    cwd=str(COMFY), stdout=log, stderr=subprocess.STDOUT
)

for i in range(180):
    try:
        urllib.request.urlopen('http://127.0.0.1:8188/system_stats', timeout=2)
        break
    except Exception:
        time.sleep(2)
else:
    print(open('/content/comfyui.log').read()[-3000:])
    raise RuntimeError('❌ ComfyUI สตาร์ทไม่สำเร็จ กรุณาดู Log ด้านบน')

# ตรวจสอบผ่าน /object_info ว่า ComfyUI มองเห็นโหนดและโมเดลทุกตัวครบ 100%
info = json.loads(urllib.request.urlopen('http://127.0.0.1:8188/object_info', timeout=20).read())
check_nodes = ['UNETLoader', 'CLIPLoader', 'VAELoader', 'MiniMaxH3ReferenceToVideo', 'BlockSparseAttention',
               'MiniMaxH3SigmaShift', 'LoraLoaderModelOnly', 'VAEDecode', 'VAEDecodeAudio', 'CreateVideo', 'SaveVideo']
missing_nodes = [n for n in check_nodes if n not in info]
unets = info.get('UNETLoader', {}).get('input', {}).get('required', {}).get('unet_name', [[]])[0]
clips = info.get('CLIPLoader', {}).get('input', {}).get('required', {}).get('clip_name', [[]])[0]
vaes = info.get('VAELoader', {}).get('input', {}).get('required', {}).get('vae_name', [[]])[0]
loras = info.get('LoraLoaderModelOnly', {}).get('input', {}).get('required', {}).get('lora_name', [[]])[0]

print('=' * 65)
print('✅ ComfyUI สตาร์ทสำเร็จ!')
print('  • โหนดหลัก H3 Drama:', 'ครบ 100%' if not missing_nodes else f'ขาด {missing_nodes}')
print('  • โมเดล UNET ในระบบ:', unets)
print('  • โมเดล CLIP ในระบบ:', clips)
print('  • โมเดล VAE ในระบบ :', vaes)
print('  • จำนวน Drama LoRA :', len(loras), 'ไฟล์')
print('  • Semantic Bridge T8:', 'พร้อมใช้งาน' if 'MiniMaxH3SemanticBridgeApplyT8' in info else 'ไม่ได้ติดตั้ง')
print('=' * 65)
"""
)

CELL_4 = """#@title ④ เปิดหน้าจอ ComfyUI (Colab Native Proxy — โมเดลครบ ไม่ติด Setup required)
# คลิกที่ลิงก์ด้านล่างเพื่อเปิดหน้าเว็บ ComfyUI ในแท็บใหม่ได้เลย
from google.colab import output
output.serve_kernel_port_as_window(8188)
"""

CELL_4B = """#@title ④-b เปิดลิงก์ Cloudflare Tunnel (สำหรับนำไปวางในเว็บ PrintFilm)
# จะสร้างลิงก์ https://xxxx.trycloudflare.com ซึ่งนำไปใส่ในช่อง ComfyUI URL ของเว็บ PrintFilm ได้เลย
import subprocess, re, time
from pathlib import Path

if not Path('/content/cloudflared').exists():
    subprocess.run(['wget', '-q', '-O', '/content/cloudflared',
                    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64'], check=True)
    subprocess.run(['chmod', '+x', '/content/cloudflared'], check=True)

if 'tun' in globals() and tun.poll() is None:
    tun.terminate(); tun.wait()
open('/content/cloudflared.log', 'w').close()
tun = subprocess.Popen(['/content/cloudflared', 'tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:8188'],
                       stdout=open('/content/cloudflared.log', 'a'), stderr=subprocess.STDOUT)
url = None
for i in range(60):
    time.sleep(1)
    m = re.search(r'https://[a-z0-9-]+\\.trycloudflare\\.com', open('/content/cloudflared.log').read())
    if m:
        url = m.group(0); break

print('=' * 65)
print('👉 ลิงก์ ComfyUI URL สำหรับวางในเว็บ PrintFilm (ปุ่ม ⚡ Colab / ComfyUI):')
print('  ', url or '❌ (ไม่ได้รับลิงก์ กรุณาตรวจดู /content/cloudflared.log)')
print('=' * 65)
"""

CELL_5 = """#@title ⑤ อัปโหลดรูปอ้างอิง 1–9 รูป (ตัวละคร, ฉาก, หรือ First/Last Frame สำหรับทดสอบใน Colab)
from google.colab import files
from IPython.display import Image as _Img, display
from pathlib import Path

COMFY = Path('/content/ComfyUI')
(COMFY / 'input').mkdir(exist_ok=True)
up = files.upload()
UPLOADED_REFS = []
for idx, (fname, data) in enumerate(up.items(), start=1):
    (COMFY / 'input' / fname).write_bytes(data)
    UPLOADED_REFS.append(fname)
    print(f'✅ <Picture {idx}> -> {fname}')
    display(_Img(data=data, width=220))
IMAGE_NAME = UPLOADED_REFS[0] if UPLOADED_REFS else 'sample_ref.jpg'
"""

CELL_6 = (
    "#@title ⑥ วาง Prompt บทละคร (6 ส่วน Ref2VA) + ตั้งค่าสัดส่วนภาพ\n"
    "import ipywidgets as W\n"
    "from IPython.display import display\n"
    "SAMPLE_PROMPT = " + repr(sample_drama_prompt) + "\n"
    """_keep = prompt_box.value if 'prompt_box' in globals() else SAMPLE_PROMPT
prompt_box = W.Textarea(value=_keep, placeholder='วาง Prompt บทละคร 6 ส่วน (subject_definitions, summary, retention_analysis, detailed_description...) ที่นี่',
                        layout=W.Layout(width='100%', height='320px'))
ratio_box = W.Dropdown(options=[('9:16 (แนวตั้ง 480x832)', '9:16'), ('16:9 (แนวนอน 832x480)', '16:9'), ('1:1 (จัตุรัส 640x640)', '1:1')],
                       value='9:16', description='สัดส่วนจอ')
dur_box = W.IntSlider(value=8, min=5, max=15, step=1, description='ความยาว (วิ)')
seed_box = W.IntText(value=-1, description='Seed (-1=สุ่ม)')
clear_btn = W.Button(description='ล้างข้อความ')
clear_btn.on_click(lambda _: setattr(prompt_box, 'value', ''))
count = W.HTML()
def _count(change=None):
    n = len(prompt_box.value.split())
    count.value = f'<b>{n}</b> คำภาษาอังกฤษ'
prompt_box.observe(_count, names='value'); _count()
display(W.VBox([W.HBox([clear_btn, count]), prompt_box, ratio_box, dur_box, seed_box]))
"""
)

CELL_7 = """#@title ⑦ สั่งเจนวิดีโอละครใน Colab (ใช้ชุด Drama LoRA + Semantic Bridge + Multi-Ref 1–9 รูป)
import json, random, time, urllib.request
from pathlib import Path
from IPython.display import Video, display

COMFY = Path('/content/ComfyUI')
PROMPT = prompt_box.value.strip()
assert PROMPT, '❌ กล่องข้อความในเซลล์ ⑥ ว่างเปล่า กรุณาใส่ Prompt ก่อน'
refs = globals().get('UPLOADED_REFS') or ([IMAGE_NAME] if 'IMAGE_NAME' in globals() else ['sample_ref.jpg'])

ratio = ratio_box.value
w, h = {'16:9': (832, 480), '9:16': (480, 832), '1:1': (640, 640)}.get(ratio, (480, 832))
dur = int(dur_box.value)
seed_val = seed_box.value if seed_box.value >= 0 else random.randint(0, 2**48)

info = json.loads(urllib.request.urlopen('http://127.0.0.1:8188/object_info', timeout=15).read())
lora_list = info.get('LoraLoaderModelOnly', {}).get('input', {}).get('required', {}).get('lora_name', [[]])[0]

wf = {
    '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'Minimax-h3_Singularity_x_10Eros-Max_PRISM_int8.safetensors', 'weight_dtype': 'default'}},
    '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', 'type': 'minimax', 'device': 'default'}},
    '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_video_vae_int8_convrot.safetensors'}},
    '4': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_audio_vae_fp32.safetensors'}},
    '56': {'class_type': 'PrimitiveInt', 'inputs': {'value': dur}},
    '58': {'class_type': 'ComfyMathExpression', 'inputs': {'expression': 'max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17', 'values.a': ['56', 0]}},
    '7': {'class_type': 'MiniMaxH3ReferenceToVideo', 'inputs': {
        'prompt': PROMPT, 'width': w, 'height': h, 'length': ['58', 1], 'ref_image_size': 'match',
        'clip': ['2', 0], 'vae': ['3', 0], 'audio_vae': ['4', 0],
    }},
    '55': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['7', 0]}},
}

for idx, fname in enumerate(refs[:9]):
    nid = str(500 + idx)
    wf[nid] = {'class_type': 'LoadImage', 'inputs': {'image': fname}}
    wf['7']['inputs'][f'ref_images.ref_image_{idx}'] = [nid, 0]

model_tail = ['1', 0]
for lid, lname, lstr in [
    ('601', 'pika_h3_flex_ref2va_v1_bf16.safetensors', 1.0),
    ('602', 'MysticXXX_MMH3-V2.safetensors', 0.35),
    ('603', 'minimax_h3_turbo_v4_step600_ema_DasiwaREF2VAHybridV1_0_curveproj1025_compat_v001.safetensors', 1.0),
]:
    if lname in lora_list:
        wf[lid] = {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': model_tail, 'lora_name': lname, 'strength_model': lstr}}
        model_tail = [lid, 0]

if 'ModelAttentionBackend' in info:
    wf['604'] = {'class_type': 'ModelAttentionBackend', 'inputs': {'attention': 'comfy kitchen attention', 'model': model_tail}}
    model_tail = ['604', 0]
if 'BlockSparseAttention' in info:
    wf['59'] = {'class_type': 'BlockSparseAttention', 'inputs': {
        'selection': 'sol-attn', 'selection.tau': 1.3, 'start_percent': 0.2, 'end_percent': 1,
        'dense_blocks': '', 'min_tokens': 12288, 'extra_tokens': 256,
        'sink_conditioning': 'exact_kv_and_rows', 'verbose': False, 'model': model_tail,
    }}
    model_tail = ['59', 0]
if 'MiniMaxH3SigmaShift' in info:
    wf['605'] = {'class_type': 'MiniMaxH3SigmaShift', 'inputs': {'shift_video': 12, 'shift_audio': 3.0, 'model': model_tail}}
    model_tail = ['605', 0]

pos_cond = ['7', 0]
if 'MiniMaxH3SemanticBridgeConfigT8' in info and 'MiniMaxH3SemanticBridgeApplyT8' in info:
    wf['606'] = {'class_type': 'MiniMaxH3SemanticBridgeConfigT8', 'inputs': {
        'model_name': 't8_compat/BUNNY_H3_ActionLogic_Bridge_V1_T8_Compat.safetensors',
        'enabled': True, 'alpha': 0.1, 'magnitude_match': 'per_token', 'token_scope': 'all_tokens', 'device': 'auto', 'chunk_tokens': 256,
    }}
    wf['607'] = {'class_type': 'MiniMaxH3SemanticBridgeApplyT8', 'inputs': {'conditioning': ['7', 0], 'semantic_bridge': ['606', 0]}}
    pos_cond = ['607', 0]

wf['54'] = {'class_type': 'KSampler', 'inputs': {
    'seed': seed_val, 'steps': 8, 'cfg': 1.0, 'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': 1.0,
    'model': model_tail, 'positive': pos_cond, 'negative': ['55', 0], 'latent_image': ['7', 1],
}}
wf['13'] = {'class_type': 'VAEDecode', 'inputs': {'samples': ['54', 0], 'vae': ['3', 0]}}
wf['14'] = {'class_type': 'VAEDecodeAudio', 'inputs': {'samples': ['54', 0], 'vae': ['4', 0]}}
wf['15'] = {'class_type': 'CreateVideo', 'inputs': {'fps': 24, 'bit_depth': 8, 'color_space': 'sRGB', 'codec': 'none', 'images': ['13', 0], 'audio': ['14', 0]}}
wf['16'] = {'class_type': 'SaveVideo', 'inputs': {'filename_prefix': 'h3_drama/shot', 'format': 'auto', 'format.codec': 'auto', 'codec': 'auto', 'video': ['15', 0]}}

req = urllib.request.Request('http://127.0.0.1:8188/prompt', data=json.dumps({'prompt': wf}).encode(), headers={'Content-Type': 'application/json'})
pid = json.loads(urllib.request.urlopen(req).read())['prompt_id']
t0 = time.time(); print(f'🚀 ส่งงานละคร (Refs={len(refs[:9])}, {w}x{h}, {dur}s, seed={seed_val}) เข้าคิวแล้ว…')
while True:
    time.sleep(8)
    h_res = json.loads(urllib.request.urlopen('http://127.0.0.1:8188/history/' + pid).read())
    if pid in h_res:
        st = h_res[pid]['status']
        if st.get('status_str') == 'error':
            print(json.dumps(st, ensure_ascii=False)[:3000]); raise RuntimeError('❌ การเจนวิดีโอล้มเหลว')
        break
    print(f'  ⏳ ผ่านไปแล้ว {int(time.time() - t0)} วินาที', end='\\r')

vids = [v for o in h_res[pid]['outputs'].values() for v in o.get('images', []) + o.get('videos', []) if v['filename'].endswith('.mp4')]
out = COMFY / 'output' / vids[0]['subfolder'] / vids[0]['filename']
print(f'\\n🎉 เสร็จสมบูรณ์ ใช้เวลา {(time.time() - t0) / 60:.1f} นาที ไฟล์อยู่ที่:', out)
display(Video(str(out), embed=True, width=640))
from google.colab import files; files.download(str(out))
"""

CELL_8 = """#@title 🔍 รันเซลล์นี้เมื่อเกิดปัญหา: ตรวจสอบสถานะ GPU, RAM และ Log ของ ComfyUI
import subprocess
print(subprocess.run(['nvidia-smi'], capture_output=True, text=True).stdout)
print(subprocess.run(['free', '-g'], capture_output=True, text=True).stdout)
log = open('/content/comfyui.log', encoding='utf-8', errors='ignore').read()
keys = ('error', 'Error', 'Traceback', 'int8', 'quant', 'fallback', 'out of memory', 'loaded', 'Prompt executed', 'IMPORT FAILED')
print('\\n'.join(l for l in log.splitlines() if any(k in l for k in keys))[-4000:])
"""

cells = [
    md(HEAD_MD),
    code(CELL_1),
    code(CELL_2),
    code(CELL_3),
    code(CELL_4),
    code(CELL_4B),
    code(CELL_5),
    code(CELL_6),
    code(CELL_7),
    code(CELL_8),
]

for i, c in enumerate(cells):
    if c["cell_type"] == "code":
        compile("".join(c["source"]), f"MiniMax_H3_Colab.ipynb:cell{i}", "exec")

nb = {
    "cells": cells,
    "metadata": {
        "accelerator": "GPU",
        "colab": {"provenance": [], "gpuType": "L4"},
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
    },
    "nbformat": 4,
    "nbformat_minor": 0,
}

out_path = Path(__file__).resolve().parent.parent / "notebooks" / "MiniMax_H3_Colab.ipynb"
io.open(out_path, "w", encoding="utf-8", newline="\n").write(json.dumps(nb, ensure_ascii=False, indent=1) + "\n")
print("[OK] Generated Zero-Setup-Required", out_path, "with", len(cells), "cells")
