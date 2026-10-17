"use client";

import { useMemo, type ReactNode } from "react";
import { CargaEscolha, CargaLista } from "@/components/energia/CargaControles";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_COMPARACAO,
  COR_REGIAO,
  CURTO_REGIAO,
  DO_REGIAO,
  MEDIDAS_PERFIL,
  NOME_REGIAO,
  REGIOES,
  ROTULO_CLASSE,
  ROTULO_MEDIDA,
  SUBSISTEMAS,
  curtoRegiao,
  doRegiao,
  nomeRegiao,
  rotuloClasse,
  rotuloMedida,
  anosEvolucao,
  anosPadraoEvolucao,
  linhasEvolucao,
  linhasHoraPicoApi,
  linhasMmgdMensal,
  linhasPerfil,
  linhasRecente,
  listaTexto,
  matrizHoraPico,
  paraTabela,
  parentesesMmgd,
  perfilEscolhido,
  recorteEvolucao,
  respostaPerfil,
  respostaPerfilTipico,
  rotuloHora,
  textoInicioSeriesMmgd,
  textoQuebraCurva,
  vereditoPerfil,
  vereditoPerfilTipico,
  type MedidaPerfil,
} from "@/lib/energia/carga";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { porIdioma } from "@/lib/energia/idioma";
import { LIMITE_COMPARACAO, type ColunaTabela } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { ClasseDia, P026, Regime } from "@/lib/energia/tipos-carga";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";

/**
 * P026, MMGD e perfil horário. Duas famílias de carga do ONS convivem sem se
 * misturar: a carga verificada (API: carga global, MMGD estimada e carga líquida
 * de MMGD, que somam por identidade da própria fonte) e a curva de carga horária
 * (que já contém uma MMGD estimada não separada). Elas ficam em gráficos
 * separados, alinhados pelo cursor, e nenhuma conta soma ou subtrai uma da outra.
 *
 * Recorte na URL: região (?sm=), mês e tipo de dia do perfil (?mes=, ?cls=),
 * subsistema do perfil do último mês (?psm=), anos comparados (?anos=, até quatro),
 * medida da evolução (?med=), anos do mapa de calor (?hp=), intervalo do zoom da MMGD
 * mensal (?mde=, ?mate=) e busca, filtros, ordem e
 * página de cada tabela (prefixos hor, pf, mmgd, pfsm, evo, pic e rec). Datas de regime,
 * mês do perfil comparado e contagens dos títulos vêm da gold, nunca do código.
 */
const CLASSES: readonly ClasseDia[] = ["util", "sabado", "domingo_feriado"];

const seriesApi = (idioma: Idioma) => [
  { id: "global", rotulo: porIdioma(idioma, { pt: "Carga global", en: "Global load" }), sigla: "Global", cor: "var(--serie-referencia)", tracejada: true },
  { id: "liquida", rotulo: porIdioma(idioma, { pt: "Carga líquida de MMGD", en: "Load net of MMGD" }), sigla: porIdioma(idioma, { pt: "Líquida", en: "Net" }), cor: "var(--cor-energia)" }, // i18n: dado
  { id: "mmgd", rotulo: porIdioma(idioma, { pt: "MMGD estimada", en: "Estimated MMGD" }), sigla: "MMGD", cor: "var(--serie-solar)" },
];

