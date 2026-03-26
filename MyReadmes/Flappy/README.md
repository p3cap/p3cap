<div align="center">

<img src="https://p3cap.vercel.app/flappy/global/images/view.svg" alt="README Flappy animated screen" width="620" />

<br />

<a href="https://p3cap.vercel.app/flappy/global/tap">
  <img src="https://p3cap.vercel.app/flappy/global/images/button-flap.svg" alt="Flap" width="220" />
</a>

<br />

<sub><strong>README-FLAPPY</strong> | animated SVG timing test | every tap has a little timing noise</sub>

</div>

<details>
<summary>How this experiment works</summary>

- The bird is always falling while pipes slide in, and the SVG predicts if/when you crash.
- Only taps update the game state, so every click returns a fresh animation cycle.
- The timing window is intentionally generous because the link has to load.
- If the SVG predicts a crash, it plays the `You deid` overlay at impact time.
- Successful taps advance to the next pipe and bump the score.
- Pipe heights are randomized per cycle, and the same button starts a fresh game after a crash.

</details>

<details>
<summary>Why this is SVG and not GIF</summary>

- A true per-state animated GIF is much heavier to generate on this backend.
- Animated SVG is easier to ship here, easier to style, and still works as an image-based README experiment.
- If you really want a GIF version later, we'd probably want a dedicated GIF encoder or prebuilt frame pipeline.

</details>

<details>
<summary>Bird assets</summary>

- You can drop `bird.png`, `bird.svg`, or another supported `bird.*` file into `Server/assets/flappy/`.
- The bird now renders only from an asset in `Server/assets/flappy/`.

</details>

