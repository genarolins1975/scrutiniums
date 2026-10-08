"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno } from "@/lib/energia/formato";
import { CAMPO_DIST, linhasEventos, linhasHistorico, respostaHistorico, rotuloDistribuidora, type LinhaEvolucao } from "@/lib/energia/conta";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { HistoricoB1 } from "@/lib/energia/tipos-conta";

/**
 * P047, histórico: a tarifa B1 de até quatro distribuidoras no dia 1º de cada
 * mês, sobre a mediana nacional e a faixa entre o 1º e o 3º quartil. O histórico
 * por distribuidora (vigências e mudanças, cerca de 330 KB) fica fora da gold e
 * só é baixado quando alguém escolhe uma distribuidora (contrato, seção 5.1); sem
 * escolha, o gráfico mostra só a mediana publicada na gold.
 *
 * Seleção na URL (?dist=, compartilhada com o ranking, a composição, o simulador
 * e os reajustes) e intervalo do zoom na URL (?de=&ate=), com voltar e avançar.
 * As cores das distribuidoras ficam presas a cada uma enquanto ela estiver
 * escolhida: trocar o destaque não repinta as outras.
 */

const ESQUEMA = {
  dist: CAMPO_DIST,
  de: campo(tiposUrl.mes(), "", { param: "de" }),
  ate: campo(tiposUrl.mes(), "", { param: "ate" }),
};

const CORES = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];

const COLUNAS_EVENTOS: ColunaTabela[] = [
  { id: "data", rotulo: "Data", tipo: "data" },
  { id: "ato", rotulo: "Ato da ANEEL", tipo: "texto" },
  {
    id: "antes",
    rotulo: "Antes (TE + TUSD)",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  {
    id: "depois",
    rotulo: "Depois (TE + TUSD)",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  { id: "variacao", rotulo: "Variação", tipo: "percentual", casas: 2 },
  { id: "variacao_te", rotulo: "Variação da TE", tipo: "percentual", casas: 2 },
  {
    id: "variacao_tusd",
    rotulo: "Variação da TUSD",
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "ipca",
    rotulo: "IPCA desde a mudança anterior",
    tipo: "percentual",
    casas: 2,
  },
  { id: "meses_ipca", rotulo: "Meses do IPCA", tipo: "texto" },
  { id: "perimetro", rotulo: "Mudança de perímetro (ato)", tipo: "texto" },
];

// uma só requisição por visita, compartilhada por todas as instâncias
let promessa: Promise<HistoricoB1> | null = null;
function carregar(url: string): Promise<HistoricoB1> {
  if (!promessa) {
    promessa = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<HistoricoB1>;
    });
    promessa.catch(() => {
      promessa = null; // falha não fica em cache: a próxima escolha tenta de novo
    });
  }
  return promessa;
}

export type EntidadeHistorico = {
  id: string;
  rotulo: string;
  detalhe?: string;
  /** O CNPJ entra como sinônimo: a busca do comparador acha a distribuidora pelo número. */
  sinonimos?: string[];
};

export type ContaHistoricoProps = {
  evolucao: LinhaEvolucao[];
  entidades: EntidadeHistorico[];
  historicoUrl: string;
  ultimoIpca: string | null;
  fonte: string;
  dataReferencia: string;
};

