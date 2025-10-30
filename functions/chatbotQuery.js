/* Proprietary and confidential. See LICENSE. */
/**
 * Public Chatbot Query Endpoint
 * No authentication required - designed for external websites
 */

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

/**
 * CORS middleware
 */
function setCorsHeaders(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "3600");
}

/**
 * Get chatbot settings from Firestore
 */
async function getChatbotSettings() {
  try {
    const docRef = db.collection("appSettings").doc("chatbot");
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return docSnap.data();
    }

    return {
      enabled: false,
      name: "Johnny",
      welcomeMessage: "Hey there! 👋 I'm Johnny, your Chief Chauffeur of Chat at Lake Ride Pros. How can I help you today?",
      placeholder: "Ask about our rides, availability, pricing...",
      primaryColor: "#4CAF50",
      position: "bottom-right",
      facebookPageUrl: "https://m.me/lakeridepros",
      bookingUrl: "https://customer.moovs.app/lake-ride-pros/new/info",
      instructions: "You are Johnny, the Chief Chauffeur of Chat at Lake Ride Pros. Be helpful, friendly, and professional.",
    };
  } catch (err) {
    logger.error("Error getting chatbot settings", { error: err.message });
    throw err;
  }
}

/**
 * Get AI settings from Firestore
 */
async function getAISettings() {
  try {
    const docRef = db.collection("appSettings").doc("aiContentGenerator");
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return docSnap.data();
    }

    return {
      provider: "openai",
      apiKey: "",
      model: "gpt-4o-mini",
      enabled: false,
    };
  } catch (err) {
    logger.error("Error getting AI settings", { error: err.message });
    throw err;
  }
}

/**
 * Get knowledge base from Firestore
 */
async function getKnowledgeBase() {
  try {
    const snapshot = await db
      .collection("chatbotKnowledge")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    logger.error("Error getting knowledge base", { error: err.message });
    return [];
  }
}

/**
 * Function definitions for GPT function calling
 */
const BOOKING_TOOL = {
  type: "function",
  function: {
    name: "submit_booking_request",
    description: "Submit complete booking request after collecting all required customer information",
    parameters: {
      type: "object",
      properties: {
        customer_name: {
          type: "string",
          description: "Customer's full name (first and last)",
        },
        customer_email: {
          type: "string",
          description: "Customer's email address",
        },
        customer_phone: {
          type: "string",
          description: "Customer's phone number (US format: XXX-XXX-XXXX)",
        },
        pickup_location: {
          type: "string",
          description: "Detailed pickup address or location",
        },
        dropoff_location: {
          type: "string",
          description: "Detailed dropoff address or location",
        },
        trip_date: {
          type: "string",
          description: "Trip date in YYYY-MM-DD format",
        },
        trip_time: {
          type: "string",
          description: "Pickup time in HH:MM format (24-hour)",
        },
        passenger_count: {
          type: "number",
          description: "Number of passengers",
        },
        trip_type: {
          type: "string",
          enum: ["one-way", "round-trip", "hourly", "event", "airport"],
          description: "Type of trip - REQUIRED",
        },
        special_requests: {
          type: "string",
          description: "Any special needs or requests (car seats, wheelchair, luggage, etc.)",
        },
      },
      required: [
        "customer_name",
        "customer_email",
        "customer_phone",
        "pickup_location",
        "dropoff_location",
        "trip_date",
        "trip_time",
        "passenger_count",
        "trip_type",
      ],
    },
  },
};

/**
 * Validate response to catch GPT-4o-mini hallucinations
 */
