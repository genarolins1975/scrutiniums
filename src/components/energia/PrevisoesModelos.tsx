"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { EstadoModelo } from "@/components/energia/EstadoModelo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { COLUNAS_MODELOS, type LinhaCoeficiente, type LinhaModelo } from "@/lib/energia/previsoes";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { EstadoModelo as Estado } from "@/lib/energia/tipos";

/**
 * P014, registro de modelos: fichas comparáveis (até quatro lado a lado, em
 * `?mod=`), a tabela das cinco fichas com as mesmas informações, e os pesos do
 * último ajuste dos candidatos C2 por segmento (horizonte × submercado, em
 * `?seg=`), em gráfico e tabela sincronizados: escolher uma linha da tabela muda o
 * gráfico e a frase; o voltar desfaz.
 *
 * Tudo chega pronto do servidor (linhasModelos, linhasCoeficientes,
 * coeficientesDoSegmento e textoCoeficientes, sobre a gold): aqui só se escolhe o
 * que mostrar.
 */

export type CartaoModelo = {
  id: string;
  codigo: string;
  nome: string;
  versao: string;
  estado: Estado;
  papel: string;
  emite: string;
  entradas: string[] | null;
  formula: string | null;
  reexecucao: string;
  limitacao: string | null;
  href: string;
};

export function PrevisoesModelos({
  cartoes,
  linhasModelos,
  coeficientes,
  colunasCoeficientes,
  segmentos,
  barras,
  textos,
  segmentoPadrao,
  fonte,
  versao,
}: {
  cartoes: CartaoModelo[];
  linhasModelos: LinhaModelo[];
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
  const porId = useMemo(() => new Map(cartoes.map((c) => [c.id, c])), [cartoes]);
  const entidades = useMemo(() => cartoes.map((c) => ({ id: c.id, rotulo: `${c.codigo} · ${c.nome}`, detalhe: c.papel, sinonimos: [c.codigo] })), [cartoes]);
  const padrao = useMemo(() => cartoes.filter((c) => c.codigo !== "C1").map((c) => c.id).slice(0, 4), [cartoes]);
  const modelosCoef = Array.from(new Set(coeficientes.map((l) => l.modelo)));
  const CORES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)"];
  const linhaSel = coeficientes.find((l) => l.segmento === v.seg)?.id ?? null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="fichas-comparar-titulo" className="space-y-3">
        <h3 id="fichas-comparar-titulo" className="font-serif text-lg text-carvao">
          Fichas lado a lado
        </h3>
        <Comparador
          rotulo="Modelos para comparar (até 4)"
          entidades={entidades}
          padrao={padrao}
          chaveUrl="mod"
          dicaBusca="B0, S0, C1, C2-P ou C2-H"
          vazio="Nenhum modelo escolhido. Escolha até quatro para comparar as fichas."
          renderizarItem={(e) => {
            const c = porId.get(e.id);
            if (!c) return null;
            return (
              <article className="flex h-full min-w-0 flex-col border border-linha bg-superficie p-4" data-ficha={c.codigo}>
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-serif text-lg text-carvao">
                    {c.codigo} · {c.nome}
                  </h4>
                  <EstadoModelo estado={c.estado} />
                </header>
                <p className="mt-1 text-xs text-mineral">
                  versão {c.versao} · {c.papel}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="rotulo text-mineral">Número no arquivo</dt>
                    <dd className="text-carvao">{c.emite}</dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">Entradas</dt>
                    <dd className="text-carvao">
                      {c.entradas ? (
                        <ul className="list-disc space-y-0.5 pl-5">
                          {c.entradas.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      ) : (
                        "não publicadas"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">Fórmula</dt>
                    <dd className="text-carvao [overflow-wrap:anywhere]">{c.formula ?? "não publicada: configuração fora do repositório"}</dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">Reexecução</dt>
                    <dd className="text-carvao">{c.reexecucao}</dd>
                  </div>
                  {c.limitacao && (
                    <div>
                      <dt className="rotulo text-mineral">Primeira limitação registrada</dt>
                      <dd className="text-carvao-muted">{c.limitacao}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-auto pt-3 text-sm">
                  <Link href={c.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                    Ficha completa do {c.codigo}
                  </Link>
                </p>
              </article>
            );
          }}
        />
        <TabelaInterativa
          titulo="As cinco fichas, em tabela"
          colunas={COLUNAS_MODELOS}
          linhas={linhasModelos}
          chaveLinha="id"
          colunaRotulo="codigo"
          fonte={fonte}
          versao={versao}
          nomeArquivo="previsoes-pld-registro-de-modelos"
          chaveUrl="fichas"
          nota="Mesmas informações das fichas acima; o texto completo de cada limitação e falha está na ficha de cada modelo."
        />
      </section>

      {coeficientes.length > 0 && (
        <section aria-labelledby="coef-titulo" className="space-y-4" data-nivel="analisar">
          <h3 id="coef-titulo" className="font-serif text-lg text-carvao">
            Pesos do último ajuste dos candidatos C2, por segmento
          </h3>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            O C2 soma ao B0 a combinação das variáveis com estes coeficientes, na unidade original (R$/MWh de correção por R$/MWh da variável, ou por ponto percentual
            nas variáveis de reservatório e vazão). Coeficiente zero quer dizer que a variável não corrige o B0; acima de 1, na média dos 7 dias, a correção amplia o
            desvio recente. Um modelo por horizonte e submercado, reajustado aos domingos.
          </p>
          <label className="flex flex-wrap items-center gap-3 text-sm text-carvao">
            <span className="rotulo text-mineral">Segmento</span>
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
            {textos[v.seg] ?? "Nenhum candidato tem ajuste registrado neste segmento."}
          </p>
          <GraficoBarras
            titulo={`Coeficientes do último ajuste, segmento ${segmentos.find((s) => s.id === v.seg)?.rotulo ?? v.seg}`}
            dados={barras[v.seg] ?? []}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={modelosCoef.map((m, i) => ({ id: m, rotulo: m, cor: CORES[i % CORES.length] }))}
            unidade="coeficiente"
            casas={2}
            orientacao="horizontal"
            rotulosValor
            referencias={[{ valor: 1, rotulo: "1: acima, a correção amplia o desvio recente (G23-R1)" }]}
          />
          <TabelaInterativa
            titulo="Coeficientes do último ajuste, todos os segmentos"
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
            dicaBusca="Modelo, horizonte ou submercado"
            nota="Variável que o modelo não usa fica sem dado (o C2-P não usa reservatório nem vazão), nunca zero. Os coeficientes de todas as origens de ajuste desde 2021 estão no CSV de coeficientes."
          />
        </section>
      )}
    </div>
  );
}
