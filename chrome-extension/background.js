/**
 * Service worker: ontvangt publicatieverzoeken van de app of popup,
 * opent LinkedIn en geeft de content door aan linkedin-publisher.js.
 */

const PENDING_KEY = "pendingPublish";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "PUBLISH_TO_LINKEDIN") {
    handlePublish(message.payload, message.openTab !== false).then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function handlePublish(payload, openTab = true) {
  await chrome.storage.session.set({ [PENDING_KEY]: payload });

  if (!openTab) return { ok: true };

  // composerUrl wijst naar de beheerdersomgeving van de bedrijfspagina (post
  // namens de pagina); zonder composerUrl valt de extensie terug op de
  // persoonlijke feed-composer met voorgevulde tekst.
  const url =
    payload.composerUrl ||
    `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(payload.text)}`;
  const tabs = await chrome.tabs.query({ url: "*://*.linkedin.com/*" });

  if (tabs.length > 0 && tabs[0].id) {
    await chrome.tabs.update(tabs[0].id, { url, active: true });
  } else {
    await chrome.tabs.create({ url, active: true });
  }

  return { ok: true };
}