function validateResponse(userMessage, botResponse) {
  const dangerPatterns = [
    // Pricing hallucinations
    {
      pattern: /\$\d+/i,
      reason: "mentioned_price",
      escalate: true,
    },
    {
      pattern: /cost.*\d+.*dollars?/i,
      reason: "mentioned_price",
      escalate: true,
    },
    {
      pattern: /price.*\d+/i,
      reason: "mentioned_price",
      escalate: true,
    },

    // Availability claims (but NOT booking collection language)
    {
      pattern: /we (have|don't have) (vehicles?|buses?|shuttles?) available/i,
      reason: "claimed_availability",
      escalate: true,
    },
    // REMOVED the overly broad "(yes|no),? we can (do|provide)" pattern
    // because it blocks legitimate booking collection responses like
    // "Yes, we can book that ride for you!"

    // Invented policies
    {
      pattern: /our policy (is|states)/i,
      reason: "policy_claim",
      escalate: true,
    },
    {
      pattern: /guaranteed|promise/i,
      reason: "overconfident",
      escalate: true,
    },
    // REMOVED "definitely can" because it's legitimate for booking confirmations
  ];

  for (const { pattern, reason, escalate } of dangerPatterns) {
    if (pattern.test(botResponse)) {
      logger.warn("Response validation failed", {
        reason,
        userMessage: userMessage.substring(0, 100),
        botResponse: botResponse.substring(0, 100),
      });

      return {
        safe: false,
        reason,
        shouldEscalate: escalate,
      };
    }
  }

  return { safe: true };
}

/**
 * Check if user message should trigger immediate escalation
 */
function shouldEscalateImmediately(message) {
  const escalationTriggers = [
    // Explicit requests
    /speak to (a )?human/i,
    /talk to (a )?person/i,
    /real person/i,
    /customer service/i,

    // Urgent situations
    /emergency/i,
    /urgent/i,
    /complaint/i,
    /problem with/i,

    // Pricing questions (direct escalation)
    /how much/i,
    /what.*cost/i,
    /price/i,
    /rate/i,

    // Complex special events (require detailed coordination)
    /multiple stops/i,
    /wedding/i,
    /corporate event/i,

    // Modification of existing bookings
    /modify.*booking/i,
    /change.*reservation/i,
    /cancel.*booking/i,
    /cancel.*reservation/i,
  ];

  return escalationTriggers.some((pattern) => pattern.test(message));
}

/**
 * Encode conversation context for Messenger ref parameter
 */
function encodeConversationContext(conversationHistory, bookingData = null) {
  // Build context summary
  const context = {
    timestamp: Date.now(),
    messages: conversationHistory.slice(-6).map((msg) => ({
      role: msg.role,
      content: msg.content.substring(0, 200), // Truncate long messages
    })),
  };

  // Add booking data if available
  if (bookingData) {
    context.booking = {
      name: bookingData.customer_name,
      phone: bookingData.customer_phone,
      pickup: bookingData.pickup_location,
      dropoff: bookingData.dropoff_location,
      date: bookingData.trip_date,
      time: bookingData.trip_time,
      passengers: bookingData.passenger_count,
      type: bookingData.trip_type,
    };
  }

  const json = JSON.stringify(context);

  // Check if too long for URL parameter (2000 char limit)
  if (json.length > 1500) {
    // Return just a timestamp reference - team can check logs
    return `long_${Date.now()}`;
  }

  // Encode to base64 (URL-safe)
  const base64 = Buffer.from(json).toString("base64");

  // Make URL-safe
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Store escalation context in Firestore for team reference
 */
async function storeEscalationContext(
  conversationHistory,
  reason,
  bookingData = null
) {
  try {
    const escalationId = `ESC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    await db.collection("escalations").doc(escalationId).set({
      escalationId,
      conversationHistory: conversationHistory.slice(-10),
      reason,
      bookingData: bookingData || null,
      timestamp: new Date().toISOString(),
      status: "pending",
    });

    logger.info("Escalation context stored", {
      escalationId,
      reason,
      messageCount: conversationHistory.length,
    });

    return escalationId;
  } catch (error) {
    logger.error("Failed to store escalation context", {
      error: error.message,
    });
    return `fallback_${Date.now()}`;
  }
}

/**
 * Handle booking submission - stores data and returns confirmation
 */
async function handleBookingSubmission(bookingData) {
  try {
    // Validate required fields
    const requiredFields = [
      "customer_name",
      "customer_email",
      "customer_phone",
      "pickup_location",
      "dropoff_location",
      "trip_date",
      "trip_time",
      "passenger_count",
      "trip_type",
    ];

    for (const field of requiredFields) {
      if (!bookingData[field]) {
        return {
          success: false,
          error: `Missing required field: ${field}`,
        };
      }
    }

    // Store booking request in Firestore
    const bookingRef = await db.collection("bookingRequests").add({
      ...bookingData,
      source: "chatbot",
      status: "pending",
      createdAt: new Date().toISOString(),
      notificationsSent: false,
    });

    logger.info("Booking request created via chatbot", {
      bookingId: bookingRef.id,
      customerEmail: bookingData.customer_email,
    });

    return {
      success: true,
      bookingId: bookingRef.id,
      message:
        "Booking request received successfully. You will receive a confirmation email and SMS shortly.",
    };
  } catch (error) {
    logger.error("Error handling booking submission", {
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error:
        "Failed to submit booking request. Please try again or contact us directly.",
    };
  }
}

/**
 * Query OpenAI API with optional function calling
 */
async function queryOpenAI(settings, messages, tools = null) {
  const body = {
    model: settings.model || "gpt-4o-mini",
    messages,
    temperature: 0.3, // Lower temp = less creative = fewer hallucinations
    max_tokens: 500,
  };

  if (tools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API error: ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Main chatbot query handler
 */
exports.chatbotQuery = onRequest(
  {
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      setCorsHeaders(res);
      res.status(204).send("");
      return;
    }

    setCorsHeaders(res);

    // Only accept POST requests
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      // Initialize analytics tracking
      const conversationStartTime = Date.now();
      const conversationId = `CONV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const analyticsData = {
        conversationId,
        timestamp: new Date(),
        messageCount: conversationHistory.length + 1, // +1 for current message
        conversationDuration: 0,
        completedSuccessfully: false,
        escalated: false,
        escalationReason: null,
        bookingSubmitted: false,
        bookingId: null,
        validationFailures: [],
        lowConfidenceResponses: 0,
        hallucinationsCaught: 0,
        tokensUsed: {
          input: 0,
          output: 0,
          total: 0,
        },
        estimatedCost: 0,
        source: req.headers.origin || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      };

      // Get settings
      const chatbotSettings = await getChatbotSettings();

      if (!chatbotSettings.enabled) {
        res.status(503).json({ error: "Chatbot is currently disabled" });
        return;
      }

      const aiSettings = await getAISettings();

      if (!aiSettings.enabled || !aiSettings.apiKey) {
        res.status(503).json({ error: "AI is not configured" });
        return;
      }

      // Check for immediate escalation triggers
      if (shouldEscalateImmediately(message)) {
        // Track escalation in analytics
        analyticsData.escalated = true;
        analyticsData.escalationReason = "user_trigger";
        analyticsData.completedSuccessfully = false;
        analyticsData.conversationDuration = Date.now() - conversationStartTime;

        // Store context and build Messenger URL with ref parameter
        const escalationId = await storeEscalationContext(
          conversationHistory,
          "user_trigger"
        );
        const contextRef = encodeConversationContext(conversationHistory);
        const messengerUrl = `${chatbotSettings.facebookPageUrl || "https://m.me/lakeridepros"}?ref=chatbot_${contextRef}`;

        logger.info("Immediate escalation triggered", {
          escalationId,
          trigger: message.substring(0, 50),
        });

        // Save analytics to Firestore
        await db
          .collection("chatbotAnalytics")
          .doc(conversationId)
          .set(analyticsData)
          .catch((err) => {
            logger.error("Failed to save analytics", {
              conversationId,
              error: err.message,
            });
          });

        return res.status(200).json({
          success: true,
          reply:
            "I want to make sure you get the best help with this. Click the Messenger button below to chat directly with our team - they'll have all the details from our conversation.",
          shouldEscalate: true,
          escalationReason: "user_trigger",
          escalationId: escalationId,
          messengerUrl: messengerUrl,
          botName: chatbotSettings.name,
        });
      }

      // Get knowledge base
      const knowledgeBase = await getKnowledgeBase();

      // Build context from knowledge base
      let context = "";
      if (knowledgeBase.length > 0) {
        context = "KNOWLEDGE BASE:\n\n";
        knowledgeBase.forEach((entry) => {
          if (entry.type === "website") {
            context += `Website: ${entry.url}\n`;
            if (entry.content) context += `Content: ${entry.content}\n`;
          } else if (entry.type === "document") {
            context += `Document: ${entry.title}\n`;
            if (entry.content) context += `Content: ${entry.content}\n`;
          }
          context += "\n";
        });
      }

      const systemPrompt = `You are Johnny, Lake Ride Pros' friendly booking assistant.

---

## 🚐 YOUR PRIMARY MISSION: COLLECT BOOKINGS PROACTIVELY

You are a BOOKING ASSISTANT first and foremost. When users want to book a ride, you MUST collect their information through chat. DO NOT send them to the portal or phone unless they explicitly ask for it.

## WHEN A USER WANTS TO BOOK A RIDE:

**1. ENTHUSIASTICALLY ENGAGE**: "Absolutely! I'd love to help you book that ride. 🚐"

**2. COLLECT REQUIRED INFORMATION** (ask 1-2 questions at a time to keep it conversational):
   - Pickup location
   - Dropoff location (destination)
   - Date
   - Time
   - Number of passengers
   - Trip type (one-way or round-trip)
   - Customer name
   - Customer email address
   - Customer phone number
   - Any special requests (optional)

**3. USE THE submit_booking_request FUNCTION** once you have all required fields

**4. CONFIRM SUBMISSION** with:
   - Booking ID
   - Clear next steps: "Our team will contact you within 24 hours from (573) 206-9499 to confirm details and pricing. 📞"
   - Reminder about no-reply SMS and proper contact channels

**CRITICAL RULES**:
✅ YES: "Absolutely! I can help you book that ride."
✅ YES: "Let me collect your booking details."
✅ YES: Ask for missing information one piece at a time
✅ YES: Use the submit_booking_request function when you have all details

🚫 NO: "Visit our booking portal at..."
🚫 NO: "Please call us to book..."
🚫 NO: "I can't help with bookings"
🚫 NO: Deflecting to phone/portal unless user explicitly asks for those options

---

## AVAILABILITY GUIDANCE:
- First check concert/event availability text blocks (if provided in knowledge base)
- If a specific event is sold out, communicate that clearly
- Always remind users: "We can still book other rides as our schedule allows"
- You don't have real-time availability for all rides—that's okay. Collect the request and our team will confirm.

---

## BUSINESS INFO:
- **Name**: Lake Ride Pros
- **Services**: Premier transportation at Lake of the Ozarks (weddings, corporate, airport, nightlife, concerts, parties)
- **Fleet**: SUVs, party buses, sprinters, shuttles
- **Phone**: 📞 573-206-9499
- **Website**: lakeridepros.com
- **Booking Portal**: customer.moovs.app/lake-ride-pros/new/info

---

## ESCALATION RULES:

Only escalate to human contact if:
- User explicitly asks for **pricing** (you don't provide quotes)
- User explicitly asks to **speak with a human**
- User has an **urgent same-day request within 2 hours**
- User mentions a **concert/event you can't find information about**
- User seems **frustrated after 3+ exchanges**

When escalating:
💬 "I'd recommend connecting with our team directly:
- Call/Text: 📞 573-206-9499
- Facebook Messenger: facebook.com/lakeridepros
- Email: owners@lakeridepros.com"

---

## RULES:
✅ Provide information based solely on your knowledge base
✅ Keep responses friendly, informative, and concise
✅ Use emojis where appropriate
✅ Collect booking details proactively
✅ Submit booking requests using the submit_booking_request function

🚫 Do NOT invent details or make up information
🚫 Do NOT oversell rides that aren't possible
🚫 Do NOT deflect to portal/phone when user wants to book (collect their info instead)
🚫 Do NOT say "I don't have availability" for bookings (collect the request and let the team confirm)

---

${context}

Once you have ALL required pieces of information and the customer confirms details, call submit_booking_request.`;

      // Build messages array
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: message },
      ];

      // Log system prompt for debugging
      logger.info("System prompt being sent to GPT", {
        promptLength: systemPrompt.length,
        promptPreview: systemPrompt.substring(0, 200),
        toolsEnabled: true,
        bookingToolDefined: true,
      });

      // Query OpenAI with function calling enabled
      const data = await queryOpenAI(aiSettings, messages, [BOOKING_TOOL]);
      const response = data.choices?.[0]?.message;

      // Log GPT response type
      logger.info("GPT response received", {
        hasContent: !!response.content,
        hasToolCalls: !!(response.tool_calls && response.tool_calls.length > 0),
        toolCallsCount: response.tool_calls?.length || 0,
        toolName: response.tool_calls?.[0]?.function?.name || null,
      });

      if (!response) {
        throw new Error("No response from API");
      }

      // Track token usage and cost
      if (data.usage) {
        analyticsData.tokensUsed = {
          input: data.usage.prompt_tokens || 0,
          output: data.usage.completion_tokens || 0,
          total: data.usage.total_tokens || 0,
        };

        // Estimate cost (gpt-4o-mini rates: $0.15/1M input, $0.60/1M output)
        const inputCost = (data.usage.prompt_tokens / 1000000) * 0.15;
        const outputCost = (data.usage.completion_tokens / 1000000) * 0.6;
        analyticsData.estimatedCost = inputCost + outputCost;
      }

      // Check if GPT wants to submit booking
      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolCall = response.tool_calls[0];

        if (toolCall.function.name === "submit_booking_request") {
          logger.info("🎉 GPT CALLED BOOKING FUNCTION - Booking submission starting!", {
            functionName: toolCall.function.name,
            arguments: toolCall.function.arguments,
          });

          // Parse function arguments
          let bookingData;
          try {
            bookingData = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            logger.error("Failed to parse function arguments", {
              error: error.message,
              arguments: toolCall.function.arguments,
            });

            return res.status(200).json({
              success: true,
              reply:
                "I apologize, but there was an error processing your booking request. Please try again or contact us directly.",
              bookingSubmitted: false,
              botName: chatbotSettings.name,
            });
          }

          // Validate all required fields are present
          const requiredFields = [
            "customer_name",
            "customer_email",
            "customer_phone",
            "pickup_location",
            "dropoff_location",
            "trip_date",
            "trip_time",
            "passenger_count",
            "trip_type",
          ];

          const missingFields = requiredFields.filter(
            (field) => !bookingData[field]
          );

          if (missingFields.length > 0) {
            logger.warn("Booking submission missing fields", {
              missing: missingFields,
              data: bookingData,
            });

            // Track validation failure
            analyticsData.validationFailures.push({
              type: "missing_fields",
              fields: missingFields,
            });

            return res.status(200).json({
              success: true,
              reply: `I still need: ${missingFields.join(", ")}. Can you provide those details?`,
              bookingSubmitted: false,
              botName: chatbotSettings.name,
            });
          }

          // Generate unique booking ID
          const bookingId = `LRP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

          try {
            // Import the email/SMS functions
            const { sendBookingRequestEmail } = require("./sendBookingRequestEmail");
            const { sendBookingConfirmationSMS } = require("./sendBookingConfirmationSMS");

            // Store in Firestore FIRST
            await db.collection("bookingRequests").doc(bookingId).set({
              ...bookingData,
              bookingId,
              status: "pending",
              source: "chatbot",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            logger.info("Booking stored in Firestore", {
              bookingId,
              customer: bookingData.customer_name,
            });

            // Send email to owners and track result
            let emailSent = false;
            try {
              const emailResult = await sendBookingRequestEmail(bookingId, bookingData);
              emailSent = emailResult.success;
              if (emailSent) {
                logger.info("Booking request email sent successfully", {
                  bookingId,
                  messageId: emailResult.messageId,
                });
              } else {
                logger.error("Email send failed", {
                  bookingId,
                  error: emailResult.error,
                });
              }
            } catch (err) {
              logger.error("Email send threw exception", {
                bookingId,
                error: err.message,
              });
            }

            // Send SMS to customer and track result
            let smsSent = false;
            try {
              const smsResult = await sendBookingConfirmationSMS(bookingId, bookingData);
              smsSent = smsResult.success;
              if (smsSent) {
                logger.info("Booking confirmation SMS sent successfully", {
                  bookingId,
                  phone: bookingData.customer_phone,
                });
              } else {
                logger.error("SMS send failed", {
                  bookingId,
                  error: smsResult.error,
                });
              }
            } catch (err) {
              logger.error("SMS send threw exception", {
                bookingId,
                error: err.message,
              });
            }

            // Log overall booking submission status
            logger.info("✅ BOOKING SUCCESSFULLY SUBMITTED", {
              bookingId,
              customer: bookingData.customer_name,
              email: bookingData.customer_email,
              phone: bookingData.customer_phone,
              pickup: bookingData.pickup_location,
              dropoff: bookingData.dropoff_location,
              tripDate: bookingData.trip_date,
              tripTime: bookingData.trip_time,
              passengers: bookingData.passenger_count,
              tripType: bookingData.trip_type,
              emailSent,
              smsSent,
            });

            // Track booking in analytics
            analyticsData.bookingSubmitted = true;
            analyticsData.bookingId = bookingId;
            analyticsData.completedSuccessfully = true;
            analyticsData.conversationDuration = Date.now() - conversationStartTime;

            // Save analytics to Firestore
            await db
              .collection("chatbotAnalytics")
              .doc(conversationId)
              .set(analyticsData)
              .catch((err) => {
                logger.error("Failed to save analytics", {
                  conversationId,
                  error: err.message,
                });
              });

            // Return success to user
            const firstName = bookingData.customer_name.split(" ")[0];

            // Build confirmation message with notification status
            let confirmationMsg = `Perfect, ${firstName}! I've submitted your booking request to our team.\n\n`;

            confirmationMsg += `📍 Pickup: ${bookingData.pickup_location}\n`;
            confirmationMsg += `📍 Dropoff: ${bookingData.dropoff_location}\n`;
            confirmationMsg += `📅 ${bookingData.trip_date} at ${bookingData.trip_time}\n`;
            confirmationMsg += `👥 ${bookingData.passenger_count} passenger${bookingData.passenger_count > 1 ? "s" : ""}\n`;
            confirmationMsg += `🚗 ${bookingData.trip_type}\n`;
            if (bookingData.special_requests) {
              confirmationMsg += `📝 ${bookingData.special_requests}\n`;
            }

            confirmationMsg += `\n📋 Booking ID: ${bookingId}\n\n`;

            // Notification confirmations
            if (emailSent) {
              confirmationMsg += `✅ Email sent to our team\n`;
            } else {
              confirmationMsg += `⚠️ Email notification failed (booking still saved)\n`;
            }

            if (smsSent) {
              confirmationMsg += `✅ SMS confirmation sent to ${bookingData.customer_phone}\n`;
            } else {
              confirmationMsg += `⚠️ SMS notification failed (booking still saved)\n`;
            }

            confirmationMsg += `\n🎯 Our team will contact you within 24 hours from (573) 206-9499 to confirm details and pricing.\n`;
            confirmationMsg += `\n⚠️ This chatbot does not receive replies. Questions?\n`;
            confirmationMsg += `📞 Call/Text: (573) 206-9499\n`;
            confirmationMsg += `💬 Facebook: facebook.com/lakeridepros\n`;
            confirmationMsg += `📧 Email: owners@lakeridepros.com`;

            return res.status(200).json({
              success: true,
              reply: confirmationMsg,
              bookingSubmitted: true,
              bookingId: bookingId,
              emailSent: emailSent,
              smsSent: smsSent,
              shouldEscalate: false,
              botName: chatbotSettings.name,
            });
          } catch (error) {
            logger.error("Booking submission failed", {
              error: error.message,
              bookingData,
              stack: error.stack,
            });

            return res.status(500).json({
              success: false,
              reply:
                "I'm having trouble submitting your booking. Click the Messenger button below to chat with our team directly, or call us at (573) 206-9499.",
              shouldEscalate: true,
              messengerUrl: chatbotSettings.facebookPageUrl,
              bookingSubmitted: false,
              error: error.message,
            });
          }
        }
      }

      // Regular conversation response (no function call)
      const botReply = response.content;

      logger.info("GPT returned text response (no function call)", {
        responseLength: botReply?.length || 0,
        responsePreview: botReply?.substring(0, 150) || "",
        conversationTurn: conversationHistory.length + 1,
      });

      // Validate response for hallucinations
      const validation = validateResponse(message, botReply);

      if (!validation.safe) {
        logger.warn("⚠️ VALIDATION BLOCKED RESPONSE", {
          reason: validation.reason,
          userMessage: message.substring(0, 100),
          blockedResponse: botReply.substring(0, 150),
        });
      }

      if (!validation.safe) {
        // Track hallucination caught
        analyticsData.hallucinationsCaught += 1;
        analyticsData.validationFailures.push({
          type: "hallucination",
          reason: validation.reason,
          response: botReply.substring(0, 200),
        });
        analyticsData.escalated = true;
        analyticsData.escalationReason = validation.reason;
        analyticsData.completedSuccessfully = false;
        analyticsData.conversationDuration = Date.now() - conversationStartTime;

        // Store context and build Messenger URL with ref parameter
        const conversationSoFar = [
          ...conversationHistory,
          { role: "user", content: message },
        ];
        const escalationId = await storeEscalationContext(
          conversationSoFar,
          validation.reason
        );
        const contextRef = encodeConversationContext(conversationSoFar);
        const messengerUrl = `${chatbotSettings.facebookPageUrl || "https://m.me/lakeridepros"}?ref=chatbot_${contextRef}`;

        logger.warn("Blocked potentially inaccurate response", {
          validation_reason: validation.reason,
          original_response: botReply.substring(0, 100),
          escalationId,
        });

        // Save analytics to Firestore
        await db
          .collection("chatbotAnalytics")
          .doc(conversationId)
          .set(analyticsData)
          .catch((err) => {
            logger.error("Failed to save analytics", {
              conversationId,
              error: err.message,
            });
          });

        return res.status(200).json({
          success: true,
          reply:
            "I want to make sure you get accurate information. Click the Messenger button below to chat directly with our team - they can provide specific details.",
          shouldEscalate: true,
          escalationReason: validation.reason,
          escalationId: escalationId,
          messengerUrl: messengerUrl,
          botName: chatbotSettings.name,
        });
      }

      // Track successful conversation
      analyticsData.completedSuccessfully = true;
      analyticsData.conversationDuration = Date.now() - conversationStartTime;

      // Save analytics to Firestore
      await db
        .collection("chatbotAnalytics")
        .doc(conversationId)
        .set(analyticsData)
        .catch((err) => {
          logger.error("Failed to save analytics", {
            conversationId,
            error: err.message,
          });
        });

      // Return normal response
      return res.status(200).json({
        success: true,
        reply: botReply,
        bookingSubmitted: false,
        shouldEscalate: false,
        botName: chatbotSettings.name,
      });
    } catch (err) {
      logger.error("Chatbot query error", {
        error: err.message,
        stack: err.stack,
      });

      // Try to provide Messenger escalation on error
      try {
        const conversationSoFar = [
          ...conversationHistory,
          { role: "user", content: message },
        ];
        const escalationId = await storeEscalationContext(
          conversationSoFar,
          "error"
        );
        const contextRef = encodeConversationContext(conversationSoFar);
        const messengerUrl = `${chatbotSettings?.facebookPageUrl || "https://m.me/lakeridepros"}?ref=chatbot_${contextRef}`;

        res.status(500).json({
          error: "Failed to process chatbot query",
          message: err.message,
          shouldEscalate: true,
          escalationId: escalationId,
          messengerUrl: messengerUrl,
        });
      } catch (escalationError) {
        // If even escalation fails, return basic error
        res.status(500).json({
          error: "Failed to process chatbot query",
          message: err.message,
        });
      }
    }
  }
);

/**
 * Get chatbot configuration (public endpoint)
 * Returns settings needed for the embed widget
 */
exports.chatbotConfig = onRequest(
  {
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      setCorsHeaders(res);
      res.status(204).send("");
      return;
    }

    setCorsHeaders(res);

    try {
      const settings = await getChatbotSettings();

      // Return only public-safe settings
      res.status(200).json({
        success: true,
        config: {
          enabled: settings.enabled || false,
          name: settings.name || "Johnny",
          welcomeMessage: settings.welcomeMessage || "Hi! How can I help you today?",
          placeholder: settings.placeholder || "Type your question...",
          primaryColor: settings.primaryColor || "#4CAF50",
          position: settings.position || "bottom-right",
          facebookPageUrl: settings.facebookPageUrl || "https://m.me/lakeridepros",
          bookingUrl: settings.bookingUrl || "https://customer.moovs.app/lake-ride-pros/new/info",
        },
      });
    } catch (err) {
      logger.error("Chatbot config error", {
        error: err.message,
        stack: err.stack,
      });

      res.status(500).json({
        error: "Failed to fetch chatbot configuration",
      });
    }
  }
);
