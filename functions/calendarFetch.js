/* Proprietary and confidential. See LICENSE. */
const { google } = require("googleapis");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
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

function normalizeCalendarIds(raw) {
  return []
    .concat(raw || [])
    .flatMap((value) => (typeof value === "string" ? value.split(",") : value))
    .map((value) => (typeof value === "string" ? value.trim() : value))
    .filter(Boolean);
}

async function fetchCalendarEvents({ calendarIds, timeMin, timeMax, tz }) {
  if (!calendarIds?.length) {
    throw new HttpsError("invalid-argument", "calendarId required");
  }
  if (!timeMin || !timeMax) {
    throw new HttpsError("invalid-argument", "timeMin/timeMax required");
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

  return { events, tz, calendarIds };
}

/**
 * GET /apiCalendarFetchHttp?calendarId=<id>&timeMin=ISO&timeMax=ISO&tz=America/Chicago
 * Supports multiple calendarId values or comma-separated.
 */
const apiCalendarFetchHttp = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    try {
      const tz = req.query.tz || "America/Chicago";
      const calendarIds = normalizeCalendarIds(req.query.calendarId);
      const timeMin = req.query.timeMin;
      const timeMax = req.query.timeMax;

      const payload = await fetchCalendarEvents({
        calendarIds,
        timeMin,
        timeMax,
        tz,
      });

      res.set("Cache-Control", "public, max-age=60");
      res.json(payload);
    } catch (error) {
      const message = error instanceof HttpsError ? error.message : "calendar fetch failed";
      logger.error("apiCalendarFetchHttp", error?.message || error);
      const status = error instanceof HttpsError && error.code === "invalid-argument" ? 400 : 500;
      res.status(status).json({ error: message });
    }
  },
);

const apiCalendarFetch = onCall({ region: "us-central1" }, async (request) => {
  try {
    const tz = request.data?.tz || "America/Chicago";
    const calendarIds = normalizeCalendarIds(
      request.data?.calendarId ?? request.data?.calendarIds,
    );
    const timeMin = request.data?.timeMin;
    const timeMax = request.data?.timeMax;

    return await fetchCalendarEvents({
      calendarIds,
      timeMin,
      timeMax,
      tz,
    });
  } catch (error) {
    logger.error("apiCalendarFetch", error?.message || error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "calendar fetch failed");
  }
});

module.exports = { apiCalendarFetchHttp, apiCalendarFetch };
