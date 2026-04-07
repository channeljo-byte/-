import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Asset } from "@/models";
import { ok, notFound, serverError } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/assets/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const asset = await Asset.findById(id);
    if (!asset) return notFound("자산을 찾을 수 없습니다.");
    return ok(asset);
  } catch (e) {
    return serverError(e);
  }
}

// PUT /api/assets/:id
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const asset = await Asset.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });
    if (!asset) return notFound("자산을 찾을 수 없습니다.");
    return ok(asset);
  } catch (e) {
    return serverError(e);
  }
}

// DELETE /api/assets/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;
    const asset = await Asset.findByIdAndDelete(id);
    if (!asset) return notFound("자산을 찾을 수 없습니다.");
    return ok({ message: "삭제 완료" });
  } catch (e) {
    return serverError(e);
  }
}
