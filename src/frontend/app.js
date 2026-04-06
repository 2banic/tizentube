// ── CONFIG ───────────────────────────────────────────────
const API = window.location.origin;

// Tizen TV Remote-Tasten registrieren
try {
  tizen.tvinputdevice.registerKeyBatch([
    "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop",
    "MediaRewind", "MediaFastForward",
    "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue"
  ]);
} catch(e) { /* Nicht auf Tizen — ignorieren */ }

// ── STATE ────────────────────────────────────────────────
let currentProfile = null;
let currentScreen = "profiles";
let currentTab = "trending";
let sponsorSegments = [];
let overlayTimeout = null;
let currentVideoId = null;
let currentQuality = "1080";
const QUALITIES = ["1080", "720", "360"];
let focusMap = {};
let searchHistory = JSON.parse(localStorage.getItem("searchHistory") || "[]");
let tabGeneration = 0;
let sponsorSkipping = false;
let qualitySeekListener = null;

// ── SCREEN MANAGEMENT ────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + id).classList.add("active");
  currentScreen = id;
}

// ── PROFILE SCREEN ───────────────────────────────────────
async function loadProfiles(retried) {
  try {
    const res = await fetch(`${API}/profiles`);
    const profiles = await res.json();
    const grid = document.getElementById("profile-grid");
    grid.innerHTML = "";

    if (profiles.length === 0) {
      if (retried) {
        grid.innerHTML = '<div class="loading" style="color:#666">Keine Profile vorhanden.</div>';
        return;
      }
      await createDemoProfiles();
      return loadProfiles(true);
    }

    profiles.forEach((p, i) => {
      const card = document.createElement("div");
      card.className = "profile-card" + (i === 0 ? " focused" : "");
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="profile-avatar" style="background:${escapeHtml(p.avatar_color)}">
          ${escapeHtml(p.name[0].toUpperCase())}
        </div>
        <div class="profile-name">${escapeHtml(p.name)}</div>
      `;
      card.addEventListener("click", () => selectProfile(p));
      grid.appendChild(card);
    });

    focusMap["profiles"] = { items: grid.querySelectorAll(".profile-card"), index: 0 };
  } catch (err) {
    document.getElementById("profile-grid").innerHTML =
      '<div class="loading" style="color:#666">Verbindung fehlgeschlagen.</div>';
  }
}

async function createDemoProfiles() {
  const demos = [
    { name: "Person 1", avatar_color: "#1565C0" },
    { name: "Person 2", avatar_color: "#B71C1C" },
    { name: "Person 3", avatar_color: "#1B5E20" },
  ];
  for (const d of demos) {
    await fetch(`${API}/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d)
    });
  }
}

function selectProfile(profile) {
  currentProfile = profile;
  const avatar = document.getElementById("topbar-avatar");
  avatar.textContent = profile.name[0].toUpperCase();
  avatar.style.background = profile.avatar_color;
  document.getElementById("topbar-name").textContent = profile.name;
  showScreen("home");
  loadTab("trending");
}

// ── SEARCH HISTORY ───────────────────────────────────────
let searchActive = false;
let searchHistoryIndex = -1;

function addToSearchHistory(query) {
  searchHistory = searchHistory.filter(q => q !== query);
  searchHistory.unshift(query);
  searchHistory = searchHistory.slice(0, 20);
  localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
}

function showSearchHistory() {
  const dropdown = document.getElementById("search-history");
  dropdown.innerHTML = "";
  if (searchHistory.length === 0) {
    dropdown.classList.remove("visible");
    return;
  }
  searchHistory.forEach((q) => {
    const item = document.createElement("div");
    item.className = "search-history-item";
    item.textContent = q;
    item.addEventListener("click", () => {
      closeSearchHistory();
      performSearch(q);
    });
    dropdown.appendChild(item);
  });
  const clear = document.createElement("div");
  clear.className = "search-history-clear";
  clear.textContent = "Verlauf löschen";
  clear.addEventListener("click", () => {
    searchHistory = [];
    localStorage.removeItem("searchHistory");
    closeSearchHistory();
  });
  dropdown.appendChild(clear);
  dropdown.classList.add("visible");
  searchHistoryIndex = -1;
  updateSearchHistoryFocus();
}

