import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Liability } from "@/models";
import { ok, created, err, serverError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const active = req.nextUrl.searchParams.get("active");
    const filter: Record<string, unknown> = {};
    if (active !== null) filter.isActive = active !== "false";

    const items = await Liability.find(filter).sort({ updatedAt: -1 });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    if (!body.name || !body.liabilityType || body.principal == null) {
      return err("name, liabilityType, principal은 필수입니다.");
    }
    const item = await Liability.create(body);
    return created(item);
  } catch (e) {
    return serverError(e);
  }
}
