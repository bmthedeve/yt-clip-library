const STORAGE_KEY = "yt-segment-library-state-v1";

const demoState = {
  groups: [
    { id: "g-learning", name: "Learning", tags: ["study", "reference"], color: "#2e7d72" },
    { id: "g-ideas", name: "Ideas", tags: ["creative"], color: "#b8872f" },
    { id: "g-work", name: "Work", tags: ["projects"], color: "#3d6f9f" }
  ],
  entries: [{
    id: "e-demo-1", title: "Example video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoId: "dQw4w9WgXcQ", groupId: "g-learning", tags: ["demo", "clip"],
    notes: "A sample video showing how timestamp playback works.", createdAt: Date.now() - 200000,
    segments: [{ id: "s-demo-1", label: "Favorite moment", start: 10, end: 40 }]
  }],
  activeView: "list", activeGroupId: null,
  filters: { query: "", tag: "all" }, sidebarCollapsed: false
};

let state = loadState();
let youtubeApiPromise = null, segmentPlayer = null, segmentGuard = null, playbackStartTimer = null, playbackNeedsSoundGesture = false, activeSegment = null;
const $ = (selector) => document.querySelector(selector);
const els = {
  groupList: $("#groupList"), tagCloud: $("#tagCloud"), searchInput: $("#searchInput"), tagFilter: $("#tagFilter"),
  listViewBtn: $("#listViewBtn"), boardViewBtn: $("#boardViewBtn"), collapseSidebarBtn: $("#collapseSidebarBtn"),
  expandSidebarBtn: $("#expandSidebarBtn"), statsRow: $("#statsRow"), folderView: $("#folderView"),
  listView: $("#listView"), boardView: $("#boardView"), emptyState: $("#emptyState"),
  groupBreadcrumb: $("#groupBreadcrumb"), activeGroupName: $("#activeGroupName"), entryDialog: $("#entryDialog"),
  entryForm: $("#entryForm"), entryDialogTitle: $("#entryDialogTitle"), entryId: $("#entryId"), entryTitle: $("#entryTitle"),
  entryUrl: $("#entryUrl"), entryGroup: $("#entryGroup"), entryTags: $("#entryTags"), entryNotes: $("#entryNotes"),
  entryError: $("#entryError"), clipTypeFieldset: $("#clipTypeFieldset"), segmentRows: $("#segmentRows"),
  addSegmentBtn: $("#addSegmentBtn"), groupDialog: $("#groupDialog"), groupForm: $("#groupForm"),
  groupDialogTitle: $("#groupDialogTitle"), groupId: $("#groupId"), groupName: $("#groupName"), groupTags: $("#groupTags"),
  groupColor: $("#groupColor"), groupColorHex: $("#groupColorHex"), groupError: $("#groupError"), deleteGroupBtn: $("#deleteGroupBtn"),
  playerDialog: $("#playerDialog"), playerTitle: $("#playerTitle"), playerMeta: $("#playerMeta"),
  playerFrame: $("#playerFrame"), openYouTubeLink: $("#openYouTubeLink"), exportBtn: $("#exportBtn"), importInput: $("#importInput"), importDropOverlay: $("#importDropOverlay")
};

