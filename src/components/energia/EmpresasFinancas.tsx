"use client";

import { useEffect, useMemo, useState } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_COMPANHIAS,
  ESCOPOS,
  ROTULO_ALERTA,
  ROTULO_RECORTE,
  carregarJson,
  dadosFinancas,
  esquemaFinancas,
  rotuloEscopo,
  type Frequencia,
} from "@/lib/energia/empresas";
import type { Evidencia } from "@/lib/energia/evidencia";
import type { ColunaTabela, EntidadeBuscavel, LinhaTabela } from "@/lib/energia/tabela";
import type { ContaCvm, EscopoCvm, EvidenciasEmpresas, SeriesFinanceiras } from "@/lib/energia/tipos-empresas";

/**
 * P038: companhias abertas do setor na CVM. Tabela de todas (último exercício, escopo exibido e
 * avisos), comparação de até quatro na mesma conta, no mesmo escopo e na mesma frequência, e a
 * receita do último exercício de cada escolhida com a ficha "Comprove este número".
 *
 * Consolidado e individual nunca se misturam: o escopo é escolhido uma vez para todas as linhas.
 * Nada é somado entre companhias (a controladora já consolida as controladas). Ausência é lacuna
 * na linha, nunca zero.
 *
 * Carga: as séries e as fichas da companhia padrão chegam com a página; escolher outra busca no
 * navegador o arquivo inteiro das séries (cerca de 2,9 MB) e o das fichas (cerca de 430 KB),
 * uma vez por página. Estado na URL (?fin.sel=, ?fin.conta=, ?fin.esc=, ?fin.freq=).
 */
export type EmpresasFinancasProps = {
  linhas: LinhaTabela[];
  entidades: EntidadeBuscavel[];
  contas: { id: ContaCvm; rotulo: string; tipo: "fluxo" | "saldo"; codigo: string }[];
  padrao: string[];
  seriesIniciais: SeriesFinanceiras["series"];
  evidenciasIniciais: Record<string, Evidencia>;
  urlSeries: string;
  urlEvidencias: string;
  /** CNPJ → avisos e exercício exibido (para o selo e a nota de cada número). */
  resumo: Record<string, { nome: string; exercicio: number | null; escopo: EscopoCvm | null; alertas: string[] }>;
  fonte: string;
  versao: string;
};

const CORES = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];

