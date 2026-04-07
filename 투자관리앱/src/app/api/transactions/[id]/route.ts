import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Transaction, Asset } from "@/models";
import { ok, notFound, err, serverError } from "@/lib/api-helpers";

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
  if (INCOME_TYPES.has(transactionType)) delta = numAmount;
  else if (EXPENSE_TYPES.has(transactionType)) delta = -numAmount;
  if (delta === 0) return;

  await Asset.findByIdAndUpdate(assetId, { $inc: { quantity: delta } });
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
  if (INCOME_TYPES.has(transactionType)) delta = -numAmount;
  else if (EXPENSE_TYPES.has(transactionType)) delta = numAmount;
  if (delta === 0) return;

  await Asset.findByIdAndUpdate(assetId, { $inc: { quantity: delta } });
}

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

    // 기존 트랜잭션 조회
    const oldTx = await Transaction.findById(id);
    if (!oldTx) return notFound();

    // 1) 기존 잔액 효과 롤백
    const oldAssetId = oldTx.assetId?.toString();
    const oldAmount = Number(oldTx.totalAmount?.toString() ?? "0");
    await reverseBalance(oldAssetId, oldTx.transactionType, oldAmount);

    // 2) 트랜잭션 업데이트
    const tx = await Transaction.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });
    if (!tx) return notFound();

    // 3) 새 잔액 효과 적용
    const newAssetId = body.assetId ?? oldAssetId;
    const newAmount = body.totalAmount != null ? Number(body.totalAmount) : oldAmount;
    const newType = body.transactionType ?? oldTx.transactionType;
    await adjustBalance(newAssetId, newType, newAmount);

    return ok(tx);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectDB();
    const { id } = await params;

    // 기존 트랜잭션 조회
    const tx = await Transaction.findById(id);
    if (!tx) return notFound();

    // 잔액 롤백
    const assetId = tx.assetId?.toString();
    const amount = Number(tx.totalAmount?.toString() ?? "0");
    await reverseBalance(assetId, tx.transactionType, amount);

    // 삭제
    await Transaction.findByIdAndDelete(id);

    return ok({ message: "삭제 완료" });
  } catch (e) {
    return serverError(e);
  }
}
