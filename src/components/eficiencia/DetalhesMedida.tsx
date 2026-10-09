"use client";

import {
  composicaoDespesa,
  distribuicaoMatriculas,
  ponteMatricula,
  type CapitalPainel,
  type Indice,
  type Ponto,
} from "@/lib/eficiencia/consulta";
import { inteiro, percentual, reaisCompleto, reaisExtenso } from "@/lib/eficiencia/formato";
import type { FichaIndicador } from "@/lib/eficiencia/tipos";
import type { ContextoFicha } from "./FichaConteudo";
import { SobreEsteDado } from "./SobreEsteDado";
import { SemValor } from "./estados";
import { BarrasComposicao } from "./graficos";
import { TabelaSimples } from "./TabelaSimples";

/**
 * Detalhes de uma medida, para uma capital e um período: composição da despesa por subfunção, matrículas por etapa e o
 * caminho do total da DCA ao numerador da razão por matrícula. Cada detalhe só aparece quando a pessoa o escolhe, e
 * cada soma é conferida contra o total que a origina; parcelas que não fecham não são desenhadas.
 */

type Base = { ix: Indice; cap: CapitalPainel; ano: number };

export function ComposicaoDespesa({ ix, cap, ano, ficha, ctx }: Base & { ficha: FichaIndicador; ctx: ContextoFicha }) {
  const c = composicaoDespesa(ix, cap.cod, ano);
  const nomeCap = `${cap.nome} (${cap.uf})`;
  if (c.inconsistente) return <SemValor ponto={{ ...c.total, status: "INCONSISTENTE" }} contexto="A soma das subfunções não reconcilia com o total da função; a composição não é exibida." />;
  if (c.total.valor === null) return <SemValor ponto={c.total} />;
  const soma = c.linhas.reduce((a, l) => a + l.valor, 0);
  return (
    <div>
      <h3 className="font-semibold text-obee-tinta">Despesa liquidada na função Educação, por subfunção</h3>
      <p className="mt-0.5 text-xs text-carvao-muted">
        {nomeCap} · % do total da função · exercício {ano} · valores nominais · ordem da classificação funcional
      </p>
      <div className="mt-4 max-w-3xl">
        <BarrasComposicao linhas={c.linhas.map((l) => ({ chave: l.codigo, rotulo: l.rotulo, pct: l.participacao, detalhe: percentual(l.participacao, 1) }))} />
      </div>
      <p className="mt-4 text-sm text-obee-tinta">
        <span aria-hidden="true">✓ </span>
        Soma das subfunções: {reaisCompleto(soma)}, igual ao total da função ({reaisCompleto(c.total.valor)}), com tolerância de R$ 1,00.
      </p>
      <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        A classificação por subfunção segue a prática contábil de cada município: despesas comuns a várias etapas podem estar em administração geral, em demais subfunções ou distribuídas nas subfunções de etapa. A composição não
        mede o custo de cada etapa.
      </p>
      <details className="mt-2 text-sm">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
        <TabelaSimples
          legenda={`Despesa por subfunção, ${nomeCap}, ${ano}`}
          cabecalho={["Subfunção", "R$", "% da função"]}
          linhas={[...c.linhas.map((l) => [l.rotulo, reaisCompleto(l.valor), percentual(l.participacao, 2)]), ["Total da função Educação", reaisCompleto(c.total.valor), "100,00%"]]}
        />
      </details>
      <div className="mt-1">
        <SobreEsteDado f={ficha} ctx={ctx} />
      </div>
    </div>
  );
}

