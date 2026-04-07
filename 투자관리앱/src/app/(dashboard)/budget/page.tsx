import { Card } from "@/components";

export default function BudgetPage() {
  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">가계부</h2>

      <Card title="캘린더" className="mb-6">
        <p className="text-sm text-zinc-500">달력 뷰 (Step 3에서 구현)</p>
      </Card>

      <Card title="카테고리별 지출" className="mb-6">
        <p className="text-sm text-zinc-500">카테고리 막대 차트 (Step 3에서 구현)</p>
      </Card>

      <Card title="고정지출 관리" className="mb-6">
        <p className="text-sm text-zinc-500">고정지출 CRUD (Step 3에서 구현)</p>
      </Card>

      <Card title="연간 수입/지출 추이">
        <p className="text-sm text-zinc-500">12개월 막대 차트 (Step 3에서 구현)</p>
      </Card>
    </>
  );
}
