import json
from pathlib import Path

CELL1 = r'''#@title ① ติดตั้ง ComfyUI + ดาวน์โหลดโมเดล Wan 2.2 (ตรงตาม ComfyUI Hub Official 100%)
#@markdown เลือกได้ว่าจะดาวน์โหลดแบบครบชุด 2 โมเดล (High-Noise + Low-Noise ตามสเปกทางการของ Wan 2.2) หรือเอาโมเดลเดียวเพื่อประหยัดพื้นที่
DOWNLOAD_FULL_DUAL_EXPERT = True #@param {type:"boolean"}

import subprocess, sys, os, torch
from pathlib import Path

assert torch.cuda.is_available(), "ไม่พบ GPU: Runtime -> Change runtime type -> L4 หรือ A100"
print("GPU:", torch.cuda.get_device_name(0), f"({torch.cuda.get_device_properties(0).total_memory / (1024**3):.1f} GB)")

COMFY = Path("/content/ComfyUI")
if not COMFY.exists():
    print("🚀 ติดตั้ง ComfyUI...")
    subprocess.run(["git", "clone", "--depth", "1", "https://github.com/Comfy-Org/ComfyUI.git", str(COMFY)], check=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", str(COMFY / "requirements.txt")], check=True)

subprocess.run(["apt-get", "-y", "install", "-qq", "aria2"], check=True)
R = "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/"

FILES = [
    # (subdir in HF repo, ComfyUI models folder, filename)
    ("diffusion_models", "diffusion_models", "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"),
    ("loras", "loras", "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"),
    ("vae", "vae", "wan_2.1_vae.safetensors"),
    ("text_encoders", "text_encoders", "umt5_xxl_fp8_e4m3fn_scaled.safetensors"),
]

if DOWNLOAD_FULL_DUAL_EXPERT:
    FILES.extend([
        ("diffusion_models", "diffusion_models", "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors"),
        ("loras", "loras", "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"),
    ])

for sub, folder, name in FILES:
    d = COMFY / "models" / folder
    d.mkdir(parents=True, exist_ok=True)
    out = d / name
    if out.exists() and out.stat().st_size > 10_000_000:
        print(f"⏩ มีแล้ว: {name} ({out.stat().st_size / (1024**3):.2f} GB)")
        continue
    print("⬇️ กำลังโหลด:", name)
    subprocess.run(["aria2c", "--console-log-level=error", "-c", "-x", "16", "-s", "16", "-k", "1M",
                    R + sub + "/" + name, "-d", str(d), "-o", name], check=True)

print("\n✅ ดาวน์โหลดโมเดลและเตรียมพร้อมเรียบร้อย!")
'''

CELL2 = r'''#@title ② สตาร์ท ComfyUI และตรวจสถานะความพร้อม
import subprocess, sys, time, json, urllib.request
from pathlib import Path

COMFY = Path("/content/ComfyUI")
if "server_proc" in globals() and server_proc.poll() is None:
    server_proc.terminate(); server_proc.wait()

log = open("/content/comfyui.log", "w")
server_proc = subprocess.Popen([sys.executable, "main.py", "--listen", "127.0.0.1", "--port", "8188",
                                "--enable-cors-header", "*"], cwd=str(COMFY), stdout=log, stderr=subprocess.STDOUT)
for _ in range(150):
    try:
        urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=2); break
    except Exception:
        time.sleep(2)
else:
    print(open("/content/comfyui.log").read()[-3000:]); raise RuntimeError("ComfyUI ไม่ขึ้น")

info = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/object_info", timeout=30).read())
need_nodes = ["WanImageToVideo", "KSamplerAdvanced", "ModelSamplingSD3", "LoraLoaderModelOnly",
              "CreateVideo", "SaveVideo", "ImageScale", "LoadImage"]
missing = [n for n in need_nodes if n not in info]
unets = info["UNETLoader"]["input"]["required"]["unet_name"][0]
loras = info["LoraLoaderModelOnly"]["input"]["required"]["lora_name"][0]
vaes = info["VAELoader"]["input"]["required"]["vae_name"][0]
clips = info["CLIPLoader"]["input"]["required"]["clip_name"][0]

has_high = "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors" in unets
has_low = "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors" in unets

print("="*60)
print("โหนดมาตรฐานที่ตรวจสอบ:", "✅ ครบทุกโหนด" if not missing else f"❌ ขาด: {missing}")
if has_high and has_low:
    print("🌟 โหมดที่เปิดใช้งาน: Dual Expert (High Noise + Low Noise) - ตรงตาม ComfyUI Hub Official 100%")
elif has_low:
    print("⚡ โหมดที่เปิดใช้งาน: Single Model (Low Noise) - โหมดเบา ประหยัดพื้นที่ดิสก์")
else:
    print("❌ ยังไม่มีโมเดล Wan 2.2 ติดตั้ง")

assert not missing and (has_high or has_low), "ยังไม่พร้อม — กรุณารันเซลล์ ① อีกครั้ง"
print("✅ READY: ComfyUI พร้อมรับงานจากหน้าเว็บ PrintFilm 100%")
print("="*60)
'''

