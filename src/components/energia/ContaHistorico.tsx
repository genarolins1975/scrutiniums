"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { aoEntrarComRecorte, hrefEntrar } from "@/components/acesso/sessao";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno } from "@/lib/energia/formato";
import type { Idioma } from "@/lib/idioma";
import { txEm } from "@/lib/energia/i18n/conta-inclusao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { CAMPO_DIST, expandirEntidades, linhasEventos, linhasHistorico, respostaHistorico, rotuloDistribuidora, type EntidadeCompacta, type LinhaEvolucao } from "@/lib/energia/conta";
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
  de: campo(tiposUrl.mes(), "", { param: "de" }), // i18n: dado
  ate: campo(tiposUrl.mes(), "", { param: "ate" }),
};

const CORES = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];

function colunasEventos(idioma: Idioma): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "data", rotulo: tx("Data", "Date"), tipo: "data" },
    {
      id: "ato",
      rotulo: tx("Ato da ANEEL", "ANEEL act"),
      tipo: "texto",
      idiomaTexto: "nome",
      literal: { classe: "ato-retificacao-sem-numero", origem: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica" },
    },
    {
      id: "antes",
      rotulo: tx("Antes (TE + TUSD)", "Before (TE + TUSD)"),
      tipo: "numero",
      unidade: "R$/MWh",
      casas: 2,
    },
    {
      id: "depois",
      rotulo: tx("Depois (TE + TUSD)", "After (TE + TUSD)"),
      tipo: "numero",
      unidade: "R$/MWh",
      casas: 2,
    },
    { id: "variacao", rotulo: tx("Variação", "Change"), tipo: "percentual", casas: 2 },
    { id: "variacao_te", rotulo: tx("Variação da TE", "Change in TE"), tipo: "percentual", casas: 2 },
    {
      id: "variacao_tusd",
      rotulo: tx("Variação da TUSD", "Change in TUSD"),
      tipo: "percentual",
      casas: 2,
    },
    {
      id: "ipca",
      rotulo: tx("IPCA desde a mudança anterior", "IPCA since the previous change"),
      tipo: "percentual",
      casas: 2,
    },
    { id: "meses_ipca", rotulo: tx("Meses do IPCA", "IPCA months"), tipo: "texto" },
    { id: "perimetro", rotulo: tx("Mudança de perímetro (ato)", "Perimeter change (act)"), tipo: "texto" },
  ];
}

/** Erro de quem não tem sessão: o arquivo do histórico está em caminho fechado (src/lib/rotasPublicas.ts). */
const SEM_CONTA = "sem-conta";

// uma só requisição por visita, compartilhada por todas as instâncias
let promessa: Promise<HistoricoB1> | null = null;
function carregar(url: string): Promise<HistoricoB1> {
  if (!promessa) {
    promessa = fetch(url).then((r) => {
      // sem sessão, o arquivo (caminho fechado) responde com o login: o histórico por distribuidora fica com conta
      if (r.status === 401 || (r.redirected && /\/entrar\/?$/.test(new URL(r.url).pathname))) throw new Error(SEM_CONTA);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<HistoricoB1>;
    });
    promessa.catch(() => {
      promessa = null; // falha não fica em cache: a próxima escolha tenta de novo
    });
  }
  return promessa;
}

export type ContaHistoricoProps = {
  evolucao: LinhaEvolucao[];
  /** As distribuidoras que o comparador busca, em tuplas (`compactarEntidades`): o CNPJ entra como sinônimo, e a busca acha a distribuidora pelo número. */
  entidades: EntidadeCompacta[];
  historicoUrl: string;
  ultimoIpca: string | null;
  fonte: string;
  dataReferencia: string;
};

