<div align="center">
  <h1>Cookie Clicker README</h1>
  <p>A <b>global game</b> on your profile README.</p>
  <sub>(Recommended desktop view from phone.)</sub>
</div>

<p align="center">
  <img src="https://p3cap.vercel.app/images/counter.svg" alt="Cookie counter" width="320" />
  <img src="https://p3cap.vercel.app/images/status.svg" alt="Clicks per tap counter" width="320" />
</p>

<p align="center">
  <sub><strong>TAP THE COOKIE</strong> to earn cookies, then buy upgrades on the right.</sub>
</p>

<p align="center" valign="center">
  <a href="https://p3cap.vercel.app/actions/click">
    <img src="https://p3cap.vercel.app/images/cookie.gif" width="420" alt="Tap the cookie" />
  </a>
  <a href="https://p3cap.vercel.app/actions/upgrade">
    <img src="https://p3cap.vercel.app/images/upgrade-button.svg" alt="Upgrade sidebar" width="280" height="420" />
  </a>
</p>

<details>
<summary>How to add this to your profile?</summary>

1. Create a public repository named exactly like your GitHub username so GitHub shows its `README.md` on your profile.
2. Copy this `README.md` file into your repo.
3. Cutomize your `README.md` if you want to (just keep my name on it pls).
4. Commit and push the repository to GitHub.
5. Refresh your profile page and the game will appear there.
<sub>Got stuck? Contact <a src="https://github.com/p3cap">me</a>.</sub>

</details>

<details>
<summary>How it works?</summary>

- When you click the cookie or upgrade, you open the Vercel-hosted server.
- The server updates the shared game state, then tries to send you back to the previous page.
- If the browser cannot go back, it uses the configured fallback URL instead.
- Then the images get requested again when the page loads.

</details>

<p align="center">
  <sub>Made by <a href="https://github.com/p3cap">P3cap</a> with <a href="https://github.com/codex">Codex</a></sub>
</p>
