"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", icon: "📊", label: "자산 현황" },
  { href: "/budget", icon: "💳", label: "가계부" },
  { href: "/stocks", icon: "📈", label: "주식 현황" },
  { href: "/crypto", icon: "⛓", label: "코인 현황" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* 모바일 토글 */}
      <label
        htmlFor="sidebar-toggle"
        className="fixed top-3 left-3 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xl text-slate-200 lg:hidden"
      >
        ☰
      </label>
      <input type="checkbox" id="sidebar-toggle" className="peer hidden" />

      {/* 오버레이 */}
      <label
        htmlFor="sidebar-toggle"
        className="fixed inset-0 z-40 hidden bg-black/60 peer-checked:block lg:!hidden"
      />

      {/* 사이드바 */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 -translate-x-full flex-col border-r border-slate-700 bg-slate-900 transition-transform peer-checked:translate-x-0 lg:translate-x-0">
        <div className="border-b border-slate-700 px-5 py-6">
          <h1 className="text-lg font-bold text-indigo-400">💰 투자관리</h1>
        </div>

        <nav className="flex-1 py-3">
          {NAV.map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 border-l-[3px] px-6 py-3.5 text-[0.95rem] transition-colors ${
                  active
                    ? "border-indigo-500 bg-indigo-500/15 font-semibold text-indigo-400"
                    : "border-transparent text-slate-400 hover:bg-indigo-500/10 hover:text-slate-200"
                }`}
              >
                <span>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-700 p-4">
          <button className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700">
            데이터 초기화
          </button>
        </div>
      </aside>
    </>
  );
}
