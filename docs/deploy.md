# Deploy Voita Kaleva

Three parts, three services:

| Part | Where | What runs there |
|---|---|---|
| Database | **Neon** (Postgres 16, Frankfurt) | all data |
| API | **Render** or **Railway** (pick one), one always-on instance | `apps/api` as a Docker image (`apps/api/Dockerfile`) |
| Web app | **Vercel** | `apps/web`, static files |

Do the steps in this order. It takes about 30 minutes.

> **Secrets:** paste connection strings and keys only into the platform dashboards. Never put them in `.env.example`, in git, or in a chat.

---

## 1. Database: Neon

1. Go to <https://console.neon.tech> and click **New project**.
2. Fill in:
   - **Project name:** `voita-kaleva`
   - **Postgres version:** `16`
   - **Region:** `AWS Europe Central 1 (Frankfurt)` (`aws-eu-central-1`)
   - **Database name:** `voita_kone`
3. Click **Create project**.
4. Open **Connect** (on the project dashboard). You need **two** connection strings:
   - **Pooled** (switch **Connection pooling** ON; the host contains `-pooler`). This is `DATABASE_URL`.
   - **Direct** (switch **Connection pooling** OFF). This is `DATABASE_DIRECT_URL`.

   Both end with `?sslmode=require` (keep it: it turns on TLS). Copy them to a password manager for now.

Why two? The app uses the pooled URL (many short connections). Migrations use the direct URL, because schema changes should not go through the pooler.

Note: Neon suspends an idle compute. The API's health checks and live sync keep it awake, which uses compute hours. Check your Neon plan's limits.

---

## 2. API: Render **or** Railway

Pick **one** of the two. Both build the same Docker image from the **repo root** with `apps/api/Dockerfile`.

### Environment variables (both platforms)

| Variable | Value | Needed |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** URL | yes |
| `DATABASE_DIRECT_URL` | Neon **direct** URL | yes |
| `CORS_ALLOWED_ORIGINS` | your Vercel URL, e.g. `https://voita-kaleva.vercel.app` (comma-separated for more) | yes |
| `LIIGA_API_BASE_URL` | `https://prod.liiga-backend.liiga.fi/stats` | yes |
| `LIIGA_API_KEY` | your Liiga key (may be empty if the API works without one) | yes (can be empty) |
| `DATABASE_POOL_SIZE` | `5` | no (default 5) |
| `LOG_LEVEL` | `info` | no (default info) |
| `TRUST_PROXY_HOPS` | `1` | no (default 1 in production) |
| `LLM_API_KEY`, `LLM_MODEL` | your LLM key and model | no (empty = template texts) |
| `LLM_MAX_CALLS_PER_MINUTE` | `10` | no |
| `DEMO_REPLAY_ENABLED` | `true` only if judges should see the demo replay (`?demo=1`) | no (default off in production) |
| `FEATURED_TEAM_EXTERNAL_ID`, `LIVE_SYNC_ENABLED`, `LIVE_SYNC_INTERVAL_SECONDS`, `ROOM_QUESTIONS_SOURCE` | see `.env.example` | no (good defaults) |
| `UPLOAD_DIR` | `/data/uploads`, **only** with a persistent disk / volume (see below) | no |

Do **not** set `PORT` (the platform sets it), `NODE_ENV` (the image sets `production`), `TEST_DATABASE_URL` or the `SMTP_*` variables.

**Highlight uploads:** without `UPLOAD_DIR`, or when the folder is not writable, the highlight form takes **video links only** and tells the editor why. That is fine for the demo. To allow files, add a persistent disk / volume mounted at `/data/uploads` and set `UPLOAD_DIR=/data/uploads`. Never point `UPLOAD_DIR` at a normal folder in the container: files there are lost on every deploy.

### Option A: Render

1. Go to <https://dashboard.render.com> → **New** → **Web Service** → connect your GitHub repo.
2. Settings:
   - **Name:** `voita-kaleva-api`
   - **Language:** `Docker`
   - **Branch:** `main` (or the branch you deploy)
   - **Region:** `Frankfurt (EU Central)` (close to Neon)
   - **Root Directory:** leave empty (repo root)
   - **Dockerfile Path:** `apps/api/Dockerfile`
   - **Docker Build Context Directory:** `.`
   - **Instance Type:** `Starter` or higher. (The free type sleeps when idle, which stops live sync and jobs.)
