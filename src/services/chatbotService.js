/**
 * Chatbot Service
 * Handles chatbot queries using OpenAI API with knowledge base context
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";

import { db } from "@/services/firebase.js";
import { getAISettings } from "@/services/appSettingsService.js";
import logError from "@/utils/logError.js";

const SETTINGS_COLLECTION = "appSettings";
const CHATBOT_SETTINGS_DOC = "chatbot";
const KNOWLEDGE_BASE_COLLECTION = "chatbotKnowledge";

/**
 * Get chatbot configuration from Firestore
 * @returns {Promise<Object>} Chatbot settings
 */
export async function getChatbotSettings() {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CHATBOT_SETTINGS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }

    // Return default settings
    return {
      enabled: false,
      name: "Johnny",
      welcomeMessage: "Hey there! 👋 I'm Johnny, your Chief Chauffeur of Chat at Lake Ride Pros. How can I help you today?",
      placeholder: "Ask about our rides, availability, pricing...",
      primaryColor: null, // Default provided by theme.palette.lrp.chatbotPrimary
      position: "bottom-right",
      facebookPageUrl: "https://m.me/lakeridepros",
      bookingUrl: "https://customer.moovs.app/lake-ride-pros/new/info",
      instructions: `You are Johnny, Lake Ride Pros' friendly booking assistant.

✅ Keep responses friendly, informative, and concise
✅ Use emojis where appropriate
✅ Provide information based solely on your knowledge base
✅ Collect booking details proactively when users want to book a ride
✅ DO NOT deflect to portal/phone when user wants to book — collect their info instead

🚫 Do NOT invent details or make up information
🚫 Do NOT oversell rides that aren't possible
🚫 Do NOT say "I don't have availability" for bookings — collect the request and let the team confirm

When a user wants to book a ride:
1. Enthusiastically engage: "Absolutely! I'd love to help you book that ride. 🚐"
2. Collect required information (one question at a time)
3. Submit the booking request
4. Confirm submission with booking ID and next steps

Availability Guidance:
- Check concert/event availability text blocks if provided
- If a specific event is sold out, communicate that clearly
- Always remind users: "We can still book other rides as our schedule allows"

Business Name: Lake Ride Pros
Services: Premier transportation at Lake of the Ozarks (weddings, corporate, airport, nightlife, concerts, parties)
Fleet: SUVs, party buses, sprinters, shuttles

Contact Info:
📞 Phone: 573-206-9499
🌐 Website: lakeridepros.com
🚗 Booking Portal: customer.moovs.app/lake-ride-pros/new/info

Escalate to human contact only if:
- User explicitly asks for pricing
- User explicitly asks to speak with a human
- User has urgent same-day request within 2 hours
- User mentions concert/event you can't find information about
- User seems frustrated after 3+ exchanges

When escalating:
💬 "I'd recommend connecting with our team directly:
- Call/Text: 📞 573-206-9499
- Facebook Messenger: facebook.com/lakeridepros
- Email: owners@lakeridepros.com"`,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    logError(err, { where: "chatbotService.getChatbotSettings" });
    return {
      enabled: false,
      name: "Johnny",
      welcomeMessage: "Hey there! 👋 I'm Johnny, your Chief Chauffeur of Chat at Lake Ride Pros. How can I help you today?",
      placeholder: "Ask about our rides, availability, pricing...",
      primaryColor: null, // Default provided by theme.palette.lrp.chatbotPrimary
      position: "bottom-right",
      facebookPageUrl: "https://m.me/lakeridepros",
      bookingUrl: "https://customer.moovs.app/lake-ride-pros/new/info",
      instructions: "You are Johnny, the Chief Chauffeur of Chat at Lake Ride Pros. Be helpful, friendly, and professional.",
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Save chatbot configuration to Firestore
 * @param {Object} settings - Chatbot settings to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveChatbotSettings(settings) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CHATBOT_SETTINGS_DOC);
    await setDoc(
      docRef,
      {
        ...settings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    logError(err, { where: "chatbotService.saveChatbotSettings" });
    return false;
  }
}

/**
 * Subscribe to chatbot settings changes
 * @param {Function} callback - Called when settings change
 * @returns {Function} Unsubscribe function
 */
export function subscribeToChatbotSettings(callback) {
  const docRef = doc(db, SETTINGS_COLLECTION, CHATBOT_SETTINGS_DOC);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        callback({
          enabled: false,
          name: "Johnny",
          welcomeMessage: "Hey there! 👋 I'm Johnny, your Chief Chauffeur of Chat at Lake Ride Pros. How can I help you today?",
          placeholder: "Ask about our rides, availability, pricing...",
          primaryColor: null, // Default provided by theme.palette.lrp.chatbotPrimary
          position: "bottom-right",
          facebookPageUrl: "https://m.me/lakeridepros",
          bookingUrl: "https://customer.moovs.app/lake-ride-pros/new/info",
          instructions: "You are Johnny, the Chief Chauffeur of Chat at Lake Ride Pros. Be helpful, friendly, and professional.",
        });
      }
    },
    (err) => {
      logError(err, { where: "chatbotService.subscribeToChatbotSettings" });
    }
  );
}

