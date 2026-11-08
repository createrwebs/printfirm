const FLOW_URL = 'https://labs.google/fx/tools/flow'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'job') {
    chrome.storage.local.set({ printfilmFlowJob: msg.job }).then(() => {
      chrome.tabs.create({ url: FLOW_URL })
      sendResponse({ ok: true })
    })
    return true
  }
  if (msg.action === 'fetch_image') {
    // Background has host permission for the PrintFilm backend, so no CORS / mixed-content issue.
    fetch(msg.url)
      .then((r) => r.blob())
      .then((b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b) }))
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }
})
