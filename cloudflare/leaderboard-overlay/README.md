# Leaderboard overlay

This Worker serves the transparent production leaderboard and stores the latest published snapshot in R2.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars` and choose a local `PUBLISH_SECRET`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:8787/?preview=1` for a checkerboard transparency preview.

Publish a fixture with an HTTP `POST` to `/api/leaderboard`, using the same value as a Bearer token. The Electron app performs this automatically when **Show Leaderboard on TV** is clicked.

## Cloudflare setup

After a Cloudflare account is available:

1. Authenticate Wrangler (`npx wrangler login` or set the standard Wrangler API-token environment variables).
2. Create the bucket: `npx wrangler r2 bucket create cutter-challenge-leaderboard`.
3. Set the Worker secret interactively: `npx wrangler secret put PUBLISH_SECRET`.
4. Validate with `npm run check`, then deploy with `npx wrangler deploy`.
5. Add a custom domain to the deployed Worker if desired.
6. On the scoring laptop, copy `.env-cloudflare.example` to `.env-cloudflare`, set `LEADERBOARD_PUBLISH_URL` to the deployed `/api/leaderboard` URL, and set `LEADERBOARD_PUBLISH_SECRET` to the same secret.

Do not put the Cloudflare account API token or an R2 access key in the Electron application. Wrangler uses account credentials only for provisioning and deployment; the running app uses the narrow publish secret.
