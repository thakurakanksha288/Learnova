import { db } from "@/lib/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Logs a new user activity to Firestore.
 * @param {string} userId - The unique ID of the user.
 * @param {Object} activityData - Data including title, type, and progress.
 */

export const logActivity = async (userId, activityData) => {
    if (!userId) return;

    try {
        await addDoc(collection(db, "activities"), {
            userId,
            title: activityData.title,
            type: activityData.type || "course",
            progress: activityData.progress || 0,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error logging activity to Firestore:", error);
    }
};