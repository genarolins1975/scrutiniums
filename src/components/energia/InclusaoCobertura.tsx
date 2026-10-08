"use client";

import { useEffect, useMemo, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { InclusaoOpcoes } from "@/components/energia/InclusaoOpcoes";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { NAO_SE_APLICA, quebrasFixas, type ValorClassificavel } from "@/lib/energia/escalas";
import { URL_GEO, type CamadaGeo } from "@/lib/energia/geo";
import {
  COLUNAS_COBERTURA_UF,
  COLUNAS_MUNICIPIOS,
  ESQUEMA_COBERTURA,
  codigoUf,
  dadosSerieCobertura,
  itensFaixaCobertura,
  linhasCoberturaUf,
  mes,
  municipiosDoCsv,
  siglaDoCodigo,
  valoresMapaCobertura,
  type Denominador,
  type MunicipioCobertura,
} from "@/lib/energia/inclusao";
import type { CoberturaUf, SerieCoberturaMensal } from "@/lib/energia/tipos-inclusao";

/**
 * P060, cobertura potencial (PROXY): faturas com Tarifa Social por 100 famílias
 * do Cadastro Único com renda por pessoa até meio salário mínimo. O mapa, a faixa
 * por UF (cadastro atualizado e todas as cadastradas) e a tabela compartilham a UF
 * selecionada na URL; o mapa municipal (malha de 1,3 MB e CSV de 450 KB) só é
 * carregado quando alguém pede.
 *
 * Os cortes do mapa (40, 60, 80 e 100 por 100 famílias) são os mesmos nas UF e nos
 * municípios e coincidem com as faixas do histograma publicado na gold: a mesma cor
 * quer dizer a mesma faixa nos dois mapas. Acima de 100 não é erro: o numerador
 * inclui beneficiários fora do critério de renda.
 */

const CORTES = [40, 60, 80, 100];
const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const OPCOES_DEN: readonly (readonly [Denominador, string])[] = [
  ["atualizadas", "Famílias com cadastro atualizado"],
  ["cadastradas", "Todas as famílias cadastradas"],
];

export function InclusaoCoberturaUf({ ufs, mes: mesRef, fonte }: { ufs: CoberturaUf[]; mes: string; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_COBERTURA);
  const sel = ufs.some((u) => u.uf === v.uf) ? v.uf : null;
  const valores = useMemo(() => valoresMapaCobertura(ufs, v.den), [ufs, v.den]);
  const classes = useMemo(() => quebrasFixas(CORTES, Object.values(valores), { casas: 0 }), [valores]);
  const linhas = useMemo(() => linhasCoberturaUf(ufs), [ufs]);
  const itens = useMemo(() => itensFaixaCobertura(ufs), [ufs]);
  const selecionar = (uf: string | null) => definir({ uf: uf ?? "" });
  return (
    <div className="space-y-6">
      <InclusaoOpcoes rotulo="Denominador do mapa" nome="inclusao-cob-den" opcoes={OPCOES_DEN} valor={v.den} onMudar={(den) => definir({ den })} />
      <MapaCoropletico
        titulo={`Faturas com Tarifa Social por 100 famílias até ½ salário mínimo (${v.den === "atualizadas" ? "cadastro atualizado" : "todas as cadastradas"}), por UF, ${mes(mesRef)}`}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES}
        classificacao={classes}
        unidade="faturas por 100 famílias"
        casas={1}
        rotuloRegiao={{ singular: "UF", plural: "UF" }}
        selecionado={sel ? codigoUf(sel) : null}
        onSelecionar={(id) => selecionar(siglaDoCodigo(id))}
        rotulos
        periodo={mes(mesRef)}
        nota={`Proxy, não taxa de cobertura: fatura não é família. Cortes fixos em ${CORTES.join(", ")}, os mesmos do mapa municipal.`}
      />
      <GraficoPontos
        titulo={`Faixa de sensibilidade ao denominador por UF, ${mes(mesRef)}`}
        itens={itens}
        unidade="por 100 famílias"
        unidadeDiferenca="pontos"
        casas={1}
        rotuloValor="Por 100 famílias com cadastro atualizado"
        rotuloReferencia="Por 100 famílias cadastradas (todas)"
        corValor="var(--cor-energia)"
        corReferencia="var(--serie-referencia)"
        zeroNoEixo
        ordemInicial={{ por: "valor", direcao: "desc" }}
        selecionado={sel}
        onSelecionar={selecionar}
      />
      <TabelaInterativa
        titulo={`Faturas e famílias por UF, ${mes(mesRef)} (proxy)`}
        colunas={COLUNAS_COBERTURA_UF}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={mesRef}
        nomeArquivo="inclusao-cobertura-proxy-uf"
        chaveUrl="cob.tab"
        ordemInicial={{ coluna: "razao_atualizadas", direcao: "desc" }}
        selecionado={sel}
        onSelecionar={selecionar}
        dicaBusca="Nome ou sigla da UF"
        nota="Numerador e denominador do mesmo mês. Famílias atualizadas: cadastro dentro do prazo de atualização exigido para a concessão (requisitos na regra de elegibilidade, modo Auditar)."
      />
    </div>
  );
}

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

