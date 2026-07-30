import type { Metadata } from "next";
import {
  SummaryCard,
  type FormatoValor,
  type VariacaoResumo,
} from "@/components/analytics/SummaryCard";
import { PageTitle } from "@/components/ui/SectionHeading";
import { fmtMonthYear, fmtNumber } from "@/lib/format";
import {
  ATIVIDADE_MENSAL,
  HHI_ANUAL,
  INADIMPLENCIA_TRIMESTRAL,
  META_ATIVIDADE,
  META_HHI,
  META_REGULATORIO,
  META_RISCO,
  SENTIMENTO_MENSAL,
  SETORES,
  TEMAS,
} from "@/lib/data/paineis";

export const metadata: Metadata = { title: "Painéis Scrutiniums" };

type PontoResumo = { rotulo: string; valor: number };

function arredondar(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

function media(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Variação vs. período anterior com sinal e texto — nunca só cor. */
function variacao(
  serie: PontoResumo[],
  casas: number,
  unidadeTexto: string,
  referencia: string,
): VariacaoResumo {
  if (serie.length < 2) return { direcao: "estavel", texto: `sem base de comparação ${referencia}` };
  const diff = arredondar(serie[serie.length - 1].valor - serie[serie.length - 2].valor, casas);
  if (diff === 0) return { direcao: "estavel", texto: `sem variação em relação ${referencia}` };
  const sentido = diff > 0 ? "alta" : "queda";
  return {
    direcao: diff > 0 ? "alta" : "queda",
    texto: `${sentido} de ${fmtNumber(Math.abs(diff), casas)} ${unidadeTexto} em relação ${referencia}`,
  };
}

/* Séries agregadas dos painéis-resumo (média simples dos setores/temas). */

const serieAtividade: PontoResumo[] = ATIVIDADE_MENSAL.slice(-24).map((p) => ({
  rotulo: fmtMonthYear(p.competencia),
  valor: arredondar(media(SETORES.map((s) => p[s])), 1),
}));

const serieRisco: PontoResumo[] = INADIMPLENCIA_TRIMESTRAL.slice(-8).map((p) => ({
  rotulo: p.trimestre,
  valor: arredondar(media(SETORES.map((s) => p[s])), 2),
}));

const serieRegulatorio: PontoResumo[] = SENTIMENTO_MENSAL.slice(-24).map((p) => ({
  rotulo: fmtMonthYear(p.competencia),
  valor: arredondar(media(TEMAS.map((t) => p[t])), 2),
}));

const serieHhi: PontoResumo[] = HHI_ANUAL.map((p) => ({
  rotulo: p.ano,
  valor: arredondar(media(SETORES.map((s) => p[s])), 0),
}));

const CARDS: Array<{
  meta: { titulo: string; unidade: string };
  periodo: string;
  serie: PontoResumo[];
  formato: FormatoValor;
  variacao: VariacaoResumo;
  href: string;
  hrefRotulo: string;
  descricaoAgregado: string;
}> = [
  {
    meta: META_ATIVIDADE,
    periodo: "últimos 24 meses (média dos 5 setores)",
    serie: serieAtividade,
    formato: "indice",
    variacao: variacao(serieAtividade, 1, "ponto", "ao mês anterior"),
    href: "/app/atividade",
    hrefRotulo: "Ver painel completo",
    descricaoAgregado: "média simples dos cinco setores acompanhados",
  },
  {
    meta: META_RISCO,
    periodo: "últimos 8 trimestres (média dos 5 setores)",
    serie: serieRisco,
    formato: "percentual",
    variacao: variacao(serieRisco, 2, "ponto percentual", "ao trimestre anterior"),
    href: "/app/risco",
    hrefRotulo: "Ver painel completo",
    descricaoAgregado: "média simples dos cinco setores acompanhados",
  },
  {
    meta: META_REGULATORIO,
    periodo: "últimos 24 meses (média dos 3 temas)",
    serie: serieRegulatorio,
    formato: "score",
    variacao: variacao(serieRegulatorio, 2, "no score", "ao mês anterior"),
    href: "/app/regulatorio",
    hrefRotulo: "Ver painel completo",
    descricaoAgregado: "média simples dos três temas acompanhados",
  },
  {
    meta: META_HHI,
    periodo: "2022 a 2025, anual (média dos 5 setores)",
    serie: serieHhi,
    formato: "inteiro",
    variacao: variacao(serieHhi, 0, "pontos", "ao ano anterior"),
    href: "/glossario#concentracao-de-mercado",
    hrefRotulo: "Ver definição no glossário",
    descricaoAgregado: "média simples dos cinco setores acompanhados",
  },
];

export default function VisaoGeralPage() {
  return (
    <div className="space-y-10">
      <PageTitle
        label="Área interna"
        title="Painéis Scrutiniums"
        description="Leitura mais recente dos quatro indicadores da plataforma, com variação em relação ao período anterior. Cada painel completo declara fontes, metodologia e limitações."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {CARDS.map((card) => (
          <SummaryCard
            key={card.meta.titulo}
            titulo={card.meta.titulo}
            unidade={card.meta.unidade}
            periodo={card.periodo}
            serie={card.serie}
            formato={card.formato}
            variacao={card.variacao}
            href={card.href}
            hrefRotulo={card.hrefRotulo}
            ariaLabelGrafico={`Minigráfico de linha de ${card.meta.titulo} (${card.descricaoAgregado}), de ${
              card.serie[0].rotulo
            } a ${card.serie[card.serie.length - 1].rotulo}. Valor mais recente e variação descritos em texto ao lado.`}
          />
        ))}
      </div>
    </div>
  );
}
