import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";

/**
 * GET /api/price?ticker=BTC&type=CRYPTO
 * GET /api/price?ticker=AAPL&type=STOCK_US
 * GET /api/price?ticker=005930&type=STOCK_KR
 *
 * 외부 API:
 *   코인  → Upbit (KRW 직접 조회)
 *   미국  → Yahoo Finance
 *   한국  → Yahoo Finance (.KS / .KQ)
 */

interface PriceResult {
  ticker: string;
  price: number;
  currency: string;
  name?: string;
}

// ─── 코인: Upbit API ───
async function fetchCryptoPrice(ticker: string): Promise<PriceResult | null> {
  const symbol = ticker.toUpperCase();
  const market = `KRW-${symbol}`;
  try {
    const res = await fetch(
      `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(market)}`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      ticker: symbol,
      price: data[0].trade_price,
      currency: "KRW",
      name: symbol,
    };
  } catch {
    return null;
  }
}

// ─── 미국 주식: Yahoo Finance ───
async function fetchUSStockPrice(ticker: string): Promise<PriceResult | null> {
  const symbol = ticker.toUpperCase();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      ticker: symbol,
      price: meta.regularMarketPrice ?? 0,
      currency: "USD",
      name: meta.shortName || meta.symbol || symbol,
    };
  } catch {
    return null;
  }
}

// ─── 한국 주식: Yahoo Finance (.KS / .KQ) ───
async function fetchKRStockPrice(ticker: string): Promise<PriceResult | null> {
  const raw = ticker.replace(/\.(KS|KQ)$/i, "");

  // .KS(코스피) 먼저, 실패 시 .KQ(코스닥) 시도
  for (const suffix of [".KS", ".KQ"]) {
    const symbol = raw + suffix;
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
        { next: { revalidate: 60 } },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || !meta.regularMarketPrice) continue;
      return {
        ticker: raw,
        price: meta.regularMarketPrice,
        currency: "KRW",
        name: meta.shortName || meta.symbol || raw,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ticker = searchParams.get("ticker")?.trim();
  const type = searchParams.get("type")?.toUpperCase();

  if (!ticker) return err("ticker 파라미터가 필요합니다.");
  if (!type) return err("type 파라미터가 필요합니다. (CRYPTO, STOCK_US, STOCK_KR)");

  let result: PriceResult | null = null;

  switch (type) {
    case "CRYPTO":
      result = await fetchCryptoPrice(ticker);
      break;
    case "STOCK_US":
      result = await fetchUSStockPrice(ticker);
      break;
    case "STOCK_KR":
      result = await fetchKRStockPrice(ticker);
      break;
    default:
      return err("지원하지 않는 타입입니다. (CRYPTO, STOCK_US, STOCK_KR)");
  }

  if (!result) {
    return err(`시세를 찾을 수 없습니다: ${ticker}`, 404);
  }

  return ok(result);
}
