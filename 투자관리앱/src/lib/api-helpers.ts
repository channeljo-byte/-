import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return ok(data, 201);
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(msg = "Not found") {
  return err(msg, 404);
}

export function serverError(e: unknown) {
  const message = e instanceof Error ? e.message : "Internal server error";
  console.error("[API Error]", e);
  return err(message, 500);
}
