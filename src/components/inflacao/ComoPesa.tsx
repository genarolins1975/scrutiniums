"use client";

import { useId, useMemo } from "react";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import { mesAno, mesExtenso, num, pct, pctSinal, pp, reais, reaisSinal } from "@/lib/inflacao/formato";
import { BRASIL, type AreaNoArtefato, type Grupo, type Referencia, type TipoArea } from "@/lib/inflacao/tipos";
import { BarraDivergente, COR_AREA, SeletorArea, dominio, useArea } from "./comum";

type AreaBasica = { id: string; nome: string; uf: string | null; tipo: TipoArea; rotulo: string };

function Etapa({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-linha pt-5">
      <h3 className="flex items-baseline gap-3 font-serif text-xl text-carvao">
        <span aria-hidden="true" className="font-sans text-sm text-bronze-dark [font-variant-numeric:tabular-nums]">{n}</span>
        {titulo}
      </h3>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

/**
 * Artefato "Como o IPCA pesa o seu orçamento". As etapas 1 e 2 são cálculo com os números publicados pelo IBGE: a fatia de
 * cada grupo no orçamento no começo da janela de 12 meses e a contribuição de cada grupo para a inflação da área, em pontos
 * percentuais (fatia × variação ÷ 100), que somam o índice com a diferença do arredondamento. A etapa 3 é um modelo
 * didático, identificado como tal: o leitor troca as fatias e vê como a mesma variação de preços pesaria num orçamento
 * diferente. A área é a mesma do resto da página (`?area=`).
 */
// `ref` é reservado pelo React (não chega ao componente): a referência do mês vai em `referencia`
export function ComoPesa({ grupos, areas, nomes, referencia: ref }: { grupos: Grupo[]; areas: AreaNoArtefato[]; nomes: AreaBasica[]; referencia: Referencia }) {
  const escolha = useArea(nomes);
  const a = areas.find((x) => x.id === escolha.valor) ?? areas.find((x) => x.id === BRASIL)!;
  const nome = nomes.find((x) => x.id === a.id)!;
  const onde = a.id === BRASIL ? "no Brasil" : `em ${nome.nome}`;
  const inicio = mesExtenso(ref.inicioJanela);
  const escalaFatia = { min: 0, max: Math.max(...grupos.map((g) => a.grupos[g.id].pesoInicio)) * 1.04 };
  const escalaContrib = dominio(grupos.map((g) => a.grupos[g.id].contribuicao));
  const exemplo = grupos[0];
  const ex = a.grupos[exemplo.id];
  // o grupo cuja fatia mais mudou dentro da janela: mostra por que a conta usa a fatia do começo
  const mudou = [...grupos].sort((x, y) => Math.abs(a.grupos[y.id].peso - a.grupos[y.id].pesoInicio) - Math.abs(a.grupos[x.id].peso - a.grupos[x.id].pesoInicio))[0];
  const m = a.grupos[mudou.id];
  return (
    <div className="space-y-6" data-artefato="como-o-ipca-pesa">
      <div className="max-w-prose2 space-y-3 text-[0.95rem] leading-relaxed text-carvao">
        <p>
          O IPCA mede quanto variaram os preços de uma cesta de produtos e serviços comprada pelas famílias com renda de 1 a 40 salários mínimos que moram
          nas 16 áreas pesquisadas pelo IBGE. Cada grupo de despesa entra com o peso que tem no orçamento médio dessas famílias, medido pela Pesquisa de
          Orçamentos Familiares. Por isso o índice é a inflação desse orçamento médio, e não o custo de vida de uma família específica: quem gasta mais
          com aluguel, escola ou transporte sente uma inflação diferente.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <SeletorArea areas={nomes} valor={a.id} onChange={escolha.selecionar} rotulo="Área do IPCA" />
        <p className="rotulo text-mineral">Cálculo com os números publicados pelo IBGE</p>
      </div>

      <Etapa n={1} titulo={`A fatia de cada grupo, e a conta que dá a inflação ${onde}`}>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          De cada R$ 100 que as famílias da pesquisa gastavam {onde} em {inicio}, começo dos 12 meses, quanto ia para cada grupo. Com a variação de preços
          do grupo até {mesExtenso(ref.ultimoMes)}, a mesma compra passou a custar mais, ou menos. Como a base é R$ 100, cada real a mais é um ponto
          percentual da inflação: é a contribuição do grupo.
        </p>
        <ul className="divide-y divide-linha border-y border-linha" aria-label={`Contribuição de cada grupo para a inflação ${onde}`}>
          {grupos.map((g) => {
            const x = a.grupos[g.id];
            return (
              <li key={g.id} className="grid gap-x-6 gap-y-1.5 py-3 lg:grid-cols-[minmax(0,13rem)_minmax(0,9rem)_minmax(0,1fr)_minmax(0,12rem)] lg:items-center" data-grupo={g.id}>
                <p className="text-[0.95rem] leading-snug text-carvao">
                  {g.nome}
                  <span className="block text-xs leading-relaxed text-mineral">{g.principais.join(", ")} e outros</span>
                </p>
                <BarraDivergente valor={x.pesoInicio} min={escalaFatia.min} max={escalaFatia.max} cor="var(--serie-referencia)" />
                <p className="text-sm leading-snug text-carvao [font-variant-numeric:tabular-nums]">
                  {reais(x.pesoInicio)} × {pctSinal(x.doze)} = {reaisSinal(x.contribuicao)}, <span className="font-medium">{pp(x.contribuicao, 2, true)}</span>
                </p>
                <BarraDivergente valor={x.contribuicao} min={escalaContrib.min} max={escalaContrib.max} cor={COR_AREA} />
              </li>
            );
          })}
        </ul>
        <p className="text-sm leading-relaxed text-carvao [font-variant-numeric:tabular-nums]" data-soma>
          Somando os nove grupos, a compra de R$ 100 passou a custar {reais(100 + a.soma)}, ou seja, <span className="font-medium">{pp(a.soma)}</span> de
          inflação. Inflação em 12 meses {onde}, publicada pelo IBGE: <span className="font-medium">{pct(a.doze)}</span>.{" "}
          {Math.abs(a.residuo) < 0.005
            ? "As duas contas coincidem com duas casas decimais."
            : <>A diferença, de {pp(Math.abs(a.residuo), 2)}, vem do arredondamento dos números publicados (variações com 2 casas e pesos com 4).</>}
        </p>
        <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
          Exemplo: {reais(ex.pesoInicio)} iam para {exemplo.nome} em {mesAno(ref.inicioJanela)}; com variação de {pctSinal(ex.doze)} em 12 meses, a mesma
          compra passou a custar {reais(ex.pesoInicio + ex.contribuicao)}, {reaisSinal(ex.contribuicao)}: {pp(ex.contribuicao, 2, true)} na inflação. Em
          fórmula, fatia × variação ÷ 100. A barra cinza é a fatia; a de cor, a contribuição. Um grupo pesado com variação pequena pode contribuir mais que um
          grupo leve que subiu muito.
        </p>
      </Etapa>

      <Etapa n={2} titulo="Por que a fatia do começo dos 12 meses">
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
          A fatia de cada grupo muda todo mês junto com os preços: o grupo que sobe mais que a média passa a ocupar uma parte maior do orçamento. {onde.replace(/^./, (c) => c.toUpperCase())},
          {" "}{mudou.nome} pesava {pct(m.pesoInicio)} em {mesAno(ref.inicioJanela)} e {pct(m.peso)} em {mesAno(ref.ultimoMes)}. A conta usa a fatia do começo,
          porque foi sobre aquele orçamento que os preços variaram nos 12 meses. A primeira tela mostra a fatia mais recente.
        </p>
      </Etapa>

      <Etapa n={3} titulo="E se o seu orçamento fosse diferente?">
        <Simulador grupos={grupos} area={a} onde={onde} />
      </Etapa>
    </div>
  );
}

/**
 * Modelo didático: o leitor muda a fatia de cada grupo e vê a variação que a mesma inflação de cada grupo daria nesse
 * orçamento (média das variações dos grupos ponderada pelas fatias escolhidas). Deixa de fora tudo o que muda de uma
 * família para outra dentro de cada grupo: a composição interna continua a do IPCA.
 */
function Simulador({ grupos, area, onde }: { grupos: Grupo[]; area: AreaNoArtefato; onde: string }) {
  const id = useId();
  const iniciais = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, Math.round(area.grupos[g.id].pesoInicio * 10) / 10])), [grupos, area]);
  const esquema = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, campo(tiposUrl.numero({ min: 0, max: 60 }), iniciais[g.id], { param: `peso_${g.id}`, historico: "replace" })])), [grupos, iniciais]);
  const [fatias, setFatias] = useEstadoUrl(esquema);
  const soma = grupos.reduce((s, g) => s + (fatias[g.id] ?? 0), 0);
  const resultado = soma > 0 ? grupos.reduce((s, g) => s + (fatias[g.id] ?? 0) * area.grupos[g.id].doze, 0) / soma : null;
  const mudou = grupos.some((g) => fatias[g.id] !== iniciais[g.id]);
  return (
    <div className="space-y-4" data-modelo-didatico>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
        Mova as fatias para parecer com o seu orçamento. A variação de cada grupo continua a do IPCA {onde}; muda só quanto cada grupo pesa. As fatias não
        precisam somar 100: a conta divide pela soma.
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:gap-x-8 lg:grid-cols-3">
        {grupos.map((g) => (
          <div key={g.id} className="min-w-0">
            <label htmlFor={`${id}-${g.id}`} className="flex items-baseline justify-between gap-2 text-sm text-carvao">
              <span className="min-w-0">{g.nome}</span>
              <output htmlFor={`${id}-${g.id}`} className="shrink-0 text-carvao-muted [font-variant-numeric:tabular-nums]">{num(fatias[g.id] ?? 0, 1)}</output>
            </label>
            <input
              id={`${id}-${g.id}`}
              type="range"
              min={0}
              max={60}
              step={0.5}
              value={fatias[g.id] ?? 0}
              aria-valuetext={`${num(fatias[g.id] ?? 0, 1)} de cada 100; variação do grupo ${pctSinal(area.grupos[g.id].doze)}`}
              onChange={(e) => setFatias((f) => ({ ...f, [g.id]: Number(e.target.value) }))}
              className="mt-1 block h-11 w-full accent-[var(--cor-bronze-dark)]"
            />
          </div>
        ))}
      </div>
      <div role="status" aria-live="polite" className="border-l-2 border-bronze pl-4">
        <p className="text-sm text-carvao-muted">Com essas fatias, a mesma variação de preços daria, em 12 meses:</p>
        <p className="mt-1 font-sans text-[1.75rem] leading-tight text-carvao [font-variant-numeric:tabular-nums]">{resultado === null ? "sem conta: todas as fatias estão em zero" : pct(resultado)}</p>
        <p className="mt-1 text-sm text-carvao-muted [font-variant-numeric:tabular-nums]">
          IPCA {onde}: {pct(area.doze)}. Soma das suas fatias: {num(soma, 1)}.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setFatias(iniciais)}
        disabled={!mudou}
        className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao disabled:border-linha disabled:text-mineral"
      >
        Voltar às fatias do IPCA
      </button>
      <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
        O que o modelo deixa de fora: dentro de cada grupo, a composição continua a do IPCA (quem não tem carro não paga gasolina, mas a variação de
        Transportes inclui a gasolina); juros de dívidas e outros gastos que não entram na cesta do IPCA; e a diferença entre o preço que você paga e o preço
        médio pesquisado.
        Não é uma medida oficial.
      </p>
    </div>
  );
}
