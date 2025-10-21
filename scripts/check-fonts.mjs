import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.cwd());
const fontsDir = path.join(root, "public", "assets", "fonts");

const needed = ["Boardson.woff2", "CelebriSans-Bold.woff2"];

async function run() {
  try {
    const files = await fs.readdir(fontsDir);
    const missing = needed.filter((n) => !files.includes(n));
    if (missing.length) {
      // eslint-disable-next-line no-console
      console.warn(
        "\n⚠️  Brand font files not found in /public/assets/fonts:",
        missing.join(", "),
        "\n   The app will use Inter fallbacks and will NOT make network font requests (no 404s).\n",
      );
    } else {
      // eslint-disable-next-line no-console
      console.log("✅ Brand fonts present:", needed.join(", "));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `\n⚠️  Fonts folder missing (${fontsDir}). Create it and add: ${needed.join(", ")}\n`,
    );
  }
}
run();
