# Widget and Chrome Extension

## Widget (`apps/widget`)
- React app built with Vite **library mode** into one file: `dist/widget.js`.
- Mounts into a **Shadow DOM** so the host page's CSS can't break it, and ours can't break theirs.
- Reads config from the script tag:
```html
<script src="https://<host>/widget.js" data-game="<game_id>" data-lang="fi"></script>
```
- Views: `PredictionCard` (before game), `ResultCard` (after game), `Leaderboard`.
- All API calls go through one `api_client.ts`, so the extension can swap the transport.
- Size goal: < 150 KB gzipped. No global CSS, no global variables.

## Sign-in and language in the widget
- Guests can read everything. Locking in a pick or voting opens the sign-in sheet (email → 6-digit code).
- The session token is a random 32-byte value; the server stores only its hash. The widget keeps it in `localStorage` under `voita_kone_session` (extension demo: `chrome.storage.local`) and sends it as a Bearer header.
- Language: saved in `localStorage` (`voita_kone_lang`) and on the account; default from `data-lang`, then the browser language.
- Production: prefer Kaleva Media account sign-in (SSO) so subscriber status is known; email OTP stays as the fallback.

## Production embedding (Kaleva's side)
- Kaleva adds the one script line to sports articles.
- The API allows only Kaleva domains in CORS.
- Login uses the Kaleva Media account (demo uses fake login).

## Demo site (`apps/demo_site`)
- A simple Kaleva-*style* article page on `localhost` with the widget.
- Generic look only. No Kaleva logo or copied content. Labelled "Concept demo".

## Chrome extension (`apps/extension`) — demo only
**Why an extension:** kaleva.fi may block outside scripts (CSP), and Chrome restricts public pages from calling `localhost`. An extension avoids both.

```
kaleva.fi page (my browser only)
  └─ content_script.ts → mounts widget (bundled inside the extension)
        ↕ chrome.runtime messages
  background.ts → fetch http://localhost:3000/api/v1/...
```

- `manifest.json` (MV3): `content_scripts.matches = ["https://www.kaleva.fi/*"]`, `host_permissions = ["http://localhost:3000/*"]`.
- Content script finds the article body and inserts the widget after the first paragraph. If not found, it does nothing.
- Load: `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist`.

## Rules
- The extension only changes **our own browser view**. Never publish or share it.
- Only add our widget. Don't change Kaleva content, don't bypass the paywall, don't scrape.
- Say clearly in the demo: "shown via a demo extension; in production Kaleva adds one script line."
