import { jsonError, jsonSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/error-handler";
import { requireAuth } from "@/lib/rbac";
import { getLocalDateKey } from "@/lib/dateUtils";
import { checkRateLimit } from "@/lib/rateLimit";
import { AppError } from "@/lib/errors";
import { recordAttendanceSchema, withValidation } from "@/lib/validations";
import { AttendanceService } from "@/lib/services/attendanceService";
import { executeWithRetry } from "@/utils/dbRetry";

export const POST = withErrorHandler(
  withValidation(
    recordAttendanceSchema,
    async (request, validatedData, context) => {
      const token = await requireAuth(request);

      const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
      const rateLimitResult = await checkRateLimit(
        `attendance_record_${ip}_${token.uid}`
      );
      if (!rateLimitResult.allowed) {
        throw new AppError("Too many attempts. Please try again later.", 429);
      }

      const {
        userId,
        studentName,
        email,
        confidenceScore,
        date,
        curriculumNodeId,
      } = validatedData;
      const normalizedDate = date || getLocalDateKey();

      const isTeacherOrAdmin =
        token.role === "teacher" || token.role === "admin";
      if (token.uid !== userId && !isTeacherOrAdmin) {
        return jsonError(
          "Forbidden: Cannot submit attendance for another user",
          403
        );
      }

      const parsedConfidence = Number(confidenceScore);

      // Validation guard scaled cleanly against both structural percentage types
      if (
        (parsedConfidence > 1 && parsedConfidence < 60) ||
        (parsedConfidence <= 1 && parsedConfidence < 0.6)
      ) {
        return jsonError(
          "Bad Request: Invalid or spoofed confidence score",
          400
        );
      }

      // Automatically scale scores down to decimal representation only if provided as whole integers
      const executionConfidence =
        parsedConfidence > 1 ? parsedConfidence / 100 : parsedConfidence;

      try {
        const sagaResult = await executeWithRetry(async () => {
          return await AttendanceService.recordAttendance(
            {
              userId,
              studentName,
              email,
              confidenceScore: executionConfidence,
              normalizedDate,
              // Only inject key-pairs if they were explicit parts of the incoming request payload
              ...(curriculumNodeId !== undefined ? { curriculumNodeId } : {}),
            },
            token
          );
        });

        if (sagaResult.context?._alreadyRecorded) {
          return jsonSuccess({ alreadyRecorded: true }, 200);
        }

        if (!sagaResult.success) {
          console.error(
            JSON.stringify({
              message: `[attendance] Saga failed at step "${sagaResult.failedStep}"`,
              userId,
              curriculumNodeId,
              error: sagaResult.error,
              timestamp: new Date().toISOString(),
            })
          );

          if (
            sagaResult.error === "STALE_OBJECT_STATE" ||
            sagaResult.failedStep === "lock_curriculum"
          ) {
            return jsonError(
              "Conflict: The curriculum map was updated mid-flight. Please refresh.",
              409
            );
          }

          return jsonError("Attendance recording failed", 502);
        }

        return jsonSuccess({ alreadyRecorded: false }, 201);
      } catch (error) {
        console.error(
          JSON.stringify({
            message:
              "Uncaught transaction collision error in attendance logging",
            error: error.message,
            userId,
            timestamp: new Date().toISOString(),
          })
        );
        return jsonError("Database lock isolation failure. Please retry.", 500);
      }
    }
  )
);
