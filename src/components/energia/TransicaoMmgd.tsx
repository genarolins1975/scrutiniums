"use client";

import { useEffect, useMemo, useState } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasFixas, quebrasQuantis, type ValorClassificavel } from "@/lib/energia/escalas";
import { dataBR } from "@/lib/energia/formato";
import { URL_GEO, type CamadaGeo } from "@/lib/energia/geo";
import { LIMITE_COMPARACAO, alternarSelecao } from "@/lib/energia/tabela";
import {
  DIMENSOES_PERFIL,
  ESQUEMA_MMGD,
  LISTAS_DESTAQUE,
  MEDIDAS_MUN,
  MEDIDAS_UF,
  MEDIDA_MUN,
  MEDIDA_UF,
  ROTULO_DESTAQUE,
  ROTULO_DIMENSAO,
  codigoUf,
  colunasMunicipios,
  colunasUfs,
  dadosBarrasUf,
  dadosHistoricoUfs,
  historicoMunicipiosCsv,
  inteiro,
  linhasPerfil,
  mes,
  municipiosDoJson,
  numTexto,
  participacaoTexto,
  pctTexto,
  referenciaUf,
  rotuloMedidaUf,
  siglaDoCodigo,
  valorMunicipio,
  valoresMapaUf,
  type DimensaoPerfil,
  type LinhaDestaque,
  type LinhaMensal,
  type ListaDestaque,
  type LinhaUf,
  type MedidaMun,
  type MedidaUf,
  type MunicipioMmgd,
  type UfAnoCompacto,
} from "@/lib/energia/transicao";
import type { BlocoMmgd, MunicipiosMmgdArquivo } from "@/lib/energia/tipos-transicao";

/**
 * P063, MMGD no território: o mapa por UF, as barras com a referência nacional, a
 * tabela e o histórico de conexões de até quatro UF leem a mesma lista de UF na
 * URL (mmgd.uf); a última escolhida é a que o mapa e a tabela destacam. A série
 * mensal tem o intervalo na URL (mmgd.de e mmgd.ate); o perfil, a dimensão
 * (mmgd.perfil). O mapa municipal (malha de 1,3 MB e JSON de cerca de 600 KB) e o
 * histórico municipal (CSV de 2,3 MB) só são baixados quando alguém pede.
 *
 * Nenhum número é refeito aqui: as linhas vêm de src/lib/energia/transicao.ts.
 * Capacidade cadastrada (kW, MW) nunca aparece como energia.
 */

const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const CORES_COMP = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
const NOME_MEDIDA_UF: Record<MedidaUf, string> = { whab: "W por habitante", mw: "MW instalados", umil: "Unidades por mil hab.", cresc: "Crescimento no ano", mwref: "MW conectados no ano" };
const OPCOES_MUN: readonly (readonly [MedidaMun, string])[] = MEDIDAS_MUN.map((m) => [m, m === "fora" ? "Distribuidora sem conjunto na UF" : MEDIDA_MUN[m].rotulo] as const);

// requisições sob demanda, compartilhadas pelas instâncias; falha não fica em cache
const cache = new Map<string, Promise<unknown>>();
function carregar<T>(url: string, tipo: "json" | "texto"): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (tipo === "json" ? r.json() : r.text()) as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

function Falha({ erro, url, nome }: { erro: string; url: string; nome: string }) {
  return (
    <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
      Não foi possível carregar {nome} ({erro}). Os mesmos números estão em{" "}
      <a href={url} download className="text-energia-dark underline underline-offset-4">
        {url.split("/").at(-1)}
      </a>
      .
    </p>
  );
}

/* ================================================================ por UF */

