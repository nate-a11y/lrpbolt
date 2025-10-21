/* Proprietary and confidential. See LICENSE. */
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");

const { admin } = require("./_admin");

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = defineSecret("TWILIO_FROM");

function normalizeEmail(value) {
  return (value || "").toString().trim().toLowerCase();
}

async function lookupDriverPhone(emailLower) {
  if (!emailLower) {
    return null;
  }

  try {
    const snapshot = await admin.firestore().doc(`userAccess/${emailLower}`).get();
    if (!snapshot.exists) {
      return null;
    }
    const data = snapshot.data();
    return data?.phone || null;
  } catch (error) {
    logger.warn("notifyDriverOnClaim.lookupDriverPhone", error?.message || error);
    return null;
  }
}

function composeSmsBody(rideId, data) {
  const tripId = data?.tripId || rideId || "";
  const vehicle = data?.vehicleName || data?.vehicle || data?.unit || "Vehicle";
  const rideType = data?.rideType || "N/A";
  const notes = (data?.rideNotes || data?.notes || "").toString().trim() || "none";

  return `Trip ID: ${tripId}\nVehicle: ${vehicle}\nTrip Type: ${rideType}\nTrip Notes: ${notes}`;
}

async function sendSmsSafe(to, body) {
  const accountSid = TWILIO_ACCOUNT_SID.value();
  const authToken = TWILIO_AUTH_TOKEN.value();
  const from = TWILIO_FROM.value();

  if (!accountSid || !authToken || !from) {
    logger.warn("notifyDriverOnClaim.twilioMissing", {
      hasSid: Boolean(accountSid),
      hasToken: Boolean(authToken),
      hasFrom: Boolean(from),
    });
    return;
  }

  let twilio;
  try {
     
    twilio = require("twilio");
  } catch (error) {
    logger.warn("notifyDriverOnClaim.twilioModuleMissing", error?.message || error);
    return;
  }

  const client = twilio(accountSid, authToken);
  await client.messages.create({ to, from, body });
}

async function maybeNotify(rideId, data) {
  const emailLower = normalizeEmail(data?.claimedBy || data?.ClaimedBy);
  if (!emailLower || !emailLower.includes("@")) {
    logger.info("notifyDriverOnClaim.skipNoEmail", { rideId });
    return;
  }

  const phone = await lookupDriverPhone(emailLower);
  if (!phone) {
    logger.info("notifyDriverOnClaim.skipNoPhone", { rideId, emailLower });
    return;
  }

  const body = composeSmsBody(rideId, data || {});
  await sendSmsSafe(phone, body);
}

const handlerOptions = {
  region: "us-central1",
  secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM],
};

const notifyDriverOnClaimCreated = onDocumentCreated(
  {
    ...handlerOptions,
    document: "claimedRides/{rideId}",
  },
  async (event) => {
    try {
      const data = event?.data?.data();
      if (!data) {
        return;
      }
      await maybeNotify(event.params.rideId, data);
    } catch (error) {
      logger.error("notifyDriverOnClaimCreated", error?.message || error);
      throw error;
    }
  },
);

const notifyDriverOnClaimUpdated = onDocumentUpdated(
  {
    ...handlerOptions,
    document: "liveRides/{rideId}",
  },
  async (event) => {
    try {
      const beforeData = event?.data?.before?.data() || {};
      const afterData = event?.data?.after?.data() || {};
      const wasClaimed = Boolean(
        beforeData.claimedAt ||
          beforeData.ClaimedAt ||
          beforeData.claimedBy ||
          beforeData.ClaimedBy,
      );
      const isClaimed = Boolean(
        afterData.claimedAt ||
          afterData.ClaimedAt ||
          afterData.claimedBy ||
          afterData.ClaimedBy,
      );

      if (!wasClaimed && isClaimed) {
        await maybeNotify(event.params.rideId, afterData);
      }
    } catch (error) {
      logger.error("notifyDriverOnClaimUpdated", error?.message || error);
      throw error;
    }
  },
);

module.exports = {
  notifyDriverOnClaimCreated,
  notifyDriverOnClaimUpdated,
};
