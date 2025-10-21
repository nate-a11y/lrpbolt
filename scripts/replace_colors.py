# scripts/replace_colors.py
# Purges hard-coded colors from JS/JSX and replaces with MUI theme tokens.
# Also rewrites inline gradients to theme.palette.lrp.gradient with a safe fallback,
# and patches the theme to define palette.lrp.gradient if missing.
# Idempotent and safe to re-run.

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

INCLUDE_EXT = {".js", ".jsx"}
EXCLUDE_DIRS = {str(SRC / "theme")}
BINARY_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}

DEFAULT_GRADIENT = "linear-gradient(180deg, rgba(76,187,23,0.18) 0%, rgba(6,6,6,0) 100%)"

# --- Regex patterns ---
# Anything that looks like a linear-gradient(...) literal (single or double quoted)
GRADIENT_VALUE = r"linear-gradient\([^'\"\n]+?\)"
QUOTED_GRADIENT = rf"['\"]{GRADIENT_VALUE}['\"]"

# Matches background/backgroundImage assignments in objects/sx/style:
#   backgroundImage: 'linear-gradient(...)'
#   background: "linear-gradient(...)"
BG_KEY = r"(backgroundImage|background)"
BG_ASSIGN = re.compile(rf"({BG_KEY})\s*:\s*{QUOTED_GRADIENT}")

# Matches style={{ backgroundImage: 'linear-gradient(...)' }} (convert to sx with token)
STYLE_BG_ASSIGN = re.compile(
    rf"style\s*=\s*{{\s*{BG_KEY}\s*:\s*{QUOTED_GRADIENT}\s*}}"
)

# Convert style -> sx helpers (must run early to avoid conflicts)
STYLE_TO_SX_BG = re.compile(r"style\s*=\s*{{\s*backgroundColor\s*:")
STYLE_TO_SX_FG = re.compile(r"style\s*=\s*{{\s*color\s*:")

# General color offenders
REPLACEMENTS = [
    # style -> sx (first)
    (STYLE_TO_SX_BG, "sx={{ bgcolor:"),
    (STYLE_TO_SX_FG, "sx={{ color:"),

    # foreground whites -> text.primary
    (re.compile(r"color:\s*['\"]?\s*white\s*['\"]?", re.IGNORECASE), "color: 'text.primary'"),
    (re.compile(r"color:\s*['\"]?\s*#fff(?:ff)?\s*['\"]?", re.IGNORECASE), "color: 'text.primary'"),

    # backgrounds -> paper/default
    (re.compile(r"(?:background|backgroundColor|bgcolor)\s*:\s*['\"]?\s*white\s*['\"]?", re.IGNORECASE),
     "bgcolor: 'background.paper'"),
    (re.compile(r"(?:background|backgroundColor|bgcolor)\s*:\s*['\"]?\s*#fff(?:ff)?\s*['\"]?", re.IGNORECASE),
     "bgcolor: 'background.paper'"),
    (re.compile(r"(?:background|backgroundColor|bgcolor)\s*:\s*['\"]?\s*black\s*['\"]?", re.IGNORECASE),
     "bgcolor: 'background.default'"),

    # stray black text -> theme-driven
    (re.compile(r"color:\s*['\"]?\s*black\s*['\"]?", re.IGNORECASE), "color: 'text.primary'"),

    # borders (hex) -> divider
    (re.compile(r"borderColor:\s*['\"]?#(?:[0-9a-fA-F]{3,8})['\"]?"), "borderColor: 'divider'"),
    (re.compile(r"border:\s*['\"][^'\"]*#(?:[0-9a-fA-F]{3,8})[^'\"]*['\"]"), "border: 1, borderColor: 'divider'"),

    # greys used as surfaces -> paper
    (re.compile(r"theme\.palette\.grey\[\s*900\s*\]"), "theme.palette.background.paper"),
    (re.compile(r"theme\.palette\.grey\[\s*100\s*\]"), "theme.palette.background.paper"),

    # tooltip hacks -> tokens
    (re.compile(r"['\"]#111['\"]"), "(theme) => theme.palette.background.default"),
    (re.compile(r"['\"]#2f2f2f['\"]"), "(theme) => theme.palette.background.paper"),
]

# Replacement for any detected gradient
GRADIENT_TOKEN_EXPR = f"(theme) => (theme.palette.lrp && theme.palette.lrp.gradient) || '{DEFAULT_GRADIENT}'"

def should_skip(path: pathlib.Path) -> bool:
    p = str(path)
    if any(p.startswith(d) for d in EXCLUDE_DIRS):
        return True
    if path.suffix.lower() in BINARY_EXT:
        return True
    return False