export function ContaHistorico({ evolucao, entidades, historicoUrl, ultimoIpca, fonte, dataReferencia }: ContaHistoricoProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const [hist, setHist] = useState<HistoricoB1 | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const precisa = v.dist.length > 0;

  useEffect(() => {
    if (!precisa || hist) return;
    let vivo = true;
    setErro(null);
    carregar(historicoUrl)
      .then((h) => vivo && setHist(h))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [precisa, hist, historicoUrl]);

  // cor presa à distribuidora enquanto ela estiver escolhida
  const slots = useRef(new Map<string, number>());
  const cores = useMemo(() => {
    const m = slots.current;
    for (const k of Array.from(m.keys())) if (!v.dist.includes(k)) m.delete(k);
    for (const id of v.dist) {
      if (m.has(id)) continue;
      const usados = new Set(m.values());
      const livre = [0, 1, 2, 3].find((i) => !usados.has(i)) ?? 0;
      m.set(id, livre);
    }
    return new Map(Array.from(m.entries()).map(([id, i]) => [id, CORES[i]]));
  }, [v.dist]);

  const porId = useMemo(() => new Map(entidades.map((e) => [e.id, e])), [entidades]);
  const escolhidas = v.dist.filter((id) => porId.has(id));
  const historicos = useMemo(() => {
    const out: Record<string, HistoricoB1["distribuidoras"][string]["vigencias"]> = {};
    if (!hist) return out;
    for (const id of escolhidas) {
      const d = hist.distribuidoras[id];
      if (d) out[id] = d.vigencias;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
  }, [hist, escolhidas.join(",")]);

  const dados = useMemo(() => linhasHistorico(evolucao, historicos), [evolucao, historicos]);
  const series = [
    {
      id: "mediana",
      rotulo: "Mediana entre distribuidoras",
      sigla: "Mediana",
      cor: "var(--serie-referencia)",
      espessura: 2.5,
    },
    ...(ultimoIpca
      ? [
          {
            id: "real",
            rotulo: `Mediana em R$ de ${mesAno(`${ultimoIpca}-01`)} (IPCA)`,
            sigla: "Real",
            cor: "var(--serie-referencia)",
            tracejada: true,
          },
        ]
      : []),
    ...Object.keys(historicos).map((id) => ({
      id,
      rotulo: porId.get(id)?.rotulo ?? id,
      cor: cores.get(id) ?? CORES[0],
    })),
  ];

  // marcos: só mudanças de perímetro (incorporações) das escolhidas; todas as mudanças estão na tabela
  const marcos = useMemo(() => {
    if (!hist) return [];
    const vistos = new Set<string>();
    const out: { x: string; rotulo: string }[] = [];
    for (const id of escolhidas) {
      for (const inc of hist.distribuidoras[id]?.incorporacoes ?? []) {
        const x = inc.data.slice(0, 7);
        if (vistos.has(x)) continue;
        vistos.add(x);
        out.push({ x, rotulo: `${porId.get(id)?.rotulo ?? id}: incorporação` });
      }
    }
    return out.sort((a, b) => (a.x < b.x ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
  }, [hist, escolhidas.join(","), porId]);

  const destaque = escolhidas[0] ?? null;
  const dDestaque = destaque && hist ? hist.distribuidoras[destaque] : null;
  const eventos = useMemo(() => (dDestaque ? linhasEventos(dDestaque.eventos) : []), [dDestaque]);
  const nomeDestaque = destaque ? (porId.get(destaque)?.rotulo ?? destaque) : "";
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;

  return (
    <div className="space-y-5">
      <Comparador
        rotulo="Distribuidoras no histórico (até 4; a primeira fica em destaque)"
        entidades={entidades}
        selecionadas={v.dist}
        onMudar={(ids) => definir({ dist: ids })}
        dicaBusca="Sigla, razão social ou CNPJ"
        vazio="Nenhuma distribuidora escolhida: o gráfico mostra só a mediana nacional. Escolha aqui ou clique numa barra do ranking."
      >
        {() => null}
      </Comparador>

      {precisa && !hist && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          Carregando o histórico das distribuidoras (arquivo de vigências e mudanças da tarifa B1)…
        </p>
      )}
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          Não foi possível carregar o histórico ({erro}). O gráfico mostra só a mediana; o arquivo completo está em{" "}
          <a href={historicoUrl} download className="text-energia-dark underline underline-offset-4">
            histórico da tarifa B1 por distribuidora (JSON)
          </a>
          .
        </p>
      )}

      <GraficoLinhas
        titulo="Tarifa B1 residencial no dia 1º de cada mês: distribuidoras escolhidas e mediana nacional"
        dados={dados}
        chaveX="m"
        formatoX="mes"
        series={series}
        unidade="R$/MWh"
        casas={2}
        banda={{
          inferior: "p25",
          superior: "p75",
          rotulo: "Entre o 1º e o 3º quartil das distribuidoras",
        }}
        marcos={marcos}
        zoom
        intervalo={intervalo}
        onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        legendaInterativa
        ocultasIniciais={["real"]}
        altura={340}
      />

      {dDestaque && (
        <div className="space-y-3">
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite">
            {respostaHistorico(rotuloDistribuidora(dDestaque.sigla, destaque!), dDestaque.eventos, dDestaque.vigencias)}
          </p>
          {dDestaque.incorporada_por && (
            <p className="text-sm text-carvao-muted">
              Incorporada pela distribuidora de CNPJ {dDestaque.incorporada_por.cnpj} ({dDestaque.incorporada_por.ato}
              ); a tarifa unificada começa em {dataBR(dDestaque.incorporada_por.data)}.
            </p>
          )}
          <TabelaInterativa
            titulo={`Mudanças da tarifa B1 de ${nomeDestaque}`}
            colunas={COLUNAS_EVENTOS}
            linhas={eventos}
            chaveLinha="id"
            colunaRotulo="data"
            fonte={fonte}
            versao={dataReferencia}
            nomeArquivo={`conta-mudancas-b1-${destaque}`}
            tamanhoPagina={25}
            semLinhas="A distribuidora tem uma só vigência no arquivo: nenhuma mudança a mostrar."
            nota="Variação entre vigências contíguas da tarifa B1 residencial; não é o efeito médio do processo tarifário. Mudança de perímetro compara áreas diferentes."
          />
        </div>
      )}
    </div>
  );
}
