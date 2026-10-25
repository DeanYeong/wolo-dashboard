"use client";

import { useState } from "react";
import { rm, rmCompact } from "@/lib/format";

export type Bar = { label: string; value: number | null; note?: string };

// Plain SVG bars. A period with no entry shows a dashed outline, not a zero bar.
export default function BarChart({ bars, title }: { bars: Bar[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, L = 52, R = 8, T = 12, B = 28;
  const max = Math.max(1, ...bars.map((b) => b.value ?? 0)) * 1.1;
  const step = (W - L - R) / bars.length;
  const bw = step * 0.62;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <div className="chartbox" style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3ddd0" />
            <text x={L - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#6b6b66">{rmCompact(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = L + i * step + (step - bw) / 2;
          const has = b.value !== null;
          return (
            <g key={b.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent" />
              {has ? (
                <rect x={x} y={y(b.value!)} width={bw} height={Math.max(0, y(0) - y(b.value!))} fill={hover === i ? "#002fa8" : "#0047ff"} />
              ) : (
                <rect x={x} y={y(0) - 14} width={bw} height={14} fill="none" stroke="#b9b2a2" strokeDasharray="3 3" />
              )}
              {(bars.length <= 8 || i % 2 === bars.length % 2) && (
                <text x={x + bw / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="#6b6b66">{b.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          style={{
            position: "absolute", top: 0, left: `${((L + hover * step + step / 2) / W) * 100}%`, transform: "translateX(-50%)",
            background: "#fff", border: "1px solid #e3ddd0", padding: "4px 8px", fontSize: 12, pointerEvents: "none", whiteSpace: "nowrap",
          }}
        >
          {bars[hover].label}: {bars[hover].value === null ? "not submitted" : rm(bars[hover].value)}
          {bars[hover].note ? ` · ${bars[hover].note}` : ""}
        </div>
      )}
    </div>
  );
}
