import { num } from "./formato";
import { medidaSegmento, nomeCurto, rotaFicha, SEGMENTOS, type Segmento } from "./listadas";
import type { EmpresasGold } from "./tipos-empresas";
import type { ListadasGold, ManifestoLogos } from "./tipos-listadas";

/**
 * Lógica da abertura de Empresas (/setor-eletrico/empresas): a vitrine das companhias listadas, o mapa da cadeia do setor e os
 * números da faixa. Tudo derivado das golds de Empresas e de Listadas; nenhuma frase avalia empresa.
 */

const temValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/* ================================================================ vitrine das listadas */

export type CartaoListada = {
  papel: string;
  slug: string;
  href: string;
  nome: string;
  peso: number;
  segmento: string | null;
  atuacao: Segmento[];
  /** Uma medida por segmento em que atua, na unidade do segmento; os segmentos não se somam. */
  medidas: { segmento: Segmento; texto: string }[];
};

function textoMedida(s: Segmento, v: number): string {
  if (s === "geracao") return `${num(v, 0)} MW`;
  if (s === "transmissao") return `${num(v, 0)} km`;
  return `${num(v / 1e6, 2)} milhões de UCs`;
}

/** As companhias da carteira do IEE na ordem do peso no índice, com o que cada uma controla em cada segmento. */
export function vitrineListadas(l: ListadasGold, logos?: ManifestoLogos | null): CartaoListada[] {
  return l.companhias
    .slice()
    .sort((a, b) => b.iee.peso_pct - a.iee.peso_pct || a.papel.localeCompare(b.papel))
    .map((c) => {
      const atuacao = SEGMENTOS.map((s) => s.id).filter((s) => c.atuacao[s]);
      const medidas = atuacao
        .map((s) => ({ segmento: s, v: medidaSegmento(c, s) }))
        .filter((x): x is { segmento: Segmento; v: number } => temValor(x.v) && x.v > 0)
        .map((x) => ({ segmento: x.segmento, texto: textoMedida(x.segmento, x.v) }));
      return {
        papel: c.papel,
        slug: c.slug,
        href: rotaFicha(c),
        nome: nomeCurto(c, logos),
        peso: c.iee.peso_pct,
        segmento: c.iee.segmento_nome ?? c.iee.segmento ?? null,
        atuacao,
        medidas,
      };
    });
}

export const ROTULO_SEGMENTO: Record<Segmento, string> = { geracao: "Geração", transmissao: "Transmissão", distribuicao: "Distribuição" };

/* ================================================================ cadeia do setor */

/** Unidades consumidoras somadas das distribuidoras que publicam continuidade, no ano de referência mais recente da base. */
export function ucsDistribuidoras(g: EmpresasGold): { ucs: number | null; distribuidoras: number; ano: number | null } {
  const com = g.distribuidoras.indice.filter((d) => temValor(d.qualidade?.ucs));
  const ano = com.reduce<number | null>((m, d) => (temValor(d.qualidade?.ano) && (m === null || (d.qualidade!.ano as number) > m) ? (d.qualidade!.ano as number) : m), null);
  const doAno = com.filter((d) => d.qualidade?.ano === ano);
  return { ucs: doAno.length ? doAno.reduce((s, d) => s + (d.qualidade!.ucs as number), 0) : null, distribuidoras: doAno.length, ano };
}

export type EloCadeia = {
  id: Segmento | "comercializacao";
  titulo: string;
  faz: string;
  remuneracao: string;
  /** Agentes ativos com o ramo declarado no Cadastro Institucional da ANEEL; um agente pode declarar mais de um ramo. */
  agentes: number | null;
  medida: string;
  href: string;
  link: string;
};

/**
 * Os elos da cadeia, na ordem do fluxo físico (geração, transmissão, distribuição) e a comercialização à parte, que negocia contratos
 * e não opera ativo físico. O que cada um faz e como é remunerado é descrição do arranjo regulatório, não avaliação.
 */
export function cadeiaDoSetor(g: EmpresasGold): EloCadeia[] {
  const r = g.cadastro.agentes.ramos;
  const op = g.cadastro.ativos.operacao;
  const t = g.cadastro.transmissao;
  const u = ucsDistribuidoras(g);
  return [
    {
      id: "geracao",
      titulo: "Geração",
      faz: "Produz a energia em usinas hidrelétricas, eólicas, solares, térmicas e nucleares.",
      remuneracao: "Vende a energia em leilões do mercado regulado ou em contratos no mercado livre.",
      agentes: r.geracao ?? null,
      medida: temValor(op.mw_fiscalizado) ? `${num(op.mw_fiscalizado, 0)} MW em ${num(op.usinas, 0)} usinas em operação` : "potência sem dado",
      href: "/setor-eletrico/empresas/ativos",
      link: "Quem são os donos das usinas",
    },
    {
      id: "transmissao",
      titulo: "Transmissão",
      faz: "Leva a energia em alta tensão das usinas até as distribuidoras e os grandes consumidores.",
      remuneracao: "Recebe uma receita anual fixa, definida no leilão da concessão, que não depende da energia transportada.",
      agentes: r.transmissao ?? null,
      medida: t ? `${num(t.resumo.km_circuito_operacao, 0)} km de circuito em ${num(t.resumo.cnpjs_com_modulos, 0)} concessionárias` : "extensão sem dado",
      href: "/setor-eletrico/leiloes/transmissao",
      link: "Os leilões de transmissão",
    },
    {
      id: "distribuicao",
      titulo: "Distribuição",
      faz: "Entrega a energia a residências, comércio e indústria, cada uma com exclusividade na sua área.",
      remuneracao: "Cobra a tarifa definida pela ANEEL e compra em leilões a energia dos seus consumidores cativos.",
      agentes: r.distribuicao ?? null,
      medida: temValor(u.ucs) ? `${num(u.ucs / 1e6, 1)} milhões de unidades consumidoras (${u.ano})` : "unidades consumidoras sem dado",
      href: "/setor-eletrico/empresas/distribuidoras",
      link: "A ficha de cada distribuidora",
    },
    {
      id: "comercializacao",
      titulo: "Comercialização",
      faz: "Compra e vende contratos de energia, sobretudo no mercado livre; não opera usina, linha nem rede.",
      remuneracao: "Ganha na diferença entre os preços de compra e de venda dos contratos.",
      agentes: r.comercializacao ?? null,
      medida: "contratos registrados na CCEE",
      href: "/setor-eletrico/mercado/agentes",
      link: "Agentes do mercado",
    },
  ];
}
