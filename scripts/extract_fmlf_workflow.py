import urllib.request, json

url = 'https://raw.githubusercontent.com/wallen0322/ComfyUI-Wan22FMLF/main/example_workflows/Wan22FMLF-1109update.json'
data = urllib.request.urlopen(url).read().decode('utf-8')
wf = json.loads(data)

# Let's extract the FMLF sub-graph (nodes connected around ID 73 and 26-45)
fmlf_nodes = [73, 26, 33, 34, 36, 37, 28, 30, 29, 31, 35, 38, 42, 40, 44, 39, 41, 45, 32, 27]
nodes_map = {n['id']: n for n in wf.get('nodes', []) if n['id'] in fmlf_nodes}

print(f"Extracted {len(nodes_map)} nodes for FMLF.")
for nid, n in sorted(nodes_map.items()):
    in_names = [inp.get('name') for inp in n.get('inputs', [])] if isinstance(n.get('inputs'), list) else list(n.get('inputs', {}).keys())
    print(f"ID {nid:2d}: {n['type']} -> inputs: {in_names}")
    if n.get('widgets_values'):
        print(f"     widgets: {n['widgets_values']}")
