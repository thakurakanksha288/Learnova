import { jsonError, jsonSuccess } from "@/lib/api-response";
import { withErrorHandler, parseJSON } from "@/lib/error-handler";
import { requireAdmin } from "@/lib/rbac";
import { initFirebaseAdmin } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { connectDb } from "@/lib/mongodb";
import { checkRateLimit } from "@/lib/rateLimit";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandler(async (request) => {
  await requireAdmin(request);
  initFirebaseAdmin();
  const db = getFirestore();

  // Fetch all links from Firestore
  const linksSnap = await db.collection("parent_student_links").get();
  const links = [];

  for (const doc of linksSnap.docs) {
    const data = doc.data();
    // Resolve names and emails
    const parentDoc = await db.collection("users").doc(data.parentId).get();
    const studentDoc = await db.collection("users").doc(data.studentId).get();

    links.push({
      id: doc.id,
      parentId: data.parentId,
      studentId: data.studentId,
      createdAt: data.createdAt,
      parentName: parentDoc.exists ? (parentDoc.data().fullName || parentDoc.data().name || "Unknown") : "Unknown Parent",
      parentEmail: parentDoc.exists ? parentDoc.data().email : "N/A",
      studentName: studentDoc.exists ? (studentDoc.data().fullName || studentDoc.data().name || "Unknown") : "Unknown Student",
      studentEmail: studentDoc.exists ? studentDoc.data().email : "N/A",
    });
  }

  return jsonSuccess({ links }, 200);
});

export const POST = withErrorHandler(async (request) => {
  const { payload } = await requireAdmin(request);
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimitResult = await checkRateLimit(`link_creation_${ip}_${payload.uid}`);
  if (!rateLimitResult.allowed) {
    throw new AppError("Too many attempts. Please try again later.", 429);
  }

  const body = await parseJSON(request, 1024 * 5);
  const { parentEmail, studentEmail } = body;

  if (!parentEmail || !studentEmail) {
    return jsonError("Parent and student emails are required", 400);
  }

  initFirebaseAdmin();
  const db = getFirestore();

  // Find parent by email
  const parentQuery = await db
    .collection("users")
    .where("email", "==", parentEmail.trim().toLowerCase())
    .limit(1)
    .get();

  if (parentQuery.empty) {
    return jsonError(`Parent with email "${parentEmail}" not found`, 404);
  }

  const parentProfile = parentQuery.docs[0].data();
  if (parentProfile.role !== "parent") {
    return jsonError(`User "${parentEmail}" is registered as "${parentProfile.role}", not "parent"`, 400);
  }

  // Find student by email
  const studentQuery = await db
    .collection("users")
    .where("email", "==", studentEmail.trim().toLowerCase())
    .limit(1)
    .get();

  if (studentQuery.empty) {
    return jsonError(`Student with email "${studentEmail}" not found`, 404);
  }

  const studentProfile = studentQuery.docs[0].data();
  if (studentProfile.role !== "student") {
    return jsonError(`User "${studentEmail}" is registered as "${studentProfile.role}", not "student"`, 400);
  }

  const parentId = parentProfile.uid;
  const studentId = studentProfile.uid;
  const linkId = `${parentId}_${studentId}`;

  // Check if link already exists
  const existingLink = await db.collection("parent_student_links").doc(linkId).get();
  if (existingLink.exists) {
    return jsonError("This relationship is already linked", 400);
  }

  const linkData = {
    parentId,
    studentId,
    createdAt: new Date().toISOString(),
  };

  // Add to Firestore
  await db.collection("parent_student_links").doc(linkId).set(linkData);

  // Add to MongoDB
  try {
    const mongoDb = await connectDb();
    await mongoDb.collection("parent_student_links").updateOne(
      { _id: linkId },
      { $set: { ...linkData, _id: linkId } },
      { upsert: true }
    );
  } catch (mongoError) {
    console.error("Failed to sync parent-student link to MongoDB:", mongoError);
  }

  return jsonSuccess({ success: true, link: { id: linkId, ...linkData } }, 201);
});

export const DELETE = withErrorHandler(async (request) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const parentId = url.searchParams.get("parentId");
  const studentId = url.searchParams.get("studentId");

  if (!parentId || !studentId) {
    return jsonError("Missing parentId or studentId parameters", 400);
  }

  const linkId = `${parentId}_${studentId}`;
  initFirebaseAdmin();
  const db = getFirestore();

  // Delete from Firestore
  await db.collection("parent_student_links").doc(linkId).delete();

  // Delete from MongoDB
  try {
    const mongoDb = await connectDb();
    await mongoDb.collection("parent_student_links").deleteOne({ _id: linkId });
  } catch (mongoError) {
    console.error("Failed to delete link from MongoDB:", mongoError);
  }

  return jsonSuccess({ success: true }, 200);
});
