/* Proprietary and confidential. See LICENSE. */
/* Prefer WebP with PNG fallback. Public-path safe; keeps original query/hash. */
export function asWebpIfPresent(pngPath) {
  try {
    if (typeof pngPath !== "string") return { webp: null, png: pngPath };
    const base = pngPath.replace(/\?.*$/, "");
    const query = pngPath.includes("?") ? "?" + pngPath.split("?")[1] : "";
    const webp = base.replace(/\.png$/i, ".webp") + query;
    // We cannot synchronously probe file existence at runtime; assume parallel .webp exists.
    return { webp, png: pngPath };
  } catch {
    return { webp: null, png: pngPath };
  }
}

/* React helper: produces a <picture> with <img> fallback. */
export function PictureWebp({
  srcPng,
  alt = "",
  imgProps = {},
  sourceProps = {},
}) {
  const { webp, png } = asWebpIfPresent(srcPng);
  return (
    <picture>
      {webp ? (
        <source type="image/webp" srcSet={webp} {...sourceProps} />
      ) : null}
      {/* keep loading/decoding hints; width/height if known to prevent CLS */}
      <img src={png} alt={alt} loading="lazy" decoding="async" {...imgProps} />
    </picture>
  );
}
