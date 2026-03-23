<div align="center">
  <h1>Cookie Clicker README</h1>
  <p>A <b>global game</b> you can drop into any GitHub profile README.</p>
</div>

<p align="center">
  <img src="https://p3cap.vercel.app/images/counter.svg" alt="Cookie counter" width="320" />
  <img src="https://p3cap.vercel.app/images/status.svg" alt="Clicks per tap counter" width="320" />
</p>

<p align="center" valign="center">
<a href="https://p3cap.vercel.app/actions/click">
    <img src="./assets/cookie_anim.gif" width="420" alt="Tap the cookie" />
  </a>
	<a href="https://p3cap.vercel.app/actions/upgrade">
    <img src="https://p3cap.vercel.app/images/upgrade-button.svg" alt="Upgrade sidebar" width="280" />
  </a>
</p>

<p align="center">
  <sub><strong>TAP THE COOKIE</strong> to earn cookies, then buy upgrades on the right.</sub>
</p>

<p align="center">
  <sub>Anyone can reuse this README and point it at the same backend to play on the same shared save.</sub>
</p>

<details>
<summary>How to use it</summary>

1. Create a public repository named exactly like your GitHub username so GitHub shows its `README.md` on your profile.
2. Copy or clone this repo and move the files you want into that profile repository.
3. If you want to join the same global game, leave the README links pointed at `https://p3cap.vercel.app`.
4. If you want your own version instead, deploy the `Server` folder to Vercel, set up Redis, and replace the backend URL in the README with your own server. The full deploy steps are in [DEPLOYMENT.md](./DEPLOYMENT.md).
5. Set `README_REDIRECT_URL` to `https://github.com/YOUR_USERNAME` on your Vercel project if you are hosting your own backend.
6. Commit and push, then refresh your profile page.
7. Tweak anything you want: the cookie GIF, text, colors, SVG styles, upgrade balance, or pricing logic.

</details>

<details>
<summary>How it works</summary>

- The README itself is the frontend: the cookie and upgrade panel are just clickable images inside Markdown.
- Those links open a small JavaScript server hosted on Vercel, which updates the shared game state, then instantly redirects back to GitHub.
- The two counters are SVG images requested from that same server, so the server can draw the latest cookie count and clicks-per-tap value.
- If multiple profiles point at the same backend URL, everyone is playing the same global game.
- If you swap in your own backend URL, you create your own separate save and can modify the rules however you want.
- GitHub may cache external images for a bit, so a manual refresh can still help after a click.

</details>

<p align="center">
  <sub>Made by <a href="https://github.com/p3cap">P3cap</a> with <a href="https://github.com/codex">Codex</a></sub>
</p>
