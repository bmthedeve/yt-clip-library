const STORAGE_KEY = "yt-segment-library-state-v1";

const demoState = {
  groups: [
    { id: "g-learning", name: "Learning", tags: ["study", "reference"], color: "#2e7d72" },
    { id: "g-ideas", name: "Ideas", tags: ["creative"], color: "#b8872f" },
    { id: "g-work", name: "Work", tags: ["projects"], color: "#3d6f9f" }
  ],
  entries: [
    {
      id: "e-demo-1",
      title: "Example segment",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoId: "dQw4w9WgXcQ",
      start: 10,
      end: 40,
      groupId: "g-learning",
      tags: ["demo", "clip"],
      notes: "A sample entry showing how timestamp playback works.",
      createdAt: Date.now() - 200000
    }
  ],
  activeView: "list",
  filters: {
    query: "",
    groupId: "all",
    tag: "all"
  },
  sidebarCollapsed: false
};

let state = loadState();
let youtubeApiPromise = null;
let segmentPlayer = null;
let segmentGuard = null;
let activeSegment = null;

const $ = (selector) => document.querySelector(selector);

const els = {
  groupList: $("#groupList"),
  tagCloud: $("#tagCloud"),
  searchInput: $("#searchInput"),
  groupFilter: $("#groupFilter"),
  tagFilter: $("#tagFilter"),
  listViewBtn: $("#listViewBtn"),
  boardViewBtn: $("#boardViewBtn"),
  collapseSidebarBtn: $("#collapseSidebarBtn"),
  expandSidebarBtn: $("#expandSidebarBtn"),
  statsRow: $("#statsRow"),
  listView: $("#listView"),
  boardView: $("#boardView"),
  emptyState: $("#emptyState"),
  entryDialog: $("#entryDialog"),
  entryForm: $("#entryForm"),
  entryDialogTitle: $("#entryDialogTitle"),
  entryId: $("#entryId"),
  entryTitle: $("#entryTitle"),
  entryUrl: $("#entryUrl"),
  entryStart: $("#entryStart"),
  entryEnd: $("#entryEnd"),
  entryGroup: $("#entryGroup"),
  entryTags: $("#entryTags"),
  entryNotes: $("#entryNotes"),
  entryError: $("#entryError"),
  groupDialog: $("#groupDialog"),
  groupForm: $("#groupForm"),
  groupDialogTitle: $("#groupDialogTitle"),
  groupId: $("#groupId"),
  groupName: $("#groupName"),
  groupTags: $("#groupTags"),
  groupColor: $("#groupColor"),
  groupError: $("#groupError"),
  deleteGroupBtn: $("#deleteGroupBtn"),
  playerDialog: $("#playerDialog"),
  playerTitle: $("#playerTitle"),
  playerMeta: $("#playerMeta"),
  playerFrame: $("#playerFrame"),
  openYouTubeLink: $("#openYouTubeLink"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput")
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return cloneDefaultState();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...cloneDefaultState(),
      ...parsed,
      filters: { ...demoState.filters, ...(parsed.filters || {}) },
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
    };
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(demoState));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  saveState();
  renderFilters();
  renderSidebar();
  renderSidebarState();
  renderStats();
  renderEntries();
}

function renderFilters() {
  els.searchInput.value = state.filters.query;
  els.groupFilter.innerHTML = [
    option("all", "All groups", state.filters.groupId),
    ...state.groups.map((group) => option(group.id, group.name, state.filters.groupId))
  ].join("");

  const tags = getAllTags();
  els.tagFilter.innerHTML = [
    option("all", "All tags", state.filters.tag),
    ...tags.map((tag) => option(tag, `#${tag}`, state.filters.tag))
  ].join("");

  els.entryGroup.innerHTML = state.groups.map((group) => option(group.id, group.name, "")).join("");
  els.listViewBtn.classList.toggle("active", state.activeView === "list");
  els.boardViewBtn.classList.toggle("active", state.activeView === "board");
}