function cloneDefaultState() { return JSON.parse(JSON.stringify(demoState)); }
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaultState();
  try {
    const parsed = JSON.parse(raw);
    const entries = (parsed.entries || []).map((entry) => entry.segments ? entry : ({
      ...entry, segments: [{ id: createId("s"), label: entry.title || "Saved segment", start: entry.start, end: entry.end }]
    }));
    return { ...cloneDefaultState(), ...parsed, entries, activeGroupId: null,
      filters: { query: parsed.filters?.query || "", tag: parsed.filters?.tag || "all" },
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed) };
  } catch { return cloneDefaultState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function render() {
  if (state.activeGroupId && !state.groups.some((g) => g.id === state.activeGroupId)) state.activeGroupId = null;
  saveState(); renderFilters(); renderSidebar(); renderSidebarState(); renderStats(); renderContent();
}
function renderFilters() {
  els.searchInput.value = state.filters.query;
  const tags = getAllTags();
  els.tagFilter.innerHTML = [option("all", "All tags", state.filters.tag), ...tags.map((tag) => option(tag, `#${tag}`, state.filters.tag))].join("");
  els.entryGroup.innerHTML = state.groups.map((group) => option(group.id, group.name, "")).join("");
  els.listViewBtn.classList.toggle("active", state.activeView === "list");
  els.boardViewBtn.classList.toggle("active", state.activeView === "board");
}
function renderSidebar() {
  const counts = countVideosByGroup();
  els.groupList.innerHTML = state.groups.map((group) => `
    <div class="group-pill ${state.activeGroupId === group.id ? "selected" : ""}">
      <button class="group-open" type="button" data-open-group="${group.id}">
        ${folderIcon(group.color)}<span><strong>${escapeHtml(group.name)}</strong><small>${counts[group.id] || 0} videos</small></span>
      </button>
      <button class="icon-button" type="button" title="Edit group" data-edit-group="${group.id}">...</button>
    </div>`).join("");
  const tags = getAllTags();
  els.tagCloud.innerHTML = tags.length ? tags.map((tag) => {
    const selected = state.filters.tag === tag;
    return `<button class="tag ${selected ? "is-selected" : ""}" type="button" aria-pressed="${selected}" data-filter-tag="${escapeAttr(tag)}">#${escapeHtml(tag)}</button>`;
  }).join("") : `<span class="meta-line">No tags yet</span>`;
}
function renderSidebarState() {
  document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  els.expandSidebarBtn.classList.toggle("hidden", !state.sidebarCollapsed);
}
function renderStats() {
  let visible = state.activeGroupId ? state.entries.filter((e) => e.groupId === state.activeGroupId) : state.entries;
  if (state.filters.tag !== "all") visible = visible.filter((e) => entryMatchesTag(e, state.filters.tag));
  const segments = visible.flatMap((entry) => entry.segments);
  const seconds = segments.reduce((sum, s) => Number.isFinite(s.end) ? sum + Math.max(0, s.end - s.start) : sum, 0);
  els.statsRow.innerHTML = `
    <div class="stat"><strong>${visible.length}</strong><span>${state.activeGroupId ? "videos in group" : "videos saved"}</span></div>
    <div class="stat"><strong>${segments.length}</strong><span>segments saved</span></div>
    <div class="stat"><strong>${state.groups.length}</strong><span>groups</span></div>
    <div class="stat"><strong>${formatDuration(seconds)}</strong><span>curated runtime</span></div>`;
}
function renderContent() {
  const inGroup = Boolean(state.activeGroupId);
  const showingGlobalTagResults = !inGroup && state.filters.tag !== "all";
  els.folderView.classList.toggle("hidden", inGroup || showingGlobalTagResults);
  els.groupBreadcrumb.classList.toggle("hidden", !inGroup && !showingGlobalTagResults);
  els.listView.classList.add("hidden"); els.boardView.classList.add("hidden"); els.emptyState.classList.add("hidden");
  if (!inGroup && !showingGlobalTagResults) {
    const counts = countVideosByGroup();
    els.folderView.innerHTML = state.groups.map((group) => `
      <button class="folder-card" type="button" data-open-group="${group.id}" style="--folder-color:${escapeAttr(safeColor(group.color))}">
        ${folderIcon(group.color)}
        <span class="folder-copy"><strong>${escapeHtml(group.name)}</strong><small>${counts[group.id] || 0} videos · ${countSegmentsForGroup(group.id)} segments</small></span>
        <span class="folder-arrow">›</span>
      </button>`).join("");
    return;
  }
  els.activeGroupName.textContent = inGroup ? getGroup(state.activeGroupId).name : `#${state.filters.tag} in all groups`;
  const entries = getFilteredEntries();
  if (!entries.length) { els.emptyState.classList.remove("hidden"); return; }
  if (state.activeView === "list") { els.listView.classList.remove("hidden"); els.listView.innerHTML = entries.map(renderEntryRow).join(""); }
  else { els.boardView.classList.remove("hidden"); els.boardView.innerHTML = entries.map(renderEntryCard).join(""); }
}
function renderEntryRow(entry) {
  const group = getGroup(entry.groupId);
  return `<article class="entry-row video-row">
    <div class="video-summary"><img src="${escapeAttr(thumbnailSrc(entry.videoId))}" alt="" loading="lazy"><div><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(group.name)} · ${entry.segments.length} ${entry.segments.length === 1 ? "segment" : "segments"}</p></div></div>
    <div class="segment-list">${entry.segments.map((segment) => renderSegmentItem(entry, segment)).join("")}</div>
    <div class="entry-tags">${renderTags(entry.tags)}</div>
    <div class="entry-actions"><button class="secondary-action" type="button" data-edit-entry="${entry.id}">Edit</button><button class="danger-action" type="button" data-delete-entry="${entry.id}">Delete</button></div>
  </article>`;
}
function renderEntryCard(entry) {
  const group = getGroup(entry.groupId);
  return `<article class="entry-card video-card" style="--card-accent:${escapeAttr(safeColor(group.color))}">
    <img class="video-thumbnail" src="${escapeAttr(thumbnailSrc(entry.videoId))}" alt="" loading="lazy">
    <div><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.notes || `${entry.segments.length} saved segments`)}</p></div>
    <div class="segment-list compact-list">${entry.segments.map((segment) => renderSegmentItem(entry, segment)).join("")}</div>
    <div class="entry-tags">${renderTags(entry.tags)}</div>
    <div class="entry-actions"><button class="secondary-action" type="button" data-edit-entry="${entry.id}">Edit</button><button class="danger-action" type="button" data-delete-entry="${entry.id}">Delete</button></div>
  </article>`;
}
function renderSegmentItem(entry, segment) {
  const range = Number.isFinite(segment.end) ? `${formatDuration(segment.start)} – ${formatDuration(segment.end)}` : `${formatDuration(segment.start)} – End of video`;
  return `<div class="segment-item"><div><strong>${escapeHtml(segment.label || "Untitled segment")}</strong><span>${range}</span></div><button class="segment-play" type="button" title="Play from this timestamp" data-play-entry="${entry.id}" data-play-segment="${segment.id}"><span class="play-icon"></span><span>Play</span></button></div>`;
}
function renderTags(tags) {
  return tags.length ? tags.map((tag) => {
    const selected = state.filters.tag === tag;
    return `<button class="tag ${selected ? "is-selected" : ""}" type="button" aria-pressed="${selected}" title="Show all videos tagged #${escapeAttr(tag)}" data-filter-tag="${escapeAttr(tag)}">#${escapeHtml(tag)}</button>`;
  }).join("") : `<span class="meta-line">No tags</span>`;
}
function getFilteredEntries() {
  const query = state.filters.query.trim().toLowerCase();
  return state.entries.filter((e) => !state.activeGroupId || e.groupId === state.activeGroupId)
    .filter((e) => state.filters.tag === "all" || entryMatchesTag(e, state.filters.tag))
    .filter((e) => !query || [e.title, e.url, e.notes, ...e.tags, ...e.segments.map((s) => s.label)].join(" ").toLowerCase().includes(query))
    .sort((a, b) => b.createdAt - a.createdAt);
}
function entryMatchesTag(entry, tag) { return entry.tags.includes(tag) || getGroup(entry.groupId).tags.includes(tag); }
function getAllTags() { return [...new Set([...state.groups.flatMap((g) => g.tags), ...state.entries.flatMap((e) => e.tags)])].sort((a,b) => a.localeCompare(b)); }
function countVideosByGroup() { return state.entries.reduce((c,e) => ({...c, [e.groupId]:(c[e.groupId]||0)+1}), {}); }
function countSegmentsForGroup(id) { return state.entries.filter((e) => e.groupId === id).reduce((n,e) => n + e.segments.length, 0); }
function getGroup(id) { return state.groups.find((g) => g.id === id) || state.groups[0]; }
function folderIcon(color) { return `<svg class="folder-icon" viewBox="0 0 64 52" aria-hidden="true" style="color:${escapeAttr(safeColor(color))}"><path fill="currentColor" d="M4 10a6 6 0 0 1 6-6h15l6 7h23a6 6 0 0 1 6 6v25a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10Z"/><path fill="rgba(255,255,255,.24)" d="M4 18h56v6H4z"/></svg>`; }

function openEntryDialog(entry = null) {
  els.entryForm.reset(); els.entryError.textContent = ""; els.entryDialogTitle.textContent = entry ? "Edit video" : "New video";
  els.entryId.value = entry?.id || ""; els.entryTitle.value = entry?.title || ""; els.entryUrl.value = entry?.url || "";
  els.entryGroup.value = entry?.groupId || state.activeGroupId || state.groups[0].id; els.entryTags.value = entry?.tags.join(", ") || ""; els.entryNotes.value = entry?.notes || "";
  const multiple = (entry?.segments.length || 1) > 1;
  els.entryForm.elements.clipType.value = multiple ? "multiple" : "single";
  renderSegmentInputs(entry?.segments || [{ id: createId("s"), label: "", start: "", end: "" }]);
  updateClipTypeUI(); els.entryDialog.showModal();
}
function renderSegmentInputs(segments) {
  els.segmentRows.innerHTML = segments.map((segment, index) => `
    <div class="segment-input-row" data-segment-id="${escapeAttr(segment.id || createId("s"))}">
      <span class="segment-number">${index + 1}</span>
      <label>Label<input class="segment-label" type="text" placeholder="Intro, key idea, favorite verse..." value="${escapeAttr(segment.label || "")}"></label>
      <label>Start<input class="segment-start" type="text" placeholder="1:20" value="${escapeAttr(formatInputTime(segment.start))}" required></label>
      <label>End<input class="segment-end" type="text" placeholder="End of video" value="${escapeAttr(formatInputTime(segment.end))}"></label>
      <button class="icon-button remove-segment ${segments.length === 1 ? "hidden" : ""}" type="button" title="Remove segment" data-remove-segment>×</button>
    </div>`).join("");
}
function updateClipTypeUI() {
  const multiple = els.entryForm.elements.clipType.value === "multiple";
  els.addSegmentBtn.classList.toggle("hidden", !multiple);
  if (!multiple && els.segmentRows.children.length > 1) renderSegmentInputs([readSegmentRows()[0]]);
}
function readSegmentRows() { return [...els.segmentRows.querySelectorAll(".segment-input-row")].map((row) => ({ id: row.dataset.segmentId || createId("s"), label: row.querySelector(".segment-label").value.trim(), start: row.querySelector(".segment-start").value, end: row.querySelector(".segment-end").value })); }
function addSegmentRow() { const rows = readSegmentRows(); rows.push({id:createId("s"),label:"",start:"",end:""}); renderSegmentInputs(rows); }
function saveEntry(event) {
  event.preventDefault(); const id = els.entryId.value || createId("e"); const videoId = extractYouTubeId(els.entryUrl.value.trim());
  if (!videoId) { els.entryError.textContent = "Enter a valid YouTube URL."; return; }
  const segments = readSegmentRows().map((s) => ({...s, start:parseTimestamp(s.start), end:parseOptionalTimestamp(s.end)}));
  if (!segments.length || segments.some((s) => !Number.isFinite(s.start) || (Number.isFinite(s.end) && s.end <= s.start))) { els.entryError.textContent = "Every segment needs a valid start time. If provided, the end time must be later than the start."; return; }
  const existing = state.entries.find((e) => e.id === id);
  const next = { id, title:els.entryTitle.value.trim(), url:els.entryUrl.value.trim(), videoId, groupId:els.entryGroup.value, tags:parseTags(els.entryTags.value), notes:els.entryNotes.value.trim(), segments, createdAt:existing?.createdAt || Date.now() };
  state.entries = existing ? state.entries.map((e) => e.id === id ? next : e) : [next, ...state.entries];
  state.activeGroupId = next.groupId; els.entryDialog.close(); render();
}
function deleteEntry(id) { state.entries = state.entries.filter((e) => e.id !== id); render(); }

function openGroupDialog(group=null) { els.groupForm.reset(); els.groupError.textContent=""; els.groupDialogTitle.textContent=group?"Edit group":"New group"; els.groupId.value=group?.id||""; els.groupName.value=group?.name||""; els.groupTags.value=group?.tags.join(", ")||""; const color=safeColor(group?.color||"#4f8f8a"); els.groupColor.value=color; els.groupColorHex.value=color.toUpperCase(); els.deleteGroupBtn.classList.toggle("hidden",!group); els.groupDialog.showModal(); }
function saveGroup(event) { event.preventDefault(); const name=els.groupName.value.trim(), color=normalizeHexColor(els.groupColorHex.value); if(!name){els.groupError.textContent="Group name is required.";return;} if(!color){els.groupError.textContent="Enter a valid six-digit HEX color, such as #4F8F8A.";return;} const id=els.groupId.value||createId("g"), existing=state.groups.find((g)=>g.id===id), next={id,name,tags:parseTags(els.groupTags.value),color}; state.groups=existing?state.groups.map((g)=>g.id===id?next:g):[...state.groups,next]; els.groupDialog.close(); render(); }
function deleteGroup() { const id=els.groupId.value, group=getGroup(id); if(state.groups.length===1){els.groupError.textContent="Keep at least one group.";return;} if(!confirm(`Delete "${group.name}" and move its videos to another group?`))return; const fallback=state.groups.find((g)=>g.id!==id); state.entries=state.entries.map((e)=>e.groupId===id?{...e,groupId:fallback.id}:e); state.groups=state.groups.filter((g)=>g.id!==id); state.activeGroupId=null; els.groupDialog.close(); render(); }

function playEntry(entryId, segmentId) { const entry=state.entries.find((e)=>e.id===entryId), segment=entry?.segments.find((s)=>s.id===segmentId); if(!entry||!segment)return; resetPlayer(); activeSegment={...segment,entryId}; els.playerTitle.textContent=segment.label?`${entry.title} — ${segment.label}`:entry.title; els.playerMeta.textContent=Number.isFinite(segment.end)?`${formatDuration(segment.start)} to ${formatDuration(segment.end)}`:`Starts at ${formatDuration(segment.start)} and plays to the end`; els.openYouTubeLink.href=buildWatchUrl(entry,segment); els.playerFrame.innerHTML='<div class="player-status-overlay" id="playerStatusOverlay"><span class="player-loader"></span><strong>Loading YouTube player…</strong></div><div id="ytSegmentPlayer"></div>'; els.playerDialog.showModal(); if(window.YT?.Player)mountSegmentPlayer(entry,segment);else{playbackStartTimer=setTimeout(showPlayerError,8000);loadYouTubeApi().then(()=>mountSegmentPlayer(entry,segment));} }
function closeDialog(id){const d=document.getElementById(id);d.close();if(id==="playerDialog")resetPlayer();}
function resetPlayer(){if(segmentGuard)clearInterval(segmentGuard);segmentGuard=null;if(playbackStartTimer)clearTimeout(playbackStartTimer);playbackStartTimer=null;playbackNeedsSoundGesture=false;if(segmentPlayer&&typeof segmentPlayer.destroy==="function")segmentPlayer.destroy();segmentPlayer=null;activeSegment=null;els.playerFrame.innerHTML="";}
function loadYouTubeApi(){if(window.YT?.Player)return Promise.resolve(window.YT);if(youtubeApiPromise)return youtubeApiPromise;youtubeApiPromise=new Promise((resolve)=>{const prev=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{if(typeof prev==="function")prev();resolve(window.YT);};const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";document.head.appendChild(script);});return youtubeApiPromise;}
function mountSegmentPlayer(entry,segment){if(!els.playerDialog.open||activeSegment?.id!==segment.id||!window.YT?.Player)return;if(playbackStartTimer)clearTimeout(playbackStartTimer);playbackStartTimer=null;const playerVars={autoplay:1,controls:1,rel:0,playsinline:1,start:segment.start};if(Number.isFinite(segment.end))playerVars.end=segment.end;if(location.origin.startsWith("http"))playerVars.origin=location.origin;segmentPlayer=new window.YT.Player("ytSegmentPlayer",{width:"100%",height:"100%",videoId:entry.videoId,playerVars,events:{onReady:(ev)=>{const videoOptions={videoId:entry.videoId,startSeconds:segment.start};if(Number.isFinite(segment.end))videoOptions.endSeconds=segment.end;ev.target.getIframe().tabIndex=-1;ev.target.loadVideoById(videoOptions);ev.target.playVideo();schedulePlaybackCheck(segment);startSegmentGuard(segment);},onStateChange:(ev)=>{if(!window.YT||!activeSegment)return;if(ev.data===window.YT.PlayerState.PLAYING){if(!playbackNeedsSoundGesture)hidePlayerStatus();startSegmentGuard(segment);setTimeout(keepPlayerDialogFocus,0);}if(ev.data===window.YT.PlayerState.PAUSED)setTimeout(keepPlayerDialogFocus,0);if(ev.data===window.YT.PlayerState.ENDED)resetSegmentToStart(false);},onError:()=>showPlayerError()}});}
function schedulePlaybackCheck(segment){if(playbackStartTimer)clearTimeout(playbackStartTimer);playbackStartTimer=setTimeout(()=>{if(!segmentPlayer||activeSegment?.id!==segment.id||typeof segmentPlayer.getPlayerState!=="function")return;const playerState=segmentPlayer.getPlayerState();if(![window.YT.PlayerState.PLAYING,window.YT.PlayerState.BUFFERING].includes(playerState)){playbackNeedsSoundGesture=true;segmentPlayer.mute();segmentPlayer.seekTo(segment.start,true);segmentPlayer.playVideo();showPlaybackPrompt();}},1600);}
function showPlaybackPrompt(){const overlay=$("#playerStatusOverlay");if(!overlay)return;overlay.classList.remove("hidden");overlay.innerHTML='<button class="player-start-button" type="button" data-start-playback><span class="play-icon"></span><span>Play with sound</span></button><small>Chrome blocked playback with sound. The segment is ready.</small>';}
function hidePlayerStatus(){const overlay=$("#playerStatusOverlay");if(overlay)overlay.classList.add("hidden");}
function showPlayerError(){const overlay=$("#playerStatusOverlay");if(!overlay)return;overlay.classList.remove("hidden");overlay.innerHTML='<strong>This video could not play inside the app.</strong><small>Use “Open on YouTube” below to play it at the saved timestamp.</small>';}
function startBlockedPlayback(){if(!segmentPlayer||!activeSegment)return;if(playbackStartTimer)clearTimeout(playbackStartTimer);playbackNeedsSoundGesture=false;segmentPlayer.unMute();if(typeof segmentPlayer.isMuted==="function"&&segmentPlayer.isMuted()){playbackNeedsSoundGesture=true;showPlaybackPrompt();return;}hidePlayerStatus();setTimeout(keepPlayerDialogFocus,0);}
function keepPlayerDialogFocus(){if(!els.playerDialog.open)return;const focused=document.activeElement;if(focused?.tagName==="IFRAME"||!els.playerDialog.contains(focused))els.playerDialog.focus({preventScroll:true});}
function startSegmentGuard(segment){if(segmentGuard)clearInterval(segmentGuard);segmentGuard=setInterval(()=>{if(!segmentPlayer||activeSegment?.id!==segment.id||typeof segmentPlayer.getCurrentTime!=="function")return;const time=segmentPlayer.getCurrentTime(),reachedEnd=Number.isFinite(segment.end)&&time>=segment.end-.15;if(time<segment.start-.3||reachedEnd)resetSegmentToStart(reachedEnd);},250);}
function resetSegmentToStart(pause){if(!segmentPlayer||!activeSegment)return;segmentPlayer.seekTo(activeSegment.start,true);if(pause&&typeof segmentPlayer.pauseVideo==="function")segmentPlayer.pauseVideo();}

function exportState(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="youtube-segment-library.json";link.click();URL.revokeObjectURL(url);}
function importFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const imported=JSON.parse(String(reader.result));if(!Array.isArray(imported.groups)||!Array.isArray(imported.entries))throw new Error();localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));state=loadState();render();}catch{alert("That file does not look like a Segment Library backup.");}};reader.readAsText(file);}
function importState(event){importFile(event.target.files?.[0]);event.target.value="";}
function hasDraggedFiles(event){return [...(event.dataTransfer?.types||[])].includes("Files");}
function setImportDropActive(active){document.body.classList.toggle("import-drop-active",active);els.importDropOverlay.setAttribute("aria-hidden",String(!active));}
function normalizeTimestamp(value){return String(value).trim().replace(/\./g,":");}
function parseTimestamp(value){const normalized=normalizeTimestamp(value);if(!normalized)return NaN;const parts=normalized.split(":").map(Number);if(parts.some((p)=>!Number.isFinite(p)||p<0))return NaN;return parts.reduce((t,p)=>t*60+p,0);}
function parseOptionalTimestamp(value){return normalizeTimestamp(value)?parseTimestamp(value):null;}
function formatInputTime(value){if(value===null||value===undefined||String(value).trim()==="")return "";if(typeof value==="number")return Number.isFinite(value)?formatDuration(value):"";return normalizeTimestamp(value);}
function formatDuration(total){if(!Number.isFinite(total))return "";const s=Math.max(0,Math.floor(total)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`;}
function parseTags(value){return [...new Set(String(value).split(",").map((t)=>t.trim().replace(/^#/,"").toLowerCase()).filter(Boolean))];}
function normalizeHexColor(value){const hex=String(value).trim().replace(/^#?/,"#");return /^#[0-9a-f]{6}$/i.test(hex)?hex.toLowerCase():null;}
function buildWatchUrl(entry,segment){const url=new URL("https://www.youtube.com/watch");url.searchParams.set("v",entry.videoId);url.searchParams.set("t",`${segment.start}s`);return url.toString();}
function thumbnailSrc(id){return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;}
function extractYouTubeId(url){try{const p=new URL(url);if(p.hostname.includes("youtu.be"))return p.pathname.split("/").filter(Boolean)[0]||"";if(p.searchParams.get("v"))return p.searchParams.get("v");const parts=p.pathname.split("/").filter(Boolean),i=parts.findIndex((x)=>["embed","shorts","live"].includes(x));return i>=0?parts[i+1]||"":"";}catch{return "";}}
function option(value,label,selected){return `<option value="${escapeAttr(value)}" ${value===selected?"selected":""}>${escapeHtml(label)}</option>`;}
function createId(prefix){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"})[c]);}
function escapeAttr(v){return escapeHtml(v);} function safeColor(v){return /^#[0-9a-f]{6}$/i.test(String(v))?v:"#4f8f8a";}

document.addEventListener("click",(event)=>{const target=event.target.closest("button,[data-close-dialog]");if(!target)return;
  if(target.id==="newEntryBtn")openEntryDialog(); if(target.id==="newGroupBtn")openGroupDialog();
  if(target.id==="collapseSidebarBtn"){state.sidebarCollapsed=true;render();} if(target.id==="expandSidebarBtn"){state.sidebarCollapsed=false;render();}
  if(target.id==="listViewBtn"){state.activeView="list";render();} if(target.id==="boardViewBtn"){state.activeView="board";render();}
  if(target.id==="backToGroupsBtn"){state.activeGroupId=null;state.filters.tag="all";render();} if(target.dataset.openGroup){state.activeGroupId=target.dataset.openGroup;render();}
  if(target.dataset.editEntry)openEntryDialog(state.entries.find((e)=>e.id===target.dataset.editEntry)); if(target.dataset.deleteEntry)deleteEntry(target.dataset.deleteEntry);
  if(target.dataset.playEntry)playEntry(target.dataset.playEntry,target.dataset.playSegment); if(target.dataset.editGroup)openGroupDialog(state.groups.find((g)=>g.id===target.dataset.editGroup));
  if(target.dataset.filterTag){state.filters.tag=state.filters.tag===target.dataset.filterTag?"all":target.dataset.filterTag;state.activeGroupId=null;render();} if(target.dataset.closeDialog)closeDialog(target.dataset.closeDialog);
  if(target.dataset.startPlayback!==undefined)startBlockedPlayback();
  if(target.id==="addSegmentBtn")addSegmentRow(); if(target.dataset.removeSegment!==undefined){const rows=readSegmentRows().filter((s)=>s.id!==target.closest(".segment-input-row").dataset.segmentId);renderSegmentInputs(rows);}
});
document.addEventListener("keydown",(event)=>{if(event.key!=="Escape")return;const dialog=[...document.querySelectorAll("dialog[open]")].at(-1);if(dialog){event.preventDefault();closeDialog(dialog.id);}},true);
els.entryForm.addEventListener("submit",saveEntry); els.entryForm.addEventListener("change",(e)=>{if(e.target.name==="clipType")updateClipTypeUI();});
els.segmentRows.addEventListener("input",(e)=>{if(e.target.matches(".segment-start, .segment-end")&&e.target.value.includes("."))e.target.value=e.target.value.replace(/\./g,":");});
els.groupForm.addEventListener("submit",saveGroup); els.deleteGroupBtn.addEventListener("click",deleteGroup); els.exportBtn.addEventListener("click",exportState); els.importInput.addEventListener("change",importState);
els.groupColor.addEventListener("input",()=>{els.groupColorHex.value=els.groupColor.value.toUpperCase();els.groupError.textContent="";});
els.groupColorHex.addEventListener("input",()=>{const color=normalizeHexColor(els.groupColorHex.value);if(color){els.groupColor.value=color;els.groupError.textContent="";}});
document.addEventListener("dragenter",(event)=>{if(hasDraggedFiles(event)){event.preventDefault();setImportDropActive(true);}});
document.addEventListener("dragover",(event)=>{if(hasDraggedFiles(event)){event.preventDefault();event.dataTransfer.dropEffect="copy";setImportDropActive(true);}});
document.addEventListener("dragleave",(event)=>{if(!event.relatedTarget)setImportDropActive(false);});
document.addEventListener("drop",(event)=>{if(!hasDraggedFiles(event))return;event.preventDefault();setImportDropActive(false);const files=[...(event.dataTransfer?.files||[])];if(files.length!==1){alert("Drop one Segment Library JSON backup at a time.");return;}importFile(files[0]);});
els.searchInput.addEventListener("input",(e)=>{state.filters.query=e.target.value;render();}); els.tagFilter.addEventListener("change",(e)=>{state.filters.tag=e.target.value;if(e.target.value!=="all")state.activeGroupId=null;render();});
document.querySelectorAll("dialog").forEach((dialog)=>{dialog.addEventListener("cancel",(e)=>{e.preventDefault();closeDialog(dialog.id);});dialog.addEventListener("click",(e)=>{if(e.target===dialog)closeDialog(dialog.id);});});
render();
loadYouTubeApi();