/**
 * Get all knowledge base entries
 * @returns {Promise<Array>} Array of knowledge base entries
 */
export async function getKnowledgeBase() {
  try {
    const q = query(
      collection(db, KNOWLEDGE_BASE_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    logError(err, { where: "chatbotService.getKnowledgeBase" });
    return [];
  }
}

/**
 * Subscribe to knowledge base changes
 * @param {Function} callback - Called with knowledge base entries
 * @returns {Function} Unsubscribe function
 */
export function subscribeToKnowledgeBase(callback) {
  const q = query(
    collection(db, KNOWLEDGE_BASE_COLLECTION),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(entries);
    },
    (err) => {
      logError(err, { where: "chatbotService.subscribeToKnowledgeBase" });
      callback([]);
    }
  );
}

/**
 * Add a knowledge base entry
 * @param {Object} entry - Knowledge base entry
 * @returns {Promise<string>} Document ID
 */
export async function addKnowledgeEntry(entry) {
  try {
    const docRef = await addDoc(collection(db, KNOWLEDGE_BASE_COLLECTION), {
      ...entry,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (err) {
    logError(err, { where: "chatbotService.addKnowledgeEntry" });
    throw err;
  }
}

/**
 * Update a knowledge base entry
 * @param {string} id - Entry ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} Success status
 */
export async function updateKnowledgeEntry(id, updates) {
  try {
    const docRef = doc(db, KNOWLEDGE_BASE_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    logError(err, { where: "chatbotService.updateKnowledgeEntry", id });
    throw err;
  }
}

/**
 * Delete a knowledge base entry
 * @param {string} id - Entry ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteKnowledgeEntry(id) {
  try {
    const docRef = doc(db, KNOWLEDGE_BASE_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    logError(err, { where: "chatbotService.deleteKnowledgeEntry", id });
    throw err;
  }
}

/**
 * Query the chatbot with a user message
 * @param {string} message - User's message
 * @param {Array} conversationHistory - Previous messages
 * @returns {Promise<string>} Bot's response
 */
export async function queryChatbot(message, conversationHistory = []) {
  try {
    // Get AI settings (uses the same OpenAI API key)
    const aiSettings = await getAISettings();
    if (!aiSettings.enabled || !aiSettings.apiKey) {
      throw new Error("AI is not configured. Please set up your API key in Important Info settings.");
    }

    // Get chatbot settings
    const chatbotSettings = await getChatbotSettings();
    if (!chatbotSettings.enabled) {
      throw new Error("Chatbot is not enabled.");
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

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiSettings.apiKey}`,
      },
      body: JSON.stringify({
        model: aiSettings.model || "gpt-4o-mini",
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
  } catch (err) {
    logError(err, { where: "chatbotService.queryChatbot" });
    throw err;
  }
}

/**
 * Check if chatbot is configured and enabled
 * @returns {Promise<boolean>}
 */
export async function isChatbotReady() {
  try {
    const aiSettings = await getAISettings();
    const chatbotSettings = await getChatbotSettings();
    return (
      aiSettings.enabled &&
      aiSettings.apiKey &&
      chatbotSettings.enabled
    );
  } catch {
    return false;
  }
}
