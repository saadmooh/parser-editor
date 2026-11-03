Water maps copied from the Pascal Pool plugin's `src/shader/assets/water` for its Crystal clear surface shader:

- `normal.webp` is `normal1.webp`.
- `noise.webp` is `noise2.webp`.
- `shoreline.webp` is `white.webp`.

The Pool surface material and preset settings are copied into `pool-surface.ts` and `pool-surface-presets.ts`. Surface shader equations are checked against the Pool source by a parity test. Texture data is shared across pond instances with last-owner disposal. See LICENSE.
