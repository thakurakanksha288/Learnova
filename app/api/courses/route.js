import { NextResponse } from "next/server";
import { getPaginatedCourses } from "@/lib/courses";
import { initFirebaseAdmin, requireAuth } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

/**
 * GET /api/courses
 * Retrieves a paginated, filtered list of courses.
 */
const MAX_LIMIT = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "all";

    const rawPage = parseInt(
      searchParams.get("page") || String(DEFAULT_PAGE),
      10
    );
    const rawLimit = parseInt(
      searchParams.get("limit") || String(DEFAULT_LIMIT),
      10
    );

    // Clamp: reject NaN, enforce min/max bounds
    const page =
      Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : DEFAULT_PAGE;
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 1
        ? Math.min(rawLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const result = getPaginatedCourses({ q, category, page, limit });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("API Course Fetch Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/courses
 * Synchronizes curriculum modules with versioned state isolation (OCC).
 */
export async function PUT(request) {
  try {
    // 1. Verify access permissions via RBAC middleware
    const token = await requireAuth(request);
    if (token.role !== "admin" && token.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden: Insufficient privileges" }, { status: 403 });
    }

    const body = await request.json();
    const { curriculumNodeId, newStructure, currentVersion } = body;

    if (!curriculumNodeId || currentVersion === undefined) {
      return NextResponse.json(
        { error: 'Bad Request: Missing curriculumNodeId or currentVersion parameters.' }, 
        { status: 400 }
      );
    }

    initFirebaseAdmin();
    const db = getFirestore();
    const curriculumRef = db.collection("curriculum_nodes").doc(curriculumNodeId);

    // 2. Perform atomic version checks using a Firestore transaction
    await db.runTransaction(async (transaction) => {
      const curriculumDoc = await transaction.get(curriculumRef);
      
      if (!curriculumDoc.exists) {
        throw new Error("NOT_FOUND");
      }

      const currentDbData = curriculumDoc.data();
      const databaseVersion = currentDbData.version || 1;

      // Conflict matching verification
      if (databaseVersion !== Number(currentVersion)) {
        throw new Error("STALE_VERSION");
      }

      // 3. Save updates safely and step forward the tracking counter
      transaction.update(curriculumRef, {
        structure_data: newStructure,
        version: databaseVersion + 1,
        updatedAt: new Date()
      });
    });

    return NextResponse.json({ success: true, message: 'Curriculum structure synchronized securely.' });

  } catch (error) {
    console.error("API Course Synchronization Error:", error.message);

    if (error.message === "STALE_VERSION") {
      return NextResponse.json({ 
        error: 'CONFLICT', 
        message: 'The curriculum map has changed. Please refresh your view to fetch latest changes.' 
      }, { status: 409 });
    }

    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: 'Referenced curriculum entry not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error during restructuring" },
      { status: 500 }
    );
  }
}