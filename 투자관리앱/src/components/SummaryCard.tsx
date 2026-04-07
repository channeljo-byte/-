interface SummaryCardProps {
  label: string;
  value: string;
  accentColor?: "red" | "blue" | "orange" | "default";
}

const BORDER_MAP = {
  red: "border-l-red-500",
  blue: "border-l-blue-500",
  orange: "border-l-orange-500",
  default: "border-l-transparent",
};

export default function SummaryCard({
  label,
  value,
  accentColor = "default",
}: SummaryCardProps) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5 ${
        accentColor !== "default" ? `border-l-[3px] ${BORDER_MAP[accentColor]}` : ""
      }`}
    >
      <span className="text-sm font-medium text-zinc-400">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-slate-100">
        {value}
      </span>
    </div>
  );
}