export function EmpresasFinancas({ linhas, entidades, contas, padrao, seriesIniciais, evidenciasIniciais, urlSeries, urlEvidencias, resumo, fonte, versao }: EmpresasFinancasProps) {
  const esquema = useMemo(() => esquemaFinancas(padrao), [padrao.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, definir] = useEstadoUrl(esquema);
  const [series, setSeries] = useState<SeriesFinanceiras["series"]>(seriesIniciais);
  const [evidencias, setEvidencias] = useState<Record<string, Evidencia>>(evidenciasIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const faltaSerie = v.sel.some((c) => !(c in series));
  const faltaFicha = v.sel.some((c) => !(c in evidencias));

  useEffect(() => {
    if (!faltaSerie) return;
    let vivo = true;
    carregarJson<SeriesFinanceiras>(urlSeries).then(
      (s) => vivo && setSeries(s.series),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [faltaSerie, urlSeries]);
  useEffect(() => {
    if (!faltaFicha) return;
    let vivo = true;
    carregarJson<EvidenciasEmpresas>(urlEvidencias).then(
      (s) => vivo && setEvidencias(s.evidencias),
      () => undefined, // sem o arquivo das fichas o número continua, sem a prova (e o texto diz)
    );
    return () => {
      vivo = false;
    };
  }, [faltaFicha, urlEvidencias]);

  const conta = contas.find((c) => c.id === v.conta) ?? contas[0];
  const freq = v.freq as Frequencia;
  const d = useMemo(() => dadosFinancas(series, v.sel, v.escopo, v.conta, freq), [series, v.sel, v.escopo, v.conta, freq]);
  const nome = (c: string) => resumo[c]?.nome ?? entidades.find((e) => e.id === c)?.rotulo ?? `CNPJ ${c}`;
  const seriesGrafico = d.comDados.map((c) => ({ id: c, rotulo: nome(c), cor: CORES[v.sel.indexOf(c) % CORES.length] }));
  const colunasTabela: ColunaTabela[] = [
    { id: "x", rotulo: freq === "anual" ? "Exercício" : "Fim do trimestre", tipo: freq === "anual" ? "texto" : "data" },
    ...v.sel.map((c) => ({ id: c, rotulo: nome(c), tipo: "numero" as const, unidade: "R$ milhões", casas: 1 })),
  ];
  const semDados = v.sel.filter((c) => !d.comDados.includes(c) && c in series);
  const escalaCorrigida = v.sel.flatMap((c) => (series[c]?.escala_corrigida ?? []).map((t) => `${nome(c)}: ${t}`));

  return (
    <div className="space-y-6">
      <TabelaInterativa
        titulo="Companhias abertas do setor elétrico na CVM: último exercício"
        colunas={COLUNAS_COMPANHIAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={versao}
        nomeArquivo="empresas-companhias-ultimo-exercicio"
        chaveUrl="fin.tab"
        ordemInicial={{ coluna: "ativo_total", direcao: "desc" }}
        selecionado={v.sel[0] ?? null}
        onSelecionar={(id) => id && definir({ sel: [id, ...v.sel.filter((x) => x !== id)].slice(0, 4) })}
        dicaBusca="Nome, CNPJ ou código CVM"
        nota="Valores em R$ milhões, do último exercício de cada companhia, no escopo exibido (consolidado quando apresentado, senão individual). Não somar entre linhas: controladoras já consolidam as controladas. Escolher uma linha a põe em primeiro lugar na comparação abaixo."
      />

      <div className="space-y-4">
        <h4 className="font-serif text-base text-carvao">Evolução de uma conta, até quatro companhias</h4>
        <Comparador
          rotulo="Companhias comparadas (até 4)"
          entidades={entidades}
          selecionadas={v.sel}
          onMudar={(ids) => definir({ sel: ids })}
          dicaBusca="Nome, CNPJ ou código CVM"
          vazio="Nenhuma companhia escolhida. Escolha aqui ou pela tabela acima."
        >
          {() => null}
        </Comparador>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-carvao-muted">
            Conta
            <select value={v.conta} onChange={(e) => definir({ conta: e.target.value as ContaCvm })} className="min-h-[44px] max-w-full border border-linha bg-superficie px-2 text-carvao">
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.rotulo} ({c.codigo})
                </option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label="Escopo da demonstração" className="flex gap-2">
            {ESCOPOS.map((e) => (
              <label key={e} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 ${v.escopo === e ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted"}`}>
                <input type="radio" name="fin-escopo" checked={v.escopo === e} onChange={() => definir({ escopo: e })} className="accent-energia" />
                {rotuloEscopo(e)}
              </label>
            ))}
          </div>
          <div role="radiogroup" aria-label="Frequência" className="flex gap-2">
            {(
              [
                ["anual", "Anual (DFP)"],
                ["trimestral", "Trimestral (ITR)"],
              ] as const
            ).map(([f, rot]) => (
              <label key={f} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 ${v.freq === f ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted"}`}>
                <input type="radio" name="fin-freq" checked={v.freq === f} onChange={() => definir({ freq: f })} className="accent-energia" />
                {rot}
              </label>
            ))}
          </div>
        </div>

        {v.sel.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {v.sel.map((c) => {
              const r = resumo[c];
              const ev = evidencias[c];
              return (
                <Numero
                  key={c}
                  rotulo={`Receita ${r?.exercicio ?? ""}: ${nome(c)}`}
                  natureza={r?.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                  valor={ev && ev.valor_calculo !== null ? ev.valor_calculo / 1e6 : null}
                  casas={1}
                  unidade="R$ milhões"
                  periodo={ev?.periodo ?? (r?.exercicio ? String(r.exercicio) : undefined)}
                  evidencia={ev ?? null}
                  tamanho="medio"
                  motivoAusencia={
                    r?.alertas.includes("fluxos_nao_preenchidos")
                      ? ROTULO_ALERTA.fluxos_nao_preenchidos
                      : r?.exercicio
                        ? faltaFicha
                          ? "Carregando a ficha Comprove."
                          : "Receita do último exercício sem ficha publicada."
                        : "Sem demonstração anual (DFP) no período lido."
                  }
                  nota={r ? `${rotuloEscopo(r.escopo)}${r.alertas.length ? `; ${r.alertas.map((a) => ROTULO_ALERTA[a] ?? a).join("; ")}` : ""}` : undefined}
                  endereco="#p038"
                />
              );
            })}
          </div>
        )}

        {erro && (
          <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
            Não foi possível carregar as séries financeiras ({erro}). Os mesmos valores estão nos CSV de demonstrações anuais e trimestrais.
          </p>
        )}
        {faltaSerie && !erro && (
          <p role="status" className="text-sm text-carvao-muted">
            Carregando as séries das companhias escolhidas…
          </p>
        )}
        {!faltaSerie && v.sel.length > 0 && (
          <>
            <p className="text-sm text-carvao-muted" aria-live="polite">
              {conta?.rotulo} (conta {conta?.codigo}), {rotuloEscopo(v.escopo)}, {freq === "anual" ? "exercícios de 12 meses (DFP)" : `informações trimestrais (ITR), ${ROTULO_RECORTE[d.recorte ?? ""] ?? "recorte publicado"}`}. O 4º trimestre não é deduzido por diferença.
              {semDados.length ? ` Sem valor neste escopo e nesta conta: ${semDados.map(nome).join(", ")}.` : ""}
            </p>
            {d.linhas.length > 0 ? (
              <GraficoLinhas
                titulo={`${conta?.rotulo ?? "Conta"}, ${rotuloEscopo(v.escopo)}, ${freq === "anual" ? "por exercício" : "por trimestre"} (R$ milhões)`}
                dados={d.linhas}
                chaveX="x"
                formatoX={freq === "anual" ? "texto" : "data"}
                series={seriesGrafico}
                unidade="R$ milhões"
                casas={1}
                zeroNoEixo
                legendaInterativa
                zoom={freq === "trimestral"}
                altura={300}
              />
            ) : (
              <p className="border border-dashed border-linha bg-papel px-4 py-3 text-sm text-carvao-muted">
                Nenhuma das companhias escolhidas tem valor para esta conta neste escopo e nesta frequência. Troque o escopo (algumas só apresentam o individual) ou a frequência.
              </p>
            )}
            <TabelaInterativa
              titulo="Valores do gráfico (tabela equivalente)"
              colunas={colunasTabela}
              linhas={d.linhas.map((l) => ({ ...l, id: String(l.x) }))}
              chaveLinha="id"
              colunaRotulo="x"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`empresas-financas-${v.conta}-${v.escopo}-${freq}`}
              ordemInicial={{ coluna: "x", direcao: "desc" }}
              tamanhoPagina={25}
              nota="Valores em R$ milhões nominais; ausência é a conta não publicada ou a coluna não apresentada pela companhia (nunca zero)."
            />
            {escalaCorrigida.length > 0 && (
              <p className="text-xs text-carvao-muted">
                Escala convertida pelo observatório (natureza estimada; regra no modo Auditar): {escalaCorrigida.join("; ")}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