export function InclusaoSerieCobertura({ url, unidade }: { url: string; unidade: string }) {
  const [serie, setSerie] = useState<SerieCoberturaMensal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    carregar<SerieCoberturaMensal>(url, "json").then(
      (j) => vivo && setSerie(j),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [url]);
  const dados = useMemo(() => (serie ? dadosSerieCobertura(serie.serie) : []), [serie]);
  if (erro) {
    return (
      <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
        Não foi possível carregar a série mensal ({erro}). O mesmo dado está em{" "}
        <a href="/energia/series/inclusao_cobertura_mensal.csv" download className="text-energia-dark underline underline-offset-4">
          série mensal da cobertura (CSV)
        </a>
        .
      </p>
    );
  }
  if (!serie) {
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Carregando a série mensal nacional (JSON publicado com a gold)…
      </p>
    );
  }
  return (
    <GraficoLinhas
      titulo={`UC com Tarifa Social por 100 famílias até ½ salário mínimo, Brasil, ${mes(serie.serie[0]?.m)} a ${mes(serie.serie.at(-1)?.m)} (proxy)`}
      dados={dados}
      chaveX="m"
      formatoX="mes"
      series={[
        { id: "atualizadas", rotulo: "Por 100 famílias com cadastro atualizado", sigla: "Atualizadas", cor: "var(--cor-energia)" },
        { id: "cadastradas", rotulo: "Por 100 famílias cadastradas (todas)", sigla: "Cadastradas", cor: "var(--serie-referencia)", tracejada: true },
      ]}
      banda={{ inferior: "cadastradas", superior: "atualizadas", rotulo: "Faixa de sensibilidade ao denominador (não é intervalo estatístico)" }}
      unidade={unidade}
      casas={1}
      zeroNoEixo
      zoom
      altura={300}
    />
  );
}

/** Código de 7 dígitos da malha a partir dos 6 dígitos do Cadastro Único (prefixo; nenhuma regra de dígito verificador). */
function mapaCodigos(geo: CamadaGeo): Map<string, string> {
  return new Map(geo.features.map((f) => [f.id.slice(0, 6), f.id]));
}

