/**
 * Plaatst tekst en afbeelding in de LinkedIn-composer.
 * De gebruiker klikt zelf op "Posten" — er wordt niet automatisch gepubliceerd.
 */

const PENDING_KEY = "pendingPublish";
const MAX_WAIT_MS = 30_000;

chrome.storage.session.get(PENDING_KEY).then((data) => {
  const payload = data[PENDING_KEY];
  if (payload) prepareComposer(payload);
});

async function prepareComposer(payload) {
  try {
    await waitForComposer(payload.organizationId ? "organization" : "member");
    await ensureText(payload.text);
    if (payload.imageUrl) {
      await attachImage(payload.imageUrl);
    }
    showBanner("AI-Group: controleer je post en klik op Posten.");
  } catch (err) {
    showBanner(`AI-Group: ${err.message}. Plak de afbeelding handmatig (Cmd+V).`, true);
  } finally {
    await chrome.storage.session.remove(PENDING_KEY);
  }
}

/**
 * Wacht tot de composer zichtbaar is. In de beheerdersomgeving van een
 * bedrijfspagina opent de composer niet altijd vanzelf; dan klikken we op
 * "Een post maken" zodat de composer namens de pagina opent.
 */
function waitForComposer(mode = "member") {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let lastOpenAttempt = 0;
    const tick = () => {
      const editor = findComposerEditor();
      if (editor) return resolve(editor);
      const elapsed = Date.now() - start;
      if (elapsed > MAX_WAIT_MS) {
        return reject(new Error("Composer niet gevonden"));
      }
      if (mode === "organization" && elapsed > 1500 && Date.now() - lastOpenAttempt > 2500) {
        const trigger = findStartPostButton();
        if (trigger) {
          trigger.click();
          lastOpenAttempt = Date.now();
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function findStartPostButton() {
  const direct = document.querySelector("button.share-box-feed-entry__trigger");
  if (direct && isVisible(direct)) return direct;

  const labels = [
    "start a post",
    "create a post",
    "een post maken",
    "post maken",
    "maak een post",
    "bericht plaatsen",
    "begin een post",
  ];
  const buttons = document.querySelectorAll("button, [role='button']");
  for (const btn of buttons) {
    const label = (btn.getAttribute("aria-label") || btn.textContent || "").trim().toLowerCase();
    if (label && isVisible(btn) && labels.some((l) => label.includes(l))) return btn;
  }
  return null;
}

function findComposerEditor() {
  const selectors = [
    'div[data-test-modal-id="sharebox"] div[contenteditable="true"]',
    '.share-box-v2 div[contenteditable="true"]',
    'div.share-creation-state div[contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return el;
  }
  return null;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

async function ensureText(text) {
  const editor = findComposerEditor();
  if (!editor) return;
  const current = (editor.textContent || "").trim();
  if (current.length >= text.trim().length * 0.8) return;

  editor.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
}

async function attachImage(imageUrl) {
  const blob = await fetchImageBlob(imageUrl);
  const file = new File([blob], "aigroup-post.png", { type: blob.type || "image/png" });

  const input = findFileInput();
  if (input) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const mediaBtn = findMediaButton();
  if (mediaBtn) {
    mediaBtn.click();
    await sleep(500);
    const inputAfterClick = findFileInput();
    if (inputAfterClick) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputAfterClick.files = dt.files;
      inputAfterClick.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }

  throw new Error("Afbeelding kon niet automatisch worden toegevoegd");
}

function findFileInput() {
  const inputs = document.querySelectorAll('input[type="file"]');
  for (const input of inputs) {
    const accept = input.getAttribute("accept") || "";
    if (accept.includes("image") || accept === "" || accept.includes("*")) return input;
  }
  return null;
}

function findMediaButton() {
  const labels = ["Add a photo", "Add media", "Afbeelding", "Foto", "Media", "image"];
  const buttons = document.querySelectorAll("button, [role='button']");
  for (const btn of buttons) {
    const label = (btn.getAttribute("aria-label") || btn.textContent || "").toLowerCase();
    if (labels.some((l) => label.includes(l.toLowerCase()))) return btn;
  }
  return null;
}

async function fetchImageBlob(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Afbeelding ophalen mislukt");
  return response.blob();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showBanner(message, isError = false) {
  const existing = document.getElementById("aigroup-publish-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "aigroup-publish-banner";
  banner.textContent = message;
  Object.assign(banner.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "99999",
    maxWidth: "360px",
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    background: isError ? "#fef2f2" : "#ecfdf5",
    color: isError ? "#991b1b" : "#065f46",
    border: isError ? "1px solid #fecaca" : "1px solid #a7f3d0",
  });
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 12_000);
}
