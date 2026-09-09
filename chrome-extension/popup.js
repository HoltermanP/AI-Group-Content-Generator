/**
 * AI-Group Publicatie-assistent.
 * Plaatst tekst en afbeelding in de LinkedIn-composer via de extensie.
 * De gebruiker klikt zelf op "Posten".
 */

const contentEl = document.getElementById("content");

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
document.getElementById("refresh").addEventListener("click", loadPosts);

function getConfig() {
  return new Promise((resolve) => chrome.storage.sync.get(["baseUrl", "token"], resolve));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatPlanned(iso) {
  if (!iso) return "Geen geplande datum";
  const date = new Date(iso);
  const formatted = date.toLocaleString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return date <= new Date() ? `Gepland: ${formatted} — nu te plaatsen` : `Gepland: ${formatted}`;
}

async function loadPosts() {
  const { baseUrl, token } = await getConfig();
  contentEl.replaceChildren();

  if (!baseUrl || !token) {
    const box = el("div", "empty");
    box.append(
      el("p", null, "De extensie is nog niet verbonden met de app."),
      el("p", "muted", "Open de instellingen en vul de app-URL en je extensietoken in."),
    );
    contentEl.append(box);
    return;
  }

  contentEl.append(el("p", "muted center", "Laden..."));

  let data;
  try {
    const response = await fetch(`${baseUrl}/api/extension/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Token ongeldig" : `HTTP ${response.status}`);
    data = await response.json();
  } catch (err) {
    contentEl.replaceChildren(el("p", "status error center", `Kan posts niet ophalen: ${err.message}`));
    return;
  }

  contentEl.replaceChildren();
  if (data.linkedin?.organizationId) {
    const label = data.linkedin.organizationName || `bedrijfspagina ${data.linkedin.organizationId}`;
    contentEl.append(el("p", "muted center", `Posts worden geplaatst namens ${label}.`));
  }
  if (data.posts.length === 0) {
    const box = el("div", "empty");
    box.append(
      el("p", null, "Geen goedgekeurde posts die klaarstaan."),
      el("p", "muted", "Keur eerst een post goed in de app."),
    );
    contentEl.append(box);
    return;
  }

  for (const post of data.posts) {
    contentEl.append(renderPost(post, baseUrl, token));
  }
}

function renderPost(post, baseUrl, token) {
  const card = el("article", "card");
  card.append(el("h2", null, post.title));
  card.append(el("p", "muted", formatPlanned(post.scheduledAt)));

  const preview = el("p", "preview", post.body.length > 180 ? post.body.slice(0, 180) + "…" : post.body);
  card.append(preview);

  const actions = el("div", "actions");

  const publishBtn = el("button", "primary", "Plaatsen op LinkedIn");
  publishBtn.addEventListener("click", async () => {
    publishBtn.disabled = true;
    publishBtn.textContent = "LinkedIn openen…";
    try {
      await chrome.runtime.sendMessage({
        action: "PUBLISH_TO_LINKEDIN",
        payload: {
          postId: post.id,
          text: post.fullText,
          imageUrl: post.imageUrl,
          organizationId: post.organizationId ?? null,
          composerUrl: post.composerUrl ?? null,
        },
      });
      publishBtn.textContent = "LinkedIn geopend ✓";
    } catch (err) {
      publishBtn.disabled = false;
      publishBtn.textContent = "Plaatsen op LinkedIn";
      alert(`Openen mislukt: ${err.message}`);
    }
  });
  actions.append(publishBtn);

  const doneBtn = el("button", "success", "Geplaatst ✓ terugmelden");
  doneBtn.addEventListener("click", async () => {
    doneBtn.disabled = true;
    try {
      const response = await fetch(`${baseUrl}/api/extension/posts/${post.id}/mark-published`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
      }
      card.classList.add("done");
      setTimeout(loadPosts, 800);
    } catch (err) {
      doneBtn.disabled = false;
      alert(`Terugmelden mislukt: ${err.message}`);
    }
  });
  actions.append(doneBtn);

  card.append(actions);
  return card;
}

loadPosts();
