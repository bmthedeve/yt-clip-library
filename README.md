# YouTube Segment Library

YouTube Segment Library is a lightweight browser application for saving and replaying the exact moments you care about in YouTube videos.

Instead of downloading or trimming a video, the application stores its YouTube URL and your chosen timestamps. A saved video can contain one segment or several independently playable segments, making the library useful for songs, podcasts, lectures, tutorials, interviews, and other long-form content.

[Open the live application](https://bmthedeve.github.io/yt-clip-library/)

## Features

### Organize videos into groups

- The home screen presents groups as folders.
- Open a folder to view its saved videos.
- Create, edit, color-code, and delete groups.
- Assign tags to groups and individual videos.
- Use the collapsible sidebar for quick navigation.

### Save one or multiple segments

When adding a video, choose between:

- **Single segment** — save one timestamp range.
- **Multiple segments** — save several moments from the same video without duplicating its URL, thumbnail, notes, or tags.

Each segment can have:

- A required start timestamp.
- An optional end timestamp.
- An optional descriptive label.
- Its own Play button.

If no end timestamp is provided, playback starts at the saved start time and continues to the end of the video.

### Timestamp-friendly input

Supported timestamp formats include:

- `10` — ten seconds.
- `1:20` — one minute and twenty seconds.
- `01:02:03` — one hour, two minutes, and three seconds.
- `38.25` — automatically normalized to `38:25`.

### Focused playback

- Every saved segment has an adjacent Play button.
- Bounded segments stop at their saved end timestamp.
- Open-ended segments continue through the rest of the video.
- The YouTube API is preloaded for more reliable playback. If Chrome blocks playback with sound, the app starts the segment muted and offers a one-click **Play with sound** control.
- Press **Escape** to close the player dialog.
- Use **Open on YouTube** when a video does not allow embedded playback.

### Find saved moments quickly

- Search titles, URLs, notes, tags, and segment labels.
- Filter using tag chips on video entries, tag chips in the sidebar, or the tag dropdown.
- Selected sidebar tags are visibly highlighted.
- Tag filters show matching videos across all groups, in both List and Board views.
- Switch between a dense List view and a visual Board view.

### Local storage and backups

- Data is saved in the browser using `localStorage`.
- Export the complete library as a JSON backup.
- Import a previously exported JSON backup.
- Existing data from the earlier single-segment format is migrated automatically.

## Privacy and storage

The application stores metadata only:

- YouTube URLs and video IDs.
- Video titles, notes, groups, and tags.
- Segment labels and timestamps.
- Interface preferences such as the selected view and sidebar state.

Videos are not downloaded or stored by the application. Thumbnails and playback are loaded directly from YouTube.

Browser data is stored under the key:

```text
yt-segment-library-state-v1
```

Because the library is stored locally, using a different browser, browser profile, or device creates a separate library unless you export and import a backup.

## Supported YouTube links

The URL parser supports common YouTube link formats, including:

- Standard watch URLs.
- `youtu.be` shortened URLs.
- Embed URLs.
- Shorts URLs.
- Live-video URLs.

## Run locally

### Requirements

- Python 3
- A modern web browser

### Start the application

```bash
git clone https://github.com/bmthedeve/yt-clip-library.git
cd yt-clip-library
npm run dev
```

Then open:

```text
http://localhost:5173
```

The project has no runtime package dependencies. The `npm run dev` command starts Python's built-in HTTP server.

> Opening `index.html` directly may display YouTube embed error 153 because `file://` pages do not provide the HTTP origin expected by the YouTube player. Running the local server is recommended.

## Project structure

```text
.
├── index.html          # Application markup and dialogs
├── styles.css          # Layout and visual design
├── app.js              # State, rendering, validation, and playback
├── package.json        # Local development command
└── PROJECT_CONTEXT.md  # Internal implementation notes
```

## Technology

- Semantic HTML
- Plain CSS
- Vanilla JavaScript
- YouTube IFrame Player API
- Browser `localStorage`

No frontend framework, build step, database, or backend service is required.
