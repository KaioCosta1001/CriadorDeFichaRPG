"use client";

import { describeRoll, isCritRoll, isFumbleRoll } from "@/domain/rolls";
import type { RollRecord } from "@/schemas";

interface RollBreakdownProps {
  roll: RollRecord;
  prominent?: boolean;
  className?: string;
}

function BreakdownLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-text-muted flex justify-between gap-2 text-[11px] tabular-nums">
      <span className="truncate">{label}</span>
      <span className="font-display shrink-0">{value}</span>
    </div>
  );
}

function BreakdownDivider() {
  return (
    <div
      className="border-frame/60 my-1"
      style={{ borderTopWidth: 1, borderTopStyle: "solid" }}
      aria-hidden="true"
    />
  );
}

function TotalLine({
  roll,
  prominent = false,
}: {
  roll: RollRecord;
  prominent?: boolean;
}) {
  let className = "flex justify-between gap-2 tabular-nums";
  if (prominent) {
    className =
      "flex justify-between gap-2 tabular-nums text-accent font-display text-lg font-bold";
  } else {
    className =
      "flex justify-between gap-2 tabular-nums text-text text-base font-bold";
  }
  return (
    <div className={className}>
      <span>TOTAL</span>
      <span className="shrink-0">{roll.total}</span>
    </div>
  );
}

function DieLines({
  roll,
  labelPrefix = "Dado",
}: {
  roll: RollRecord;
  labelPrefix?: string;
}) {
  if (roll.dice.length === 0) return null;

  return roll.dice.map((value: number, index: number) => (
    <BreakdownLine
      key={index}
      label={`${labelPrefix} ${index + 1}`}
      value={String(value)}
    />
  ));
}

function ComponentLines({ roll }: { roll: RollRecord }) {
  const components = roll.components.filter(
    (c: { value: number }) => c.value !== 0,
  );
  return components.map((component: { label: string; value: number }) => (
    <BreakdownLine
      key={component.label}
      label={component.label}
      value={
        component.value > 0 ? `+${component.value}` : String(component.value)
      }
    />
  ));
}

export function RollBreakdown({
  roll,
  prominent = false,
  className = "",
}: RollBreakdownProps) {
  const isCrit = isCritRoll(roll);
  const isFumble = isFumbleRoll(roll);

  const titleClassName = [
    "font-display text-[11px] font-semibold tracking-[0.08em] uppercase",
    isCrit ? "text-accent" : isFumble ? "text-danger" : "text-text-muted",
  ].join(" ");

  return (
    <div
      className={["flex flex-col gap-1.5 p-2", className].join(" ")}
      role="region"
      aria-label={describeRoll(roll)}
    >
      <div className={titleClassName}>{roll.label}</div>

      <BreakdownDivider />

      {DieLines({ roll })}

      {isCrit && (
        <div className="text-accent text-[10px] tracking-[0.2em] uppercase">
          Natural 20
        </div>
      )}
      {isFumble && (
        <div className="text-danger text-[10px] tracking-[0.2em] uppercase">
          Natural 1
        </div>
      )}

      {ComponentLines({ roll })}

      <BreakdownDivider />

      <TotalLine roll={roll} prominent={prominent} />
    </div>
  );
}

export type { RollBreakdownProps };