CELL3 = r'''#@title ③ เปิด Cloudflare Tunnel (นำ URL ไปใส่ในหน้าเว็บ PrintFilm)
import subprocess, time, re, os
from pathlib import Path

cf = Path("/content/cloudflared")
if not cf.exists():
    subprocess.run(["wget", "-q", "-O", str(cf), "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"], check=True)
    cf.chmod(0o755)
if "cf_proc" in globals() and cf_proc.poll() is None:
    cf_proc.terminate(); cf_proc.wait()
open("/content/cloudflared.log", "w").close()
cf_proc = subprocess.Popen([str(cf), "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:8188"],
                           stdout=open("/content/cloudflared.log", "a"), stderr=subprocess.STDOUT)
url = None
for _ in range(60):
    time.sleep(1)
    m = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", open("/content/cloudflared.log", errors="ignore").read())
    if m:
        url = m.group(0); break

print("="*60)
if url:
    print("🎉 Cloudflare Tunnel URL สำหรับ PrintFilm:")
    print(f"👉 {url}")
    print("\nวิธีใช้: ก๊อปปี้ลิงก์นี้ไปใส่ในหน้าเว็บ PrintFilm ช่อง 'ComfyUI URL' แล้วกด Submit Render ได้ทันที!")
else:
    print("❌ ไม่พบลำดับ URL — กรุณาดูใน /content/cloudflared.log")
print("="*60)
'''

