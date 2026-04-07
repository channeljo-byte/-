// ─── 자산 타입 ───
export enum AssetType {
  STOCK_KR = "STOCK_KR",       // 한국 주식
  STOCK_US = "STOCK_US",       // 미국 주식/ETF
  CRYPTO = "CRYPTO",           // 암호화폐
  CASH = "CASH",               // 예금/현금
  BOND = "BOND",               // 채권
  FUND = "FUND",               // 펀드
  REAL_ESTATE = "REAL_ESTATE", // 부동산
  GOLD = "GOLD",               // 금
  OTHER = "OTHER",
}

// ─── 기준 통화 ───
export enum Currency {
  KRW = "KRW",
  USD = "USD",
  EUR = "EUR",
  JPY = "JPY",
  BTC = "BTC", // 크립토 기준 단위
}

// ─── 거래 유형 ───
export enum TransactionType {
  BUY = "BUY",
  SELL = "SELL",
  DIVIDEND = "DIVIDEND",           // 배당금 수령
  DIVIDEND_REINVEST = "DIVIDEND_REINVEST", // 배당금 재투자
  DEPOSIT = "DEPOSIT",             // 입금
  WITHDRAWAL = "WITHDRAWAL",       // 출금
  INTEREST = "INTEREST",           // 이자
  FEE = "FEE",                     // 수수료
  TRANSFER_IN = "TRANSFER_IN",     // 자산 이전(입고)
  TRANSFER_OUT = "TRANSFER_OUT",   // 자산 이전(출고)
}

// ─── 부채 유형 ───
export enum LiabilityType {
  LOAN = "LOAN",             // 대출
  CREDIT_CARD = "CREDIT_CARD",
  MORTGAGE = "MORTGAGE",     // 주택담보대출
  INSTALLMENT = "INSTALLMENT", // 할부
  OTHER = "OTHER",
}

// ─── 부채 상환 주기 ───
export enum RepaymentCycle {
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  YEARLY = "YEARLY",
  BULLET = "BULLET", // 만기 일시상환
}
