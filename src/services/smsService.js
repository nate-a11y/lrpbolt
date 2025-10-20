import { httpsCallable } from "firebase/functions";

import { AppError } from "@/services/errors";
import logError from "@/utils/logError.js";
import { getLRPFunctions } from "@/utils/functions.js";

let cachedCallable = null;

function getCallable() {
  if (cachedCallable) return cachedCallable;
  const fn = httpsCallable(getLRPFunctions(), "sendPartnerInfoSMS");
  cachedCallable = fn;
  return cachedCallable;
}

export async function sendPartnerInfo(params) {
  if (!params || typeof params !== "object") {
    throw new AppError("Missing SMS parameters", {
      code: "sms_missing_params",
    });
  }
  const { to, itemId } = params;
  if (!itemId) {
    throw new AppError("Missing important info id", {
      code: "sms_missing_item",
    });
  }
  try {
    const callable = getCallable();
    const response = await callable({ to, itemId });
    return response?.data || { ok: true };
  } catch (error) {
    logError(error, {
      where: "smsService.sendPartnerInfo",
      payload: { itemId },
    });
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to send SMS", {
            code: "sms_send_failed",
            cause: error,
          });
    throw appErr;
  }
}
