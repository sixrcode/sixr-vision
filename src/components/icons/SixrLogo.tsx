
import type { SVGProps } from 'react';

export function SixrLogo(props: SVGProps<SVGSVGElement>) {
  const sColor = "rgb(254, 190, 15)";
  const iColor = "rgb(51, 197, 244)";
  const xColor = "rgb(235, 26, 115)";
  const rColor = "rgb(91, 185, 70)";
  
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
        fontFamily="'Torus Variations Biline Bold', var(--font-geist-mono), monospace"
      >
        <tspan fill={sColor}>S</tspan>
        <tspan fill={iColor}>I</tspan>
        <tspan fill={xColor}>X</tspan>
        <tspan fill={rColor}>R</tspan>
      </text>
    </svg>
  );
}

