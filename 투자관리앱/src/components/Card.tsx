import { ReactNode } from "react";

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, action, children, className = "" }: CardProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.25)] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
