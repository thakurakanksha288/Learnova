import {
  collection,
  addDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebaseConfig";

import { recalculateAttendanceRate } from "./statsService";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function hasCheckedInToday(userId) {
  if (!userId || !db) {
    return false;
  }

  const attendanceQuery = query(
    collection(db, "attendance_records"),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(attendanceQuery);
  const today = getTodayKey();

  return snapshot.docs.some((docSnap) => docSnap.data().date === today);
}

export async function recordAttendance({
  userId,
  studentName,
  email,
  confidenceScore,
}) {
  if (!userId || !db) {
    throw new Error("Attendance cannot be saved without a signed-in user.");
  }

  if (await hasCheckedInToday(userId)) {
    return { alreadyRecorded: true };
  }

  await addDoc(collection(db, "attendance_records"), {
    userId,
    studentName,
    email,
    timestamp: serverTimestamp(),
    date: getTodayKey(),
    status: "present",
    confidenceScore: confidenceScore ?? 0,
  });

  await recalculateAttendanceRate(userId);

  return { alreadyRecorded: false };
}
