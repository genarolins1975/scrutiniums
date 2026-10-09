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
import { dataBR, mesAno, plural } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO, type ColunaTabela } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { ClasseDia, P026, Regime } from "@/lib/energia/tipos-carga";

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

const SERIES_API = [
  { id: "global", rotulo: "Carga global", sigla: "Global", cor: "var(--serie-referencia)", tracejada: true },
  { id: "liquida", rotulo: "Carga líquida de MMGD", sigla: "Líquida", cor: "var(--cor-energia)" },
  { id: "mmgd", rotulo: "MMGD estimada", sigla: "MMGD", cor: "var(--serie-solar)" },
];

const COLUNAS_RECENTE: ColunaTabela[] = [
  { id: "h", rotulo: "Hora (início, horário de Brasília)", tipo: "texto" },
  ...REGIOES.map((sm): ColunaTabela => ({ id: sm, rotulo: `Curva, ${CURTO_REGIAO[sm]}`, tipo: "numero", unidade: "MWmed", casas: 0 })),
  { id: "global", rotulo: "Carga global SIN (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "mmgd", rotulo: "MMGD estimada SIN (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "liquida", rotulo: "Carga líquida SIN (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
];
const COLUNAS_PERFIL: ColunaTabela[] = [
  { id: "hora", rotulo: "Hora (início)", tipo: "texto" },
  { id: "carga", rotulo: "Curva de carga", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "global", rotulo: "Carga global (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "mmgd", rotulo: "MMGD estimada (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "liquida", rotulo: "Carga líquida (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
];
const COLUNAS_PICOS: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "pico", rotulo: "Pico da curva", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "hora", rotulo: "Hora do pico da curva", tipo: "numero", casas: 0 },
  { id: "pico_liquida", rotulo: "Pico da carga líquida (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "hora_liquida", rotulo: "Hora do pico da carga líquida", tipo: "numero", casas: 0 },
];
const COLUNAS_MMGD: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês", tipo: "texto" },
  { id: "parcial", rotulo: "Mês incompleto", tipo: "texto", categorica: true },
  ...REGIOES.map((sm): ColunaTabela => ({ id: sm, rotulo: `MMGD na carga global, ${CURTO_REGIAO[sm]}`, tipo: "percentual", casas: 2 })),
];
const COLUNAS_RECORDES: ColunaTabela[] = [
  { id: "regiao", rotulo: "Região", tipo: "texto", categorica: true },
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "dia", rotulo: "Dia", tipo: "data" },
  { id: "hora", rotulo: "Hora (início)", tipo: "numero", casas: 0 },
  { id: "pico", rotulo: "Maior carga horária", tipo: "numero", unidade: "MWmed", casas: 0 },
];

const ESCALA_PICO = {
  tipo: "sequencial" as const,
  limites: [1, 30, 90, 180],
  cores: ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"],
  rotulos: ["nenhum dia", "1 a 29 dias", "30 a 89 dias", "90 a 179 dias", "180 dias ou mais"],
};
const HORAS = Array.from({ length: 24 }, (_, h) => ({ id: String(h), rotulo: rotuloHora(h), curto: String(h) }));

const OPCOES_REGIAO = REGIOES.map((sm) => ({ id: sm, rotulo: sm === "SE" ? "SE/CO" : NOME_REGIAO[sm], detalhe: NOME_REGIAO[sm] }));
const OPCOES_SUBSISTEMA = SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: sm === "SE" ? "SE/CO" : NOME_REGIAO[sm], detalhe: NOME_REGIAO[sm] }));

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
      hp: campo(tiposUrl.opcao(["recentes", "todos"] as const), "recentes"),
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
  const linhasPf = useMemo(() => (perfil ? linhasPerfil(perfil) : []), [perfil]);
  const classesMes = Array.from(new Set(p.perfil_sin_12m.filter((x) => x.mes === (perfil?.mes ?? "")).map((x) => x.classe)));
  const perfilSm = perfilEscolhido(p.perfil_subsistemas, "", cls, v.psm as Regiao);
  const linhasPfSm = useMemo(() => (perfilSm ? linhasPerfil(perfilSm) : []), [perfilSm]);
  const recente = useMemo(() => paraTabela(linhasRecente(p)), [p]);
  const mmgd = useMemo(() => linhasMmgdMensal(p), [p]);
  const mmgdTabela = useMemo(() => paraTabela(mmgd), [mmgd]);
  const inicioSeries = textoInicioSeriesMmgd(p);
  // o mapa de calor abre nos anos da carga verificada (o HTML do servidor fica leve: cada célula é um alvo
  // de foco com rótulo); "todos os anos" monta o histórico desde 2000 no navegador, com os dados já na página
  const desdeApi = p.hora_pico_api_sin_por_ano[0]?.ano;
  // as duas opções de anos só existem quando a série da região começa antes da carga verificada; se coincidem, a escolha não muda nada
  const primeiroAno = (p.hora_pico_por_ano[sm] ?? [])[0]?.ano;
  const escolheAnos = desdeApi !== undefined && primeiroAno !== undefined && primeiroAno !== desdeApi;
  const todosAnos = v.hp === "todos" || desdeApi === undefined;
  const matriz = useMemo(() => matrizHoraPico(p, sm, todosAnos ? undefined : desdeApi), [p, sm, todosAnos, desdeApi]);
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
  }, [matriz]);
  const anoApi = p.hora_pico_api_sin_por_ano[p.hora_pico_api_sin_por_ano.length - 1];
  const horasApi = useMemo(() => (anoApi ? linhasHoraPicoApi(p, anoApi.ano) : []), [p, anoApi]);
  const anosEscolhidos = (v.anos as string[]).filter((a) => anos.includes(a));
  const medida = v.med as MedidaPerfil;
  const evolucao = useMemo(() => linhasEvolucao(p, anosEscolhidos, medida), [p, anosEscolhidos.join(","), medida]); // eslint-disable-line react-hooks/exhaustive-deps
  const picos = useMemo(() => p.picos_90d.map((x) => ({ ...x, id: x.d })), [p]);
  const recordes = useMemo(() => p.recordes_anuais.map((r) => ({ id: `${r.sm}:${r.ano}`, regiao: NOME_REGIAO[r.sm], ano: String(r.ano), dia: r.dia, hora: r.hora, pico: r.pico })), [p]);
  // aviso quando os perfis da curva comparados estão em regimes diferentes do ONS (2021 e 2023, pelas datas da gold)
  const mesesEscolhidos = anosEscolhidos.map((a) => p.perfil_evolucao.find((x) => x.mes.startsWith(a))?.mes).filter((m): m is string => !!m);
  const quebraCurva = medida === "carga" ? textoQuebraCurva(regimes, mesesEscolhidos) : null;
  const evol = recorteEvolucao(p);
  const diasRecentes = new Set(p.recente.map((r) => r.h.slice(0, 10))).size;
  // primeiro ano da série horária da curva (os subsistemas só têm hora a hora desde então; o SIN usa os agregados diários antes)
  const inicioHorario = p.hora_pico_por_ano.SE?.[0]?.ano;

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p026" vivo veredito={vereditoPerfil(p, sm)}>
          {respostaPerfil(p, sm)}
        </RespostaCurta>
        <CargaEscolha legenda="Região" opcoes={OPCOES_REGIAO} valor={sm} onEscolher={(x) => definir({ sm: x })} />
      </div>

      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-resumo-cargas="">
        São dois produtos do ONS: a curva de carga horária, que já inclui a MMGD estimada sem separá-la, e a carga verificada, que traz a carga global, a MMGD estimada e a carga
        líquida de MMGD (a global menos a MMGD). As definições completas estão em &ldquo;Que carga é cada série?&rdquo;, mais abaixo.
      </p>

      <div className="space-y-4">
        <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          {perfil ? (
            <RespostaCurta id="p026-perfil" vivo tamanho="sm" veredito={vereditoPerfilTipico(perfil)}>
              {respostaPerfilTipico(perfil)}
            </RespostaCurta>
          ) : (
            <p className="text-sm text-carvao-muted">Sem perfil típico publicado para este recorte.</p>
          )}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <CargaLista
              rotulo="Mês"
              opcoes={[...p.meses_perfil].reverse().map((m) => ({ id: m, rotulo: mesAno(m) }))}
              valor={perfil?.mes ?? mesPadrao}
              onEscolher={(m) => definir({ mes: m })}
            />
            <CargaEscolha
              legenda="Tipo de dia"
              opcoes={CLASSES.filter((c) => classesMes.includes(c)).map((c) => ({ id: c, rotulo: ROTULO_CLASSE[c] }))}
              valor={perfil?.classe ?? cls}
              onEscolher={(c) => definir({ cls: c })}
            />
          </div>
        </div>
        {perfil && (
          <>
            <CursorSincronizado>
              <GraficoLinhas
                titulo={`Carga verificada do SIN, ${ROTULO_CLASSE[perfil.classe]} médio de ${mesAno(perfil.mes)} (${perfil.dias_api} dias)`}
                dados={linhasPf}
                chaveX="hora"
                formatoX="texto"
                series={SERIES_API}
                unidade="MWmed"
                casas={0}
                legendaInterativa
                altura={260}
                grupoCursor="perfil-sin"
              />
              <GraficoLinhas
                titulo={`Curva de carga do SIN, ${ROTULO_CLASSE[perfil.classe]} médio de ${mesAno(perfil.mes)} (${perfil.dias_curva} dias)`}
                dados={linhasPf}
                chaveX="hora"
                formatoX="texto"
                series={[{ id: "carga", rotulo: "Curva de carga do SIN", sigla: "Curva", cor: "var(--cor-energia-dark)" }]}
                unidade="MWmed"
                casas={0}
                altura={220}
                grupoCursor="perfil-sin"
              />
            </CursorSincronizado>
            {globalContraDiaria && sm === "SIN" && <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">{globalContraDiaria}</p>}
            <TabelaInterativa
              titulo="Tabela equivalente: perfil típico hora a hora"
              colunas={COLUNAS_PERFIL}
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
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            Hora a hora até {dataBR(p.ultimo_dia)}; perfil típico de {mesAno(p.meses_perfil[0] ?? mesPadrao)} a {mesAno(mesPadrao)}; MMGD mensal desde{" "}
            {mesAno(mmgd[0]?.mes ?? mesPadrao)}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            {sm === "SIN"
              ? "SIN"
              : `${NOME_REGIAO[sm]} na resposta, na curva horária e no mapa do pico; SIN na carga verificada hora a hora, no dia típico e nos picos diários`}
            ; curva de carga horária e carga verificada do ONS, sempre em gráficos separados
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">MWmed por hora local de início (potência média da hora; 1 MWmed durante uma hora equivale a 1 MWh); parcela da MMGD em % da carga global</dd>
        </div>
      </dl>

      {notas}

      {aposNotas}

      <SecaoDoPainel id="pico" titulo="Em que hora cai o pico do dia?" lead="Dias de cada ano em que o maior valor horário caiu em cada hora; a hora é a de início.">
        {escolheAnos && desdeApi !== undefined && (
          <CargaEscolha
            legenda="Anos no mapa"
            opcoes={[
              { id: "recentes", rotulo: `Desde ${desdeApi}` },
              { id: "todos", rotulo: `Todos, desde ${(p.hora_pico_por_ano[sm] ?? [])[0]?.ano ?? desdeApi}` },
            ]}
            valor={todosAnos ? "todos" : "recentes"}
            onEscolher={(x) => definir({ hp: x })}
          />
        )}
        <MapaCalor
          titulo={`Dias com o pico da curva de carga ${DO_REGIAO[sm]} em cada hora, por ano`}
          linhas={matriz.anos.map((a) => ({ id: a.id, rotulo: a.rotulo, curto: a.id }))}
          colunas={HORAS}
          nomeLinhas="Ano"
          nomeColunas="Hora de início"
          valores={matriz.valores}
          escala={ESCALA_PICO}
          unidade="dias"
          casas={0}
          passoRotuloColunas={3}
          colunaInicial={horaDoPicoMaisFrequente}
          periodo={`${matriz.anos[0]?.id ?? ""} a ${dataBR(p.ultimo_dia_curva)}`}
          nota={`Desde a inclusão da MMGD na curva${parentesesMmgd(regimes)}, o pico da curva inclui MMGD estimada; o pico da carga líquida está abaixo, na carga verificada.`}
        />
        {anoApi && (
          <>
            <GraficoBarras
              titulo={`SIN em ${anoApi.ano} (${anoApi.dias} dias): hora do pico da carga líquida e da carga global (carga verificada)`}
              dados={horasApi}
              chaveCategoria="id"
              chaveRotulo="hora"
              series={[
                { id: "liquida", rotulo: "Carga líquida de MMGD", cor: "var(--cor-energia)" },
                { id: "global", rotulo: "Carga global", cor: "var(--serie-referencia)" },
              ]}
              unidade="dias"
              casas={0}
            />
            {/* a tabela equivalente deste gráfico é a do próprio GraficoBarras (já no HTML, recolhida); as horas de pico por dia estão em carga_verificada_diaria.csv */}
          </>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel id="mmgd" titulo="Quanto da carga global é MMGD, mês a mês?">
        <GraficoLinhas
          titulo="MMGD estimada pelo ONS em % da carga global (razão de somas no mês)"
          dados={mmgdTabela}
          chaveX="mes"
          formatoX="mes"
          series={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sigla: CURTO_REGIAO[r], cor: COR_REGIAO[r] }))}
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
          titulo="Tabela equivalente: parcela mensal da MMGD por região"
          colunas={COLUNAS_MMGD}
          linhas={mmgdTabela}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonteApi}
          versao={versao}
          nomeArquivo="carga-mmgd-mensal"
          chaveUrl="mmgd"
          ordemInicial={{ coluna: "mes", direcao: "desc" }}
          nota="Mês incompleto: a carga verificada ainda não tem todos os dias do mês (o mês corrente)."
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="horas" titulo={`E nos últimos ${plural(diasRecentes, "dia", "dias")}, hora a hora?`}>
        <CursorSincronizado>
          <GraficoLinhas
            titulo="Carga verificada do SIN: carga global, carga líquida de MMGD e MMGD estimada"
            dados={recente}
            chaveX="h"
            formatoX="hora"
            series={SERIES_API}
            unidade="MWmed"
            casas={0}
            legendaInterativa
            altura={280}
          />
          <GraficoLinhas
            titulo={`Curva de carga horária ${DO_REGIAO[sm]} (já inclui MMGD estimada, não separada)`}
            dados={recente}
            chaveX="h"
            formatoX="hora"
            series={[{ id: sm, rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] }]}
            unidade="MWmed"
            casas={0}
            altura={240}
          />
        </CursorSincronizado>
        <p className="text-sm text-carvao-muted">
          A carga verificada (API) é publicada por submercado; aqui está o SIN. A carga global da API e a curva são grandezas diferentes
          {diferencaCurva ? ` (${diferencaCurva})` : ""}: por isso ficam em gráficos separados e a MMGD nunca é subtraída da curva.
        </p>
        <TabelaInterativa
          titulo="Tabela equivalente: as mesmas horas dos dois gráficos"
          colunas={COLUNAS_RECENTE}
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

      <SecaoDoPainel nivel="analisar" titulo="Perfil por subsistema no último mês completo">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaEscolha legenda="Subsistema" opcoes={OPCOES_SUBSISTEMA} valor={v.psm as Regiao} onEscolher={(x) => definir({ psm: x })} />
        </div>
        {perfilSm ? (
          <>
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{respostaPerfilTipico(perfilSm)}</p>
            <GraficoLinhas
              titulo={`${NOME_REGIAO[perfilSm.sm]}: carga verificada, ${ROTULO_CLASSE[perfilSm.classe]} médio de ${mesAno(perfilSm.mes)}`}
              dados={linhasPfSm}
              chaveX="hora"
              formatoX="texto"
              series={SERIES_API}
              unidade="MWmed"
              casas={0}
              legendaInterativa
              altura={260}
            />
            <TabelaInterativa
              titulo="Tabela equivalente: perfil do subsistema"
              colunas={COLUNAS_PERFIL}
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
          <p className="text-sm text-carvao-muted">Sem perfil publicado para este subsistema e tipo de dia.</p>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel
        nivel="analisar"
        titulo={evol ? `Como o ${evol.classe} de ${evol.mes} mudou desde ${evol.desde}` : "Como o perfil do mesmo mês mudou entre os anos"}
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaLista rotulo="Medida" opcoes={MEDIDAS_PERFIL.map((m) => ({ id: m, rotulo: ROTULO_MEDIDA[m] }))} valor={medida} onEscolher={(m) => definir({ med: m })} />
        </div>
        <Comparador
          rotulo={`Anos no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={anos.map((a) => ({ id: a, rotulo: a }))}
          selecionadas={anosEscolhidos}
          onMudar={(ids) => definir({ anos: ids })}
          dicaBusca={anos.length ? `Buscar, por exemplo ${listaTexto([anos[0], anos[anos.length - 1]])}` : ""}
          vazio="Nenhum ano escolhido. Escolha até quatro para comparar o perfil na mesma escala."
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
              titulo={`${ROTULO_MEDIDA[medida]}, ${evol ? `${evol.classe} médio de ${evol.mes}` : "perfil médio do mês"}`}
              dados={evolucao}
              chaveX="hora"
              formatoX="texto"
              series={anosEscolhidos.map((a, i) => ({ id: a, rotulo: a, cor: COR_COMPARACAO[i % COR_COMPARACAO.length] }))}
              unidade="MWmed"
              casas={0}
              altura={280}
            />
            <TabelaInterativa
              titulo={`Tabela equivalente: perfil ${evol ? `de ${evol.mes} ` : ""}dos anos escolhidos`}
              colunas={[{ id: "hora", rotulo: "Hora (início)", tipo: "texto" }, ...anosEscolhidos.map((a): ColunaTabela => ({ id: a, rotulo: a, tipo: "numero", unidade: "MWmed", casas: 0 }))]}
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

      <SecaoDoPainel nivel="analisar" titulo={`Pico de cada dia nos últimos ${plural(picos.length, "dia", "dias")} (SIN)`}>
        <CursorSincronizado>
          <GraficoLinhas
            titulo="Pico horário diário da curva de carga do SIN"
            dados={picos}
            chaveX="d"
            series={[{ id: "pico", rotulo: "Pico da curva", sigla: "Curva", cor: "var(--cor-energia-dark)" }]}
            unidade="MWmed"
            casas={0}
            altura={220}
          />
          <GraficoLinhas
            titulo="Pico horário diário da carga líquida de MMGD do SIN (carga verificada)"
            dados={picos}
            chaveX="d"
            series={[{ id: "pico_liquida", rotulo: "Pico da carga líquida", sigla: "Líquida", cor: "var(--cor-energia)" }]}
            unidade="MWmed"
            casas={0}
            altura={220}
          />
        </CursorSincronizado>
        <TabelaInterativa
          titulo={`Tabela equivalente: picos e horas dos últimos ${plural(picos.length, "dia", "dias")}`}
          colunas={COLUNAS_PICOS}
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
          titulo="Maior carga horária de cada ano, por região (curva de carga)"
          colunas={COLUNAS_RECORDES}
          linhas={recordes}
          chaveLinha="id"
          colunaRotulo="ano"
          fonte={fonteCurva}
          versao={versao}
          nomeArquivo="carga-recordes-anuais"
          chaveUrl="rec"
          ordemInicial={{ coluna: "ano", direcao: "desc" }}
          nota={`${inicioHorario ? `Antes de ${inicioHorario} a hora do pico vem dos agregados diários da curva (média, pico e hora por subsistema). ` : ""}Anos de regimes diferentes não são comparáveis em nível.`}
        />
      </SecaoDoPainel>
    </div>
  );
}
