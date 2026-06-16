const baseUrlInput = document.getElementById("baseUrl");
const tokenInput = document.getElementById("token");
const statusEl = document.getElementById("status");

function setStatus(message, ok) {
  statusEl.textContent = message;
  statusEl.className = "status " + (ok ? "ok" : "error");
}

chrome.storage.sync.get(["baseUrl", "token"], (config) => {
  if (config.baseUrl) baseUrlInput.value = config.baseUrl;
  if (config.token) tokenInput.value = config.token;
});

document.getElementById("save").addEventListener("click", () => {
  const baseUrl = baseUrlInput.value.trim().replace(/\/+$/, "");
  const token = tokenInput.value.trim();
  if (!baseUrl || !token) {
    setStatus("Vul zowel de app-URL als het token in.", false);
    return;
  }
  chrome.storage.sync.set({ baseUrl, token }, () => setStatus("Opgeslagen.", true));
});

document.getElementById("test").addEventListener("click", async () => {
  const baseUrl = baseUrlInput.value.trim().replace(/\/+$/, "");
  const token = tokenInput.value.trim();
  if (!baseUrl || !token) {
    setStatus("Vul eerst de app-URL en het token in.", false);
    return;
  }
  setStatus("Bezig met testen...", true);
  try {
    const response = await fetch(`${baseUrl}/api/extension/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setStatus(`Verbonden. ${data.posts.length} goedgekeurde post(s) klaar voor publicatie.`, true);
    } else if (response.status === 401) {
      setStatus("Token ongeldig of ingetrokken. Genereer een nieuw token in de app.", false);
    } else {
      setStatus(`Onverwachte fout (HTTP ${response.status}).`, false);
    }
  } catch (err) {
    setStatus(`Kan de app niet bereiken: ${err.message}`, false);
  }
});
