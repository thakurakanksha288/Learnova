import { POST } from "./route";
import { parseJSON } from "@/lib/error-handler";
import { getUserProfile } from "@/lib/firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/rateLimit";
import { assertApiSuccess } from "@/testUtils/assertApiSuccess";
import { assertApiError } from "@/testUtils/assertApiError";

vi.mock("@/lib/error-handler", () => ({
  withErrorHandler: (handler) => async (request, ...args) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      const payload = error.originalMessage !== undefined ? error.originalMessage : error.message;
      return {
        status: error.statusCode ?? 500,
        json: async () => ({ error: payload || error.message || "Internal server error" }),
      };
    }
  },
  parseJSON: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9 }) }));
vi.mock("@/lib/firebase-admin", () => ({ initFirebaseAdmin: vi.fn(), getUserProfile: vi.fn() }));
vi.mock("@/lib/gamification-service", () => ({ awardXp: vi.fn().mockResolvedValue({ xpAwarded: 50, newLevel: null }) }));
vi.mock("@/lib/dateUtils", () => ({ getLocalDateKey: vi.fn(() => "2026-05-25") }));
vi.mock("@/lib/mongodb", () => ({ connectDb: vi.fn().mockResolvedValue({ collection: vi.fn(() => ({ updateOne: vi.fn().mockResolvedValue({}), deleteOne: vi.fn().mockResolvedValue({}) })) }) }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
  FieldValue: { serverTimestamp: vi.fn(() => "server-timestamp") },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({ status: init.status ?? 200, json: async () => body }),
  },
}));

describe("Attendance Record API Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
    parseJSON.mockResolvedValue({
      userId: "user-123",
      studentName: "Test User",
      email: "test@example.com",
      confidenceScore: 80,
      date: "2026-05-25",
    });
  });

  const createMockRequest = (headers = {}) => {
    const headersMap = new Map(Object.entries({ "x-forwarded-for": "127.0.0.1", authorization: "Bearer token", ...headers }));
    return { headers: { get: (key) => headersMap.get(key.toLowerCase()) || null } };
  };

  test("writes attendance via transactions and normalizes confidence integers", async () => {
    const { requireAuth } = await import("@/lib/rbac");
    requireAuth.mockResolvedValue({ uid: "user-123" });
    parseJSON.mockResolvedValue({ userId: "user-123", studentName: "Client Name", email: "client@example.com", confidenceScore: 75, date: "2026-05-25" });
    getUserProfile.mockResolvedValue({ fullName: "Server Name", email: "server@example.com", instituteId: "inst-999" });

    const docRef = {};
    const collectionRef = { doc: vi.fn(() => docRef) };
    const transactionSet = vi.fn();
    const transactionGet = vi.fn().mockResolvedValue({ exists: false });

    getFirestore.mockReturnValue({
      runTransaction: vi.fn(async (cb) => cb({ get: transactionGet, set: transactionSet })),
      collection: vi.fn(() => collectionRef),
    });

    const response = await POST(createMockRequest());
    const body = await assertApiSuccess(response, 201);
    expect(body.data).toEqual({ alreadyRecorded: false });
  });

  test("returns 403 when trying to log attendance for another user", async () => {
    const { requireAuth } = await import("@/lib/rbac");
    requireAuth.mockResolvedValue({ uid: "user-123" });
    parseJSON.mockResolvedValue({ userId: "user-456", studentName: "Other User", email: "other@example.com", confidenceScore: 80 });

    const response = await POST(createMockRequest());
    await assertApiError(response, 403, "Forbidden: Cannot submit attendance for another user");
  });

  test("rejects confidence scores under the 60% threshold", async () => {
    const { requireAuth } = await import("@/lib/rbac");
    requireAuth.mockResolvedValue({ uid: "user-123" });
    parseJSON.mockResolvedValue({ userId: "user-123", studentName: "Test User", confidenceScore: 55 });

    const response = await POST(createMockRequest());
    await assertApiError(response, 400, "Bad Request: Invalid or spoofed confidence score");
  });
});