function closeSearchHistory() {
  document.getElementById("search-history").classList.remove("visible");
  document.getElementById("search-input").blur();
  searchActive = false;
  searchHistoryIndex = -1;
}

function updateSearchHistoryFocus() {
  const items = document.querySelectorAll("#search-history .search-history-item, #search-history .search-history-clear");
  items.forEach((el, i) => el.classList.toggle("focused", i === searchHistoryIndex));
}

function activateSearch() {
  searchActive = true;
  const input = document.getElementById("search-input");
  input.classList.add("focused");
  input.focus();
  showSearchHistory();
}

function handleSearchKeydown(e) {
  const KEYS = { UP: 38, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27 };
  const allItems = document.querySelectorAll("#search-history .search-history-item, #search-history .search-history-clear");
  const maxIndex = allItems.length - 1;

  if (e.keyCode === KEYS.DOWN) {
    e.preventDefault();
    if (maxIndex >= 0) {
      searchHistoryIndex = Math.min(searchHistoryIndex + 1, maxIndex);
      updateSearchHistoryFocus();
    }
  } else if (e.keyCode === KEYS.UP) {
    e.preventDefault();
    if (searchHistoryIndex > -1) {
      searchHistoryIndex--;
      updateSearchHistoryFocus();
    }
    if (searchHistoryIndex === -1) {
      document.getElementById("search-input").focus();
    }
  } else if (e.keyCode === KEYS.ENTER) {
    e.preventDefault();
    if (searchHistoryIndex >= 0 && searchHistoryIndex <= maxIndex) {
      const el = allItems[searchHistoryIndex];
      if (el.classList.contains("search-history-clear")) {
        el.click();
      } else {
        closeSearchHistory();
        performSearch(el.textContent);
      }
    } else {
      const query = document.getElementById("search-input").value;
      if (query.trim()) {
        closeSearchHistory();
        performSearch(query);
      }
    }
  } else if (e.keyCode === KEYS.BACK || e.keyCode === KEYS.ESC) {
    e.preventDefault();
    closeSearchHistory();
  }
}

// ── HOME / TABS ──────────────────────────────────────────
async function loadTab(tab) {
  currentTab = tab;
  const gen = ++tabGeneration;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

  const area = document.getElementById("content-area");
  area.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  focusMap["home"] = null;

  try {
    if (tab === "trending") {
      const res = await fetch(`${API}/trending`);
      if (gen !== tabGeneration) return;
      if (!res.ok) throw new Error("Trending nicht verfügbar");
      const videos = await res.json();
      renderVideoGrid(videos, "Trending in Deutschland");
    } else if (tab === "subscriptions") {
      const res = await fetch(`${API}/profiles/${currentProfile.id}/subscriptions`);
      if (gen !== tabGeneration) return;
      if (!res.ok) throw new Error("Abos nicht verfügbar");
      const subs = await res.json();
      renderSubscriptions(subs);
    } else if (tab === "history") {
      const res = await fetch(`${API}/profiles/${currentProfile.id}/history`);
      if (gen !== tabGeneration) return;
      if (!res.ok) throw new Error("Verlauf nicht verfügbar");
      const history = await res.json();
      renderHistory(history);
    }
  } catch (err) {
    if (gen !== tabGeneration) return;
    area.innerHTML = `<div class="loading" style="color:#666">${escapeHtml(err.message || "Laden fehlgeschlagen.")}</div>`;
  }
}

function renderVideoGrid(videos, title) {
  const area = document.getElementById("content-area");
  area.innerHTML = `
    <div class="section-title">${escapeHtml(title)}</div>
    <div class="video-grid" id="video-grid"></div>
  `;
  const grid = document.getElementById("video-grid");
  videos.forEach((v, i) => {
    const card = document.createElement("div");
    card.className = "video-card" + (i === 0 ? " focused" : "");
    card.dataset.id = v.id;
    card.innerHTML = `
      <img class="video-thumb" src="${escapeHtml(v.thumbnail)}" onerror="this.style.display='none'">
      <div class="video-info">
        <div class="video-title">${escapeHtml(v.title) || "–"}</div>
        <div class="video-channel">${escapeHtml(v.channel)}</div>
        <div class="video-duration">${formatDuration(v.duration)}</div>
      </div>
    `;
    card.addEventListener("click", () => playVideo(v.id, v.title));
    grid.appendChild(card);
  });
  focusMap["home"] = { items: grid.querySelectorAll(".video-card"), index: 0 };
}

