import { Card, SummaryCard } from "@/components";

export default function CryptoPage() {
  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">코인 현황</h2>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="총 투자금" value="0원" />
        <SummaryCard label="총 평가액" value="0원" />
        <SummaryCard label="총 수익률" value="0%" />
      </div>

      <Card title="코인 추가" className="mb-6">
        <p className="text-sm text-zinc-500">코인 입력 폼 (Step 3에서 구현)</p>
      </Card>

      <Card title="보유 코인">
        <p className="text-sm text-zinc-500">코인 테이블 (Step 3에서 구현)</p>
      </Card>
    </>
  );
}
