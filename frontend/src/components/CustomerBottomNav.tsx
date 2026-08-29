export type CustomerNavTab = "menu" | "orders" | "music" | "promo";

const items: { id: CustomerNavTab; label: string; icon: typeof MenuIcon }[] = [
  { id: "menu", label: "ເມນູ", icon: MenuIcon },
  { id: "orders", label: "ອໍເດີ", icon: OrdersIcon },
  { id: "music", label: "ເພງ", icon: MusicIcon },
  { id: "promo", label: "ໂປຣໂມຊັນ", icon: PromoIcon },
];

export function CustomerBottomNav({
  active,
  onChange,
}: {
  active: CustomerNavTab;
  onChange: (tab: CustomerNavTab) => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-stone-100 bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-[4.25rem] grid-cols-4">
        {items.map((item) => {
          const selected = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 ${
                selected ? "text-orange-600" : "text-stone-400"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 3v6M8 3v6M11 3v6" strokeLinecap="round" />
      <path d="M8 9v15" strokeLinecap="round" />
      <path d="M16 3c3.2 4.2 3.2 10 0 14v7" strokeLinecap="round" />
    </svg>
  );
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="13" r="7" />
      <path d="M12 10v4l2.5 1.5" strokeLinecap="round" />
      <path d="M9 5.5 7 3M15 5.5 17 3" strokeLinecap="round" />
    </svg>
  );
}

function MusicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 18V6l10-2v12" strokeLinecap="round" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </svg>
  );
}

function PromoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12.5 3.5 20.5 11.5a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L3.5 12.5V3.5h9Z" />
      <circle cx="8.2" cy="8.2" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