function renderSubscriptions(subs) {
  const area = document.getElementById("content-area");
  if (subs.length === 0) {
    area.innerHTML = `
      <div class="section-title">Deine Abonnements</div>
      <div class="loading" style="color:#666">
        Noch keine Abos. PipePipe-Export importieren!
      </div>`;
    return;
  }
  area.innerHTML = `
    <div class="section-title">Deine Abonnements</div>
    <div class="channel-list" id="channel-list"></div>
  `;
  const list = document.getElementById("channel-list");
  subs.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "channel-card" + (i === 0 ? " focused" : "");
    card.innerHTML = `
      <div class="channel-icon">${escapeHtml(s.channel_name[0]) || "?"}</div>
      <div class="channel-name">${escapeHtml(s.channel_name)}</div>
    `;
    list.appendChild(card);
  });
  focusMap["home"] = { items: list.querySelectorAll(".channel-card"), index: 0 };
}

function renderHistory(history) {
  const area = document.getElementById("content-area");
  if (history.length === 0) {
    area.innerHTML = `
      <div class="section-title">Verlauf</div>
      <div class="loading" style="color:#666">Noch keine Videos angesehen.</div>`;
    return;
  }
  area.innerHTML = `
    <div class="section-title">Verlauf</div>
    <div class="video-grid" id="video-grid"></div>
  `;
  const grid = document.getElementById("video-grid");
  history.forEach((h, i) => {
    const card = document.createElement("div");
    card.className = "video-card" + (i === 0 ? " focused" : "");
    card.dataset.id = h.video_id;
    card.innerHTML = `
      <img class="video-thumb" src="https://i.ytimg.com/vi/${escapeHtml(h.video_id)}/hqdefault.jpg" onerror="this.style.display='none'">
      <div class="video-info">
        <div class="video-title">${escapeHtml(h.video_id)}</div>
      </div>
    `;
    card.addEventListener("click", () => playVideo(h.video_id));
    grid.appendChild(card);
  });
  focusMap["home"] = { items: grid.querySelectorAll(".video-card"), index: 0 };
}

// ── PLAYER ───────────────────────────────────────────────
function cleanupPlayer() {
  const video = document.getElementById("player-video");
  video.removeEventListener("timeupdate", onTimeUpdate);
  if (qualitySeekListener) {
    video.removeEventListener("loadedmetadata", qualitySeekListener);
    qualitySeekListener = null;
  }
  clearTimeout(overlayTimeout);
  sponsorSkipping = false;
}

async function playVideo(id, title) {
  const playId = id;
  currentVideoId = id;
  cleanupPlayer();
  showScreen("player");
  document.getElementById("player-title").textContent = title || "…";
  document.getElementById("player-overlay").classList.remove("hidden");
  updateQualityButton();

  const [videoInfo, segments] = await Promise.all([
    fetch(`${API}/video/${id}?quality=${currentQuality}`).then(r => r.json()),
    fetch(`${API}/sponsorblock/${id}`).then(r => r.json()).catch(() => [])
  ]);

  // Guard: user navigated away during fetch
  if (currentVideoId !== playId || currentScreen !== "player") return;

  const video = document.getElementById("player-video");
  video.src = videoInfo.stream_url;
  document.getElementById("player-title").textContent = videoInfo.title;
  sponsorSegments = segments;

  video.play().catch(() => {
    document.getElementById("btn-playpause").textContent = "▶ Play";
  });
  video.addEventListener("timeupdate", onTimeUpdate);

  resetOverlayTimer();

  fetch(`${API}/profiles/${currentProfile.id}/history/${id}`, { method: "POST" }).catch(() => {});
}

