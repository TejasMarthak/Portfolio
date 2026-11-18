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

   Local development and the deployed sites run independently: opening `http://localhost:5173`, `http://localhost:5174`, or `http://localhost:5175` does not replace or stop the public sites. Vite uses the local API at `http://localhost:4000` by default; Vercel builds inject the deployed API URL through `VITE_API_URL`. Keep a separate development database in `server/.env` so local CMS edits cannot accidentally change production content. To preview current production content locally, copy an approved content snapshot into that development database rather than pointing the local CMS at the production database.

9. Visit the CMS and use **Continue with Google**. Set up your real site content, photos, links, metadata, and availability there; the public portfolios read their content from the API. Personal content is not seeded: until you add it, the public sites show a setup notice. The CMS login page explains which OAuth settings are missing if sign-in is not configured.

Link or disconnect WhatsApp from **CMS → General → Settings → WhatsApp notifications**, using the QR code or a phone-number pairing code. Once connected, use **Send test notification** to check delivery. Use **Email notifications → Send test email** on the same page to verify Gmail and see a safe SMTP diagnostic code if it fails. Only the authenticated administrator can manage these tests or the WhatsApp connection. The API saves a contact inquiry and acknowledges it before sending WhatsApp and email notifications in the background; the CMS delivery flags update after those attempts finish. The API stores the linked WhatsApp session in MongoDB and automatically reconnects it after an API restart; closing the CMS browser or signing out does not disconnect WhatsApp. Use **Disconnect** only when you want to unlink it. To receive notifications while no browser is open, deploy the API as an always-on service and keep MongoDB available. Notifications are best-effort and do not discard contact inquiries if a provider is unavailable.

Edit portfolio copy and metadata from the matching CMS section using the labeled form fields. Add project links, photo/video URLs, and upload media directly beside the field where it will be used; photo and video entries start collapsed and expand when edited or added. Set up reusable photography categories in **Photo portfolio → Categories** and choose them from the matching dropdowns. In developer projects, select skills created under **Pro portfolio → Skills**. Empty sections do not appear on the public sites. Use **General → Settings → Portfolio sections** to show or hide populated sections and control the navigation links; hidden sections keep their saved content and are omitted from the 3D scene too. On small screens, use the menu button to open the full section navigation. Images stream to Cloudinary up to 200 MB, videos up to 10 GB, and PDFs up to 10 MB; actual limits also depend on the Cloudinary account and hosting provider. Images, videos, audio, and PDFs open in an in-site viewer; Cloudinary PDFs are streamed inline through the API with byte-range support. **Media library → Delete** permanently removes the Cloudinary asset and clears references from both portfolios after confirmation. Deleting a section clears its saved content; attached files remain reusable in the media library until explicitly deleted. **General → Settings** also contains form editors for social links, public email/phone/WhatsApp/location, site availability, cross-links, and analytics IDs. Social profiles and contact details are shared by both portfolios; recognized networks show an automatic platform icon, with a generic globe icon for custom networks. The public WhatsApp contact number is separate from the private CMS notification connection.

Each public portfolio has a header button linking to the other site. Configure **Photography portfolio URL** and **Developer portfolio URL** in **CMS → General → Settings** for deployed sites. On localhost, the buttons default to ports 5174 and 5173 respectively. Browser tab titles are **Tejas | Photographer** and **Tejas | FullStack Developer**; the home hero headings use their CMS hero content and both navigation bars display a **Tejas** wordmark.

Add social profiles by platform name in **CMS → General → Settings**. Paste a profile URL or enter a handle for a supported network, choose **Show on sites**, and save; disabled profiles remain in CMS but are hidden on both portfolio footers. Both sites use the same WebGL 2 scenes on touch devices when the browser supports WebGL 2, using a device-pixel-ratio cap and reduced scene detail to protect performance. Browsers without WebGL 2 get a lightweight, scroll-reactive depth-scene fallback behind the same accessible HTML content. The photography WebGL camera starts as the first published photo section after the hero arrives, travels through every published photo, and ends before the contact form appears. A scroll runway gives the camera enough room on short pages; its contact clearance adapts to the available scroll distance. Nearby photo textures stream in as the camera moves, reducing GPU memory use on phones. Its separated photo planes show no overlaid labels, with soft moving light shafts instead of star particles.

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

GitHub Actions runs the audit, lint, tests, and production builds for pull requests and pushes to `main`. Render and Vercel deploy directly from their GitHub integrations; no GitHub deploy-hook secrets are needed. Production dependency versions are pinned; Dependabot checks the npm workspaces and GitHub Actions weekly.

