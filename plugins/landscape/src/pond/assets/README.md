# Komorebi terrain asset provenance

Source: https://water-opus.vercel.app/, downloaded 5 October 2026 at the user's request to implement the same natural pond construction. Creator credit: https://x.com/buildwithsid.

The eight JPG files are copied from the corresponding `/assets/terrain/{scan-name}/` directories. `rocks.json` is a lossless-topology extraction of pieces 2, 7, 13, 14 and 5 (LOD 0) and piece 2 (LOD 2) from `/assets/terrain/rocks/rocks.json` and `rocks.bin`. Floating point values are rounded to six decimal places. Mesh indices remain local to each piece.

`../wave-field.js` preserves the deployment's pure numerical Hx function with only its exported name changed. Terrain, wind and material formulas are translated into typed modules and native TSL. `../fish.ts` adapts Qv's body profile, curved fin outlines, marking variants and tail-bending formula into procedural geometry, generated textures and native TSL. Swimming and habitat checks support arbitrary authored ponds. Water moods and the GGX sun-glint formula also follow the deployed reference. The deployment did not supply an original-source project licence; this file records source provenance, not a licence grant.
