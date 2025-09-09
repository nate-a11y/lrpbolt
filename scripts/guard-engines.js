// Proprietary and confidential. See LICENSE.
import fs from "fs";
const pkg = JSON.parse(fs.readFileSync("./package.json","utf8"));
const eng = pkg.engines?.node || "";
const pm  = pkg.packageManager || "";
if (!/^>=22\s*<23$/.test(eng)) {
  console.error(`[guard] engines.node must be ">=22 <23", found "${eng}".`);
  process.exit(1);
}
if (!pm.startsWith("npm@11")) {
  console.error(`[guard] packageManager must be npm@11.x, found "${pm}".`);
  process.exit(1);
}
