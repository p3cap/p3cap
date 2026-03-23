# Deployment

## GitHub

GitHub Pages can serve the README and static assets, but it cannot run this backend.

## Vercel

This project is set up so you can deploy the `Server` directory as a Vercel project with Redis-based persistence.

### Why this layout

- `Server/index.js` is a zero-config Express entrypoint for Vercel.
- `Server/server.js` still runs the local JSON-backed server for local development.
- `Server/remote-handler.js` uses Redis so state persists on Vercel without Firebase.

### Vercel project setup

1. Import this GitHub repo into Vercel.
2. In the Vercel project settings, set the Root Directory to `Server`.
3. Leave the framework as the Express backend detected by Vercel.
4. Deploy once Vercel has picked up the settings.

### Storage setup

As of July 22, 2025, Vercel KV has been sunset for new projects. The Vercel docs now direct new projects to install a Redis integration from the Marketplace instead.

Inside your Vercel project:

1. Open the `Storage` tab or the Marketplace.
2. Install an `Upstash Redis` integration for this project.
3. Let Vercel inject the Redis environment variables automatically.

The backend uses `@upstash/redis` and reads the injected credentials from the environment.
It supports `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, and also the older `KV_REST_API_URL` / `KV_REST_API_TOKEN` names.

### Recommended environment variables

- `README_REDIRECT_URL`
  Example: `https://github.com/p3cap/p3cap`
- `STATE_KEY`
  Optional Redis key name. Default: `readmeCookie:state`
- `RESET_TOKEN`
  Optional but recommended. Protects the reset endpoint at `/admin/reset?token=YOUR_RESET_TOKEN`

### README setup

Replace every `https://YOUR-COOKIE-BACKEND.example.com` in `README.md` with:

`https://YOUR-PROJECT.vercel.app`

If your repo URL is not `https://github.com/p3cap/p3cap`, update the redirect target in both action links too.

### Local development

From `Server`:

```bash
npm install
npm start
```

That runs the local JSON-backed server at `http://localhost:3000`.
