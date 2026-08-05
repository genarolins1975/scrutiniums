import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Fontes auto-hospedadas (variáveis, subsets latin + latin-ext via
 * Fontsource, licença OFL): sem dependência de CDN externo.
 */
const serif = localFont({
  src: [
    { path: "../fonts/playfair-display.woff2", style: "normal" },
    { path: "../fonts/playfair-display-ext.woff2", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const sans = localFont({
  src: [
    { path: "../fonts/inter.woff2", style: "normal" },
    { path: "../fonts/inter-ext.woff2", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const label = localFont({
  src: [
    { path: "../fonts/archivo-narrow.woff2", style: "normal" },
    { path: "../fonts/archivo-narrow-ext.woff2", style: "normal" },
  ],
  variable: "--font-label",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://scrutiniums.com"),
  title: {
    default: "Scrutiniums — Toda a informação relevante para decisões melhores",
    template: "%s · Scrutiniums",
  },
  description:
    "Plataforma gratuita que reúne bases públicas, registros oficiais, dados econômicos e modelos analíticos para transformar informação dispersa em conhecimento útil.",
  openGraph: {
    siteName: "Scrutiniums",
    locale: "pt_BR",
    type: "website",
    title: "Scrutiniums — Observatório Brasileiro de Crédito",
    description:
      "Crédito, inadimplência, taxas de juros por instituição, riscos emergentes e mercado — dados oficiais com metodologia aberta. Gratuito, com leitura aberta e sem cadastro.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable} ${label.variable}`}>
      <body className="min-h-screen bg-marfim text-carvao">{children}</body>
    </html>
  );
}
