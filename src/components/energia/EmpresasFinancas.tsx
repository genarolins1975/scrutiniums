"use client";

import { datasLegiveis } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { useEffect, useMemo, useState } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
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
 * P038: companhias abertas do setor na CVM. A evolução de uma conta em até quatro companhias (a figura principal: no mesmo escopo e na
 * mesma frequência, com a receita do último exercício de cada escolhida e a ficha "Comprove este número") e a tabela de todas as
 * companhias (último exercício, escopo exibido e avisos). Os dois pedaços compartilham o estado da URL (?fin.sel=, ?fin.conta=,
 * ?fin.esc=, ?fin.freq=).
 *
 * Consolidado e individual nunca se misturam: o escopo é escolhido uma vez para todas as linhas. Nada é somado entre companhias (a
 * controladora já consolida as controladas). Ausência é lacuna na linha, nunca zero.
 *
 * Carga: as séries e as fichas da companhia padrão chegam com a página; escolher outra busca no navegador o arquivo inteiro das séries
 * (cerca de 2,9 MB) e o das fichas (cerca de 430 KB), uma vez por página.
 */
export type EmpresasEvolucaoFinancasProps = {
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

/** Uma cor por companhia escolhida, a mesma no gráfico e no número da receita dela. */
const CORES = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];

