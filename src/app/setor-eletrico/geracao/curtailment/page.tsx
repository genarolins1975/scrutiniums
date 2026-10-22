import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
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
import { Nome } from "@/components/i18n/Nome";
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
  FONTES_RESTRICAO,
  curtoRazao,
  nomeFonteRestricao,
  nomeOrigem,
  paineisGeracao,
  rotaPainel,
  rotuloRegraGeracao,
  textoMudancaMensal,
  type FonteRestricao,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { rotuloGoldNo } from "@/lib/energia/i18n/geracao";
import type { GeracaoGold, PldGold } from "@/lib/energia/tipos";
import type {
  GoldGeracaoDetalhe,
  RazaoRestricao,
  Restricao,
} from "@/lib/energia/tipos-geracao";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/geracao/curtailment", {
    title: tx("Curtailment: por que eólicas e solares são cortadas e quem perde", "Curtailment: why wind and solar plants are cut, and who loses"),
    description: tx(
      "O corte de geração eólica e solar (constrained-off) explicado com laboratórios interativos e os dados do ONS: como o corte é medido, as três razões oficiais, o meio-dia do sistema, a escala diante do consumo do país, o encargo pago pelos consumidores e as respostas possíveis.",
      "The curtailment of wind and solar generation (operating restriction, constrained-off) explained with interactive labs and ONS data: how the cut is measured, the three official reasons, the system's midday, its scale against the country's consumption, the charge paid by consumers and the possible responses.",
    ),
    alternates: { canonical: "/setor-eletrico/geracao/curtailment" },
  }, anterior);
}

