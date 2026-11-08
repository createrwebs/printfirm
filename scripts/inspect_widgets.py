import json
import urllib.request
from pathlib import Path

url = 'https://raw.githubusercontent.com/wallen0322/ComfyUI-Wan22FMLF/main/example_workflows/Wan22FMLF-1109update.json'
ui_wf = json.loads(urllib.request.urlopen(url).read().decode('utf-8'))

links_map = {l[0]: (str(l[1]), l[2]) for l in ui_wf.get('links', [])}
fmlf_node_ids = {73, 26, 33, 34, 36, 37, 28, 30, 29, 31, 35, 38, 42, 40, 44, 39, 41, 45, 32, 27}

for n in ui_wf.get('nodes', []):
    if n['id'] in fmlf_node_ids:
        print(f"ID {n['id']} ({n['type']}):")
        print("  inputs:", [i['name'] for i in n.get('inputs', [])])
        print("  widgets_values:", n.get('widgets_values'))
        if 'widgets_values_named' in n:
            print("  widgets_values_named:", n['widgets_values_named'])
