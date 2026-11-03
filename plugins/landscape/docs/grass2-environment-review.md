# Grass 2: lessons from the Environment plugin

Reviewed the installed `@pascal-app/plugin-environment` on 2026-09-29.
The editor pins `AxiomeCG/environment` at
`1aa0bc3cbed273dbf751e9af79e446f6de105c90`.
These are source-level findings, not comparative FPS measurements.

## Implemented improvements

1. **Shared wind.** Grass and complete flowers use common world-space broad
   waves and smaller ripples. Flower heads and stem tips receive the same
   displacement. Bounds include sway.

2. **Ground/root blending.** Both grass styles sample the same texture used
   by their ground surface at each root. The sample is computed in the vertex
   shader and interpolated. Blades blend toward their tip color; billboard
   tips retain atlas shading.

3. **Partial updates.** Live geometry rebuilds retain the existing stream.
   Unchanged tiles keep their meshes and instance buffers. Terrain edits
   upload changed height ranges; footprint edits replace affected tiles,
   including a margin for edge response. Wind-only edits update uniforms.
   The ground surface itself still rebuilds through the existing lifecycle.

4. **Projected-size detail and reduced geometry.** Detail uses physical screen
   pixels, camera projection, viewport size and object scale, with hysteresis.
   Thresholds are 24, 10 and 0.8 pixels. Blade tufts use 21 triangles near,
   four in the middle, and two far away. Flowers use stable instance prefixes
   and reduced petal and center triangles at the middle and far levels while
   retaining both crossed stem faces. For example, dandelions use 64, 34 and
   20 triangles across the three visible levels.

5. **Curved blades and lighting.** Near blades have curved profiles and
   root-pinned bending. Blade mode now defaults to scene lighting, with softer
   normals and restrained sunlight transmission at tips. The Scene lighting
   switch restores flat shading. Billboards retain their pre-shaded material.
   Near geometry increases from 7 to 21 triangles per tuft. Blade and billboard
   styles remain distinct at every distance. These are quality/performance
   tradeoffs, not a measured universal speedup.

6. **Detailed flowers and soft edges.** Each flower species uses its original
   petal geometry and a thicker crossed stem in one instanced mesh. The stem
   remains attached to the head at every detail level. This can use up to four
   flower draw calls per populated patch; it restores the flower shape lost
   with the shared atlas.
   Within 0.45 metres of boundaries, plants gently bend inward and shorten,
   while roots remain strictly excluded from pools and paving.

7. **Camera-bounded tile selection.** Live streaming clips the camera frustum
   to the grass height range before scanning tile coordinates. A one-tile
   margin preserves edge candidates accepted by the existing box/frustum
   test. A small view over a large area now examines nearby tiles instead of
   every tile in the area.

## Preserved behavior

Grass 2 retains blade/billboard selection, fixed density per square metre,
seeded placement, 8-metre live tiles, instancing, progressive streaming,
a bounded offscreen cache and padded culling bounds. Growing the area adds
plants rather than spreading existing plants farther apart.

## Validation

The 28 dedicated Grass 2, streaming and improvement tests pass, including
the eight-angle flower visibility regression, bounded tile scanning,
transformed perspective views, terrain buffer reuse and safe stream transfer
during host geometry disposal. Landscape TypeScript checks pass. The full
package suite has 179 passing tests and one unrelated manifest expectation
that omits the currently registered tree node. Blades, billboards and flowers
were checked in the live WebGPU viewer at close zoom. The temporary
verification scene was removed.

Large-scene before/after frame-time measurements remain necessary to quantify
performance gains and tune the close-up quality budget for target devices.
A 40-by-40-metre live scene at maximum grass density held the browser's 120 Hz
refresh cap before and after the flower LOD change, so that run cannot
establish an FPS gain.
