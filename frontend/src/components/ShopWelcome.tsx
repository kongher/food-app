import { useEffect, useState } from "react";
import { onImgError } from "../lib/format";
import { useShop } from "../context/ShopContext";

const WELCOME = "ຍິນດີຕ້ອນຮັບ";
const STEP_MS = 80;
const PAUSE_MS = 2000;

export function ShopWelcome({ className = "" }: { className?: string }) {
  const { shop } = useShop();
  const fullText = `${shop.name} ${WELCOME}`.replace(/\s+/g, " ").trim();
  const chars = Array.from(fullText);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const letters = Array.from(fullText);
    if (letters.length === 0) return;

    let i = 0;
    let stepTimer = 0;
    let pauseTimer = 0;
    let cancelled = false;

    function startTyping() {
      if (cancelled) return;
      i = 0;
      setShown(0);
      stepTimer = window.setInterval(() => {
        i += 1;
        setShown(i);
        if (i < letters.length) return;
        window.clearInterval(stepTimer);
        pauseTimer = window.setTimeout(startTyping, PAUSE_MS);
      }, STEP_MS);
    }

    startTyping();
    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
      window.clearTimeout(pauseTimer);
    };
  }, [fullText]);

  const typing = shown < chars.length;
  const visible = chars.slice(0, shown).join("");

  return (
    <div className={`flex min-w-0 items-start gap-2 ${className}`}>
      {shop.logo ? (
        <img
          src={shop.logo}
          alt=""
          className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white object-cover"
          onError={onImgError}
        />
      ) : null}
      <p
        className="font-display min-w-0 text-2xl leading-snug font-semibold text-orange-700"
        aria-label={fullText}
        aria-live="off"
      >
        {visible}
        {typing && <span className="ml-0.5 inline-block h-[0.9em] w-[2px] animate-pulse bg-orange-700 align-middle" />}
      </p>
    </div>
  );
}
