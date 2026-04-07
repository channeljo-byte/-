import mongoose, { Schema, Document, Model } from "mongoose";
import { Currency } from "@/lib/types";

// ─── 스냅샷 내 개별 자산 요약 ───
interface AssetSnapshot {
  assetId: mongoose.Types.ObjectId;
  name: string;
  ticker?: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;     // quantity × currentPrice
  currency: Currency;
  profitLoss: number;
  profitLossRate: number;
}

// ─── 스냅샷 내 부채 요약 ───
interface LiabilitySnapshot {
  liabilityId: mongoose.Types.ObjectId;
  name: string;
  remainingBalance: number;
  currency: Currency;
}

export interface ISnapshot extends Document {
  date: Date;                    // 스냅샷 기준 일자
  baseCurrency: Currency;        // 환산 기준 통화

  // 자산 총합 (baseCurrency 기준)
  totalAssetValue: number;       // 전체 자산 평가액
  totalCash: number;
  totalStocks: number;
  totalCrypto: number;
  totalOther: number;

  // 부채 총합
  totalLiabilityValue: number;

  // 순자산
  netWorth: number;              // totalAssetValue - totalLiabilityValue

  // 월간 수입/지출 (해당 월 기준)
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySaving: number;

  // 환율 스냅샷
  exchangeRates: Map<string, number>; // { "USD": 1380.5, "JPY": 9.2 }

  // 개별 내역
  assets: AssetSnapshot[];
  liabilities: LiabilitySnapshot[];

  createdAt: Date;
}

const AssetSnapshotSubSchema = new Schema(
  {
    assetId: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    name: { type: String, required: true },
    ticker: String,
    quantity: {
      type: Schema.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    avgPrice: {
      type: Schema.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    currentPrice: {
      type: Schema.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    currentValue: {
      type: Schema.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    currency: { type: String, enum: Object.values(Currency) },
    profitLoss: { type: Number },
    profitLossRate: { type: Number },
  },
  { _id: false }
);

const LiabilitySnapshotSubSchema = new Schema(
  {
    liabilityId: { type: Schema.Types.ObjectId, ref: "Liability", required: true },
    name: { type: String, required: true },
    remainingBalance: {
      type: Schema.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    currency: { type: String, enum: Object.values(Currency) },
  },
  { _id: false }
);

const SnapshotSchema = new Schema(
  {
    date: { type: Date, required: true, index: true, unique: true },
    baseCurrency: {
      type: String,
      enum: Object.values(Currency),
      default: Currency.KRW,
    },

    totalAssetValue: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    totalCash: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    totalStocks: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    totalCrypto: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    totalOther: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },

    totalLiabilityValue: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },

    netWorth: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },

    monthlyIncome: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    monthlyExpense: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    monthlySaving: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },

    exchangeRates: { type: Map, of: Number, default: {} },

    assets: [AssetSnapshotSubSchema],
    liabilities: [LiabilitySnapshotSubSchema],
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// 날짜 범위 조회 최적화
SnapshotSchema.index({ date: -1 });

const Snapshot =
  (mongoose.models.Snapshot as Model<ISnapshot>) ||
  mongoose.model<ISnapshot>("Snapshot", SnapshotSchema);

export default Snapshot;
