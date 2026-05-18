import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { userId, ...settings } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    await db.collection("settings").updateOne(
      { userId },
      { $set: { ...settings, updatedAt: new Date() } },
      { upsert: true }
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