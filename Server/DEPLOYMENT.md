# Deployment

## What this repo does now

- The backend lives in `Server/` and is meant to be deployed to Vercel.
- Persistent game state is stored in Upstash Redis through Vercel Storage.
- The README frontend can either:
  - point at the shared public backend at `https://p3cap.vercel.app`, or
  - point at your own Vercel deployment if you want your own save.
- The cookie GIF is served by the backend at `/images/cookie.gif`, so the README does not need any local image assets.

## GitHub

GitHub can host the profile README itself, but it cannot run the backend.

## Vercel

This project is set up so you can deploy the `Server` directory directly as a Vercel project.

### Current layout

- `Server/index.js`
  Express entrypoint used by Vercel.
- `Server/remote-handler.js`
  Production handler that uses Redis-backed state.
- `Server/server.js`
  Local development server with JSON-file storage.
- `Server/app.js`
  Shared routes for clicks, upgrades, JSON state, SVG counters, the upgrade panel, and the hosted cookie GIF.
- `Server/state-store.js`
  State storage implementations for local JSON and Redis.

### Vercel setup

1. Import this GitHub repo into Vercel.
2. Set the project Root Directory to `Server`.
3. Leave the detected backend settings as-is.
4. Deploy once so the project is created.

### Storage setup

1. Open the Vercel project.
2. Go to `Storage`.
3. Add an `Upstash Redis` integration.
4. Let Vercel attach the Redis environment variables to the project.
5. Redeploy after the integration is connected.

The backend supports both of these env var pairs:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### Recommended environment variables

- `README_REDIRECT_URL`
  Optional fallback URL if the previous page URL is unavailable.
  Example: `https://github.com/YOUR_USERNAME`
- `STATE_KEY`
  Optional custom Redis key. Default: `readmeCookie:state`

### README usage

If you want to use your own backend:

1. Deploy this `Server` folder to Vercel.
2. Open `README.md`.
3. Replace every `https://p3cap.vercel.app` with your own `https://YOUR-PROJECT.vercel.app`.
4. Push the updated README to the GitHub repo that will display it.

If you want to join the shared global game instead:

1. Copy the README as-is.
2. Leave the links pointed at `https://p3cap.vercel.app`.

### Resetting the game privately

There is no public reset endpoint in the repo anymore.

To clear the save for your own deployment:

1. Open your Vercel project.
2. Go to `Storage`.
3. Open the linked Upstash Redis database.
4. Delete the Redis key used by the game.

Default key:

```text
readmeCookie:state
```

If you set `STATE_KEY`, delete that key instead.

After deleting the key, the next request will recreate a fresh empty save automatically.

### Local development

From `Server/`:

```bash
npm install
npm start
```

That starts the local JSON-backed server at `http://localhost:3000`.

Useful local routes:

- `/`
- `/api/state`
- `/actions/click`
- `/actions/upgrade`
- `/images/counter.svg`
- `/images/status.svg`
- `/images/upgrade-button.svg`
- `/images/cookie.gif`
