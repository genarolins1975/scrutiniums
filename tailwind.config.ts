import type { Config } from "tailwindcss";

/**
 * Design tokens da Scrutiniums. As cores moram só em src/app/globals.css (--cor-*): aqui cada cor lê a variável, sem
 * hexadecimal (Iniciativa 5 do parecer de UX de 21/10/2026; src/tests/design-tokens.test.ts).
 */
const v = (nome: string) => `var(--cor-${nome})`;
// Cores usadas com modificador de opacidade (bg-carvao/40): com var() puro o Tailwind 3 descarta a classe em silêncio, então
// leem a tripla RGB do mesmo token (--cor-<nome>-rgb, conferida contra o hexadecimal pelo teste).
const comAlfa = (nome: string) => `rgb(var(--cor-${nome}-rgb) / <alpha-value>)`;
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        carvao: {
          DEFAULT: comAlfa("carvao"),
          soft: v("carvao-soft"),
          muted: v("carvao-muted"),
        },
        marfim: comAlfa("marfim"),
        papel: v("papel"),
        bronze: {
          DEFAULT: comAlfa("bronze"),
          dark: v("bronze-dark"),
          soft: v("bronze-soft"),
        },
        // mineral escurecido para >= 4,5:1 sobre marfim e papel (texto pequeno); soft só para fundos escuros.
        mineral: {
          DEFAULT: v("mineral"),
          soft: v("mineral-soft"),
        },
        linha: comAlfa("linha"),
        "linha-escura": v("linha-escura"),
        // Acento do Setor Elétrico (teal sóbrio): DEFAULT e dark passam AA sobre marfim, papel e branco; soft só marcação.
        energia: {
          DEFAULT: comAlfa("energia"),
          dark: v("energia-dark"),
          soft: v("energia-soft"),
          fundo: v("energia-fundo"),
        },
        // Acento da Eficiência Estatal (petróleo): DEFAULT e dark AA sobre papel e branco; neutro só marcação (>= 3:1).
        obee: {
          DEFAULT: comAlfa("obee"),
          dark: v("obee-dark"),
          fundo: comAlfa("obee-fundo"),
          tinta: comAlfa("obee-tinta"),
          neutro: comAlfa("obee-neutro"),
        },
        // Acento do Gás Natural (azul ardósia): seleção e identidade do domínio, nunca juízo de valor.
        gas: {
          DEFAULT: v("gas"),
          dark: v("gas-dark"),
          soft: v("gas-soft"),
          fundo: v("gas-fundo"),
        },
        // Acento da Conectividade (petróleo próprio).
        conect: {
          DEFAULT: v("conect"),
          dark: v("conect-dark"),
          soft: v("conect-soft"),
          fundo: v("conect-fundo"),
        },
        destaque: v("destaque"),
        "painel-escuro": {
          DEFAULT: v("painel-escuro"),
          texto: v("painel-escuro-texto"),
        },
        superficie: comAlfa("superficie"),
        // Selos de natureza do dado (texto AA sobre papel e branco).
        natureza: {
          observado: v("natureza-observado"),
          calculado: v("natureza-calculado"),
          estimado: v("natureza-estimado"),
          previsto: v("natureza-previsto"),
          cenario: v("natureza-cenario"),
        },
        erro: v("erro"),
        sucesso: v("sucesso"),
        aviso: v("aviso"),
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
