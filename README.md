<!--
Replace every instance of https://p3cap.vercel.app
with your deployed backend URL before pushing this README live.
For Vercel, that will usually be https://YOUR-PROJECT.vercel.app.
If your repo URL is not https://github.com/p3cap/p3cap, update the redirect target in both links too.
-->

<div align="center">
  <h1>Cookie Clicker README</h1>
  <p>Click the cookie, buy upgrades, get redirected back here, then refresh to see the new numbers.</p>

  <a href="https://p3cap.vercel.app/actions/click?redirect=https%3A%2F%2Fgithub.com%2Fp3cap%2Fp3cap">
    <img src="./assets/cookie.png" width="180" alt="Click the cookie" />
  </a>
</div>

<div align="center">
  <a href="https://p3cap.vercel.app/actions/upgrade?redirect=https%3A%2F%2Fgithub.com%2Fp3cap%2Fp3cap">
    <img src="https://p3cap.vercel.app/images/upgrade-button.svg" alt="Upgrade button" />
  </a>
</div>

<div align="center">
  <img src="https://p3cap.vercel.app/images/counter.svg" alt="Formatted cookie counter from the server" />
</div>

<div align="center">
  <img src="https://p3cap.vercel.app/images/status.svg" alt="Upgrade status from the server" />
</div>

<div align="center">
  <img src="https://p3cap.vercel.app/images/log.svg" alt="Latest action log from the server" />
</div>

<div align="center">
  <sub>The README itself is the frontend. Every click goes to the backend first, the backend updates state, redirects back to GitHub, and the new images show up after refresh.</sub>
</div>

<div align="center">
  <sub>Vercel setup notes: see <a href="./DEPLOYMENT.md">DEPLOYMENT.md</a>.</sub>
</div>
