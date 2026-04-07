import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Transaction } from "@/models";
import { ok, notFound, serverError } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const tx = await Transaction.findById(id);
    if (!tx) return notFound();
    return ok(tx);
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const tx = await Transaction.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });
    if (!tx) return notFound();
    return ok(tx);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const tx = await Transaction.findByIdAndDelete(id);
    if (!tx) return notFound();
    return ok({ message: "삭제 완료" });
  } catch (e) {
    return serverError(e);
  }
}
