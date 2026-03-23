# Deployment

## GitHub

GitHub Pages can serve the README and static assets, but it cannot run this backend.

## Vercel

This project is now set up so you can deploy the `Server` directory as a Vercel project.

### Why this layout

- `Server/index.js` is a zero-config Express entrypoint for Vercel.
- `Server/server.js` still runs the local JSON-backed server for local development.
- `Server/remote-handler.js` uses Firestore so state persists on Vercel.

### Vercel project setup

1. Import this GitHub repo into Vercel.
2. In the Vercel project settings, set the Root Directory to `Server`.
3. Leave the framework as the Express backend detected by Vercel.
4. Deploy once Vercel has picked up the settings.

### Required environment variables

Add these in the Vercel project settings:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
  Use the full JSON contents of a Firebase service-account key with Firestore access.
- `FIREBASE_PROJECT_ID`
  Your Firebase project ID.

### Recommended environment variables

- `README_REDIRECT_URL`
  Example: `https://github.com/p3cap/p3cap`
- `STATE_COLLECTION`
  Optional Firestore collection name. Default: `readmeCookie`
- `STATE_DOCUMENT`
  Optional Firestore document name. Default: `state`

### Firebase side

1. Create a Firebase project if you do not already have one.
2. Enable Cloud Firestore.
3. Create a service account key for the Firebase Admin SDK.
4. Put that JSON into the `FIREBASE_SERVICE_ACCOUNT_JSON` env var in Vercel.

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

## Firebase Hosting

The backend code still has a Firebase Functions entrypoint in `Server/firebase.js`, but the repo is now primarily optimized around Vercel deployment.
