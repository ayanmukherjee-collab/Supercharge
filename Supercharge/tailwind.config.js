/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                backgroundPrimary: '#181818',
                backgroundSurface: '#2d2d2d',
                accentPrimary: '#FFFFFF',
                accentSecondary: '#888888',
                textPrimary: '#FFFFFF',
                textMuted: '#A3A3A3',
                success: '#10B981',
                error: '#EF4444',
            },
            fontFamily: {
                sans: ['Poppins', 'sans-serif'],
                inter: ['Inter', 'sans-serif'],
            },
            animation: {
                'glow': 'glow 3s linear infinite',
            },
            keyframes: {
                glow: {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                }
            }
        },
    },
    plugins: [],
}
