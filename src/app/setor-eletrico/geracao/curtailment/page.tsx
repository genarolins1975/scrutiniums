import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import {
  LabMeiaHora,
  LabReceita,
  LabValorPerdido,
  SimuladorDia,
  type PadraoReceita,
} from "@/components/energia/CurtailmentLabs";
import { EscolhaFonte } from "@/components/energia/EscolhaFonte";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import {
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoRegras,
} from "@/components/energia/GeracaoPagina";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import {
  NotasDoPainel,
  PainelEvidencia,
  type ProvenienciaComplementar,
} from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  escalaNacional,
  formasDoDia,
  horasNoMenorValor,
  leituraPerfil,
  perfilEmGw,
  razoesPresentes,
  serieDiariaPorRazao,
  serieEssConstrainedOff,
  serieMensalPorRazao,
  ufsContraEnergia,
} from "@/lib/energia/curtailment";
import { NOME_UF } from "@/lib/energia/expansao";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import {
  COR_RAZAO,
  CURTO_RAZAO,
  FONTES_RESTRICAO,
  NOME_FONTE_RESTRICAO,
  NOME_ORIGEM,
  PAINEIS_GERACAO,
  ROTULO_REGRA,
  rotaPainel,
  textoMudancaMensal,
  type FonteRestricao,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import type { GeracaoGold, PldGold } from "@/lib/energia/tipos";
import type {
  GoldGeracaoDetalhe,
  Restricao,
} from "@/lib/energia/tipos-geracao";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Curtailment: por que eólicas e solares são cortadas e quem perde",
  description:
    "O corte de geração eólica e solar (constrained-off) explicado com laboratórios interativos e os dados do ONS: como o corte é medido, as três razões oficiais, o meio-dia do sistema, a escala diante do consumo do país, o encargo pago pelos consumidores e as respostas possíveis.",
  alternates: { canonical: "/setor-eletrico/geracao/curtailment" },
};

const ROTA = "/setor-eletrico/geracao/curtailment";
const FONTE =
  "ONS, Restrição de Operação por Constrained-off de Usinas Eólicas e Fotovoltaicas";
const COR_FONTE: Record<FonteRestricao, string> = {
  eolica: "var(--serie-eolica)",
  solar: "var(--serie-solar)",
};
const COR_BALANCO = {
  hidraulica: "var(--serie-hidraulica)",
  termica: "var(--serie-termica)",
  eolica: "var(--serie-eolica)",
  solar: "var(--serie-solar)",
};
const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

/** Navegação de Geração com a seção de curtailment ao lado dos quatro painéis. */
const ITENS = [
  ...PAINEIS_GERACAO.filter((p) => p.publicado).map((p) => ({
    id: p.id,
    href: rotaPainel(p.id),
    rotulo: p.rotulo,
    descricao: p.pergunta,
  })),
  {
    id: "curtailment",
    href: ROTA,
    rotulo: "Curtailment",
    descricao: "Por que eólicas e solares são cortadas e quem perde com isso?",
  },
];

