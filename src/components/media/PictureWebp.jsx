import React from "react";

import { asWebpIfPresent } from "@/utils/assetVariant";

export default function PictureWebp({
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
      <img src={png} alt={alt} loading="lazy" decoding="async" {...imgProps} />
    </picture>
  );
}