async function changeQuality() {
  const idx = QUALITIES.indexOf(currentQuality);
  currentQuality = QUALITIES[(idx + 1) % QUALITIES.length];
  updateQualityButton();

  if (!currentVideoId) return;
  const video = document.getElementById("player-video");
  const savedTime = video.currentTime;

  // Remove previous seek listener if still pending
  if (qualitySeekListener) {
    video.removeEventListener("loadedmetadata", qualitySeekListener);
  }

  const videoInfo = await fetch(`${API}/video/${currentVideoId}?quality=${currentQuality}`).then(r => r.json());
  video.src = videoInfo.stream_url;

  qualitySeekListener = function() {
    video.currentTime = savedTime;
    video.removeEventListener("loadedmetadata", qualitySeekListener);
    qualitySeekListener = null;
  };
  video.addEventListener("loadedmetadata", qualitySeekListener);

  video.play().catch(() => {});
  resetOverlayTimer();
}

function updateQualityButton() {
  const btn = document.getElementById("btn-quality");
  if (btn) btn.textContent = `⚙ ${currentQuality}p`;
}

function onTimeUpdate() {
  if (sponsorSkipping) return;
  const video = document.getElementById("player-video");
  if (!video.duration) return;

  const pct = (video.currentTime / video.duration) * 100;
  document.getElementById("progress-fill").style.width = pct + "%";

  const banner = document.getElementById("sponsor-banner");
  const seg = sponsorSegments.find(s =>
    video.currentTime >= s.segment[0] && video.currentTime < s.segment[1]
  );
  if (seg) {
    sponsorSkipping = true;
    banner.style.display = "block";
    video.currentTime = seg.segment[1];
    setTimeout(() => { sponsorSkipping = false; }, 500);
  } else {
    banner.style.display = "none";
  }
}

function togglePlayPause() {
  const video = document.getElementById("player-video");
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
  document.getElementById("btn-playpause").textContent = video.paused ? "▶ Play" : "⏸ Pause";
  resetOverlayTimer();
}

function exitPlayer() {
  const video = document.getElementById("player-video");
  cleanupPlayer();
  video.pause();
  video.src = "";
  currentVideoId = null;
  showScreen("home");
}

function resetOverlayTimer() {
  clearTimeout(overlayTimeout);
  document.getElementById("player-overlay").classList.remove("hidden");
  overlayTimeout = setTimeout(() => {
    document.getElementById("player-overlay").classList.add("hidden");
  }, 4000);
}

// ── SEARCH ───────────────────────────────────────────────
async function performSearch(query) {
  if (!query.trim()) return;
  addToSearchHistory(query.trim());
  const gen = ++tabGeneration;
  const area = document.getElementById("content-area");
  area.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  focusMap["home"] = null;
  try {
    const videos = await fetch(`${API}/search?q=${encodeURIComponent(query)}`).then(r => r.json());
    if (gen !== tabGeneration) return;
    renderVideoGrid(videos, `Suche: "${query}"`);
  } catch (err) {
    if (gen !== tabGeneration) return;
    area.innerHTML = '<div class="loading" style="color:#666">Suche fehlgeschlagen.</div>';
  }
}

