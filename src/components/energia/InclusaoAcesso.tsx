"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { InclusaoOpcoes } from "@/components/energia/InclusaoOpcoes";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasQuantis } from "@/lib/energia/escalas";
import { URL_GEO } from "@/lib/energia/geo";
import { txEm } from "@/lib/energia/i18n/conta-inclusao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import {
  ESQUEMA_ACESSO,
  UFS,
  codigoUf,
  colunasIsoladosUf,
  colunasLocalidades,
  colunasUfsPnad,
  dadosHistoricoPnadCsv,
  dadosLptAnual,
  dadosSeriePnad,
  indicadorPnad,
  linhasIsoladosUf,
  linhasLocalidades,
  linhasUfsPnad,
  localidadesDoJson,
  mes as mesEm,
  nomeTerritorio,
  siglaDoCodigo,
  valoresMapaPnad,
  type AcessoPnad,
  type IndicadorPnad,
  type LocalidadeLinha,
  type ProgramaLptUrl,
  type SituacaoPnad,
} from "@/lib/energia/inclusao";
import { LIMITE_COMPARACAO, alternarSelecao, type ColunaTabela } from "@/lib/energia/tabela";
import type { Acesso, LinhaPnad, LuzParaTodos, SistemasIsolados } from "@/lib/energia/tipos-inclusao";

/**
 * P062, acesso e sistemas isolados. Três dimensões que não se somam e não se
 * substituem: domicílio sem energia de nenhuma fonte e fornecimento em tempo
 * integral (PNAD Contínua, amostral), localidades fora do SIN (PASI, EPE) e
 * ligações novas do Luz para Todos (MME). A carga do SIN nunca entra como medida
 * de acesso.
 *
 * O mapa por UF, a tabela e o histórico compartilham as UF escolhidas na URL (até
 * quatro) e a página os põe em seções com pergunta própria; o histórico das UF vem do
 * CSV publicado (55 KB), baixado só quando alguma UF é escolhida, porque a gold traz as
 * UF só no primeiro e no último ano. A figura principal (a série por região) recebe a
 * resposta, o recorte e as notas já prontos, para vir primeiro e ter a ressalva junto.
 */

function opcoesInd(idioma: Idioma): readonly (readonly [IndicadorPnad, string])[] {
  const tx = txEm(idioma);
  return [
    ["sem", tx("Sem energia de nenhuma fonte", "No energy from any source")], // i18n: dado
    ["rede", tx("Ligados à rede geral", "Connected to the general grid")],
    ["integral", tx("Rede em tempo integral", "Full-time grid")],
  ];
}
function opcoesSit(idioma: Idioma): readonly (readonly [SituacaoPnad, string])[] {
  const tx = txEm(idioma);
  return [
    ["total", tx("Todos os domicílios", "All households")], // i18n: dado
    ["rural", tx("Só área rural", "Rural areas only")],
  ];
}
const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const CORES_REG: Record<string, string> = {
  BR: "var(--cor-carvao)",
  "RG-N": "var(--serie-sm-n)",
  "RG-NE": "var(--serie-sm-ne)",
  "RG-SE": "var(--serie-sm-se)",
  "RG-S": "var(--serie-sm-s)",
  "RG-CO": "var(--serie-solar)",
};
const CORES_COMP = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
const REGIOES = ["BR", "RG-N", "RG-NE", "RG-SE", "RG-S", "RG-CO"];

let promessaCsv: Promise<string> | null = null;
function carregarCsv(url: string): Promise<string> {
  if (!promessaCsv) {
    promessaCsv = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });
    promessaCsv.catch(() => {
      promessaCsv = null;
    });
  }
  return promessaCsv;
}

