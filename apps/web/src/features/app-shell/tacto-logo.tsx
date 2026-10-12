// Tacto brand tile from docs/development/style-guide.md.
export function TactoLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" role="img" aria-label="Tacto">
      <rect x="0" y="0" width="256" height="256" rx="58" fill="#3B82F6" />
      <g transform="translate(8.42,6.55) scale(0.9342)">
        <path
          fill="#fff"
          d="M 70 54 h 116 a 26 26 0 0 1 26 26 a 26 26 0 0 1 -26 26 h -116 a 26 26 0 0 1 -26 -26 a 26 26 0 0 1 26 -26 Z"
        />
        <path
          fill="#fff"
          d="M 128 54 a 26 26 0 0 1 26 26 v 100 a 26 26 0 0 1 -26 26 a 26 26 0 0 1 -26 -26 v -100 a 26 26 0 0 1 26 -26 Z"
        />
        <circle cx="128" cy="150" r="13" fill="#22D3EE" />
      </g>
    </svg>
  );
}
