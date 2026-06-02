import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { authorizeCronRequest } from "@/lib/cronAuth";
import { connectDb } from "@/lib/mongodb";
import { initializeFirebase } from "@/lib/firebase-admin";
import { evaluateStudentAttendance } from "@/lib/attendanceUtils";

export const dynamic = "force-dynamic";

function getStudentUid(student) {
  return student?.uid || student?.firebaseUid;
}

function buildWarningPayload({ uid, email, name, evaluation, threshold, now }) {
  const notification = {
    userId: uid,
    title: "Low Attendance Warning",
    message: `Your current attendance is ${evaluation.percentage}%, which is below the required ${threshold}%. Please improve your attendance.`,
    type: "warning",
    read: false,
    createdAt: now,
  };

  const warningLog = {
    userId: uid,
    percentage: evaluation.percentage,
    threshold,
    createdAt: now,
  };

  const emailData = email
    ? {
        to_email: email,
        to_name: name || "Student",
        attendance_percentage: evaluation.percentage,
        threshold,
      }
    : null;

  return { notification, warningLog, emailData };
}

async function getRecentWarningUserIds(db, userIds, cooldownDate) {
  if (userIds.length === 0) {
    return new Set();
  }

  const warningLogs = db.collection("warning_logs");
  if (typeof warningLogs.find === "function") {
    const cursor = warningLogs.find({
      userId: { $in: userIds },
      createdAt: { $gte: cooldownDate },
    });
    const projectedCursor =
      typeof cursor.project === "function" ? cursor.project({ userId: 1 }) : cursor;
    const recentLogs =
      typeof projectedCursor.toArray === "function"
        ? await projectedCursor.toArray()
        : null;

    if (Array.isArray(recentLogs)) {
      return new Set(recentLogs.map((log) => log.userId));
    }
  }

  const checks = await Promise.all(
    userIds.map(async (uid) => {
      if (typeof warningLogs.findOne !== "function") {
        return null;
      }

      const recentLog = await warningLogs.findOne({
        userId: uid,
        createdAt: { $gte: cooldownDate },
      });

      return recentLog ? uid : null;
    })
  );

  return new Set(checks.filter(Boolean));
}

async function loadMongoAttendanceByUser(db, instituteId, studentIds) {
  if (!instituteId || studentIds.length === 0) {
    return null;
  }

  const attendanceCollection = db.collection("attendance");
  if (typeof attendanceCollection.find !== "function") {
    return null;
  }

  const records = await attendanceCollection
    .find({
      userId: { $in: studentIds },
      instituteId,
    })
    .toArray();

  const attendanceByUser = new Map(studentIds.map((uid) => [uid, []]));
  for (const record of records) {
    if (!attendanceByUser.has(record.userId)) {
      attendanceByUser.set(record.userId, []);
    }
    attendanceByUser.get(record.userId).push(record);
  }

  return attendanceByUser;
}

async function loadFirestoreAttendanceByUser(firestore, studentIds) {
  const attendanceByUser = new Map();

  await Promise.all(
    studentIds.map(async (uid) => {
      const snapshot = await firestore
        .collection("attendance_records")
        .where("userId", "==", uid)
        .get();

      attendanceByUser.set(
        uid,
        snapshot.docs.map((doc) => doc.data())
      );
    })
  );

  return attendanceByUser;
}

async function sendWarningEmails(emailsToSend) {
  const hasEmailConfig =
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY;

  if (!hasEmailConfig || emailsToSend.length === 0) {
    return;
  }

  for (const emailData of emailsToSend) {
    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_TEMPLATE_ID,
          user_id: process.env.EMAILJS_PUBLIC_KEY,
          template_params: emailData,
        }),
      });
    } catch (error) {
      console.error(`Failed to send email to ${emailData.to_email}:`, error);
    }
  }
}

export async function GET(request) {
  try {
    const cronAuth = authorizeCronRequest(request);
    if (!cronAuth.authorized) {
      return cronAuth.response;
    }

    const db = await connectDb();
    initializeFirebase();
    const firestore = admin.firestore();

    const allSettings = await db
      .collection("settings")
      .find({
        "institute.enableAttendanceAutomation": true,
      })
      .toArray();

    if (!allSettings || allSettings.length === 0) {
      return NextResponse.json({
        message:
          "Automation is not enabled for any institute or no settings found.",
      });
    }

    const now = new Date();
    const cooldownDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const notificationsToInsert = [];
    const warningLogsToInsert = [];
    const emailsToSend = [];

    for (const settings of allSettings) {
      const threshold = settings.institute.lowAttendanceThreshold || 75;

      // Fetch all students from MongoDB
      const students = await db.collection('users').find({ role: 'student' }).toArray();

      for (const student of students) {
        const studentUid = student.firebaseUid;
        if (!studentUid) continue;

        // Check recent warning logs to prevent spam
        const recentLog = await db.collection('warning_logs').findOne({
          userId: studentUid,
          createdAt: { $gte: cooldownDate }
        });

        if (recentLog) {
          continue;
        }

        // Fetch attendance records from Firestore attendance_records collection
        const attendanceSnapshot = await firestore
          .collection('attendance_records')
          .where('userId', '==', studentUid)
          .get();

        const studentAttendance = attendanceSnapshot.docs.map(doc => doc.data());

        const evaluation = evaluateStudentAttendance(studentAttendance, threshold);

        if (evaluation.isBelowThreshold) {
          notificationsToInsert.push({
            userId: studentUid,
            title: 'Low Attendance Warning',
            message: `Your current attendance is ${evaluation.percentage}%, which is below the required ${threshold}%. Please improve your attendance.`,
            type: 'warning',
            read: false,
            createdAt: now,
          });

          warningLogsToInsert.push({
            userId: studentUid,
            percentage: evaluation.percentage,
            threshold,
            createdAt: now,
          });

          if (student.email) {
            emailsToSend.push({
              to_email: student.email,
              to_name: student.fullName || student.name || 'Student',
              attendance_percentage: evaluation.percentage,
              threshold,
            });
          }
        }
      }
    }

    if (notificationsToInsert.length > 0) {
      await db.collection("notifications").insertMany(notificationsToInsert);
      await db.collection("warning_logs").insertMany(warningLogsToInsert);
    }

    await sendWarningEmails(emailsToSend);

    return NextResponse.json({
      success: true,
      warningsIssued: notificationsToInsert.length,
      message: `Issued ${notificationsToInsert.length} warnings.`,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
