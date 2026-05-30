"use client";

import type { PipelineStep } from "@/lib/types";

interface Step { id: PipelineStep; label: string }

interface Props {
  steps:      Step[];
  currentId:  PipelineStep;
  isDone:     boolean;
  isFailed:   boolean;
}

export default function StepList({ steps, currentId, isDone, isFailed }: Props) {
  const curIdx = steps.findIndex((s) => s.id === currentId);

  return (
    <ol className="space-y-1">
      {steps.map((step, i) => {
        const done    = isDone || (curIdx > i && curIdx >= 0);
        const current = currentId === step.id && !isDone;
        const failed  = isFailed  && currentId === step.id;
        const pending = !done && !current && !failed;

        return (
          <li
            key={step.id}
            className={[
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
              current ? "bg-amber-400/[0.07] border border-amber-400/20" : "",
              pending ? "opacity-25" : "",
            ].join(" ")}
          >
            {/* Dot */}
            <div className={[
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
              done   ? "bg-green-500 text-white" :
              failed ? "bg-red-500 text-white"   :
              current? "bg-amber-500 text-black animate-pulse" :
              "bg-white/[0.06] text-gray-600",
            ].join(" ")}>
              {done ? "✓" : failed ? "✕" : current ? "●" : "○"}
            </div>

            {/* Label */}
            <span className={`text-xs flex-1 ${done ? "line-through opacity-40" : ""}`}>
              {step.label}
            </span>

            {/* Tail badge */}
            {current && !isFailed && (
              <span className="text-[10px] text-amber-400 font-bold animate-pulse shrink-0">
                RUNNING
              </span>
            )}
            {done && !isDone && (
              <span className="text-[10px] text-green-500 shrink-0">DONE</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
