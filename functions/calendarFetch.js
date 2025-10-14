/* Proprietary and confidential. See LICENSE. */
const { google } = require("googleapis");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

/** Reads SA creds from env, reconstructing PEM newlines */
function getJwt() {
  const email = process.env.GCAL_SA_EMAIL;
  const key = (process.env.GCAL_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Missing GCAL_SA_EMAIL / GCAL_SA_PRIVATE_KEY");
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
}

/**
 * GET /apiCalendarFetch?calendarId=<id>&timeMin=ISO&timeMax=ISO&tz=America/Chicago
 * Supports multiple calendarId values or comma-separated.
 */
const apiCalendarFetch = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    try {
      const tz = req.query.tz || "America/Chicago";
      const calendarIds = []
        .concat(req.query.calendarId || [])
        .flatMap((value) =>
          typeof value === "string" ? value.split(",") : value,
        )
        .filter(Boolean);
      const timeMin = req.query.timeMin;
      const timeMax = req.query.timeMax;

      if (!calendarIds.length) {
        return res.status(400).json({ error: "calendarId required" });
      }
      if (!timeMin || !timeMax) {
        return res.status(400).json({ error: "timeMin/timeMax required" });
      }

      const auth = getJwt();
      await auth.authorize();
      const calendar = google.calendar({ version: "v3", auth });

      const lists = await Promise.all(
        calendarIds.map((id) =>
          calendar.events.list({
            calendarId: id,
            timeMin,
            timeMax,
            timeZone: tz,
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 2500,
          }),
        ),
      );

      const events = lists.flatMap((result, idx) =>
        (result.data.items || []).map((event) => ({
          ...event,
          __calendarId: calendarIds[idx],
        })),
      );

      res.set("Cache-Control", "public, max-age=60");
      res.json({ events, tz, calendarIds });
    } catch (error) {
      logger.error("apiCalendarFetch", error?.message || error);
      res.status(500).json({ error: "calendar fetch failed" });
    }
  },
);

module.exports = { apiCalendarFetch };
