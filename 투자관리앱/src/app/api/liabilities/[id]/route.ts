import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Liability } from "@/models";
import { ok, notFound, serverError } from "@/lib/api-helpers";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const item = await Liability.findById(id);
    if (!item) return notFound();
    return ok(item);
  } catch (e) { return serverError(e); }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const item = await Liability.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!item) return notFound();
    return ok(item);
  } catch (e) { return serverError(e); }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const item = await Liability.findByIdAndDelete(id);
    if (!item) return notFound();
    return ok({ message: "삭제 완료" });
  } catch (e) { return serverError(e); }
}