3. **Environment Variables:** add the list above.
4. **Advanced:**
   - **Health Check Path:** `/api/v1/health`
   - **Pre-Deploy Command:** `node dist/scripts/migrate.js latest` (runs migrations before each deploy)
   - Optional disk for uploads: **Add Disk** → mount path `/data/uploads`, then set `UPLOAD_DIR=/data/uploads`.
5. Click **Create Web Service** and wait for the deploy.
6. Your API URL is `https://<name>.onrender.com`. The web app needs `https://<name>.onrender.com/api/v1`.

**Shell for step 4:** the service page → **Shell** tab.

### Option B: Railway

1. Go to <https://railway.com/new> → **Deploy from GitHub repo** → pick the repo. Railway creates a service.
2. Service → **Variables**: add the list above, plus
   - `RAILWAY_DOCKERFILE_PATH` = `apps/api/Dockerfile` (tells Railway which Dockerfile to build).
3. Service → **Settings**:
   - **Source → Root Directory:** leave empty (repo root)
   - **Deploy → Region:** `EU West (Amsterdam)`
   - **Deploy → Healthcheck Path:** `/api/v1/health`
   - **Deploy → Pre-deploy Command:** `node dist/scripts/migrate.js latest`
   - **Deploy → Serverless / App Sleeping:** OFF (the API must stay on)
   - **Deploy → Replicas:** `1` (rate limits and jobs live in one process)
   - **Networking → Public Networking → Generate Domain** (target port: leave the default; Railway sets `PORT`).
4. Optional volume for uploads: right-click the service → **Attach Volume** → mount path `/data/uploads`, then set `UPLOAD_DIR=/data/uploads`. Railway volumes are owned by root and the image runs as the `node` user, so also set `RAILWAY_RUN_UID=0`. Without that, the folder is not writable and the form stays on video links only.
5. Deploy. Your API URL is `https://<name>.up.railway.app`; the web app needs `https://<name>.up.railway.app/api/v1`.

**Shell for step 4:** install the Railway CLI, then `railway link` and `railway ssh` (opens a shell in the running service).

### Check the API

```
curl https://<your-api>/api/v1/health
```

Expected: `{"data":{"status":"ok","database":"ok","time":"…"}}`. A `503 DATABASE_UNAVAILABLE` means the API can't reach Neon: check `DATABASE_URL`.

---

## 3. Web: Vercel

1. Go to <https://vercel.com/new> → import the GitHub repo.
2. Settings:
   - **Project name:** `voita-kaleva` (your URL becomes `https://voita-kaleva.vercel.app`)
   - **Root Directory:** `apps/web`
   - **Framework Preset:** `Vite`
   - **Build Command / Install Command / Output Directory:** leave as they are. `apps/web/vercel.json` sets them (`pnpm build`, `dist`).
3. **Environment Variables** (for Production and Preview):

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<your-api>/api/v1` (**required**, must be https; the build fails without it) |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` (Vercel then uses the pnpm version from `package.json`) |
   | `VITE_DEMO_MODE` | `true` only to always show the demo replay; else leave it out |

4. Click **Deploy**.
5. After the first deploy: **Settings → Build and Deployment → Node.js Version** → `24.x`, then redeploy.

What `vercel.json` does:
- Every app route (`/games`, `/rooms/join/ABC123`, …) serves `index.html`, so deep links and refresh work. Missing files under `/assets/` stay a real 404.
- `index.html`, `sw.js`, `registerSW.js` and the manifest are never cached for long, so a new deploy reaches users at once. The hashed files in `/assets/` are cached for a year (`immutable`).

**CORS:** the API only answers the origins in `CORS_ALLOWED_ORIGINS`. If your Vercel URL is not exactly what you put there, update the variable on Render/Railway (redeploys the API). Vercel **preview** URLs are different and won't work unless you add them too.

---

## 4. One-time setup (run once)

`setup:prod` does three things, and is safe to run again:
1. migrations (on `DATABASE_DIRECT_URL`)
2. Liiga sync from the real Liiga API, then the model and scoring
3. demo data (sample football/basketball, demo election, demo room `DEMO26`), **only while the database has no users**. The demo seed recreates all users, so once anyone has signed in, it is skipped.