## Deployment: Vercel frontends and Render API

The monorepo stays intact. Create three separate Vercel projects from the same GitHub repository and `main` branch. For all three, set the Root Directory to the repository root (`.`), the Install Command to `npm ci`, and use the matching build command and output directory below. Keeping the repository root as the build context makes the shared `shared/` directory available to every app.

| Vercel project | Build Command | Output Directory |
| --- | --- | --- |
| Developer portfolio | `npm run build --workspace=@portfolio-system/pro-portfolio` | `pro-portfolio/dist` |
| Photography portfolio | `npm run build --workspace=@portfolio-system/photo-portfolio` | `photo-portfolio/dist` |
| Admin panel | `npm run build --workspace=@portfolio-system/admin-panel` | `admin-panel/dist` |

The repository-root `vercel.json` sends client-side routes to each project's `index.html`, so refreshing nested portfolio or admin URLs loads the SPA instead of returning Vercel's 404 page.

Set `VITE_API_URL` in each Vercel project to the public Render API URL. In the Admin project, also set `VITE_PRO_URL` and `VITE_PHOTO_URL` to the deployed portfolio URLs.

Create one Render Web Service from the same repository using the API-only `render.yaml` Blueprint. The service uses the repository root, health check `/ping`, build command `npm ci --omit=dev --workspace=@portfolio-system/server --include-workspace-root=false`, and start command `node server/server.js`. Render's Starter plan is used because the Blueprint includes a persistent disk.

Configure the API's environment variables in Render: MongoDB, Redis, Google OAuth, `ADMIN_EMAIL`, Cloudinary, optional email/WhatsApp settings, `SERVER_URL`, and the three frontend origins (`PRO_CLIENT_URL`, `PHOTO_CLIENT_URL`, `ADMIN_CLIENT_URL`). Set `GOOGLE_CALLBACK_URL` to `https://<api-domain>/api/auth/google/callback` and add that exact URL to the Google OAuth client. Generate separate JWT secrets of at least 32 characters. Production rate limits and OAuth state require Redis.

The API uses `SameSite=None; Secure` cookies in production so the Admin can send credentials to a Render API from a Vercel domain. Set the Vercel frontend variables, Render client-origin variables, and OAuth callback to the exact deployed HTTPS origins. The API still allows only the configured frontend origins and requires the double-submit CSRF token for mutations. Some browsers or privacy settings block third-party cookies; test CMS sign-in in the browsers you intend to support.

Enable automatic deployments from `main` in Vercel and Render. A normal push then deploys each Vercel project and the Render API independently, while GitHub Actions only runs the quality checks. To run the checks and push your current branch with the existing shortcut, use `npm run deploy`; a regular `git push origin main` also triggers the platform deployments. To start the four local services, use `npm run all`.

Enter the real portfolio copy, images, project links, SEO metadata, social links, and cross-links in the CMS before enabling both live switches. `/ping` is the lightweight Render health check. WhatsApp state is stored in MongoDB; the Render disk is retained for deployment compatibility and future approved local session files.

## Security and operations notes

- Admin JWTs are only sent in `httpOnly`, `Secure`, `SameSite=None` production cookies; mutations also require the double-submit CSRF token. Configure the three exact frontend origins—never use a wildcard.
- **CMS → Media library → Delete all media** permanently removes all tracked Cloudinary assets and clears their portfolio and profile-photo references after the administrator types `DELETE ALL`. Items whose Cloudinary deletion fails remain in the library for retry; assets uploaded outside the CMS and not recorded in its media library are not included.
- OAuth sign-in initiation, callbacks, and token refreshes have separate per-IP limits. The callback validates a short-lived, single-use state token without binding it to an IP that may change during Google's redirect. Five failed callbacks trigger a 15-minute per-IP lockout. Production rate limits and OAuth state require Redis. Development may run without Redis, using per-process limits.
- WhatsApp linking is limited to ten attempts per hour. Authenticated status polling has its own limit, so waiting for a QR code or pairing code does not consume pairing attempts.
- Upload limits and magic-byte checks are enforced server-side while media is streamed in chunks rather than buffered in process memory. The Cloudinary plan and hosting provider may impose lower size or request-duration limits. The ClamAV integration point is marked TODO in the upload middleware; arrange a malware-scanning service before accepting untrusted production uploads.
- The Admin model reserves TOTP fields but does not enable two-factor authentication in v1.
- Set up an approved log/alert destination for production logs and repeated authentication failures before launch. The API does not include a third-party monitoring agent.
