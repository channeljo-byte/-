import mongoose, { Schema, Document, Model } from "mongoose";
import { LiabilityType, Currency, RepaymentCycle } from "@/lib/types";

export interface ILiability extends Document {
  name: string;               // "신한은행 전세대출"
  liabilityType: LiabilityType;
  currency: Currency;

  principal: number;           // 원금
  remainingBalance: number;    // 잔액
  interestRate: number;        // 연이율 (%)

  repaymentCycle: RepaymentCycle;
  monthlyPayment?: number;     // 월 상환액
  startDate: Date;
  maturityDate?: Date;         // 만기일

  institution?: string;        // 금융기관명
  memo?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // 가상 필드
  totalInterest: number;
  paidAmount: number;
}

const LiabilitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    liabilityType: {
      type: String,
      enum: Object.values(LiabilityType),
      required: true,
      index: true,
    },
    currency: {
      type: String,
      enum: Object.values(Currency),
      required: true,
      default: Currency.KRW,
    },

    principal: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    remainingBalance: {
      type: Schema.Types.Decimal128,
      required: true,
      get: (v: mongoose.Types.Decimal128) => parseFloat(v?.toString() ?? "0"),
    },
    interestRate: { type: Number, required: true },

    repaymentCycle: {
      type: String,
      enum: Object.values(RepaymentCycle),
      default: RepaymentCycle.MONTHLY,
    },
    monthlyPayment: {
      type: Schema.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128 | null) =>
        v ? parseFloat(v.toString()) : undefined,
    },
    startDate: { type: Date, required: true },
    maturityDate: { type: Date },

    institution: { type: String, trim: true },
    memo: { type: String, trim: true, maxlength: 500 },

    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

LiabilitySchema.virtual("paidAmount").get(function () {
  const principal = parseFloat(this.principal?.toString() ?? "0");
  const remaining = parseFloat(this.remainingBalance?.toString() ?? "0");
  return principal - remaining;
});

LiabilitySchema.virtual("totalInterest").get(function () {
  const remaining = parseFloat(this.remainingBalance?.toString() ?? "0");
  return remaining * ((this.interestRate ?? 0) / 100);
});

const Liability =
  (mongoose.models.Liability as Model<ILiability>) ||
  mongoose.model<ILiability>("Liability", LiabilitySchema);

export default Liability;