export function ContaHistorico({ evolucao, entidades: compactas, historicoUrl, ultimoIpca, fonte, dataReferencia }: ContaHistoricoProps) {
  const idioma = useIdioma();
  const tx = useTx();
  const caminho = usePathname() ?? "/setor-eletrico/conta-de-luz";
  const entidades = useMemo(() => expandirEntidades(compactas, idioma), [compactas, idioma]);
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
      rotulo: tx("Mediana entre distribuidoras", "Median across distribution utilities"),
      sigla: tx("Mediana", "Median"),
      cor: "var(--serie-referencia)",
      espessura: 2.5,
    },
    ...(ultimoIpca
      ? [
          {
            id: "real",
            rotulo: tx(`Mediana em R$ de ${mesAno(`${ultimoIpca}-01`, idioma)} (IPCA)`, `Median in ${mesAno(`${ultimoIpca}-01`, idioma)} R$ (IPCA)`),
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
        out.push({ x, rotulo: tx(`${porId.get(id)?.rotulo ?? id}: incorporação`, `${porId.get(id)?.rotulo ?? id}: merger`) });
      }
    }
    return out.sort((a, b) => (a.x < b.x ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
  }, [hist, escolhidas.join(","), porId, idioma]);

  const destaque = escolhidas[0] ?? null;
  const dDestaque = destaque && hist ? hist.distribuidoras[destaque] : null;
  const eventos = useMemo(() => (dDestaque ? linhasEventos(dDestaque.eventos, idioma) : []), [dDestaque, idioma]);
  const nomeDestaque = destaque ? (porId.get(destaque)?.rotulo ?? destaque) : "";
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;

  return (
    <div className="space-y-5">
      <Comparador
        rotulo={tx("Distribuidoras no histórico (até 4; a primeira fica em destaque)", "Distribution utilities in the history (up to 4; the first is highlighted)")}
        entidades={entidades}
        selecionadas={v.dist}
        onMudar={(ids) => definir({ dist: ids })}
        dicaBusca={tx("Sigla, razão social ou CNPJ", "Acronym, legal name or CNPJ")}
        vazio={tx(
          "Nenhuma distribuidora escolhida: o gráfico mostra só a mediana nacional. Escolha aqui ou clique numa barra do ranking.",
          "No distribution utility chosen: the chart shows only the national median. Choose here or click a bar in the ranking.",
        )}
      >
        {() => null}
      </Comparador>

      {precisa && !hist && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          {tx(
            "Carregando o histórico das distribuidoras (arquivo de vigências e mudanças da tarifa B1)…",
            "Loading the distribution utilities' history (file of B1 tariff validity periods and changes)…",
          )}
        </p>
      )}
      {erro === SEM_CONTA && (
        <p role="status" data-historico-com-conta="" className="border-l-2 border-energia bg-papel px-4 py-3 text-sm leading-relaxed text-carvao">
          {tx(
            "O histórico de cada distribuidora (vigências e mudanças da tarifa B1) fica com a conta gratuita. Sem conta, o gráfico mostra a mediana nacional e a faixa entre quartis.",
            "Each distribution utility's history (B1 tariff validity periods and changes) is kept for the free account. Without an account, the chart shows the national median and the interquartile band.",
          )}{" "}
          <a href={hrefEntrar(caminho)} onClick={aoEntrarComRecorte} className="text-energia-dark underline underline-offset-4">
            {tx("Entrar ou criar conta gratuita", "Sign in or create a free account")}
            <SeloComConta sempre />
          </a>
        </p>
      )}
      {erro && erro !== SEM_CONTA && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          {tx(
            <>Não foi possível carregar o histórico ({erro}). O gráfico mostra só a mediana; o arquivo completo está em</>,
            <>The history could not be loaded ({erro}). The chart shows only the median; the full file is at</>,
          )}{" "}
          <a href={historicoUrl} download className="text-energia-dark underline underline-offset-4">
            {tx("histórico da tarifa B1 por distribuidora (JSON)", "B1 tariff history by distribution utility (JSON)")}
            <SeloComConta href={historicoUrl} />
          </a>
          .
        </p>
      )}

      <GraficoLinhas
        titulo={tx(
          "Tarifa B1 residencial no dia 1º de cada mês: distribuidoras escolhidas e mediana nacional",
          "Residential B1 tariff on the 1st of each month: chosen distribution utilities and national median",
        )}
        dados={dados}
        chaveX="m"
        formatoX="mes"
        series={series}
        unidade="R$/MWh"
        casas={2}
        banda={{
          inferior: "p25",
          superior: "p75",
          rotulo: tx("Entre o 1º e o 3º quartil das distribuidoras", "Between the 1st and 3rd quartile of the distribution utilities"),
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
            {respostaHistorico(rotuloDistribuidora(dDestaque.sigla, destaque!), dDestaque.eventos, dDestaque.vigencias, idioma)}
          </p>
          {dDestaque.incorporada_por && (
            <p className="text-sm text-carvao-muted">
              {tx(
                <>
                  Incorporada pela distribuidora de CNPJ {dDestaque.incorporada_por.cnpj} ({dDestaque.incorporada_por.ato}
                  ); a tarifa unificada começa em {dataBR(dDestaque.incorporada_por.data, idioma)}.
                </>,
                <>
                  Merged into the distribution utility with CNPJ {dDestaque.incorporada_por.cnpj} ({dDestaque.incorporada_por.ato}
                  ); the unified tariff starts on {dataBR(dDestaque.incorporada_por.data, idioma)}.
                </>,
              )}
            </p>
          )}
          <TabelaInterativa
            titulo={tx(`Mudanças da tarifa B1 de ${nomeDestaque}`, `Changes in the B1 tariff of ${nomeDestaque}`)}
            colunas={colunasEventos(idioma)}
            linhas={eventos}
            chaveLinha="id"
            colunaRotulo="data"
            fonte={fonte}
            versao={dataReferencia}
            nomeArquivo={`conta-mudancas-b1-${destaque}`}
            tamanhoPagina={25}
            semLinhas={tx("A distribuidora tem uma só vigência no arquivo: nenhuma mudança a mostrar.", "The distribution utility has a single validity period in the file: no change to show.")}
            nota={tx(
              "Variação entre vigências contíguas da tarifa B1 residencial; não é o efeito médio do processo tarifário. Mudança de perímetro compara áreas diferentes.",
              "Change between contiguous validity periods of the residential B1 tariff; it is not the average effect of the tariff process. A perimeter change compares different areas.",
            )}
          />
        </div>
      )}
    </div>
  );
}
