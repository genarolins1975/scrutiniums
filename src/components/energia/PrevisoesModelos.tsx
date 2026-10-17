"use client";

import Link from "@/components/i18n/LinkIdioma";
import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { EstadoModelo } from "@/components/energia/EstadoModelo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { colunasModelos, type CartaoModelo, type LinhaCoeficiente, type LinhaModelo } from "@/lib/energia/previsoes";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { ColunaTabela } from "@/lib/energia/tabela";

export type { CartaoModelo };

/**
 * Registro de modelos, parte de exploração (modo Analisar).
 *
 * PrevisoesFichas: fichas comparáveis (até quatro lado a lado, em `?mod=`) e a tabela das cinco fichas com as mesmas informações,
 * com busca, filtros e exportação. PrevisoesPesos: os pesos do último ajuste dos candidatos C2 por segmento (horizonte × submercado,
 * em `?seg=`), em gráfico e tabela sincronizados: escolher uma linha da tabela muda o gráfico e a frase; o voltar desfaz.
 *
 * Tudo chega pronto do servidor (cartoesModelos, linhasModelos, linhasCoeficientes, coeficientesDoSegmento e textoCoeficientes, sobre a
 * gold): aqui só se escolhe o que mostrar.
 */

export function PrevisoesFichas({
  cartoes,
  linhasModelos,
  fonte,
  versao,
}: {
  cartoes: CartaoModelo[];
  linhasModelos: LinhaModelo[];
  fonte: string;
  versao: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const porId = useMemo(() => new Map(cartoes.map((c) => [c.id, c])), [cartoes]);
  const entidades = useMemo(() => cartoes.map((c) => ({ id: c.id, rotulo: `${c.codigo} · ${c.nome}`, detalhe: c.papel, sinonimos: [c.codigo] })), [cartoes]);
  const padrao = useMemo(() => cartoes.filter((c) => c.codigo !== "C1").map((c) => c.id).slice(0, 4), [cartoes]);

  return (
    <div className="space-y-6">
      <Comparador
        rotulo={tx("Modelos para comparar (até 4)", "Models to compare (up to 4)")}
        entidades={entidades}
        padrao={padrao}
        chaveUrl="mod"
        dicaBusca={tx("B0, S0, C1, C2-P ou C2-H", "B0, S0, C1, C2-P or C2-H")}
        vazio={tx("Nenhum modelo escolhido. Escolha até quatro para comparar as fichas.", "No model chosen. Choose up to four to compare the sheets.")}
        renderizarItem={(e) => {
          const c = porId.get(e.id);
          if (!c) return null;
          return (
            <article className="flex h-full min-w-0 flex-col border border-linha bg-superficie p-4" data-ficha={c.codigo}>
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-serif text-lg text-carvao">
                  {c.codigo} · {c.nome}
                </h4>
                <EstadoModelo estado={c.estado} idioma={idioma} />
              </header>
              <p className="mt-1 text-xs text-mineral">
                {tx("versão", "version")} {c.versao} · {c.papel}
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="rotulo text-mineral">{tx("Número no arquivo", "Number in the archive")}</dt>
                  <dd className="text-carvao">{c.emite}</dd>
                </div>
                <div>
                  <dt className="rotulo text-mineral">{tx("Entradas", "Inputs")}</dt>
                  <dd className="text-carvao">
                    {c.entradas ? (
                      <ul className="list-disc space-y-0.5 pl-5">
                        {c.entradas.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      tx("não publicadas", "not published")
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="rotulo text-mineral">{tx("Fórmula", "Formula")}</dt>
                  <dd className="text-carvao [overflow-wrap:anywhere]">
                    {c.formula ?? tx("não publicada: a configuração da pesquisa não foi publicada", "not published: the research configuration was not published")}
                  </dd>
                </div>
                {c.formulaRegistro && c.formulaRegistro !== c.formula && (
                  <div data-nivel="analisar">
                    <dt className="rotulo text-mineral">{tx("Fórmula no registro", "Formula in the registry")}</dt>
                    <dd className="text-carvao-muted [overflow-wrap:anywhere]">{c.formulaRegistro}</dd>
                  </div>
                )}
                <div>
                  <dt className="rotulo text-mineral">{tx("Reexecução", "Rerun")}</dt>
                  <dd className="text-carvao">{c.reexecucao}</dd>
                </div>
                {c.limitacao && (
                  <div>
                    <dt className="rotulo text-mineral">{tx("Principal limitação", "Main limitation")}</dt>
                    <dd className="text-carvao-muted">{c.limitacao}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-auto pt-3 text-sm">
                <Link href={c.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {tx(`Ficha completa do ${c.codigo}`, `Full ${c.codigo} sheet`)}
                </Link>
              </p>
            </article>
          );
        }}
      />
      <TabelaInterativa
        titulo={tx("As cinco fichas, em tabela", "The five sheets, as a table")}
        colunas={colunasModelos(idioma)}
        linhas={linhasModelos}
        chaveLinha="id"
        colunaRotulo="codigo"
        fonte={fonte}
        versao={versao}
        nomeArquivo="previsoes-pld-registro-de-modelos"
        chaveUrl="fichas"
        nota={tx(
          "Mesmas informações das fichas acima; o texto completo de cada limitação e falha está na ficha de cada modelo.",
          "Same information as the sheets above; the full text of each limitation and failure is on each model's sheet.",
        )}
      />
    </div>
  );
}

export function PrevisoesPesos({
  coeficientes,
  colunasCoeficientes,
  segmentos,
  barras,
  textos,
  segmentoPadrao,
  fonte,
  versao,
}: {
  coeficientes: LinhaCoeficiente[];
  colunasCoeficientes: ColunaTabela[];
  segmentos: { id: string; rotulo: string }[];
  barras: Record<string, Record<string, string | number | null>[]>;
  textos: Record<string, string>;
  segmentoPadrao: string;
  fonte: string;
  versao: string;
}) {
  const ids = useMemo(() => segmentos.map((s) => s.id), [segmentos]);
  const esquema = useMemo(
    () => ({ seg: campo(tiposUrl.opcao(ids), segmentoPadrao, { param: "seg" }) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume a lista
    [ids.join(","), segmentoPadrao],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const tx = useTx();
  const modelosCoef = Array.from(new Set(coeficientes.map((l) => l.modelo)));
  const CORES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)"];
  const linhaSel = coeficientes.find((l) => l.segmento === v.seg)?.id ?? null;

  return (
    <div className="space-y-4">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          "O C2 soma ao B0 a combinação das variáveis com estes coeficientes, na unidade original (R$/MWh de correção por R$/MWh da variável, ou por ponto percentual nas variáveis de reservatório e vazão). Coeficiente zero quer dizer que a variável não corrige o B0; acima de 1, na média dos 7 dias, a correção amplia o desvio recente. Um modelo por horizonte e submercado, reajustado aos domingos.",
          "C2 adds to B0 the combination of the variables with these coefficients, in the original unit (R$/MWh of correction per R$/MWh of the variable, or per percentage point for the reservoir and inflow variables). A zero coefficient means the variable does not correct B0; above 1, in the 7-day average, the correction widens the recent deviation. One model per horizon and submarket, refitted on Sundays.",
        )}
      </p>
      <label className="flex flex-wrap items-center gap-3 text-sm text-carvao">
        <span className="rotulo text-mineral">{tx("Segmento", "Segment")}</span>
        <select
          value={v.seg}
          onChange={(e) => definir({ seg: e.currentTarget.value })}
          className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia"
        >
          {segmentos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.rotulo}
            </option>
          ))}
        </select>
      </label>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite" data-texto-coef={v.seg}>
        {textos[v.seg] ?? tx("Nenhum candidato tem ajuste registrado neste segmento.", "No candidate has a fit recorded in this segment.")}
      </p>
      <GraficoBarras
        titulo={tx(
          `Coeficientes do último ajuste, segmento ${segmentos.find((s) => s.id === v.seg)?.rotulo ?? v.seg}`,
          `Coefficients of the latest fit, segment ${segmentos.find((s) => s.id === v.seg)?.rotulo ?? v.seg}`,
        )}
        dados={barras[v.seg] ?? []}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={modelosCoef.map((m, i) => ({ id: m, rotulo: m, cor: CORES[i % CORES.length] }))}
        unidade={tx("coeficiente", "coefficient")}
        casas={2}
        orientacao="horizontal"
        rotulosValor
        referencias={[{ valor: 1, rotulo: tx("1: acima disso, a correção amplia o desvio recente", "1: above this, the correction widens the recent deviation") }]}
      />
      <TabelaInterativa
        titulo={tx("Coeficientes do último ajuste, todos os segmentos", "Coefficients of the latest fit, all segments")}
        colunas={colunasCoeficientes}
        linhas={coeficientes}
        chaveLinha="id"
        colunaRotulo="modelo"
        fonte={fonte}
        versao={versao}
        nomeArquivo="previsoes-pld-coeficientes-ultimo-ajuste"
        chaveUrl="coef"
        selecionado={linhaSel}
        onSelecionar={(id) => {
          const l = coeficientes.find((x) => x.id === id);
          if (l) definir({ seg: l.segmento });
        }}
        dicaBusca={tx("Modelo, horizonte ou submercado", "Model, horizon or submarket")}
        nota={tx(
          "Variável que o modelo não usa fica sem dado (o C2-P não usa reservatório nem vazão), nunca zero. Os coeficientes de todas as origens de ajuste desde 2021 estão no CSV de coeficientes.",
          "A variable the model does not use is left with no data (C2-P uses neither reservoir nor inflow), never zero. The coefficients of all fit origins since 2021 are in the coefficients CSV.",
        )}
      />
    </div>
  );
}
