import { useEffect, useRef, useState } from "react";
import { parseDisplayDate, toDisplayDate } from "../lib/format";

export function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (isoDate: string) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => toDisplayDate(value));

  useEffect(() => {
    setText(toDisplayDate(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = parseDisplayDate(raw);
    if (parsed) {
      onChange(parsed);
      setText(toDisplayDate(parsed));
      return;
    }
    setText(toDisplayDate(value));
  }

  return (
    <div className="relative mt-1">
      <input
        type="text"
        inputMode="numeric"
        placeholder="ວວ/ດດ/ປປປປ"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit((event.target as HTMLInputElement).value);
          }
        }}
        className="block w-40 rounded-xl border border-stone-200 px-3 py-2 pr-10"
      />
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        value={value}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <button
        type="button"
        aria-label="ເລືອກວັນທີ"
        onClick={() => {
          const picker = pickerRef.current;
          if (!picker) return;
          if (typeof picker.showPicker === "function") {
            picker.showPicker();
            return;
          }
          picker.click();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
        </svg>
      </button>
    </div>
  );
}
