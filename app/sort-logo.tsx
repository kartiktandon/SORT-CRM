type SortLogoProps = {
  className?: string;
  width?: number | string;
  height?: number | string;
};

export default function SortLogo({ className, width, height }: SortLogoProps) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 96 36"
      fill="none"
      aria-label="Sort."
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* White capsule background */}
      <rect width="96" height="36" rx="18" fill="#FFFFFF" />

      {/* Brand text "Sort" */}
      <text
        x="42"
        y="18.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#08091A"
        fontFamily="var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', 'Segoe UI', Roboto, sans-serif"
        fontSize="18"
        fontWeight="800"
        letterSpacing="-0.4px"
      >
        Sort
      </text>

      {/* Purple dot */}
      <circle cx="69.5" cy="22" r="2.8" fill="url(#sort-logo-dot-grad)" />

      <defs>
        <radialGradient
          id="sort-logo-dot-grad"
          cx="35%"
          cy="35%"
          r="65%"
          fx="30%"
          fy="30%"
        >
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </radialGradient>
      </defs>
    </svg>
  );
}
