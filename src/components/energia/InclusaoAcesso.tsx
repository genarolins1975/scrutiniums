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
import {
  COLUNAS_LOCALIDADES,
  COLUNAS_UFS_PNAD,
  ESQUEMA_ACESSO,
  INDICADOR_PNAD,
  NOME_TERRITORIO,
  codigoUf,
  dadosHistoricoPnadCsv,
  dadosLptAnual,
  dadosSeriePnad,
  COLUNAS_ISOLADOS_UF,
  linhasIsoladosUf,
  linhasLocalidades,
  linhasUfsPnad,
  localidadesDoJson,
  mes,
  siglaDoCodigo,
  valoresMapaPnad,
  type AcessoPnad,
  type IndicadorPnad,
  type LocalidadeLinha,
  type ProgramaLptUrl,
  type SituacaoPnad,
} from "@/lib/energia/inclusao";
import { LIMITE_COMPARACAO, alternarSelecao, type ColunaTabela } from "@/lib/energia/tabela";
import type { Acesso, LuzParaTodos, SistemasIsolados } from "@/lib/energia/tipos-inclusao";

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

const OPCOES_IND: readonly (readonly [IndicadorPnad, string])[] = [
  ["sem", "Sem energia de nenhuma fonte"],
  ["rede", "Ligados à rede geral"],
  ["integral", "Rede em tempo integral"],
];
const OPCOES_SIT: readonly (readonly [SituacaoPnad, string])[] = [
  ["total", "Todos os domicílios"],
  ["rural", "Só área rural"],
];
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
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const ind = INDICADOR_PNAD[v.ind];
  const dados = useMemo(() => dadosSeriePnad(serie, REGIOES, v.ind), [serie, v.ind]);
  return (
    <div className="space-y-4">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {resposta}
        <InclusaoOpcoes rotulo="Indicador" nome="inclusao-ac-ind" opcoes={OPCOES_IND} valor={v.ind} onMudar={(i) => definir({ ind: i })} />
      </div>
      <GraficoLinhas
        titulo={`${ind.rotulo}: Brasil e grandes regiões, ${dados[0]?.ano ?? ""} a ${dados.at(-1)?.ano ?? ""} (PNAD Contínua)`}
        dados={dados}
        chaveX="ano"
        formatoX="texto"
        series={REGIOES.map((t) => ({ id: t, rotulo: NOME_TERRITORIO[t], sigla: t === "BR" ? "BR" : t.replace("RG-", ""), cor: CORES_REG[t], espessura: t === "BR" ? 3 : 2 }))}
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
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const [aviso, setAviso] = useState("");
  const ind = INDICADOR_PNAD[v.ind];
  const valores = useMemo(() => valoresMapaPnad(acesso, v.sit, v.ind), [acesso, v.sit, v.ind]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), CORES_MAPA.length, { casas: 1 }), [valores]);
  const linhas = useMemo(() => linhasUfsPnad(acesso, v.sit), [acesso, v.sit]);
  const escolhidas = v.ufs.filter((u) => linhas.some((l) => l.uf === u));
  const ultima = escolhidas.at(-1) ?? null;

  const alternar = (uf: string | null) => {
    if (!uf) {
      if (ultima) definir({ ufs: escolhidas.filter((x) => x !== ultima) });
      return;
    }
    const r = alternarSelecao(escolhidas, uf, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(`Limite de ${LIMITE_COMPARACAO} UF no histórico: remova uma para incluir ${uf}.`);
      return;
    }
    setAviso("");
    definir({ ufs: r.ids });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <InclusaoOpcoes rotulo="Indicador" nome="inclusao-ac-ind-mapa" opcoes={OPCOES_IND} valor={v.ind} onMudar={(i) => definir({ ind: i })} />
        <InclusaoOpcoes rotulo="Situação" nome="inclusao-ac-sit" opcoes={OPCOES_SIT} valor={v.sit} onMudar={(sit) => definir({ sit })} />
      </div>
      <MapaCoropletico
        titulo={`${ind.rotulo} por UF, ${acesso.ano_referencia}${v.sit === "rural" ? ", área rural" : ""} (PNAD Contínua)`}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES_MAPA}
        classificacao={classes}
        unidade={ind.unidade}
        casas={1}
        rotuloRegiao={{ singular: "UF", plural: "UF" }}
        selecionado={ultima ? codigoUf(ultima) : null}
        onSelecionar={(id) => alternar(siglaDoCodigo(id))}
        rotulos
        periodo={acesso.ano_referencia}
        nota="Estimativa amostral; 0,0% quer dizer menos de 0,05%. Clique numa UF para incluí-la no histórico (até quatro)."
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <TabelaInterativa
        titulo={`Acesso à energia por UF, ${acesso.ano_referencia}${v.sit === "rural" ? ", área rural" : ""}`}
        colunas={COLUNAS_UFS_PNAD}
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
        dicaBusca="Sigla da UF"
        nota="Domicílios sem energia: diferença entre duas estimativas do IBGE arredondadas em milhares. Quando as duas coincidem, a coluna fica sem número e a contagem diz menos de 1 mil (não é zero)."
      />
    </div>
  );
}

