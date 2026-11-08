import json
from pathlib import Path

# Load UI workflow
raw_ui = json.loads(Path('scripts/extract_fmlf_workflow.py').read_text(encoding='utf-8').split('json.loads(')[1].split(')')[0].strip('\'"'))
import urllib.request
url = 'https://raw.githubusercontent.com/wallen0322/ComfyUI-Wan22FMLF/main/example_workflows/Wan22FMLF-1109update.json'
ui_wf = json.loads(urllib.request.urlopen(url).read().decode('utf-8'))

# In ComfyUI UI format:
# nodes have id, type, inputs (list of {name, type, link}), widgets_values
# links is a list of [link_id, origin_id, origin_slot, target_id, target_slot, type]

links_map = {l[0]: (str(l[1]), l[2]) for l in ui_wf.get('links', [])}

# Target FMLF nodes
fmlf_node_ids = {73, 26, 33, 34, 36, 37, 28, 30, 29, 31, 35, 38, 42, 40, 44, 39, 41, 45, 32, 27}

prompt_dict = {}

for n in ui_wf.get('nodes', []):
    nid = n['id']
    if nid not in fmlf_node_ids:
        continue
    
    node_id_str = str(nid)
    ctype = n['type']
    inputs = {}
    
    # 1. Connected inputs via links
    for inp in n.get('inputs', []):
        link_id = inp.get('link')
        if link_id in links_map:
            origin_node, origin_slot = links_map[link_id]
            if int(origin_node) in fmlf_node_ids:
                inputs[inp['name']] = [origin_node, origin_slot]
                
    prompt_dict[node_id_str] = {
        "class_type": ctype,
        "inputs": inputs,
        "_meta": {"title": n.get('_meta', {}).get('title', ctype)}
    }

print(f"Built prompt_dict with {len(prompt_dict)} nodes.")
