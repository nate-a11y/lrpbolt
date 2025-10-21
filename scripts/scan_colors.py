# scripts/scan_colors.py
# CI guard: scans repo for color literals outside allowed areas.
# Allows centralized theme gradient and its token usage.

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

INCLUDE_EXT = {".js", ".jsx", ".css"}
EXCLUDE_DIRS_PREFIX = {
    str(SRC / "theme"),  # theme is allowed to carry brand hex/gradient
}
EXCLUDE_GLOBS_SUFFIX = {
    ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif",
}

EXCLUDE_FILE_MARKER = "allow-color-literal-file"

PATTERNS = [
    (re.compile(r"#[0-9a-fA-F]{3,8}\b"), "hex color"),
    (re.compile(r"\brgba?\s*\(\s*\d{1,3}\s*,\s*\d{1,3}"), "rgb/rgba()"),
    (re.compile(r"\bhsla?\s*\(\s*\d{1,3}\s*,\s*\d{1,3}%"), "hsl/hsla()"),
    (re.compile(r"\b(white|black|red|blue|green|yellow|orange|purple|gray|grey|whitesmoke|gainsboro|ghostwhite|snow|floralwhite)\b", re.IGNORECASE), "named color"),
    # gradients: only flag outside of theme unless token-based usage
    (re.compile(r"linear-gradient\([^)]*\)"), "linear-gradient"),
]

# Lines mentioning these tokens are OK (theme-driven usage)
ALLOW_LIST_LINE = re.compile(
    r"""
    (theme\.palette)|
    (background\.(paper|default))|
    (text\.(primary|secondary))|
    (divider)|
    (primary\.main)|
    (palette\.brand)|
    (palette\.lrp)|
    (theme\.palette\.lrp\.(gradient|gradientPanel|gradientRing))|
    (palette\.common)|
    (palette\.(?:grey|error|warning|success|info))|
    (grey\.\d{3})|
    (common\.(white|black))|
    (\(theme\)\s*=>\s*\(theme\.palette\.lrp)   # tokened gradient usage
    """,
    re.VERBOSE,
)

def is_excluded(path: pathlib.Path) -> bool:
    s = str(path)
    if any(s.startswith(p) for p in EXCLUDE_DIRS_PREFIX):
        return True
    if any(s.lower().endswith(ext) for ext in EXCLUDE_GLOBS_SUFFIX):
        return True
    return False


def main() -> int:
    violations = []
    for f in SRC.rglob("*"):
        if not f.is_file():
            continue
        if f.suffix.lower() not in INCLUDE_EXT:
            continue
        if is_excluded(f):
            continue
        try:
            txt = f.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            print(f"Skipping {f}: {e}")
            continue

        if EXCLUDE_FILE_MARKER in txt:
            continue

        for rx, label in PATTERNS:
            for m in rx.finditer(txt):
                line_start = txt.rfind("\n", 0, m.start()) + 1
                line_end = txt.find("\n", m.end())
                if line_end == -1:
                    line_end = len(txt)
                line = txt[line_start:line_end]
                stripped = line.strip()

                if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*") or stripped.startswith("*/"):
                    continue

                # Allow if line is token-based or explicitly allowed
                if ALLOW_LIST_LINE.search(line):
                    continue
                if "allow-color-literal" in line:
                    continue

                preview = line.strip()
                violations.append((str(f), label, preview[:200]))

    if violations:
        print("\n❌ Hard-coded color literals detected outside theme/assets:\n")
        for path, label, preview in violations[:80]:
            print(f"- [{label}] {path}\n  … {preview}\n")
        print("Use MUI tokens (e.g., bgcolor: 'background.paper', color: 'text.primary', borderColor: 'divider', or theme.palette.lrp.gradient).\n")
        return 1

    print("✅ No disallowed color literals found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
