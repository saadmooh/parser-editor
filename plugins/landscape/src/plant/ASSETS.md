# Plant catalog sources

- `assets/fab-models/` contains 40 GLBs exported from the saved FABOTANIC generator in the sibling `ref/fab-botanic/` folder. Exports use the generator's default settings with draft geometry and 256 px textures, except Oak and Ginkgo, which use balanced geometry. The PNG previews in `assets/fab/` come from that saved generator page. FABOTANIC's displayed terms permit generated materials to be incorporated into a project, but prohibit selling or redistributing them as standalone assets.
- The 13 Claude tree and shrub forms use the reference's `treegeo.js` generator and baked leaf atlas through `rendering/claude-tree.tsx`. Its custom lighting, wind, and instancing shaders are not included. Claude ground plants, Grassworks grass species, and Grass2 flowers use editable local procedural approximations in `rendering/geometry.ts`.

SeedThree trees remain in the separate `tree/` node and catalog.
