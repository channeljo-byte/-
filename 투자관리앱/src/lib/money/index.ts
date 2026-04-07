/**
 * Money 라이브러리 — 공개 API
 *
 * 사용 예시:
 *   import { Money, DecimalService, formatMoney } from "@/lib/money";
 */

export { Money, CURRENCY_PRECISION } from "./Money";
export type { MoneyJSON } from "./Money";

export { bankersRound, bankersRoundToDecimal, bankersRoundAll } from "./bankersRounding";

export { DecimalService } from "./DecimalService";
export type { AmortizationRow, TaxResult, ReturnResult } from "./DecimalService";

// formatters는 클라이언트 전용이므로 별도 경로로 임포트를 권장합니다:
// import { formatMoney } from "@/lib/money/formatters";
// 단, 편의를 위해 여기서도 re-export합니다.
export {
  toDinero,
  fromDinero,
  formatMoney,
  formatBTC,
  formatMoneyCompact,
  formatKRWCompact,
  formatRate,
  formatChange,
} from "./formatters";
