/**
 * Luistert op de AI-Group app-pagina naar goedkeurings-events
 * en stuurt die door naar de background service worker.
 */
window.addEventListener("aigroup-linkedin-publish", (event) => {
  const detail = event.detail;
  if (!detail?.postId || !detail?.text) return;
  chrome.runtime.sendMessage({
    action: "PUBLISH_TO_LINKEDIN",
    payload: detail,
    openTab: false,
  });
});
