import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        markee: { 
          primary: '#E3000F', hover: '#C40009', light: '#FF3344', 
          bg: '#F5F5F5', text: '#1A1A1A', muted: '#666666', sub: '#A0A0A0', 
          border: '#E5E5E5', 'border-medium': '#333333', 'border-dark': '#2A2A2A' 
        }
      },
    },
  },
  plugins: [],
};

export default config;
