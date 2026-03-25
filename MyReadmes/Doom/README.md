<div align="center">

<table>
  <tr>
    <td align="center" valign="middle">
      <a href="https://p3cap.vercel.app/doom/global/turn-left?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-turn-left.svg" alt="Turn left" width="146" />
      </a>
      <br />
      <a href="https://p3cap.vercel.app/doom/global/forward?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-forward.svg" alt="Move forward" width="146" />
      </a>
      <br />
      <a href="https://p3cap.vercel.app/doom/global/strafe-left?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-strafe-left.svg" alt="Step left" width="146" />
      </a>
      <br />
      <a href="https://p3cap.vercel.app/doom/global/backward?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-backward.svg" alt="Move backward" width="146" />
      </a>
    </td>
    <td align="center" valign="middle">
      <img src="https://p3cap.vercel.app/doom/global/images/view.svg" alt="Retro Doom-like game screen" width="590" />
      <br />
      <sub><strong>STEP MODE</strong> | one click = one world update | enemies only move after your input</sub>
    </td>
    <td align="center" valign="middle">
      <a href="https://p3cap.vercel.app/doom/global/turn-right?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-turn-right.svg" alt="Turn right" width="146" />
      </a>
      <br />
      <a href="https://p3cap.vercel.app/doom/global/shoot?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-shoot.svg" alt="Shoot" width="146" />
      </a>
      <br />
      <a href="https://p3cap.vercel.app/doom/global/strafe-right?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-strafe-right.svg" alt="Step right" width="146" />
      </a>
      <br />
      <a href="https://p3cap.vercel.app/doom/global/wait?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
        <img src="https://p3cap.vercel.app/doom/global/images/button-wait.svg" alt="Wait" width="146" />
      </a>
    </td>
  </tr>
</table>

<h4>DOOM-PAD 94</h4>
<p>Primitive README FPS with flat-shaded corridors, sprite enemies, and deterministic turn-step input.</p>
<sub>Change `/doom/global/` to `/doom/&lt;YOUR_LOBBY&gt;/` in the URLs if you want a private run.</sub>

</div>

<details>
<summary>How this game works</summary>

- The game is a tiny corridor crawler dressed like a 1990s DOS shooter.
- Every click performs exactly one deterministic action: move, turn, strafe, shoot, or wait.
- After your action resolves, the world advances one step and enemies take theirs.
- The screen is meant to feel like a handheld console window with a fake low-res FPS display.
- The lobby lives in the URL, so `doom/global` and `doom/my-squad` are separate saves.

</details>

<details>
<summary>How to make your own lobby</summary>

1. Copy this `README.md` into your profile repo.
2. Replace `?redirect=https%3A%2F%2Fgithub.com%2Fp3cap` with your own GitHub profile URL.
3. Change every `/doom/global/` segment to something like `/doom/my-lobby/`.
4. Push the README and open your GitHub profile.

</details>

<details>
<summary>Manual textures</summary>

- Drop your own wall texture files into `Server/assets/doom/`.
- Supported names are `wall-front.*`, `wall-side.*`, `ceiling.*`, and `floor.*`.
- If a texture is missing, the renderer falls back to flat shading instead of generating noisy patterns.

</details>

<p align="center">
  <sub>Made by <a href="https://github.com/p3cap">P3cap</a> with <a href="https://github.com/codex">Codex</a></sub>
</p>
