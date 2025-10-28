import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { app } from "@/services/firebase.js";
import logError from "@/utils/logError.js";
import { AppError } from "@/services/errors";

const storage = getStorage(app);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function validateImageFile(file) {
  if (!file) {
    throw new AppError("No file provided", { code: "no_file" });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AppError(
      "Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.",
      { code: "invalid_file_type" },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError("File size exceeds 5MB limit.", {
      code: "file_too_large",
    });
  }
}

function createImageId(file) {
  const base = `${Date.now()}_${file?.name || "image"}`;
  return base.replace(/[\s\\/#?%*:|"<>]/g, "_");
}

export async function uploadImportantInfoImage(itemId, file) {
  const safeId = String(itemId || "").trim();
  if (!safeId) {
    throw new AppError("Missing important info item ID", {
      code: "missing_item_id",
    });
  }

  try {
    validateImageFile(file);

    // Create unique ID for each image to support multiple images
    const imageId = createImageId(file);
    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `importantInfo/${safeId}/${imageId}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);

    return {
      id: imageId,
      url,
      storagePath,
      contentType: file.type,
      name: file.name,
      size: file.size,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logError(error, { where: "uploadImportantInfoImage", itemId: safeId });
    throw new AppError("Failed to upload image", {
      code: "upload_failed",
      cause: error,
    });
  }
}

export async function uploadMultipleImages(itemId, files) {
  const safeId = String(itemId || "").trim();
  if (!safeId) {
    throw new AppError("Missing important info item ID", {
      code: "missing_item_id",
    });
  }

  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const results = [];
  const errors = [];

  for (const file of files) {
    if (!file) continue;
    try {
      const result = await uploadImportantInfoImage(safeId, file);
      results.push(result);
    } catch (error) {
      errors.push({ file: file.name, error });
      logError(error, {
        where: "uploadMultipleImages",
        itemId: safeId,
        fileName: file.name,
      });
    }
  }

  if (errors.length > 0 && results.length === 0) {
    throw new AppError("Failed to upload any images", {
      code: "all_uploads_failed",
    });
  }

  return results;
}

export async function deleteImportantInfoImage(storagePath) {
  if (!storagePath) {
    return;
  }

  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    // If the file doesn't exist, that's fine - we wanted it deleted anyway
    if (error?.code === "storage/object-not-found") {
      return;
    }
    logError(error, { where: "deleteImportantInfoImage", storagePath });
    throw new AppError("Failed to delete image", {
      code: "delete_failed",
      cause: error,
    });
  }
}
