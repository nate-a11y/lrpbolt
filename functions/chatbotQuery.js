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
const BOOKING_FUNCTION_DEFINITION = {
  type: "function",
  function: {
    name: "submitBookingRequest",
    description: "Submit a ride booking request when the customer has provided all required information. Use this when the customer wants to book a ride and you have collected their details.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Customer's full name",
        },
        email: {
          type: "string",
          description: "Customer's email address",
        },
        phone: {
          type: "string",
          description: "Customer's phone number (10 digits, US format)",
        },
        pickupLocation: {
          type: "string",
          description: "Pickup location address or description",
        },
        dropoffLocation: {
          type: "string",
          description: "Drop-off location address or description",
        },
        date: {
          type: "string",
          description: "Ride date in YYYY-MM-DD format",
        },
        time: {
          type: "string",
          description: "Ride time in HH:MM format (24-hour)",
        },
        passengers: {
          type: "number",
          description: "Number of passengers (1-14)",
        },
        specialRequests: {
          type: "string",
          description: "Any special requests or notes (optional)",
        },
      },
      required: [
        "name",
        "email",
        "phone",
        "pickupLocation",
        "dropoffLocation",
        "date",
        "time",
        "passengers",
      ],
    },
  },
};

/**
 * Handle booking submission - stores data and returns confirmation
 */
async function handleBookingSubmission(bookingData) {
  try {
    // Validate required fields
    const requiredFields = [
      "name",
      "email",
      "phone",
      "pickupLocation",
      "dropoffLocation",
      "date",
      "time",
      "passengers",
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
      customerEmail: bookingData.email,
    });

    return {
      success: true,
      bookingId: bookingRef.id,
      message: "Booking request received successfully. You will receive a confirmation email and SMS shortly.",
    };
  } catch (error) {
    logger.error("Error handling booking submission", {
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: "Failed to submit booking request. Please try again or contact us directly.",
    };
  }
}

/**
 * Query OpenAI API with optional function calling
 */
async function queryOpenAI(settings, messages, tools = null) {
  const requestBody = {
    model: settings.model || "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 500,
  };

  // Add tools (function calling) if provided
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API error: ${response.status}`
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message;
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

      // Get chatbot settings
      const chatbotSettings = await getChatbotSettings();

      if (!chatbotSettings.enabled) {
        res.status(503).json({ error: "Chatbot is currently disabled" });
        return;
      }

      // Get AI settings
      const aiSettings = await getAISettings();

      if (!aiSettings.enabled || !aiSettings.apiKey) {
        res.status(503).json({ error: "AI is not configured" });
        return;
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

      const systemPrompt = `${chatbotSettings.instructions || "You are a helpful assistant."}

${context ? context + "\n\nUse ONLY the information from the knowledge base above to answer questions. If the answer is not in the knowledge base, say 'I don't have that information in my knowledge base.'" : ""}

Guidelines:
- Be concise and helpful
- Use a friendly, professional tone
- If you don't know something, admit it
- Base your answers ONLY on the provided knowledge base

BOOKING ASSISTANCE:
- You can help customers book rides by collecting their information conversationally
- Required information: name, email, phone, pickup location, drop-off location, date, time, number of passengers
- Optional: special requests
- When you have all required information, use the submitBookingRequest function
- Ask for missing information naturally, one or two fields at a time

CRITICAL GUARDRAILS - NEVER HALLUCINATE:
- NEVER quote specific prices - always say "Please contact us for current pricing"
- NEVER confirm availability - always say "We'll check availability and confirm via email/SMS"
- NEVER make promises about specific vehicles or drivers
- NEVER guarantee service times or routes
- Always say "Our team will review your request and contact you to confirm details and pricing"`;

      // Build messages array
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: message },
      ];

      // Query OpenAI with function calling support
      const tools = [BOOKING_FUNCTION_DEFINITION];
      let responseMessage = await queryOpenAI(aiSettings, messages, tools);

      // Handle function calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0];

        if (toolCall.function.name === "submitBookingRequest") {
          logger.info("GPT requested booking submission", {
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

            res.status(200).json({
              success: true,
              reply: "I apologize, but there was an error processing your booking request. Please try again or contact us directly.",
              botName: chatbotSettings.name || "Johnny",
            });
            return;
          }

          // Execute the booking submission
          const bookingResult = await handleBookingSubmission(bookingData);

          // Add the function call and result to messages
          messages.push(responseMessage);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(bookingResult),
          });

          // Get final response from GPT
          responseMessage = await queryOpenAI(aiSettings, messages, tools);
        }
      }

      // Return response
      res.status(200).json({
        success: true,
        reply: responseMessage.content || responseMessage,
        botName: chatbotSettings.name || "Johnny",
      });
    } catch (err) {
      logger.error("Chatbot query error", {
        error: err.message,
        stack: err.stack,
      });

      res.status(500).json({
        error: "Failed to process chatbot query",
        message: err.message,
      });
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
