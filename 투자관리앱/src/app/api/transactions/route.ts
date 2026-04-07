import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Transaction, Asset } from "@/models";
import { ok, created, err, serverError } from "@/lib/api-helpers";

// ─── 잔액 연동 헬퍼 ───
const INCOME_TYPES = new Set(["DEPOSIT", "DIVIDEND", "INTEREST"]);
const EXPENSE_TYPES = new Set(["WITHDRAWAL", "FEE"]);

async function adjustBalance(
  assetId: string | undefined | null,
  transactionType: string,
  amount: number,
) {
  if (!assetId) return;
  const numAmount = Number(amount) || 0;
  if (numAmount === 0) return;

  let delta = 0;
  if (INCOME_TYPES.has(transactionType)) {
    delta = numAmount; // 수입 → 잔액 증가
  } else if (EXPENSE_TYPES.has(transactionType)) {
    delta = -numAmount; // 지출 → 잔액 차감
  }
  if (delta === 0) return;

  await Asset.findByIdAndUpdate(assetId, {
    $inc: { quantity: delta },
  });
}

async function reverseBalance(
  assetId: string | undefined | null,
  transactionType: string,
  amount: number,
) {
  if (!assetId) return;
  const numAmount = Number(amount) || 0;
  if (numAmount === 0) return;

  let delta = 0;
  if (INCOME_TYPES.has(transactionType)) {
    delta = -numAmount; // 수입 롤백 → 잔액 차감
  } else if (EXPENSE_TYPES.has(transactionType)) {
    delta = numAmount; // 지출 롤백 → 잔액 복원
  }
  if (delta === 0) return;

  await Asset.findByIdAndUpdate(assetId, {
    $inc: { quantity: delta },
  });
}

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

    // 복식부기: 연결된 계좌 잔액 조정
    await adjustBalance(body.assetId, body.transactionType, body.totalAmount);

    return created(tx);
  } catch (e) {
    return serverError(e);
  }
}
