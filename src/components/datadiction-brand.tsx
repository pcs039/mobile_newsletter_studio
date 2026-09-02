type BrandTheme = "dark" | "light";

export function DatadictionBrand({
  compact = false,
  theme = "dark",
}: {
  compact?: boolean;
  theme?: BrandTheme;
}) {
  const textColor = theme === "light" ? "text-white" : "text-[#2f3338]";
  const subColor = theme === "light" ? "text-sky-200" : "text-slate-500";

  return (
    <div className="flex items-center gap-3">
      <svg
        aria-label="DataDiction logo"
        className={compact ? "h-8 w-10 shrink-0" : "h-10 w-12 shrink-0"}
        viewBox="0 0 96 80"
        role="img"
      >
        <path d="M33 8h31l24 20v24L64 72H33V56h27l12-10V34L60 24H33V8Z" fill="#2d70bd" />
        <path d="M13 43h14v14H13V43Z" fill="#2d70bd" />
        <path d="M30 43h14v14H30V43Z" fill="#2d70bd" />
        <path d="M30 60h14v14H30V60Z" fill="#2d70bd" />
        <path d="M5 60h10v10H5V60Z" fill="#2d70bd" />
      </svg>

      <div className="leading-none">
        <p className={`${compact ? "text-base" : "text-xl"} font-black tracking-tight ${textColor}`}>
          DataDiction
        </p>
        <p className={`mt-1 text-xs font-semibold ${subColor}`}>Newsletter Studio</p>
      </div>
    </div>
  );
}
