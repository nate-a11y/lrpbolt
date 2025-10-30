/* Proprietary and confidential. See LICENSE. */
const { logger } = require("firebase-functions/v2");

let twilioFactory = null;
try {
  twilioFactory = require("twilio");
} catch (error) {
  logger.warn("sendBookingConfirmationSMS:twilio-missing", error?.message || error);
}

/**
 * Send SMS confirmation to customer
 *
 * @param {Object} bookingData - Booking details
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendBookingConfirmationSMS(bookingData) {
  try {
    // Get Twilio credentials
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_FROM;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      logger.warn("sendBookingConfirmationSMS:twilioMissing", {
        reason: "Twilio secrets are not configured",
        hasSid: Boolean(twilioAccountSid),
        hasToken: Boolean(twilioAuthToken),
        hasFrom: Boolean(twilioPhoneNumber),
      });
      return {
        success: false,
        error: "Twilio credentials not configured",
      };
    }

    if (!twilioFactory) {
      logger.warn("sendBookingConfirmationSMS:twilio-unavailable", {
        reason: "twilio dependency not installed",
        phone: bookingData.customer_phone,
      });
      return {
        success: false,
        error: "Twilio dependency not available",
      };
    }

    // Build SMS message
    const firstName = bookingData.customer_name.split(" ")[0];
    const shortPickup = shortenLocation(bookingData.pickup_location);
    const shortDropoff = shortenLocation(bookingData.dropoff_location);

    const message = `Hi ${firstName}! Lake Ride Pros here 🚗

Got your booking:
📍 ${shortPickup} → ${shortDropoff}
📅 ${bookingData.trip_date} at ${bookingData.trip_time}

We'll text you pricing & confirmation within 24 hours.

Questions? Reply here!`;

    // Send SMS
    const client = twilioFactory(twilioAccountSid, twilioAuthToken);
    await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: bookingData.customer_phone,
    });

    logger.info("Booking confirmation SMS sent", {
      to: bookingData.customer_phone,
      customerName: bookingData.customer_name,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to send booking confirmation SMS", {
      error: error.message,
      phone: bookingData.customer_phone,
      stack: error.stack,
    });

    // Don't throw - we don't want email to fail if SMS fails
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Shorten location for SMS (keep it concise)
 */
function shortenLocation(location) {
  // Remove state/zip if present
  const parts = location.split(",");
  if (parts.length > 2) {
    return parts.slice(0, 2).join(",").trim();
  }
  // Truncate if still too long
  if (location.length > 30) {
    return location.substring(0, 27) + "...";
  }
  return location;
}

module.exports = { sendBookingConfirmationSMS };
