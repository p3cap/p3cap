<div align="center">

<img src="https://p3cap.vercel.app/flappy/global/images/view.svg" alt="README Flappy animated screen" width="620" />

<br />

<a href="https://p3cap.vercel.app/flappy/global/tap?redirect=https%3A%2F%2Fgithub.com%2Fp3cap">
  <img src="https://p3cap.vercel.app/flappy/global/images/button-flap.svg" alt="Flap" width="220" />
</a>

<br />

<sub><strong>README-FLAPPY</strong> | animated SVG timing test | every tap has a little timing noise</sub>

</div>

<details>
<summary>How this experiment works</summary>

- The pipe animation restarts after every redirect, so the timing window is roughly synced to what you see.
- Your tap is judged against a narrow flap window with a small built-in error rate.
- The current cycle now previews the outcome: if you do nothing and the bird would hit the pipe, the SVG ends on `You deid`.
- Good timing carries the flap into the next generated cycle and advances the score.
- Pipe heights are randomized per cycle, and the same button starts a fresh game after a crash.

</details>

<details>
<summary>Why this is SVG and not GIF</summary>

- A true per-state animated GIF is much heavier to generate on this backend.
- Animated SVG is easier to ship here, easier to style, and still works as an image-based README experiment.
- If you really want a GIF version later, we'd probably want a dedicated GIF encoder or prebuilt frame pipeline.

</details>
