import { getAuth } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { AppError } from "@/services/errors";
import logError from "@/utils/logError.js";
import { getLRPFunctions } from "@/utils/functions.js";

let sendCallable = null;
let healthCallable = null;
let lastSmsError = null;

function getSendCallable() {
  if (sendCallable) return sendCallable;
  sendCallable = httpsCallable(getLRPFunctions(), "sendPartnerInfoSMS");
  return sendCallable;
}

function getHealthCallable() {
  if (healthCallable) return healthCallable;
  healthCallable = httpsCallable(getLRPFunctions(), "smsHealth");
  return healthCallable;
}

async function refreshIdToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;
  try {
    await user.getIdToken(true);
  } catch (error) {
    logError(error, { where: "smsService.refreshIdToken" });
  }
}

function cleanCallableMessage(message) {
  if (!message) return "";
  const text = String(message);
  const colonIndex = text.indexOf(":");
  if (colonIndex >= 0) {
    return text.slice(colonIndex + 1).trim();
  }
  return text.trim();
}

function toAppError(error, fallbackMessage, context) {
  if (error instanceof AppError) return error;
  const rawCode = typeof error?.code === "string" ? error.code : "";
  const normalizedCode = rawCode.startsWith("functions/")
    ? rawCode.slice("functions/".length)
    : rawCode || "internal";
  const details = error?.details || {};
  const message = cleanCallableMessage(error?.message) || fallbackMessage;
  let appCode = `sms_${normalizedCode}`;
  let finalMessage = message || fallbackMessage;

  if (details?.reason === "invalid-phone") {
    appCode = "sms_invalid_phone";
    finalMessage =
      "Enter a valid mobile number in E.164 format, e.g. +15551234567.";
  } else if (details?.reason === "unsubscribed") {
    appCode = "sms_unsubscribed";
    finalMessage =
      "The destination number has opted out of receiving SMS messages.";
  } else if (details?.reason === "unsupported-region") {
    appCode = "sms_unsupported_region";
    finalMessage =
      "This Twilio account cannot deliver SMS to the requested destination region.";
  }

  return new AppError(finalMessage || fallbackMessage, {
    code: appCode,
    cause: error,
    context,
  });
}

export function getLastSmsError() {
  return lastSmsError;
}

export async function sendPartnerInfo(params) {
  if (!params || typeof params !== "object") {
    throw new AppError("Missing SMS parameters", {
      code: "sms_missing_params",
    });
  }
  const { to, itemId, dryRun = false } = params;
  if (!itemId) {
    throw new AppError("Missing important info id", {
      code: "sms_missing_item",
    });
  }

  await refreshIdToken();

  try {
    const callable = getSendCallable();
    const response = await callable({ to, itemId, dryRun: Boolean(dryRun) });
    lastSmsError = null;
    return response?.data || { ok: true };
  } catch (error) {
    const appErr = toAppError(error, "Failed to send SMS", { itemId });
    lastSmsError = {
      at: new Date().toISOString(),
      message: appErr.message,
      code: appErr.code,
    };
    logError(error, {
      where: "smsService.sendPartnerInfo",
      payload: { itemId },
    });
    throw appErr;
  }
}

export async function getSmsHealth() {
  await refreshIdToken();
  try {
    const callable = getHealthCallable();
    const response = await callable();
    return response?.data || null;
  } catch (error) {
    logError(error, { where: "smsService.getSmsHealth" });
    throw toAppError(error, "Unable to fetch SMS health.", {
      action: "health",
    });
  }
}