const ROTA = "/setor-eletrico/geracao/curtailment";
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
function itens() {
  return [
    ...paineisGeracao()
      .filter((p) => p.publicado)
      .map((p) => ({
        id: p.id,
        href: rotaPainel(p.id),
        rotulo: p.rotulo,
        descricao: p.pergunta,
      })),
    {
      id: "curtailment",
      href: ROTA,
      rotulo: tx("Curtailment", "Curtailment"),
      descricao: tx("Por que eólicas e solares são cortadas e quem perde com isso?", "Why are wind and solar plants cut, and who loses from it?"),
    },
  ];
}

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
            ? tx("As restrições de eólicas e fotovoltaicas não estão na base publicada nesta atualização.", "Wind and photovoltaic restrictions are not in the published dataset in this update.")
            : undefined)
        }
      />
    );
  }
  const idioma = idiomaEnergia();
  const FONTE = tx("ONS, Restrição de Operação por Constrained-off de Usinas Eólicas e Fotovoltaicas", "ONS, operating restriction (constrained-off) of wind and photovoltaic plants dataset");
  const NOME_FONTE_RESTRICAO = nomeFonteRestricao();
  const CURTO_RAZAO = curtoRazao();
  const NOME_ORIGEM = nomeOrigem();
  const ROTULO_REGRA = rotuloRegraGeracao();
  const periodoNaoPublicado = tx("período não publicado", "period not published");
  const gb = lerGold<GeracaoGold>("geracao.json");
  const pld = lerGold<PldGold>("pld.json");
  const merc = lerGold<MercadoGold>("mercado.json");
  const ev = g.evidencias;
  const principal = restricoes[fontes[0]]!;
  const u12 = principal.ultimos_12m;
  const periodo12 = u12 ? tx(`${mesAno(u12.inicio)} a ${mesAno(u12.fim)}`, `${mesAno(u12.inicio)} to ${mesAno(u12.fim)}`) : periodoNaoPublicado;
  const ultimoMes =
    fontes
      .map((f) => restricoes[f]!.ultimo_mes_completo)
      .filter((x): x is string => !!x)
      .sort()[0] ?? null;
  const ultimoDia = principal.diario_recente.dias.at(-1) ?? g.dia_referencia;
  const opcoesFonte = fontes.map((f) => [f, NOME_FONTE_RESTRICAO[f]] as const);
  const rotulosRazao = Object.fromEntries(g.razoes.map((z) => [z.id, z.rotulo])) as Record<string, string>;

  // dia real e formas do simulador
  const perfil = integra(gb) && gb.perfil_horario_sin?.length ? perfilEmGw(gb.perfil_horario_sin) : [];
  const formas = perfil.length ? formasDoDia(perfil) : null;
  const leitura = perfil.length ? leituraPerfil(perfil) : null;
  const diaRef = integra(gb) ? dataBR(gb.dia_referencia) : null;

  // PLD: horas no menor valor do ano, no Nordeste, nos últimos 30 dias
  const cartaoNe = integra(pld) ? pld.cartoes.find((c) => c.sm === "NE") : undefined; // i18n: dado
  const menorNe = cartaoNe?.menor_valor_ano ?? null;
  const noMinimo = integra(pld) ? horasNoMenorValor(pld.horario_30d, "NE", menorNe) : { linhas: [], dias: 0 };
  const anoPld = integra(pld) ? pld.dia_referencia.slice(0, 4) : "";
  const pldNota =
    menorNe !== null && integra(pld)
      ? tx(
          `Ponto de partida: R$ ${num(menorNe, 2)}/MWh, o menor PLD horário do Nordeste em ${anoPld} até ${dataBR(pld.dia_referencia)} (CCEE). Não é o piso regulatório, que não foi auditado aqui.`,
          `Starting point: R$ ${num(menorNe, 2)}/MWh, the lowest hourly PLD in the Northeast in ${anoPld} up to ${dataBR(pld.dia_referencia)} (CCEE). It is not the regulatory floor, which was not audited here.`,
        )
      : tx("Sem PLD publicado nesta atualização: o valor inicial é um exemplo.", "No PLD published in this update: the initial value is an example.");
  const horaMaisMinimo = noMinimo.linhas.length ? noMinimo.linhas.reduce((a, b) => (b.dias > a.dias ? b : a)) : null;
  const horasMeioDiaSempre = noMinimo.linhas.filter((l) => l.comDado > 0 && l.dias === l.comDado).map((l) => l.h);

  // efeito nacional
  const consumo = integra(merc) ? merc.livre_regulado.kpis.consumo_livre_12m : undefined;
  const escala = escalaNacional(restricoes, consumo);
  const ufs = integra(merc) && escala ? ufsContraEnergia(merc.livre_regulado.epe_uf_12m, escala.cortadaTwh) : null;
  const mesUf = integra(merc) && merc.livre_regulado.epe_ultimo_mes_uf ? mesAno(merc.livre_regulado.epe_ultimo_mes_uf) : null;
  const janelaUf = mesUf ? tx(`12 meses até ${mesUf}`, `12 months up to ${mesUf}`) : null;
  const ateMesUf = mesUf ?? tx("o último mês publicado", "the latest published month");
  const ess = integra(merc) ? serieEssConstrainedOff(merc.encargos.ess_mensal) : [];
  const essUltimo = ess.filter((x) => x.valor !== null).at(-1);
  const ess12 = integra(merc) ? merc.encargos.kpis.ess_12m : undefined;
  const periodoEscala = escala ? tx(`${mesAno(escala.inicio)} a ${mesAno(escala.fim)}`, `${mesAno(escala.inicio)} to ${mesAno(escala.fim)}`) : "";

  const padroes: PadraoReceita[] = fontes.map((f) => {
    const u = restricoes[f]!.ultimos_12m;
    return {
      fonte: f,
      rotulo: NOME_FONTE_RESTRICAO[f],
      taxaPct: u?.taxa_pct ?? null,
      parcelaEletricaPct: u?.por_razao.find((z) => z.razao === "REL")?.pct ?? null,
      periodo: u ? tx(`${mesAno(u.inicio)} a ${mesAno(u.fim)}`, `${mesAno(u.inicio)} to ${mesAno(u.fim)}`) : periodoNaoPublicado,
    };
  });

  const mudancas = fontes
    .map((f) =>
      textoMudancaMensal({
        nome: tx(`a energia não gerada estimada das ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`, `the estimated energy not generated by ${NOME_FONTE_RESTRICAO[f].toLowerCase()} plants`),
        unidade: "GWh",
        casas: 0,
        meses: restricoes[f]!.mensal_sin.meses,
        valores: restricoes[f]!.mensal_sin.energia_nao_gerada_total_mwh.map((x) => (x === null ? null : x / 1000)),
        mes: restricoes[f]!.ultimo_mes_completo,
      }),
    )
    .filter((x) => x);
  const oQueMudou = <>{mudancas.join(" ")}</>;
  const comoInterpretar = tx(
    <>
      Os números do ONS são estimativas: energia não gerada = referência
      estimada menos geração verificada, só nas meias horas em que o ONS limitou
      a usina. Taxa = não gerada ÷ (verificada + não gerada). Os laboratórios
      são modelos didáticos com grandezas escolhidas por você; eles explicam o
      mecanismo e não reproduzem a operação real. As comparações com o consumo
      do país e dos estados são de ordem de grandeza, entre fontes e universos
      diferentes.
    </>,
    <>
      The ONS figures are estimates: energy not generated = estimated reference
      minus verified generation, only in the half hours in which the ONS limited
      the plant. Rate = not generated ÷ (verified + not generated). The labs
      are teaching models with magnitudes you choose; they explain the
      mechanism and do not reproduce real operation. The comparisons with the consumption
      of the country and the states are orders of magnitude, between different sources and
      universes.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que a energia não gerada tinha comprador: na razão energética, ela sobrava
      no país naquela hora. Que o valor da energia cortada é prejuízo de alguém:
      quem arca depende das regras de contrato e de ressarcimento. Que todo o
      encargo de constrained-off da CCEE é de eólicas e solares: o conjunto não
      separa por fonte. Que o corte aumentou emissões: o observatório não
      estimou isso. Que uma única medida resolve o corte: no simulador, cada
      alavanca mexe numa razão e pode empurrar o corte para outra.
    </>,
    <>
      That the energy not generated had a buyer: under the energy reason, it was in surplus
      in the country in that hour. That the value of the curtailed energy is someone&apos;s loss:
      who bears it depends on the contract and compensation rules. That the whole CCEE
      constrained-off charge comes from wind and solar plants: the dataset does not
      split it by source. That the cut increased emissions: the observatory did not
      estimate that. That a single measure solves the cut: in the simulator, each
      lever acts on one reason and may push the cut to another.
    </>,
  );
  const prov = g.proveniencia.restricao_eolica ?? g.proveniencia.restricao_solar;
  const complementares: ProvenienciaComplementar[] = [];
  if (g.proveniencia.restricao_eolica && g.proveniencia.restricao_solar)
    complementares.push({
      rotulo: tx("Restrições das fotovoltaicas", "Photovoltaic restrictions"),
      p: g.proveniencia.restricao_solar,
    });
  if (integra(merc) && merc.proveniencia.encargos_ccee)
    complementares.push({
      rotulo: tx("Encargos de serviços do sistema (CCEE)", "System services charges (CCEE)"),
      p: merc.proveniencia.encargos_ccee,
    });
  if (integra(pld))
    complementares.push({
      rotulo: tx("PLD horário (CCEE)", "Hourly PLD (CCEE)"),
      p: pld.proveniencia.horario,
    });

  const oQueE: [string, string][] = tx(
    [
      ["Não é falta de vento ou de sol", "Se a usina gera menos porque o recurso caiu, não há corte. O corte é a energia que existia e não pôde entrar na rede."],
      ["Não é defeito da usina", "Manutenção e indisponibilidade da própria usina ficam fora da estatística: só conta a meia hora em que o ONS limitou."],
      ["Tem duas medidas", "Energia (GWh), somada ao longo do tempo, e potência (MW), o tamanho do corte num instante. Uma não se converte na outra sem o tempo."],
    ],
    [
      ["It is not a lack of wind or sun", "If the plant generates less because the resource dropped, there is no cut. The cut is the energy that existed and could not enter the grid."],
      ["It is not a plant fault", "Maintenance and unavailability of the plant itself are left out of the statistics: only the half hour in which the ONS limited the plant counts."],
      ["It has two measures", "Energy (GWh), added up over time, and capacity (MW), the size of the cut at one instant. One does not convert into the other without time."],
    ],
  );
  const porRazao: [RazaoRestricao, string][] = tx(
    [
      ["ENE", "Sobra energia no país inteiro naquela hora: eólica, solar e as usinas que não podem desligar passam da demanda. Não há para quem vender."],
      ["CNF", "A segurança pede máquinas girando em sincronismo (inércia, controle de frequência e de tensão). Para mantê-las ligadas, a renovável cede espaço."],
      ["REL", "A rede não leva a energia de onde ela é gerada até onde ela é consumida, por limite ou indisponibilidade de equipamento de transmissão."],
    ],
    [
      ["ENE", "There is surplus energy in the whole country in that hour: wind, solar and the plants that cannot shut down exceed demand. There is no one to sell to."],
      ["CNF", "Security requires machines spinning in synchronism (inertia, frequency and voltage control). To keep them online, renewables give up space."],
      ["REL", "The grid cannot carry the energy from where it is generated to where it is consumed, because of a limit or the unavailability of transmission equipment."],
    ],
  );
  const quemArca: string[][] = tx(
    [
      ["Geradores eólicos e solares", "Energia que não vendem ou que precisam repor no mercado de curto prazo", "Energia não gerada por fonte, razão e usina (painel P023)", "Receita de cada usina e contratos"],
      ["Consumidores", "Encargo de ressarcimento na conta, quando a razão dá direito a ele", "Encargo de constrained-off por mês (CCEE)", "Repasse a cada tarifa e a cada classe"],
      ["Operação do sistema", "Precisa de máquinas síncronas, rede e reserva para absorver a variação", "Razão oficial de cada corte e maior corte simultâneo", "Custo de cada serviço de confiabilidade"],
      ["Expansão e investidores", "O risco de corte entra no retorno exigido de novas usinas e na escolha do lugar", "Taxa de corte por subsistema e por usina", "Custo de capital e decisões de investimento"],
      ["Ambiente", "Energia renovável que existia e não foi usada", "Energia não gerada", "Emissões: o observatório não estimou se o corte mudou a geração térmica"],
    ],
    [
      ["Wind and solar generators", "Energy they do not sell or have to replace in the short-term market", "Energy not generated by source, reason and plant (panel P023)", "Revenue of each plant and contracts"],
      ["Consumers", "Compensation charge on the bill, when the reason gives the right to it", "Constrained-off charge by month (CCEE)", "Pass-through to each tariff and each class"],
      ["System operation", "Needs synchronous machines, grid and reserve to absorb the variation", "Official reason for each cut and the largest simultaneous cut", "Cost of each reliability service"],
      ["Expansion and investors", "The risk of cuts enters the return required from new plants and the choice of location", "Cut rate by subsystem and by plant", "Cost of capital and investment decisions"],
      ["Environment", "Renewable energy that existed and was not used", "Energy not generated", "Emissions: the observatory did not estimate whether the cut changed thermal generation"],
    ],
  );
  const respostas: string[][] = tx(
    [
      ["Transmissão entre regiões", "Elétrica (REL)", "Mais escoamento do Nordeste", "Se o país inteiro já sobra, o corte só muda de razão; obras levam anos."],
      ["Armazenamento (baterias, usinas reversíveis)", "Energética (ENE) e confiabilidade (CNF)", "Bateria de 10 GW por 4 horas", "Perde parte da energia no ciclo e precisa de receita para se pagar."],
      ["Hidráulicas e térmicas mais flexíveis", "Energética (ENE)", "Hidráulicas e térmicas mais flexíveis", "Não ajuda enquanto a segurança exigir mais máquinas síncronas que o mínimo técnico."],
      ["Inércia e controle sem gerar energia (compensadores síncronos, inversores que formam a rede)", "Confiabilidade (CNF)", "Mais máquinas síncronas exigidas, no sentido inverso", "Depende de requisito técnico do ONS e de quem paga pelo serviço."],
      ["Demanda no horário da sobra (novas cargas, tarifa por hora)", "Energética (ENE)", "Domingo de demanda baixa, no sentido inverso", "Muda hábitos e contratos; o efeito vem aos poucos."],
      ["Planejamento e localização da expansão", "As três", "Mais 20 GW de solar, no sentido inverso", "Usina nova onde já sobra energia aumenta o corte."],
    ],
    [
      ["Transmission between regions", "Electrical (REL)", "More transmission capacity out of the Northeast", "If the whole country already has a surplus, the cut only changes reason; works take years."],
      ["Storage (batteries, pumped-storage plants)", "Energy (ENE) and reliability (CNF)", "A 10 GW, 4-hour battery", "Loses part of the energy in the cycle and needs revenue to pay for itself."],
      ["More flexible hydropower and thermal plants", "Energy (ENE)", "More flexible hydropower and thermal plants", "Does not help while security requires more synchronous machines than the technical minimum."],
      ["Inertia and control without generating energy (synchronous condensers, grid-forming inverters)", "Reliability (CNF)", "More synchronous machines required, in reverse", "Depends on an ONS technical requirement and on who pays for the service."],
      ["Demand in the surplus hours (new loads, time-of-use tariffs)", "Energy (ENE)", "Low-demand Sunday, in reverse", "Changes habits and contracts; the effect comes gradually."],
      ["Planning and location of expansion", "All three", "20 GW more solar, in reverse", "A new plant where energy is already in surplus increases the cut."],
    ],
  );
  const ufsAcima = ufs ? ufs.acima.map((u) => NOME_UF[u.uf] ?? u.uf).join(tx(" e ", " and ")) : "";

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <NavegacaoLocal rotulo={tx("Páginas de geração", "Generation pages")} itens={itens()} atual="curtailment" />
        <CabecalhoModulo
          siglas={["SIN", "ONS", "PLD", "ESS", "CCEE", "EPE", "ANEEL", "REN", "MMGD"]}
          rotulo={tx("Geração · Curtailment", "Generation · Curtailment")}
          titulo={tx("Por que eólicas e solares são cortadas, e quem perde?", "Why are wind and solar plants cut, and who loses?")}
          lead={tx(
            <>
              Curtailment é o nome em inglês para o corte de geração: a usina
              eólica ou solar está pronta, o vento ou o sol existem, e o ONS
              limita a energia que ela entrega à rede. No Brasil, o ONS chama
              esse corte de{" "}
              <Termo slug="constrained-off">constrained-off</Termo>.
            </>,
            <>
              Curtailment is the cut in generation: the wind or solar plant is ready, the wind or the sun is there, and the ONS
              limits the energy it delivers to the grid. In Brazil, the ONS calls
              this cut an operating restriction,{" "}
              <Termo slug="constrained-off">constrained-off</Termo>.
            </>,
          )}
          recorte={tx(
            `${periodo12} (12 meses completos) · eólicas e fotovoltaicas despachadas ou programadas pelo ONS · GWh, % e MW`,
            `${periodo12} (12 complete months) · wind and photovoltaic plants dispatched or scheduled by the ONS · GWh, % and MW`,
          )}
          fonte={FONTE}
          referencia={tx(
            <>
              {FONTE}, até {ultimoMes ? mesAno(ultimoMes) : "mês não publicado"}{" "}
              (último mês completo) e dias até {dataBR(ultimoDia)}; processado
              em {carimbo(g.gerado_em)}.
            </>,
            <>
              {FONTE}, up to {ultimoMes ? mesAno(ultimoMes) : "month not published"} (latest complete month) and days up to {dataBR(ultimoDia)}; processed
              on {carimbo(g.gerado_em)}.
            </>,
          )}
          metricas={
            <FaixaMetricas
              colunas={fontes.length > 1 ? 4 : 2}
              rotulo={tx("Energia não gerada e taxa de restrição, 12 meses completos", "Energy not generated and restriction rate, 12 complete months")}
              nota={tx(
                "Estimativas do ONS. Denominador da taxa: geração verificada mais a não gerada, nas mesmas usinas e meses.",
                "ONS estimates. Rate denominator: verified generation plus energy not generated, in the same plants and months.",
              )}
            >
              {fontes.flatMap((f) => {
                const energia = ev[`restricao_${f}_12m_energia`];
                const nome = NOME_FONTE_RESTRICAO[f].toLowerCase();
                return [
                  <Numero
                    key={`${f}-energia`}
                    variante="faixa"
                    rotulo={tx(`Energia não gerada, ${nome}`, `Energy not generated, ${nome}`)}
                    natureza="ESTIMADO"
                    evidencia={energia}
                    valor={energia?.valor_calculo != null ? (energia.valor_calculo as number) / 1e3 : null}
                    unidade="GWh"
                    casas={0}
                    cor={COR_FONTE[f]}
                    endereco={`${ROTA}#tamanho`}
                  />,
                  <Numero
                    key={`${f}-taxa`}
                    variante="faixa"
                    rotulo={tx(`Taxa de restrição, ${nome}`, `Restriction rate, ${nome}`)}
                    natureza="ESTIMADO"
                    evidencia={ev[`restricao_${f}_12m_taxa`]}
                    formato="pct"
                    casas={1}
                    unidade={tx("da geração possível", "of possible generation")}
                    cor={COR_FONTE[f]}
                    endereco={`${ROTA}#tamanho`}
                  />,
                ];
              })}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Esta seção explica o fenômeno de ponta a ponta: como o corte é medido,
              por que acontece, onde e quando aparece nos dados do ONS, quanto ele
              pesa para o país e quem arca com ele. Os laboratórios são modelos para
              experimentar; os gráficos com fonte são os números publicados. Os
              dados completos por usina, com mapa, estão no painel{" "}
              <Link href={`${rotaPainel("p023")}#p023`} className={link}>
                Renováveis restringidas
              </Link>
              .
            </>,
            <>
              This section explains the phenomenon end to end: how the cut is measured,
              why it happens, where and when it appears in the ONS data, how much it
              weighs for the country, and who bears it. The labs are models to
              experiment with; the charts with a source are the published figures. The
              full data by plant, with a map, are in the{" "}
              <Link href={`${rotaPainel("p023")}#p023`} className={link}>
                Restricted renewables
              </Link>{" "}
              panel.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="curtailment">
            <PainelEvidencia
              id="painel-curtailment"
              pergunta={tx("Curtailment: o mecanismo, a escala e o efeito para o sistema", "Curtailment: the mechanism, the scale and the effect on the system")}
              subtitulo={tx(
                "Energia eólica e solar não gerada por limitação do ONS · GWh, %, MW e R$",
                "Wind and solar energy not generated due to ONS limitation · GWh, %, MW and R$",
              )}
              natureza="ESTIMADO"
              porQueImporta={tx(
                <>
                  Eólicas e solares já respondem por uma parcela grande da
                  geração, e uma fração crescente do que elas poderiam gerar
                  fica sem uso. O corte mexe na receita de quem gera, chega ao
                  consumidor por encargo e sinaliza onde faltam rede,
                  armazenamento ou flexibilidade.
                </>,
                <>
                  Wind and solar plants already account for a large share of
                  generation, and a growing fraction of what they could generate
                  goes unused. The cut affects generators&apos; revenue, reaches the
                  consumer through a charge, and signals where grid,
                  storage or flexibility is lacking.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov!}
              complementares={complementares}
            >
              <div className="space-y-10">
                {/* 1. o que é */}
                <SecaoDoPainel id="o-que-e" titulo={tx("O que é, em uma frase e em uma meia hora", "What it is, in one sentence and in one half hour")}>
                  <div className="grid gap-4 md:grid-cols-3">
                    {oQueE.map(([t, x]) => (
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
                  titulo={tx("Por que o ONS corta: as razões oficiais", "Why the ONS cuts: the official reasons")}
                  lead={tx(
                    "Cada limitação vem com um código de razão. Três deles concentram quase todo o corte.",
                    "Each limitation comes with a reason code. Three of them account for almost all of the cut.",
                  )}
                >
                  <dl className="grid gap-4 md:grid-cols-3">
                    {porRazao.map(([z, x]) => (
                      <div key={z} className="border-l-4 pl-3" style={{ borderColor: COR_RAZAO[z] }}>
                        <dt className="font-medium text-carvao">{CURTO_RAZAO[z]}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{x}</dd>
                      </div>
                    ))}
                  </dl>
                  {formas ? (
                    <SimuladorDia formas={formas} diaReferencia={diaRef ?? tx("dia de referência", "reference day")} />
                  ) : (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        "O simulador precisa do perfil horário do dia de referência, que não está na base publicada nesta atualização.",
                        "The simulator needs the hourly profile of the reference day, which is not in the published dataset in this update.",
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                {/* 3. o meio-dia real */}
                {perfil.length > 0 && (
                  <SecaoDoPainel
                    id="meio-dia"
                    titulo={tx("O meio-dia do sistema, num dia real", "The system's midday, on a real day")}
                    lead={tx(
                      `A geração verificada do SIN, hora a hora, em ${diaRef}. É aqui que o corte energético nasce: a solar sobe junto com o sol e o resto do sistema precisa abrir espaço.`,
                      `Verified SIN generation, hour by hour, on ${diaRef}. This is where the energy cut begins: solar rises with the sun and the rest of the system has to make room.`,
                    )}
                  >
                    <GraficoBarras
                      titulo={tx(`Geração verificada por fonte no SIN, ${diaRef}`, `Verified generation by source in the SIN, ${diaRef}`)}
                      dados={perfil}
                      chaveCategoria="h"
                      series={[
                        { id: "hidraulica", rotulo: tx("Hidráulica", "Hydropower"), cor: COR_BALANCO.hidraulica },
                        { id: "termica", rotulo: tx("Térmica", "Thermal"), cor: COR_BALANCO.termica },
                        { id: "eolica", rotulo: tx("Eólica", "Wind"), cor: COR_BALANCO.eolica },
                        { id: "solar", rotulo: tx("Solar (balanço do ONS)", "Solar (ONS energy balance)"), cor: COR_BALANCO.solar },
                      ]}
                      unidade="GW"
                      casas={1}
                      empilhado
                      altura={300}
                    />
                    {leitura && (
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                        {tx(
                          <>
                            A solar chega a {num(leitura.solarGw, 1)} GW às{" "}
                            {leitura.horaPicoSolar}. Nessa hora a hidráulica gera{" "}
                            {num(leitura.hidroNoPicoGw, 1)} GW, contra{" "}
                            {num(leitura.hidroMaxGw, 1)} GW às{" "}
                            {leitura.horaMaxHidro}: as hidrelétricas guardam água no
                            meio do dia e funcionam como a bateria do sistema.
                            Quando nem esse recuo basta, o que sobra é cortado.
                          </>,
                          <>
                            Solar reaches {num(leitura.solarGw, 1)} GW at {leitura.horaPicoSolar}. At that hour hydropower generates{" "}
                            {num(leitura.hidroNoPicoGw, 1)} GW, against {num(leitura.hidroMaxGw, 1)} GW at {leitura.horaMaxHidro}: hydropower plants store water in the
                            middle of the day and work as the system&apos;s battery.
                            When even that pullback is not enough, the surplus is cut.
                          </>,
                        )}
                      </p>
                    )}
                    {noMinimo.linhas.length > 0 && menorNe !== null && (
                      <>
                        <GraficoBarras
                          titulo={tx(
                            `Dias em que o PLD do Nordeste ficou no menor valor do ano, por hora, nos últimos ${noMinimo.dias} dias`,
                            `Days on which the Northeast PLD was at the lowest value of the year, by hour, in the last ${noMinimo.dias} days`,
                          )}
                          dados={noMinimo.linhas}
                          chaveCategoria="h"
                          series={[
                            {
                              id: "dias", // i18n: dado
                              rotulo: tx(`Dias no menor valor (R$ ${num(menorNe, 2)}/MWh)`, `Days at the lowest value (R$ ${num(menorNe, 2)}/MWh)`),
                              cor: "var(--cor-energia)", // i18n: dado
                            },
                          ]}
                          unidade={tx("dias", "days")}
                          casas={0}
                          altura={240}
                        />
                        <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                          {horaMaisMinimo && horaMaisMinimo.dias > 0
                            ? tx(
                                `O preço da energia no curto prazo conta a mesma história: em ${noMinimo.dias} dias, o PLD do Nordeste ficou no menor valor horário de ${anoPld} em até ${horaMaisMinimo.dias} dias na mesma hora (${horaMaisMinimo.h}).`,
                                `The short-term energy price tells the same story: in ${noMinimo.dias} days, the Northeast PLD was at the lowest hourly value of ${anoPld} on up to ${horaMaisMinimo.dias} days at the same hour (${horaMaisMinimo.h}).`,
                              )
                            : tx("Nos últimos dias publicados, o PLD do Nordeste não ficou no menor valor do ano.", "In the latest published days, the Northeast PLD was not at the lowest value of the year.")}
                          {horasMeioDiaSempre.length > 0 &&
                            tx(
                              ` Em ${horasMeioDiaSempre.length} horas do dia ele esteve nesse valor em todos os dias com dado.`,
                              ` In ${horasMeioDiaSempre.length} hours of the day it was at that value on every day with data.`,
                            )}{" "}
                          {tx(
                            "Preço no menor valor é o sinal de que sobra energia: a mesma sobra que vira corte energético.",
                            "A price at the lowest value is the sign of surplus energy: the same surplus that becomes an energy cut.",
                          )}
                        </p>
                      </>
                    )}
                  </SecaoDoPainel>
                )}

                {/* 4. o tamanho */}
                <SecaoDoPainel
                  id="tamanho"
                  titulo={tx("O tamanho do corte, mês a mês e por razão", "The size of the cut, month by month and by reason")}
                  lead={tx(
                    "Energia não gerada estimada pelo ONS no SIN, por razão oficial. Mês parcial aparece marcado.",
                    "Energy not generated estimated by the ONS in the SIN, by official reason. A partial month is marked.",
                  )}
                >
                  <EscolhaFonte
                    nome="curtailment-mensal"
                    opcoes={opcoesFonte}
                    conteudo={Object.fromEntries(
                      fontes.map((f) => {
                        const linhas = serieMensalPorRazao(restricoes[f]!);
                        const de = mesAno(restricoes[f]!.mensal_sin.meses[0]);
                        const ate = mesAno(restricoes[f]!.mensal_sin.meses.at(-1)!);
                        return [
                          f,
                          <GraficoBarras
                            key={f}
                            titulo={tx(
                              `${NOME_FONTE_RESTRICAO[f]}: energia não gerada por razão, ${de} a ${ate}`,
                              `${NOME_FONTE_RESTRICAO[f]}: energy not generated by reason, ${de} to ${ate}`,
                            )}
                            dados={linhas}
                            chaveCategoria="mes"
                            chaveRotulo="rotulo"
                            series={razoesPresentes(linhas).map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
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
                    titulo={tx("Taxa de restrição mensal: parcela da geração possível que não foi gerada", "Monthly restriction rate: share of possible generation that was not generated")}
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
                    series={fontes.map((f) => ({ id: f, rotulo: NOME_FONTE_RESTRICAO[f], cor: COR_FONTE[f] }))}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={240}
                  />
                  <TabelaDados
                    titulo={tx(`Energia não gerada por razão, ${periodo12}`, `Energy not generated by reason, ${periodo12}`)}
                    colunas={tx(["Fonte", "Razão", "GWh", "% da energia não gerada"], ["Source", "Reason", "GWh", "% of the energy not generated"])}
                    linhas={fontes.flatMap((f) =>
                      (restricoes[f]!.ultimos_12m?.por_razao ?? [])
                        .filter((z) => (z.mwh ?? 0) > 0)
                        .map((z) => [NOME_FONTE_RESTRICAO[f], CURTO_RAZAO[z.razao], z.mwh === null ? null : z.mwh / 1e3, z.pct]),
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
                          titulo={tx(`${NOME_FONTE_RESTRICAO[f]}: taxa de restrição por subsistema, ${periodo12}`, `${NOME_FONTE_RESTRICAO[f]}: restriction rate by subsystem, ${periodo12}`)}
                          dados={u.por_subsistema.map((s) => ({ sm: s.sm, taxa: s.taxa_pct }))}
                          chaveCategoria="sm"
                          series={[{ id: "taxa", rotulo: tx("Taxa de restrição", "Restriction rate"), cor: COR_FONTE[f] }]}
                          unidade="%"
                          casas={1}
                          orientacao="horizontal"
                          rotulosValor
                          referencias={u.taxa_pct !== null ? [{ valor: u.taxa_pct, rotulo: "SIN" }] : []}
                        />
                      );
                    })}
                  </div>
                </SecaoDoPainel>

                {/* 5. os últimos dias */}
                <SecaoDoPainel
                  id="ultimos-dias"
                  titulo={tx("Os últimos dias, um a um", "The latest days, one by one")}
                  lead={tx(
                    `Energia não gerada por dia e razão, até ${dataBR(ultimoDia)}. O corte varia muito de um dia para outro: depende do vento, do sol e da demanda.`,
                    `Energy not generated by day and reason, up to ${dataBR(ultimoDia)}. The cut varies a lot from one day to the next: it depends on the wind, the sun and demand.`,
                  )}
                >
                  <EscolhaFonte
                    nome="curtailment-diario"
                    opcoes={opcoesFonte}
                    conteudo={Object.fromEntries(
                      fontes.map((f) => {
                        const linhas = serieDiariaPorRazao(restricoes[f]!);
                        const maior = linhas.reduce((a, b) => ((b.potenciaGw ?? 0) > (a.potenciaGw ?? 0) ? b : a), linhas[0]);
                        return [
                          f,
                          <div key={f} className="space-y-2">
                            <GraficoBarras
                              titulo={tx(`${NOME_FONTE_RESTRICAO[f]}: energia não gerada por dia e razão`, `${NOME_FONTE_RESTRICAO[f]}: energy not generated by day and reason`)}
                              dados={linhas}
                              chaveCategoria="dia" // i18n: dado
                              chaveRotulo="rotulo"
                              series={razoesPresentes(linhas).map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
                              unidade="GWh"
                              casas={1}
                              empilhado
                              altura={260}
                            />
                            {maior?.potenciaGw != null && (
                              <p className="text-sm text-carvao-muted">
                                {tx(
                                  <>
                                    Maior corte simultâneo no período:{" "}
                                    {num(maior.potenciaGw, 1)} GW em{" "}
                                    {dataBR(maior.dia)}, a soma dos cortes de todas
                                    as usinas na mesma meia hora.
                                  </>,
                                  <>
                                    Largest simultaneous cut in the period: {num(maior.potenciaGw, 1)} GW on {dataBR(maior.dia)}, the sum of the cuts of all
                                    plants in the same half hour.
                                  </>,
                                )}
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
                  titulo={tx("O efeito para o setor e para a sociedade", "The effect on the sector and on society")}
                  lead={tx(
                    "O corte não fica dentro da usina. Ele mostra quanto recurso já construído deixa de chegar a quem consome, passa ao consumidor por encargo e muda o risco de quem investe.",
                    "The cut does not stay inside the plant. It shows how much already-built resource fails to reach those who consume, passes to the consumer through a charge, and changes the risk for investors.",
                  )}
                >
                  {escala && (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="border border-energia bg-energia-fundo px-4 py-3">
                        <p className="text-xs text-carvao-muted">
                          {tx(
                            <>
                              Eólica e solar não geradas, {mesAno(escala.inicio)} a{" "}
                              {mesAno(escala.fim)}
                            </>,
                            <>Wind and solar not generated, {periodoEscala}</>,
                          )}
                        </p>
                        <p className="text-2xl font-medium tabular-nums text-carvao">
                          {num(escala.cortadaTwh, 1)} TWh
                        </p>
                        <p className="text-xs text-carvao-muted">{tx("ONS, estimativa; soma das duas fontes", "ONS, estimate; sum of the two sources")}</p>
                      </div>
                      {escala.consumoTwh !== null && (
                        <div className="border border-linha bg-superficie px-4 py-3">
                          <p className="text-xs text-carvao-muted">{tx("Consumo de energia na rede do país, mesmo período", "Energy consumption on the country's grid, same period")}</p>
                          <p className="text-2xl font-medium tabular-nums text-carvao">
                            {num(escala.consumoTwh, 1)} TWh
                          </p>
                          <p className="text-xs text-carvao-muted">{tx("EPE, cativo e livre", "EPE, captive and free")}</p>
                        </div>
                      )}
                      {escala.proporcaoPct !== null && (
                        <div className="border border-linha bg-superficie px-4 py-3">
                          <p className="text-xs text-carvao-muted">{tx("Energia não gerada diante do consumo", "Energy not generated against consumption")}</p>
                          <p className="text-2xl font-medium tabular-nums text-carvao">
                            {pct(escala.proporcaoPct, 1)}
                          </p>
                          <p className="text-xs text-carvao-muted">{tx("ordem de grandeza: fontes e universos diferentes", "order of magnitude: different sources and universes")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {ufs && escala && (
                    <>
                      <GraficoBarras
                        titulo={tx(
                          `Consumo na rede por UF, ${janelaUf ?? "12 meses"}, contra a energia eólica e solar não gerada em 12 meses`,
                          `Grid consumption by state, ${janelaUf ?? "12 months"}, against wind and solar energy not generated in 12 months`,
                        )}
                        dados={ufs.linhas.map((u) => ({ uf: u.uf, twh: u.twh }))}
                        chaveCategoria="uf"
                        series={[{ id: "twh", rotulo: tx("Consumo na rede da UF", "Grid consumption in the state"), cor: "var(--serie-referencia)" }]}
                        unidade="TWh"
                        casas={1}
                        orientacao="horizontal"
                        alturaCategoria={28}
                        alturaMaxima={760}
                        referencias={[
                          {
                            valor: escala.cortadaTwh,
                            rotulo: tx(`Energia não gerada, ${periodoEscala}`, `Energy not generated, ${periodoEscala}`),
                          },
                        ]}
                      />
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                        {tx(
                          <>
                            A energia que eólicas e solares deixaram de gerar em 12
                            meses supera o consumo na rede de {ufs.abaixo.length}{" "}
                            das {ufs.linhas.length} UFs com dado.
                            {ufs.acima.length > 0 && (
                              <>
                                {" "}Só <Nome>{ufsAcima}</Nome> consumiram mais.
                              </>
                            )}{" "}
                            As janelas diferem em um mês (o consumo por UF da EPE
                            vai até{" "}
                            {ateMesUf}
                            ), e a comparação é de escala.
                          </>,
                          <>
                            The energy that wind and solar plants did not generate in 12
                            months exceeds the grid consumption of {ufs.abaixo.length} of the {ufs.linhas.length} states with data.
                            {ufs.acima.length > 0 && (
                              <>
                                {" "}Only <Nome>{ufsAcima}</Nome> consumed more.
                              </>
                            )}{" "}
                            The windows differ by one month (EPE consumption by state
                            goes up to {ateMesUf}), and the comparison is one of scale.
                          </>,
                        )}
                      </p>
                    </>
                  )}

                  {ess.length > 0 && (
                    <>
                      <GraficoBarras
                        titulo={tx(
                          `Encargo de serviços do sistema por restrição de operação constrained-off, ${mesAno(ess[0].mes)} a ${mesAno(ess.at(-1)!.mes)}`,
                          `System services charge for operating restriction (constrained-off), ${mesAno(ess[0].mes)} to ${mesAno(ess.at(-1)!.mes)}`,
                        )}
                        dados={ess}
                        chaveCategoria="mes"
                        chaveRotulo="rotulo"
                        series={[{ id: "valor", rotulo: "Constrained-off (CCEE)", cor: "var(--serie-termica)" }]} // i18n: dado
                        unidade={tx("R$ milhões", "R$ million")}
                        casas={1}
                        altura={260}
                      />
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                        {tx(
                          <>
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
                            <Link href="/setor-eletrico/mercado/encargos" className={link}>
                              Mercado, encargos
                            </Link>
                            .
                          </>,
                          <>
                            When the cut gives the right to compensation, the amount becomes{" "}
                            <Termo slug="ess">ESS</Termo>, a charge allocated to
                            consumers.
                            {essUltimo?.valor != null &&
                              ` In ${mesAno(essUltimo.mes)}, the constrained-off portion assessed by the CCEE was R$ ${num(essUltimo.valor, 1)} million.`}
                            {ess12 &&
                              ` Total system services charges from ${mesAno(ess12.periodo.inicio)} to ${mesAno(ess12.periodo.fim)} were R$ ${num(ess12.valor_rs / 1e9, 2)} billion, including all portions.`}{" "}
                            The CCEE dataset does not split constrained-off by
                            source, and the amounts are as published. The detail of the
                            charges is in{" "}
                            <Link href="/setor-eletrico/mercado/encargos" className={link}>
                              Market, charges
                            </Link>
                            .
                          </>,
                        )}
                      </p>
                    </>
                  )}

                  <div
                    className="tabela-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={tx("Quem arca com o corte (tabela rolável)", "Who bears the cut (scrollable table)")}
                  >
                    <table className="w-full min-w-[40rem] border-collapse text-sm">
                      <caption className="mb-2 text-left font-medium text-carvao">
                        {tx(
                          "Quem arca com o corte, e o que este observatório mede de cada efeito",
                          "Who bears the cut, and what this observatory measures of each effect",
                        )}
                      </caption>
                      <thead>
                        <tr className="text-left text-mineral">
                          {tx(["Quem", "Efeito", "O que a página mede", "O que não mede"], ["Who", "Effect", "What the page measures", "What it does not measure"]).map((c) => (
                            <th key={c} scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="align-top leading-relaxed">
                        {quemArca.map((l) => (
                          <tr key={l[0]} className="border-b border-linha">
                            <th scope="row" className="px-2 py-2 text-left font-medium text-carvao">
                              {l[0]}
                            </th>
                            {l.slice(1).map((c, i) => (
                              <td key={i} className="px-2 py-2 text-carvao-muted">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {escala && <LabValorPerdido cortadaTwh={escala.cortadaTwh} periodo={periodoEscala} pldMenor={menorNe} pldNota={pldNota} />}
                  <LabReceita padroes={padroes} pld={menorNe} pldNota={pldNota} />
                </SecaoDoPainel>

                {/* 7. respostas */}
                <SecaoDoPainel
                  id="respostas"
                  titulo={tx("Respostas possíveis e o que cada uma resolve", "Possible responses and what each one solves")}
                  lead={tx(
                    "Nenhuma alavanca atua sobre as três razões ao mesmo tempo. Teste cada uma no simulador do dia.",
                    "No lever acts on all three reasons at once. Test each one in the day simulator.",
                  )}
                >
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Respostas ao corte (tabela rolável)", "Responses to the cut (scrollable table)")}>
                    <table className="w-full min-w-[40rem] border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-mineral">
                          {tx(["Resposta", "Atua sobre", "No simulador", "Limite"], ["Response", "Acts on", "In the simulator", "Limit"]).map((c) => (
                            <th key={c} scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="align-top leading-relaxed">
                        {respostas.map((l) => (
                          <tr key={l[0]} className="border-b border-linha">
                            <th scope="row" className="px-2 py-2 text-left font-medium text-carvao">
                              {l[0]}
                            </th>
                            {l.slice(1).map((c, i) => (
                              <td key={i} className="px-2 py-2 text-carvao-muted">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Para seguir: o painel{" "}
                        <Link href={`${rotaPainel("p023")}#p023`} className={link}>
                          Renováveis restringidas
                        </Link>{" "}
                        traz o mapa e a lista de usinas; o verbete{" "}
                        <Link href="/setor-eletrico/aprenda/constrained-off" className={link}>
                          Constrained-off
                        </Link>{" "}
                        explica a regra; e{" "}
                        <Link href="/setor-eletrico/transicao/riscos" className={link}>
                          Transição, riscos
                        </Link>{" "}
                        liga o corte ao risco de quem investe.
                      </>,
                      <>
                        To continue: the{" "}
                        <Link href={`${rotaPainel("p023")}#p023`} className={link}>
                          Restricted renewables
                        </Link>{" "}
                        panel has the map and the list of plants; the{" "}
                        <Link href="/setor-eletrico/aprenda/constrained-off" className={link}>
                          Constrained-off
                        </Link>{" "}
                        entry explains the rule; and{" "}
                        <Link href="/setor-eletrico/transicao/riscos" className={link}>
                          Transition, risks
                        </Link>{" "}
                        links the cut to investors&apos; risk.
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                {/* analisar */}
                <SecaoDoPainel
                  nivel="analisar"
                  id="descricoes"
                  titulo={tx(
                    "O que o ONS escreve ao limitar: as descrições mais frequentes e a origem do corte",
                    "What the ONS writes when it limits: the most frequent descriptions and the origin of the cut",
                  )}
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
                              {tx("Sem descrições publicadas para o último mês.", "No descriptions published for the latest month.")}
                            </p>,
                          ];
                        return [
                          f,
                          <GraficoBarras
                            key={f}
                            titulo={tx(
                              `${NOME_FONTE_RESTRICAO[f]}: energia não gerada pelas descrições mais frequentes, ${mesAno(d.mes)} (${num(d.n_descricoes, 0)} descrições no mês)`,
                              `${NOME_FONTE_RESTRICAO[f]}: energy not generated by the most frequent descriptions, ${mesAno(d.mes)} (${num(d.n_descricoes, 0)} descriptions in the month; descriptions in Portuguese, as the ONS publishes them)`,
                            )}
                            dados={d.itens.map((x, i) => ({
                              id: String(i),
                              descricao: x.descricao.replace(/\.$/, ""),
                              gwh: x.mwh === null ? null : x.mwh / 1e3,
                            }))}
                            chaveCategoria="id"
                            chaveRotulo="descricao"
                            series={[{ id: "gwh", rotulo: tx("Energia não gerada", "Energy not generated"), cor: COR_FONTE[f] }]}
                            unidade="GWh"
                            casas={1}
                            orientacao="horizontal"
                            rotulosValor
                            rotulosSaoNomes
                          />,
                        ];
                      }),
                    )}
                  />
                  <TabelaDados
                    titulo={tx(`Origem do corte por razão, ${periodo12}`, `Origin of the cut by reason, ${periodo12}`)}
                    colunas={tx(["Fonte", "Razão", "Origem", "GWh"], ["Source", "Reason", "Origin", "GWh"])}
                    linhas={fontes.flatMap((f) =>
                      (restricoes[f]!.ultimos_12m?.por_razao ?? []).flatMap((z) =>
                        Object.entries(z.origens_mwh)
                          .filter(([, v]) => (v ?? 0) > 0)
                          .map(([o, v]) => [NOME_FONTE_RESTRICAO[f], CURTO_RAZAO[z.razao], NOME_ORIGEM[o] ?? o, v === null ? null : v / 1e3]),
                      ),
                    )}
                    casas={[null, null, null, 0]}
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      "Local: o limite está perto da usina. Sistêmica: o limite é do sistema como um todo ou de uma região.",
                      "Local: the limit is near the plant. Systemic: the limit belongs to the system as a whole or to a region.",
                    )}
                  </p>
                </SecaoDoPainel>

                {/* auditar */}
                <SecaoDoPainel
                  nivel="auditar"
                  id="regras-curtailment"
                  titulo={tx("Regras, razões oficiais e o que os laboratórios deixam de fora", "Rules, official reasons and what the labs leave out")}
                >
                  <GeracaoRegras regras={[{ rotulo: ROTULO_REGRA.restricao, texto: g.regras.restricao }]} />
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {g.razoes.map((z) => (
                      <li key={z.id}>
                        <span className="text-carvao">{CURTO_RAZAO[z.id]}</span>
                        : {rotuloGoldNo(rotulosRazao[z.id], idioma, "geracao-razao-rotulo")}.
                      </li>
                    ))}
                  </ul>
                  <GeracaoFrases
                    itens={[
                      ...(g.proveniencia.restricao_eolica?.limitacoes ?? []),
                      ...(g.proveniencia.restricao_solar?.limitacoes ?? []).filter((x) => !(g.proveniencia.restricao_eolica?.limitacoes ?? []).includes(x)),
                    ]}
                    daFonte
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
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
                          {ateMesUf}
                          .
                        </li>
                      </>,
                      <>
                        <li>Half hour: applies the published rule (reference minus verified, only with an ONS limitation) to one plant; it does not estimate the reference.</li>
                        <li>
                          One day in the system: curve shapes from the reference day; three rules in order (electrical, energy, reliability) and a battery with an efficiency of 85%. It is not
                          ONS dispatch or the official rule for classifying the reasons.
                        </li>
                        <li>
                          The generator&apos;s side: possible energy = capacity × capacity factor × {num(8760, 0)} h; no compensation, physical guarantee, availability contracts or taxes.
                        </li>
                        <li>Value of the energy not generated: published quantity × chosen price; it is not a cost to any agent.</li>
                        <li>
                          Scale comparisons: energy not generated (ONS, estimate) against grid consumption (EPE). National consumption is used only when the 12-month window matches;
                          consumption by state goes up to {ateMesUf}.
                        </li>
                      </>,
                    )}
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
