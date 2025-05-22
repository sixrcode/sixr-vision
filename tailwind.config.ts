import type { Config } from "tailwindcss";
const defaultTheme = require('tailwindcss/defaultTheme')

export default {
    darkMode: ["class"],
    // PurgeCSS Content Paths:
    // These paths are critical for Tailwind CSS to efficiently purge unused styles,
    // minimizing the final CSS bundle size.
    //
    // VERIFY these paths cover ALL directories containing JSX/TSX/MDX files
    // where Tailwind classes might be used. Add new directories if your project structure changes.
    // If your project structure changes (e.g., you add a new top-level directory for components),
    // ensure those paths are added here for Tailwind to scan.
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'var(--font-geist-sans)', ...defaultTheme.fontFamily.sans], // Poppins as primary, Geist Sans as fallback
        mono: ['var(--font-geist-mono)', ...defaultTheme.fontFamily.mono],
        data70: ['var(--font-data70)', 'var(--font-geist-mono)', 'monospace'], // DATA 70 font
      },
  		colors: {
  			background: 'hsl(var(--background-hsl))',
  			foreground: 'hsl(var(--foreground-hsl))',
  			card: {
  				DEFAULT: 'hsl(var(--card-hsl))',
  				foreground: 'hsl(var(--card-foreground-hsl))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover-hsl))',
  				foreground: 'hsl(var(--popover-foreground-hsl))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary-hsl))',
  				foreground: 'hsl(var(--primary-foreground-hsl))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary-hsl))',
  				foreground: 'hsl(var(--secondary-foreground-hsl))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted-hsl))',
  				foreground: 'hsl(var(--muted-foreground-hsl))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent-hsl))',
  				foreground: 'hsl(var(--accent-foreground-hsl))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive-hsl))',
  				foreground: 'hsl(var(--destructive-foreground-hsl))'
  			},
        success: {
          DEFAULT: 'hsl(var(--success-hsl))',
          foreground: 'hsl(var(--success-foreground-hsl))'
        },
        info: {
          DEFAULT: 'hsl(var(--info-hsl))',
          foreground: 'hsl(var(--info-foreground-hsl))'
        },
  			border: 'hsl(var(--border-hsl))',
  			input: 'hsl(var(--input-hsl))',
  			ring: 'hsl(var(--ring-hsl))',
  			chart: {
  				'1': 'hsl(var(--chart-1-hsl))',
  				'2': 'hsl(var(--chart-2-hsl))',
  				'3': 'hsl(var(--chart-3-hsl))',
  				'4': 'hsl(var(--chart-4-hsl))',
  				'5': 'hsl(var(--chart-5-hsl))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))', // Should use --sidebar-background-hsl for consistency
  				foreground: 'hsl(var(--sidebar-foreground))', // Should use --sidebar-foreground-hsl
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
        'control-panel-background': 'hsl(var(--control-panel-background))', // Derived from --control-panel-background-hsl
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
        'logoPulseEffect': {
          '0%, 100%': {
            opacity: 'var(--logo-pulse-start-opacity, 1)',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: 'var(--logo-pulse-mid-opacity, 0.6)',
            transform: 'scale(0.95)',
          },
        },
        'destructive-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0px hsla(var(--destructive-hsl), 0.7)' },
          '50%': { boxShadow: '0 0 0 6px hsla(var(--destructive-hsl), 0)' },
        },
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
        'logo-pulse-effect': 'logoPulseEffect var(--logo-pulse-duration, 2s) ease-in-out infinite',
        'destructive-pulse': 'destructive-pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1)',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
