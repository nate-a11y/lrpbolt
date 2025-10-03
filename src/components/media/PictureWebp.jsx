/* LRP fix: Prefer WebP first, no probes; PNG only as native fallback. 2025-10-03 */
import React from "react";

import { asWebpIfPresent } from "@/utils/assetVariant";

/**
 * Renders a picture with WebP preferred and PNG fallback.
 * No runtime probe. Modern browsers download only the chosen resource.
 */
export default function PictureWebp({
  srcPng,
  alt = "",
  imgProps = {},
  sourceProps = {},
}) {
  const { webp, png } = asWebpIfPresent(srcPng);
  return (
    <picture>
      {/* Put WebP first so the browser picks it immediately if supported */}
      {webp ? (
        <source type="image/webp" srcSet={webp} {...sourceProps} />
      ) : null}
      {/* PNG fallback (only loaded if WebP not supported or fails) */}
      <img src={png} alt={alt} loading="lazy" decoding="async" {...imgProps} />
    </picture>
  );
}