export default function CurtailmentPage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  const rs = integra(g) ? g.restricoes : null;
  const restricoes: Partial<Record<FonteRestricao, Restricao>> = {};
  if (rs?.eolica) restricoes.eolica = rs.eolica;
  if (rs?.solar) restricoes.solar = rs.solar;
  const fontes = FONTES_RESTRICAO.filter((f) => restricoes[f]);
  if (!integra(g) || !fontes.length) {
    return (
      <GeracaoIndisponivel
        motivo={
          (g as { motivo?: string } | null)?.motivo ??
          (g
            ? "As restrições de eólicas e fotovoltaicas não estão na base publicada nesta atualização."
            : undefined)
        }
      />
    );
  }
  const gb = lerGold<GeracaoGold>("geracao.json");
  const pld = lerGold<PldGold>("pld.json");
  const merc = lerGold<MercadoGold>("mercado.json");
  const ev = g.evidencias;
  const principal = restricoes[fontes[0]]!;
  const u12 = principal.ultimos_12m;
  const periodo12 = u12
    ? `${mesAno(u12.inicio)} a ${mesAno(u12.fim)}`
    : "período não publicado";
  const ultimoMes =
    fontes
      .map((f) => restricoes[f]!.ultimo_mes_completo)
      .filter((x): x is string => !!x)
      .sort()[0] ?? null;
  const ultimoDia = principal.diario_recente.dias.at(-1) ?? g.dia_referencia;
  const opcoesFonte = fontes.map((f) => [f, NOME_FONTE_RESTRICAO[f]] as const);
  const rotulosRazao = Object.fromEntries(
    g.razoes.map((z) => [z.id, z.rotulo]),
  ) as Record<string, string>;

  // dia real e formas do simulador
  const perfil =
    integra(gb) && gb.perfil_horario_sin?.length
      ? perfilEmGw(gb.perfil_horario_sin)
      : [];
  const formas = perfil.length ? formasDoDia(perfil) : null;
  const leitura = perfil.length ? leituraPerfil(perfil) : null;
  const diaRef = integra(gb) ? dataBR(gb.dia_referencia) : null;

  // PLD: horas no menor valor do ano, no Nordeste, nos últimos 30 dias
  const cartaoNe = integra(pld)
    ? pld.cartoes.find((c) => c.sm === "NE")
    : undefined;
  const menorNe = cartaoNe?.menor_valor_ano ?? null;
  const noMinimo = integra(pld)
    ? horasNoMenorValor(pld.horario_30d, "NE", menorNe)
    : { linhas: [], dias: 0 };
  const anoPld = integra(pld) ? pld.dia_referencia.slice(0, 4) : "";
  const pldNota =
    menorNe !== null && integra(pld)
      ? `Ponto de partida: R$ ${num(menorNe, 2)}/MWh, o menor PLD horário do Nordeste em ${anoPld} até ${dataBR(pld.dia_referencia)} (CCEE). Não é o piso regulatório, que não foi auditado aqui.`
      : "Sem PLD publicado nesta atualização: o valor inicial é um exemplo.";
  const horaMaisMinimo = noMinimo.linhas.length
    ? noMinimo.linhas.reduce((a, b) => (b.dias > a.dias ? b : a))
    : null;
  const horasMeioDiaSempre = noMinimo.linhas
    .filter((l) => l.comDado > 0 && l.dias === l.comDado)
    .map((l) => l.h);

  // efeito nacional
  const consumo = integra(merc)
    ? merc.livre_regulado.kpis.consumo_livre_12m
    : undefined;
  const escala = escalaNacional(restricoes, consumo);
  const ufs =
    integra(merc) && escala
      ? ufsContraEnergia(merc.livre_regulado.epe_uf_12m, escala.cortadaTwh)
      : null;
  const janelaUf =
    integra(merc) && merc.livre_regulado.epe_ultimo_mes_uf
      ? `12 meses até ${mesAno(merc.livre_regulado.epe_ultimo_mes_uf)}`
      : null;
  const ess = integra(merc)
    ? serieEssConstrainedOff(merc.encargos.ess_mensal)
    : [];
  const essUltimo = ess.filter((x) => x.valor !== null).at(-1);
  const ess12 = integra(merc) ? merc.encargos.kpis.ess_12m : undefined;

  const padroes: PadraoReceita[] = fontes.map((f) => {
    const u = restricoes[f]!.ultimos_12m;
    return {
      fonte: f,
      rotulo: NOME_FONTE_RESTRICAO[f],
      taxaPct: u?.taxa_pct ?? null,
      parcelaEletricaPct:
        u?.por_razao.find((z) => z.razao === "REL")?.pct ?? null,
      periodo: u
        ? `${mesAno(u.inicio)} a ${mesAno(u.fim)}`
        : "período não publicado",
    };
  });

  const mudancas = fontes
    .map((f) =>
      textoMudancaMensal({
        nome: `a energia não gerada estimada das ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`,
        unidade: "GWh",
        casas: 0,
        meses: restricoes[f]!.mensal_sin.meses,
        valores: restricoes[f]!.mensal_sin.energia_nao_gerada_total_mwh.map(
          (x) => (x === null ? null : x / 1000),
        ),
        mes: restricoes[f]!.ultimo_mes_completo,
      }),
    )
    .filter((x) => x);
  const oQueMudou = <>{mudancas.join(" ")}</>;
  const comoInterpretar = (
    <>
      Os números do ONS são estimativas: energia não gerada = referência
      estimada menos geração verificada, só nas meias horas em que o ONS limitou
      a usina. Taxa = não gerada ÷ (verificada + não gerada). Os laboratórios
      são modelos didáticos com grandezas escolhidas por você; eles explicam o
      mecanismo e não reproduzem a operação real. As comparações com o consumo
      do país e dos estados são de ordem de grandeza, entre fontes e universos
      diferentes.
    </>
  );
  const naoConcluir = (
    <>
      Que a energia não gerada tinha comprador: na razão energética, ela sobrava
      no país naquela hora. Que o valor da energia cortada é prejuízo de alguém:
      quem arca depende das regras de contrato e de ressarcimento. Que todo o
      encargo de constrained-off da CCEE é de eólicas e solares: o conjunto não
      separa por fonte. Que o corte aumentou emissões: o observatório não
      estimou isso. Que uma única medida resolve o corte: no simulador, cada
      alavanca mexe numa razão e pode empurrar o corte para outra.
    </>
  );
  const prov =
    g.proveniencia.restricao_eolica ?? g.proveniencia.restricao_solar;
  const complementares: ProvenienciaComplementar[] = [];
  if (g.proveniencia.restricao_eolica && g.proveniencia.restricao_solar)
    complementares.push({
      rotulo: "Restrições das fotovoltaicas",
      p: g.proveniencia.restricao_solar,
    });
  if (integra(merc) && merc.proveniencia.encargos_ccee)
    complementares.push({
      rotulo: "Encargos de serviços do sistema (CCEE)",
      p: merc.proveniencia.encargos_ccee,
    });
  if (integra(pld))
    complementares.push({
      rotulo: "PLD horário (CCEE)",
      p: pld.proveniencia.horario,
    });

  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <NavegacaoLocal
          rotulo="Páginas de geração"
          itens={ITENS}
          atual="curtailment"
        />
        <CabecalhoModulo
          siglas={[
            "SIN",
            "ONS",
            "PLD",
            "ESS",
            "CCEE",
            "EPE",
            "ANEEL",
            "REN",
            "MMGD",
          ]}
          rotulo="Geração · Curtailment"
          titulo="Por que eólicas e solares são cortadas, e quem perde?"
          lead={
            <>
              Curtailment é o nome em inglês para o corte de geração: a usina
              eólica ou solar está pronta, o vento ou o sol existem, e o ONS
              limita a energia que ela entrega à rede. No Brasil, o ONS chama
              esse corte de{" "}
              <Termo slug="constrained-off">constrained-off</Termo>.
            </>
          }
          recorte={`${periodo12} (12 meses completos) · eólicas e fotovoltaicas despachadas ou programadas pelo ONS · GWh, % e MW`}
          fonte={FONTE}
          referencia={
            <>
              {FONTE}, até {ultimoMes ? mesAno(ultimoMes) : "mês não publicado"}{" "}
              (último mês completo) e dias até {dataBR(ultimoDia)}; processado
              em {carimbo(g.gerado_em)}.
            </>
          }
          metricas={
            <FaixaMetricas
              colunas={fontes.length > 1 ? 4 : 2}
              rotulo="Energia não gerada e taxa de restrição, 12 meses completos"
              nota="Estimativas do ONS. Denominador da taxa: geração verificada mais a não gerada, nas mesmas usinas e meses."
            >
              {fontes.flatMap((f) => {
                const energia = ev[`restricao_${f}_12m_energia`];
                return [
                  <Numero
                    key={`${f}-energia`}
                    variante="faixa"
                    rotulo={`Energia não gerada, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`}
                    natureza="ESTIMADO"
                    evidencia={energia}
                    valor={
                      energia?.valor_calculo != null
                        ? (energia.valor_calculo as number) / 1e3
                        : null
                    }
                    unidade="GWh"
                    casas={0}
                    cor={COR_FONTE[f]}
                    endereco={`${ROTA}#tamanho`}
                  />,
                  <Numero
                    key={`${f}-taxa`}
                    variante="faixa"
                    rotulo={`Taxa de restrição, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`}
                    natureza="ESTIMADO"
                    evidencia={ev[`restricao_${f}_12m_taxa`]}
                    formato="pct"
                    casas={1}
                    unidade="da geração possível"
                    cor={COR_FONTE[f]}
                    endereco={`${ROTA}#tamanho`}
                  />,
                ];
              })}
            </FaixaMetricas>
          }
        >
          Esta seção explica o fenômeno de ponta a ponta: como o corte é medido,
          por que acontece, onde e quando aparece nos dados do ONS, quanto ele
          pesa para o país e quem arca com ele. Os laboratórios são modelos para
          experimentar; os gráficos com fonte são os números publicados. Os
          dados completos por usina, com mapa, estão no painel{" "}
          <Link href={`${rotaPainel("p023")}#p023`} className={link}>
            Renováveis restringidas
          </Link>
          .
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="curtailment">
            <PainelEvidencia
              id="painel-curtailment"
              pergunta="Curtailment: o mecanismo, a escala e o efeito para o sistema"
              subtitulo="Energia eólica e solar não gerada por limitação do ONS · GWh, %, MW e R$"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  Eólicas e solares já respondem por uma parcela grande da
                  geração, e uma fração crescente do que elas poderiam gerar
                  fica sem uso. O corte mexe na receita de quem gera, chega ao
                  consumidor por encargo e sinaliza onde faltam rede,
                  armazenamento ou flexibilidade.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov!}
              complementares={complementares}
            >
              <div className="space-y-10">
                {/* 1. o que é */}
                <SecaoDoPainel
                  id="o-que-e"
                  titulo="O que é, em uma frase e em uma meia hora"
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      [
                        "Não é falta de vento ou de sol",
                        "Se a usina gera menos porque o recurso caiu, não há corte. O corte é a energia que existia e não pôde entrar na rede.",
                      ],
                      [
                        "Não é defeito da usina",
                        "Manutenção e indisponibilidade da própria usina ficam fora da estatística: só conta a meia hora em que o ONS limitou.",
                      ],
                      [
                        "Tem duas medidas",
                        "Energia (GWh), somada ao longo do tempo, e potência (MW), o tamanho do corte num instante. Uma não se converte na outra sem o tempo.",
                      ],
                    ].map(([t, x]) => (
                      <div key={t} className="border-t border-linha pt-3">
                        <p className="font-medium text-carvao">{t}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                          {x}
                        </p>
                      </div>
                    ))}
                  </div>
                  <LabMeiaHora />
                </SecaoDoPainel>

                {/* 2. por que */}
                <SecaoDoPainel
                  id="por-que"
                  titulo="Por que o ONS corta: as razões oficiais"
                  lead="Cada limitação vem com um código de razão. Três deles concentram quase todo o corte."
                >
                  <dl className="grid gap-4 md:grid-cols-3">
                    {(
                      [
                        [
                          "ENE",
                          "Sobra energia no país inteiro naquela hora: eólica, solar e as usinas que não podem desligar passam da demanda. Não há para quem vender.",
                        ],
                        [
                          "CNF",
                          "A segurança pede máquinas girando em sincronismo (inércia, controle de frequência e de tensão). Para mantê-las ligadas, a renovável cede espaço.",
                        ],
                        [
                          "REL",
                          "A rede não leva a energia de onde ela é gerada até onde ela é consumida, por limite ou indisponibilidade de equipamento de transmissão.",
                        ],
                      ] as const
                    ).map(([z, x]) => (
                      <div
                        key={z}
                        className="border-l-4 pl-3"
                        style={{ borderColor: COR_RAZAO[z] }}
                      >
                        <dt className="font-medium text-carvao">
                          {CURTO_RAZAO[z]}
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                          {x}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {formas ? (
                    <SimuladorDia
                      formas={formas}
                      diaReferencia={diaRef ?? "dia de referência"}
                    />
                  ) : (
                    <p className="text-sm text-carvao-muted">
                      O simulador precisa do perfil horário do dia de
                      referência, que não está na base publicada nesta
                      atualização.
                    </p>
                  )}
                </SecaoDoPainel>

                {/* 3. o meio-dia real */}
                {perfil.length > 0 && (
                  <SecaoDoPainel
                    id="meio-dia"
                    titulo="O meio-dia do sistema, num dia real"
                    lead={`A geração verificada do SIN, hora a hora, em ${diaRef}. É aqui que o corte energético nasce: a solar sobe junto com o sol e o resto do sistema precisa abrir espaço.`}
                  >
                    <GraficoBarras
                      titulo={`Geração verificada por fonte no SIN, ${diaRef}`}
                      dados={perfil}
                      chaveCategoria="h"
                      series={[
                        {
                          id: "hidraulica",
                          rotulo: "Hidráulica",
                          cor: COR_BALANCO.hidraulica,
                        },
                        {
                          id: "termica",
                          rotulo: "Térmica",
                          cor: COR_BALANCO.termica,
                        },
                        {
                          id: "eolica",
                          rotulo: "Eólica",
                          cor: COR_BALANCO.eolica,
                        },
                        {
                          id: "solar",
                          rotulo: "Solar (balanço do ONS)",
                          cor: COR_BALANCO.solar,
                        },
                      ]}
                      unidade="GW"
                      casas={1}
                      empilhado
                      altura={300}
                    />
                    {leitura && (
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                        A solar chega a {num(leitura.solarGw, 1)} GW às{" "}
                        {leitura.horaPicoSolar}. Nessa hora a hidráulica gera{" "}
                        {num(leitura.hidroNoPicoGw, 1)} GW, contra{" "}
                        {num(leitura.hidroMaxGw, 1)} GW às{" "}
                        {leitura.horaMaxHidro}: as hidrelétricas guardam água no
                        meio do dia e funcionam como a bateria do sistema.
                        Quando nem esse recuo basta, o que sobra é cortado.
                      </p>
                    )}
                    {noMinimo.linhas.length > 0 && menorNe !== null && (
                      <>
                        <GraficoBarras
                          titulo={`Dias em que o PLD do Nordeste ficou no menor valor do ano, por hora, nos últimos ${noMinimo.dias} dias`}
                          dados={noMinimo.linhas}
                          chaveCategoria="h"
                          series={[
                            {
                              id: "dias",
                              rotulo: `Dias no menor valor (R$ ${num(menorNe, 2)}/MWh)`,
                              cor: "var(--cor-energia)",
                            },
                          ]}
                          unidade="dias"
                          casas={0}
                          altura={240}
                        />
                        <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                          {horaMaisMinimo && horaMaisMinimo.dias > 0
                            ? `O preço da energia no curto prazo conta a mesma história: em ${noMinimo.dias} dias, o PLD do Nordeste ficou no menor valor horário de ${anoPld} em até ${horaMaisMinimo.dias} dias na mesma hora (${horaMaisMinimo.h}).`
                            : "Nos últimos dias publicados, o PLD do Nordeste não ficou no menor valor do ano."}
                          {horasMeioDiaSempre.length > 0 &&
                            ` Em ${horasMeioDiaSempre.length} horas do dia ele esteve nesse valor em todos os dias com dado.`}{" "}
                          Preço no menor valor é o sinal de que sobra energia: a
                          mesma sobra que vira corte energético.
                        </p>
                      </>
                    )}
                  </SecaoDoPainel>
                )}

                {/* 4. o tamanho */}
                <SecaoDoPainel
                  id="tamanho"
                  titulo="O tamanho do corte, mês a mês e por razão"
                  lead="Energia não gerada estimada pelo ONS no SIN, por razão oficial. Mês parcial aparece marcado."
                >
                  <EscolhaFonte
                    nome="curtailment-mensal"
                    opcoes={opcoesFonte}
                    conteudo={Object.fromEntries(
                      fontes.map((f) => {
                        const linhas = serieMensalPorRazao(restricoes[f]!);
                        return [
                          f,
                          <GraficoBarras
                            key={f}
                            titulo={`${NOME_FONTE_RESTRICAO[f]}: energia não gerada por razão, ${mesAno(restricoes[f]!.mensal_sin.meses[0])} a ${mesAno(restricoes[f]!.mensal_sin.meses.at(-1)!)}`}
                            dados={linhas}
                            chaveCategoria="mes"
                            chaveRotulo="rotulo"
                            series={razoesPresentes(linhas).map((z) => ({
                              id: z,
                              rotulo: CURTO_RAZAO[z],
                              cor: COR_RAZAO[z],
                            }))}
                            unidade="GWh"
                            casas={0}
                            empilhado
                            altura={300}
                          />,
                        ];
                      }),
                    )}
                  />
                  <GraficoLinhas
                    titulo="Taxa de restrição mensal: parcela da geração possível que não foi gerada"
                    dados={principal.mensal_sin.meses.map((mes) => ({
                      mes,
                      ...Object.fromEntries(
                        fontes.map((f) => {
                          const m = restricoes[f]!.mensal_sin;
                          const i = m.meses.indexOf(mes);
                          return [f, i >= 0 ? m.taxa_pct[i] : null];
                        }),
                      ),
                    }))}
                    chaveX="mes"
                    formatoX="mes"
                    series={fontes.map((f) => ({
                      id: f,
                      rotulo: NOME_FONTE_RESTRICAO[f],
                      cor: COR_FONTE[f],
                    }))}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={240}
                  />
                  <TabelaDados
                    titulo={`Energia não gerada por razão, ${periodo12}`}
                    colunas={[
                      "Fonte",
                      "Razão",
                      "GWh",
                      "% da energia não gerada",
                    ]}
                    linhas={fontes.flatMap((f) =>
                      (restricoes[f]!.ultimos_12m?.por_razao ?? [])
                        .filter((z) => (z.mwh ?? 0) > 0)
                        .map((z) => [
                          NOME_FONTE_RESTRICAO[f],
                          CURTO_RAZAO[z.razao],
                          z.mwh === null ? null : z.mwh / 1e3,
                          z.pct,
                        ]),
                    )}
                    casas={[null, null, 0, 1]}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    {fontes.map((f) => {
                      const u = restricoes[f]!.ultimos_12m;
                      if (!u) return null;
                      return (
                        <GraficoBarras
                          key={f}
                          titulo={`${NOME_FONTE_RESTRICAO[f]}: taxa de restrição por subsistema, ${periodo12}`}
                          dados={u.por_subsistema.map((s) => ({
                            sm: s.sm,
                            taxa: s.taxa_pct,
                          }))}
                          chaveCategoria="sm"
                          series={[
                            {
                              id: "taxa",
                              rotulo: "Taxa de restrição",
                              cor: COR_FONTE[f],
                            },
                          ]}
                          unidade="%"
                          casas={1}
                          orientacao="horizontal"
                          rotulosValor
                          referencias={
                            u.taxa_pct !== null
                              ? [{ valor: u.taxa_pct, rotulo: "SIN" }]
                              : []
                          }
                        />
                      );
                    })}
                  </div>
                </SecaoDoPainel>

                {/* 5. os últimos dias */}
                <SecaoDoPainel
                  id="ultimos-dias"
                  titulo="Os últimos dias, um a um"
                  lead={`Energia não gerada por dia e razão, até ${dataBR(ultimoDia)}. O corte varia muito de um dia para outro: depende do vento, do sol e da demanda.`}
                >
                  <EscolhaFonte
                    nome="curtailment-diario"
                    opcoes={opcoesFonte}
                    conteudo={Object.fromEntries(
                      fontes.map((f) => {
                        const linhas = serieDiariaPorRazao(restricoes[f]!);
                        const maior = linhas.reduce(
                          (a, b) =>
                            (b.potenciaGw ?? 0) > (a.potenciaGw ?? 0) ? b : a,
                          linhas[0],
                        );
                        return [
                          f,
                          <div key={f} className="space-y-2">
                            <GraficoBarras
                              titulo={`${NOME_FONTE_RESTRICAO[f]}: energia não gerada por dia e razão`}
                              dados={linhas}
                              chaveCategoria="dia"
                              chaveRotulo="rotulo"
                              series={razoesPresentes(linhas).map((z) => ({
                                id: z,
                                rotulo: CURTO_RAZAO[z],
                                cor: COR_RAZAO[z],
                              }))}
                              unidade="GWh"
                              casas={1}
                              empilhado
                              altura={260}
                            />
                            {maior?.potenciaGw != null && (
                              <p className="text-sm text-carvao-muted">
                                Maior corte simultâneo no período:{" "}
                                {num(maior.potenciaGw, 1)} GW em{" "}
                                {dataBR(maior.dia)}, a soma dos cortes de todas
                                as usinas na mesma meia hora.
                              </p>
                            )}
                          </div>,
                        ];
                      }),
                    )}
                  />
                </SecaoDoPainel>

                {/* 6. sociedade e setor */}
                <SecaoDoPainel
                  id="efeito"
                  titulo="O efeito para o setor e para a sociedade"
                  lead="O corte não fica dentro da usina. Ele mostra quanto recurso já construído deixa de chegar a quem consome, passa ao consumidor por encargo e muda o risco de quem investe."
                >
                  {escala && (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="border border-energia bg-energia-fundo px-4 py-3">
                        <p className="text-xs text-carvao-muted">
                          Eólica e solar não geradas, {mesAno(escala.inicio)} a{" "}
                          {mesAno(escala.fim)}
                        </p>
                        <p className="text-2xl font-medium tabular-nums text-carvao">
                          {num(escala.cortadaTwh, 1)} TWh
                        </p>
                        <p className="text-xs text-carvao-muted">
                          ONS, estimativa; soma das duas fontes
                        </p>
                      </div>
                      {escala.consumoTwh !== null && (
                        <div className="border border-linha bg-superficie px-4 py-3">
                          <p className="text-xs text-carvao-muted">
                            Consumo de energia na rede do país, mesmo período
                          </p>
                          <p className="text-2xl font-medium tabular-nums text-carvao">
                            {num(escala.consumoTwh, 1)} TWh
                          </p>
                          <p className="text-xs text-carvao-muted">
                            EPE, cativo e livre
                          </p>
                        </div>
                      )}
                      {escala.proporcaoPct !== null && (
                        <div className="border border-linha bg-superficie px-4 py-3">
                          <p className="text-xs text-carvao-muted">
                            Energia não gerada diante do consumo
                          </p>
                          <p className="text-2xl font-medium tabular-nums text-carvao">
                            {pct(escala.proporcaoPct, 1)}
                          </p>
                          <p className="text-xs text-carvao-muted">
                            ordem de grandeza: fontes e universos diferentes
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {ufs && escala && (
                    <>
                      <GraficoBarras
                        titulo={`Consumo na rede por UF, ${janelaUf ?? "12 meses"}, contra a energia eólica e solar não gerada em 12 meses`}
                        dados={ufs.linhas.map((u) => ({
                          uf: u.uf,
                          twh: u.twh,
                        }))}
                        chaveCategoria="uf"
                        series={[
                          {
                            id: "twh",
                            rotulo: "Consumo na rede da UF",
                            cor: "var(--serie-referencia)",
                          },
                        ]}
                        unidade="TWh"
                        casas={1}
                        orientacao="horizontal"
                        alturaCategoria={28}
                        alturaMaxima={760}
                        referencias={[
                          {
                            valor: escala.cortadaTwh,
                            rotulo: `Energia não gerada, ${mesAno(escala.inicio)} a ${mesAno(escala.fim)}`,
                          },
                        ]}
                      />
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                        A energia que eólicas e solares deixaram de gerar em 12
                        meses supera o consumo na rede de {ufs.abaixo.length}{" "}
                        das {ufs.linhas.length} UFs com dado.
                        {ufs.acima.length > 0 &&
                          ` Só ${ufs.acima.map((u) => NOME_UF[u.uf] ?? u.uf).join(" e ")} consumiram mais.`}{" "}
                        As janelas diferem em um mês (o consumo por UF da EPE
                        vai até{" "}
                        {janelaUf?.replace("12 meses até ", "") ??
                          "o último mês publicado"}
                        ), e a comparação é de escala.
                      </p>
                    </>
                  )}

                  {ess.length > 0 && (
                    <>
                      <GraficoBarras
                        titulo={`Encargo de serviços do sistema por restrição de operação constrained-off, ${mesAno(ess[0].mes)} a ${mesAno(ess.at(-1)!.mes)}`}
                        dados={ess}
                        chaveCategoria="mes"
                        chaveRotulo="rotulo"
                        series={[
                          {
                            id: "valor",
                            rotulo: "Constrained-off (CCEE)",
                            cor: "var(--serie-termica)",
                          },
                        ]}
                        unidade="R$ milhões"
                        casas={1}
                        altura={260}
                      />
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                        Quando o corte dá direito a ressarcimento, o valor vira{" "}
                        <Termo slug="ess">ESS</Termo>, um encargo alocado aos
                        consumidores.
                        {essUltimo?.valor != null &&
                          ` Em ${mesAno(essUltimo.mes)}, a parcela de constrained-off apurada pela CCEE foi de R$ ${num(essUltimo.valor, 1)} milhões.`}
                        {ess12 &&
                          ` O total de encargos de serviços do sistema em ${mesAno(ess12.periodo.inicio)} a ${mesAno(ess12.periodo.fim)} foi de R$ ${num(ess12.valor_rs / 1e9, 2)} bilhões, com todas as parcelas.`}{" "}
                        O conjunto da CCEE não separa o constrained-off por
                        fonte, e os valores estão como publicados. O detalhe dos
                        encargos está em{" "}
                        <Link
                          href="/setor-eletrico/mercado/encargos"
                          className={link}
                        >
                          Mercado, encargos
                        </Link>
                        .
                      </p>
                    </>
                  )}

                  <div
                    className="tabela-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Quem arca com o corte (tabela rolável)"
                  >
                    <table className="w-full min-w-[40rem] border-collapse text-sm">
                      <caption className="mb-2 text-left font-medium text-carvao">
                        Quem arca com o corte, e o que este observatório mede de
                        cada efeito
                      </caption>
                      <thead>
                        <tr className="text-left text-mineral">
                          {[
                            "Quem",
                            "Efeito",
                            "O que a página mede",
                            "O que não mede",
                          ].map((c) => (
                            <th
                              key={c}
                              scope="col"
                              className="border-b border-linha px-2 py-1.5 font-medium"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="align-top leading-relaxed">
                        {[
                          [
                            "Geradores eólicos e solares",
                            "Energia que não vendem ou que precisam repor no mercado de curto prazo",
                            "Energia não gerada por fonte, razão e usina (painel P023)",
                            "Receita de cada usina e contratos",
                          ],
                          [
                            "Consumidores",
                            "Encargo de ressarcimento na conta, quando a razão dá direito a ele",
                            "Encargo de constrained-off por mês (CCEE)",
                            "Repasse a cada tarifa e a cada classe",
                          ],
                          [
                            "Operação do sistema",
                            "Precisa de máquinas síncronas, rede e reserva para absorver a variação",
                            "Razão oficial de cada corte e maior corte simultâneo",
                            "Custo de cada serviço de confiabilidade",
                          ],
                          [
                            "Expansão e investidores",
                            "O risco de corte entra no retorno exigido de novas usinas e na escolha do lugar",
                            "Taxa de corte por subsistema e por usina",
                            "Custo de capital e decisões de investimento",
                          ],
                          [
                            "Ambiente",
                            "Energia renovável que existia e não foi usada",
                            "Energia não gerada",
                            "Emissões: o observatório não estimou se o corte mudou a geração térmica",
                          ],
                        ].map((l) => (
                          <tr key={l[0]} className="border-b border-linha">
                            <th
                              scope="row"
                              className="px-2 py-2 text-left font-medium text-carvao"
                            >
                              {l[0]}
                            </th>
                            {l.slice(1).map((c, i) => (
                              <td
                                key={i}
                                className="px-2 py-2 text-carvao-muted"
                              >
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {escala && (
                    <LabValorPerdido
                      cortadaTwh={escala.cortadaTwh}
                      periodo={`${mesAno(escala.inicio)} a ${mesAno(escala.fim)}`}
                      pldMenor={menorNe}
                      pldNota={pldNota}
                    />
                  )}
                  <LabReceita
                    padroes={padroes}
                    pld={menorNe}
                    pldNota={pldNota}
                  />
                </SecaoDoPainel>

                {/* 7. respostas */}
                <SecaoDoPainel
                  id="respostas"
                  titulo="Respostas possíveis e o que cada uma resolve"
                  lead="Nenhuma alavanca atua sobre as três razões ao mesmo tempo. Teste cada uma no simulador do dia."
                >
                  <div
                    className="tabela-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Respostas ao corte (tabela rolável)"
                  >
                    <table className="w-full min-w-[40rem] border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-mineral">
                          {[
                            "Resposta",
                            "Atua sobre",
                            "No simulador",
                            "Limite",
                          ].map((c) => (
                            <th
                              key={c}
                              scope="col"
                              className="border-b border-linha px-2 py-1.5 font-medium"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="align-top leading-relaxed">
                        {[
                          [
                            "Transmissão entre regiões",
                            "Elétrica (REL)",
                            "Mais escoamento do Nordeste",
                            "Se o país inteiro já sobra, o corte só muda de razão; obras levam anos.",
                          ],
                          [
                            "Armazenamento (baterias, usinas reversíveis)",
                            "Energética (ENE) e confiabilidade (CNF)",
                            "Bateria de 10 GW por 4 horas",
                            "Perde parte da energia no ciclo e precisa de receita para se pagar.",
                          ],
                          [
                            "Hidráulicas e térmicas mais flexíveis",
                            "Energética (ENE)",
                            "Hidráulicas e térmicas mais flexíveis",
                            "Não ajuda enquanto a segurança exigir mais máquinas síncronas que o mínimo técnico.",
                          ],
                          [
                            "Inércia e controle sem gerar energia (compensadores síncronos, inversores que formam a rede)",
                            "Confiabilidade (CNF)",
                            "Mais máquinas síncronas exigidas, no sentido inverso",
                            "Depende de requisito técnico do ONS e de quem paga pelo serviço.",
                          ],
                          [
                            "Demanda no horário da sobra (novas cargas, tarifa por hora)",
                            "Energética (ENE)",
                            "Domingo de demanda baixa, no sentido inverso",
                            "Muda hábitos e contratos; o efeito vem aos poucos.",
                          ],
                          [
                            "Planejamento e localização da expansão",
                            "As três",
                            "Mais 20 GW de solar, no sentido inverso",
                            "Usina nova onde já sobra energia aumenta o corte.",
                          ],
                        ].map((l) => (
                          <tr key={l[0]} className="border-b border-linha">
                            <th
                              scope="row"
                              className="px-2 py-2 text-left font-medium text-carvao"
                            >
                              {l[0]}
                            </th>
                            {l.slice(1).map((c, i) => (
                              <td
                                key={i}
                                className="px-2 py-2 text-carvao-muted"
                              >
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <NotasDoPainel
                    oQueMudou={oQueMudou}
                    comoInterpretar={comoInterpretar}
                    naoConcluir={naoConcluir}
                  />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Para seguir: o painel{" "}
                    <Link href={`${rotaPainel("p023")}#p023`} className={link}>
                      Renováveis restringidas
                    </Link>{" "}
                    traz o mapa e a lista de usinas; o verbete{" "}
                    <Link
                      href="/setor-eletrico/aprenda/constrained-off"
                      className={link}
                    >
                      Constrained-off
                    </Link>{" "}
                    explica a regra; e{" "}
                    <Link
                      href="/setor-eletrico/transicao/riscos"
                      className={link}
                    >
                      Transição, riscos
                    </Link>{" "}
                    liga o corte ao risco de quem investe.
                  </p>
                </SecaoDoPainel>

                {/* analisar */}
                <SecaoDoPainel
                  nivel="analisar"
                  id="descricoes"
                  titulo="O que o ONS escreve ao limitar: as descrições mais frequentes e a origem do corte"
                >
                  <EscolhaFonte
                    nome="curtailment-descricoes"
                    opcoes={opcoesFonte}
                    conteudo={Object.fromEntries(
                      fontes.map((f) => {
                        const d = restricoes[f]!.descricoes_ultimo_mes;
                        if (!d || !d.itens.length)
                          return [
                            f,
                            <p key={f} className="text-sm text-carvao-muted">
                              Sem descrições publicadas para o último mês.
                            </p>,
                          ];
                        return [
                          f,
                          <GraficoBarras
                            key={f}
                            titulo={`${NOME_FONTE_RESTRICAO[f]}: energia não gerada pelas descrições mais frequentes, ${mesAno(d.mes)} (${num(d.n_descricoes, 0)} descrições no mês)`}
                            dados={d.itens.map((x, i) => ({
                              id: String(i),
                              descricao: x.descricao.replace(/\.$/, ""),
                              gwh: x.mwh === null ? null : x.mwh / 1e3,
                            }))}
                            chaveCategoria="id"
                            chaveRotulo="descricao"
                            series={[
                              {
                                id: "gwh",
                                rotulo: "Energia não gerada",
                                cor: COR_FONTE[f],
                              },
                            ]}
                            unidade="GWh"
                            casas={1}
                            orientacao="horizontal"
                            rotulosValor
                          />,
                        ];
                      }),
                    )}
                  />
                  <TabelaDados
                    titulo={`Origem do corte por razão, ${periodo12}`}
                    colunas={["Fonte", "Razão", "Origem", "GWh"]}
                    linhas={fontes.flatMap((f) =>
                      (restricoes[f]!.ultimos_12m?.por_razao ?? []).flatMap(
                        (z) =>
                          Object.entries(z.origens_mwh)
                            .filter(([, v]) => (v ?? 0) > 0)
                            .map(([o, v]) => [
                              NOME_FONTE_RESTRICAO[f],
                              CURTO_RAZAO[z.razao],
                              NOME_ORIGEM[o] ?? o,
                              v === null ? null : v / 1e3,
                            ]),
                      ),
                    )}
                    casas={[null, null, null, 0]}
                  />
                  <p className="text-sm text-carvao-muted">
                    Local: o limite está perto da usina. Sistêmica: o limite é
                    do sistema como um todo ou de uma região.
                  </p>
                </SecaoDoPainel>

                {/* auditar */}
                <SecaoDoPainel
                  nivel="auditar"
                  id="regras-curtailment"
                  titulo="Regras, razões oficiais e o que os laboratórios deixam de fora"
                >
                  <GeracaoRegras
                    regras={[
                      {
                        rotulo: ROTULO_REGRA.restricao,
                        texto: g.regras.restricao,
                      },
                    ]}
                  />
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {g.razoes.map((z) => (
                      <li key={z.id}>
                        <span className="text-carvao">{CURTO_RAZAO[z.id]}</span>
                        : {rotulosRazao[z.id]}.
                      </li>
                    ))}
                  </ul>
                  <GeracaoFrases
                    itens={[
                      ...(g.proveniencia.restricao_eolica?.limitacoes ?? []),
                      ...(
                        g.proveniencia.restricao_solar?.limitacoes ?? []
                      ).filter(
                        (x) =>
                          !(
                            g.proveniencia.restricao_eolica?.limitacoes ?? []
                          ).includes(x),
                      ),
                    ]}
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
                    <li>
                      Meia hora: aplica a regra publicada (referência menos
                      verificada só com limitação do ONS) a uma usina; não
                      estima a referência.
                    </li>
                    <li>
                      Um dia no sistema: formas das curvas do dia de referência;
                      três regras em ordem (elétrica, energética,
                      confiabilidade) e bateria com rendimento de 85%. Não é o
                      despacho do ONS nem a regra oficial de classificação das
                      razões.
                    </li>
                    <li>
                      Quem gera: energia possível = potência × fator de
                      capacidade × 8.760 h; sem ressarcimento, garantia física,
                      contratos por disponibilidade ou tributos.
                    </li>
                    <li>
                      Valor da energia não gerada: quantidade publicada × preço
                      escolhido; não é custo de nenhum agente.
                    </li>
                    <li>
                      Comparações de escala: energia não gerada (ONS,
                      estimativa) diante do consumo na rede (EPE). O consumo
                      nacional só é usado quando a janela de 12 meses coincide;
                      o consumo por UF vai até{" "}
                      {janelaUf?.replace("12 meses até ", "") ??
                        "o último mês publicado"}
                      .
                    </li>
                  </ul>
                </SecaoDoPainel>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
