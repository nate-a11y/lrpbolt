/* Proprietary and confidential. See LICENSE. */
/**
 * contact: { firstName?, lastName?, name, phone?, email? }
 */
export function toVCard(contact = {}) {
  const n = (contact.name || "").trim();
  const parts = n.split(" ");
  const first = contact.firstName || parts.slice(0, -1).join(" ") || n;
  const last = contact.lastName || parts.slice(-1)[0] || "";
  const tel = (contact.phone || "").replace(/[^\d+]/g, "");
  const email = contact.email || "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${last};${first};;;`,
    `FN:${n}`,
    tel ? `TEL;TYPE=CELL:${tel}` : null,
    email ? `EMAIL;TYPE=INTERNET:${email}` : null,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function downloadVcards(filename, contacts = []) {
  const payload = contacts.map(toVCard).join("\r\n");
  const blob = new Blob([payload], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".vcf") ? filename : `${filename}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
