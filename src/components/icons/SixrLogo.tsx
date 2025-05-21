
import type { SVGProps } from 'react';
import { SIXR_S_COLOR, SIXR_I_COLOR, SIXR_X_COLOR, SIXR_R_COLOR, TORUS_FONT_FAMILY } from '@/lib/brandingConstants';

interface SixrLogoProps extends SVGProps<SVGSVGElement> {
  colorOverride?: string;
}

export function SixrLogo({ colorOverride, ...props }: SixrLogoProps) {
  const sFill = colorOverride || SIXR_S_COLOR;
  const iFill = colorOverride || SIXR_I_COLOR;
  const xFill = colorOverride || SIXR_X_COLOR;
  const rFill = colorOverride || SIXR_R_COLOR;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 40"
      aria-label="SIXR Logo"
      fontFamily={TORUS_FONT_FAMILY}
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
