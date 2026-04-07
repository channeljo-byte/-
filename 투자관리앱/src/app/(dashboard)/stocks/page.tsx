import { Card, SummaryCard } from "@/components";

export default function StocksPage() {
  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">주식 현황</h2>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="총 투자금 (원화 환산)" value="0원" />
        <SummaryCard label="총 평가액 (원화 환산)" value="0원" />
        <SummaryCard label="총 수익률" value="0%" />
      </div>

      <Card title="환율 (USD/KRW)" className="mb-6">
        <p className="text-sm text-zinc-500">환율 조회/설정 (Step 3에서 구현)</p>
      </Card>

      <Card title="종목 추가" className="mb-6">
        <p className="text-sm text-zinc-500">종목 입력 폼 (Step 3에서 구현)</p>
      </Card>

      <Card title="한국 주식" className="mb-6">
        <p className="text-sm text-zinc-500">KR 테이블 (Step 3에서 구현)</p>
      </Card>

      <Card title="미국 주식 / ETF">
        <p className="text-sm text-zinc-500">US 테이블 (Step 3에서 구현)</p>
      </Card>
    </>
  );
}