const colunasRecente = (idioma: Idioma): ColunaTabela[] => {
  const mw = porIdioma(idioma, { pt: "MWmed", en: "MWavg" });
  return [
    { id: "h", rotulo: porIdioma(idioma, { pt: "Hora (início, horário de Brasília)", en: "Hour (start, Brasília time)" }), tipo: "texto" },
    ...REGIOES.map((sm): ColunaTabela => ({ id: sm, rotulo: porIdioma(idioma, { pt: `Curva, ${CURTO_REGIAO[sm]}`, en: `Curve, ${curtoRegiao(sm, "en")}` }), tipo: "numero", unidade: mw, casas: 0 })),
    { id: "global", rotulo: porIdioma(idioma, { pt: "Carga global SIN (API)", en: "SIN global load (API)" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "mmgd", rotulo: porIdioma(idioma, { pt: "MMGD estimada SIN (API)", en: "SIN estimated MMGD (API)" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "liquida", rotulo: porIdioma(idioma, { pt: "Carga líquida SIN (API)", en: "SIN net load (API)" }), tipo: "numero", unidade: mw, casas: 0 },
  ];
};
const colunasPerfil = (idioma: Idioma): ColunaTabela[] => {
  const mw = porIdioma(idioma, { pt: "MWmed", en: "MWavg" });
  return [
    { id: "hora", rotulo: porIdioma(idioma, { pt: "Hora (início)", en: "Hour (start)" }), tipo: "texto" },
    { id: "carga", rotulo: porIdioma(idioma, { pt: "Curva de carga", en: "Load curve" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "global", rotulo: porIdioma(idioma, { pt: "Carga global (API)", en: "Global load (API)" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "mmgd", rotulo: porIdioma(idioma, { pt: "MMGD estimada (API)", en: "Estimated MMGD (API)" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "liquida", rotulo: porIdioma(idioma, { pt: "Carga líquida (API)", en: "Net load (API)" }), tipo: "numero", unidade: mw, casas: 0 },
  ];
};
const colunasPicos = (idioma: Idioma): ColunaTabela[] => {
  const mw = porIdioma(idioma, { pt: "MWmed", en: "MWavg" });
  return [
    { id: "d", rotulo: porIdioma(idioma, { pt: "Dia", en: "Day" }), tipo: "data" },
    { id: "pico", rotulo: porIdioma(idioma, { pt: "Pico da curva", en: "Curve peak" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "hora", rotulo: porIdioma(idioma, { pt: "Hora do pico da curva", en: "Hour of the curve peak" }), tipo: "numero", casas: 0 },
    { id: "pico_liquida", rotulo: porIdioma(idioma, { pt: "Pico da carga líquida (API)", en: "Net load peak (API)" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "hora_liquida", rotulo: porIdioma(idioma, { pt: "Hora do pico da carga líquida", en: "Hour of the net load peak" }), tipo: "numero", casas: 0 },
  ];
};
const colunasMmgd = (idioma: Idioma): ColunaTabela[] => [
  { id: "mes", rotulo: porIdioma(idioma, { pt: "Mês", en: "Month" }), tipo: "texto" },
  { id: "parcial", rotulo: porIdioma(idioma, { pt: "Mês incompleto", en: "Incomplete month" }), tipo: "texto", categorica: true },
  ...REGIOES.map((sm): ColunaTabela => ({ id: sm, rotulo: porIdioma(idioma, { pt: `MMGD na carga global, ${CURTO_REGIAO[sm]}`, en: `MMGD in the global load, ${curtoRegiao(sm, "en")}` }), tipo: "percentual", casas: 2 })),
];
const colunasRecordes = (idioma: Idioma): ColunaTabela[] => [
  { id: "regiao", rotulo: porIdioma(idioma, { pt: "Região", en: "Region" }), tipo: "texto", categorica: true },
  { id: "ano", rotulo: porIdioma(idioma, { pt: "Ano", en: "Year" }), tipo: "texto" }, // i18n: dado
  { id: "dia", rotulo: porIdioma(idioma, { pt: "Dia", en: "Day" }), tipo: "data" }, // i18n: dado
  { id: "hora", rotulo: porIdioma(idioma, { pt: "Hora (início)", en: "Hour (start)" }), tipo: "numero", casas: 0 },
  { id: "pico", rotulo: porIdioma(idioma, { pt: "Maior carga horária", en: "Highest hourly load" }), tipo: "numero", unidade: porIdioma(idioma, { pt: "MWmed", en: "MWavg" }), casas: 0 },
];

const escalaPico = (idioma: Idioma) => ({
  tipo: "sequencial" as const,
  limites: [1, 30, 90, 180],
  cores: ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"],
  rotulos: porIdioma(idioma, {
    pt: ["nenhum dia", "1 a 29 dias", "30 a 89 dias", "90 a 179 dias", "180 dias ou mais"],
    en: ["no day", "1 to 29 days", "30 to 89 days", "90 to 179 days", "180 days or more"],
  }),
});
const horas = (idioma: Idioma) => Array.from({ length: 24 }, (_, h) => ({ id: String(h), rotulo: rotuloHora(h, idioma), curto: String(h) }));

const opcoesRegiao = (idioma: Idioma) => REGIOES.map((sm) => ({ id: sm, rotulo: sm === "SE" ? curtoRegiao("SE", idioma) : nomeRegiao(sm, idioma), detalhe: nomeRegiao(sm, idioma) }));
const opcoesSubsistema = (idioma: Idioma) =>
  SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: sm === "SE" ? curtoRegiao("SE", idioma) : nomeRegiao(sm, idioma), detalhe: nomeRegiao(sm, idioma) }));

export function CargaPerfil({
  p026,
  fonteCurva,
  fonteApi,
  versao,
  regimes,
  diferencaCurva,
  globalContraDiaria,
  notas,
  aposNotas,
}: {
  p026: Omit<P026, "compatibilidade" | "conceitos">;
  fonteCurva: string;
  fonteApi: string;
  versao: string;
  /** Regimes metodológicos do ONS publicados na gold (datas dos avisos de mudança da curva). */
  regimes: (Regime & { observado_nos_dados?: string })[];
  /** Onde a carga global da API se afasta da curva, por hora (textoDiferencaHoraria, no servidor). */
  diferencaCurva: string | null;
  /** Média do mês da carga global (carga verificada) contra a da Carga de Energia Diária da página Carga; vazio sem o mês nos dois produtos. */
  globalContraDiaria?: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Conteúdo depois das notas (o que é cada série de carga), antes das seções complementares. */
  aposNotas?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const mw = tx("MWmed", "MWavg");
  const p = p026 as P026;
  const anos = useMemo(() => anosEvolucao(p), [p]);
  const padraoAnos = useMemo(() => anosPadraoEvolucao(anos), [anos]);
  // o padrão depende da gold: o esquema é montado uma vez por instância (estável)
  const esquema = useMemo(
    () => ({
      sm: campo(tiposUrl.opcao(REGIOES), "SIN" as Regiao),
      mes: campo(tiposUrl.mes(), ""),
      cls: campo(tiposUrl.opcao(CLASSES), "util" as ClasseDia),
      psm: campo(tiposUrl.opcao(SUBSISTEMAS), "SE" as Regiao),
      anos: campo(tiposUrl.lista(tiposUrl.opcao(anos), { max: LIMITE_COMPARACAO }), padraoAnos),
      med: campo(tiposUrl.opcao(MEDIDAS_PERFIL), "liquida" as MedidaPerfil),
      hp: campo(tiposUrl.opcao(["recentes", "todos"] as const), "recentes"), // i18n: dado
      // intervalo do zoom da parcela mensal da MMGD
      mde: campo(tiposUrl.mes(), ""),
      mate: campo(tiposUrl.mes(), ""),
    }),
    [anos.join(","), padraoAnos.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [v, definir] = useEstadoUrl(esquema);
  const sm = v.sm as Regiao;
  const cls = v.cls as ClasseDia;
  const mesPadrao = p.meses_perfil[p.meses_perfil.length - 1] ?? "";
  const perfil = perfilEscolhido(p.perfil_sin_12m, v.mes || mesPadrao, cls);
  const linhasPf = useMemo(() => (perfil ? linhasPerfil(perfil, idioma) : []), [perfil, idioma]);
  const classesMes = Array.from(new Set(p.perfil_sin_12m.filter((x) => x.mes === (perfil?.mes ?? "")).map((x) => x.classe)));
  const perfilSm = perfilEscolhido(p.perfil_subsistemas, "", cls, v.psm as Regiao);
  const linhasPfSm = useMemo(() => (perfilSm ? linhasPerfil(perfilSm, idioma) : []), [perfilSm, idioma]);
  const recente = useMemo(() => paraTabela(linhasRecente(p), idioma), [p, idioma]);
  const mmgd = useMemo(() => linhasMmgdMensal(p), [p]);
  const mmgdTabela = useMemo(() => paraTabela(mmgd, idioma), [mmgd, idioma]);
  const inicioSeries = textoInicioSeriesMmgd(p, idioma);
  // o mapa de calor abre nos anos da carga verificada (o HTML do servidor fica leve: cada célula é um alvo
  // de foco com rótulo); "todos os anos" monta o histórico desde 2000 no navegador, com os dados já na página
  const desdeApi = p.hora_pico_api_sin_por_ano[0]?.ano;
  // as duas opções de anos só existem quando a série da região começa antes da carga verificada; se coincidem, a escolha não muda nada
  const primeiroAno = (p.hora_pico_por_ano[sm] ?? [])[0]?.ano;
  const escolheAnos = desdeApi !== undefined && primeiroAno !== undefined && primeiroAno !== desdeApi;
  const todosAnos = v.hp === "todos" || desdeApi === undefined;
  const matriz = useMemo(() => matrizHoraPico(p, sm, todosAnos ? undefined : desdeApi, idioma), [p, sm, todosAnos, desdeApi, idioma]);
  const HORAS = useMemo(() => horas(idioma), [idioma]);
  // no celular a grade rola na horizontal: ela abre na hora em que o pico mais caiu (a resposta), não nas horas da madrugada
  const horaDoPicoMaisFrequente = useMemo(() => {
    let melhor = -1;
    let hora: string | undefined;
    HORAS.forEach((h, j) => {
      const total = matriz.valores.reduce((a, linha) => a + (typeof linha[j] === "number" ? (linha[j] as number) : 0), 0);
      if (total > melhor) {
        melhor = total;
        hora = h.id;
      }
    });
    return hora;
  }, [matriz, HORAS]);
  const anoApi = p.hora_pico_api_sin_por_ano[p.hora_pico_api_sin_por_ano.length - 1];
  const horasApi = useMemo(() => (anoApi ? linhasHoraPicoApi(p, anoApi.ano, idioma) : []), [p, anoApi, idioma]);
  const anosEscolhidos = (v.anos as string[]).filter((a) => anos.includes(a));
  const medida = v.med as MedidaPerfil;
  const evolucao = useMemo(() => linhasEvolucao(p, anosEscolhidos, medida, idioma), [p, anosEscolhidos.join(","), medida, idioma]); // eslint-disable-line react-hooks/exhaustive-deps
  const picos = useMemo(() => p.picos_90d.map((x) => ({ ...x, id: x.d })), [p]);
  const recordes = useMemo(
    () => p.recordes_anuais.map((r) => ({ id: `${r.sm}:${r.ano}`, regiao: nomeRegiao(r.sm, idioma), ano: String(r.ano), dia: r.dia, hora: r.hora, pico: r.pico })),
    [p, idioma],
  );
  // aviso quando os perfis da curva comparados estão em regimes diferentes do ONS (2021 e 2023, pelas datas da gold)
  const mesesEscolhidos = anosEscolhidos.map((a) => p.perfil_evolucao.find((x) => x.mes.startsWith(a))?.mes).filter((m): m is string => !!m);
  const quebraCurva = medida === "carga" ? textoQuebraCurva(regimes, mesesEscolhidos, idioma) : null;
  const evol = recorteEvolucao(p, idioma);
  const diasRecentes = new Set(p.recente.map((r) => r.h.slice(0, 10))).size;
  // primeiro ano da série horária da curva (os subsistemas só têm hora a hora desde então; o SIN usa os agregados diários antes)
  const inicioHorario = p.hora_pico_por_ano.SE?.[0]?.ano;
  const SERIES_API = useMemo(() => seriesApi(idioma), [idioma]);
  const de = doRegiao(sm, idioma);
  const nDias = (n: number) => f.plural(n, tx("dia", "day"), tx("dias", "days"));

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p026" vivo veredito={vereditoPerfil(p, sm, idioma)}>
          {respostaPerfil(p, sm, idioma)}
        </RespostaCurta>
        <CargaEscolha legenda={tx("Região", "Region")} opcoes={opcoesRegiao(idioma)} valor={sm} onEscolher={(x) => definir({ sm: x })} />
      </div>

      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-resumo-cargas="">
        {tx(
          <>
            São dois produtos do ONS: a curva de carga horária, que já inclui a MMGD estimada sem separá-la, e a carga verificada, que traz a carga global, a MMGD estimada e a carga
            líquida de MMGD (a global menos a MMGD). As definições completas estão em &ldquo;Que carga é cada série?&rdquo;, mais abaixo.
          </>,
          <>
            These are two ONS products: the hourly load curve, which already includes the estimated MMGD without separating it, and the verified load, which shows the global load, the
            estimated MMGD and the load net of MMGD (the global load minus the MMGD). The full definitions are in &ldquo;Which load is each series?&rdquo;, further down.
          </>,
        )}
      </p>

      <div className="space-y-4">
        <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          {perfil ? (
            <RespostaCurta id="p026-perfil" vivo tamanho="sm" veredito={vereditoPerfilTipico(perfil, idioma)}>
              {respostaPerfilTipico(perfil, idioma)}
            </RespostaCurta>
          ) : (
            <p className="text-sm text-carvao-muted">{tx("Sem perfil típico publicado para este recorte.", "No typical profile published for this selection.")}</p>
          )}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <CargaLista
              rotulo={tx("Mês", "Month")}
              opcoes={[...p.meses_perfil].reverse().map((m) => ({ id: m, rotulo: f.mesAno(m) }))}
              valor={perfil?.mes ?? mesPadrao}
              onEscolher={(m) => definir({ mes: m })}
            />
            <CargaEscolha
              legenda={tx("Tipo de dia", "Type of day")}
              opcoes={CLASSES.filter((c) => classesMes.includes(c)).map((c) => ({ id: c, rotulo: rotuloClasse(c, idioma) }))}
              valor={perfil?.classe ?? cls}
              onEscolher={(c) => definir({ cls: c })}
            />
          </div>
        </div>
        {perfil && (
          <>
            <CursorSincronizado>
              <GraficoLinhas
                titulo={tx(
                  `Carga verificada do SIN, ${ROTULO_CLASSE[perfil.classe]} médio de ${f.mesAno(perfil.mes)} (${perfil.dias_api} dias)`,
                  `SIN verified load, average ${rotuloClasse(perfil.classe, "en")} of ${f.mesAno(perfil.mes)} (${perfil.dias_api} days)`,
                )}
                dados={linhasPf}
                chaveX="hora"
                formatoX="texto"
                series={SERIES_API}
                unidade={mw}
                casas={0}
                legendaInterativa
                altura={260}
                grupoCursor="perfil-sin"
              />
              <GraficoLinhas
                titulo={tx(
                  `Curva de carga do SIN, ${ROTULO_CLASSE[perfil.classe]} médio de ${f.mesAno(perfil.mes)} (${perfil.dias_curva} dias)`,
                  `SIN load curve, average ${rotuloClasse(perfil.classe, "en")} of ${f.mesAno(perfil.mes)} (${perfil.dias_curva} days)`,
                )}
                dados={linhasPf}
                chaveX="hora"
                formatoX="texto"
                series={[{ id: "carga", rotulo: tx("Curva de carga do SIN", "SIN load curve"), sigla: tx("Curva", "Curve"), cor: "var(--cor-energia-dark)" }]} // i18n: dado
                unidade={mw}
                casas={0}
                altura={220}
                grupoCursor="perfil-sin"
              />
            </CursorSincronizado>
            {globalContraDiaria && sm === "SIN" && <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">{globalContraDiaria}</p>}
            <TabelaInterativa
              titulo={tx("Tabela equivalente: perfil típico hora a hora", "Equivalent table: typical profile hour by hour")}
              colunas={colunasPerfil(idioma)}
              linhas={linhasPf}
              chaveLinha="id"
              colunaRotulo="hora"
              fonte={`${fonteApi}; ${fonteCurva}`}
              versao={perfil.mes}
              nomeArquivo={`carga-perfil-sin-${perfil.mes}-${perfil.classe}`}
              tamanhoPagina={25}
              chaveUrl="pf"
            />
          </>
        )}
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                Hora a hora até {f.dataBR(p.ultimo_dia)}; perfil típico de {f.mesAno(p.meses_perfil[0] ?? mesPadrao)} a {f.mesAno(mesPadrao)}; MMGD mensal desde{" "}
                {f.mesAno(mmgd[0]?.mes ?? mesPadrao)}
              </>,
              <>
                Hour by hour through {f.dataBR(p.ultimo_dia)}; typical profile from {f.mesAno(p.meses_perfil[0] ?? mesPadrao)} to {f.mesAno(mesPadrao)}; monthly MMGD since{" "}
                {f.mesAno(mmgd[0]?.mes ?? mesPadrao)}
              </>,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {sm === "SIN"
              ? "SIN"
              : tx(
                  `${NOME_REGIAO[sm]} na resposta, na curva horária e no mapa do pico; SIN na carga verificada hora a hora, no dia típico e nos picos diários`,
                  `${nomeRegiao(sm, "en")} in the answer, in the hourly curve and in the peak map; SIN in the hour-by-hour verified load, in the typical day and in the daily peaks`,
                )}
            {tx(
              "; curva de carga horária e carga verificada do ONS, sempre em gráficos separados",
              "; ONS hourly load curve and verified load, always in separate charts",
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx(
              "MWmed por hora local de início (potência média da hora; 1 MWmed durante uma hora equivale a 1 MWh); parcela da MMGD em % da carga global",
              "MWavg by local start hour (average power over the hour; 1 MWavg over one hour equals 1 MWh); MMGD share in % of the global load",
            )}
          </dd>
        </div>
      </dl>

      {notas}

      {aposNotas}

      <SecaoDoPainel
        id="pico"
        titulo={tx("Em que hora cai o pico do dia?", "At what hour does the daily peak fall?")}
        lead={tx(
          "Dias de cada ano em que o maior valor horário caiu em cada hora; a hora é a de início.",
          "Days of each year on which the highest hourly value fell in each hour; the hour is the start hour.",
        )}
      >
        {escolheAnos && desdeApi !== undefined && (
          <CargaEscolha
            legenda={tx("Anos no mapa", "Years on the map")}
            opcoes={[
              { id: "recentes", rotulo: tx(`Desde ${desdeApi}`, `Since ${desdeApi}`) },
              { id: "todos", rotulo: tx(`Todos, desde ${(p.hora_pico_por_ano[sm] ?? [])[0]?.ano ?? desdeApi}`, `All, since ${(p.hora_pico_por_ano[sm] ?? [])[0]?.ano ?? desdeApi}`) }, // i18n: dado
            ]}
            valor={todosAnos ? "todos" : "recentes"} // i18n: dado
            onEscolher={(x) => definir({ hp: x })}
          />
        )}
        <MapaCalor
          titulo={tx(`Dias com o pico da curva de carga ${DO_REGIAO[sm]} em cada hora, por ano`, `Days with the peak of the load curve ${doRegiao(sm, "en")} in each hour, by year`)}
          linhas={matriz.anos.map((a) => ({ id: a.id, rotulo: a.rotulo, curto: a.id }))}
          colunas={HORAS}
          nomeLinhas={tx("Ano", "Year")}
          nomeColunas={tx("Hora de início", "Start hour")}
          valores={matriz.valores}
          escala={escalaPico(idioma)}
          unidade={tx("dias", "days")}
          casas={0}
          passoRotuloColunas={3}
          colunaInicial={horaDoPicoMaisFrequente}
          periodo={tx(`${matriz.anos[0]?.id ?? ""} a ${f.dataBR(p.ultimo_dia_curva)}`, `${matriz.anos[0]?.id ?? ""} to ${f.dataBR(p.ultimo_dia_curva)}`)}
          nota={tx(
            `Desde a inclusão da MMGD na curva${parentesesMmgd(regimes, "pt")}, o pico da curva inclui MMGD estimada; o pico da carga líquida está abaixo, na carga verificada.`,
            `Since MMGD was included in the curve${parentesesMmgd(regimes, "en")}, the curve peak includes estimated MMGD; the net load peak is below, in the verified load.`,
          )}
        />
        {anoApi && (
          <>
            <GraficoBarras
              titulo={tx(
                `SIN em ${anoApi.ano} (${anoApi.dias} dias): hora do pico da carga líquida e da carga global (carga verificada)`,
                `SIN in ${anoApi.ano} (${anoApi.dias} days): peak hour of the net load and of the global load (verified load)`,
              )}
              dados={horasApi}
              chaveCategoria="id"
              chaveRotulo="hora"
              series={[
                { id: "liquida", rotulo: tx("Carga líquida de MMGD", "Load net of MMGD"), cor: "var(--cor-energia)" }, // i18n: dado
                { id: "global", rotulo: tx("Carga global", "Global load"), cor: "var(--serie-referencia)" },
              ]}
              unidade={tx("dias", "days")}
              casas={0}
            />
            {/* a tabela equivalente deste gráfico é a do próprio GraficoBarras (já no HTML, recolhida); as horas de pico por dia estão em carga_verificada_diaria.csv */}
          </>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel id="mmgd" titulo={tx("Quanto da carga global é MMGD, mês a mês?", "How much of the global load is MMGD, month by month?")}>
        <GraficoLinhas
          titulo={tx("MMGD estimada pelo ONS em % da carga global (razão de somas no mês)", "MMGD estimated by ONS in % of the global load (ratio of sums in the month)")}
          dados={mmgdTabela}
          chaveX="mes"
          formatoX="mes"
          series={REGIOES.map((r) => ({ id: r, rotulo: nomeRegiao(r, idioma), sigla: curtoRegiao(r, idioma), cor: COR_REGIAO[r] }))}
          unidade="%"
          casas={1}
          zeroNoEixo
          legendaInterativa
          zoom
          intervalo={v.mde && v.mate ? { inicio: v.mde, fim: v.mate } : null}
          onIntervalo={(i) => definir({ mde: i?.inicio ?? "", mate: i?.fim ?? "" })}
        />
        {inicioSeries && <p className="text-sm text-carvao-muted">{inicioSeries}</p>}
        <TabelaInterativa
          titulo={tx("Tabela equivalente: parcela mensal da MMGD por região", "Equivalent table: monthly MMGD share by region")}
          colunas={colunasMmgd(idioma)}
          linhas={mmgdTabela}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonteApi}
          versao={versao}
          nomeArquivo="carga-mmgd-mensal"
          chaveUrl="mmgd"
          ordemInicial={{ coluna: "mes", direcao: "desc" }}
          nota={tx(
            "Mês incompleto: a carga verificada ainda não tem todos os dias do mês (o mês corrente).",
            "Incomplete month: the verified load does not yet have every day of the month (the current month).",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="horas" titulo={tx(`E nos últimos ${nDias(diasRecentes)}, hora a hora?`, `And over the last ${nDias(diasRecentes)}, hour by hour?`)}>
        <CursorSincronizado>
          <GraficoLinhas
            titulo={tx("Carga verificada do SIN: carga global, carga líquida de MMGD e MMGD estimada", "SIN verified load: global load, load net of MMGD and estimated MMGD")}
            dados={recente}
            chaveX="h"
            formatoX="hora"
            series={SERIES_API}
            unidade={mw}
            casas={0}
            legendaInterativa
            altura={280}
          />
          <GraficoLinhas
            titulo={tx(`Curva de carga horária ${DO_REGIAO[sm]} (já inclui MMGD estimada, não separada)`, `Hourly load curve ${de} (already includes estimated MMGD, not separated)`)}
            dados={recente}
            chaveX="h"
            formatoX="hora"
            series={[{ id: sm, rotulo: nomeRegiao(sm, idioma), sigla: curtoRegiao(sm, idioma), cor: COR_REGIAO[sm] }]}
            unidade={mw}
            casas={0}
            altura={240}
          />
        </CursorSincronizado>
        <p className="text-sm text-carvao-muted">
          {tx(
            <>
              A carga verificada (API) é publicada por submercado; aqui está o SIN. A carga global da API e a curva são grandezas diferentes
              {diferencaCurva ? ` (${diferencaCurva})` : ""}: por isso ficam em gráficos separados e a MMGD nunca é subtraída da curva.
            </>,
            <>
              The verified load (API) is published by submarket; here it is the SIN. The API global load and the curve are different quantities
              {diferencaCurva ? ` (${diferencaCurva})` : ""}: that is why they are in separate charts and the MMGD is never subtracted from the curve.
            </>,
          )}
        </p>
        <TabelaInterativa
          titulo={tx("Tabela equivalente: as mesmas horas dos dois gráficos", "Equivalent table: the same hours as the two charts")}
          colunas={colunasRecente(idioma)}
          linhas={recente}
          chaveLinha="id"
          colunaRotulo="h"
          fonte={`${fonteApi}; ${fonteCurva}`}
          versao={versao}
          nomeArquivo="carga-ultimas-horas"
          chaveUrl="hor"
          ordemInicial={{ coluna: "h", direcao: "desc" }}
        />
      </SecaoDoPainel>

      <SecaoDoPainel nivel="analisar" titulo={tx("Perfil por subsistema no último mês completo", "Profile by subsystem in the last complete month")}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaEscolha legenda={tx("Subsistema", "Subsystem")} opcoes={opcoesSubsistema(idioma)} valor={v.psm as Regiao} onEscolher={(x) => definir({ psm: x })} />
        </div>
        {perfilSm ? (
          <>
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{respostaPerfilTipico(perfilSm, idioma)}</p>
            <GraficoLinhas
              titulo={tx(
                `${NOME_REGIAO[perfilSm.sm]}: carga verificada, ${ROTULO_CLASSE[perfilSm.classe]} médio de ${f.mesAno(perfilSm.mes)}`,
                `${nomeRegiao(perfilSm.sm, "en")}: verified load, average ${rotuloClasse(perfilSm.classe, "en")} of ${f.mesAno(perfilSm.mes)}`,
              )}
              dados={linhasPfSm}
              chaveX="hora"
              formatoX="texto"
              series={SERIES_API}
              unidade={mw}
              casas={0}
              legendaInterativa
              altura={260}
            />
            <TabelaInterativa
              titulo={tx("Tabela equivalente: perfil do subsistema", "Equivalent table: subsystem profile")}
              colunas={colunasPerfil(idioma)}
              linhas={linhasPfSm}
              chaveLinha="id"
              colunaRotulo="hora"
              fonte={`${fonteApi}; ${fonteCurva}`}
              versao={perfilSm.mes}
              nomeArquivo={`carga-perfil-${perfilSm.sm}-${perfilSm.mes}-${perfilSm.classe}`}
              chaveUrl="pfsm"
            />
          </>
        ) : (
          <p className="text-sm text-carvao-muted">{tx("Sem perfil publicado para este subsistema e tipo de dia.", "No profile published for this subsystem and type of day.")}</p>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel
        nivel="analisar"
        titulo={
          evol
            ? tx(`Como o ${evol.classe} de ${evol.mes} mudou desde ${evol.desde}`, `How the ${evol.classe} of ${evol.mes} changed since ${evol.desde}`)
            : tx("Como o perfil do mesmo mês mudou entre os anos", "How the profile of the same month changed across the years")
        }
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaLista rotulo={tx("Medida", "Measure")} opcoes={MEDIDAS_PERFIL.map((m) => ({ id: m, rotulo: rotuloMedida(m, idioma) }))} valor={medida} onEscolher={(m) => definir({ med: m })} />
        </div>
        <Comparador
          rotulo={tx(`Anos no gráfico (até ${LIMITE_COMPARACAO})`, `Years in the chart (up to ${LIMITE_COMPARACAO})`)}
          entidades={anos.map((a) => ({ id: a, rotulo: a }))}
          selecionadas={anosEscolhidos}
          onMudar={(ids) => definir({ anos: ids })}
          dicaBusca={
            anos.length
              ? tx(`Buscar, por exemplo ${listaTexto([anos[0], anos[anos.length - 1]], "pt")}`, `Search, for example ${listaTexto([anos[0], anos[anos.length - 1]], "en")}`)
              : ""
          }
          vazio={tx("Nenhum ano escolhido. Escolha até quatro para comparar o perfil na mesma escala.", "No year chosen. Choose up to four to compare the profile on the same scale.")}
        >
          {() => null}
        </Comparador>
        {quebraCurva && (
          <p role="note" className="border-l-2 border-aviso pl-3 text-sm text-carvao">
            {quebraCurva}
          </p>
        )}
        {anosEscolhidos.length > 0 && (
          <>
            <GraficoLinhas
              titulo={tx(
                `${ROTULO_MEDIDA[medida]}, ${evol ? `${evol.classe} médio de ${evol.mes}` : "perfil médio do mês"}`,
                `${rotuloMedida(medida, "en")}, ${evol ? `average ${evol.classe} of ${evol.mes}` : "average profile of the month"}`,
              )}
              dados={evolucao}
              chaveX="hora"
              formatoX="texto"
              series={anosEscolhidos.map((a, i) => ({ id: a, rotulo: a, cor: COR_COMPARACAO[i % COR_COMPARACAO.length] }))}
              unidade={mw}
              casas={0}
              altura={280}
            />
            <TabelaInterativa
              titulo={tx(`Tabela equivalente: perfil ${evol ? `de ${evol.mes} ` : ""}dos anos escolhidos`, `Equivalent table: ${evol ? `${evol.mes} ` : ""}profile of the chosen years`)}
              colunas={[
                { id: "hora", rotulo: tx("Hora (início)", "Hour (start)"), tipo: "texto" },
                ...anosEscolhidos.map((a): ColunaTabela => ({ id: a, rotulo: a, tipo: "numero", unidade: mw, casas: 0 })),
              ]}
              linhas={evolucao}
              chaveLinha="id"
              colunaRotulo="hora"
              fonte={medida === "carga" ? fonteCurva : fonteApi}
              versao={versao}
              nomeArquivo={`carga-perfil-evolucao-${medida}`}
              chaveUrl="evo"
            />
          </>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel nivel="analisar" titulo={tx(`Pico de cada dia nos últimos ${nDias(picos.length)} (SIN)`, `Peak of each day over the last ${nDias(picos.length)} (SIN)`)}>
        <CursorSincronizado>
          <GraficoLinhas
            titulo={tx("Pico horário diário da curva de carga do SIN", "Daily hourly peak of the SIN load curve")}
            dados={picos}
            chaveX="d"
            series={[{ id: "pico", rotulo: tx("Pico da curva", "Curve peak"), sigla: tx("Curva", "Curve"), cor: "var(--cor-energia-dark)" }]} // i18n: dado
            unidade={mw}
            casas={0}
            altura={220}
          />
          <GraficoLinhas
            titulo={tx("Pico horário diário da carga líquida de MMGD do SIN (carga verificada)", "Daily hourly peak of the SIN load net of MMGD (verified load)")}
            dados={picos}
            chaveX="d"
            series={[{ id: "pico_liquida", rotulo: tx("Pico da carga líquida", "Net load peak"), sigla: tx("Líquida", "Net"), cor: "var(--cor-energia)" }]} // i18n: dado
            unidade={mw}
            casas={0}
            altura={220}
          />
        </CursorSincronizado>
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: picos e horas dos últimos ${nDias(picos.length)}`, `Equivalent table: peaks and hours over the last ${nDias(picos.length)}`)}
          colunas={colunasPicos(idioma)}
          linhas={picos}
          chaveLinha="id"
          colunaRotulo="d"
          fonte={`${fonteCurva}; ${fonteApi}`}
          versao={versao}
          nomeArquivo="carga-picos-diarios"
          chaveUrl="pic"
          ordemInicial={{ coluna: "d", direcao: "desc" }}
        />
        <TabelaInterativa
          titulo={tx("Maior carga horária de cada ano, por região (curva de carga)", "Highest hourly load of each year, by region (load curve)")}
          colunas={colunasRecordes(idioma)}
          linhas={recordes}
          chaveLinha="id"
          colunaRotulo="ano" // i18n: dado
          fonte={fonteCurva}
          versao={versao}
          nomeArquivo="carga-recordes-anuais"
          chaveUrl="rec"
          ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
          nota={tx(
            `${inicioHorario ? `Antes de ${inicioHorario} a hora do pico vem dos agregados diários da curva (média, pico e hora por subsistema). ` : ""}Anos de regimes diferentes não são comparáveis em nível.`,
            `${inicioHorario ? `Before ${inicioHorario} the peak hour comes from the daily aggregates of the curve (average, peak and hour by subsystem). ` : ""}Years from different regimes are not comparable in level.`,
          )}
        />
      </SecaoDoPainel>
    </div>
  );
}
