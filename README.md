# Portfolio System

A Turborepo monorepo with a MongoDB-backed API, two headless portfolio sites, and a Google-authenticated CMS:

- `server/` — Express API, MongoDB models, authentication, contact notifications, and Cloudinary media.
- `pro-portfolio/` — the developer portfolio and its optional Build Plane WebGL scene.
- `photo-portfolio/` — the photography portfolio and optional Light Field scene.
- `admin-panel/` — shared content, media, settings, and inquiry management.

Portfolio copy and media are intentionally not seeded with personal information. Configure the services and enter real copy and assets through the CMS before making the sites public.

## Requirements

- Node.js 22 and npm.
- MongoDB (Atlas for deployment).
- Redis for production rate limits and shared OAuth state. A local Redis instance is optional for development; leave `REDIS_URL` blank when it is unavailable.
- Google OAuth credentials, Cloudinary credentials, and an optional Gmail App Password / linked WhatsApp account for notifications.

## Local setup

1. Install the root workspaces:

   ```sh
   npm install
   ```

2. Copy `server/.env.example` to `server/.env`, then fill in the values below. Keep `.env` private and never commit credentials.

3. Configure the Google OAuth consent screen and OAuth client. Add this exact redirect URI to the client:

   ```text
   http://localhost:4000/api/auth/google/callback
   ```

   Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, and `ADMIN_EMAIL` in `server/.env`. Use the callback URL above and set `ADMIN_EMAIL` to the one Google account permitted to sign in. The callback rejects every other account.

4. Create a MongoDB database and set `MONGODB_URI`. Redis is optional locally; leave `REDIS_URL` blank unless a local Redis instance is running. Production requires Redis for shared IP rate limits and single-use OAuth state.

5. Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Uploads are stored in the `pro-portfolio`, `photo-gallery`, `photo-videos`, and `documents` folders.

6. Set the three local client origins:

   ```text
   PRO_CLIENT_URL=http://localhost:5173
   PHOTO_CLIENT_URL=http://localhost:5174
   ADMIN_CLIENT_URL=http://localhost:5175
   ```

7. (Optional) Configure `GMAIL_USER` and a Google **App Password** in `GMAIL_APP_PASSWORD`. Do not use the normal Gmail account password. Set `YOUR_WHATSAPP_JID` to the notification recipient JID.

8. Start the API and all three Vite development servers:

   ```sh
   npm run all
   ```

   This is an alias for `npm run dev`; it starts all four workspaces together. The sites are available at `http://localhost:5173`, `http://localhost:5174`, and `http://localhost:5175`, and the API at `http://localhost:4000`. To run one app, use `npm run dev -w @portfolio-system/server`, `npm run dev -w @portfolio-system/pro-portfolio`, `npm run dev -w @portfolio-system/photo-portfolio`, or `npm run dev -w @portfolio-system/admin-panel`.

   The command above requires a configured `server/.env` and a reachable MongoDB instance for the API. For a local MongoDB, set `MONGODB_URI=mongodb://127.0.0.1:27017/portfolio-system`. Set `SERVER_URL=http://localhost:4000` for local development.

9. Visit the CMS and use **Continue with Google**. Set up your real site content, photos, links, metadata, and availability there; the public portfolios read their content from the API. Personal content is not seeded: until you add it, the public sites show a setup notice. The CMS login page explains which OAuth settings are missing if sign-in is not configured.

The API starts a WhatsApp connection only when `YOUR_WHATSAPP_JID` is set. On the first server boot, scan the pairing QR shown in the server terminal with the WhatsApp account that owns the session. Baileys authentication keys are persisted in MongoDB so a Render restart does not require a disk-based session. WhatsApp and email are best-effort contact notifications; failure to notify does not discard an inquiry.

## Environment variables

`server/.env.example` documents the complete API configuration. The required production settings include `MONGODB_URI`, `REDIS_URL`, both JWT secrets, the Google OAuth client and callback, `ADMIN_EMAIL`, all three client origins, and `SERVER_URL`. Optional notification integrations use Cloudinary, Gmail, and `YOUR_WHATSAPP_JID`.

