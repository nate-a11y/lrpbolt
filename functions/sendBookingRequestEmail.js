/* Proprietary and confidential. See LICENSE. */
const { logger } = require("firebase-functions/v2");

const { sendEmail } = require("./gmailHelper");

/**
 * Send booking request email to owners@lakeridepros.com
 *
 * @param {string} bookingId - Unique booking ID
 * @param {Object} bookingData - Booking details
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendBookingRequestEmail(bookingId, bookingData) {
  try {
    const emailHtml = buildEmailHtml(bookingId, bookingData);
    const emailText = buildEmailText(bookingId, bookingData);

    const result = await sendEmail({
      to: "owners@lakeridepros.com",
      subject: `🚗 NEW CHATBOT BOOKING: ${bookingData.customer_name} - ${bookingData.trip_date}`,
      text: emailText,
      html: emailHtml,
      fromName: "Lake Ride Pros AI Chatbot",
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    logger.info("Booking request email sent", {
      bookingId,
      to: "owners@lakeridepros.com",
      messageId: result.messageId,
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error("Failed to send booking request email", {
      bookingId,
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Build plain text email content
 */
function buildEmailText(bookingId, data) {
  return `NEW CHATBOT BOOKING REQUEST

⏰ RESPOND WITHIN 15 MINUTES
Customer expects quick reply via text/email

CUSTOMER INFORMATION
Name: ${data.customer_name}
Phone: ${data.customer_phone}
Email: ${data.customer_email}

TRIP DETAILS
Pickup: ${data.pickup_location}
Dropoff: ${data.dropoff_location}
Date: ${data.trip_date}
Time: ${data.trip_time}
Passengers: ${data.passenger_count}
Trip Type: ${data.trip_type}
${data.special_requests ? `Special Requests: ${data.special_requests}\n` : ""}

BOOKING ID: ${bookingId}
Source: AI Chatbot Widget
Submitted: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })}

Call customer: tel:${data.customer_phone}
Text customer: sms:${data.customer_phone}
Create in Moovs: https://customer.moovs.app/lake-ride-pros/new/`;
}

/**
 * Build HTML email content
 */
function buildEmailHtml(bookingId, data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
    }
    .header {
      background: #4CAF50;
      color: white;
      padding: 20px;
      text-align: center;
    }
    .urgent {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px;
      font-weight: bold;
    }
    .section {
      padding: 20px;
    }
    .field {
      margin: 10px 0;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .label {
      font-weight: bold;
      color: #555;
      display: inline-block;
      min-width: 120px;
    }
    .value {
      color: #000;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      margin: 10px 5px;
      background: #4CAF50;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
    }
    .button:hover {
      background: #45a049;
    }
    .button-secondary {
      background: #2196F3;
    }
    .button-secondary:hover {
      background: #1976D2;
    }
    .button-tertiary {
      background: #FF9800;
    }
    .button-tertiary:hover {
      background: #F57C00;
    }
    .footer {
      background: #f5f5f5;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">🚗 New Booking Request from AI Chatbot</h2>
    </div>

    <div class="urgent">
      ⏰ <strong>RESPOND WITHIN 15 MINUTES</strong><br>
      Customer expects quick reply via text/email
    </div>

    <div class="section">
      <h3 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 8px;">Customer Information</h3>
      <div class="field">
        <span class="label">Name:</span>
        <span class="value">${data.customer_name}</span>
      </div>
      <div class="field">
        <span class="label">Phone:</span>
        <span class="value"><a href="tel:${data.customer_phone}" style="color: #2196F3;">${data.customer_phone}</a></span>
      </div>
      <div class="field">
        <span class="label">Email:</span>
        <span class="value"><a href="mailto:${data.customer_email}" style="color: #2196F3;">${data.customer_email}</a></span>
      </div>
    </div>

    <div class="section">
      <h3 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 8px;">Trip Details</h3>
      <div class="field">
        <span class="label">Pickup:</span>
        <span class="value">${data.pickup_location}</span>
      </div>
      <div class="field">
        <span class="label">Dropoff:</span>
        <span class="value">${data.dropoff_location}</span>
      </div>
      <div class="field">
        <span class="label">Date:</span>
        <span class="value">${data.trip_date}</span>
      </div>
      <div class="field">
        <span class="label">Time:</span>
        <span class="value">${data.trip_time}</span>
      </div>
      <div class="field">
        <span class="label">Passengers:</span>
        <span class="value">${data.passenger_count}</span>
      </div>
      <div class="field">
        <span class="label">Trip Type:</span>
        <span class="value"><strong>${data.trip_type}</strong></span>
      </div>
      ${
        data.special_requests
          ? `
      <div class="field">
        <span class="label">Special Requests:</span>
        <span class="value">${data.special_requests}</span>
      </div>
      `
          : ""
      }
    </div>

    <div class="section" style="background: #f9f9f9;">
      <h3 style="color: #4CAF50; margin-top: 0;">Quick Actions</h3>
      <div style="text-align: center;">
        <a href="tel:${data.customer_phone}" class="button">📞 Call Customer</a>
        <a href="sms:${data.customer_phone}" class="button button-secondary">💬 Text Customer</a>
        <a href="https://customer.moovs.app/lake-ride-pros/new/" class="button button-tertiary">🚗 Create in Moovs</a>
      </div>
    </div>

    <div class="footer">
      <strong>Booking ID:</strong> ${bookingId}<br>
      <strong>Submitted:</strong> ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })}<br>
      <strong>Source:</strong> AI Chatbot Widget
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = { sendBookingRequestEmail };
