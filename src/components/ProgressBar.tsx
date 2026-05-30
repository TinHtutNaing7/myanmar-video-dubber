"use client";

interface Props {
  value:    number;   // 0-100
  status:   "running" | "done" | "error" | "idle";
  label?:   string;
}

export default function ProgressBar({ value, status, label }: Props) {
  const color =
    status === "done"  ? "#22c55e" :
    status === "error" ? "#ef4444" :
    "linear-gradient(90deg,#d97706,#f59e0b)";

  const glow =
    status === "done"  ? "0 0 8px rgba(34,197,94,.55)"  :
    status === "error" ? "0 0 8px rgba(239,68,68,.55)"  :
    status === "running" ? "0 0 10px rgba(251,191,36,.5)" : "none";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
          <span className="truncate max-w-[76%]">{label}</span>
          <span className="font-bold text-white ml-2 shrink-0">{value}%</span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${value}%`, background: color, boxShadow: glow }}
        />
      </div>
    </div>
  );
}
