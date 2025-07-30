# Ride Claim Portal — Agents Documentation

This document tracks all functional “agents” (modules/components with a defined operational role) used in the Ride Claim portal.  
It provides **purpose, inputs, outputs, dependencies, and known caveats** for each agent.

---

## 🎯 Purpose
The portal uses a set of “agents” to automate ride and ticket operations.  
Agents act as specialized workers that:
- Generate tickets
- Scan and validate tickets
- Fetch and display ride schedules
- Track driver logs and time records
- Handle ride claims and assignments

---

## 🧠 Agents List

### **1. TicketScanner Agent**
- **Role:**  
  Scans QR tickets, validates status (outbound/return), updates scan logs.
- **Inputs:**  
  - Ticket ID (parsed from QR)  
  - Driver ID (from `localStorage.lrp_driver`)  
  - Current date/time
- **Outputs:**  
  - Ticket validation status (success/failure)  
  - Scan confirmation animation + sound feedback  
- **Dependencies:**  
  - `/tickets/:id` API (GET)  
  - `/tickets/:id/scan` API (POST)
- **Known Caveats:**  
  - Needs confirm button disable after first click (double-click prevention)  
  - Modal must auto-close/reset after scan confirmation  

---

### **2. TicketGenerator Agent**
- **Role:**  
  Generates ride tickets with unique QR codes and stores metadata.
- **Inputs:**  
  - Passenger details  
  - Pickup/dropoff details  
  - Date/time  
- **Outputs:**  
  - Downloadable QR ticket (image or PDF)  
  - Email-ready attachment  
- **Dependencies:**  
  - QR code generator library  
  - Email sending API (for ticket email feature)
- **Known Caveats:**  
  - Bulk generation requires batching to avoid memory spikes  

---

### **3. RideVehicleCalendar Agent**
- **Role:**  
  Displays vehicle schedules from Google Calendar; highlights ride overlaps.
- **Inputs:**  
  - Selected vehicle ID  
  - Current week or date range  
- **Outputs:**  
  - Interactive calendar with event modals  
- **Dependencies:**  
  - Google Calendar API (`Events.list`)  
  - Day.js for timezone formatting
- **Known Caveats:**  
  - Event colors are manually mapped  
  - API quota limits on frequent refresh  

---

### **4. ClaimedRidesGrid Agent**
- **Role:**  
  Shows claimed rides in grid form with delete/undo, auto-refresh, and animations.
- **Inputs:**  
  - Claimed ride dataset  
- **Outputs:**  
  - DataGrid table with live updates
- **Dependencies:**  
  - `/rides/claimed` API
- **Known Caveats:**  
  - Badge count logic must stay in sync with Live/Queue tabs  

---

### **5. AdminTimeLog Agent**
- **Role:**  
  Displays and manages shuttle time logs in tabbed view.
- **Inputs:**  
  - Google Sheets CSV (time logs)  
- **Outputs:**  
  - Weekly summary per driver  
  - Filter/search results
- **Dependencies:**  
  - Google Sheets CSV export  
- **Known Caveats:**  
  - Time zone differences may affect log accuracy  

---

## 🔄 Interaction Flow (Mermaid Diagram)

```mermaid
flowchart LR
    TG[TicketGenerator] --> TS[TicketScanner]
    TS --> CRG[ClaimedRidesGrid]
    CRG --> RVC[RideVehicleCalendar]
    CRG --> ATL[AdminTimeLog]
    
    subgraph APIs
        TAPI[(Tickets API)]
        RAPI[(Rides API)]
        GAPI[(Google Calendar API)]
        SAPI[(Sheets API)]
    end
    
    TG --> TAPI
    TS --> TAPI
    CRG --> RAPI
    RVC --> GAPI
    ATL --> SAPI
