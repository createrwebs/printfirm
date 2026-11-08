import urllib.request, json

url = 'https://raw.githubusercontent.com/wallen0322/ComfyUI-Wan22FMLF/main/example_workflows/Wan22FMLF-1109update.json'
data = urllib.request.urlopen(url).read().decode('utf-8')
wf = json.loads(data)

print(f"Total nodes: {len(wf.get('nodes', []))}")
for n in wf.get('nodes', []):
    title = n.get('_meta', {}).get('title', '') or n.get('title', '')
    print(f"ID {n['id']:2d}: {n['type']:30s} | {title}")
