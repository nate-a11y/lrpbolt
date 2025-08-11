/* Proprietary and confidential. See LICENSE. */
export function toWebpIfAvailable(srcPath) {
  // For public assets referenced by absolute path like /DropOffPics/Name.png
  if (!srcPath || typeof srcPath !== "string") return srcPath;
  if (!srcPath.toLowerCase().startsWith("/dropoffpics/")) return srcPath;
  return srcPath.replace(/\.(png|jpg|jpeg)$/i, ".webp");
}