export function TransicaoMmgdUf({
  linhas,
  ufAnual,
  anoReferencia,
  anoPopulacao,
  primeiroCoberto,
  wPorHabitanteBrasil,
  dataCadastro,
  fonte,
}: {
  linhas: LinhaUf[];
  ufAnual: UfAnoCompacto[];
  anoReferencia: number;
  anoPopulacao: number | null;
  primeiroCoberto: number;
  wPorHabitanteBrasil: number | null;
  dataCadastro: string;
  fonte: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const [aviso, setAviso] = useState("");
  const medida = MEDIDA_UF[v.med];
  const rotuloMed = rotuloMedidaUf(v.med, anoReferencia);
  const escolhidas = useMemo(() => v.ufs.filter((u) => linhas.some((l) => l.uf === u)), [v.ufs, linhas]);
  const ultima = escolhidas.at(-1) ?? null;
  const valores = useMemo(() => valoresMapaUf(linhas, v.med), [linhas, v.med]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), 5, { casas: medida.casas }), [valores, medida.casas]);
  const barras = useMemo(() => dadosBarrasUf(linhas, v.med), [linhas, v.med]);
  const referencias = referenciaUf(wPorHabitanteBrasil, v.med);
  const historico = useMemo(() => dadosHistoricoUfs(ufAnual, escolhidas, primeiroCoberto), [ufAnual, escolhidas, primeiroCoberto]);
  const entidades = useMemo(() => linhas.map((l) => ({ id: l.uf, rotulo: `${l.nome} (${l.uf})`, sinonimos: [l.uf] })), [linhas]);
  const colunas = useMemo(() => colunasUfs(anoReferencia, anoPopulacao), [anoReferencia, anoPopulacao]);
  const opcoes = MEDIDAS_UF.map((m) => [m, NOME_MEDIDA_UF[m]] as const);

  const alternar = (uf: string | null) => {
    if (!uf) {
      if (ultima) definir({ ufs: escolhidas.filter((x) => x !== ultima) });
      return;
    }
    const r = alternarSelecao(escolhidas, uf, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(`Limite de ${LIMITE_COMPARACAO} UF na comparação: remova uma para incluir ${uf}.`);
      return;
    }
    setAviso("");
    definir({ ufs: r.ids });
  };

  return (
    <div className="space-y-6">
      <TransicaoOpcoes rotulo="Medida do mapa e das barras" nome="transicao-mmgd-med" opcoes={opcoes} valor={v.med} onMudar={(med) => definir({ med })} />
      <MapaCoropletico
        titulo={`${rotuloMed} por UF, cadastro de ${dataBR(dataCadastro)}`}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES_MAPA}
        classificacao={classes}
        unidade={medida.unidade}
        casas={medida.casas}
        rotuloRegiao={{ singular: "UF", plural: "UF" }}
        selecionado={ultima ? codigoUf(ultima) : null}
        onSelecionar={(id) => alternar(siglaDoCodigo(id))}
        rotulos
        nota="Classes por quantis (cinco grupos com o mesmo número de UF). Capacidade cadastrada, não energia gerada. Clique numa UF para incluí-la na comparação (até quatro); clicar de novo a retira."
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <GraficoBarras
        titulo={`${rotuloMed} por UF, em ordem decrescente`}
        dados={barras}
        chaveCategoria="id"
        chaveRotulo="nome"
        series={[{ id: "valor", rotulo: rotuloMed, cor: "var(--serie-solar)" }]}
        unidade={medida.unidade}
        casas={medida.casas}
        orientacao="horizontal"
        referencias={referencias}
        selecionado={ultima}
        onSelecionar={(id) => alternar(id)}
        alturaMaxima={520}
      />
      {referencias.length === 0 && (
        <p className="max-w-prose2 text-sm text-carvao-muted">
          Referência nacional só na potência por habitante, a única medida desta lista com valor do Brasil publicado pelo pipeline; nas demais, compare as UF entre si.
        </p>
      )}
      <TabelaInterativa
        titulo={`MMGD por UF, cadastro de ${dataBR(dataCadastro)}`}
        colunas={colunas}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={dataCadastro}
        nomeArquivo="transicao-mmgd-uf"
        chaveUrl="mmgd.tab"
        ordemInicial={{ coluna: MEDIDA_UF[v.med].campo, direcao: "desc" }}
        selecionado={ultima}
        onSelecionar={(id) => alternar(id)}
        dicaBusca="Nome ou sigla da UF"
        nota={`Por habitante: população estimada pelo IBGE${anoPopulacao ? ` para ${anoPopulacao}` : ""}. Crescimento do estoque: potência conectada em ${anoReferencia} sobre o estoque do fim de ${anoReferencia - 1}.`}
      />
      <div className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Como as UF escolhidas acrescentaram potência ano a ano?</h3>
        <Comparador
          rotulo="UF no histórico (até 4)"
          entidades={entidades}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ ufs: ids })}
          dicaBusca="Nome ou sigla da UF"
          vazio="Nenhuma UF escolhida. Escolha aqui, no mapa, nas barras ou na tabela para ver as conexões por ano na mesma escala."
        >
          {() => null}
        </Comparador>
        {historico.length > 0 && (
          <GraficoLinhas
            titulo={`Potência conectada por ano: ${escolhidas.join(", ")} (o último ano é parcial)`}
            dados={historico}
            chaveX="ano"
            formatoX="texto"
            series={escolhidas.map((uf, i) => ({ id: uf, rotulo: uf, sigla: uf, cor: CORES_COMP[i % CORES_COMP.length] }))}
            unidade="MW"
            casas={1}
            zeroNoEixo
            altura={280}
          />
        )}
        {historico.length > 0 && (
          <p className="max-w-prose2 text-sm text-carvao-muted">
            Ano anterior à primeira conexão da UF, dentro da cobertura declarada pela ANEEL (a partir de {primeiroCoberto}), vale zero: o cadastro é completo e não tem conexão ali.
            Antes dessa data, sem registro é lacuna. O último ano vai só até a data do cadastro e não compete com os anos completos.
          </p>
        )}
      </div>
    </div>
  );
}

