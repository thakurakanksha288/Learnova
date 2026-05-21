import { NextResponse } from "next/server";
import { connectDb } from "@/lib/mongodb";
import { verifyFirebaseToken, getUserProfile } from "@/lib/firebase-admin";

export async function PATCH(request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.split(" ")[1];

    const decodedToken = await verifyFirebaseToken(token);

    if (!decodedToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId: bodyUserId, ...settings } = body;
    
    let targetUserId = decodedToken.uid;
    let isOperatorAdmin = false;

    if (bodyUserId && bodyUserId !== decodedToken.uid) {
      const profile = await getUserProfile(decodedToken.uid);
      if (!profile || profile.role !== "admin") {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to update another user's settings." },
          { status: 403 }
        );
      }
      targetUserId = bodyUserId;
      isOperatorAdmin = true;
    }

    const db = await connectDb();

    await db.collection("settings").updateOne(
      { userId: targetUserId },
      { $set: { ...settings, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log(
      `[Audit Log] Settings updated successfully for target user: ${targetUserId} by operator: ${decodedToken.uid} (Role: ${isOperatorAdmin ? "admin" : "owner"})`
    );

    return NextResponse.json(
      { message: "Settings saved successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Settings save error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}