import type { Config } from "tailwindcss";

/**
 * Design tokens da Scrutiniums.
 * Valores extraídos da referência visual (contrato do projeto).
 * Nunca use hexadecimais soltos em componentes: sempre tokens.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        carvao: {
          DEFAULT: "#1A1D21",
          soft: "#2A2E33",
          muted: "#3D4147",
        },
        marfim: "#F3EFE5",
        papel: "#FAF8F2",
        bronze: {
          DEFAULT: "#966B48",
          dark: "#7C5638",
          soft: "#B08A67",
        },
        mineral: {
          DEFAULT: "#878986",
          soft: "#A6A8A4",
        },
        linha: "#D8D2C6",
        "linha-escura": "#33373D",
        erro: "#8C3B2E",
        sucesso: "#4F6B4E",
        aviso: "#8A6D2F",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        label: ["var(--font-label)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        label: "0.14em",
        wide2: "0.22em",
      },
      maxWidth: {
        page: "76rem",
        prose2: "44rem",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