function renderSidebar() {
  const counts = countEntriesByGroup();
  els.groupList.innerHTML = state.groups.map((group) => `
    <div class="group-pill">
      <span class="group-dot" style="background:${escapeAttr(safeColor(group.color))}"></span>
      <div>
        <strong>${escapeHtml(group.name)}</strong>
        <span>${counts[group.id] || 0} segments</span>
      </div>
      <button class="icon-button" type="button" title="Edit group" data-edit-group="${group.id}">...</button>
    </div>
  `).join("");

  const tags = getAllTags();
  els.tagCloud.innerHTML = tags.length
    ? tags.map((tag) => `<button class="tag" type="button" data-filter-tag="${escapeAttr(tag)}">#${escapeHtml(tag)}</button>`).join("")
    : `<span class="meta-line">No tags yet</span>`;
}

function renderSidebarState() {
  document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  els.expandSidebarBtn.classList.toggle("hidden", !state.sidebarCollapsed);
}

function renderStats() {
  const allTags = getAllTags();
  const totalSeconds = state.entries.reduce((sum, entry) => sum + Math.max(0, entry.end - entry.start), 0);
  els.statsRow.innerHTML = `
    <div class="stat"><strong>${state.entries.length}</strong><span>segments saved</span></div>
    <div class="stat"><strong>${state.groups.length}</strong><span>groups</span></div>
    <div class="stat"><strong>${allTags.length}</strong><span>unique tags</span></div>
    <div class="stat"><strong>${formatDuration(totalSeconds)}</strong><span>curated runtime</span></div>
  `;
}

function renderEntries() {
  const entries = getFilteredEntries();
  els.listView.classList.toggle("hidden", state.activeView !== "list" || entries.length === 0);
  els.boardView.classList.toggle("hidden", state.activeView !== "board" || entries.length === 0);
  els.emptyState.classList.toggle("hidden", entries.length !== 0);

  if (state.activeView === "list") {
    els.listView.innerHTML = entries.map(renderEntryRow).join("");
  } else {
    els.boardView.innerHTML = state.groups.map((group) => {
      const groupEntries = entries.filter((entry) => entry.groupId === group.id);
      return `
        <section class="board-column">
          <div class="column-head">
            <h2>${escapeHtml(group.name)}</h2>
            <span class="tag">${groupEntries.length}</span>
          </div>
          ${groupEntries.map(renderEntryCard).join("") || `<p class="meta-line">No segments in this view.</p>`}
        </section>
      `;
    }).join("");
  }
}

function renderEntryRow(entry) {
  const group = getGroup(entry.groupId);
  return `
    <article class="entry-row">
      <div class="entry-title">
        <button class="thumb-button" type="button" title="Play segment" data-play-entry="${entry.id}">
          <img src="${escapeAttr(thumbnailSrc(entry.videoId))}" alt="" loading="lazy">
          <span class="play-badge"><span class="play-icon"></span></span>
        </button>
        <div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(formatDuration(entry.start))} to ${escapeHtml(formatDuration(entry.end))}</p>
        </div>
      </div>
      <div>
        <strong>${escapeHtml(group.name)}</strong>
        <p class="meta-line">${escapeHtml(entry.notes || "No notes")}</p>
      </div>
      <div class="entry-tags">${renderTags(entry.tags)}</div>
      <div class="entry-actions">
        <button class="secondary-action" type="button" data-edit-entry="${entry.id}">Edit</button>
        <button class="danger-action" type="button" data-delete-entry="${entry.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderEntryCard(entry) {
  const group = getGroup(entry.groupId);
  return `
    <article class="entry-card" style="--card-accent:${escapeAttr(safeColor(group.color))}">
      <button class="thumb-button wide-thumb" type="button" title="Play segment" data-play-entry="${entry.id}">
        <img src="${escapeAttr(thumbnailSrc(entry.videoId))}" alt="" loading="lazy">
        <span class="play-badge"><span class="play-icon"></span></span>
      </button>
      <div class="card-top">
        <div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(formatDuration(entry.start))} to ${escapeHtml(formatDuration(entry.end))} - ${escapeHtml(group.name)}</p>
        </div>
      </div>
      <p>${escapeHtml(entry.notes || "No notes")}</p>
      <div class="entry-tags">${renderTags(entry.tags)}</div>
      <div class="entry-actions">
        <button class="secondary-action" type="button" data-edit-entry="${entry.id}">Edit</button>
        <button class="danger-action" type="button" data-delete-entry="${entry.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderTags(tags) {
  return tags.length
    ? tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")
    : `<span class="meta-line">No tags</span>`;
}

