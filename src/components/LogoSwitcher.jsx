import PropTypes from "prop-types";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";

import logoFullColor from "@/assets/lrp/logo-fullcolor.svg";
import logoWhite from "@/assets/lrp/logo-white.svg"; // allow-color-literal
import logoBlack from "@/assets/lrp/logo-black.svg"; // allow-color-literal

const VARIANT = {
  AUTO: "auto",
  FULL: "full",
  LIGHT: "white", // allow-color-literal
  DARK: "black", // allow-color-literal
};

const LOGO_SOURCES = {
  [VARIANT.FULL]: logoFullColor,
  [VARIANT.LIGHT]: logoWhite,
  [VARIANT.DARK]: logoBlack,
};

/**
 * Picks the appropriate logo variant using the current palette.
 * Full color is reserved for brand black backgrounds, white is
 * used on dark/colored contexts, and black on very light surfaces.
 */
export default function LogoSwitcher({
  variant = VARIANT.AUTO,
  size = 40,
  sx = {},
}) {
  const theme = useTheme();

  let src = LOGO_SOURCES[VARIANT.LIGHT];

  if (variant !== VARIANT.AUTO) {
    src = LOGO_SOURCES[variant] || LOGO_SOURCES[VARIANT.DARK];
  } else {
    const isDark = theme.palette.mode === "dark";
    const backgroundDefault = theme.palette?.background?.default;
    const brandBlack = theme.palette?.brand?.black;
    const onBrandBlack =
      typeof backgroundDefault === "string" &&
      typeof brandBlack === "string" &&
      backgroundDefault.trim().toLowerCase() ===
        brandBlack.trim().toLowerCase();

    if (isDark && onBrandBlack) {
      src = LOGO_SOURCES[VARIANT.FULL];
    } else if (isDark) {
      src = LOGO_SOURCES[VARIANT.LIGHT];
    } else {
      src = LOGO_SOURCES[VARIANT.DARK];
    }
  }

  return (
    <Box
      component="img"
      src={src}
      alt="Lake Ride Pros"
      sx={{
        display: "block",
        width: size,
        height: size,
        objectFit: "contain",
        ...sx,
      }}
    />
  );
}

LogoSwitcher.propTypes = {
  variant: PropTypes.oneOf(Object.values(VARIANT)),
  size: PropTypes.number,
  sx: PropTypes.oneOfType([PropTypes.array, PropTypes.func, PropTypes.object]),
};
