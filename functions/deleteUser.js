/* Proprietary and confidential. See LICENSE. */
// functions/deleteUser.js
const { logger } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin } = require("./admin");

/**
 * Deletes a user from both Firestore and Firebase Authentication
 * Requires admin privileges
 */
exports.deleteUser = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
    enforceAppCheck: false,
  },
  async (req) => {
    const { auth, data } = req;

    // Verify authentication exists
    if (!auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    // Check admin access via custom claim OR Firestore role
    const hasAdminClaim = auth.token?.admin === true;
    const hasAdminRole = auth.token?.role === "admin";

    let isAdmin = hasAdminClaim || hasAdminRole;

    // If no admin access from token, check Firestore
    if (!isAdmin && auth.token?.email) {
      try {
        const db = admin.firestore();
        const lcEmail = auth.token.email.toLowerCase();

        // Check userAccess collection
        const userAccessDoc = await db.collection("userAccess").doc(lcEmail).get();
        if (userAccessDoc.exists && userAccessDoc.data()?.access === "admin") {
          isAdmin = true;
        }

        // If not found in userAccess, check users collection
        if (!isAdmin) {
          const userDoc = await db.collection("users").doc(auth.uid).get();
          if (userDoc.exists && userDoc.data()?.role === "admin") {
            isAdmin = true;
          }
        }
      } catch (error) {
        logger.warn("Error checking Firestore role", {
          uid: auth.uid,
          error: error.message,
        });
      }
    }

    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    const { email } = data;
    if (!email || typeof email !== "string") {
      throw new HttpsError("invalid-argument", "Email is required");
    }

    const lcEmail = email.toLowerCase();
    const db = admin.firestore();

    try {
      // Step 1: Find and delete Firebase Auth user by email
      let authUser = null;
      try {
        authUser = await admin.auth().getUserByEmail(lcEmail);
        logger.info(`Found Firebase Auth user for ${lcEmail}`, { uid: authUser.uid });
      } catch (authError) {
        // User might not exist in Firebase Auth
        logger.warn(`No Firebase Auth user found for ${lcEmail}`, {
          error: authError.message,
        });
      }

      // Step 2: Delete from Firestore collections
      const deletions = [];

      // Delete from userAccess collection (primary)
      const userAccessRef = db.collection("userAccess").doc(lcEmail);
      deletions.push(
        userAccessRef.delete().then(() => {
          logger.info(`Deleted userAccess doc: ${lcEmail}`);
        }),
      );

      // Delete from users collection (if exists by email)
      const usersEmailRef = db.collection("users").doc(lcEmail);
      deletions.push(
        usersEmailRef.delete().then(() => {
          logger.info(`Deleted users doc by email: ${lcEmail}`);
        }),
      );

      // Delete from users collection (if exists by UID)
      if (authUser) {
        const usersUidRef = db.collection("users").doc(authUser.uid);
        deletions.push(
          usersUidRef.delete().then(() => {
            logger.info(`Deleted users doc by UID: ${authUser.uid}`);
          }),
        );
      }

      // Delete ALL FCM tokens for this user (query by email)
      // A user can have multiple tokens (one per device/browser)
      deletions.push(
        (async () => {
          try {
            const fcmTokensSnap = await db
              .collection("fcmTokens")
              .where("email", "==", lcEmail)
              .get();

            const tokenDeletions = [];
            fcmTokensSnap.forEach((doc) => {
              tokenDeletions.push(
                doc.ref.delete().then(() => {
                  logger.info(`Deleted FCM token: ${doc.id}`);
                }),
              );
            });

            await Promise.all(tokenDeletions);
            logger.info(
              `Deleted ${tokenDeletions.length} FCM token(s) for ${lcEmail}`,
            );
          } catch (error) {
            logger.error(`Error deleting FCM tokens for ${lcEmail}`, error);
            throw error;
          }
        })(),
      );

      // Also delete FCM tokens by userId (if exists)
      if (authUser) {
        deletions.push(
          (async () => {
            try {
              const fcmTokensByUidSnap = await db
                .collection("fcmTokens")
                .where("userId", "==", authUser.uid)
                .get();

              const tokenDeletionsByUid = [];
              fcmTokensByUidSnap.forEach((doc) => {
                tokenDeletionsByUid.push(
                  doc.ref.delete().then(() => {
                    logger.info(`Deleted FCM token by UID: ${doc.id}`);
                  }),
                );
              });

              await Promise.all(tokenDeletionsByUid);
              logger.info(
                `Deleted ${tokenDeletionsByUid.length} FCM token(s) by UID for ${authUser.uid}`,
              );
            } catch (error) {
              logger.error(`Error deleting FCM tokens by UID for ${authUser.uid}`, error);
              throw error;
            }
          })(),
        );
      }

      // Wait for all Firestore deletions
      await Promise.all(deletions);

      // Step 3: Delete Firebase Auth user (if found)
      if (authUser) {
        await admin.auth().deleteUser(authUser.uid);
        logger.info(`Deleted Firebase Auth user: ${authUser.uid}`);
      }

      return {
        success: true,
        email: lcEmail,
        deletedAuth: !!authUser,
        message: authUser
          ? "User deleted from database and authentication"
          : "User deleted from database (no authentication account found)",
      };
    } catch (error) {
      logger.error("Error deleting user", {
        email: lcEmail,
        error: error.message,
        stack: error.stack,
      });
      throw new HttpsError(
        "internal",
        `Failed to delete user: ${error.message}`,
      );
    }
  },
);
