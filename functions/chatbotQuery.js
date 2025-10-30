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
 * Query OpenAI API
 */
async function queryOpenAI(settings, messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API error: ${response.status}`
    );
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("No response from API");
  }

  return reply;
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
- Base your answers ONLY on the provided knowledge base`;

      // Build messages array
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: message },
      ];

      // Query OpenAI
      const response = await queryOpenAI(aiSettings, messages);

      // Return response
      res.status(200).json({
        success: true,
        reply: response,
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
