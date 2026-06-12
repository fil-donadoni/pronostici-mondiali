"use client";

import { Input } from "@/components/ui/input";

/** Sposta il focus al prossimo campo punteggio nel DOM e ne seleziona il testo. */
function focusNextScore(el: HTMLInputElement) {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-score-input]"),
  );
  const i = inputs.indexOf(el);
  const next = inputs[i + 1];
  if (next) {
    next.focus();
    next.select();
  }
}

export function ScoreInput({
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      max={99}
      inputMode="numeric"
      data-score-input=""
      disabled={disabled}
      aria-label={ariaLabel}
      value={value === "" ? "" : String(value)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const el = e.currentTarget;
        const raw = e.target.value;
        if (raw === "") return onChange("");
        const n = Math.max(0, Math.min(99, Number(raw)));
        onChange(Number.isNaN(n) ? "" : n);
        // input avvenuto -> passa subito al campo successivo
        if (!Number.isNaN(n)) focusNextScore(el);
      }}
      className="w-14 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
