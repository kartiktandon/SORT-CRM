type SortLogoProps = {
  className?: string;
};

export default function SortLogo({ className }: SortLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 68 62"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 24L15 16L63 51V61L53 61L5 26V24Z" fill="currentColor" />
      <path d="M5 34L24 48V61L5 47V34Z" fill="currentColor" />
      <path d="M44 0L63 14V38L44 24V0Z" fill="currentColor" />
    </svg>
  );
}