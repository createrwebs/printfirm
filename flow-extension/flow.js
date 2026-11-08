// Runs on Google Flow: fills the pending PrintFilm job into the prompt box and attaches the reference images.
// shortcut: Flow's DOM is not a public contract; selectors are generic guesses. Adjust findPrompt/attach if Flow changes.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function toast(text) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#111;color:#fff;padding:10px 14px;border-radius:8px;font:13px sans-serif;max-width:320px'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 12000)
}

function findPrompt() {
  return [...document.querySelectorAll('textarea, [contenteditable="true"]')].find((e) => e.offsetParent !== null)
}

const bg = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, res))

async function toFiles(urls) {
  const files = []
  for (const [i, url] of urls.entries()) {
    const r = await bg({ action: 'fetch_image', url })
    if (!r?.ok) continue
    const blob = await (await fetch(r.dataUrl)).blob()
    files.push(new File([blob], `ref_${i + 1}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type }))
  }
  return files
}

function attach(files, promptEl) {
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  const input = document.querySelector('input[type="file"]')
  if (input) {
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return 'file-input'
  }
  promptEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  return 'paste'
}

;(async () => {
  const { printfilmFlowJob: job } = await chrome.storage.local.get('printfilmFlowJob')
  if (!job || Date.now() - job.at > 10 * 60 * 1000) return
  await chrome.storage.local.remove('printfilmFlowJob')

  let el
  for (let i = 0; i < 60 && !(el = findPrompt()); i++) await sleep(500) // wait up to 30s for the Flow editor (user may need to open a project)
  if (!el) return toast('PrintFilm: ไม่พบช่อง Prompt — เปิดโปรเจกต์ Flow แล้ววาง Prompt เอง (คัดลอกไว้ให้แล้ว)')

  el.focus()
  document.execCommand('insertText', false, job.prompt)
  await navigator.clipboard.writeText(job.prompt).catch(() => {})

  const files = await toFiles(job.refUrls || [])
  const how = files.length ? attach(files, el) : 'none'
  toast(`PrintFilm: ใส่ Prompt แล้ว, แนบภาพ ${files.length} รูป (${how}) — ตรวจแล้วกด Generate เอง`)
})()
