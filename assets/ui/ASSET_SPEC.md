# UI SVG Asset Spec

Place all hand-drawn UI SVG assets in:

- `assets/ui/`

Use these filenames so the app can wire them directly:

- `assets/ui/button-rect.svg`
  Generic rectangular instrument button shell.
  Used for `UPLOAD`, `RESET`, `RANDOM`.
  Suggested artboard: `56 x 25`

- `assets/ui/button-rect-onclick.svg`
  Generic rectangular instrument button shell.
  Used for `UPLOAD`, `RESET`, `RANDOM`.
  Suggested artboard: `56 x 25`

- `assets/ui/button-print.svg`
  Generic rectangular instrument button shell.
  Used for `PRINT`.
  Suggested artboard: `56 x 25`

- `assets/ui/button-print-onclick.svg`
  Generic rectangular instrument button shell.
  Used for `PRINT`.
  Suggested artboard: `56 x 25`

- `assets/ui/slider-horizontal.svg`
  Horizontal mixer-style slider frame only.
  Used for the `ZOOM` control background.
  Suggested artboard: `135 x 5`

- `assets/ui/slider-thumb.svg`
  Slider thumb / handle for `ZOOM`.
  Suggested artboard: `30 x 12`

- `assets/ui/toggle-up.svg`
  old-instrument toggle switch flipped upward .
  Used for `INVERT` and `PNG / SVG`.
  Suggested artboard: `27 x 40`

- `assets/ui/toggle-down.svg`
  old-instrument toggle switch flipped downward.
  Used for `INVERT` and `PNG / SVG`.
  Suggested artboard: `27 x 40`

- `assets/ui/jack.svg`
  Modular-synth style effect jack.
  Used for all effect sockets and the source socket.
  Suggested artboard: `35 x 35`

- `assets/ui/icon-unknown.svg`
  effect icon for `unknown pleasures`.
  Place it above the effect text.
  Suggested artboard: `35 x 7`

- `assets/ui/icon-known.svg`
  effect icon for `known pleasures`.
  Place it above the effect text.
  Suggested artboard: `35 x 7`

- `assets/ui/icon-groove.svg`
  effect icon for `groove`.
  Place it above the effect text.
  Suggested artboard: `35 x 7`

- `assets/ui/icon-fuzz.svg`
  effect icon for `fuzz`.
  Place it above the effect text.
  Suggested artboard: `35 x 7`

- `assets/ui/icon-atomize.svg`
  effect icon for `atomize`.
  Place it above the effect text.
  Suggested artboard: `35 x 7`

- `assets/ui/icon-chaos.svg`
  effect icon for `chaos`.
  Place it above the effect text.
  Suggested artboard: `35 x 7`

- `assets/ui/knob-face.svg`
  Knob face only.
  Used by all parameter knobs.
  Suggested artboard: `48 x 48`

- `assets/ui/knob-ticks.svg`
  Tick ring around a knob.
  Suggested artboard: `60 x 60`

- `assets/ui/screen-lcd-frame.svg`
  Small screen bezel / mask.
  Suggested artboard: `200 x 200`

- `assets/ui/screen-crt-frame.svg`
  Large screen bezel / mask.
  Suggested artboard: `440 x 440`

- `assets/ui/logo-orb.svg`
  Static black circular logo base.
  Suggested artboard: `56 x 56`

- `assets/ui/logo-rotor.svg`
  Inner rotating logo graphic.
  Suggested artboard: `36 x 31`

- `assets/ui/logo-Oscilloscope.svg`
  The text logo placed on the right side of the static black circular logo base.
  Suggested artboard: `33 x 42`

- `assets/ui/counter-frame.svg`
  Optional frame for the download counter.
  Suggested artboard: `200 x 30`

Implementation notes:

- Please keep SVGs as flat vectors.
- Prefer `viewBox` matching the suggested artboard.
- Use transparent background unless the asset itself needs a fill.
- If possible, keep decorative outlines in black so we can recolor in CSS less often.
- For assets with moving parts, split static and moving parts into separate files.
- Text labels do not need to be baked into the SVG unless you want a very specific engraved look.

If you want the fastest path, these are the highest-priority files:

- `button-rect.svg`
- `toggle-vertical.svg`
- `toggle-knob.svg`
- `jack.svg`
- `slider-horizontal.svg`
- `slider-thumb.svg`
- `logo-orb.svg`
- `logo-rotor.svg`
