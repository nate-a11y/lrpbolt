/* Proprietary and confidential. See LICENSE. */
// src/firebase/index.js

import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { app } from "./config";

export const db = getFirestore(app);
export const functions = getFunctions(app);

