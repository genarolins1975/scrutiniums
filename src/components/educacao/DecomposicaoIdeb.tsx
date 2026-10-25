"use client";

import { useState } from "react";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { ETAPAS, type Etapa, type MunicipioGold } from "@/lib/educacao/tipos";
import { NOME_ETAPA } from "@/lib/educacao/paginas";
import { num } from "@/lib/educacao/formato";

const controle = "min-h-[44px] border border-mineral bg-superficie px-3 text-carvao";

/** Só seleciona resultados já calculados e validados no pipeline; não decompõe o índice no navegador. */
export function DecomposicaoIdeb({ m, anos }: { m: MunicipioGold; anos: number[] }) {
  const [etapa, setEtapa] = useState<Etapa>("ai");
  return <ModeloDidatico id="variacao-ideb" titulo="Aprendeu mais ou reprovou menos?"
    descricao={`Divisão matemática da mudança da rede municipal de ${m.nome}. Fonte: INEP, Ideb; cálculo da Scrutiniums com os componentes publicados.`}
    deixaDeFora={["Esta divisão não é causa", "Aprendizagem (N) e fluxo (P) não são independentes", "A mudança de alunos entre edições não é controlada", "O produto N × P difere do Ideb publicado pelo arredondamento do INEP"]}>
    <div className="flex flex-wrap items-center gap-3"><label htmlFor="variacao-etapa">Etapa</label>
      <select id="variacao-etapa" className={controle} value={etapa} onChange={e => setEtapa(e.target.value as Etapa)}>{ETAPAS.map(e => <option key={e} value={e}>{NOME_ETAPA[e]}</option>)}</select>
    </div>
    <ParDeEdicoes key={etapa} m={m} anos={anos} etapa={etapa} />
  </ModeloDidatico>;
}

function ParDeEdicoes({ m, anos, etapa }: { m: MunicipioGold; anos: number[]; etapa: Etapa }) {
  const pares = m.analises[etapa].variacoes;
  const recente = anos.at(-1)!;
  // Pedido do dono: edição mais recente e a de seis anos antes, ou o par publicado mais próximo.
  const padrao = [...pares].sort((a, b) => (Math.abs(anos[a[0]]-(recente-6))+Math.abs(anos[a[1]]-recente))-(Math.abs(anos[b[0]]-(recente-6))+Math.abs(anos[b[1]]-recente)))[0];
  const [inicio, setInicio] = useState(padrao?.[0] ?? 0);
  const [fim, setFim] = useState(padrao?.[1] ?? 0);
  const p = pares.find(v => v[0] === inicio && v[1] === fim);
  if (!p) return <p className="edm-aviso">Não há duas edições com Ideb, N e P publicados para esta etapa da rede municipal. Ausência não é variação igual a zero.</p>;
  const iniciais = [...new Set(pares.filter(v => v[1] === fim).map(v => v[0]))];
  const finais = [...new Set(pares.filter(v => v[0] === inicio).map(v => v[1]))];
  const [, , dn, dp, v0, v1, cn, cp] = p;
  const serie = m[etapa].municipal!;
  const formato = (n: number, casas = 2) => `${n > 0 ? "+" : ""}${num(n, casas)}`;
  return <div className="mt-5" data-decomposicao="">
    <div className="flex flex-wrap gap-5">
      <div className="grid gap-2"><label htmlFor="variacao-inicio">Edição inicial</label><select id="variacao-inicio" className={controle} value={inicio} onChange={e => setInicio(Number(e.target.value))}>{iniciais.map(k => <option key={k} value={k}>{anos[k]}</option>)}</select></div>
      <div className="grid gap-2"><label htmlFor="variacao-fim">Edição final</label><select id="variacao-fim" className={controle} value={fim} onChange={e => setFim(Number(e.target.value))}>{finais.map(k => <option key={k} value={k}>{anos[k]}</option>)}</select></div>
    </div>
    <div aria-live="polite">
      <p className="edm-intro">{NOME_ETAPA[etapa]}, rede municipal de {m.nome}, {anos[inicio]} a {anos[fim]}. Ideb publicado: {num(serie.ideb[inicio]!, 1)} e {num(serie.ideb[fim]!, 1)} pontos, de 0 a 10.</p>
      <dl className="edm-movimentos">
        <div><dt>Aprendizagem (N), de 0 a 10</dt><dd>{num(serie.n[inicio]!, 4)} → {num(serie.n[fim]!, 4)}</dd><dd>Movimento: {formato(dn, 4)}</dd></div>
        <div><dt>Fluxo (P), de 0 a 1</dt><dd>{num(serie.p[inicio]!, 4)} → {num(serie.p[fim]!, 4)}</dd><dd>Movimento: {formato(dp, 4)}</dd></div>
      </dl>
      {cn !== null && cp !== null ? <>
        <p className="edm-intro">O produto N × P passou de {num(v0, 4)} a {num(v1, 4)}: {formato(v1-v0, 4)} ponto. Na divisão logarítmica, as parcelas são:</p>
        <dl className="edm-movimentos edm-contribuicoes"><div><dt>Parcela da aprendizagem</dt><dd>{formato(cn)} ponto de Ideb</dd></div><div><dt>Parcela do fluxo</dt><dd>{formato(cp)} ponto de Ideb</dd></div></dl>
        <p className="edm-fonte">Parcelas arredondadas apenas para exibição. O cálculo usa a precisão completa de N e P da base publicada; a soma antes do arredondamento fecha a mudança do produto.</p>
      </> : <p className="edm-aviso">{Math.abs(v1-v0) < .05 ? "A mudança do produto é menor que 0,05 ponto. Mostramos só os movimentos de N e P, sem dividir a variação." : "Um componente é zero e não admite logaritmo. Mostramos só os movimentos de N e P, sem dividir a variação."}</p>}
    </div>
  </div>;
}
