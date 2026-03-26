<div align="center">

<table>
  <tr>
    <td align="center">
      <img src="https://p3cap.vercel.app/doom/global/images/view.svg" alt="Retro Doom-like game screen" width="590" />
      <br />
      <sub><strong>STEP MODE</strong> | one click = one world update | enemies only move after your input</sub>
      <br />
      <br />
      <a href="https://p3cap.vercel.app/doom/global/turn-left?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-turn-left.svg" alt="Turn left" width="132" />
      </a>
      <a href="https://p3cap.vercel.app/doom/global/forward?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-forward.svg" alt="Move forward" width="132" />
      </a>
      <a href="https://p3cap.vercel.app/doom/global/turn-right?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-turn-right.svg" alt="Turn right" width="132" />
      </a>
      <a href="https://p3cap.vercel.app/doom/global/shoot?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-shoot.svg" alt="Shoot" width="132" />
      </a>
      <br />
      <a href="https://p3cap.vercel.app/doom/global/strafe-left?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-strafe-left.svg" alt="Step left" width="132" />
      </a>
      <a href="https://p3cap.vercel.app/doom/global/backward?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-backward.svg" alt="Move backward" width="132" />
      </a>
      <a href="https://p3cap.vercel.app/doom/global/strafe-right?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-strafe-right.svg" alt="Step right" width="132" />
      </a>
      <a href="https://p3cap.vercel.app/doom/global/wait?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-wait.svg" alt="Wait" width="132" />
      </a>
    </td>
  </tr>
</table>

<h4>README-DOOM</h4>
<p>Primitive README FPS with generated mazes, bigger floors as you descend, and deterministic turn-step input.</p>
<sub>Change `/doom/global/` to `/doom/&lt;YOUR_LOBBY&gt;/` in the URLs if you want a private run.</sub>

</div>

<details>
<summary>How this game works</summary>

- The game is a tiny corridor crawler dressed like a 1990s DOS shooter.
- Every click performs exactly one deterministic action: move, turn, strafe, shoot, or wait.
- After your action resolves, the world advances one step and enemies take theirs.
- Each new floor generates a fresh random maze, and later floors expand the map size.
- The renderer swaps between retro texture variants for walls, floors, ceilings, enemies, and the gun.
- The lobby lives in the URL, so `doom/global` and `doom/my-squad` are separate saves.

</details>

<details>
<summary>How to make your own lobby</summary>

1. Copy this `README.md` into your profile repo.
2. Replace `https%3A%2F%2Fgithub.com%2Fp3cap` in the links with your exact GitHub profile URL (URL-encoded).
3. Change every `/doom/global/` segment to something like `/doom/my-lobby/`.
4. Push the README and open your GitHub profile.

</details>

<details>
<summary>Manual textures</summary>

- Drop your own texture files into `Server/assets/doom/`.
- Supported prefixes are `wall-front`, `wall-side`, `ceiling`, `floor`, `enemy-imp`, and `gun`.
- You can add multiple variants like `wall-front-a.png` and `wall-front-b.png`; the renderer will pick from them automatically.
- If a texture prefix is missing, Doom falls back to built-in retro textures.

</details>

<p align="center">
  <sub>Made by <a href="https://github.com/p3cap">P3cap</a> with <a href="https://github.com/codex">Codex</a></sub>
</p>

