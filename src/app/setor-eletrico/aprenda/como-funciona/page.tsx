import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { InfograficoSistema, type EtapaSistema } from "@/components/energia/InfograficoSistema";
import { IconeSetor } from "@/components/energia/IconeSetor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { NOS_FORMACAO } from "@/lib/energia/conteudo/pld";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, num, pct, reais } from "@/lib/energia/formato";
import { ROTULO_FAIXA_USUAL, sin } from "@/lib/energia/leituras";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Como funciona o sistema elétrico brasileiro",
  description:
    "Infográfico explorável: da chuva aos reservatórios, à geração, à transmissão, ao mercado, à distribuição e ao consumidor; em paralelo, dos modelos oficiais ao CMO e ao PLD. Cada etapa com definição conferida, número de hoje e fonte.",
  alternates: { canonical: "/setor-eletrico/aprenda/como-funciona" },
};

export default function ComoFuncionaPage() {
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const rede = gold.rede();
  const carga = gold.carga();
  const pld = gold.pld();
  const cmo = gold.cmo();
  const hidSin = integra(hid) ? sin(hid.subsistemas) : undefined;
  const gSin = integra(ger) ? ger.regioes.find((r) => r.rg === "SIN")?.["7d"] : undefined;
  const neSe = integra(rede) ? rede.fronteiras.find((f) => f.par === "NE_SE") : undefined;
  const cargaSin = integra(carga) ? sin(carga.subsistemas) : undefined;
  const se = integra(pld) ? pld.cartoes.find((c) => c.sm === "SE") : undefined;
  const cmoSe = integra(cmo) ? cmo.ultima_semana.find((x) => x.sm === "SE") : undefined;
  const frase = (slug: string) => conceito(slug)?.emUmaFrase ?? "";
  const otimizacao = NOS_FORMACAO.find((n) => n.id === "otimizacao");

  const etapas: EtapaSistema[] = [
    {
      id: "chuva",
      cadeia: "fisica",
      rotulo: "Chuva",
      icone: "clima",
      frase: "A chuva sobre as bacias vira vazão nos rios que chegam aos reservatórios. Séries de chuva ainda não estão integradas ao observatório.",
      conferencia: "leitura",
      fonte: "conjuntos de clima e hidrologia por bacia catalogados (ONS, ANA, INMET), não integrados",
      hoje: null,
      href: "/setor-eletrico/dados",
      hrefRotulo: "Catálogo de dados",
    },
    {
      id: "afluencias",
      cadeia: "fisica",
      rotulo: "Rios e afluências",
      icone: "hidraulica",
      frase: frase("ena"),
      conferencia: "conferido",
      fonte: "ONS, ENA Diário por Subsistema",
      hoje: hidSin && hidSin.ena.pct_mlt_30d !== null ? { valor: `${pct(hidSin.ena.pct_mlt_30d, 1)} da MLT`, contexto: `ENA do SIN acumulada em 30 dias até ${dataBR(hidSin.ena.dia)}${hidSin.ena.faixa_30d ? `, ${ROTULO_FAIXA_USUAL[hidSin.ena.faixa_30d]}` : ""} (faixa usual ${pct(hidSin.ena.p10_30d, 1)} a ${pct(hidSin.ena.p90_30d, 1)}).`, natureza: "CALCULADO" } : null,
      href: "/setor-eletrico/agua-e-clima#ena",
      hrefRotulo: "Água e clima",
      verbete: "ena",
    },
    {
      id: "reservatorios",
      cadeia: "fisica",
      rotulo: "Reservatórios",
      icone: "agua",
      frase: frase("ear"),
      conferencia: "conferido",
      fonte: "ONS, EAR Diário por Subsistema",
      hoje: hidSin && hidSin.ear.valor !== null ? { valor: `${pct(hidSin.ear.valor)} da EAR máxima`, contexto: `EAR do SIN em ${dataBR(hidSin.ear.dia)}, ${ROTULO_FAIXA_USUAL[hidSin.ear.faixa ?? "dentro"]}; mediana da data ${pct(hidSin.ear.mediana_historica)}.`, natureza: "CALCULADO" } : null,
      href: "/setor-eletrico/agua-e-clima#reservatorios",
      hrefRotulo: "Água e clima",
      verbete: "ear",
    },
    {
      id: "geracao",
      cadeia: "fisica",
      rotulo: "Geração",
      icone: "geracao",
      frase: frase("geracao-centralizada"),
      conferencia: "conferido",
      fonte: "ONS, Balanço de Energia nos Subsistemas",
      hoje: gSin ? { valor: `${pct(gSin.hes, 0)} hidráulica, eólica e solar`, contexto: `Nos 7 dias até ${dataBR(gSin.fim)}: hidráulica ${pct(gSin.participacao.hidraulica)}, eólica ${pct(gSin.participacao.eolica)}, solar ${pct(gSin.participacao.solar)}, térmica ${pct(gSin.participacao.termica)}; ${num(gSin.total_mwmed, 0)} MWmed em média.`, natureza: "CALCULADO" } : null,
      href: "/setor-eletrico/geracao",
      hrefRotulo: "Geração",
      verbete: "geracao-centralizada",
    },
    {
      id: "transmissao",
      cadeia: "fisica",
      rotulo: "Transmissão",
      icone: "rede",
      frase: frase("intercambio"),
      conferencia: "conferido",
      fonte: "ONS, Intercâmbios Entre Subsistemas",
      hoje: neSe && neSe.fluxo_dia !== null && integra(rede) ? { valor: `${num(Math.abs(neSe.fluxo_dia), 0)} MWmed`, contexto: `Fluxo médio ${neSe.fluxo_dia >= 0 ? "do Nordeste para o Sudeste/Centro-Oeste" : "do Sudeste/Centro-Oeste para o Nordeste"} em ${dataBR(rede.dia_referencia)}. Limites de intercâmbio não integrados.`, natureza: "CALCULADO" } : null,
      href: "/setor-eletrico/rede",
      hrefRotulo: "Rede",
      verbete: "intercambio",
    },
    {
      id: "mercado",
      cadeia: "fisica",
      rotulo: "Mercado",
      icone: "mercado",
      frase: frase("mcp"),
      conferencia: "conferido",
      fonte: "CCEE, conjuntos PLD_HORARIO_SUBMERCADO e SUMARIO_BE_HORARIO_SUBMERCADO",
      hoje: se && integra(pld) ? { valor: `${reais(se.media_dia)}/MWh`, contexto: `PLD médio do Sudeste/Centro-Oeste em ${dataBR(pld.dia_referencia)}: o preço do Mercado de Curto Prazo. Como cada agente é liquidado está nas Regras de Comercialização, não conferidas nesta fase.`, natureza: "CALCULADO" } : null,
      href: "/setor-eletrico/pld#o-que-e",
      hrefRotulo: "PLD",
      verbete: "mcp",
    },
    {
      id: "distribuicao",
      cadeia: "fisica",
      rotulo: "Distribuição",
      icone: "empresas",
      frase: "A conta de quem é atendido pela distribuidora segue a Tarifa de Energia (TE) e a Tarifa de Uso do Sistema de Distribuição (TUSD), resultantes dos processos tarifários da ANEEL. O PLD não é essa tarifa.",
      conferencia: "conferido",
      fonte: "ANEEL, Tarifas de aplicação das distribuidoras de energia elétrica",
      hoje: null,
      href: "/setor-eletrico/empresas",
      hrefRotulo: "Empresas e distribuidoras (em integração)",
      verbete: "pld",
    },
    {
      id: "consumidor",
      cadeia: "fisica",
      rotulo: "Consumidor",
      icone: "carga",
      frase: frase("carga"),
      conferencia: "conferido",
      fonte: "ONS, Carga de Energia Diária",
      hoje: cargaSin && integra(carga) ? { valor: `${num(cargaSin.dia / 1000, 1)} GWmed`, contexto: `Carga do SIN em ${dataBR(carga.dia_referencia)} (soma dos quatro subsistemas). Inclui, desde 29/04/2023, a estimativa de micro e minigeração distribuída feita pelo ONS.`, natureza: "CALCULADO" } : null,
      href: "/setor-eletrico/carga",
      hrefRotulo: "Carga e consumo",
      verbete: "carga",
    },
    {
      id: "operacao",
      cadeia: "operacao",
      rotulo: "Modelos oficiais",
      icone: "modelo",
      frase: otimizacao?.oQueE ?? "",
      conferencia: "conferido",
      fonte: otimizacao?.fonteOQueE ?? "CCEE e ONS",
      hoje: null,
      href: "/setor-eletrico/pld#formacao",
      hrefRotulo: "De onde vem o preço",
      verbete: "decomp",
    },
    {
      id: "cmo",
      cadeia: "operacao",
      rotulo: "CMO",
      icone: "sistema",
      frase: frase("cmo"),
      conferencia: "conferido",
      fonte: "ONS, CMO Semanal",
      hoje: cmoSe && integra(cmo) ? { valor: `${reais(cmoSe.semanal)}/MWh`, contexto: `CMO semanal do Sudeste/Centro-Oeste na semana operativa identificada pelo ONS com a data ${dataBR(cmo.semana_referencia)}; patamares leve ${reais(cmoSe.leve)}, médio ${reais(cmoSe.media)} e pesado ${reais(cmoSe.pesada)}.`, natureza: "OBSERVADO" } : null,
      href: "/setor-eletrico/pld#cmo",
      hrefRotulo: "CMO semanal",
      verbete: "cmo",
    },
    {
      id: "pld",
      cadeia: "operacao",
      rotulo: "PLD",
      icone: "preco",
      frase: frase("pld"),
      conferencia: "conferido",
      fonte: "CCEE, descrição oficial do PLD",
      hoje: se && integra(pld) ? { valor: `${reais(se.media_dia)}/MWh`, contexto: `Média das 24 horas de ${dataBR(pld.dia_referencia)} no Sudeste/Centro-Oeste; valores horários de ${reais(se.min_hora)} a ${reais(se.max_hora)}.`, natureza: "CALCULADO" } : null,
      href: "/setor-eletrico/pld",
      hrefRotulo: "PLD",
      verbete: "pld",
    },
  ];

  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/aprenda" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline underline-offset-4">
            Aprenda
          </Link>{" "}
          · Infográfico
        </nav>
        <header className="pb-8 pt-2">
          <p className="rotulo flex items-center gap-2 text-mineral">
            <IconeSetor tipo="sistema" tamanho={15} /> Infográfico explorável
          </p>
          <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.1] text-carvao">Como funciona o sistema elétrico brasileiro?</h1>
          <p className="mt-4 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">
            Da chuva ao consumidor, e em paralelo dos modelos oficiais ao PLD. Cada etapa traz a definição, o número de hoje com a sua natureza e o caminho para o módulo. Só entram definições conferidas em fonte primária ou marcadas como leitura usual do setor.
          </p>
        </header>
        <div className="border border-linha bg-superficie p-4 md:p-6">
          <InfograficoSistema etapas={etapas} />
        </div>
        <p className="mt-4 max-w-prose2 text-xs leading-relaxed text-mineral">
          Nenhuma seta deste infográfico afirma que uma etapa determina a seguinte: a ordem é didática. As relações que dependem dos modelos oficiais estão no diagrama de formação do preço, com o tipo de cada ligação e o estado de conferência.
        </p>
      </main>
    </>
  );
}
