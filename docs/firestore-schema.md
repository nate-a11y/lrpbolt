# Firestore Schema (Lake Ride Pros Portal)

## Purpose
This document defines the expected structure, required fields, and field types for each Firestore collection used in the LRP Driver Portal.  

> ⚠️ **Note:** Firestore is schemaless. These definitions are enforced via Firestore security rules (`firestore.rules`) and validated in components/hooks.

---

## **Collections & Documents**

---

### **`userAccess`**
**Purpose:** Stores user roles and permissions.

| Field    | Type   | Required | Notes                            |
| -------- | ------ | -------- | -------------------------------- |
| name     | string | ✅       | Display name of the user.        |
| email    | string | ✅       | Login email.                     |
| access   | string | ✅       | `"admin"` or `"driver"`.         |

---

### **`rideQueue`**
**Purpose:** Holds rides waiting to be claimed.

| Field           | Type       | Required | Notes                                         |
| --------------- | ---------- | -------- | --------------------------------------------- |
| tripId          | string     | ✅       | Unique trip ID.                               |
| pickupTime      | timestamp  | ✅       | Scheduled pickup time.                        |
| rideDuration    | number     | ✅       | Estimated ride length in minutes.             |
| rideType        | string     | ✅       | Type of ride (e.g., `"event"`, `"private"`). |
| vehicle         | string     | ✅       | Assigned vehicle name or ID.                  |
| rideNotes       | string\|null | Optional | Additional notes.                             |
| claimedBy       | string\|null | Optional | Driver email if claimed.                      |
| claimedAt       | timestamp\|null | Optional | Timestamp when claimed.                       |
| createdBy       | string     | ✅       | User who created the ride.                    |
| lastModifiedBy  | string     | ✅       | User who last modified the ride.              |

---

### **`claimedRides`**
**Purpose:** Tracks rides that have been claimed.

| Field           | Type       | Required | Notes                                         |
| --------------- | ---------- | -------- | --------------------------------------------- |
| tripId          | string     | ✅       | Unique trip ID.                               |
| pickupTime      | timestamp  | ✅       | Scheduled pickup time.                        |
| rideDuration    | number     | ✅       | Ride length in minutes.                       |
| rideType        | string     | ✅       | Type of ride.                                 |
| vehicle         | string     | ✅       | Vehicle name or ID.                           |
| rideNotes       | string\|null | Optional | Additional notes.                             |
| claimedBy       | string     | ✅       | Driver email who claimed the ride.            |
| claimedAt       | timestamp  | ✅       | Claim timestamp.                              |
| createdBy       | string     | ✅       | User who created the ride.                    |
| lastModifiedBy  | string     | ✅       | User who last modified the ride.              |

---

### **`claimLog`**
**Purpose:** Keeps a log of all claim actions.

| Field     | Type      | Required |
| --------- | --------- | -------- |
| driver    | string    | ✅       |
| tripId    | string    | ✅       |
| timestamp | timestamp | ✅       |

---

### **`tickets`**
**Purpose:** Stores all tickets for shuttle rides.

| Field                | Type         | Required | Notes                                        |
| -------------------- | ------------ | -------- | -------------------------------------------- |
| ticketId             | string       | ✅       | Unique ticket ID.                            |
| passenger            | string       | ✅       | Passenger name.                              |
| pickup               | string       | ✅       | Pickup location.                             |
| dropoff              | string       | ✅       | Dropoff location.                            |
| pickupTime           | timestamp    | ✅       | Scheduled pickup time.                       |
| passengercount       | number       | ✅       | Number of passengers.                        |
| notes                | string\|null | Optional | Additional notes.                            |
| scannedOutbound      | bool         | ✅       | Outbound scan status.                        |
| scannedReturn        | bool         | ✅       | Return scan status.                          |
| createdAt            | timestamp    | ✅       | Creation timestamp.                          |
| scannedOutboundAt    | timestamp\|null | Optional | Outbound scan timestamp.                     |
| scannedOutboundBy    | string\|null | Optional | Outbound scan user email.                    |
| scannedReturnAt      | timestamp\|null | Optional | Return scan timestamp.                       |
| scannedReturnBy      | string\|null | Optional | Return scan user email.                      |

---

### **`driverRotation`**
**Purpose:** Manages driver claim order.

| Field           | Type         | Required | Notes                                        |
| --------------- | ------------ | -------- | -------------------------------------------- |
| name            | string       | ✅       | Driver name.                                 |
| email           | string       | ✅       | Driver email.                                |
| access          | string       | ✅       | `"admin"` or `"driver"`.                     |
| lastClaimed     | timestamp\|null | Optional | Timestamp of last claim.                     |
| claimsThisWeek  | number       | ✅       | Number of claims in current week.            |
| priority        | number       | ✅       | Rotation priority.                           |
| notes           | string\|null | Optional | Admin notes.                                 |

---

### **`timeLogs`**
**Purpose:** Tracks driver time logging.

| Field     | Type         | Required | Notes                                        |
| --------- | ------------ | -------- | -------------------------------------------- |
| driver    | string       | ✅       | Driver name or email.                        |
| rideId    | string       | ✅       | Associated ride ID.                          |
| startTime | timestamp    | ✅       | Start time.                                  |
| endTime   | timestamp\|null | Optional | End time (nullable while active).            |
| duration  | number       | ✅       | Duration in minutes.                         |
| loggedAt  | timestamp    | ✅       | Log creation timestamp.                      |

---

### **`liveRides`**
**Purpose:** Holds currently active rides (updated nightly from queue).

_Same schema as `rideQueue`._

---

### **`shootoutStats`**
**Purpose:** Tracks shootout ride sessions.

| Field        | Type         | Required | Notes                                        |
| ------------ | ------------ | -------- | -------------------------------------------- |
| startTime    | timestamp    | ✅       | Session start.                               |
| endTime      | timestamp\|null | Optional | Session end.                                 |
| duration     | number       | ✅       | Duration in seconds.                         |
| trips        | number       | ✅       | Total trips completed.                       |
| passengers   | number       | ✅       | Total passengers served.                     |
| status       | string       | ✅       | `"running"` or `"completed"`.                |
| createdAt    | timestamp    | ✅       | Creation timestamp.                          |

---

## Notes
- Security rules enforce these structures.
- All timestamps must be `firebase.firestore.Timestamp`.
- All numeric fields must be stored as numbers, not strings.
- Nullables must be explicitly set to `null` when empty.
