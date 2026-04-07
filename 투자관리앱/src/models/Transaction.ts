import mongoose, { Schema, Document, Model } from "mongoose";
import { TransactionType, Currency } from "@/lib/types";

export interface ITransaction extends Document {
  // 연결된 자산/부채
  assetId?: mongoose.Types.ObjectId;
  liabilityId?: mongoose.Types.ObjectId;

  transactionType: TransactionType;
  currency: Currency;

  // 거래 상세
  quantity: number;          // 거래 수량 (소수점 8자리)
  price: number;             // 거래 단가
  totalAmount: number;       // 총 거래 금액 (quantity × price + fee)
  fee: number;               // 수수료

  // 배당 관련
  dividendPerShare?: number; // 주당 배당금
  taxAmount?: number;        // 원천징수 세금

  // 환율 (외화 거래 시)
  exchangeRate?: number;     // 거래 시점 환율
  exchangedAmount?: number;  // 원화 환산 금액

  // 메타
  date: Date;                // 거래 일자
  category?: string;         // 가계부용 카테고리 ("식비", "교통비" 등)
  description?: string;
  memo?: string;

  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema(
  {
    assetId: { type: Schema.Types.ObjectId, ref: "Asset", index: true },
    liabilityId: { type: Schema.Types.ObjectId, ref: "Liability", index: true },

    transactionType: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
      index: true,
    },
    currency: {
      type: String,
      enum: Object.values(Currency),
      required: true,
      default: Currency.KRW,
    },

    quantity: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    price: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    totalAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    fee: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },

    dividendPerShare: { type: Number },
    taxAmount: { type: Number, default: 0 },

    exchangeRate: { type: Number },
    exchangedAmount: {
      type: Schema.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128 | null) =>
        v ? parseFloat(v.toString()) : undefined,
    },

    date: { type: Date, required: true, index: true },
    category: { type: String, trim: true, index: true },
    description: { type: String, trim: true },
    memo: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// 날짜 기반 조회 최적화
TransactionSchema.index({ date: -1, transactionType: 1 });
TransactionSchema.index({ assetId: 1, date: -1 });
TransactionSchema.index({ category: 1, date: -1 });

const Transaction =
  (mongoose.models.Transaction as Model<ITransaction>) ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
