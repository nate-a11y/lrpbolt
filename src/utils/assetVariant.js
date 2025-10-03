/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useMemo, useState } from "react";

/* Prefer WebP with PNG fallback. Public-path safe; keeps original query/hash. */
export function asWebpIfPresent(pngPath) {
  try {
    if (typeof pngPath !== "string") return { webp: null, png: pngPath };
    const base = pngPath.replace(/\?.*$/, "");
    if (!/\.png$/i.test(base)) return { webp: null, png: pngPath };
    const queryIndex = pngPath.indexOf("?");
    const query = queryIndex >= 0 ? pngPath.slice(queryIndex) : "";
    const webp = base.replace(/\.png$/i, ".webp") + query;
    return { webp, png: pngPath };
  } catch {
    return { webp: null, png: pngPath };
  }
}

const webpAvailabilityCache = new Map();

function resolveCachedAvailability(url) {
  const cached = webpAvailabilityCache.get(url);
  if (typeof cached === "boolean") return cached;
  return null;
}

function ensureWebpAvailability(url) {
  if (!url) return false;
  const cached = webpAvailabilityCache.get(url);
  if (cached instanceof Promise) return cached;
  if (typeof cached === "boolean") return cached;
  if (typeof window === "undefined" || typeof fetch !== "function") {
    webpAvailabilityCache.set(url, false);
    return false;
  }

  const request = fetch(url, { method: "HEAD" })
    .then((response) => {
      const ok = response.ok;
      webpAvailabilityCache.set(url, ok);
      return ok;
    })
    .catch(() => {
      webpAvailabilityCache.set(url, false);
      return false;
    });

  webpAvailabilityCache.set(url, request);
  return request;
}

/* React helper: produces a <picture> with <img> fallback. */
export function PictureWebp({
  srcPng,
  alt = "",
  imgProps = {},
  sourceProps = {},
}) {
  const { webp, png } = useMemo(() => asWebpIfPresent(srcPng), [srcPng]);
  const [useWebp, setUseWebp] = useState(() =>
    webp ? resolveCachedAvailability(webp) === true : false,
  );

  useEffect(() => {
    if (!webp) {
      setUseWebp(false);
      return;
    }

    const cached = resolveCachedAvailability(webp);
    if (cached !== null) {
      setUseWebp(cached);
      return;
    }

    let cancelled = false;
    const result = ensureWebpAvailability(webp);

    if (result instanceof Promise) {
      result.then((ok) => {
        if (!cancelled) setUseWebp(ok);
      });
    } else {
      setUseWebp(result === true);
    }

    return () => {
      cancelled = true;
    };
  }, [webp]);

  const { onError: userOnError, ...restImgProps } = imgProps || {};

  const handleImgError = useCallback(
    (event) => {
      if (useWebp && webp) {
        webpAvailabilityCache.set(webp, false);
        setUseWebp(false);
        event.currentTarget.src = png;
      }
      if (typeof userOnError === "function") {
        userOnError(event);
      }
    },
    [png, useWebp, userOnError, webp],
  );

  const source = useWebp ? webp : null;
  const imgSrc = useWebp && webp ? webp : png;

  return (
    <picture>
      {source ? (
        <source type="image/webp" srcSet={source} {...sourceProps} />
      ) : null}
      {/* keep loading/decoding hints; width/height if known to prevent CLS */}
      <img
        key={imgSrc}
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={handleImgError}
        {...restImgProps}
      />
    </picture>
  );
}
