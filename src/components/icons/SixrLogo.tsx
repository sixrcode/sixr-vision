import type { SVGProps } from 'react';

export function SixrLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 40"
      aria-label="SIXR Logo"
      {...props}
    >
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="24"
        fontFamily="var(--font-geist-mono), monospace"
        fill="currentColor"
      >
        SIXR
      </text>
    </svg>
  );
}
