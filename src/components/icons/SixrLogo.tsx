
import type { SVGProps } from 'react';

// Define specific colors for each letter
const sColorDefault = "rgb(254, 190, 15)";
const iColorDefault = "rgb(51, 197, 244)";
const xColorDefault = "rgb(235, 26, 115)";
const rColorDefault = "rgb(91, 185, 70)";

interface SixrLogoProps extends SVGProps<SVGSVGElement> {
  colorOverride?: string;
}

export function SixrLogo({ colorOverride, ...props }: SixrLogoProps) {
  const sFill = colorOverride || sColorDefault;
  const iFill = colorOverride || iColorDefault;
  const xFill = colorOverride || xColorDefault;
  const rFill = colorOverride || rColorDefault;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 40"
      aria-label="SIXR Logo"
      fontFamily="'Torus Variations', var(--font-geist-mono), monospace"
      {...props}
    >
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="24"
      >
        <tspan fill={sFill}>S</tspan>
        <tspan fill={iFill}>I</tspan>
        <tspan fill={xFill}>X</tspan>
        <tspan fill={rFill}>R</tspan>
      </text>
    </svg>
  );
}