// ── D-PAD NAVIGATION ────────────────────────────────────
document.addEventListener("keydown", (e) => {
  const key = e.keyCode;

  const KEYS = {
    UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39,
    ENTER: 13, BACK: 10009,
    PLAY_PAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413,
    REWIND: 412, FAST_FORWARD: 417,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406
  };

  if (currentScreen === "profiles") {
    handleNavigation(e, "profiles", "horizontal");
  } else if (currentScreen === "home") {
    if (searchActive) {
      handleSearchKeydown(e);
      return;
    }
    if (key === KEYS.UP) {
      activateSearch();
      return;
    }
    handleNavigation(e, "home", "horizontal");
    if (key === KEYS.BACK) {
      showScreen("profiles");
    }
  } else if (currentScreen === "player") {
    const video = document.getElementById("player-video");
    // Jede Taste im Player zeigt das Overlay
    resetOverlayTimer();

    // Play/Pause: Space, Enter, Tizen MediaPlayPause/Play/Pause
    if (key === KEYS.ENTER || key === KEYS.PLAY_PAUSE || key === KEYS.PLAY || key === KEYS.PAUSE || key === 32) {
      e.preventDefault();
      togglePlayPause();
    }
    // Stop: zurück zum Home
    if (key === KEYS.STOP) { exitPlayer(); }
    // Vor/Zurück: Pfeiltasten + Tizen Rewind/FastForward
    if (key === KEYS.LEFT || key === KEYS.REWIND) { video.currentTime -= 10; }
    if (key === KEYS.RIGHT || key === KEYS.FAST_FORWARD) { video.currentTime += 10; }
    // Zurück: Escape + Tizen BACK
    if (key === KEYS.BACK || key === 27) { exitPlayer(); }
    // SponsorBlock Skip: Rote Taste
    if (key === KEYS.RED) {
      const seg = sponsorSegments.find(s => video.currentTime >= s.segment[0]);
      if (seg) video.currentTime = seg.segment[1];
    }
    // Qualitätswechsel: Grüne Taste
    if (key === KEYS.GREEN) { changeQuality(); }
  }
});

function handleNavigation(e, screen, direction) {
  const fm = focusMap[screen];
  if (!fm || !fm.items || !fm.items.length) return;
  const KEYS = { LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40, ENTER: 13 };

  const prev = fm.index;
  if ((direction === "horizontal" && e.keyCode === KEYS.RIGHT) ||
      (direction === "vertical" && e.keyCode === KEYS.DOWN)) {
    fm.index = Math.min(fm.index + 1, fm.items.length - 1);
  } else if ((direction === "horizontal" && e.keyCode === KEYS.LEFT) ||
             (direction === "vertical" && e.keyCode === KEYS.UP)) {
    fm.index = Math.max(fm.index - 1, 0);
  } else if (e.keyCode === KEYS.ENTER) {
    fm.items[fm.index].click();
    return;
  }

  if (fm.index !== prev) {
    fm.items[prev].classList.remove("focused");
    fm.items[fm.index].classList.add("focused");
    fm.items[fm.index].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

// ── HELPER ───────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDuration(secs) {
  if (!secs) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── INIT ─────────────────────────────────────────────────

// Player Buttons
document.getElementById("btn-playpause").addEventListener("click", togglePlayPause);
document.getElementById("btn-back").addEventListener("click", exitPlayer);
document.getElementById("btn-quality").addEventListener("click", changeQuality);
document.getElementById("btn-rewind").addEventListener("click", () => {
  document.getElementById("player-video").currentTime -= 10;
  resetOverlayTimer();
});
document.getElementById("btn-forward").addEventListener("click", () => {
  document.getElementById("player-video").currentTime += 10;
  resetOverlayTimer();
});

// Suchfeld
const searchInput = document.getElementById("search-input");

function submitSearch() {
  const query = searchInput.value;
  if (query.trim()) {
    closeSearchHistory();
    performSearch(query);
  }
}

searchInput.addEventListener("focus", () => {
  if (!searchActive) activateSearch();
});

// Enter-Taste im Suchfeld
searchInput.addEventListener("keydown", (e) => {
  if (e.keyCode === 13) { e.preventDefault(); submitSearch(); }
});

// Samsung TV On-Screen-Keyboard: "Done/Fertig" löst blur + change aus, kein Enter
searchInput.addEventListener("blur", () => {
  // Kurzer Delay damit closeSearchHistory nicht die Suche unterbricht
  setTimeout(() => {
    if (searchInput.value.trim() && !searchActive) {
      submitSearch();
    }
  }, 300);
});

// Suchbutton (für TV-Fernbedienung Navigation)
document.getElementById("search-btn").addEventListener("click", submitSearch);

// Player: Mausbewegung zeigt Overlay
document.getElementById("screen-player").addEventListener("mousemove", () => {
  if (currentScreen === "player") resetOverlayTimer();
});

// Player: Klick auf Video = Play/Pause
document.getElementById("player-video").addEventListener("click", togglePlayPause);

loadProfiles();
