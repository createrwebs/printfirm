// Runs on the PrintFilm page: relays the "send to Flow" job to the background worker and acks the page.
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'PRINTFILM_FLOW_JOB') return
  const { prompt, refUrls } = e.data
  chrome.runtime.sendMessage({ action: 'job', job: { prompt, refUrls, at: Date.now() } }, () => {
    window.postMessage({ type: 'PRINTFILM_FLOW_ACK' }, '*')
  })
})
