/* LRP Portal enhancement: ticket export utilities, 2025-10-03. */
import * as htmlToImage from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";

/** Renders a DOM node to PNG data URL. Caller must pass a stable node (e.g., ticket preview). */
export async function nodeToPngDataUrl(node, { pixelRatio = 2 } = {}) {
  if (!node) throw new Error("node required");
  return htmlToImage.toPng(node, { pixelRatio });
}

/** Accepts an array of { name, dataUrl } and downloads a ZIP */
export async function downloadZipFromPngs(files, zipName = "tickets.zip") {
  const zip = new JSZip();
  files.forEach((f) => {
    const { name, dataUrl } = f || {};
    if (!name || !dataUrl) return;
    const base64 = dataUrl.split(",")[1];
    zip.file(`${name}.png`, base64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipName);
}

/** Export pattern:
 * Pass a ref or selector that can render ticket previews offscreen in a loop, then collect PNGs -> zip.
 */
export async function exportTicketNodesAsZip(
  nodes = [],
  { zipName = "tickets.zip" } = {},
) {
  const files = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const dataUrl = await nodeToPngDataUrl(nodes[i]);
    files.push({
      name: nodes[i].dataset?.ticketName || `ticket-${i + 1}`,
      dataUrl,
    });
  }
  await downloadZipFromPngs(files, zipName);
}
