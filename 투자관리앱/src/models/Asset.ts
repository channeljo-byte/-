import mongoose, { Schema, Document, Model } from "mongoose";
import { AssetType, Currency } from "@/lib/types";

// ─── 인터페이스 ───
export interface IAsset extends Document {
  // 기본 정보
  name: string;            // "삼성전자", "SPY", "BTC"
  ticker?: string;         // "005930.KS", "SPY", "BTC"
  assetType: AssetType;
  currency: Currency;      // 자산의 기준 통화

  // 수량 & 단가 (소수점 8자리 — 크립토 대응)
  quantity: number;        // Mongoose Decimal128 → number로 가상 getter
  avgPrice: number;        // 평균 매입 단가
  currentPrice: number;    // 최신 시세

  // 메타데이터
  exchange?: string;       // "KRX", "NYSE", "UPBIT"
  sector?: string;         // 업종/카테고리
  memo?: string;

  // 배당/이자 관련
  dividendYield?: number;  // 연간 배당수익률 (%)
  lastDividendDate?: Date;
  isDividendReinvest: boolean; // 배당 재투자 여부

  // 시스템
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // 가상 필드 (computed)
  investedValue: number;
  currentValue: number;
  profitLoss: number;
  profitLossRate: number;
}

// ─── 스키마 ───
// Decimal128 필드는 인터페이스에서 number로 노출되지만 DB에는 Decimal128로 저장됨
// 제네릭 타입 추론 충돌을 피하기 위해 untyped Schema 사용
const AssetSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ticker: { type: String, trim: true, uppercase: true, index: true },
    assetType: {
      type: String,
      enum: Object.values(AssetType),
      required: true,
      index: true,
    },
    currency: {
      type: String,
      enum: Object.values(Currency),
      required: true,
      default: Currency.KRW,
    },

    // Decimal128 으로 저장 → 소수점 8자리 정밀도 (BTC: 0.00000001)
    quantity: {
      type: Schema.Types.Decimal128,
      required: true,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    avgPrice: {
      type: Schema.Types.Decimal128,
      required: true,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    currentPrice: {
      type: Schema.Types.Decimal128,
      required: true,
      default: 0,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },

    exchange: { type: String, trim: true },
    sector: { type: String, trim: true },
    memo: { type: String, trim: true, maxlength: 500 },

    dividendYield: { type: Number, default: 0 },
    lastDividendDate: { type: Date },
    isDividendReinvest: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// ─── 가상 필드 ───
AssetSchema.virtual("investedValue").get(function () {
  const qty = parseFloat(this.quantity?.toString() ?? "0");
  const avg = parseFloat(this.avgPrice?.toString() ?? "0");
  return qty * avg;
});

AssetSchema.virtual("currentValue").get(function () {
  const qty = parseFloat(this.quantity?.toString() ?? "0");
  const cur = parseFloat(this.currentPrice?.toString() ?? "0");
  return qty * cur;
});

AssetSchema.virtual("profitLoss").get(function () {
  return (this as any).currentValue - (this as any).investedValue;
});

AssetSchema.virtual("profitLossRate").get(function () {
  const invested = (this as any).investedValue;
  if (invested === 0) return 0;
  return ((this as any).profitLoss / invested) * 100;
});

// ─── 복합 인덱스 ───
AssetSchema.index({ assetType: 1, isActive: 1 });
AssetSchema.index({ currency: 1, assetType: 1 });

const Asset =
  (mongoose.models.Asset as Model<IAsset>) ||
  mongoose.model<IAsset>("Asset", AssetSchema);

export default Asset;