def rewrite_gradients_in_text(txt: str) -> str:
    # 1) Replace plain object/sx background/backgroundImage linear-gradients
    def _bg_assign_replacer(match: re.Match) -> str:
        return f"backgroundImage: {GRADIENT_TOKEN_EXPR}"

    txt = BG_ASSIGN.sub(_bg_assign_replacer, txt)

    # 2) Replace style={{ backgroundImage: 'linear-gradient(...)' }} with sx and token
    #    style={{ background: 'linear-gradient(...)' }} -> sx={{ backgroundImage: (theme)=>... }}
    def _style_bg_replacer(match: re.Match) -> str:
        key = match.group(1)
        # normalize to backgroundImage in sx
        return f"sx={{ backgroundImage: {GRADIENT_TOKEN_EXPR} }}"
    txt = STYLE_BG_ASSIGN.sub(_style_bg_replacer, txt)

    # 3) Replace any remaining quoted gradient literals that appear as values for backgroundImage within sx objects
    #    This is a broad fallback: sx={{ backgroundImage: 'linear-gradient(...)' }}
    sx_bg_literal = re.compile(rf"sx\s*=\s*{{[^}}]*backgroundImage\s*:\s*{QUOTED_GRADIENT}[^}}]*}}")
    txt = sx_bg_literal.sub(lambda m: re.sub(QUOTED_GRADIENT, GRADIENT_TOKEN_EXPR, m.group(0)), txt)

    # 4) Replace any 'background: "linear-gradient(...)' in sx objects with backgroundImage token usage
    sx_bg_prop_literal = re.compile(rf"sx\s*=\s*{{[^}}]*\bbackground\s*:\s*{QUOTED_GRADIENT}[^}}]*}}")
    def _sx_bg_prop_to_image(m: re.Match) -> str:
        inner = m.group(0)
        inner = re.sub(r"\bbackground\s*:\s*"+QUOTED_GRADIENT, f"backgroundImage: {GRADIENT_TOKEN_EXPR}", inner)
        return inner
    txt = sx_bg_prop_literal.sub(_sx_bg_prop_to_image, txt)

    return txt


def rewrite_file(path: pathlib.Path) -> bool:
    txt = path.read_text(encoding="utf-8", errors="ignore")
    orig = txt

    # generic replacements
    for pattern, repl in REPLACEMENTS:
        txt = pattern.sub(repl, txt)

    # gradient rewrites
    txt = rewrite_gradients_in_text(txt)

    if txt != orig:
        path.write_text(txt, encoding="utf-8")
        return True
    return False


# ---------------- Theme patching to ensure palette.lrp.gradient exists ----------------

# crude but robust-ish finder for "palette: { ... }" blocks in theme files
PALETTE_BLOCK = re.compile(r"palette\s*:\s*{(?P<body>.*?)}", re.DOTALL)
LRP_DECL = re.compile(r"\blrp\s*:\s*{[^}]*\bgradient\b\s*:", re.DOTALL)

def ensure_theme_gradient() -> int:
    theme_dir = SRC / "theme"
    if not theme_dir.exists():
        return 0

    inserted = 0
    for f in theme_dir.rglob("*.js"):
        try:
            txt = f.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        # If already has palette.lrp.gradient anywhere, skip
        if "palette.lrp.gradient" in txt or LRP_DECL.search(txt):
            continue

        # Try to inject lrp into the palette object
        def _inject(match: re.Match) -> str:
            body = match.group("body")
            # Prefer to insert after "brand:" if present
            brand_pos = re.search(r"\bbrand\s*:\s*[^,}]+", body)
            insert_snippet = f",\n      lrp: {{ gradient: '{DEFAULT_GRADIENT}' }}\n"
            if brand_pos:
                idx = brand_pos.end()
                new_body = body[:idx] + insert_snippet + body[idx:]
                return f"palette: {{{new_body}}}"
            # Else try to insert before closing brace of palette
            new_body = body.rstrip()
            if new_body.endswith(","):
                new_body = new_body + f"\n      lrp: {{ gradient: '{DEFAULT_GRADIENT}' }}\n"
            else:
                new_body = new_body + f",\n      lrp: {{ gradient: '{DEFAULT_GRADIENT}' }}\n"
            return f"palette: {{{new_body}}}"

        new_txt, n = PALETTE_BLOCK.subn(_inject, txt, count=1)
        if n == 0:
            # As a fallback, append a safe extender after createTheme result:
            # e.g., let theme = createTheme(base); theme.palette.lrp = { gradient: '...' };
            if "createTheme(" in txt:
                new_txt = txt + f"\n\n// auto-added by replace_colors.py\n" \
                                f"try {{ if (theme && theme.palette && !theme.palette.lrp) {{ theme.palette.lrp = {{ gradient: '{DEFAULT_GRADIENT}' }}; }} }} catch (e) {{ /* no-op */ }}\n"
                n = 1
            else:
                new_txt = txt

        if n:
            try:
                f.write_text(new_txt, encoding="utf-8")
                inserted += 1
            except Exception:
                pass

    return inserted


def main() -> int:
    changed = 0
    scanned = 0
    for f in SRC.rglob("*"):
        if not f.is_file():
            continue
        if f.suffix.lower() not in INCLUDE_EXT:
            continue
        if should_skip(f):
            continue
        scanned += 1
        if rewrite_file(f):
            changed += 1

    patched = ensure_theme_gradient()
    print(f"Scanned: {scanned} files; Modified: {changed} files; Theme patched: {patched} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
