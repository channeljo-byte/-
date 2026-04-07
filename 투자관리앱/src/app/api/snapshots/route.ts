import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Snapshot } from "@/models";
import { ok, created, err, serverError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") ?? "365");

    const filter: Record<string, unknown> = {};
    if (from || to) {
      filter.date = {};
      if (from) (filter.date as Record<string, unknown>).$gte = new Date(from);
      if (to) (filter.date as Record<string, unknown>).$lte = new Date(to);
    }

    const items = await Snapshot.find(filter).sort({ date: -1 }).limit(limit);
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    if (!body.date) return err("date는 필수입니다.");
    const item = await Snapshot.create(body);
    return created(item);
  } catch (e) {
    return serverError(e);
  }
}
