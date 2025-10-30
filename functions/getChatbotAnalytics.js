/* Proprietary and confidential. See LICENSE. */
/**
 * Chatbot Analytics Query Endpoint
 * Aggregates and returns analytics data for chatbot performance
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
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "3600");
}

/**
 * Calculate top escalation reasons from analytics data
 */
function getTopReasons(analytics) {
  const reasons = {};
  analytics
    .filter((a) => a.escalationReason)
    .forEach((a) => {
      reasons[a.escalationReason] = (reasons[a.escalationReason] || 0) + 1;
    });

  return Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}

/**
 * Get chatbot analytics with optional date filtering
 */
exports.getChatbotAnalytics = onRequest(
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

    // Only accept GET requests
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { startDate, endDate, metric } = req.query;

      let query = db.collection("chatbotAnalytics");

      // Apply date filters if provided
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (!isNaN(startDateObj.getTime())) {
          query = query.where("timestamp", ">=", startDateObj);
        }
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (!isNaN(endDateObj.getTime())) {
          query = query.where("timestamp", "<=", endDateObj);
        }
      }

      const snapshot = await query.get();
      const analytics = snapshot.docs.map((doc) => doc.data());

      logger.info("Analytics query executed", {
        totalRecords: analytics.length,
        startDate,
        endDate,
      });

      // Calculate aggregated metrics
      const totalConversations = analytics.length;
      const totalMessages = analytics.reduce((sum, a) => sum + (a.messageCount || 0), 0);
      const avgMessagesPerConversation =
        totalConversations > 0 ? totalMessages / totalConversations : 0;

      const escalatedCount = analytics.filter((a) => a.escalated).length;
      const escalationRate =
        totalConversations > 0 ? (escalatedCount / totalConversations) * 100 : 0;

      const bookingCount = analytics.filter((a) => a.bookingSubmitted).length;
      const bookingRate =
        totalConversations > 0 ? (bookingCount / totalConversations) * 100 : 0;

      const totalCost = analytics.reduce(
        (sum, a) => sum + (a.estimatedCost || 0),
        0
      );
      const avgCostPerConversation =
        totalConversations > 0 ? totalCost / totalConversations : 0;

      const totalHallucinationsCaught = analytics.reduce(
        (sum, a) => sum + (a.hallucinationsCaught || 0),
        0
      );

      const completedCount = analytics.filter(
        (a) => a.completedSuccessfully
      ).length;
      const completionRate =
        totalConversations > 0 ? (completedCount / totalConversations) * 100 : 0;

      const totalTokensUsed = analytics.reduce(
        (sum, a) => sum + (a.tokensUsed?.total || 0),
        0
      );

      const avgConversationDuration =
        totalConversations > 0
          ? analytics.reduce(
              (sum, a) => sum + (a.conversationDuration || 0),
              0
            ) / totalConversations
          : 0;

      const metrics = {
        totalConversations,
        totalMessages,
        avgMessagesPerConversation: Math.round(avgMessagesPerConversation * 10) / 10,

        escalationRate: Math.round(escalationRate * 10) / 10,
        escalatedCount,

        bookingRate: Math.round(bookingRate * 10) / 10,
        bookingCount,

        totalCost: Math.round(totalCost * 100) / 100,
        avgCostPerConversation: Math.round(avgCostPerConversation * 10000) / 10000,

        hallucinationsCaught: totalHallucinationsCaught,

        completionRate: Math.round(completionRate * 10) / 10,
        completedCount,

        totalTokensUsed,
        avgTokensPerConversation:
          totalConversations > 0
            ? Math.round(totalTokensUsed / totalConversations)
            : 0,

        avgConversationDuration:
          Math.round(avgConversationDuration / 1000), // Convert to seconds

        topEscalationReasons: getTopReasons(analytics),
      };

      // Calculate daily breakdown if date range is provided
      let dailyBreakdown = [];
      if (startDate && endDate) {
        const dayMap = {};

        analytics.forEach((a) => {
          if (a.timestamp && a.timestamp.toDate) {
            const date = a.timestamp.toDate().toISOString().split("T")[0];
            if (!dayMap[date]) {
              dayMap[date] = {
                date,
                conversations: 0,
                bookings: 0,
                escalations: 0,
                cost: 0,
              };
            }
            dayMap[date].conversations++;
            if (a.bookingSubmitted) dayMap[date].bookings++;
            if (a.escalated) dayMap[date].escalations++;
            dayMap[date].cost += a.estimatedCost || 0;
          }
        });

        dailyBreakdown = Object.values(dayMap).sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      }

      res.status(200).json({
        success: true,
        metrics,
        dailyBreakdown,
        rawData: metric === "detailed" ? analytics : undefined,
      });
    } catch (error) {
      logger.error("Analytics error", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);
