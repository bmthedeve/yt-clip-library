# YouTube Segment Library - Project Context

## Purpose
Build a local browser application for saving YouTube video segments without downloading the videos.

The app stores metadata only:
- YouTube URL
- Segment start timestamp
- Segment end timestamp
- Title and optional notes
- Group assignment
- Entry-level tags
- Group-level tags

When a user plays an entry, the app embeds the YouTube player at the requested start/end range.

## Current Implementation
Created a dependency-free static web app using:
- `index.html`
- `styles.css`
- `app.js`
- `package.json`

Data is stored in browser `localStorage` under the key:
- `yt-segment-library-state-v1`

No YouTube videos are downloaded or stored locally.

## Verification
- `node --check app.js` passes.
- Opened `index.html` in the in-app browser successfully.
- Confirmed list and board view toggle.
- Confirmed playback modal creates a YouTube embed URL with the saved `start` and `end` parameters, then removes the iframe when closed.
- Confirmed the new segment dialog contains URL, start, end, group, tag, and notes fields.
- Added a local server run script because YouTube embeds can fail with `Error 153` when opened from `file://`.
- Started `npm run dev` and verified `http://127.0.0.1:5173/` responds.
- Verified the localhost player iframe includes `origin=http://127.0.0.1:5173`.
- Verified the `Open on YouTube` fallback link is present in the player modal.
- Moved the new segment button from the sidebar to the top-right toolbar.
- Added Escape-key dialog closing through global keydown and dialog `cancel` handlers.
- Reworked playback to use the YouTube iframe API so replay/end behavior resets to the saved segment start.
- Browser verification: reloaded `http://127.0.0.1:5173/`, confirmed the sidebar no longer contains the new segment button, confirmed the toolbar contains it, confirmed Escape closes the player modal, and confirmed the YouTube iframe has `enablejsapi=1` with the saved `start` and `end` params.
- Removed the browser confirmation prompt from entry deletion.
- Added a Notion-like collapsible sidebar, remembered in localStorage.
- Reduced board card width/padding so cards are less bulky.
- Normalized Import/Export backup button typography.
- Browser verification: confirmed the sidebar collapse and restore buttons work, and confirmed the new segment action remains in the top toolbar.
- Moved the collapsed-sidebar restore control into the top toolbar so it does not float over board content.
- Browser verification: collapsed the sidebar and confirmed the restore control appears as a `Sidebar` button in the top toolbar, not over the board cards.
- Replaced sidebar collapse/restore text and arrow controls with hamburger menu buttons.
- Browser verification: hamburger buttons can restore and hide the sidebar after reload, with the collapsed state remembered.
- Tuned board cards toward a compact catalogue-card style: narrower max width, subtle shadow, top accent line, tighter spacing, and clamped text.
- Added cache-busting query params to `styles.css` and `app.js` in `index.html` so Chrome loads the latest card styling instead of a cached stylesheet.
- Added Bootstrap-inspired hover/focus states for action buttons: Edit turns blue, Delete turns red, both with subtle lift and shadow.

## Features Implemented
- Folder-first home screen: groups appear as folder cards and video content is only shown after opening a group.
- Group breadcrumb navigation with list and board views scoped to the open folder.
- Video-level records can contain either one segment or multiple labeled segments.
- New video form switches between a single segment and repeatable multi-segment inputs.
- Every saved segment has its own adjacent play button and bounded timestamp playback.
- Existing single-segment localStorage entries are migrated to the video-with-segments model automatically.
- Add, edit, and delete segment entries.
- Add, edit, and delete groups.
- Store tags on both groups and individual entries.
- Search by title, URL, notes, group name, group tags, and entry tags.
- Filter by group and tag.
- List view for dense scanning.
- Board view with entries grouped into columns.
- YouTube-style cards with thumbnails and play overlays.
- Click a segment card/list row to play only the saved timestamp range.
- Player modal includes an `Open on YouTube` fallback for videos that refuse iframe embedding.
- Escape closes open dialogs, including the player modal.
- Segment playback uses the YouTube iframe API and guards playback to the saved start/end range.
- Sidebar can be hidden and restored with hamburger menu buttons.
- YouTube URL parsing for normal, short, embed, and shorts URLs.
- Timestamp parsing supports formats like `10`, `1:20`, and `01:02:03`.
- Import/export JSON backup.
- Seed demo data on first load.

## Product Notes
- The app intentionally stores only references and timestamps.
- Thumbnails are loaded from YouTube image URLs; they are not saved locally.
- Segment playback uses YouTube embed URLs with `start` and `end` parameters.
- When served from `http://localhost:5173`, the embed URL includes the page origin, which is friendlier to YouTube's iframe configuration.
- The fallback YouTube link starts at the saved start timestamp. YouTube's regular watch page does not enforce the saved end timestamp.
- The first screen is the usable application, not a landing page.

## Suggested Next Improvements
- Add drag-and-drop between board columns to move entries between groups.
- Add playlist mode to play several saved segments one after another.
- Add better validation for unavailable/private videos.
- Add browser extension/share sheet support for quickly saving the current YouTube URL.
- Add optional cloud sync or a small backend if the user wants data across devices.

## How To Run
Preferred:
- Run `npm run dev`
- Open `http://localhost:5173`

Opening `index.html` directly can load the app UI, but YouTube embedded playback may show `Error 153` from `file://` origins.
