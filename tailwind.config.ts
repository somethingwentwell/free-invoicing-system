import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f3f4f6',
        ink: '#111827',
        accent: '#2563eb'
      }
    }
  },
  plugins: []
};

export default config;
