/**
 * Chatbot Analytics Service
 * Fetches analytics data from the getChatbotAnalytics cloud function
 */

import { app } from "@/services/firebase.js";
import logError from "@/utils/logError.js";

/**
 * Fetch chatbot analytics data
 * @param {Object} options - Query options
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @param {string} options.metric - Optional metric filter ('detailed' for raw data)
 * @returns {Promise<Object>} Analytics data
 */
export async function getChatbotAnalytics({ startDate, endDate, metric } = {}) {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (metric) params.append("metric", metric);

    // Get project ID from Firebase app config
    const projectId = app.options.projectId;
    const region = "us-central1"; // Default region for Cloud Functions

    // Build the Cloud Functions URL
    const baseUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
                    `https://${region}-${projectId}.cloudfunctions.net`;

    const url = `${baseUrl}/getChatbotAnalytics?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch analytics");
    }

    return data;
  } catch (err) {
    logError(err, { where: "chatbotAnalyticsService.getChatbotAnalytics" });
    throw err;
  }
}

/**
 * Get analytics for the last N days
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Analytics data
 */
export async function getRecentAnalytics(days = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return getChatbotAnalytics({
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  });
}

/**
 * Get analytics for a specific date range
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Promise<Object>} Analytics data
 */
export async function getAnalyticsByDateRange(start, end) {
  return getChatbotAnalytics({
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  });
}

/**
 * Calculate cost per booking from analytics data
 * @param {Object} metrics - Metrics object from analytics
 * @returns {number} Cost per booking
 */
export function calculateCostPerBooking(metrics) {
  if (!metrics.bookingCount || metrics.bookingCount === 0) {
    return 0;
  }
  return metrics.totalCost / metrics.bookingCount;
}

/**
 * Format currency for display
 * @param {number} amount - Amount in dollars
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 * Format percentage for display
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value) {
  return `${value.toFixed(1)}%`;
}

/**
 * Format duration in milliseconds to readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
