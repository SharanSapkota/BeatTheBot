# Step 10: embed

The PWA (`apps/web`) ships first. In step 10 the **same app** is embedded on kaleva.fi, and accounts are connected so a reader has the same user and points in both places.

## Widget (`apps/widget`)
- **Reuses `apps/web` components. No copy-paste.** Shared components move into a package when the widget is built, so apps never import each other (see `architecture.md`).
- Built with Vite **library mode** into one file: `dist/widget.js`.
- Mounts into a **Shadow DOM** so the host page's CSS can't break it, and ours can't break theirs.
- Reads config from the script tag:
```html
<script src="https://<host>/widget.js" data-game="<game_id>" data-lang="fi"></script>
```
- Views: the same screens as the PWA, opened for one game by its state (Before / During / After), plus Leaderboard.
- All API calls go through one `api_client.ts`, so the extension can swap the transport.
- No service worker in the embed (the PWA's offline/caching is for `apps/web` only).
- Size goal: < 150 KB gzipped. No global CSS, no global variables.

## Sign-in and account linking in the embed
- Guests can read everything. Locking in a pick or voting needs a session.
- Auth is always a Bearer header (no cookies), so the API works from kaleva.fi's domain.
- The session token is a random 32-byte value; the server stores only its hash. The widget keeps it in `localStorage` under `voita_kone_session` (extension demo: `chrome.storage.local`).
- **On kaleva.fi the widget signs in with the Kaleva identity** (`POST /auth/kaleva/callback`), so it is the **same user and points** as the PWA once the fan has connected their Kaleva account there.
- **Account linking flow** (details and test plan: `architecture.md` → Accounts):
  1. In the PWA, a device user taps **"Connect Kaleva account"** → `POST /me/identities/kaleva` adds a `kaleva` identity to the current user.
  2. If that Kaleva account already belongs to another user (e.g. they played in the embed first), the two users are **merged**: predictions/answers move to one user, points are recomputed, the empty user is deleted.
  3. From then on, PWA (device or Kaleva sign-in) and embed (Kaleva sign-in) resolve to the same user.
- Demo: if Kaleva SSO is not available, the extension uses a fake Kaleva login against our API.
- Language: MVP `fi`. Later saved in `localStorage` (`voita_kone_lang`) and on the account; default from `data-lang`, then the browser language.

## Production embedding (Kaleva's side)
- Kaleva adds the one script line to sports articles.
- The API allows only Kaleva domains in CORS.
- Login uses the Kaleva Media account (OIDC), so subscriber status is known.

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
