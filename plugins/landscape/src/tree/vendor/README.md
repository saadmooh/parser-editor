SeedThree source copied from https://github.com/SkyeShark/SeedThree at commit 85787bf
under its MIT license (see LICENSE).

The `ui/controls.js` copy retains only the pure parameter schema and mapping;
its lil-gui panel code was removed. `api/seedthree.js` exports
`composeMaterials` and returns generated stems so the landscape plugin can
load materials and orchard fruit for every species. The remaining generator
files are kept as source for the WebGPU tree geometry and materials.

The landscape plugin includes the texture maps used by all 20 species,
converted from the source PNGs to WebP. Apple and cherry fruit GLBs were
repacked with WebP images into lazy-loaded data modules so hosts do not need
a GLB asset loader. The original assets remain in the external reference copy.