CELL4 = r'''#@title ④ (ทางเลือก) ทดสอบเรนเดอร์ใน Colab ตรงๆ เพื่อดูผลลัพธ์
import urllib.request, json, time, os
from PIL import Image, ImageDraw

test_img_path = "/content/ComfyUI/input/test_input.jpg"
img = Image.new("RGB", (640, 640), color=(30, 40, 70))
draw = ImageDraw.Draw(img)
draw.ellipse((220, 220, 420, 420), fill=(240, 180, 80))
draw.text((250, 310), "TEST FRAME", fill=(20, 20, 20))
img.save(test_img_path)

# สร้าง Workflow ตรงตาม comfy.org 100%
info = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/object_info", timeout=30).read())
unets = info["UNETLoader"]["input"]["required"]["unet_name"][0]
is_dual = "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors" in unets

if is_dual:
    wf = {
        "84": {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "90": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},
        "95": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "96": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "101": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["95", 0], "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", "strength_model": 1.0}},
        "102": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["96", 0], "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "strength_model": 1.0}},
        "104": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["101", 0], "shift": 5.0}},
        "103": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["102", 0], "shift": 5.0}},
        "93": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["84", 0], "text": "cinematic dramatic scene, slow camera zoom"}},
        "89": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["84", 0], "text": "bad quality, blurry"}},
        "97": {"class_type": "LoadImage", "inputs": {"image": "test_input.jpg"}},
        "98": {"class_type": "WanImageToVideo", "inputs": {"positive": ["93", 0], "negative": ["89", 0], "vae": ["90", 0], "start_image": ["97", 0], "width": 640, "height": 640, "length": 81, "batch_size": 1}},
        "86": {"class_type": "KSamplerAdvanced", "inputs": {"model": ["104", 0], "add_noise": "enable", "noise_seed": 42, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["98", 0], "negative": ["98", 1], "latent_image": ["98", 2], "start_at_step": 0, "end_at_step": 2, "return_with_leftover_noise": "enable"}},
        "85": {"class_type": "KSamplerAdvanced", "inputs": {"model": ["103", 0], "add_noise": "disable", "noise_seed": 42, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["98", 0], "negative": ["98", 1], "latent_image": ["86", 0], "start_at_step": 2, "end_at_step": 4, "return_with_leftover_noise": "disable"}},
        "87": {"class_type": "VAEDecode", "inputs": {"samples": ["85", 0], "vae": ["90", 0]}},
        "94": {"class_type": "CreateVideo", "inputs": {"images": ["87", 0], "fps": 16.0}},
        "108": {"class_type": "SaveVideo", "inputs": {"video": ["94", 0], "filename_prefix": "video/test_wan2", "format": "auto", "codec": "auto"}},
    }
else:
    wf = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "strength_model": 1.0}},
        "3": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["2", 0], "shift": 5.0}},
        "4": {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 0], "text": "cinematic dramatic scene, slow camera zoom"}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 0], "text": "bad quality, blurry"}},
        "8": {"class_type": "LoadImage", "inputs": {"image": "test_input.jpg"}},
        "10": {"class_type": "WanImageToVideo", "inputs": {"positive": ["6", 0], "negative": ["7", 0], "vae": ["5", 0], "start_image": ["8", 0], "width": 640, "height": 640, "length": 81, "batch_size": 1}},
        "11": {"class_type": "KSampler", "inputs": {"model": ["3", 0], "seed": 42, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["10", 0], "negative": ["10", 1], "latent_image": ["10", 2], "denoise": 1.0}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["5", 0]}},
        "13": {"class_type": "CreateVideo", "inputs": {"images": ["12", 0], "fps": 16.0}},
        "14": {"class_type": "SaveVideo", "inputs": {"video": ["13", 0], "filename_prefix": "video/test_wan2", "format": "auto", "codec": "auto"}},
    }

req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": wf}).encode("utf-8"), headers={"Content-Type": "application/json"})
resp = json.loads(urllib.request.urlopen(req).read())
pid = resp["prompt_id"]
print(f"🚀 เริ่มส่งงานทดสอบ Prompt ID: {pid}...")

for _ in range(120):
    time.sleep(3)
    hist = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
    if pid in hist:
        entry = hist[pid]
        status = entry.get("status", {})
        if status.get("status_str") == "success":
            print("\n🎉 เรนเดอร์สำเร็จ 100%!")
            outputs = entry.get("outputs", {})
            for out in outputs.values():
                for k in ("videos", "gifs", "images"):
                    if k in out:
                        for f in out[k]:
                            print(f"📹 ได้ไฟล์วิดีโอ: {f['filename']} (ในโฟลเดอร์ {f.get('subfolder', '')})")
            break
        elif status.get("status_str") in ("error", "failed"):
            print("❌ เกิดข้อผิดพลาด:", entry.get("node_errors") or status)
            break
    print(".", end="", flush=True)
'''

def code(src):
    lines = src.strip("\n").split("\n")
    return {"cell_type": "code", "execution_count": None, "metadata": {"cellView": "form"}, "outputs": [],
            "source": [l + "\n" for l in lines[:-1]] + [lines[-1]]}

nb = {
    "cells": [
        {"cell_type": "markdown", "metadata": {}, "source": [
            "# 🎬 Wan 2.2 14B Image to Video (Official ComfyUI Core) สำหรับ PrintFilm\n",
            "สมุดงาน Colab สำหรับรัน **Wan 2.2 14B** ตรงตาม Workflow ทางการของ ComfyUI Hub (`comfy.org/hub/workflows/wan-2-2-14b-image-to-video-8c7511104c80/`)\n",
            "- **ไม่ใช้ Custom Node แปลกปลอม**: ใช้เฉพาะโหนดแกนหลักของ ComfyUI (`WanImageToVideo`, `KSamplerAdvanced`, `CreateVideo`, `SaveVideo`)\n",
            "- **รองรับทั้ง 2 โหมด**: Dual Expert (High-Noise + Low-Noise สลับ 2 สเตจด้วย 4-step LoRA) และ Single Model\n",
            "- **พร้อมเชื่อมต่อ**: รันตามลำดับ ① -> ② -> ③ แล้วนำ Cloudflare URL ไปใส่ในเว็บ PrintFilm สั่งสร้างวิดีโอได้ทันที"
        ]},
        code(CELL1), code(CELL2), code(CELL3), code(CELL4),
    ],
    "metadata": {"accelerator": "GPU", "colab": {"gpuType": "L4", "provenance": []},
                 "kernelspec": {"display_name": "Python 3", "name": "python3"}},
    "nbformat": 4, "nbformat_minor": 4,
}
out = Path(__file__).resolve().parent.parent / "notebooks" / "Wan2_2_Simple_Colab.ipynb"
out.write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", out)
