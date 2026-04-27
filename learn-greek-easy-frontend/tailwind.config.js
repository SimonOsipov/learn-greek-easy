/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			// New surface tokens
  			'bg': 'hsl(var(--bg))',
  			'bg-2': 'hsl(var(--bg-2))',
  			glass: 'hsl(var(--glass))',
  			fg: 'hsl(var(--fg))',
  			fg2: 'hsl(var(--fg-2))',
  			fg3: 'hsl(var(--fg-3))',
  			line: 'hsl(var(--line))',
  			'line-2': 'hsl(var(--line-2))',
  			'border-strong': 'hsl(var(--border-strong))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			'primary-2': 'hsl(var(--primary-2))',
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			'accent-2': 'hsl(var(--accent-2))',
  			'accent-3': 'hsl(var(--accent-3))',
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			gradient: {
  				from: '#667eea',
  				to: '#764ba2'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			info: 'hsl(var(--info))',
  			danger: 'hsl(var(--danger))',
  			border: 'hsl(var(--border))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},

  			landing: {
  				navy: "hsl(var(--landing-navy))",
  				"greek-blue": "hsl(var(--landing-greek-blue))",
  				"greek-blue-light": "hsl(var(--landing-greek-blue-light))",
  				gold: "hsl(var(--landing-gold))",
  				"header-bg": "hsl(var(--landing-header-bg))",
  				"header-fg": "hsl(var(--landing-header-fg))",
  			},
  			practice: {
  				accent: 'hsl(var(--practice-accent))',
  				'accent-glow': 'hsl(var(--practice-accent-glow))',
  				'accent-soft': 'hsl(var(--practice-accent-soft))',
  				correct: 'hsl(var(--practice-correct))',
  				'correct-glow': 'hsl(var(--practice-correct-glow))',
  				'correct-soft': 'hsl(var(--practice-correct-soft))',
  				incorrect: 'hsl(var(--practice-incorrect))',
  				'incorrect-glow': 'hsl(var(--practice-incorrect-glow))',
  				'incorrect-soft': 'hsl(var(--practice-incorrect-soft))',
  				gold: 'hsl(var(--practice-gold))',
  				purple: 'hsl(var(--practice-purple))',
  				bg: 'hsl(var(--practice-bg))',
  				card: 'hsl(var(--practice-card))',
  				border: 'hsl(var(--practice-border))',
  				text: 'hsl(var(--practice-text))',
  				'text-muted': 'hsl(var(--practice-text-muted))',
  				'text-dim': 'hsl(var(--practice-text-dim))',
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'"Segoe UI"',
  				'Roboto',
  				'"Helvetica Neue"',
  				'Arial',
  				'sans-serif',
  				'"Apple Color Emoji"',
  				'"Segoe UI Emoji"',
  				'"Segoe UI Symbol"'
  			],
  			display: ['"Inter Tight"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
  			serif: ['"Noto Serif"', 'Georgia', '"Times New Roman"', 'Times', 'serif'],
  			mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
  			// Back-compat aliases — keep until per-surface reskins migrate call sites
  			'practice-serif': ['"Noto Serif"', 'Georgia', '"Times New Roman"', 'Times', 'serif'],
  			'practice-mono': ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace']
  		},
  		fontSize: {
  			xs: [
  				'0.75rem',
  				{
  					lineHeight: '1rem'
  				}
  			],
  			sm: [
  				'0.875rem',
  				{
  					lineHeight: '1.25rem'
  				}
  			],
  			base: [
  				'1rem',
  				{
  					lineHeight: '1.6'
  				}
  			],
  			lg: [
  				'1.125rem',
  				{
  					lineHeight: '1.75rem'
  				}
  			],
  			xl: [
  				'1.25rem',
  				{
  					lineHeight: '1.75rem'
  				}
  			],
  			'2xl': [
  				'1.75rem',
  				{
  					lineHeight: '2.25rem'
  				}
  			],
  			'3xl': [
  				'2rem',
  				{
  					lineHeight: '2.5rem'
  				}
  			]
  		},
  		fontWeight: {
  			normal: '400',
  			medium: '500',
  			semibold: '600',
  			bold: '700'
  		},
  		lineHeight: {
  			tight: '1.1',
  			snug: '1.3',
  			normal: '1.6',
  			relaxed: '1.75',
  			loose: '2'
  		},
  		spacing: {
  			'0': '0px',
  			'1': '0.25rem',
  			'2': '0.5rem',
  			'3': '0.75rem',
  			'4': '1rem',
  			'5': '1.25rem',
  			'6': '1.5rem',
  			'7': '1.75rem',
  			'8': '2rem',
  			'9': '2.25rem',
  			'10': '2.5rem',
  			'11': '2.75rem',
  			'12': '3rem',
  			'14': '3.5rem',
  			'16': '4rem',
  			'20': '5rem',
  			'24': '6rem',
  			'28': '7rem',
  			'32': '8rem',
  			'36': '9rem',
  			'40': '10rem',
  			'44': '11rem',
  			'48': '12rem',
  			'52': '13rem',
  			'56': '14rem',
  			'60': '15rem',
  			'64': '16rem',
  			'72': '18rem',
  			'80': '20rem',
  			'96': '24rem'
  		},
  		screens: {
  			sm: '640px',
  			md: '768px',
  			lg: '1024px',
  			xl: '1280px',
  			'2xl': '1440px'
  		},
  		borderRadius: {
  			none: '0px',
  			sm: 'calc(var(--radius) - 4px)',
  			md: 'calc(var(--radius) - 2px)',
  			lg: 'var(--radius)',
  			xl: 'calc(var(--radius) + 4px)',
  			'2xl': 'calc(var(--radius) + 8px)',
  			'3xl': 'calc(var(--radius) + 12px)',
  			full: '9999px'
  		},
  		boxShadow: {
  			// Token-backed named shadows (new)
  			'1': 'var(--shadow-1)',
  			'2': 'var(--shadow-2)',
  			'3': 'var(--shadow-3)',
  			glow: 'var(--shadow-glow)',
  			nav: 'var(--shadow-nav)',
  			'card-hover': 'var(--shadow-card-hover)',
  			'button-primary': 'var(--shadow-button-primary)',
  			'landing-card': 'var(--landing-shadow-card)',
  			'landing-card-hover': 'var(--landing-shadow-card-hover)',
  			none: 'none',
  			// Legacy Tailwind default shadows — kept for existing consumers; RESKIN-01-02 audits
  			sm: '0 1px 3px rgba(0, 0, 0, 0.05)',
  			DEFAULT: '0 4px 6px rgba(0, 0, 0, 0.05)',
  			md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  			lg: '0 4px 8px rgba(102, 126, 234, 0.3)',
  			xl: '0 10px 15px rgba(0, 0, 0, 0.1)',
  			'2xl': '0 20px 25px rgba(0, 0, 0, 0.15)',
  		},
  		transitionDuration: {
  			'200': '200ms',
  			'300': '300ms',
  			'500': '500ms'
  		},
  		transitionTimingFunction: {
  			smooth: 'cubic-bezier(0.4, 0, 0.2, 1)'
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.3s ease-in-out',
  			'slide-up': 'slideUp 0.3s ease-out',
  			'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'collapsible-down': 'collapsible-down 0.2s ease-out',
  			'collapsible-up': 'collapsible-up 0.2s ease-out',
  			// Landing page animations
  			'fade-up': 'fade-up 0.6s ease-out forwards',
  			'landing-fade-in': 'landing-fade-in 0.4s ease-out forwards',
  			'scale-in': 'scale-in 0.3s ease-out forwards',
  			'float': 'float 6s ease-in-out infinite',
  			'shimmer': 'shimmer 2s linear infinite',
			'practice-fade-in': 'practiceFadeIn 0.35s ease-out',
			'practice-slide-up': 'practiceSlideUp 0.35s ease-out',
			'practice-pop-in': 'practicePopIn 0.3s ease-out'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					transform: 'translateY(10px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			pulseSubtle: {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.8'
  				}
  			},
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
  			'collapsible-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-collapsible-content-height)' }
  			},
  			'collapsible-up': {
  				from: { height: 'var(--radix-collapsible-content-height)' },
  				to: { height: '0' }
  			},
  			// Landing page keyframes
  			'fade-up': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(20px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'landing-fade-in': {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			'scale-in': {
  				'0%': {
  					opacity: '0',
  					transform: 'scale(0.95)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'scale(1)'
  				}
  			},
  			'float': {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-10px)'
  				}
  			},
  			'shimmer': {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
			practiceFadeIn: {
				from: {
					opacity: '0',
					transform: 'translateY(6px)'
				},
				to: {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			practiceSlideUp: {
				from: {
					opacity: '0',
					transform: 'translateY(12px)'
				},
				to: {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			practicePopIn: {
				'0%': {
					transform: 'scale(0)'
				},
				'70%': {
					transform: 'scale(1.2)'
				},
				'100%': {
					transform: 'scale(1)'
				}
			}
  		},
  		container: {
  			center: true,
  			padding: '1rem',
  			screens: {
  				sm: '100%',
  				md: '100%',
  				lg: '100%',
  				xl: '1280px',
  				'2xl': '1440px'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
