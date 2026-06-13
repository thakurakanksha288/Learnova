import { NextResponse } from "next/server";
import { connectDb } from "@/lib/mongodb";
import { put, del } from "@vercel/blob";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rateLimit";
import logger from "@/utils/logger";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request) {
  let uploadedBlobUrl = null;

  try {
    // 1. Enforce Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateLimitResult = await checkRateLimit(ip);
    if (rateLimitResult && !rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Validate Authentication Header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await verifyFirebaseToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Process incoming FormData
    const formData = await request.formData();
    const name = formData.get("name");
    const rollNo = formData.get("rollNo");
    const email = formData.get("email");
    const photoFile = formData.get("photo");

    // 4. Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      !email ||
      !emailRegex.test(email) ||
      email.endsWith(".") ||
      email.includes(" ")
    ) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // 5. Authorize token identity against requested profile
    if (decodedToken.email !== email) {
      return NextResponse.json(
        { error: "Forbidden: Identity mismatch" },
        { status: 403 }
      );
    }

    // 6. Handle File Upload via Vercel Blob
    if (photoFile && typeof photoFile !== "string") {
      if (photoFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File size exceeds 5MB limit" },
          { status: 413 }
        );
      }
      if (!ALLOWED_IMAGE_TYPES.has(photoFile.type)) {
        return NextResponse.json(
          { error: "Invalid image type" },
          { status: 415 }
        );
      }

      const blob = await put(`avatars/${email}-${Date.now()}.jpg`, photoFile, {
        access: "public",
      });
      uploadedBlobUrl = blob.url;
    }

    // 7. Commit to MongoDB
    const mongoDB = await connectDb();
    const usersCollection = mongoDB.collection("users");

    // Fast-path application-layer duplicate check
    const existingUser = await usersCollection.findOne({
      $or: [{ rollNo }, { email }],
    });

    if (existingUser) {
      if (uploadedBlobUrl) await del(uploadedBlobUrl).catch(() => {});
      return NextResponse.json(
        { error: "User already registered" },
        { status: 409 }
      );
    }

    const newUser = {
      name: name ? String(name).trim() : "",
      rollNo: rollNo ? String(rollNo).trim() : "",
      email,
      photoUrl: uploadedBlobUrl,
      createdAt: new Date(),
    };

    await usersCollection.insertOne(newUser);

    return NextResponse.json(
      {
        success: true,
        data: { user: newUser },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Registration Error]:", error);

    // 8. Error Catching & Rollback Routines (Fixed syntax here)
    if (uploadedBlobUrl) {
      await del(uploadedBlobUrl).catch((cleanupErr) =>
        console.error(
          "Failed to delete blob during rollback:",
          cleanupErr.message
        )
      );
    }

    // Capture unique indexing collisions (Code 11000)
    if (error.code === 11000 || error.message?.includes("E11000")) {
      return NextResponse.json(
        { error: "User already registered" },
        { status: 409 }
      );
    }

    // Generic system failure response
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
