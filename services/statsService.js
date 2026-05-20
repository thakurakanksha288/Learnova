import { db } from "@/lib/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

function getWeekdaysSinceYearStart() {
  const start = new Date(new Date().getFullYear(), 0, 1);
  const end = new Date();
  let weekdays = 0;

  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    if (weekday >= 1 && weekday <= 5) {
      weekdays += 1;
    }
  }

  return Math.max(weekdays, 1);
}

/**
 * Initializes a new user's statistics in Firestore.
 * @param {string} userId - The unique ID of the user.
 */
export const initializeUserStats = async (userId) => {
  if (!userId) return;
  const statsRef = doc(db, "userStats", userId);
  
  const defaultStats = {
    "Courses Enrolled": 0,
    "Attendance Rate": "0%",
    "Assignments Done": 0,
    "Study Hours": 0,
    lastUpdated: new Date()
  };

  try {
    await setDoc(statsRef, defaultStats);
  } catch (error) {
    console.error("Error initializing stats:", error);
  }
};

/**
 * Increments a specific statistic for a user.
 * @param {string} userId - The unique ID of the user.
 * @param {string} statField - The name of the stat (must match dashboard labels).
 * @param {number} value - The amount to increment (default is 1).
 */
export const updateUserStat = async (userId, statField, value = 1) => {
  if (!userId) return;
  const statsRef = doc(db, "userStats", userId);

  try {
    const statsSnap = await getDoc(statsRef);
    
    if (!statsSnap.exists()) {
      await initializeUserStats(userId);
    }

    await updateDoc(statsRef, {
      [statField]: increment(value),
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error(`Error updating ${statField}:`, error);
  }
};

/**
 * Recomputes attendance rate from persisted attendance_records.
 * @param {string} userId - Firebase Auth user id.
 */
export const recalculateAttendanceRate = async (userId) => {
  if (!userId || !db) {
    return;
  }

  const statsRef = doc(db, "userStats", userId);
  const attendanceQuery = query(
    collection(db, "attendance_records"),
    where("userId", "==", userId)
  );

  try {
    const statsSnap = await getDoc(statsRef);
    if (!statsSnap.exists()) {
      await initializeUserStats(userId);
    }

    const attendanceSnap = await getDocs(attendanceQuery);
    const presentDays = attendanceSnap.size;
    const totalDays = getWeekdaysSinceYearStart();
    const rate = Math.min(100, Math.round((presentDays / totalDays) * 100));

    await updateDoc(statsRef, {
      "Attendance Rate": `${rate}%`,
      attendancePresentDays: presentDays,
      lastUpdated: new Date(),
    });

    return rate;
  } catch (error) {
    console.error("Error recalculating attendance rate:", error);
    throw error;
  }
};