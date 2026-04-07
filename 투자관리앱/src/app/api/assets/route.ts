import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Asset } from "@/models";
import { ok, created, err, serverError } from "@/lib/api-helpers";

// GET /api/assets — 전체 자산 목록
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type");
    const active = searchParams.get("active");

    const filter: Record<string, unknown> = {};
    if (type) filter.assetType = type;
    if (active !== null) filter.isActive = active !== "false";

    const assets = await Asset.find(filter).sort({ updatedAt: -1 });
    return ok(assets);
  } catch (e) {
    return serverError(e);
  }
}

// POST /api/assets — 자산 추가
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    if (!body.name || !body.assetType) {
      return err("name과 assetType은 필수입니다.");
    }

    const asset = await Asset.create(body);
    return created(asset);
  } catch (e) {
    return serverError(e);
  }
}