export function InclusaoRegioesPnad({
  serie,
  resposta,
  recorte,
  notas,
}: {
  serie: Acesso["pnad_serie"];
  resposta?: ReactNode;
  recorte?: ReactNode;
  notas?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const ind = indicadorPnad(idioma)[v.ind];
  const dados = useMemo(() => dadosSeriePnad(serie, REGIOES, v.ind), [serie, v.ind]);
  const anos = `${dados[0]?.ano ?? ""}${tx(" a ", " to ")}${dados.at(-1)?.ano ?? ""}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {resposta}
        <InclusaoOpcoes rotulo={tx("Indicador", "Indicator")} nome="inclusao-ac-ind" opcoes={opcoesInd(idioma)} valor={v.ind} onMudar={(i) => definir({ ind: i })} />
      </div>
      <GraficoLinhas
        titulo={tx(`${ind.rotulo}: Brasil e grandes regiões, ${anos} (PNAD Contínua)`, `${ind.rotulo}: Brazil and major regions, ${anos} (Continuous PNAD)`)}
        dados={dados}
        chaveX="ano" // i18n: dado
        formatoX="texto"
        series={REGIOES.map((t) => ({ id: t, rotulo: nomeTerritorio(t, idioma), sigla: t === "BR" ? "BR" : t.replace("RG-", ""), cor: CORES_REG[t], espessura: t === "BR" ? 3 : 2 }))}
        unidade={ind.unidade}
        casas={1}
        legendaInterativa
        altura={300}
      />
      {recorte}
      {notas}
    </div>
  );
}

/** Mapa e tabela por UF; as UF escolhidas (até quatro) vão para a URL e alimentam o histórico. */
export function InclusaoMapaPnad({ acesso, fonte }: { acesso: AcessoPnad; fonte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const [aviso, setAviso] = useState("");
  const ind = indicadorPnad(idioma)[v.ind];
  const valores = useMemo(() => valoresMapaPnad(acesso, v.sit, v.ind), [acesso, v.sit, v.ind]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), CORES_MAPA.length, { casas: 1 }), [valores]);
  const linhas = useMemo(() => linhasUfsPnad(acesso, v.sit, idioma), [acesso, v.sit, idioma]);
  const rural = v.sit === "rural" ? tx(", área rural", ", rural areas") : "";
  const escolhidas = v.ufs.filter((u) => linhas.some((l) => l.uf === u));
  const ultima = escolhidas.at(-1) ?? null;

  const alternar = (uf: string | null) => {
    if (!uf) {
      if (ultima) definir({ ufs: escolhidas.filter((x) => x !== ultima) });
      return;
    }
    const r = alternarSelecao(escolhidas, uf, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(tx(`Limite de ${LIMITE_COMPARACAO} UF no histórico: remova uma para incluir ${uf}.`, `Limit of ${LIMITE_COMPARACAO} states in the history: remove one to include ${uf}.`));
      return;
    }
    setAviso("");
    definir({ ufs: r.ids });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <InclusaoOpcoes rotulo={tx("Indicador", "Indicator")} nome="inclusao-ac-ind-mapa" opcoes={opcoesInd(idioma)} valor={v.ind} onMudar={(i) => definir({ ind: i })} />
        <InclusaoOpcoes rotulo={tx("Situação", "Area")} nome="inclusao-ac-sit" opcoes={opcoesSit(idioma)} valor={v.sit} onMudar={(sit) => definir({ sit })} />
      </div>
      <MapaCoropletico
        titulo={tx(`${ind.rotulo} por UF, ${acesso.ano_referencia}${rural} (PNAD Contínua)`, `${ind.rotulo} by state, ${acesso.ano_referencia}${rural} (Continuous PNAD)`)}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES_MAPA}
        classificacao={classes}
        unidade={ind.unidade}
        casas={1}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={ultima ? codigoUf(ultima) : null}
        onSelecionar={(id) => alternar(siglaDoCodigo(id))}
        rotulos
        periodo={acesso.ano_referencia}
        nota={tx(
          "Estimativa amostral; 0,0% quer dizer menos de 0,05%. Clique numa UF para incluí-la no histórico (até quatro).",
          "Sample estimate; 0.0% means less than 0.05%. Click a state to include it in the history (up to four).",
        )}
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <TabelaInterativa
        titulo={tx(`Acesso à energia por UF, ${acesso.ano_referencia}${rural}`, `Access to energy by state, ${acesso.ano_referencia}${rural}`)}
        colunas={colunasUfsPnad(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="uf"
        fonte={fonte}
        versao={acesso.ano_referencia}
        nomeArquivo={`inclusao-acesso-uf-${v.sit}`}
        chaveUrl="ac.tab"
        ordemInicial={{ coluna: "pct_sem", direcao: "desc" }}
        selecionado={ultima}
        onSelecionar={(id) => alternar(id)}
        dicaBusca={tx("Sigla da UF", "State abbreviation")}
        nota={tx(
          "Domicílios sem energia: diferença entre duas estimativas do IBGE arredondadas em milhares. Quando as duas coincidem, a coluna fica sem número e a contagem diz menos de 1 mil (não é zero).",
          "Households without energy: difference between two IBGE estimates rounded to thousands. When the two coincide, the column has no number and the count says less than 1 thousand (it is not zero).",
        )}
      />
    </div>
  );
}

/**
 * Histórico das UF escolhidas (até quatro) ao lado do Brasil; o CSV da PNAD só é baixado quando alguma UF é escolhida, aqui, no mapa ou
 * na tabela. Recebe só as linhas do Brasil: as UF vêm do CSV, e o conjunto de UF é o das 27 da federação.
 */
export function InclusaoHistoricoPnad({ serieBr, csvUrl }: { serieBr: LinhaPnad[]; csvUrl: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const [csv, setCsv] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ind = indicadorPnad(idioma)[v.ind];
  const escolhidas = v.ufs.filter((u) => UFS.includes(u));
  const precisa = escolhidas.length > 0;

  useEffect(() => {
    if (!precisa || csv) return;
    let vivo = true;
    setErro(null);
    carregarCsv(csvUrl).then(
      (t) => vivo && setCsv(t),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [precisa, csv, csvUrl]);

  const historico = useMemo(() => {
    const br = dadosSeriePnad(serieBr, ["BR"], v.ind);
    if (!csv || !escolhidas.length) return br;
    const ufs = dadosHistoricoPnadCsv(csv, escolhidas, v.ind);
    const porAno = new Map(ufs.map((l) => [l.ano, l]));
    return br.map((l) => ({ ...l, ...(porAno.get(l.ano as string) ?? {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
  }, [serieBr, csv, escolhidas.join(","), v.ind]);
  const entidades = useMemo(() => UFS.map((u) => ({ id: u, rotulo: u })), []);

  return (
    <div className="space-y-4">
      <Comparador
        rotulo={tx("UF no histórico (até 4)", "States in the history (up to 4)")}
        entidades={entidades}
        selecionadas={escolhidas}
        onMudar={(ids) => definir({ ufs: ids })}
        dicaBusca={tx("Sigla da UF", "State abbreviation")}
        vazio={tx(
          "Nenhuma UF escolhida: o histórico mostra só o Brasil. Escolha aqui, no mapa ou na tabela.",
          "No state chosen: the history shows only Brazil. Choose here, on the map or in the table.",
        )}
      >
        {() => null}
      </Comparador>
      {precisa && !csv && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          {tx("Carregando a série das UF (CSV publicado da PNAD)…", "Loading the state series (published PNAD CSV)…")}
        </p>
      )}
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          {tx(`Não foi possível carregar a série das UF (${erro}). O arquivo está em`, `The state series could not be loaded (${erro}). The file is at`)}{" "}
          <a href={csvUrl} download className="text-energia-dark underline underline-offset-4">
            {tx("acesso à energia por UF, PNAD (CSV)", "access to energy by state, PNAD (CSV)")}
          </a>
          .
        </p>
      )}
      <GraficoLinhas
        titulo={tx(
          `${ind.rotulo}: Brasil${escolhidas.length ? ` e ${escolhidas.join(", ")}` : ""}, todos os domicílios`,
          `${ind.rotulo}: Brazil${escolhidas.length ? ` and ${escolhidas.join(", ")}` : ""}, all households`,
        )}
        dados={historico}
        chaveX="ano" // i18n: dado
        formatoX="texto"
        series={[
          { id: "BR", rotulo: tx("Brasil", "Brazil"), sigla: "BR", cor: "var(--cor-carvao)", espessura: 3 },
          ...(csv ? escolhidas.map((uf, i) => ({ id: uf, rotulo: uf, sigla: uf, cor: CORES_COMP[i % CORES_COMP.length] })) : []),
        ]}
        unidade={ind.unidade}
        casas={1}
        altura={280}
      />
    </div>
  );
}

function opcoesProg(idioma: Idioma): readonly (readonly [ProgramaLptUrl, string])[] {
  const tx = txEm(idioma);
  return [
    ["total", tx("Todos", "All")], // i18n: dado
    ["rural", tx("Rural", "Rural")],
    ["regioes_remotas", tx("Regiões remotas da Amazônia Legal", "Remote regions of the Legal Amazon")],
    ["recurso_distribuidora", tx("Recurso da distribuidora", "Distribution utility funds")],
  ];
}

function colunasLptUf(idioma: Idioma): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "nome", rotulo: tx("UF", "State"), tipo: "texto", idiomaTexto: "nome" },
    { id: "regiao", rotulo: tx("Região", "Region"), tipo: "texto", categorica: true },
    { id: "total", rotulo: tx("Domicílios atendidos (total)", "Households served (total)"), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "desde_2023", rotulo: tx("Desde jan/2023", "Since Jan 2023"), tipo: "numero", casas: 0 },
    { id: "rural", rotulo: tx("Rural", "Rural"), tipo: "numero", casas: 0 },
    { id: "regioes_remotas", rotulo: tx("Regiões remotas", "Remote regions"), tipo: "numero", casas: 0 },
    { id: "recurso_distribuidora", rotulo: tx("Recurso da distribuidora", "Distribution utility funds"), tipo: "numero", casas: 0 },
  ];
}

export function InclusaoLpt({ lpt, fonte }: { lpt: Pick<LuzParaTodos, "serie_anual" | "ultimo_mes" | "programas" | "por_uf">; fonte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const mes = (x: string | null | undefined) => mesEm(x, idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const dados = useMemo(() => dadosLptAnual(lpt, v.prog, idioma), [lpt, v.prog, idioma]);
  const opcoes = opcoesProg(idioma);
  const rotProg = opcoes.find(([id]) => id === v.prog)?.[1] ?? v.prog;
  const linhasUf = useMemo(
    () =>
      lpt.por_uf.map((u) => ({
        id: u.uf,
        nome: u.nome ?? u.uf,
        regiao: u.regiao ? nomeTerritorio(u.regiao, idioma) : null,
        total: u.total,
        desde_2023: u.desde_2023,
        rural: u.rural,
        regioes_remotas: u.regioes_remotas,
        recurso_distribuidora: u.recurso_distribuidora,
      })),
    [lpt.por_uf, idioma],
  );
  const programa = v.prog === "total" ? tx("todos os programas", "all programs") : tx(`programa ${rotProg}`, `${rotProg} program`);
  return (
    <div className="space-y-5">
      <InclusaoOpcoes rotulo={tx("Programa", "Program")} nome="inclusao-ac-prog" opcoes={opcoes} valor={v.prog} onMudar={(prog) => definir({ prog })} />
      <GraficoBarras
        titulo={tx(
          `Domicílios atendidos por ano do atendimento, ${programa} (MME, até ${mes(lpt.ultimo_mes)})`,
          `Households served by year of service, ${programa} (MME, up to ${mes(lpt.ultimo_mes)})`,
        )}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[{ id: "valor", rotulo: v.prog === "total" ? tx("Todos os programas", "All programs") : rotProg, cor: "var(--cor-energia)" }]} // i18n: dado
        unidade={tx("domicílios", "households")}
        casas={0}
        altura={300}
      />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            Sem dado num programa quer dizer nenhuma linha dele no arquivo naquele ano; zero quer dizer linhas com quantidade zero. O último ano vai só até {mes(lpt.ultimo_mes)} e não se
            compara a ano completo.
          </>,
          <>
            No data in a program means no row of it in the file that year; zero means rows with a quantity of zero. The latest year only runs to {mes(lpt.ultimo_mes)} and is not
            compared with a complete year.
          </>,
        )}
      </p>
      <TabelaInterativa
        titulo={tx(`Luz para Todos por UF, ${lpt.serie_anual[0]?.ano ?? ""} a ${mes(lpt.ultimo_mes)}`, `Luz para Todos by state, ${lpt.serie_anual[0]?.ano ?? ""} to ${mes(lpt.ultimo_mes)}`)}
        colunas={colunasLptUf(idioma)}
        linhas={linhasUf}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={lpt.ultimo_mes}
        nomeArquivo="inclusao-luz-para-todos-uf"
        chaveUrl="ac.lpt"
        ordemInicial={{ coluna: "total", direcao: "desc" }} // i18n: dado
        dicaBusca={tx("Nome da UF", "State name")}
        nota={tx(
          "Domicílios ligados pelo programa (não pessoas, não UC com benefício). Ligação não mede a qualidade do fornecimento depois dela.",
          "Households connected by the program (not people, not consumer units with a benefit). A connection does not measure the quality of supply after it.",
        )}
      />
    </div>
  );
}


export function InclusaoIsolados({
  si,
  fonte,
}: {
  si: Pick<SistemasIsolados, "ciclo" | "por_uf" | "localidades_mais_populosas" | "pontos_json">;
  fonte: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const [todas, setTodas] = useState<LocalidadeLinha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const porUf = useMemo(() => linhasIsoladosUf(si), [si]);
  const linhas = todas ?? linhasLocalidades(si.localidades_mais_populosas);
  const carregarTodas = () => {
    setCarregando(true);
    setErro(null);
    fetch(si.pontos_json)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => setTodas(localidadesDoJson(j)))
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => setCarregando(false));
  };
  return (
    <div className="space-y-5">
      <GraficoBarras
        titulo={tx(`População das localidades isoladas por UF, ciclo ${si.ciclo} do PASI`, `Population of isolated localities by state, PASI cycle ${si.ciclo}`)}
        dados={porUf}
        chaveCategoria="id"
        chaveRotulo="nome"
        rotulosSaoNomes
        series={[{ id: "populacao", rotulo: tx("População informada", "Reported population"), cor: "var(--serie-termica)" }]}
        unidade={tx("pessoas", "people")}
        casas={0}
        orientacao="horizontal"
        rotulosValor
      />
      <TabelaInterativa
        titulo={tx(`Localidades e população por UF, ciclo ${si.ciclo}`, `Localities and population by state, cycle ${si.ciclo}`)}
        colunas={colunasIsoladosUf(idioma)}
        linhas={porUf}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={si.ciclo}
        nomeArquivo={`inclusao-sistemas-isolados-uf-${si.ciclo}`}
        chaveUrl="ac.isouf"
        ordemInicial={{ coluna: "populacao", direcao: "desc" }}
        nota={tx(
          "População ausente na fonte não vira zero: a soma usa só as localidades que informam, e a última coluna conta as que não informam.",
          "Population missing in the source does not become zero: the sum uses only the localities that report it, and the last column counts those that do not.",
        )}
      />
      <div className="space-y-3">
        <TabelaInterativa
          titulo={
            todas
              ? tx(`Todas as ${todas.length} localidades do ciclo ${si.ciclo}`, `All ${todas.length} localities of cycle ${si.ciclo}`)
              : tx(`As ${linhas.length} localidades mais populosas do ciclo ${si.ciclo}`, `The ${linhas.length} most populous localities of cycle ${si.ciclo}`)
          }
          colunas={colunasLocalidades(idioma)}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={si.ciclo}
          nomeArquivo={`inclusao-localidades-isoladas-${si.ciclo}`}
          chaveUrl="ac.iso"
          ordemInicial={{ coluna: "populacao", direcao: "desc" }}
          dicaBusca={tx("Localidade, município ou distribuidora", "Locality, municipality or distribution utility")}
        />
        {!todas && (
          <button
            type="button"
            onClick={carregarTodas}
            disabled={carregando}
            className="rotulo inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-carvao hover:bg-energia-fundo disabled:opacity-60"
          >
            {carregando ? tx("Carregando…", "Loading…") : tx("Ver todas as localidades do ciclo", "See all localities of the cycle")}
          </button>
        )}
        {erro && (
          <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
            {tx(`Não foi possível carregar a lista completa (${erro}). Ela também está em`, `The full list could not be loaded (${erro}). It is also in`)}{" "}
            <a href="/energia/series/inclusao_sistemas_isolados.csv" download className="text-energia-dark underline underline-offset-4">
              {tx("localidades de sistemas isolados (CSV)", "isolated system localities (CSV)")}
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