export function EmpresasEvolucaoFinancas({ entidades, contas, padrao, seriesIniciais, evidenciasIniciais, urlSeries, urlEvidencias, resumo, fonte, versao }: EmpresasEvolucaoFinancasProps) {
  const tx = useTx();
  const idioma = useIdioma();
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
  const corDe = (c: string) => CORES[Math.max(0, v.sel.indexOf(c)) % CORES.length];
  const seriesGrafico = d.comDados.map((c) => ({ id: c, rotulo: nome(c), cor: corDe(c) }));
  const colunasTabela: ColunaTabela[] = [
    { id: "x", rotulo: freq === "anual" ? tx("Exercício", "Fiscal year") : tx("Fim do trimestre", "End of quarter"), tipo: freq === "anual" ? "texto" : "data" },
    ...v.sel.map((c) => ({ id: c, rotulo: nome(c), tipo: "numero" as const, unidade: tx("R$ milhões", "R$ million"), casas: 1 })),
  ];
  const semDados = v.sel.filter((c) => !d.comDados.includes(c) && c in series);
  // o texto da escala vem do arquivo ("DFP 2019-12-31 individual: x1000"); em inglês, só o escopo muda de forma
  const escalaCorrigida = v.sel.flatMap((c) => (series[c]?.escala_corrigida ?? []).map((t) => `${nome(c)}: ${tx(t, t.replace(/ consolidado:/, " consolidated:"))}`));
  const escopo = (e: EscopoCvm | null) => rotuloEscopo(e, idioma);

  return (
    <div className="space-y-4">
      <Comparador
        rotulo={tx("Companhias comparadas (até 4)", "Companies compared (up to 4)")}
        entidades={entidades}
        selecionadas={v.sel}
        onMudar={(ids) => definir({ sel: ids })}
        dicaBusca={tx("Nome, CNPJ ou código CVM", "Name, CNPJ or CVM code")}
        vazio={tx("Nenhuma companhia escolhida. Escolha aqui ou pela tabela, mais abaixo.", "No company chosen. Choose here or from the table, further below.")}
      >
        {() => null}
      </Comparador>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-carvao-muted">
          {tx("Conta", "Account")}
          <select value={v.conta} onChange={(e) => definir({ conta: e.target.value as ContaCvm })} className="min-h-[44px] max-w-full border border-linha bg-superficie px-2 text-carvao">
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label={tx("Escopo da demonstração", "Statement scope")} className="flex gap-2">
          {ESCOPOS.map((e) => (
            <label key={e} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 ${v.escopo === e ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted"}`}>
              <input type="radio" name="fin-escopo" checked={v.escopo === e} onChange={() => definir({ escopo: e })} className="accent-energia" />
              {escopo(e)}
            </label>
          ))}
        </div>
        <div role="radiogroup" aria-label={tx("Frequência", "Frequency")} className="flex gap-2">
          {(
            [
              ["anual", tx("Anual (DFP)", "Annual (DFP)")],
              ["trimestral", tx("Trimestral (ITR)", "Quarterly (ITR)")],
            ] as const
          ).map(([f, rot]) => (
            <label key={f} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 ${v.freq === f ? "border-energia bg-energia-fundo text-carvao" : "border-linha text-carvao-muted"}`}>
              <input type="radio" name="fin-freq" checked={v.freq === f} onChange={() => definir({ freq: f })} className="accent-energia" />
              {rot}
            </label>
          ))}
        </div>
      </div>

      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          {tx(
            <>Não foi possível carregar as séries financeiras ({erro}). Os mesmos valores estão nos CSV de demonstrações anuais e trimestrais.</>,
            <>The financial series could not be loaded ({erro}). The same values are in the annual and quarterly financial statement CSVs.</>,
          )}
        </p>
      )}
      {faltaSerie && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          {tx("Carregando as séries das companhias escolhidas…", "Loading the series of the chosen companies…")}
        </p>
      )}
      {!faltaSerie && v.sel.length > 0 && (
        <>
          <p className="text-sm text-carvao-muted" aria-live="polite">
            {conta?.rotulo}
            <span data-nivel="analisar">{tx(` (conta ${conta?.codigo} do plano padronizado da CVM)`, ` (account ${conta?.codigo} of the CVM standardized chart of accounts)`)}</span>, {escopo(v.escopo)},{" "}
            {freq === "anual"
              ? tx("exercícios de 12 meses (DFP)", "12-month fiscal years (DFP)")
              : tx(
                  `informações trimestrais (ITR), ${ROTULO_RECORTE[d.recorte ?? ""] ?? "recorte publicado"}`,
                  `quarterly information (ITR), ${ROTULO_RECORTE[d.recorte ?? ""] ?? "published cut"}`,
                )}
            {tx(". O 4º trimestre não é deduzido por diferença.", ". The 4th quarter is not derived by difference.")}
            {semDados.length ? tx(` Sem valor neste escopo e nesta conta: ${semDados.map(nome).join(", ")}.`, ` No value in this scope and account: ${semDados.map(nome).join(", ")}.`) : ""}
          </p>
          {d.linhas.length > 0 ? (
            <GraficoLinhas
              titulo={tx(
                `${conta?.rotulo ?? "Conta"}, ${escopo(v.escopo)}, ${freq === "anual" ? "por exercício" : "por trimestre"} (R$ milhões)`,
                `${conta?.rotulo ?? "Account"}, ${escopo(v.escopo)}, ${freq === "anual" ? "by fiscal year" : "by quarter"} (R$ million)`,
              )}
              dados={d.linhas}
              chaveX="x"
              formatoX={freq === "anual" ? "texto" : "data"}
              series={seriesGrafico}
              unidade={tx("R$ milhões", "R$ million")}
              casas={1}
              zeroNoEixo
              legendaInterativa
              zoom={freq === "trimestral"}
              altura={300}
            />
          ) : (
            <p className="border border-dashed border-linha bg-papel px-4 py-3 text-sm text-carvao-muted">
              {tx(
                "Nenhuma das companhias escolhidas tem valor para esta conta neste escopo e nesta frequência. Troque o escopo (algumas só apresentam o individual) ou a frequência.",
                "None of the chosen companies has a value for this account in this scope and frequency. Change the scope (some present only the individual statements) or the frequency.",
              )}
            </p>
          )}
        </>
      )}

      {v.sel.length > 0 && (
        <FaixaMetricas
          colunas={Math.max(2, Math.min(4, v.sel.length)) as 2 | 3 | 4}
          rotulo={tx("Receita do último exercício de cada companhia escolhida", "Net revenue for the latest fiscal year of each chosen company")}
          nota={tx(
            "Receita do último exercício de cada companhia escolhida, no escopo que a tabela de companhias exibe (consolidado quando apresentado, senão individual). Segue a escolha de companhias; não muda com a conta, o escopo nem a frequência do gráfico.",
            "Net revenue for the latest fiscal year of each chosen company, in the scope the companies table shows (consolidated when presented, otherwise individual). It follows the choice of companies; it does not change with the chart's account, scope or frequency.",
          )}
        >
          {v.sel.map((c) => {
            const r = resumo[c];
            const ev = evidencias[c];
            return (
              <Numero
                key={c}
                variante="faixa"
                rotulo={tx(`Receita ${r?.exercicio ?? ""}: ${nome(c)}`, `Net revenue ${r?.exercicio ?? ""}: ${nome(c)}`)}
                nomesNoRotulo={[nome(c)]}
                natureza={r?.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                valor={ev && ev.valor_calculo !== null ? ev.valor_calculo / 1e6 : null}
                casas={1}
                unidade={tx("R$ milhões", "R$ million")}
                periodo={ev?.periodo ?? (r?.exercicio ? String(r.exercicio) : undefined)}
                evidencia={ev ?? null}
                cor={corDe(c)}
                motivoAusencia={
                  r?.alertas.includes("fluxos_nao_preenchidos")
                    ? ROTULO_ALERTA.fluxos_nao_preenchidos
                    : r?.exercicio
                      ? faltaFicha
                        ? tx("Carregando a ficha Comprove.", "Loading the Check this number sheet.")
                        : tx("Receita do último exercício sem ficha publicada.", "Net revenue for the latest fiscal year without a published sheet.")
                      : tx("Sem demonstração anual (DFP) no período lido.", "No annual financial statements (DFP) in the period read.")
                }
                nota={r ? `${escopo(r.escopo)}${r.alertas.length ? `; ${r.alertas.map((a) => ROTULO_ALERTA[a] ?? a).join("; ")}` : ""}` : undefined}
                endereco="#p038"
              />
            );
          })}
        </FaixaMetricas>
      )}

      {!faltaSerie && v.sel.length > 0 && (
        <>
          <TabelaInterativa
            titulo={tx("Valores do gráfico (tabela equivalente)", "Chart values (equivalent table)")}
            colunas={colunasTabela}
            linhas={d.linhas.map((l) => ({ ...l, id: String(l.x) }))}
            chaveLinha="id"
            colunaRotulo="x"
            fonte={fonte}
            versao={versao}
            nomeArquivo={`empresas-financas-${v.conta}-${v.escopo}-${freq}`}
            ordemInicial={{ coluna: "x", direcao: "desc" }}
            tamanhoPagina={25}
            nota={tx(
              "Valores em R$ milhões nominais; ausência é a conta não publicada ou a coluna não apresentada pela companhia (nunca zero).",
              "Values in nominal R$ million; a missing value is an account not published or a column not presented by the company (never zero).",
            )}
          />
          {escalaCorrigida.length > 0 && (
            <p className="text-xs text-carvao-muted">
              {tx("Escala convertida pelo observatório (natureza estimada; regra no modo Auditar)", "Scale converted by the observatory (estimated nature; rule in Audit mode)")}:{" "}
              {datasLegiveis(escalaCorrigida.join("; "), idioma)}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export type EmpresasTabelaCompanhiasProps = {
  linhas: LinhaTabela[];
  padrao: string[];
  fonte: string;
  versao: string;
};

/** A tabela de todas as companhias do universo: escolher uma linha a põe em primeiro lugar na comparação do alto da página. */
export function EmpresasTabelaCompanhias({ linhas, padrao, fonte, versao }: EmpresasTabelaCompanhiasProps) {
  const tx = useTx();
  const esquema = useMemo(() => esquemaFinancas(padrao), [padrao.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, definir] = useEstadoUrl(esquema);
  return (
    <TabelaInterativa
      titulo={tx("Companhias abertas do setor elétrico na CVM: último exercício", "Publicly held power sector companies at CVM: latest fiscal year")}
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
      dicaBusca={tx("Nome, CNPJ ou código CVM", "Name, CNPJ or CVM code")}
      nota={tx(
        "Valores em R$ milhões, do último exercício de cada companhia, no escopo exibido (consolidado quando apresentado, senão individual). Não somar entre linhas: controladoras já consolidam as controladas. Escolher uma linha a põe em primeiro lugar na comparação do alto da página.",
        "Values in R$ million, for each company's latest fiscal year, in the scope shown (consolidated when presented, otherwise individual). Do not add across rows: parents already consolidate their subsidiaries. Choosing a row puts it first in the comparison at the top of the page.",
      )}
    />
  );
}
