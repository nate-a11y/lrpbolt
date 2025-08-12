// Keep labels/routes/icons identical to your app.
// Add any missing ones from the previous full list.
export const NAV_ITEMS = [
  { to: "/rides",           label: "Claim Rides",           icon: "DirectionsCar" },
  { to: "/clock",           label: "Time Clock",            icon: "AccessTime" },
  { to: "/shootout",        label: "Shootout Ride & Time Tracker",  icon: "AirportShuttle" },
  { to: "/info",            label: "Drop-Off Info",         icon: "Info" },
  { to: "/drop-guides",     label: "Vehicle Tips",          icon: "DirectionsCar" },
  { to: "/directory",       label: "Driver Directory",      icon: "People" },
  { to: "/calendar",        label: "Calendar / Moovs",      icon: "CalendarMonth" },
  { to: "/escalation",      label: "Escalation Guide",      icon: "Warning" },
  { to: "/vehicle-calendar",label: "Ride & Vehicle Calendar", icon: "Event" },
  { to: "/scan",            label: "Ticket Scanner",        icon: "QrCodeScanner" },
  { to: "/tickets",         label: "Tickets",               icon: "ConfirmationNumber" },
  { to: "/admin-time-log",  label: "Admin Logs",            icon: "TableChart", admin: true },
  { to: "/admin-user-manager", label: "User Manager",       icon: "ManageAccounts", admin: true },
  { to: "/ride-entry",      label: "Add Ride",              icon: "AddCircle", admin: true },
  { to: "/generate-ticket", label: "Generate Ticket",       icon: "LocalActivity", admin: true },
];
