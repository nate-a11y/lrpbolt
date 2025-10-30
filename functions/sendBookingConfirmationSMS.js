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
 * @param {string} bookingId - Unique booking ID
 * @param {Object} bookingData - Booking details
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendBookingConfirmationSMS(bookingId, bookingData) {
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
    const message = `Thank you for your booking/quote request with Lake Ride Pros! 🚐

Your request has been received (ID: ${bookingId}).

Our team will contact you within 24 hours from (573) 206-9499 to confirm details and pricing.

⚠️ This number does not receive replies. For questions, reach out:
📞 Call/Text: (573) 206-9499
💬 Facebook: facebook.com/lakeridepros
📧 Email: owners@lakeridepros.com

- Lake Ride Pros Team`;

    // Send SMS
    const client = twilioFactory(twilioAccountSid, twilioAuthToken);
    await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: bookingData.customer_phone,
    });

    logger.info("Booking/quote confirmation SMS sent", {
      to: bookingData.customer_phone,
      customerName: bookingData.customer_name,
      bookingId: bookingId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to send booking/quote confirmation SMS", {
      error: error.message,
      phone: bookingData.customer_phone,
      bookingId: bookingId,
      stack: error.stack,
    });

    // Don't throw - we don't want email to fail if SMS fails
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = { sendBookingConfirmationSMS };
