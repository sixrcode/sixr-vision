
import type { SVGProps } from 'react';

export function SixrLogo(props: SVGProps<SVGSVGElement>) {
  const sixrColor = "rgb(37, 150, 190)";
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
        <tspan fill={sixrColor}>S</tspan>
        <tspan fill={sixrColor}>I</tspan>
        <tspan fill={sixrColor}>X</tspan>
        <tspan fill={sixrColor}>R</tspan>
      </text>
    </svg>
  );
}
