"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import Link from "@/components/i18n/LinkIdioma";
import { RedeEscolha, RedeLista } from "@/components/energia/RedeControles";
import { RedeEsquemaFluxos, type FluxoEsquema } from "@/components/energia/RedeEsquemaFluxos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { idiomaEnergia, porIdioma } from "@/lib/energia/idioma";
import {
  COR_PAR,
  COR_SM,
  DO_SM,
  FRONTEIRAS,
  LIMIAR_NULO_MWMED,
  LIMIAR_PRECOS_RS_MWH,
  PAISES_SUL,
  PONTAS,
  colunasDiarioFronteira,
  colunasFronteirasDia,
  colunasHora,
  colunasJanela,
  colunasMensalFronteira,
  colunasResumo30d,
  colunasSaldoFronteiras,
  colunasSubsistemasDia,
  curtoFronteira,
  diaEscolhido,
  diasDaJanela,
  entreFronteira,
  fronteiraDestaque,
  indiceHora,
  linhasDiarioFronteira,
  linhasFronteirasDia,
  linhasHora,
  linhasMensalFronteira,
  linhasResumo30d,
  linhasSaldoDiario,
  linhasSaldoMensal,
  linhasSubsistemasDia,
  nomeFronteira,
  nomeSm,
  paraTabela,
  respostaCirculacao,
  respostaDia,
  respostaHora,
  respostaSubsistemasDia,
  rotaPainel,
  sentidoNegativo,
  sentidoPositivo,
  serieJanela,
  textoPrecos30d,
  vereditoCirculacao,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { CirculacaoRede, FronteiraRede, JanelaHorariaRede } from "@/lib/energia/tipos-rede";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";

/**
 * P028, circulação de energia. O recorte fica na URL: escala (?esc=dia|hora), dia
 * (?dia=), hora (?hora=AAAA-MM-DDTHH:MM), fronteira escolhida (?fr=), fronteiras
 * comparadas (?frs=, até quatro) e intervalo do histórico mensal (?de=, ?ate=); busca,
 * ordem, filtros e página de cada tabela também (prefixos fd, fh, d30, jh, sub, r30,
 * m.t). Escolher uma fronteira no esquema, na lista do celular ou na tabela seleciona a
 * mesma linha nas três e muda o detalhe e o histórico (seleção sincronizada, seção 7.3).
 *
 * A escala diária usa a gold (30 dias); a horária carrega sob demanda o JSON da janela
 * de 7 dias (contrato, seção 5.1), com fluxo, programa, exterior e PLD na mesma hora.
 * O PLD só aparece na escala horária: comparar preço e fluxo exige a mesma hora.
 */
const ESCALAS = ["dia", "hora"] as const; // i18n: dado
const ESQUEMA = {
  esc: campo(tiposUrl.opcao(ESCALAS), "dia"), // i18n: dado
  dia: campo(tiposUrl.data(), ""),
  hora: campo(tiposUrl.texto({ max: 16 }), ""),
  fr: campo(tiposUrl.opcao(["", ...FRONTEIRAS]), ""),
  frs: campo(tiposUrl.lista(tiposUrl.opcao(FRONTEIRAS), { max: LIMITE_COMPARACAO }), [...FRONTEIRAS]),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

const opcoesEscala = (idioma: Idioma) => [
  {
    id: "dia" as const, // i18n: dado
    rotulo: porIdioma(idioma, { pt: "Dia", en: "Day" }),
    detalhe: porIdioma(idioma, { pt: "Energia de cada dia, últimos 30 dias", en: "Energy of each day, last 30 days" }),
  },
  {
    id: "hora" as const,
    rotulo: porIdioma(idioma, { pt: "Hora", en: "Hour" }),
    detalhe: porIdioma(idioma, { pt: "Fluxo, programa e PLD na mesma hora, últimos 7 dias", en: "Flow, schedule and PLD in the same hour, last 7 days" }),
  },
];

/** Mensagens de erro do download da janela horária, no idioma da página (lidas dentro do efeito, sem depender do componente). */
const erroServidor = (status: number) => porIdioma(idiomaEnergia(), { pt: `o servidor respondeu ${status}`, en: `the server responded ${status}` });
const erroSemHoras = () => porIdioma(idiomaEnergia(), { pt: "arquivo sem horas publicadas", en: "file without published hours" });

type EstadoJanela = { estado: "ocioso" | "carregando" | "pronto" | "erro"; dado?: JanelaHorariaRede; erro?: string };

export function RedeCirculacao({
  circulacao,
  fonte,
  versao,
  notas,
  aposPrincipal,
  escondida,
}: {
  circulacao: Pick<CirculacaoRede, "diario" | "resumo_30d" | "mensal" | "subsistemas_diario" | "janela_horaria">;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e das tabelas. */
  notas?: ReactNode;
  /** Conteúdo depois das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
  /** Fichas "Comprove este número" da energia escondida pelo saldo em 30 dias (montadas no servidor), na seção dos dois sentidos. */
  escondida?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, horaLocal, mesAno, num, plural, reais } = formatos(idioma);
  const mw = tx("MWmed", "MWavg");
  const c = circulacao;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const [janela, setJanela] = useState<EstadoJanela>({ estado: "ocioso" });
  const escala = v.esc;

  // a janela horária só é baixada quando a escala horária é pedida. O efeito não depende do próprio estado de carregamento: se
  // dependesse, mudar o estado para "carregando" encerraria o efeito que acabou de começar, e o resultado do download seria descartado
  // (a escala horária ficaria em "carregando" para sempre). "Tentar de novo" muda `tentativa` e refaz o download.
  const baixada = useRef(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (escala !== "hora" || baixada.current) return;
    let vivo = true;
    setJanela({ estado: "carregando" });
    fetch(c.janela_horaria.url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(erroServidor(r.status)))))
      .then((j: JanelaHorariaRede & { motivo?: string }) => {
        if (!j?.disponivel || !Array.isArray(j.horas) || !j.horas.length) throw new Error(j?.motivo ?? erroSemHoras());
        if (vivo) {
          baixada.current = true;
          setJanela({ estado: "pronto", dado: j });
        }
      })
      .catch((e: Error) => vivo && setJanela({ estado: "erro", erro: e.message }));
    return () => {
      vivo = false;
    };
  }, [escala, c.janela_horaria.url, tentativa]);

  const fr = (v.fr || null) as FronteiraRede | null;
  const frDetalhe = fr ?? fronteiraDestaque(c.resumo_30d);
  const escolhidas = v.frs as FronteiraRede[];
  const selecionar = (id: string | null) => definir({ fr: (id && (FRONTEIRAS as readonly string[]).includes(id) ? id : "") as FronteiraRede | "" });
  const semDado = tx("sem dado", "no data");

  // escala diária
  const dia = diaEscolhido(c.diario.dias, v.dia);
  const linhasDia = useMemo(() => linhasFronteirasDia(c, dia, idioma), [c, dia, idioma]);
  const fluxosDia: FluxoEsquema[] = linhasDia.map((l) => {
    const trocas = l.reversoes ? tx(plural(l.reversoes, "troca", "trocas"), plural(l.reversoes, "change", "changes")) : "";
    return {
      par: l.id,
      valor: l.liquido_mwh,
      rotuloValor: l.liquido_mwh === null ? semDado : `${num(Math.abs(l.liquido_mwh), 0)} MWh`,
      // o saldo nunca aparece sozinho: logo abaixo, o que passou no sentido contrário e as trocas de sentido
      linhas:
        l.liquido_mwh === null
          ? undefined
          : [
              tx(`contrário: ${num(l.contra_saldo_mwh ?? 0, 0)} MWh`, `opposite: ${num(l.contra_saldo_mwh ?? 0, 0)} MWh`),
              ...(l.reversoes ? [tx(`${trocas} de sentido`, `${trocas} of direction`)] : []),
            ],
      detalhe:
        l.liquido_mwh === null
          ? undefined
          : `${
              l.contra_saldo_mwh
                ? tx(`${num(l.contra_saldo_mwh, 0)} MWh no sentido contrário`, `${num(l.contra_saldo_mwh, 0)} MWh in the opposite direction`)
                : tx("fluxo num só sentido", "flow in one direction only")
            }${l.reversoes ? tx(`; ${trocas} de sentido entre horas seguidas`, `; ${trocas} of direction between consecutive hours`) : ""}`,
    };
  });

  // escala horária (sob demanda)
  const j = janela.dado;
  const iHora = j ? indiceHora(j, v.hora) : -1;
  const horaAtual = j && iHora >= 0 ? j.horas[iHora] : "";
  const linhasH = useMemo(() => (j && iHora >= 0 ? linhasHora(j, iHora, idioma) : []), [j, iHora, idioma]);
  const fluxosHora: FluxoEsquema[] = linhasH.map((l) => {
    const oposto = l.fluxo_mwmed !== null && l.fluxo_mwmed !== 0 && l.programado_mwmed !== null && l.programado_mwmed !== 0 && Math.sign(l.fluxo_mwmed) !== Math.sign(l.programado_mwmed);
    const semPrograma = tx("sem programa publicado", "no schedule published");
    return {
      par: l.id,
      valor: l.fluxo_mwmed,
      rotuloValor: l.fluxo_mwmed === null ? semDado : `${num(Math.abs(l.fluxo_mwmed), 0)} ${mw}`,
      linhas:
        l.programado_mwmed === null
          ? [semPrograma]
          : [
              tx(`programado: ${num(Math.abs(l.programado_mwmed), 0)} MWmed`, `scheduled: ${num(Math.abs(l.programado_mwmed), 0)} MWavg`),
              ...(oposto ? [tx("sentido oposto ao programa", "opposite to the schedule")] : []),
            ],
      detalhe:
        l.programado_mwmed === null
          ? semPrograma
          : `${tx(`programado ${num(Math.abs(l.programado_mwmed), 0)} MWmed`, `scheduled ${num(Math.abs(l.programado_mwmed), 0)} MWavg`)}${
              l.programado_mwmed === 0 ? "" : ` ${l.programado_mwmed > 0 ? sentidoPositivo(l.id, idioma) : sentidoNegativo(l.id, idioma)}`
            }`,
    };
  });
  const exteriorHora = j && iHora >= 0 ? Object.fromEntries(PAISES_SUL.map((p) => [p, j.exterior[p]?.[iHora] ?? null])) : undefined;
  const serieH = useMemo(() => (j ? serieJanela(j, frDetalhe) : []), [j, frDetalhe]);
  const diasJanela = j ? diasDaJanela(j) : [];
  const diaHora = horaAtual.slice(0, 10);
  const horasDoDia = j ? j.horas.filter((h) => h.startsWith(diaHora)) : [];

  // histórico
  const diario = useMemo(() => linhasDiarioFronteira(c, frDetalhe), [c, frDetalhe]);
  const saldoDiario = useMemo(() => linhasSaldoDiario(c, escolhidas), [c, escolhidas]);
  const saldoMensal = useMemo(() => linhasSaldoMensal(c, escolhidas), [c, escolhidas]);
  const mensal = useMemo(() => linhasMensalFronteira(c, frDetalhe, idioma), [c, frDetalhe, idioma]);
  const resumo = useMemo(() => linhasResumo30d(c.resumo_30d, idioma), [c.resumo_30d, idioma]);
  const diaSub = escala === "hora" && diaHora ? diaHora : dia;
  const subsistemas = useMemo(() => linhasSubsistemasDia(c, diaSub, idioma), [c, diaSub, idioma]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const [a, b] = PONTAS[frDetalhe];
  const ultimoMes = mensal[mensal.length - 1];
  const resumoDias = c.resumo_30d[0]?.dias ?? 0;
  const para = tx("para", "to");

  const paragrafoEscondida = tx(
    `${resumoDias ? `Em ${plural(resumoDias, "dia", "dias")}` : "Na janela"}, a energia pode passar nos dois sentidos de uma fronteira, e o saldo mostra só a diferença entre eles. A energia escondida pelo saldo é o menor dos dois sentidos; zero quer dizer que o fluxo foi sempre no mesmo sentido.`,
    `${resumoDias ? `Over ${plural(resumoDias, "day", "days")}` : "In the window"}, energy can flow in both directions across a boundary, and the net flow shows only the difference between them. The energy hidden by the net flow is the smaller of the two directions; zero means the flow always went the same way.`,
  );
  const respostaDoRecorte =
    escala === "dia"
      ? respostaDia(linhasDia, fr, idioma)
      : janela.estado === "pronto" && linhasH.length
        ? respostaHora(linhasH, frDetalhe, exteriorHora, idioma)
        : janela.estado === "erro"
          ? tx(`A janela horária não carregou (${janela.erro}). A escala diária continua disponível.`, `The hourly window did not load (${janela.erro}). The daily scale is still available.`)
          : tx("Carregando a janela horária (fluxo, programa e PLD na mesma hora)…", "Loading the hourly window (flow, schedule and PLD in the same hour)…");

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p028" veredito={vereditoCirculacao(c.resumo_30d, idioma)}>
          {respostaCirculacao(c.resumo_30d, idioma)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <RedeEscolha legenda={tx("Escala", "Scale")} opcoes={opcoesEscala(idioma)} valor={escala} onEscolher={(x) => definir({ esc: x })} />
          {escala === "dia" ? (
            <RedeLista
              rotulo={tx("Dia", "Day")}
              opcoes={[...c.diario.dias].reverse().map((d) => ({ id: d, rotulo: dataBR(d) }))}
              valor={dia}
              onEscolher={(x) => definir({ dia: x })}
            />
          ) : j ? (
            <>
              <RedeLista
                rotulo={tx("Dia da janela", "Day of the window")}
                opcoes={[...diasJanela].reverse().map((d) => ({ id: d, rotulo: dataBR(d) }))}
                valor={diaHora}
                onEscolher={(d) => {
                  // mantém a hora do dia ao trocar de dia, quando ela existe no novo dia
                  const hh = horaAtual.slice(10);
                  const alvo = j.horas.includes(`${d}${hh}`) ? `${d}${hh}` : (j.horas.filter((h) => h.startsWith(d)).at(-1) ?? "");
                  definir({ hora: alvo });
                }}
              />
              <RedeLista
                rotulo={tx("Hora", "Hour")}
                opcoes={horasDoDia.map((h) => ({ id: h, rotulo: tx(`${h.slice(11, 13)}h`, `${h.slice(11, 13)}:00`) }))}
                valor={horaAtual}
                onEscolher={(h) => definir({ hora: h })}
              />
            </>
          ) : null}
          {fr && (
            <button
              type="button"
              onClick={() => selecionar(null)}
              className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao-muted hover:border-energia hover:text-carvao"
            >
              {tx(`Limpar a fronteira escolhida (${curtoFronteira(fr, "pt")})`, `Clear the chosen boundary (${curtoFronteira(fr, "en")})`)}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite" data-resposta="p028-recorte">
            {respostaDoRecorte}
          </p>
          {escala === "dia" ? (
            <RedeEsquemaFluxos
              titulo={tx("Saldo de cada fronteira no dia", "Net flow of each boundary on the day")}
              periodo={dataBR(dia)}
              unidade="MWh"
              fluxos={fluxosDia}
              selecionado={fr}
              onSelecionar={selecionar}
            />
          ) : janela.estado === "pronto" && j ? (
            <RedeEsquemaFluxos
              titulo={tx("Fluxo de cada fronteira na hora, com o PLD da mesma hora", "Flow of each boundary in the hour, with the PLD of the same hour")}
              periodo={horaLocal(horaAtual)}
              unidade={mw}
              fluxos={fluxosHora}
              exterior={PAISES_SUL.map((p) => {
                const x = exteriorHora?.[p] ?? null;
                return { pais: p, valor: x, rotuloValor: x === null ? semDado : `${num(Math.abs(x), 0)} ${mw}` };
              })}
              precos={Object.fromEntries((["SE", "S", "NE", "N"] as const).map((sm) => [sm, j.pld[sm]?.[iHora] ?? null]))}
              rotuloPrecos={tx("PLD da mesma hora", "PLD of the same hour")}
              selecionado={fr}
              onSelecionar={selecionar}
            />
          ) : (
            <div role="status" className="border border-dashed border-linha p-6 text-sm text-carvao-muted">
              {janela.estado === "erro" ? (
                <>
                  {tx(`A janela horária não carregou (${janela.erro}).`, `The hourly window did not load (${janela.erro}).`)}{" "}
                  <button type="button" onClick={() => setTentativa((t) => t + 1)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                    {tx("Tentar de novo", "Try again")}
                  </button>
                </>
              ) : (
                tx("Carregando a janela horária…", "Loading the hourly window…")
              )}
            </div>
          )}
          {escala === "dia" ? (
            <TabelaInterativa
              titulo={tx(`Tabela equivalente: fronteiras em ${dataBR(dia)}`, `Equivalent table: boundaries on ${dataBR(dia)}`)}
              colunas={colunasFronteirasDia(idioma)}
              linhas={paraTabela(linhasDia)}
              chaveLinha="id"
              colunaRotulo="fronteira"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-fronteiras-${dia}`}
              chaveUrl="fd"
              selecionado={fr}
              onSelecionar={selecionar}
              nota={tx(
                `Horas com PLDs diferentes: diferença acima de ${reais(LIMIAR_PRECOS_RS_MWH)}/MWh entre as duas pontas na mesma hora do fluxo. Trocas de sentido contam horas seguidas com fluxo acima de ${num(LIMIAR_NULO_MWMED, 0)} MWmed em módulo.`,
                `Hours with different PLDs: a difference above ${reais(LIMIAR_PRECOS_RS_MWH)}/MWh between the two ends in the same hour as the flow. Changes of direction count consecutive hours with flow above ${num(LIMIAR_NULO_MWMED, 0)} MWavg in absolute value.`,
              )}
            />
          ) : (
            j && (
              <TabelaInterativa
                titulo={tx(`Tabela equivalente: fronteiras em ${horaLocal(horaAtual)}`, `Equivalent table: boundaries at ${horaLocal(horaAtual)}`)}
                colunas={colunasHora(idioma)}
                linhas={paraTabela(linhasH)}
                chaveLinha="id"
                colunaRotulo="fronteira"
                fonte={tx(`${fonte}; CCEE, PLD horário`, `${fonte}; CCEE, hourly PLD`)}
                versao={versao}
                nomeArquivo={`rede-fronteiras-${horaAtual.replace(":", "")}`}
                chaveUrl="fh"
                selecionado={fr}
                onSelecionar={selecionar}
                nota={tx(
                  "Primeira e segunda região na ordem do nome da fronteira (Norte → Nordeste: Norte e Nordeste). Sinal positivo no sentido do nome.",
                  "First and second region in the order of the boundary name (North → Northeast: North and Northeast). Positive sign in the direction of the name.",
                )}
              />
            )
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {escala === "dia" ? (
            <>
              <GraficoLinhas
                titulo={tx(`Energia em cada sentido ${entreFronteira(frDetalhe, "pt")}, por dia`, `Energy in each direction ${entreFronteira(frDetalhe, "en")}, by day`)}
                dados={diario}
                chaveX="d"
                formatoX="data"
                series={[
                  { id: "canonico_mwh", rotulo: `${nomeSm(a, idioma)} ${para} ${nomeSm(b, idioma)}`, sigla: `${a}→${b}`, cor: COR_PAR[frDetalhe] },
                  { id: "inverso_mwh", rotulo: `${nomeSm(b, idioma)} ${para} ${nomeSm(a, idioma)}`, sigla: `${b}→${a}`, cor: "var(--serie-referencia)", tracejada: true },
                  {
                    id: "liquido_mwh",
                    rotulo: tx("Saldo (positivo no sentido da fronteira)", "Net flow (positive in the boundary direction)"),
                    sigla: tx("saldo", "net"),
                    cor: "var(--cor-carvao)",
                    espessura: 1.5,
                  },
                ]}
                unidade="MWh"
                casas={0}
                zeroNoEixo
                legendaInterativa
              />
              <p className="text-sm text-carvao-muted">
                {fr
                  ? tx("Fronteira escolhida no esquema ou na tabela.", "Boundary chosen in the schematic or in the table.")
                  : tx(
                      `Sem fronteira escolhida, o detalhe mostra a que teve mais energia escondida pelo saldo em 30 dias (${nomeFronteira(frDetalhe, "pt")}). Escolha outra no esquema ou na tabela.`,
                      `With no boundary chosen, the detail shows the one with the most energy hidden by the net flow over 30 days (${nomeFronteira(frDetalhe, "en")}). Choose another in the schematic or in the table.`,
                    )}
              </p>
              <TabelaInterativa
                titulo={tx(
                  `Tabela equivalente: ${nomeFronteira(frDetalhe, "pt")}, ${dataBR(c.diario.dias[0])} a ${dataBR(c.diario.dias.at(-1))}`,
                  `Equivalent table: ${nomeFronteira(frDetalhe, "en")}, ${dataBR(c.diario.dias[0])} to ${dataBR(c.diario.dias.at(-1))}`,
                )}
                colunas={colunasDiarioFronteira(idioma)}
                linhas={paraTabela(diario)}
                chaveLinha="id"
                colunaRotulo="d"
                fonte={fonte}
                versao={versao}
                nomeArquivo={`rede-diario-${frDetalhe}`}
                chaveUrl="d30"
                ordemInicial={{ coluna: "d", direcao: "desc" }}
              />
            </>
          ) : (
            j && (
              <>
                <CursorSincronizado>
                  <GraficoLinhas
                    titulo={tx(
                      `Fluxo verificado e programado ${entreFronteira(frDetalhe, "pt")}, hora a hora (positivo ${sentidoPositivo(frDetalhe, "pt")})`,
                      `Verified and scheduled flow ${entreFronteira(frDetalhe, "en")}, hour by hour (positive ${sentidoPositivo(frDetalhe, "en")})`,
                    )}
                    dados={serieH}
                    chaveX="h"
                    formatoX="hora"
                    series={[
                      { id: "fluxo", rotulo: tx("Verificado", "Verified"), cor: COR_PAR[frDetalhe] },
                      { id: "programado", rotulo: tx("Programado", "Scheduled"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade={mw}
                    casas={0}
                    zeroNoEixo
                    marcos={horaAtual ? [{ x: horaAtual, rotulo: tx(`hora escolhida: ${horaLocal(horaAtual)}`, `chosen hour: ${horaLocal(horaAtual)}`) }] : undefined}
                    legendaInterativa
                  />
                  <GraficoLinhas
                    titulo={tx(`PLD ${DO_SM[a]} e ${DO_SM[b]} nas mesmas horas`, `PLD in the ${nomeSm(a, "en")} and in the ${nomeSm(b, "en")} in the same hours`)}
                    dados={serieH}
                    chaveX="h"
                    formatoX="hora"
                    series={[
                      { id: "pld_de", rotulo: `PLD ${nomeSm(a, idioma)}`, cor: COR_SM[a] },
                      { id: "pld_para", rotulo: `PLD ${nomeSm(b, idioma)}`, cor: COR_SM[b], tracejada: true },
                    ]}
                    unidade="R$/MWh"
                    casas={2}
                    legendaInterativa
                  />
                </CursorSincronizado>
                <p className="text-sm text-carvao-muted">
                  {tx(
                    <>
                      Os dois gráficos têm o mesmo eixo de horas e a mesma cruz: o PLD de cada hora fica abaixo do fluxo da mesma hora. Preços iguais nas pontas aparecem como linhas
                      sobrepostas. Coincidência de preço e fluxo não demonstra fronteira no limite.
                    </>,
                    <>
                      The two charts share the same hour axis and the same crosshair: the PLD of each hour sits below the flow of the same hour. Equal prices at the ends appear as
                      overlapping lines. A coincidence of price and flow does not show a boundary at its limit.
                    </>,
                  )}
                </p>
                <TabelaInterativa
                  titulo={tx(
                    `Tabela equivalente: ${nomeFronteira(frDetalhe, "pt")}, ${dataBR(c.janela_horaria.inicio)} a ${dataBR(c.janela_horaria.fim)}`,
                    `Equivalent table: ${nomeFronteira(frDetalhe, "en")}, ${dataBR(c.janela_horaria.inicio)} to ${dataBR(c.janela_horaria.fim)}`,
                  )}
                  colunas={colunasJanela(frDetalhe, idioma)}
                  linhas={paraTabela(serieH)}
                  chaveLinha="id"
                  colunaRotulo="h"
                  fonte={tx(`${fonte}; CCEE, PLD horário`, `${fonte}; CCEE, hourly PLD`)}
                  versao={versao}
                  nomeArquivo={`rede-janela-horaria-${frDetalhe}`}
                  chaveUrl="jh"
                  selecionado={horaAtual || null}
                  onSelecionar={(h) => h && definir({ hora: h })}
                  ordemInicial={{ coluna: "h", direcao: "desc" }}
                />
              </>
            )
          )}
        </div>
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {escala === "dia"
              ? tx(
                  `${dataBR(dia)} (dia escolhido); resumo de ${dataBR(c.resumo_30d[0]?.inicio)} a ${dataBR(c.resumo_30d[0]?.fim)}`,
                  `${dataBR(dia)} (chosen day); summary from ${dataBR(c.resumo_30d[0]?.inicio)} to ${dataBR(c.resumo_30d[0]?.fim)}`,
                )
              : horaAtual
                ? tx(
                    `${horaLocal(horaAtual)} (hora de início, Brasília); janela de ${dataBR(c.janela_horaria.inicio)} a ${dataBR(c.janela_horaria.fim)}`,
                    `${horaLocal(horaAtual)} (start hour, Brasília); window from ${dataBR(c.janela_horaria.inicio)} to ${dataBR(c.janela_horaria.fim)}`,
                  )
                : tx(
                    `janela de ${dataBR(c.janela_horaria.inicio)} a ${dataBR(c.janela_horaria.fim)}`,
                    `window from ${dataBR(c.janela_horaria.inicio)} to ${dataBR(c.janela_horaria.fim)}`,
                  )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                As quatro fronteiras entre subsistemas publicadas pelo ONS{escala === "hora" ? "; Argentina e Uruguai ligados ao Sul" : ""}. O intercâmbio com outros países está em{" "}
                <a href={rotaPainel("p029")} className="text-energia-dark underline underline-offset-4">
                  Balanço e exterior
                </a>
                .
              </>,
              <>
                The four boundaries between subsystems published by ONS{escala === "hora" ? "; Argentina and Uruguay connected to the South" : ""}. The interchange with other
                countries is in{" "}
                <Link href={rotaPainel("p029")} className="text-energia-dark underline underline-offset-4">
                  Balance and exterior
                </Link>
                .
              </>,
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {escala === "dia"
              ? tx("MWh (energia do dia, soma das horas)", "MWh (energy of the day, sum of the hours)")
              : tx("MWmed (média da hora); PLD em R$/MWh", "MWavg (average of the hour); PLD in R$/MWh")}
          </dd>
        </div>
      </dl>

      {notas}

      {aposPrincipal}

      <SecaoDoPainel
        id="dois-sentidos"
        titulo={tx("O saldo esconde energia que passou no sentido contrário?", "Does the net flow hide energy that went the opposite way?")}
        lead={paragrafoEscondida}
      >
        <GraficoBarras
          titulo={tx(
            `Energia em cada sentido e saldo de cada fronteira, ${dataBR(c.resumo_30d[0]?.inicio)} a ${dataBR(c.resumo_30d[0]?.fim)}`,
            `Energy in each direction and net flow of each boundary, ${dataBR(c.resumo_30d[0]?.inicio)} to ${dataBR(c.resumo_30d[0]?.fim)}`,
          )}
          dados={paraTabela(resumo)}
          chaveCategoria="id"
          chaveRotulo="fronteira"
          series={[
            { id: "canonico_mwh", rotulo: tx("No sentido do nome da fronteira", "In the direction of the boundary name"), cor: "var(--cor-energia)" }, // i18n: dado
            { id: "inverso_mwh", rotulo: tx("No sentido contrário", "In the opposite direction"), cor: "var(--serie-referencia)" },
            { id: "liquido_mwh", rotulo: tx("Saldo (positivo no sentido do nome)", "Net flow (positive in the direction of the name)"), cor: "var(--cor-carvao)" },
          ]}
          unidade="MWh"
          casas={0}
          orientacao="horizontal"
          selecionado={fr}
          onSelecionar={selecionar}
        />
        <p className="max-w-prose2 text-sm text-carvao-muted">
          {tx(
            <>
              Cada fronteira tem um sentido do nome (Norte → Nordeste, por exemplo). A barra de saldo negativa é energia no sentido contrário ao do nome. Fronteira com fluxo
              nos dois sentidos tem as duas primeiras barras com valor, e o saldo é a diferença entre elas.
            </>,
            <>
              Each boundary has a direction given by its name (North → Northeast, for example). A negative net-flow bar is energy in the direction opposite to the name. A
              boundary with flow in both directions has values in the first two bars, and the net flow is the difference between them.
            </>,
          )}
        </p>
        {escondida}
      </SecaoDoPainel>

      <SecaoDoPainel id="subsistemas" titulo={tx(`Quem exportou e quem importou em ${dataBR(diaSub)}`, `Who exported and who imported on ${dataBR(diaSub)}`)}>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p028-subsistemas" data-resposta-depois="">
          {respostaSubsistemasDia(subsistemas, diaSub, idioma)}
        </p>
        <GraficoBarras
          titulo={tx(`Exportação e importação brutas de cada subsistema em ${dataBR(diaSub)}`, `Gross export and import of each subsystem on ${dataBR(diaSub)}`)}
          dados={paraTabela(subsistemas)}
          chaveCategoria="id"
          chaveRotulo="subsistema"
          series={[
            { id: "exportacao_bruta_mwh", rotulo: tx("Exportação bruta", "Gross export"), cor: "var(--cor-energia)" }, // i18n: dado
            { id: "importacao_bruta_mwh", rotulo: tx("Importação bruta", "Gross import"), cor: "var(--serie-referencia)" },
          ]}
          unidade="MWh"
          casas={0}
        />
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: subsistemas em ${dataBR(diaSub)}`, `Equivalent table: subsystems on ${dataBR(diaSub)}`)}
          colunas={colunasSubsistemasDia(idioma)}
          linhas={paraTabela(subsistemas)}
          chaveLinha="id"
          colunaRotulo="subsistema"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-subsistemas-${diaSub}`}
          chaveUrl="sub"
          nota={tx(
            "Bruto somado hora a hora pelas fronteiras de cada subsistema; no Sul, Argentina e Uruguai entram como fronteiras. Trânsito: horas em que o subsistema exporta por uma fronteira e importa por outra.",
            "Gross values summed hour by hour over the boundaries of each subsystem; in the South, Argentina and Uruguay count as boundaries. Transit: hours in which the subsystem exports through one boundary and imports through another.",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="saldos"
        titulo={tx(
          `Como o saldo das fronteiras variou: 30 dias${c.mensal.meses.length ? ` e meses desde ${mesAno(c.mensal.meses[0])}` : " (sem série mensal nesta publicação)"}`,
          `How the net flow of the boundaries changed: 30 days${c.mensal.meses.length ? ` and months since ${mesAno(c.mensal.meses[0])}` : " (no monthly series in this release)"}`,
        )}
      >
        <Comparador
          rotulo={tx(`Fronteiras nos gráficos (até ${LIMITE_COMPARACAO})`, `Boundaries in the charts (up to ${LIMITE_COMPARACAO})`)}
          entidades={FRONTEIRAS.map((p) => ({ id: p, rotulo: nomeFronteira(p, idioma), sinonimos: [curtoFronteira(p, idioma)] }))}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ frs: ids as FronteiraRede[] })}
          dicaBusca={tx("Buscar, por exemplo Norte, Sul, NE", "Search, for example North, South, NE")}
          vazio={tx("Nenhuma fronteira escolhida. Escolha até quatro para ver os saldos na mesma escala.", "No boundary chosen. Choose up to four to see the net flows on the same scale.")}
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <>
            <GraficoLinhas
              titulo={tx("Saldo diário das fronteiras escolhidas (positivo no sentido do nome)", "Daily net flow of the chosen boundaries (positive in the direction of the name)")}
              dados={saldoDiario}
              chaveX="d"
              formatoX="data"
              series={escolhidas.map((p) => ({ id: p, rotulo: nomeFronteira(p, idioma), sigla: curtoFronteira(p, idioma), cor: COR_PAR[p] }))}
              unidade="MWh"
              casas={0}
              zeroNoEixo
            />
            <TabelaInterativa
              titulo={tx("Tabela equivalente: saldo diário das fronteiras escolhidas", "Equivalent table: daily net flow of the chosen boundaries")}
              colunas={colunasSaldoFronteiras("d", escolhidas, idioma)}
              linhas={paraTabela(saldoDiario)}
              chaveLinha="id"
              colunaRotulo="d"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-saldo-diario-${escolhidas.join("-")}`}
              chaveUrl="sdia"
              ordemInicial={{ coluna: "d", direcao: "desc" }}
            />
            <GraficoLinhas
              titulo={tx("Saldo mensal das fronteiras escolhidas (positivo no sentido do nome)", "Monthly net flow of the chosen boundaries (positive in the direction of the name)")}
              dados={saldoMensal}
              chaveX="m"
              formatoX="mes"
              series={escolhidas.map((p) => ({ id: p, rotulo: nomeFronteira(p, idioma), sigla: curtoFronteira(p, idioma), cor: COR_PAR[p] }))}
              unidade="MWh"
              casas={0}
              zeroNoEixo
              zoom
              intervalo={intervalo}
              onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
            />
            <TabelaInterativa
              titulo={tx("Tabela equivalente: saldo mensal das fronteiras escolhidas", "Equivalent table: monthly net flow of the chosen boundaries")}
              colunas={colunasSaldoFronteiras("m", escolhidas, idioma)}
              linhas={paraTabela(saldoMensal)}
              chaveLinha="id"
              colunaRotulo="m"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-saldo-mensal-${escolhidas.join("-")}`}
              chaveUrl="smes"
              ordemInicial={{ coluna: "m", direcao: "desc" }}
              nota={tx(
                "Mês com menos horas que o calendário (último mês parcial ou dias sem as 24 horas) está marcado na tabela por fronteira abaixo.",
                "A month with fewer hours than the calendar (partial last month or days without all 24 hours) is marked in the boundary table below.",
              )}
            />
          </>
        )}
        <GraficoLinhas
          titulo={tx(`Energia em cada sentido ${entreFronteira(frDetalhe, "pt")}, por mês`, `Energy in each direction ${entreFronteira(frDetalhe, "en")}, by month`)}
          dados={mensal}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "canonico_mwh", rotulo: `${nomeSm(a, idioma)} ${para} ${nomeSm(b, idioma)}`, sigla: `${a}→${b}`, cor: COR_PAR[frDetalhe] },
            { id: "inverso_mwh", rotulo: `${nomeSm(b, idioma)} ${para} ${nomeSm(a, idioma)}`, sigla: `${b}→${a}`, cor: "var(--serie-referencia)", tracejada: true },
          ]}
          unidade="MWh"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        />
        {ultimoMes && ultimoMes.mes_completo !== tx("sim", "yes") && (
          <p className="text-sm text-carvao-muted">
            {tx(
              <>
                {mesAno(ultimoMes.m)} é parcial, com {ultimoMes.mes_completo.replace(/^não \((.*)\)$/, "$1")}: não compare o seu total com o de meses completos.
              </>,
              <>
                {mesAno(ultimoMes.m)} is partial, with {ultimoMes.mes_completo.replace(/^no \((.*)\)$/, "$1")}: do not compare its total with that of complete months.
              </>,
            )}
          </p>
        )}
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: ${nomeFronteira(frDetalhe, "pt")}, por mês`, `Equivalent table: ${nomeFronteira(frDetalhe, "en")}, by month`)}
          colunas={colunasMensalFronteira(idioma)}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-mensal-${frDetalhe}`}
          chaveUrl="m.t"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        nivel="analisar"
        titulo={tx("Os 30 dias por fronteira: energia em cada sentido e preço nas pontas", "The 30 days by boundary: energy in each direction and price at the ends")}
      >
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{textoPrecos30d(c.resumo_30d, idioma)}</p>
        <TabelaInterativa
          titulo={tx(
            `Resumo de ${dataBR(c.resumo_30d[0]?.inicio)} a ${dataBR(c.resumo_30d[0]?.fim)}, por fronteira`,
            `Summary from ${dataBR(c.resumo_30d[0]?.inicio)} to ${dataBR(c.resumo_30d[0]?.fim)}, by boundary`,
          )}
          colunas={colunasResumo30d(idioma)}
          linhas={paraTabela(resumo)}
          chaveLinha="id"
          colunaRotulo="fronteira"
          fonte={fonte}
          versao={versao}
          nomeArquivo="rede-resumo-30-dias"
          chaveUrl="r30"
          selecionado={fr}
          onSelecionar={selecionar}
          nota={tx(
            "Escondida pelo saldo de 30 dias: o menor dos dois sentidos na janela inteira. A soma dia a dia é menor ou igual: dias inteiros no sentido oposto entram na janela e não no dia.",
            "Hidden by the 30-day net flow: the smaller of the two directions over the whole window. The day-by-day sum is smaller or equal: whole days in the opposite direction count in the window and not in the day.",
          )}
        />
      </SecaoDoPainel>
    </div>
  );
}