To rotate a JWT secret, replace the corresponding secret with a newly generated random value of at least 32 characters in the deployment environment, then redeploy. Rotation invalidates tokens signed with the old secret; admins must sign in again. Access tokens last 15 minutes; refresh tokens last 7 days and rotate on refresh.

## Checks

Run all project checks in sequence from the repository root:

```sh
npm run check:all
```

This runs the dependency audit, lint, tests, and production builds; it stops at the first failure.

To run an individual check:

```sh
npm run audit
npm run lint
npm run test
npm run build
```

GitHub Actions runs the audit, lint, tests, and production builds for pull requests and pushes to `main`. After a successful check on `main`, it sends Render deploy-hook requests for all four services. Production dependency versions are pinned; Dependabot checks the npm workspaces and GitHub Actions weekly.

## One-command deployment

After connecting this repository to Render and creating the four services from `render.yaml`, configure production environment variables and add these four GitHub Actions repository secrets:

- `RENDER_DEPLOY_HOOK_API`
- `RENDER_DEPLOY_HOOK_PRO`
- `RENDER_DEPLOY_HOOK_PHOTO`
- `RENDER_DEPLOY_HOOK_ADMIN`

Create each URL in the corresponding Render service's **Settings → Deploy Hook** section. Do not commit deploy-hook URLs or put them in `.env` or workflow files. In Render, turn off automatic deploys for these services so they deploy only after CI succeeds.

Deploy future changes from the repository root with:

```sh
npm run deploy
```

This runs the audit, lint, tests, and production builds first. If they pass, it pushes the current branch to its configured upstream. On `main`, GitHub Actions reruns the checks and asks Render to deploy all four services; pull requests run checks but never deploy. The command cannot create the initial Render services or configure production secrets and GitHub repository secrets for you. If the branch has no Git upstream, configure the Git remote and upstream before running it. To start the four local services instead, use `npm run all`.

## Render deployment

1. Create a Render Blueprint from the repository root using `render.yaml`. The API uses the Render Starter plan because Render persistent disks are not available on the free web-service plan.
2. Configure the API's unsynced variables (`MONGODB_URI`, `REDIS_URL`, OAuth, Cloudinary, Gmail, WhatsApp, and `ADMIN_EMAIL`) in the Render dashboard.
3. Deploy the three static sites and copy their final public URLs into the API's `PRO_CLIENT_URL`, `PHOTO_CLIENT_URL`, and `ADMIN_CLIENT_URL` variables. Set `GOOGLE_CALLBACK_URL` to `https://<API-host>/api/auth/google/callback`, add that callback URL to the Google OAuth client, set `SERVER_URL` to `https://<API-host>`, and redeploy.
4. Set the two admin static-site preview variables `VITE_PRO_URL` and `VITE_PHOTO_URL` to the deployed site URLs.
5. Enter the real portfolio copy, images, project links, SEO metadata, social links, and cross-links in the CMS before enabling both live switches.

`/ping` is the lightweight Render health check. In production, the API also requests its own `SERVER_URL/ping` every 10 minutes. A self-ping is best-effort and does not guarantee that a free service will never sleep. Optional backup: create an UptimeRobot free HTTP monitor for `https://<API-host>/ping` with a 5-minute interval. WhatsApp state lives in MongoDB; the Render disk is retained for deployment compatibility and future approved local session files.

## Security and operations notes

- Admin JWTs are only sent in `httpOnly`, `SameSite=Strict` cookies; mutations also require the double-submit CSRF token. Configure the three exact frontend origins—never use a wildcard.
- Production rate limits and OAuth one-time state require Redis. Development may run without Redis, using per-process limits.
- Upload limits and magic-byte checks are enforced server-side. The ClamAV integration point is marked TODO in the upload middleware; arrange a malware-scanning service before accepting untrusted production uploads.
- The Admin model reserves TOTP fields but does not enable two-factor authentication in v1.
- Set up an approved log/alert destination for production logs and repeated authentication failures before launch. The API does not include a third-party monitoring agent.
