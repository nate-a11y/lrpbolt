/**
 * AI Content Generator Service
 * Generates SMS templates and blurbs using OpenAI or compatible APIs
 */

import {
  getAISettings as getAISettingsFromFirestore,
  isAIConfigured as isAIConfiguredFromFirestore,
} from "@/services/appSettingsService.js";

/**
 * Get stored AI settings from Firestore
 * @returns {Promise<Object>}
 */
export async function getAISettings() {
  return await getAISettingsFromFirestore();
}

/**
 * Check if AI is configured and ready to use
 * @returns {Promise<boolean>}
 */
export async function isAIConfigured() {
  return await isAIConfiguredFromFirestore();
}

/**
 * Generate SMS template and blurb using AI
 * @param {Object} data - The important info data
 * @param {string} data.title - Item title
 * @param {string} data.details - Item details
 * @param {string} data.category - Item category
 * @param {string} data.phone - Optional phone number
 * @param {string} data.url - Optional URL
 * @returns {Promise<{sms: string, blurb: string}>}
 */
export async function generateContent(data) {
  const settings = await getAISettings();

  if (!settings.enabled || !settings.apiKey) {
    throw new Error(
      "AI is not configured. Please set up your API key in settings.",
    );
  }

  const { title, details, category, phone, url } = data;

  // Build context for the AI
  const contextParts = [];
  if (title) contextParts.push(`Title: ${title}`);
  if (category) contextParts.push(`Category: ${category}`);
  if (details) contextParts.push(`Details: ${details}`);
  if (phone) contextParts.push(`Phone: ${phone}`);
  if (url) contextParts.push(`URL: ${url}`);

  const context = contextParts.join("\n");

  const systemPrompt = `You are a professional SMS and marketing content writer for Lake Ride Pros, a rideshare service. Your task is to create engaging, concise SMS messages and blurbs based on the provided information.

Guidelines:
- SMS messages should be clear, friendly, and actionable (max 160 characters recommended)
- Blurbs should be brief descriptions (1-2 sentences, max 150 characters)
- Use appropriate emojis sparingly (1-2 max)
- For Promotions: emphasize the offer/benefit
- For Partners: highlight the partnership value
- For Referrals: make it exciting and rewarding
- Include phone numbers and URLs naturally when provided
- Keep the tone professional but friendly`;

  const userPrompt = `Create an SMS message and a blurb for the following:

${context}

Respond in JSON format:
{
  "sms": "Your SMS message here",
  "blurb": "Your blurb here"
}`;

  try {
    let response;

    if (settings.provider === "openai") {
      response = await callOpenAI(settings, systemPrompt, userPrompt);
    } else {
      throw new Error(`Unsupported AI provider: ${settings.provider}`);
    }

    return response;
  } catch (err) {
    console.error("AI generation failed:", err);
    throw new Error(
      err.message ||
        "Failed to generate content. Please check your API settings and try again.",
    );
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(settings, systemPrompt, userPrompt) {
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message ||
        `OpenAI API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content received from OpenAI");
  }

  try {
    const parsed = JSON.parse(content);
    return {
      sms: parsed.sms || "",
      blurb: parsed.blurb || "",
    };
  } catch {
    console.error("Failed to parse AI response:", content);
    throw new Error("Failed to parse AI response");
  }
}