So run it **before** you or anyone signs in.

**In the API shell** (Render Shell tab, or `railway ssh`):

```
cd /app/apps/api
pnpm --filter api setup:prod
```

You should see `1/3 …`, `2/3 …`, `3/3 …` and `Setup done.`

**Or from your laptop** (uses the same code; put the Neon URLs in your shell, not in a file):

```
pnpm install
pnpm --filter api build
export DATABASE_URL='<Neon pooled URL>'
export DATABASE_DIRECT_URL='<Neon direct URL>'
pnpm --filter api setup:prod
```

(Shell variables win over your local `.env`. Run `unset DATABASE_URL DATABASE_DIRECT_URL` when done.)

### Make yourself admin

1. Open the web app, make a pick and sign in with your name.
2. Open `https://<your-web>/admin`. As a normal user you see **"Your user id: …"**. Copy it.
3. In the API shell:
   ```
   cd /app/apps/api
   pnpm --filter api make:admin:prod -- --user_id <your id>
   ```
   From your laptop (with `DATABASE_URL` exported as above): `pnpm --filter api make:admin -- --user_id <your id>`.
4. Reload `/admin`: you now see the admin tabs.

Editors work the same way with `make:editor:prod` / `make:editor`.

---

## 5. Smoke test

Do this on a phone and on a desktop browser.

- [ ] **Health:** `curl https://<your-api>/api/v1/health` → `status: ok`, `database: ok`.
- [ ] **Logs:** the API logs are JSON lines; you see `API listening on /api/v1` and no `Authorization` values (they show `[redacted]`).
- [ ] **Games hub:** `/games` shows today's Liiga games, or LATEST RESULTS and COMING UP on a day without games. The sport tabs (hockey, football, basketball) switch.
- [ ] **A game:** open an upcoming game → AI preview (or "Preview coming soon") and "Data says"; make picks; "Lock in my picks" asks for your name once.
- [ ] **Deep link:** reload the browser on `/games/<id>` → the page loads (no 404).
- [ ] **Elections:** `/elections` shows the demo election with a "Demo" badge; you can make a pick.
- [ ] **Rooms:** `/rooms` → join with key `DEMO26` → the current question and the scoreboard show.
- [ ] **Leaders:** `/leaders` shows the Games and Elections tabs with the demo fans.
- [ ] **Admin:** `/admin` shows Elections, Matches and Stories (as admin). As a normal user it shows 403 with your user id.
- [ ] **Rate limit uses the real IP:** sign in from two different networks (e.g. Wi-Fi and phone data); both work.
- [ ] **CORS:** the browser console shows no CORS errors.
- [ ] **PWA install:** Chrome on Android / desktop offers "Install app"; iOS Safari: Share → Add to Home Screen opens full screen. *Until roadmap step 13 (manifest, icons, service worker) is done, this check is expected to fail; the rest of the app works without it.*

## Updating

Push to the deployed branch. Render/Railway rebuild the image, run the pre-deploy migration and swap the instance (the old one shuts down gracefully: it stops live sync and jobs, finishes running work and closes the database pool). Vercel rebuilds the web app.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Vercel build fails: `VITE_API_BASE_URL is not set` / `must use https://` | Set `VITE_API_BASE_URL` in Vercel (Production and Preview) to `https://<your-api>/api/v1`, redeploy. |
| Vercel install fails on the pnpm version | Set `ENABLE_EXPERIMENTAL_COREPACK=1` and Node.js 24.x, redeploy. |
| Browser: CORS error | `CORS_ALLOWED_ORIGINS` must contain the exact web origin (`https://…vercel.app`, no path). |
| API crashes on start: `Invalid environment variables` | The log names the variable. Compare with the table in step 2. |
| Health is `503 DATABASE_UNAVAILABLE` | Wrong `DATABASE_URL`, or Neon is down / out of compute hours. |
| Every fan gets `429` at once | The API sees the proxy's IP. Set `TRUST_PROXY_HOPS` (try `1`, then `2`). |
| Highlight form says "Video links only" | Expected without a disk. See "Highlight uploads" in step 2. |
