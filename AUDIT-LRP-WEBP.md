# Audit — Drop-Off WebP Preference

## Summary
- Added `src/utils/assetVariant.js` to resolve WebP variants and render `<PictureWebp>` wrappers for Drop-Off imagery.
- Updated `src/components/DriverInfoTab.jsx` to serve Drop-Off lightbox assets through `<PictureWebp>` with WebP-first `source` tags.
- Documented the convention in `src/agents/agents.json` so automation enforces WebP + PNG fallbacks for Drop-Off assets.

## Notes
- `PictureWebp` preserves original PNG paths (with query/hash) and assumes sibling `.webp` assets exist per Drop-Off image.
- Lightbox previews keep prior sizing/contain behavior via `imgProps` style overrides while benefiting from WebP delivery.
- No CSS backgrounds referenced Drop-Off art; none required `image-set` updates in this pass.
