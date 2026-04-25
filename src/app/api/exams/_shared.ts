/**
 * Shared API response helpers for the exam endpoints.
 */
import { NextResponse } from "next/server";
import { ExamServiceError } from "@/lib/exam/pg-exam-service";

/** Build a success JSON response. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Build an error JSON response from a service error. */
export function fromServiceError(err: unknown) {
  if (err instanceof ExamServiceError) {
    const status = errorCodeToStatus(err.code);
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message } },
      { status },
    );
  }
  // Unknown error — log and return generic 500
  console.error("[exam-api]", err);
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL_ERROR", message: "An internal error occurred." } },
    { status: 500 },
  );
}

/** Build a validation error response. */
export function validationError(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

function errorCodeToStatus(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "ALREADY_SUBMITTED":
    case "INVALID_STATE":
    case "OUT_OF_RANGE":
      return 409;
    case "NO_QUESTIONS":
      return 422;
    default:
      return 500;
  }
}
