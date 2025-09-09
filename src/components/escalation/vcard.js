export function buildVCard(contact = {}) {
  const name = String(contact.name || "").trim();
  const [first = "", ...rest] = name.split(" ");
  const last = rest.pop() || "";
  const org = "Lake Ride Pros";
  const title = String(contact.roleLabel || contact.role || "").trim();
  const phone = String(contact.phone || "").trim();
  const email = String(contact.email || "").trim();

  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${last};${first};;;`,
    `FN:${name}`,
    `ORG:${org}`,
    title ? `TITLE:${title}` : "",
    phone ? `TEL;TYPE=CELL,VOICE:${phone}` : "",
    email ? `EMAIL;TYPE=INTERNET:${email}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");
}

export function downloadVCard(contact = {}) {
  const vcf = buildVCard(contact);
  const fileName = `${(contact.name || "contact").replace(/\s+/g, "_")}.vcf`;
  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
