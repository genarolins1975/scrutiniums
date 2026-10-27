import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "../fonts/extended.css";
import "../../public/observatorios.css";
import "../../public/observatorios-gravuras.css";
import { ACESSO, listaObservatorios, observatoriosPorExtenso } from "@/lib/acesso";
import { DocumentoIdioma } from "@/components/i18n/DocumentoIdioma";
import { MedeUso } from "@/components/telemetria/MedeUso";
import { ContinuidadeNavegacao } from "@/components/observatorios/ContinuidadeNavegacao";

/**
 * Fontes auto-hospedadas (variáveis, subsets latin + latin-ext via
 * Fontsource, licença OFL): latin no caminho crítico; latin-ext sob demanda
 * via extended.css. Os arquivos originais e seus glifos são preservados.
 */
const serif = localFont({
  src: "../fonts/playfair-display.woff2",
  weight: "400 900",
  style: "normal",
  // O fallback estendido carrega só quando houver um glifo fora do subset latino.
  adjustFontFallback: false,
  fallback: ["Scrutiniums Playfair Extended", "Georgia"],
  variable: "--font-serif",
  display: "swap",
});

const sans = localFont({
  src: "../fonts/inter.woff2",
  weight: "100 900",
  style: "normal",
  // O fallback estendido carrega só quando houver um glifo fora do subset latino.
  adjustFontFallback: false,
  fallback: ["Scrutiniums Inter Extended", "Arial"],
  variable: "--font-sans",
  display: "swap",
});

const label = localFont({
  src: "../fonts/archivo-narrow.woff2",
  weight: "400 700",
  style: "normal",
  // O fallback estendido carrega só quando houver um glifo fora do subset latino.
  adjustFontFallback: false,
  fallback: ["Scrutiniums Archivo Extended", "Arial"],
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
    `Plataforma gratuita de inteligência analítica baseada em dados verificáveis: ${observatoriosPorExtenso()} (${listaObservatorios()}), com bases públicas, registros oficiais e método declarado. ${ACESSO.curto}`,
  openGraph: {
    siteName: "Scrutiniums",
    locale: "pt_BR",
    type: "website",
    title: `Scrutiniums: ${listaObservatorios()}`,
    description:
      `${observatoriosPorExtenso(true)}, a mesma filosofia de evidência: dados oficiais, fonte e data em cada número, metodologia aberta. Gratuito. ${ACESSO.curto}`,
  },
  alternates: { canonical: "/" },
  // cartão grande nas redes; a imagem vem do opengraph-image de cada rota
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DocumentoIdioma className={`${serif.variable} ${sans.variable} ${label.variable}`} bodyClassName="min-h-screen bg-papel text-carvao">
      {children}
      {/* Medição de uso agregada, sem dado pessoal (docs/observatorios/MEDICAO_DE_USO.md). */}
      <MedeUso />
      <ContinuidadeNavegacao />
    </DocumentoIdioma>
  );
}