export function InclusaoMunicipiosCobertura({ csvUrl, mes: mesRef, fonte }: { csvUrl: string; mes: string; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_COBERTURA);
  const [dados, setDados] = useState<{ geo: CamadaGeo; mun: MunicipioCobertura[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = v.mun;
  // seleção municipal na URL (cob.msel), como a da UF: o link copiado e o voltar do navegador trazem o mesmo município
  const selecionar = (id: string | null) => definir({ msel: id ?? "" });

  useEffect(() => {
    if (!ativo || dados) return;
    let vivo = true;
    setErro(null);
    Promise.all([carregar<CamadaGeo>(URL_GEO.municipios, "json"), carregar<string>(csvUrl, "texto")]).then(
      ([geo, txt]) => vivo && setDados({ geo, mun: municipiosDoCsv(txt) }),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [ativo, dados, csvUrl]);

  const montado = useMemo(() => {
    if (!dados) return null;
    const cod7 = mapaCodigos(dados.geo);
    const valores: Record<string, ValorClassificavel> = {};
    const linhas = dados.mun.map((m) => {
      const id = cod7.get(m.cod6) ?? m.cod6;
      valores[id] = m.base_pequena ? NAO_SE_APLICA : v.den === "atualizadas" ? m.razao_atualizadas : m.razao_cadastradas;
      return {
        id,
        municipio: m.municipio,
        uf: m.uf,
        faturas: m.faturas,
        atualizadas: m.atualizadas,
        razao_atualizadas: m.razao_atualizadas,
        razao_cadastradas: m.razao_cadastradas,
        base: m.base_pequena ? "base pequena (fora da distribuição)" : "base suficiente",
      };
    });
    const semGeometria = dados.mun.filter((m) => !cod7.has(m.cod6)).length;
    return { valores, linhas, semGeometria, classes: quebrasFixas(CORTES, Object.values(valores), { casas: 0 }) };
  }, [dados, v.den]);
  const sel = montado && v.msel && montado.linhas.some((l) => l.id === v.msel) ? v.msel : null;

  if (!ativo) {
    return (
      <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3">
        <p className="max-w-prose2 text-sm text-carvao-muted">
          O mapa municipal usa a malha de municípios do IBGE e o CSV de municípios, os dois arquivos mais pesados do módulo; eles só são baixados quando pedidos.
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
  if (erro) {
    return (
      <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
        Não foi possível carregar o mapa municipal ({erro}). Os mesmos números estão em{" "}
        <a href={csvUrl} download className="text-energia-dark underline underline-offset-4">
          famílias e faturas por município (CSV)
        </a>
        .
      </p>
    );
  }
  if (!dados || !montado) {
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Carregando a malha municipal e o CSV de municípios…
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <MapaCoropletico
        titulo={`Faturas com Tarifa Social por 100 famílias até ½ salário mínimo (${v.den === "atualizadas" ? "cadastro atualizado" : "todas as cadastradas"}), por município, ${mes(mesRef)}`}
        geometria={dados.geo}
        valores={montado.valores}
        cores={CORES}
        classificacao={montado.classes}
        unidade="faturas por 100 famílias"
        casas={1}
        rotuloRegiao={{ singular: "município", plural: "municípios" }}
        selecionado={sel}
        onSelecionar={selecionar}
        corNaoSeAplica="var(--mapa-nao-se-aplica)"
        periodo={mes(mesRef)}
        nota={`Cinza liso: base pequena no denominador, fora da distribuição (o limite está nas limitações de \u201cSobre este dado\u201d). Município da fatura é o da unidade consumidora; o do cadastro é o da residência declarada.${montado.semGeometria ? ` ${montado.semGeometria} municípios do CSV sem polígono na malha ficam só na tabela.` : ""}`}
      />
      <TabelaInterativa
        titulo={`Municípios: faturas e famílias, ${mes(mesRef)} (proxy)`}
        colunas={COLUNAS_MUNICIPIOS}
        linhas={montado.linhas}
        chaveLinha="id"
        colunaRotulo="municipio"
        fonte={fonte}
        versao={mesRef}
        nomeArquivo="inclusao-cobertura-proxy-municipios"
        chaveUrl="cob.mtab"
        ordemInicial={{ coluna: "razao_atualizadas", direcao: "asc" }}
        selecionado={sel}
        onSelecionar={selecionar}
        dicaBusca="Nome do município"
        nota="Ordem inicial: menor razão primeiro. Razão baixa não prova exclusão: famílias não titulares da conta e sem ligação à rede contam no denominador."
      />
    </div>
  );
}
