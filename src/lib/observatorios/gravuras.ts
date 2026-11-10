/**
 * Gravuras dos seis observatórios (decisão do dono de 10/11/2026: uniformizar as imagens). Uma só família de estilo,
 * um só formato (1440 × 720, WebP) e uma só pasta (public/arte/observatorios). Quatro foram geradas no Canva com a
 * gravura do Setor Elétrico como referência de estilo; Energia e Economia são as gravuras que a plataforma já usava.
 *
 * São ilustrações conceituais: não são fotografia, mapa, fonte de dado nem retrato de um lugar real, e não levam números,
 * bandeiras nem marcas. O texto alternativo descreve a cena; `src/tests/gravuras.test.ts` confere arquivo, tamanho e texto.
 */
import type { ObservatorioId } from "./lista";

export type Gravura = { src: string; largura: number; altura: number; alt: string };

const PASTA = "/arte/observatorios";
const g = (id: ObservatorioId, alt: string): Gravura => ({ src: `${PASTA}/${id}.webp`, largura: 1440, altura: 720, alt });

export const GRAVURAS: Record<ObservatorioId, Gravura> = {
  familias: g("familias", "Gravura conceitual de uma rua residencial imaginária ao anoitecer, com uma família à mesa vista pela janela, uma feira livre na esquina e um ônibus ao fundo."),
  "servicos-publicos": g("servicos-publicos", "Gravura conceitual da praça central de uma cidade imaginária, com uma escola pública, um posto de saúde, um fórum e um coreto entre árvores."),
  "contas-publicas": g("contas-publicas", "Gravura conceitual de uma esplanada de edifícios públicos, com um livro de registros aberto em primeiro plano e um viaduto e um hospital ao fundo."),
  "energia-e-infraestrutura": g("energia-e-infraestrutura", "Gravura conceitual de uma paisagem imaginária com reservatório, hidrelétrica, eólicas, painéis solares, linhas de transmissão, subestação e cidade."),
  economia: g("economia", "Gravura conceitual de uma cidade imaginária com um banco, comércio de rua, um galpão industrial com caminhões e prédios ao fundo."),
  "territorio-e-clima": g("territorio-e-clima", "Gravura conceitual da borda entre floresta e áreas abertas, cortada por um rio, com casas ribeirinhas, uma estação meteorológica e fogo no horizonte."),
};

/** Nota fixa que acompanha toda gravura onde ela aparece como figura. */
export const NOTA_GRAVURA = "Ilustração conceitual gerada por inteligência artificial. Não representa dados nem um lugar real.";
