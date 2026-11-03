// Tailwind for Le Totem (games/pharaon.js) and Le Totem Extrême (games/totemx.js). Classes are prefixed tw- and there is no preflight (no reset of the
// whole page), so nothing changes elsewhere on the site. Build: cd tools/tailwind && npm i && node build.mjs
module.exports = {
  content: ['../../games/pharaon.js', '../../games/totemx.js'],
  prefix: 'tw-',
  important: true,
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'Georgia', 'serif'],
        num: ['KeCoin', 'Archivo', 'Impact', 'sans-serif'],
      },
      colors: {
        sand: { 50: '#fff8e6', 200: '#fde68a', 400: '#fbbf24', 600: '#b7791f', 900: '#2a1805', 950: '#140b02' },
        lapis: { 400: '#60a5fa', 700: '#1e3a8a', 900: '#0b1640' },
        faience: { 300: '#5eead4', 500: '#14b8a6' },
      },
      keyframes: {
        'tm-flicker': { '0%,100%': { transform: 'scale(1) translateY(0)', opacity: '.95' }, '30%': { transform: 'scale(1.08,.94) translateY(1px)', opacity: '.8' }, '60%': { transform: 'scale(.94,1.1) translateY(-2px)', opacity: '1' } },
        'tm-float': { '0%': { transform: 'translateY(0)', opacity: '0' }, '15%': { opacity: '.9' }, '100%': { transform: 'translateY(-160px)', opacity: '0' } },
        'tm-spin': { to: { transform: 'rotate(360deg)' } },
        'tm-pop': { '0%': { transform: 'translate(-50%,-50%) scale(.3)', opacity: '0' }, '18%': { transform: 'translate(-50%,-50%) scale(1.15)', opacity: '1' }, '30%': { transform: 'translate(-50%,-50%) scale(1)' }, '80%': { opacity: '1' }, '100%': { transform: 'translate(-50%,-62%) scale(1)', opacity: '0' } },
        'tx-rise': { '0%': { transform: 'translateY(0) scale(1)', opacity: '0' }, '10%': { opacity: '1' }, '100%': { transform: 'translateY(-220px) scale(.3)', opacity: '0' } },
        'tx-flicker': { '0%,100%': { transform: 'scale(1) translateY(0)', opacity: '.95' }, '25%': { transform: 'scale(1.12,.9) translateY(1px)', opacity: '.8' }, '55%': { transform: 'scale(.9,1.16) translateY(-3px)', opacity: '1' }, '80%': { transform: 'scale(1.05,.97)', opacity: '.9' } },
        'tm-glow': { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
      },
      animation: {
        'tm-flicker': 'tm-flicker .9s ease-in-out infinite',
        'tm-float': 'tm-float 7s linear infinite',
        'tm-rays': 'tm-spin 60s linear infinite',
        'tm-glow': 'tm-glow 2.4s ease-in-out infinite',
        'tx-rise': 'tx-rise 5s linear infinite',
        'tx-flicker': 'tx-flicker .7s ease-in-out infinite',
        'tx-rays': 'tm-spin 30s linear infinite',
      },
    },
  },
};
