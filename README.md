<div align="center">

<pre>
██████╗  ██████╗  ██████╗ ███╗   ███╗
██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║
██║  ██║██║   ██║██║   ██║██╔████╔██║
██║  ██║██║   ██║██║   ██║██║╚██╔╝██║
██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║
╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝
</pre>

<h3>Primitive README FPS</h3>
<p>Chunky pixels, flat walls, one action at a time.</p>
<sub>Every button press advances the world exactly one step. Enemies only move after you do.</sub>

</div>

<p align="center">
  <img src="https://p3cap.vercel.app/doom/global/images/view.svg" alt="Retro first-person game viewport" width="720" />
</p>

<p align="center">
  <img src="https://p3cap.vercel.app/doom/global/images/hud.svg" alt="Ammo, health, score, and dungeon floor HUD" width="720" />
</p>

<p align="center">
  <sub><strong>Step Mode:</strong> no real-time simulation, no auto-movement, no hidden ticks between clicks.</sub>
</p>

<table align="center">
  <tr>
    <td></td>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/forward?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-forward.svg" alt="Move forward one tile" width="150" />
      </a>
    </td>
    <td></td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/turn-left?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-turn-left.svg" alt="Turn left" width="150" />
      </a>
    </td>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/shoot?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-shoot.svg" alt="Shoot straight ahead" width="150" />
      </a>
    </td>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/turn-right?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-turn-right.svg" alt="Turn right" width="150" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/strafe-left?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-strafe-left.svg" alt="Step left" width="150" />
      </a>
    </td>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/wait?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-wait.svg" alt="Wait one step" width="150" />
      </a>
    </td>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/strafe-right?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-strafe-right.svg" alt="Step right" width="150" />
      </a>
    </td>
  </tr>
  <tr>
    <td></td>
    <td align="center">
      <a href="https://p3cap.vercel.app/doom/global/backward?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-backward.svg" alt="Move backward one tile" width="150" />
      </a>
    </td>
    <td></td>
  </tr>
</table>

<p align="center">
  <img src="https://p3cap.vercel.app/doom/global/images/minimap.svg" alt="Grid-based dungeon minimap" width="320" />
</p>

<details>
<summary>How this game works</summary>

- The game is a tiny turn-based corridor crawler dressed up like a 1990s shooter.
- Every click performs exactly one deterministic action: move, turn, strafe, shoot, or wait.
- After your action resolves, the world advances one step and enemies take theirs.
- The viewport should stay low-resolution, blocky, and fake-3D, like an old DOS-era engine.
- The lobby lives in the URL, so `doom/global` and `doom/my-squad` are separate runs.

</details>

<details>
<summary>How to make your own lobby</summary>

1. Copy this `README.md` into your profile repo.
2. Replace `?redirect=https%3A%2F%2Fgithub.com%2Fp3cap` with your own GitHub profile URL.
3. Change every `/doom/global/` segment to something like `/doom/my-lobby/`.
4. Push the README and open your GitHub profile.

</details>

<details>
<summary>Current ruleset</summary>

- The player acts on a small grid with four facing directions.
- The screen render is state-based, not animated, and updates only after a button press.
- Enemies are sprite-based and move in simple deterministic patterns.
- Shooting checks the tiles in front of the player until a wall blocks the shot.
- Ammo, health, keys, score, and floor number belong in the HUD.

</details>

<p align="center">
  <sub>Made by <a href="https://github.com/p3cap">P3cap</a> with <a href="https://github.com/codex">Codex</a></sub>
</p>