export function MatriculasPorEtapa({ ix, cap, ano, ficha, ctx }: Base & { ficha: FichaIndicador; ctx: ContextoFicha }) {
  const dist = distribuicaoMatriculas(ix, cap.cod, ano);
  const conv = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, ano, "total", null);
  const nomeCap = `${cap.nome} (${cap.uf})`;
  if (dist.total.valor === null || dist.total.valor === 0) return <SemValor ponto={dist.total} />;
  const total = dist.total.valor;
  return (
    <div>
      <h3 className="font-semibold text-obee-tinta">Matrículas na rede municipal, por etapa</h3>
      <p className="mt-0.5 text-xs text-carvao-muted">
        {nomeCap} · matrículas e % do total da rede · Censo Escolar {ano} · etapas mutuamente exclusivas
      </p>
      <div className="mt-4 max-w-3xl">
        <BarrasComposicao
          linhas={dist.linhas
            .filter((l) => l.rede !== null)
            .map((l) => ({
              chave: l.etapa,
              rotulo: l.rotulo,
              pct: (100 * (l.rede ?? 0)) / total,
              detalhe: `${inteiro(l.rede ?? 0)} (${percentual((100 * (l.rede ?? 0)) / total, 1)})`,
            }))}
        />
      </div>
      <p className="mt-4 text-sm text-obee-tinta">
        <span aria-hidden="true">✓ </span>
        Soma das etapas: {inteiro(dist.linhas.reduce((a, l) => a + (l.rede ?? 0), 0))}, igual ao total da rede ({inteiro(total)}).
      </p>
      <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        A educação especial é uma modalidade transversal, já contada nas etapas. Matrículas em escolas privadas conveniadas com o município aparecem só na tabela, em coluna separada, e não entram na soma. Uma matrícula não é uma
        pessoa: o mesmo estudante pode ter mais de uma.
      </p>
      <details className="mt-2 text-sm">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
        <TabelaSimples
          legenda={`Matrículas por etapa, ${nomeCap}, ${ano}`}
          cabecalho={["Etapa", "Rede municipal", "Conveniadas com o município (à parte)"]}
          linhas={[
            ...dist.linhas.map((l) => [l.rotulo, l.rede !== null ? inteiro(l.rede) : "", l.conveniadas !== null ? inteiro(l.conveniadas) : ""]),
            ["Total da educação básica", inteiro(total), conv.valor !== null ? inteiro(conv.valor) : ""],
          ]}
        />
      </details>
      <div className="mt-1">
        <SobreEsteDado f={ficha} ctx={ctx} />
      </div>
    </div>
  );
}

export function PonteDaRazao({ ix, cap, ano, razao, ficha, ctx }: Base & { razao: Ponto; ficha: FichaIndicador; ctx: ContextoFicha }) {
  const ponte = ponteMatricula(ix, cap.cod, ano);
  const nomeCap = `${cap.nome} (${cap.uf})`;
  return (
    <div id="ponte" className="scroll-mt-24">
      <h3 className="font-semibold text-obee-tinta">Da despesa total à razão por matrícula: o que entra e o que fica fora</h3>
      <p className="mt-0.5 text-xs text-carvao-muted">
        {nomeCap} · R$ correntes · exercício {ano} · Matriz de Saldos Contábeis de dezembro, função 12, e DCA
      </p>
      {!ponte.linhas.length ? (
        <SemValor ponto={razao} contexto="A Matriz de Saldos Contábeis de dezembro não está disponível para esta capital e este exercício: a ponte não existe." />
      ) : (
        <>
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-obee-tinta">
            O total declarado na DCA é separado em parcelas mutuamente exclusivas, linha a linha da MSC, pela natureza da despesa. Entram no numerador a aplicação direta (modalidade 90) em geral e, em linha própria, a aplicação direta
            com beneficiário indeterminado; as demais parcelas ficam fora porque não têm matrícula correspondente no denominador. Nenhuma despesa é rateada por etapa e nenhuma matrícula conveniada é somada ao denominador.
          </p>
          <p className="mt-4 text-sm text-obee-tinta">
            <span className="font-semibold">Total declarado na DCA:</span> {reaisExtenso(ponte.total ?? 0)} (100%). Parcelas, em % do total:
          </p>
          <div className="mt-2 max-w-3xl">
            <BarrasComposicao
              linhas={ponte.linhas
                .filter((l) => l.componente !== "dca_total")
                .map((l) => ({
                  chave: l.componente,
                  rotulo: `${l.dentro ? "Dentro do numerador: " : "Fora do numerador: "}${l.rotulo}`,
                  pct: Math.max(0, l.participacao ?? 0),
                  detalhe: `${reaisExtenso(l.valor)} (${percentual(l.participacao ?? 0, 1)})`,
                }))}
            />
          </div>
          <p className="mt-3 text-sm text-obee-tinta">
            {ponte.reconcilia ? (
              <>
                <span aria-hidden="true">✓ </span>A soma das parcelas, com a diferença entre a DCA e a MSC (quando existe), é igual ao total da função na DCA ({reaisCompleto(ponte.total ?? 0)}).
              </>
            ) : (
              <>A MSC não reconcilia com a DCA neste exercício: as parcelas aparecem para transparência, mas o numerador por matrícula não é publicado.</>
            )}
          </p>
          <details className="mt-2 text-sm">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
            <TabelaSimples
              legenda={`Ponte da razão por matrícula, ${nomeCap}, ${ano}`}
              cabecalho={["Parcela", "R$", "% do total da DCA"]}
              linhas={ponte.linhas.map((l) => [l.rotulo, reaisCompleto(l.valor), l.participacao === null ? "" : percentual(l.participacao, 2)])}
            />
          </details>
        </>
      )}
      <div className="mt-1">
        <SobreEsteDado f={ficha} ctx={ctx} rotulo="Sobre este dado: a ponte" />
      </div>
    </div>
  );
}
