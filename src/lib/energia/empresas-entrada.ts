import type { Idioma } from "@/lib/idioma";
import { num } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import { medidaSegmento, nomeCurto, rotaFicha, SEGMENTOS, type Segmento } from "./listadas";
import type { EmpresasGold } from "./tipos-empresas";
import type { ListadasGold, ManifestoLogos } from "./tipos-listadas";

/**
 * Lógica da abertura de Empresas (/setor-eletrico/empresas): a vitrine das companhias listadas, o mapa da cadeia do setor e os
 * números da faixa. Tudo derivado das golds de Empresas e de Listadas; nenhuma frase avalia empresa.
 *
 * Idioma: frases com as duas formas lado a lado (tx), com o idioma por último (padrão: o da página).
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

function textoMedida(s: Segmento, v: number, idioma: Idioma): string {
  if (s === "geracao") return `${num(v, 0, idioma)} MW`;
  if (s === "transmissao") return `${num(v, 0, idioma)} km`;
  return tx(`${num(v / 1e6, 2, idioma)} milhões de UCs`, `${num(v / 1e6, 2, idioma)} million consumer units`, idioma);
}

/** As companhias da carteira do IEE na ordem do peso no índice, com o que cada uma controla em cada segmento. */
export function vitrineListadas(l: ListadasGold, logos?: ManifestoLogos | null, idioma: Idioma = idiomaEnergia()): CartaoListada[] {
  return l.companhias
    .slice()
    .sort((a, b) => b.iee.peso_pct - a.iee.peso_pct || a.papel.localeCompare(b.papel))
    .map((c) => {
      const atuacao = SEGMENTOS.map((s) => s.id).filter((s) => c.atuacao[s]);
      const medidas = atuacao
        .map((s) => ({ segmento: s, v: medidaSegmento(c, s) }))
        .filter((x): x is { segmento: Segmento; v: number } => temValor(x.v) && x.v > 0)
        .map((x) => ({ segmento: x.segmento, texto: textoMedida(x.segmento, x.v, idioma) }));
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

export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  get geracao() {
    return tx("Geração", "Generation");
  },
  get transmissao() {
    return tx("Transmissão", "Transmission");
  },
  get distribuicao() {
    return tx("Distribuição", "Distribution");
  },
};

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
export function cadeiaDoSetor(g: EmpresasGold, idioma: Idioma = idiomaEnergia()): EloCadeia[] {
  const r = g.cadastro.agentes.ramos;
  const op = g.cadastro.ativos.operacao;
  const t = g.cadastro.transmissao;
  const u = ucsDistribuidoras(g);
  const N = (v: number | null | undefined, casas = 0) => num(v, casas, idioma);
  return [
    {
      id: "geracao",
      titulo: tx("Geração", "Generation", idioma),
      faz: tx("Produz a energia em usinas hidrelétricas, eólicas, solares, térmicas e nucleares.", "Produces energy in hydropower, wind, solar, thermal and nuclear plants.", idioma),
      remuneracao: tx(
        "Vende a energia em leilões do mercado regulado ou em contratos no mercado livre.",
        "Sells energy in regulated market auctions or in contracts on the free market.",
        idioma,
      ),
      agentes: r.geracao ?? null,
      medida: temValor(op.mw_fiscalizado)
        ? tx(`${N(op.mw_fiscalizado)} MW em ${N(op.usinas)} usinas em operação`, `${N(op.mw_fiscalizado)} MW in ${N(op.usinas)} plants in operation`, idioma)
        : tx("potência sem dado", "capacity: no data", idioma),
      href: "/setor-eletrico/empresas/ativos",
      link: tx("Quem são os donos das usinas", "Who owns the plants", idioma),
    },
    {
      id: "transmissao",
      titulo: tx("Transmissão", "Transmission", idioma),
      faz: tx(
        "Leva a energia em alta tensão das usinas até as distribuidoras e os grandes consumidores.",
        "Carries energy at high voltage from the plants to the distribution utilities and large consumers.",
        idioma,
      ),
      remuneracao: tx(
        "Recebe uma receita anual fixa, definida no leilão da concessão, que não depende da energia transportada.",
        "Receives a fixed annual revenue, set in the concession auction, that does not depend on the energy carried.",
        idioma,
      ),
      agentes: r.transmissao ?? null,
      medida: t
        ? tx(
            `${N(t.resumo.km_circuito_operacao)} km de circuito em ${N(t.resumo.cnpjs_com_modulos)} concessionárias`,
            `${N(t.resumo.km_circuito_operacao)} circuit km in ${N(t.resumo.cnpjs_com_modulos)} concession holders`,
            idioma,
          )
        : tx("extensão sem dado", "length: no data", idioma),
      href: "/setor-eletrico/leiloes/transmissao",
      link: tx("Os leilões de transmissão", "Transmission auctions", idioma),
    },
    {
      id: "distribuicao",
      titulo: tx("Distribuição", "Distribution", idioma),
      faz: tx(
        "Entrega a energia a residências, comércio e indústria, cada uma com exclusividade na sua área.",
        "Delivers energy to homes, businesses and industry, each one with exclusivity in its area.",
        idioma,
      ),
      remuneracao: tx(
        "Cobra a tarifa definida pela ANEEL e compra em leilões a energia dos seus consumidores cativos.",
        "Charges the tariff set by ANEEL and buys in auctions the energy for its captive consumers.",
        idioma,
      ),
      agentes: r.distribuicao ?? null,
      medida: temValor(u.ucs)
        ? tx(`${N(u.ucs / 1e6, 1)} milhões de unidades consumidoras (${u.ano})`, `${N(u.ucs / 1e6, 1)} million consumer units (${u.ano})`, idioma)
        : tx("unidades consumidoras sem dado", "consumer units: no data", idioma),
      href: "/setor-eletrico/empresas/distribuidoras",
      link: tx("A ficha de cada distribuidora", "Each distribution utility's profile", idioma),
    },
    {
      id: "comercializacao",
      titulo: tx("Comercialização", "Trading", idioma),
      faz: tx(
        "Compra e vende contratos de energia, sobretudo no mercado livre; não opera usina, linha nem rede.",
        "Buys and sells energy contracts, mainly on the free market; it does not operate plants, lines or grids.",
        idioma,
      ),
      remuneracao: tx("Ganha na diferença entre os preços de compra e de venda dos contratos.", "Earns on the difference between the purchase and sale prices of contracts.", idioma),
      agentes: r.comercializacao ?? null,
      medida: tx("contratos registrados na CCEE", "contracts registered with the CCEE", idioma),
      href: "/setor-eletrico/mercado/agentes",
      link: tx("Agentes do mercado", "Market agents", idioma),
    },
  ];
}