/* ================================================================ série mensal */

export function TransicaoMmgdMensal({ dados, corte }: { dados: LinhaMensal[]; corte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;
  const onIntervalo = (i: { inicio: string; fim: string } | null) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" });
  return (
    <CursorSincronizado>
      <div className="space-y-5">
        <GraficoLinhas
          titulo="Potência conectada por mês de conexão, Brasil"
          dados={dados}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "consolidado", rotulo: "Conectada no mês", sigla: "Consolidado", cor: "var(--serie-solar)" },
            { id: "provisorio", rotulo: `Provisório (depois de ${mes(corte)})`, sigla: "Provisório", cor: "var(--serie-referencia)", tracejada: true },
          ]}
          unidade="MW"
          casas={1}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={onIntervalo}
          altura={280}
        />
        <GraficoLinhas
          titulo="Estoque cadastrado ao fim de cada mês, Brasil"
          dados={dados}
          chaveX="m"
          formatoX="mes"
          series={[{ id: "acumulado_mw", rotulo: "Estoque de potência instalada", sigla: "Estoque", cor: "var(--cor-energia)" }]}
          unidade="MW"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={onIntervalo}
          altura={220}
        />
      </div>
    </CursorSincronizado>
  );
}

/* ================================================================ perfil */

export function TransicaoMmgdPerfil({ perfis, anoReferencia }: { perfis: BlocoMmgd["perfis"]; anoReferencia: number }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const linhas = useMemo(() => linhasPerfil(perfis, v.perfil), [perfis, v.perfil]);
  const opcoes = DIMENSOES_PERFIL.map((d) => [d, ROTULO_DIMENSAO[d]] as const) as readonly (readonly [DimensaoPerfil, string])[];
  const titulo = `${ROTULO_DIMENSAO[v.perfil]}: potência instalada cadastrada`;
  return (
    <div className="space-y-4">
      <TransicaoOpcoes rotulo="Dimensão" nome="transicao-mmgd-perfil" opcoes={opcoes} valor={v.perfil} onMudar={(perfil) => definir({ perfil })} />
      <GraficoBarras
        titulo={titulo}
        dados={linhas}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[{ id: "potencia_mw", rotulo: "Potência instalada", cor: "var(--serie-solar)" }]}
        unidade="MW"
        casas={1}
        orientacao="horizontal"
        rotulosValor
      />
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${ROTULO_DIMENSAO[v.perfil]} (tabela rolável)`}>
        <table className="w-full min-w-[34rem] border-collapse text-xs tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">{ROTULO_DIMENSAO[v.perfil]}: unidades, potência e participação</caption>
          <thead>
            <tr>
              {["Categoria", "Unidades", "Participação nas unidades", "Potência (MW)", `Unidades em ${anoReferencia}`, `Potência em ${anoReferencia} (MW)`].map((c, i) => (
                <th key={c} scope="col" className={`border-b border-linha px-2 py-1.5 font-medium text-mineral ${i ? "text-right" : "text-left"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-linha last:border-b-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                  {l.rotulo}
                  {l.rotulo !== l.id && <span className="ml-1 text-carvao-muted">({l.id})</span>}
                </th>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(l.unidades)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{participacaoTexto(l.participacao_unidades_pct)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">
                  {numTexto(l.potencia_mw, 1)}
                  {l.unidades_sem_potencia > 0 && <span className="ml-1 text-carvao-muted">(parcial: {inteiro(l.unidades_sem_potencia)} sem potência)</span>}
                </td>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(l.unidades_ano_referencia)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{numTexto(l.potencia_mw_ano_referencia, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-prose2 text-sm text-carvao-muted">
        Categorias como a ANEEL publica (o código original fica entre parênteses quando o rótulo foi acentuado). Participação abaixo de 0,01% com dois algarismos significativos, para que
        uma categoria pequena não apareça como zero.
      </p>
    </div>
  );
}

/* ================================================================ destaques municipais */

/**
 * Rankings municipais publicados na gold (população de pelo menos o mínimo da
 * gold e potência completa), um por vez, com a lista escolhida na URL (mmgd.rank).
 */
export function TransicaoDestaques({ listas, anoReferencia, populacaoMinima }: { listas: Record<ListaDestaque, LinhaDestaque[]>; anoReferencia: number; populacaoMinima: number }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const linhas = listas[v.rank] ?? [];
  const opcoes = LISTAS_DESTAQUE.map((k) => [k, ROTULO_DESTAQUE[k]] as const) as readonly (readonly [ListaDestaque, string])[];
  return (
    <div className="space-y-3">
      <TransicaoOpcoes rotulo="Ranking" nome="transicao-mmgd-rank" opcoes={opcoes} valor={v.rank} onMudar={(rank) => definir({ rank })} />
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${ROTULO_DESTAQUE[v.rank]} (tabela rolável)`}>
        <table className="w-full min-w-[36rem] border-collapse text-xs tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">
            {ROTULO_DESTAQUE[v.rank]}
            {v.rank === "maior_crescimento_estoque" ? ` (${anoReferencia})` : ""}: municípios com pelo menos {inteiro(populacaoMinima)} habitantes
          </caption>
          <thead>
            <tr>
              {["Município", "Unidades", "Potência (kW)", "População", "W/hab", `Crescimento do estoque em ${anoReferencia}`, "Distribuidora sem conjunto na UF"].map((c, i) => (
                <th key={c} scope="col" className={`border-b border-linha px-2 py-1.5 font-medium text-mineral ${i ? "text-right" : "text-left"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((x) => (
              <tr key={x.id} className="border-b border-linha last:border-b-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                  {x.posicao}. {x.municipio} ({x.uf})
                </th>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(x.unidades)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{numTexto(x.potencia_kw, 0)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(x.populacao)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{numTexto(x.w_por_habitante, 1)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{pctTexto(x.crescimento_estoque_pct, 1)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(x.unidades_distribuidora_fora_da_uf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================ municípios */

/** Código e nome dos municípios para o comparador; o código IBGE é a chave, o nome só rótulo. */
function entidadesMunicipios(mun: readonly MunicipioMmgd[]) {
  return mun.map((m) => ({ id: m.id, rotulo: `${m.municipio} (${m.uf})`, detalhe: m.id, sinonimos: [m.id] }));
}

export function TransicaoMunicipios({
  jsonUrl,
  csvUrl,
  anoReferencia,
  anoPopulacao,
  anoFinal,
  primeiroCoberto,
  fonte,
  versao,
}: {
  jsonUrl: string;
  csvUrl: string;
  anoReferencia: number;
  anoPopulacao: number | null;
  anoFinal: number;
  primeiroCoberto: number;
  fonte: string;
  versao: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const [dados, setDados] = useState<{ geo: CamadaGeo; mun: MunicipioMmgd[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [erroCsv, setErroCsv] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  // o link com municípios escolhidos abre o mapa: a seleção não fica escondida atrás do botão
  const ativo = v.mun || v.muns.length > 0;

  useEffect(() => {
    if (!ativo || dados) return;
    let vivo = true;
    setErro(null);
    Promise.all([carregar<CamadaGeo>(URL_GEO.municipios, "json"), carregar<MunicipiosMmgdArquivo>(jsonUrl, "json")]).then(
      ([geo, arq]) => vivo && setDados({ geo, mun: municipiosDoJson(arq) }),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [ativo, dados, jsonUrl]);

  const escolhidos = useMemo(() => (dados ? v.muns.filter((id) => dados.mun.some((m) => m.id === id)) : v.muns), [dados, v.muns]);
  const ultimo = escolhidos.at(-1) ?? null;
  const precisaCsv = escolhidos.length > 0;

  useEffect(() => {
    if (!precisaCsv || csv) return;
    let vivo = true;
    setErroCsv(null);
    carregar<string>(csvUrl, "texto").then(
      (t) => vivo && setCsv(t),
      (e: unknown) => vivo && setErroCsv(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [precisaCsv, csv, csvUrl]);

  const montado = useMemo(() => {
    if (!dados) return null;
    const valores: Record<string, ValorClassificavel> = {};
    for (const m of dados.mun) valores[m.id] = valorMunicipio(m, v.mmed);
    const nums = Object.values(valores);
    const classes = v.mmed === "fora" ? quebrasFixas([1, 10, 50, 100], nums, { casas: 0 }) : quebrasQuantis(nums, 5, { casas: MEDIDA_MUN[v.mmed].casas });
    const comPoligono = new Set(dados.geo.features.map((f) => f.id));
    const semGeometria = dados.mun.filter((m) => !comPoligono.has(m.id)).length;
    return { valores, classes, semGeometria, entidades: entidadesMunicipios(dados.mun) };
  }, [dados, v.mmed]);

  const historico = useMemo(
    () => (csv && escolhidos.length ? historicoMunicipiosCsv(csv, escolhidos, anoFinal, primeiroCoberto) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
    [csv, escolhidos.join(","), anoFinal, primeiroCoberto],
  );
  const nomeDe = (id: string) => dados?.mun.find((m) => m.id === id)?.municipio ?? id;

  const alternar = (id: string | null) => {
    if (!id) {
      if (ultimo) definir({ muns: escolhidos.filter((x) => x !== ultimo) });
      return;
    }
    const r = alternarSelecao(escolhidos, id, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(`Limite de ${LIMITE_COMPARACAO} municípios na comparação: remova um para incluir outro.`);
      return;
    }
    setAviso("");
    definir({ muns: r.ids });
  };

  if (!ativo) {
    return (
      <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3">
        <p className="max-w-prose2 text-sm text-carvao-muted">
          O mapa municipal usa a malha de municípios do IBGE e o JSON de municípios do módulo, os dois arquivos mais pesados da página; eles só são baixados quando pedidos.
        </p>
        <button
          type="button"
          onClick={() => definir({ mun: true })}
          className="rotulo inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-carvao hover:bg-energia-fundo"
        >
          Carregar o mapa por município
        </button>
      </div>
    );
  }
  if (erro) return <Falha erro={erro} url={jsonUrl} nome="o mapa municipal" />;
  if (!dados || !montado) {
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Carregando a malha municipal e o JSON de municípios…
      </p>
    );
  }
  const med = MEDIDA_MUN[v.mmed];
  return (
    <div className="space-y-5">
      <TransicaoOpcoes rotulo="Medida do mapa municipal" nome="transicao-mmgd-mmed" opcoes={OPCOES_MUN} valor={v.mmed} onMudar={(mmed) => definir({ mmed })} />
      <MapaCoropletico
        titulo={`${med.rotulo} por município${v.mmed === "cresc" ? ` (${anoReferencia})` : ""}`}
        geometria={dados.geo}
        valores={montado.valores}
        cores={CORES_MAPA}
        classificacao={montado.classes}
        unidade={med.unidade}
        casas={med.casas}
        rotuloRegiao={{ singular: "município", plural: "municípios" }}
        selecionado={ultimo}
        onSelecionar={alternar}
        contornos
        nota={`${v.mmed === "fora" ? "Cortes fixos em 1, 10, 50 e 100 unidades; zero fica na primeira classe. Unidades cuja distribuidora (CNPJ) não tem conjunto elétrico na UF: algum campo está errado na origem, e nada é corrigido." : "Classes por quantis. O município é o da unidade geradora; no autoconsumo remoto e na geração compartilhada o crédito pode ser usado em outro município."}${montado.semGeometria ? ` ${montado.semGeometria} municípios sem polígono na malha ficam só na tabela.` : ""} Clique para incluir o município na comparação (até quatro).`}
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <TabelaInterativa
        titulo="MMGD por município"
        colunas={colunasMunicipios(anoReferencia, anoPopulacao)}
        linhas={dados.mun}
        chaveLinha="id"
        colunaRotulo="municipio"
        fonte={fonte}
        versao={versao}
        nomeArquivo="transicao-mmgd-municipios"
        chaveUrl="mmgd.mtab"
        ordemInicial={{ coluna: "potencia_kw", direcao: "desc" }}
        selecionado={ultimo}
        onSelecionar={alternar}
        dicaBusca="Nome do município ou código IBGE"
        nota="Município sem população estimada fica sem razão por habitante (nunca zero). A classe de provável município errado é a única que pode inflar a potência por habitante do município publicado."
      />
      <div className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Como os municípios escolhidos acrescentaram potência ano a ano?</h3>
        <Comparador
          rotulo="Municípios no histórico (até 4)"
          entidades={montado.entidades}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ muns: ids })}
          dicaBusca="Nome do município ou código IBGE"
          vazio="Nenhum município escolhido. Escolha aqui, no mapa ou na tabela."
        >
          {() => null}
        </Comparador>
        {precisaCsv && !csv && !erroCsv && (
          <p role="status" className="text-sm text-carvao-muted">
            Carregando o histórico por município (CSV publicado, cerca de 2 MB)…
          </p>
        )}
        {erroCsv && <Falha erro={erroCsv} url={csvUrl} nome="o histórico por município" />}
        {historico && historico.linhas.length > 0 && (
          <>
            <GraficoLinhas
              titulo={`Potência conectada por ano, soma das fontes: ${escolhidos.map(nomeDe).join(", ")} (o último ano é parcial)`}
              dados={historico.linhas}
              chaveX="ano"
              formatoX="texto"
              series={escolhidos.map((id, i) => ({ id, rotulo: nomeDe(id), cor: CORES_COMP[i % CORES_COMP.length] }))}
              unidade="kW"
              casas={0}
              zeroNoEixo
              altura={280}
            />
            <p className="max-w-prose2 text-sm text-carvao-muted">
              Soma das fontes de cada município e ano, lida do CSV municipal por ano e fonte. Dentro da cobertura declarada pela ANEEL (a partir de {primeiroCoberto}), ano sem
              conexão vale zero; antes dela, é lacuna.
              {historico.parciais > 0 ? ` ${inteiro(historico.parciais)} unidades sem potência informada deixam o ano correspondente sem valor.` : ""}
              {historico.semData > 0 ? ` ${inteiro(historico.semData)} unidades com data de conexão inválida no cadastro estão no total do município, mas fora dos anos.` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
