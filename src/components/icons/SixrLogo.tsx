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
        // Default fill can be removed or kept as a fallback if tspans don't cover everything
        // fill="currentColor" 
      >
        <tspan fill="rgba(254,190,15,1)">S</tspan>
        <tspan fill="rgba(51,197,244,1)">I</tspan>
        <tspan fill="rgba(51,197,244,1)">X</tspan>
        <tspan fill="rgba(91,185,70,1)">R</tspan>
      </text>
    </svg>
  );
}
