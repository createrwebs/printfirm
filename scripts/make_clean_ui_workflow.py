import json
import urllib.request
from pathlib import Path

url = 'https://raw.githubusercontent.com/wallen0322/ComfyUI-Wan22FMLF/main/example_workflows/Wan22FMLF-1109update.json'
ui_wf = json.loads(urllib.request.urlopen(url).read().decode('utf-8'))

# The clean FMLF 3-frame workflow nodes without Int nodes (27, 32):
# We replace Int links by baking steps directly into KSamplerAdvanced
fmlf_ids = {26, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 73}

clean_nodes = [n for n in ui_wf.get('nodes', []) if n['id'] in fmlf_ids]
# Remove links from 27 and 32 (links 57, 58, 63, 64)
clean_links = [l for l in ui_wf.get('links', []) if l[1] in fmlf_ids and l[3] in fmlf_ids and l[0] not in {57, 58, 63, 64}]

# Adjust positions so they center at 0, 0
min_x = min(n['pos'][0] for n in clean_nodes)
min_y = min(n['pos'][1] for n in clean_nodes)

for n in clean_nodes:
    n['pos'][0] -= min_x
    n['pos'][1] -= min_y

    # Fix model paths to flat filenames (avoid Windows backslash issues on Linux)
    if n['type'] == 'UNETLoader':
        val = n['widgets_values'][0]
        if 'HIGH' in val or 'high' in val:
            n['widgets_values'][0] = 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors'
        else:
            n['widgets_values'][0] = 'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors'
    elif n['type'] == 'LoraLoaderModelOnly':
        val = n['widgets_values'][0]
        if 'high' in val.lower():
            n['widgets_values'][0] = 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors'
        else:
            n['widgets_values'][0] = 'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors'
    elif n['type'] == 'CLIPLoader':
        n['widgets_values'][0] = 'umt5_xxl_fp8_e4m3fn_scaled.safetensors'
    elif n['type'] == 'VAELoader':
        n['widgets_values'][0] = 'wan2.2_vae.safetensors'
    elif n['type'] == 'LoadImage':
        # Default sample images
        if n['id'] == 41:
            n['widgets_values'] = ['start_frame.png', 'image']
        elif n['id'] == 45:
            n['widgets_values'] = ['middle_ref.png', 'image']
        elif n['id'] == 39:
            n['widgets_values'] = ['last_frame.png', 'image']
    elif n['type'] == 'KSamplerAdvanced':
        # Remove input links for steps / start_at_step / end_at_step so they use widgets
        n['inputs'] = [inp for inp in n.get('inputs', []) if inp['name'] not in {'steps', 'start_at_step', 'end_at_step'}]
        if n['id'] == 33:
            # High noise sampler: steps=5, start=0, end=3
            n['widgets_values'] = ['enable', 666, 'fixed', 5, 1.0, 'euler', 'simple', 0, 3, 'enable']
        elif n['id'] == 34:
            # Low noise sampler: steps=5, start=3, end=5
            n['widgets_values'] = ['disable', 666, 'fixed', 5, 1.0, 'euler', 'simple', 3, 5, 'disable']

clean_wf = {
    "last_node_id": max(fmlf_ids),
    "last_link_id": max(l[0] for l in clean_links),
    "nodes": clean_nodes,
    "links": clean_links,
    "groups": [],
    "config": {},
    "extra": ui_wf.get('extra', {}),
    "version": 0.4
}

print(f"Clean UI workflow: {len(clean_nodes)} nodes, {len(clean_links)} links.")
out_path = Path(__file__).resolve().parent.parent / 'backend' / 'app' / 'services' / 'assets' / 'wan2_2_fmlf_ui.json'
out_path.write_text(json.dumps(clean_wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Saved {out_path}")
