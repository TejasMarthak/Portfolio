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

Link or disconnect WhatsApp from **CMS → General → Settings → WhatsApp notifications**, using the QR code or a phone-number pairing code. Once connected, use **Send test notification** to check delivery. Only the authenticated administrator can view the pairing data or manage the connection. The API stores the linked session in MongoDB and automatically reconnects it after an API restart; closing the CMS browser or signing out does not disconnect WhatsApp. Use **Disconnect** only when you want to unlink it. To receive notifications while no browser is open, deploy the API as an always-on service and keep MongoDB available. Notifications are best-effort and do not discard contact inquiries if WhatsApp is disconnected.

Edit portfolio copy and metadata from the matching CMS section using the labeled form fields. Add project links, photo/video URLs, and upload media directly beside the field where it will be used; photo and video entries start collapsed and expand when edited or added. Set up reusable photography categories in **Photo portfolio → Categories** and choose them from the matching dropdowns. In developer projects, select skills created under **Pro portfolio → Skills**. Empty sections do not appear on the public sites. Use **General → Settings → Portfolio sections** to show or hide populated sections and control the navigation links; hidden sections keep their saved content and are omitted from the 3D scene too. On small screens, use the menu button to open the full section navigation. Images stream to Cloudinary up to 200 MB, videos up to 10 GB, and PDFs up to 10 MB; actual limits also depend on the Cloudinary account and hosting provider. Images, videos, audio, and PDFs open in an in-site viewer; Cloudinary PDFs are streamed inline through the API with byte-range support. **Media library → Delete** permanently removes the Cloudinary asset and clears references from both portfolios after confirmation. Deleting a section clears its saved content; attached files remain reusable in the media library until explicitly deleted. **General → Settings** also contains form editors for social links, public email/phone/WhatsApp/location, site availability, cross-links, and analytics IDs. Social profiles and contact details are shared by both portfolios; recognized networks show an automatic platform icon, with a generic globe icon for custom networks. The public WhatsApp contact number is separate from the private CMS notification connection.

Each public portfolio has a header button linking to the other site. Configure **Photography portfolio URL** and **Developer portfolio URL** in **CMS → General → Settings** for deployed sites. On localhost, the buttons default to ports 5174 and 5173 respectively. Browser tab titles are **Tejas | Photographer** and **Tejas | FullStack Developer**; the home hero headings use their CMS hero content and both navigation bars display a **Tejas** wordmark.

Add social profiles by platform name in **CMS → General → Settings**. Paste a profile URL or enter a handle for a supported network, choose **Show on sites**, and save; disabled profiles remain in CMS but are hidden on both portfolio footers. Upload a resume under **Pro portfolio → Resume**; its **Resume** button is in the developer portfolio navigation, not the hero. Both sites stay in 3D mode when WebGL 2 is available; browsers without WebGL 2 use the accessible page layout. The photography scene starts at the first published photo section after the hero and completes at the contact section, including when that section is reached through the navigation. Its separated photo planes show no overlaid labels, with soft moving light shafts instead of star particles.

The WhatsApp Web connection uses the community-maintained Baileys library, not the official WhatsApp Business API. Review WhatsApp's current terms and use a dedicated account if appropriate. Pairing QR codes and codes grant account-linking access: never share them. `YOUR_WHATSAPP_JID` is an optional server-side override for the notification recipient; it can be an international phone number or WhatsApp JID. If it is blank, notifications go to the linked account.

## Environment variables

`server/.env.example` documents the complete API configuration. The required production settings include `MONGODB_URI`, `REDIS_URL`, both JWT secrets, the Google OAuth client and callback, `ADMIN_EMAIL`, all three client origins, and `SERVER_URL`. Optional notification integrations use Cloudinary, Gmail, and `YOUR_WHATSAPP_JID`.

Admin sign-in uses persistent, HTTP-only cookies. Access tokens last 15 minutes; refresh tokens last 30 days and rotate when refreshed, so returning within 30 days keeps the same device signed in. Logging out or invalidating the session removes access. If `JWT_REFRESH_EXPIRES` is explicitly set in your local environment or deployment settings, set it to `30d` as well. To rotate a JWT secret, replace it with a newly generated random value of at least 32 characters in the deployment environment, then redeploy; admins must sign in again.

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
- OAuth sign-in initiation, callbacks, and token refreshes have separate per-IP limits. The callback validates a short-lived, single-use state token without binding it to an IP that may change during Google's redirect. Five failed callbacks trigger a 15-minute per-IP lockout. Production rate limits and OAuth state require Redis. Development may run without Redis, using per-process limits.
- WhatsApp linking is limited to ten attempts per hour. Authenticated status polling has its own limit, so waiting for a QR code or pairing code does not consume pairing attempts.
- Upload limits and magic-byte checks are enforced server-side while media is streamed in chunks rather than buffered in process memory. The Cloudinary plan and hosting provider may impose lower size or request-duration limits. The ClamAV integration point is marked TODO in the upload middleware; arrange a malware-scanning service before accepting untrusted production uploads.
- The Admin model reserves TOTP fields but does not enable two-factor authentication in v1.
- Set up an approved log/alert destination for production logs and repeated authentication failures before launch. The API does not include a third-party monitoring agent.
