/* Proprietary and confidential. See LICENSE. */

/**
 * Export contacts to CSV format
 */
export function exportToCSV(contacts, filename = "contacts.csv") {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    console.warn("No contacts to export");
    return;
  }

  // Determine if these are drivers or escalation contacts
  const isDrivers = contacts.some((c) => c.lrp || c.vehicles);

  let headers;
  let rows;

  if (isDrivers) {
    // Driver format
    headers = ["Name", "LRP #", "Phone", "Email", "Vehicles", "Roles"];
    rows = contacts.map((driver) => {
      const vehicles = Array.isArray(driver.vehicles)
        ? driver.vehicles.join("; ")
        : "";
      const roles = Array.isArray(driver.roles) ? driver.roles.join("; ") : "";
      return [
        driver.name || "",
        driver.lrp || "",
        driver.phone || "",
        driver.email || "",
        vehicles,
        roles,
      ];
    });
  } else {
    // Escalation contact format
    headers = ["Name", "Role", "Phone", "Email", "Responsibilities"];
    rows = contacts.map((contact) => {
      const responsibilities = Array.isArray(contact.responsibilities)
        ? contact.responsibilities.join("; ")
        : "";
      return [
        contact.name || "",
        contact.roleLabel || contact.role || "",
        contact.phone || "",
        contact.email || "",
        responsibilities,
      ];
    });
  }

  // Create CSV content
  const csvContent = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");

  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate vCard content for a contact
 */
function generateVCardContent(contact) {
  const name = contact.name || "Unknown";
  const phone = contact.phone || "";
  const email = contact.email || "";
  const role = contact.roleLabel || contact.role || contact.lrp || "";
  const org = "Lake Ride Pros";

  // Split name into parts
  const nameParts = name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  let vcard = "BEGIN:VCARD\n";
  vcard += "VERSION:3.0\n";
  vcard += `FN:${name}\n`;
  vcard += `N:${lastName};${firstName};;;\n`;

  if (role) {
    vcard += `TITLE:${role}\n`;
  }

  vcard += `ORG:${org}\n`;

  if (phone) {
    // Clean phone number
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    vcard += `TEL;TYPE=CELL:${cleanPhone}\n`;
  }

  if (email) {
    vcard += `EMAIL;TYPE=INTERNET:${email}\n`;
  }

  // Add responsibilities as notes for escalation contacts
  if (
    Array.isArray(contact.responsibilities) &&
    contact.responsibilities.length > 0
  ) {
    const note = contact.responsibilities.join("; ");
    vcard += `NOTE:${note}\n`;
  }

  // Add vehicles as notes for drivers
  if (Array.isArray(contact.vehicles) && contact.vehicles.length > 0) {
    const vehicleNote = `Vehicles: ${contact.vehicles.join(", ")}`;
    vcard += `NOTE:${vehicleNote}\n`;
  }

  vcard += "END:VCARD\n";

  return vcard;
}

/**
 * Export all contacts as a single combined vCard file
 */
export function exportAllAsVCard(contacts, filename = "contacts.vcf") {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    console.warn("No contacts to export");
    return;
  }

  // Generate vCard content for all contacts
  const vcardContent = contacts
    .map((contact) => generateVCardContent(contact))
    .join("\n");

  // Create and download file
  const blob = new Blob([vcardContent], { type: "text/vcard;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export each contact as individual vCard files (in a zip would be ideal, but we'll download sequentially)
 */
export function exportAsIndividualVCards(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    console.warn("No contacts to export");
    return;
  }

  contacts.forEach((contact, index) => {
    const vcardContent = generateVCardContent(contact);
    const name = (contact.name || `Contact-${index + 1}`)
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    const filename = `${name}.vcf`;

    // Add a small delay between downloads to avoid browser blocking
    setTimeout(() => {
      const blob = new Blob([vcardContent], {
        type: "text/vcard;charset=utf-8",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, index * 100);
  });
}