/** Histórico das UF escolhidas (até quatro) ao lado do Brasil; o CSV da PNAD só é baixado quando alguma UF é escolhida, aqui, no mapa ou na tabela. */
export function InclusaoHistoricoPnad({ acesso, csvUrl }: { acesso: AcessoPnad; csvUrl: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const [csv, setCsv] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ind = INDICADOR_PNAD[v.ind];
  const linhas = useMemo(() => linhasUfsPnad(acesso, v.sit), [acesso, v.sit]);
  const escolhidas = v.ufs.filter((u) => linhas.some((l) => l.uf === u));
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
    const br = dadosSeriePnad(acesso.pnad_serie, ["BR"], v.ind);
    if (!csv || !escolhidas.length) return br;
    const ufs = dadosHistoricoPnadCsv(csv, escolhidas, v.ind);
    const porAno = new Map(ufs.map((l) => [l.ano, l]));
    return br.map((l) => ({ ...l, ...(porAno.get(l.ano as string) ?? {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
  }, [acesso.pnad_serie, csv, escolhidas.join(","), v.ind]);
  const entidades = useMemo(() => linhas.map((l) => ({ id: String(l.uf), rotulo: String(l.uf) })), [linhas]);

  return (
    <div className="space-y-4">
      <Comparador
        rotulo="UF no histórico (até 4)"
        entidades={entidades}
        selecionadas={escolhidas}
        onMudar={(ids) => definir({ ufs: ids })}
        dicaBusca="Sigla da UF"
        vazio="Nenhuma UF escolhida: o histórico mostra só o Brasil. Escolha aqui, no mapa ou na tabela."
      >
        {() => null}
      </Comparador>
      {precisa && !csv && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          Carregando a série das UF (CSV publicado da PNAD)…
        </p>
      )}
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          Não foi possível carregar a série das UF ({erro}). O arquivo está em{" "}
          <a href={csvUrl} download className="text-energia-dark underline underline-offset-4">
            acesso à energia por UF, PNAD (CSV)
          </a>
          .
        </p>
      )}
      <GraficoLinhas
        titulo={`${ind.rotulo}: Brasil${escolhidas.length ? ` e ${escolhidas.join(", ")}` : ""}, todos os domicílios`}
        dados={historico}
        chaveX="ano"
        formatoX="texto"
        series={[
          { id: "BR", rotulo: "Brasil", sigla: "BR", cor: "var(--cor-carvao)", espessura: 3 },
          ...(csv ? escolhidas.map((uf, i) => ({ id: uf, rotulo: uf, sigla: uf, cor: CORES_COMP[i % CORES_COMP.length] })) : []),
        ]}
        unidade={ind.unidade}
        casas={1}
        altura={280}
      />
    </div>
  );
}

const OPCOES_PROG: readonly (readonly [ProgramaLptUrl, string])[] = [
  ["total", "Todos"],
  ["rural", "Rural"],
  ["regioes_remotas", "Regiões remotas da Amazônia Legal"],
  ["recurso_distribuidora", "Recurso da distribuidora"],
];

const COLUNAS_LPT_UF: ColunaTabela[] = [
  { id: "nome", rotulo: "UF", tipo: "texto" },
  { id: "regiao", rotulo: "Região", tipo: "texto", categorica: true },
  { id: "total", rotulo: "Domicílios atendidos (total)", tipo: "numero", casas: 0 },
  { id: "desde_2023", rotulo: "Desde jan/2023", tipo: "numero", casas: 0 },
  { id: "rural", rotulo: "Rural", tipo: "numero", casas: 0 },
  { id: "regioes_remotas", rotulo: "Regiões remotas", tipo: "numero", casas: 0 },
  { id: "recurso_distribuidora", rotulo: "Recurso da distribuidora", tipo: "numero", casas: 0 },
];

export function InclusaoLpt({ lpt, fonte }: { lpt: Pick<LuzParaTodos, "serie_anual" | "ultimo_mes" | "programas" | "por_uf">; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ACESSO);
  const dados = useMemo(() => dadosLptAnual(lpt, v.prog), [lpt, v.prog]);
  const rotProg = OPCOES_PROG.find(([id]) => id === v.prog)?.[1] ?? v.prog;
  const linhasUf = useMemo(
    () =>
      lpt.por_uf.map((u) => ({
        id: u.uf,
        nome: u.nome ?? u.uf,
        regiao: u.regiao ? (NOME_TERRITORIO[u.regiao] ?? u.regiao) : null,
        total: u.total,
        desde_2023: u.desde_2023,
        rural: u.rural,
        regioes_remotas: u.regioes_remotas,
        recurso_distribuidora: u.recurso_distribuidora,
      })),
    [lpt.por_uf],
  );
  return (
    <div className="space-y-5">
      <InclusaoOpcoes rotulo="Programa" nome="inclusao-ac-prog" opcoes={OPCOES_PROG} valor={v.prog} onMudar={(prog) => definir({ prog })} />
      <GraficoBarras
        titulo={`Domicílios atendidos por ano do atendimento, ${v.prog === "total" ? "todos os programas" : `programa ${rotProg}`} (MME, até ${mes(lpt.ultimo_mes)})`}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[{ id: "valor", rotulo: v.prog === "total" ? "Todos os programas" : rotProg, cor: "var(--cor-energia)" }]}
        unidade="domicílios"
        casas={0}
        altura={300}
      />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Sem dado num programa quer dizer nenhuma linha dele no arquivo naquele ano; zero quer dizer linhas com quantidade zero. O último ano vai só até {mes(lpt.ultimo_mes)} e não se
        compara a ano completo.
      </p>
      <TabelaInterativa
        titulo={`Luz para Todos por UF, ${lpt.serie_anual[0]?.ano ?? ""} a ${mes(lpt.ultimo_mes)}`}
        colunas={COLUNAS_LPT_UF}
        linhas={linhasUf}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={lpt.ultimo_mes}
        nomeArquivo="inclusao-luz-para-todos-uf"
        chaveUrl="ac.lpt"
        ordemInicial={{ coluna: "total", direcao: "desc" }}
        dicaBusca="Nome da UF"
        nota="Domicílios ligados pelo programa (não pessoas, não UC com benefício). Ligação não mede a qualidade do fornecimento depois dela."
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
        titulo={`População das localidades isoladas por UF, ciclo ${si.ciclo} do PASI`}
        dados={porUf}
        chaveCategoria="id"
        chaveRotulo="nome"
        series={[{ id: "populacao", rotulo: "População informada", cor: "var(--serie-termica)" }]}
        unidade="pessoas"
        casas={0}
        orientacao="horizontal"
        rotulosValor
      />
      <TabelaInterativa
        titulo={`Localidades e população por UF, ciclo ${si.ciclo}`}
        colunas={COLUNAS_ISOLADOS_UF}
        linhas={porUf}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={si.ciclo}
        nomeArquivo={`inclusao-sistemas-isolados-uf-${si.ciclo}`}
        chaveUrl="ac.isouf"
        ordemInicial={{ coluna: "populacao", direcao: "desc" }}
        nota="População ausente na fonte não vira zero: a soma usa só as localidades que informam, e a última coluna conta as que não informam."
      />
      <div className="space-y-3">
        <TabelaInterativa
          titulo={todas ? `Todas as ${todas.length} localidades do ciclo ${si.ciclo}` : `As ${linhas.length} localidades mais populosas do ciclo ${si.ciclo}`}
          colunas={COLUNAS_LOCALIDADES}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={si.ciclo}
          nomeArquivo={`inclusao-localidades-isoladas-${si.ciclo}`}
          chaveUrl="ac.iso"
          ordemInicial={{ coluna: "populacao", direcao: "desc" }}
          dicaBusca="Localidade, município ou distribuidora"
        />
        {!todas && (
          <button
            type="button"
            onClick={carregarTodas}
            disabled={carregando}
            className="rotulo inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-carvao hover:bg-energia-fundo disabled:opacity-60"
          >
            {carregando ? "Carregando…" : "Ver todas as localidades do ciclo"}
          </button>
        )}
        {erro && (
          <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
            Não foi possível carregar a lista completa ({erro}). Ela também está em{" "}
            <a href="/energia/series/inclusao_sistemas_isolados.csv" download className="text-energia-dark underline underline-offset-4">
              localidades de sistemas isolados (CSV)
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
