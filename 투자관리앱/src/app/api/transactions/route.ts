import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Transaction } from "@/models";
import { ok, created, err, serverError } from "@/lib/api-helpers";

// GET /api/transactions
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const assetId = searchParams.get("assetId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") ?? "100");
    const skip = parseInt(searchParams.get("skip") ?? "0");

    const filter: Record<string, unknown> = {};
    if (type) filter.transactionType = type;
    if (category) filter.category = category;
    if (assetId) filter.assetId = assetId;
    if (from || to) {
      filter.date = {};
      if (from) (filter.date as Record<string, unknown>).$gte = new Date(from);
      if (to) (filter.date as Record<string, unknown>).$lte = new Date(to);
    }

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);

    return ok({ items, total, limit, skip });
  } catch (e) {
    return serverError(e);
  }
}

// POST /api/transactions
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    if (!body.transactionType || !body.date || body.totalAmount == null) {
      return err("transactionType, date, totalAmount은 필수입니다.");
    }

    const tx = await Transaction.create(body);
    return created(tx);
  } catch (e) {
    return serverError(e);
  }
}