function getFilteredEntries() {
  const query = state.filters.query.trim().toLowerCase();
  return state.entries
    .filter((entry) => state.filters.groupId === "all" || entry.groupId === state.filters.groupId)
    .filter((entry) => state.filters.tag === "all" || entry.tags.includes(state.filters.tag) || getGroup(entry.groupId).tags.includes(state.filters.tag))
    .filter((entry) => {
      if (!query) return true;
      const group = getGroup(entry.groupId);
      const haystack = [
        entry.title,
        entry.url,
        entry.notes,
        group.name,
        ...entry.tags,
        ...group.tags
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function getAllTags() {
  return [...new Set([
    ...state.groups.flatMap((group) => group.tags),
    ...state.entries.flatMap((entry) => entry.tags)
  ])].sort((a, b) => a.localeCompare(b));
}

function countEntriesByGroup() {
  return state.entries.reduce((counts, entry) => {
    counts[entry.groupId] = (counts[entry.groupId] || 0) + 1;
    return counts;
  }, {});
}

function getGroup(groupId) {
  return state.groups.find((group) => group.id === groupId) || state.groups[0];
}

function openEntryDialog(entry = null) {
  els.entryForm.reset();
  els.entryError.textContent = "";
  els.entryDialogTitle.textContent = entry ? "Edit segment" : "New segment";
  els.entryId.value = entry?.id || "";
  els.entryTitle.value = entry?.title || "";
  els.entryUrl.value = entry?.url || "";
  els.entryStart.value = entry ? formatInputTime(entry.start) : "";
  els.entryEnd.value = entry ? formatInputTime(entry.end) : "";
  els.entryGroup.value = entry?.groupId || state.groups[0].id;
  els.entryTags.value = entry?.tags.join(", ") || "";
  els.entryNotes.value = entry?.notes || "";
  els.entryDialog.showModal();
}

function saveEntry(event) {
  event.preventDefault();
  const id = els.entryId.value || createId("e");
  const videoId = extractYouTubeId(els.entryUrl.value.trim());
  const start = parseTimestamp(els.entryStart.value);
  const end = parseTimestamp(els.entryEnd.value);

  if (!videoId) {
    els.entryError.textContent = "Enter a valid YouTube URL.";
    return;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    els.entryError.textContent = "End time must be later than start time.";
    return;
  }

  const existing = state.entries.find((entry) => entry.id === id);
  const nextEntry = {
    id,
    title: els.entryTitle.value.trim(),
    url: els.entryUrl.value.trim(),
    videoId,
    start,
    end,
    groupId: els.entryGroup.value,
    tags: parseTags(els.entryTags.value),
    notes: els.entryNotes.value.trim(),
    createdAt: existing?.createdAt || Date.now()
  };

  state.entries = existing
    ? state.entries.map((entry) => entry.id === id ? nextEntry : entry)
    : [nextEntry, ...state.entries];

  els.entryDialog.close();
  render();
}

function deleteEntry(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  state.entries = state.entries.filter((item) => item.id !== entryId);
  render();
}

function openGroupDialog(group = null) {
  els.groupForm.reset();
  els.groupError.textContent = "";
  els.groupDialogTitle.textContent = group ? "Edit group" : "New group";
  els.groupId.value = group?.id || "";
  els.groupName.value = group?.name || "";
  els.groupTags.value = group?.tags.join(", ") || "";
  els.groupColor.value = group?.color || "#4f8f8a";
  els.deleteGroupBtn.classList.toggle("hidden", !group);
  els.groupDialog.showModal();
}

function saveGroup(event) {
  event.preventDefault();
  const name = els.groupName.value.trim();
  if (!name) {
    els.groupError.textContent = "Group name is required.";
    return;
  }

  const id = els.groupId.value || createId("g");
  const existing = state.groups.find((group) => group.id === id);
  const nextGroup = {
    id,
    name,
    tags: parseTags(els.groupTags.value),
    color: els.groupColor.value
  };

  state.groups = existing
    ? state.groups.map((group) => group.id === id ? nextGroup : group)
    : [...state.groups, nextGroup];

  els.groupDialog.close();
  render();
}

function deleteGroup() {
  const groupId = els.groupId.value;
  const group = getGroup(groupId);
  if (state.groups.length === 1) {
    els.groupError.textContent = "Keep at least one group.";
    return;
  }

  if (!confirm(`Delete "${group.name}" and move its segments to another group?`)) return;
  const fallbackGroup = state.groups.find((item) => item.id !== groupId);
  state.entries = state.entries.map((entry) => entry.groupId === groupId ? { ...entry, groupId: fallbackGroup.id } : entry);
  state.groups = state.groups.filter((item) => item.id !== groupId);
  els.groupDialog.close();
  render();
}

function playEntry(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;

  resetPlayer();
  activeSegment = entry;
  els.playerTitle.textContent = entry.title;
  els.playerMeta.textContent = `${formatDuration(entry.start)} to ${formatDuration(entry.end)}`;
  els.openYouTubeLink.href = buildWatchUrl(entry);
  els.playerFrame.innerHTML = `<div id="ytSegmentPlayer"></div>`;
  els.playerDialog.showModal();
  loadYouTubeApi().then(() => mountSegmentPlayer(entry));
}

function closeDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  dialog.close();
  if (dialogId === "playerDialog") {
    resetPlayer();
  }
}

function resetPlayer() {
  if (segmentGuard) {
    clearInterval(segmentGuard);
    segmentGuard = null;
  }

  if (segmentPlayer && typeof segmentPlayer.destroy === "function") {
    segmentPlayer.destroy();
  }

  segmentPlayer = null;
  activeSegment = null;
  els.playerFrame.innerHTML = "";
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "youtube-segment-library.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported.groups) || !Array.isArray(imported.entries)) {
        throw new Error("Invalid backup");
      }
      state = { ...cloneDefaultState(), ...imported, filters: demoState.filters };
      render();
    } catch {
      alert("That file does not look like a Segment Library backup.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function parseTimestamp(value) {
  const parts = String(value).trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function formatInputTime(totalSeconds) {
  return String(totalSeconds);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseTags(value) {
  return [...new Set(String(value)
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean))];
}

function buildWatchUrl(entry) {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", entry.videoId);
  url.searchParams.set("t", `${entry.start}s`);
  return url.toString();
}

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === "function") {
        previousCallback();
      }
      resolve(window.YT);
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function mountSegmentPlayer(entry) {
  if (!els.playerDialog.open || activeSegment?.id !== entry.id || !window.YT?.Player) {
    return;
  }

  const playerVars = {
    autoplay: 1,
    controls: 1,
    rel: 0,
    playsinline: 1,
    start: entry.start,
    end: entry.end
  };

  if (location.origin.startsWith("http")) {
    playerVars.origin = location.origin;
  }

  segmentPlayer = new window.YT.Player("ytSegmentPlayer", {
    width: "100%",
    height: "100%",
    videoId: entry.videoId,
    playerVars,
    events: {
      onReady: (event) => {
        event.target.loadVideoById({
          videoId: entry.videoId,
          startSeconds: entry.start,
          endSeconds: entry.end
        });
        startSegmentGuard(entry);
      },
      onStateChange: (event) => {
        if (!window.YT || !activeSegment) return;
        if (event.data === window.YT.PlayerState.ENDED) {
          resetSegmentToStart(false);
        }
        if (event.data === window.YT.PlayerState.PLAYING) {
          startSegmentGuard(entry);
        }
      }
    }
  });
}

function startSegmentGuard(entry) {
  if (segmentGuard) {
    clearInterval(segmentGuard);
  }

  segmentGuard = setInterval(() => {
    if (!segmentPlayer || activeSegment?.id !== entry.id || typeof segmentPlayer.getCurrentTime !== "function") {
      return;
    }

    const currentTime = segmentPlayer.getCurrentTime();
    if (currentTime < entry.start - 0.3 || currentTime >= entry.end - 0.15) {
      resetSegmentToStart(currentTime >= entry.end - 0.15);
    }
  }, 250);
}

function resetSegmentToStart(shouldPause) {
  if (!segmentPlayer || !activeSegment) return;
  segmentPlayer.seekTo(activeSegment.start, true);
  if (shouldPause && typeof segmentPlayer.pauseVideo === "function") {
    segmentPlayer.pauseVideo();
  }
}

function thumbnailSrc(videoId) {
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
    if (marker >= 0 && parts[marker + 1]) {
      return parts[marker + 1];
    }
  } catch {
    return "";
  }
  return "";
}

function option(value, label, selectedValue) {
  return `<option value="${escapeAttr(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : "#4f8f8a";
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, [data-close-dialog]");
  if (!target) return;

  if (target.id === "newEntryBtn") openEntryDialog();
  if (target.id === "newGroupBtn") openGroupDialog();
  if (target.id === "collapseSidebarBtn") {
    state.sidebarCollapsed = true;
    render();
  }
  if (target.id === "expandSidebarBtn") {
    state.sidebarCollapsed = false;
    render();
  }
  if (target.id === "listViewBtn") {
    state.activeView = "list";
    render();
  }
  if (target.id === "boardViewBtn") {
    state.activeView = "board";
    render();
  }
  if (target.dataset.editEntry) {
    openEntryDialog(state.entries.find((entry) => entry.id === target.dataset.editEntry));
  }
  if (target.dataset.deleteEntry) {
    deleteEntry(target.dataset.deleteEntry);
  }
  if (target.dataset.playEntry) {
    playEntry(target.dataset.playEntry);
  }
  if (target.dataset.editGroup) {
    openGroupDialog(state.groups.find((group) => group.id === target.dataset.editGroup));
  }
  if (target.dataset.filterTag) {
    state.filters.tag = target.dataset.filterTag;
    render();
  }
  if (target.dataset.closeDialog) {
    closeDialog(target.dataset.closeDialog);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const openDialogs = [...document.querySelectorAll("dialog[open]")];
  const topDialog = openDialogs.at(-1);
  if (!topDialog) return;
  event.preventDefault();
  closeDialog(topDialog.id);
}, true);

els.entryForm.addEventListener("submit", saveEntry);
els.groupForm.addEventListener("submit", saveGroup);
els.deleteGroupBtn.addEventListener("click", deleteGroup);
els.exportBtn.addEventListener("click", exportState);
els.importInput.addEventListener("change", importState);

els.searchInput.addEventListener("input", (event) => {
  state.filters.query = event.target.value;
  render();
});

els.groupFilter.addEventListener("change", (event) => {
  state.filters.groupId = event.target.value;
  render();
});

els.tagFilter.addEventListener("change", (event) => {
  state.filters.tag = event.target.value;
  render();
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(dialog.id);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog(dialog.id);
    }
  });
});

render();
