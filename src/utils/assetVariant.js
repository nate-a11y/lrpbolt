/* Prefer WebP filename beside PNG; no detection here. */
export function asWebpIfPresent(pngPath) {
  try {
    if (typeof pngPath !== "string") return { webp: null, png: pngPath };
    const [base, query = ""] = pngPath.split("?");
    const q = query ? `?${query}` : "";

    // For DropOffPics, WebP files are in /webp/DropOffPics/
    let webp;
    if (base.includes("/DropOffPics/")) {
      webp =
        base
          .replace(/\/DropOffPics\//i, "/webp/DropOffPics/")
          .replace(/\.png$/i, ".webp") + q;
    } else {
      webp = base.replace(/\.png$/i, ".webp") + q;
    }

    return { webp, png: pngPath };
  } catch {
    return { webp: null, png: pngPath };
  }
}

export function imageSetFor(pngPath) {
  const { webp, png } = asWebpIfPresent(pngPath);
  if (!webp) return `url("${png}")`;
  return `image-set(url("${webp}") type("image/webp"), url("${png}") type("image/png"))`;
}
