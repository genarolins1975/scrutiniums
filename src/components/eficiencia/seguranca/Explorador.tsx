'use client';

import Link from 'next/link';
import {useState} from 'react';
import type {LinhaNacional} from '@/lib/eficiencia/seguranca/dados';
import {contagemComUnidade, inteiro, listaNatural, numero, percentualVariacao, porDenominador, ROTULO_FONTE} from '@/lib/eficiencia/seguranca/formato';

type Grupo = {titulo: string; pergunta: string; nota: string};

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Um grupo de indicadores no Brasil: o último ano publicado de cada um, a variação sobre o ano anterior (calculada pela
 * gold só quando as 27 UFs têm dado nos dois anos), a taxa nacional e a cobertura. Cada linha leva à comparação por UF.
 */
export function Explorador({grupo, config, linhas: todas, rota}: {grupo: string; config: Grupo; linhas: LinhaNacional[]; rota: string}) {
  const [busca, setBusca] = useState(''), [ordem, setOrdem] = useState('titulo');
  const linhas = todas
    .filter((l) => sem(l.indicador.titulo).includes(sem(busca)))
    .sort((a, b) => ordem === 'variacao' ? (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity) : ordem === 'valor' ? b.n - a.n : a.indicador.titulo.localeCompare(b.indicador.titulo, 'pt-BR'));
  const anos = [...new Set(todas.map((l) => l.ano))].sort();
  const escala = Math.max(10, ...linhas.map((l) => Math.abs(l.variacao ?? 0)));
  const limite = Math.ceil(escala / 10) * 10;
  function baixar() {
    const cel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cab = ['indicador', 'fonte', 'ano', 'territorio', 'contagem', 'unidade', 'taxa', 'denominador', 'variacao_percentual_sobre_ano_anterior', 'ufs_com_dado', 'ufs_de_fora'];
    const corpo = linhas.map((l) => [l.indicador.titulo, ROTULO_FONTE[l.indicador.fonte], l.ano, 'Brasil', l.n, l.indicador.unidade, l.taxa === null ? '' : String(l.taxa).replace('.', ','), porDenominador(l.indicador.denominador, l.indicador.escala), l.variacao === null ? '' : String(l.variacao).replace('.', ','), l.cobertura, l.fora.join(' ')]);
    const url = URL.createObjectURL(new Blob(['﻿' + [cab, ...corpo].map((r) => r.map(cel).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = `seguranca-${grupo}-brasil.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section aria-labelledby="pergunta-painel" className="mt-8">
    <p className="rotulo text-obee-dark">Brasil · {anos.length === 1 ? anos[0] : `último ano publicado de cada fonte (${listaNatural(anos.map(String))})`}</p>
    <h1 id="pergunta-painel" className="mt-3 max-w-3xl font-serif text-3xl sm:text-4xl">{config.pergunta}</h1>
    <p className="mt-4 max-w-3xl leading-relaxed">{config.nota}</p>
    <div className="mt-6 flex flex-wrap items-end gap-4 border-y border-linha bg-superficie p-4">
      <label className="flex w-full min-w-0 flex-col gap-2 text-sm sm:w-auto sm:flex-1">Buscar indicador<input value={busca} onChange={(e) => setBusca(e.target.value)} className="min-h-[44px] w-full border border-obee-dark bg-superficie px-3" type="search"/></label>
      <label className="flex max-w-full flex-col gap-2 text-sm">Ordenar por<select value={ordem} onChange={(e) => setOrdem(e.target.value)} className="min-h-[44px] max-w-full border border-obee-dark bg-superficie px-3"><option value="titulo">Nome</option><option value="variacao">Variação, maior primeiro</option><option value="valor">Volume, maior primeiro</option></select></label>
      <button onClick={() => {setBusca(''); setOrdem('titulo');}} className="min-h-[44px] px-3 text-obee-dark underline">Limpar</button>
      <button onClick={baixar} disabled={!linhas.length} className="min-h-[44px] border border-obee-dark px-4 disabled:opacity-50">Baixar este recorte · CSV</button>
    </div>
    <p className="mt-3 text-sm text-carvao-muted">{linhas.length} indicadores no recorte. Os volumes têm unidades e conceitos próprios; a ordem não representa gravidade.</p>
    {linhas.length === 0 ? <p role="status" className="mt-8 border-l-4 border-obee pl-4">Nenhum indicador corresponde à busca. Limpe o campo para recuperar o recorte.</p> : <>
      <figure className="mt-8" aria-labelledby="titulo-variacao">
        <figcaption id="titulo-variacao" className="font-serif text-2xl">Variação sobre o ano anterior</figcaption>
        <p className="mt-2 text-sm">Percentual · cada indicador comparado com ele mesmo no ano anterior, só quando as 27 UFs têm dado nos dois anos. Esquerda: redução; direita: aumento. Escala de −{limite}% a +{limite}%.</p>
        <div className="mt-5 divide-y divide-linha">{linhas.map((l) => <div key={l.indicador.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_6rem] sm:items-center">
          <span className="text-sm">{l.indicador.titulo}{l.indicador.fonte === 'sim' && ' (SIM)'} <span className="text-carvao-muted">· {l.anoAnterior} a {l.ano}</span></span>
          <div aria-hidden="true" className="relative h-7 bg-obee-suave">{l.variacao !== null && <><span className="absolute inset-y-0 left-1/2 border-l border-obee-dark"/><span className="absolute top-2 h-3 bg-obee" style={{left: `${l.variacao < 0 ? 50 + l.variacao / limite * 50 : 50}%`, width: `${Math.abs(l.variacao) / limite * 50}%`}}/></>}</div>
          <span className="text-right font-semibold tabular-nums">{l.variacao === null ? <span className="text-sm font-normal">sem comparação</span> : percentualVariacao(l.variacao)}</span>
        </div>)}</div>
        <p className="mt-4 text-sm text-carvao-muted">Sem comparação: alguma UF sem dado publicado num dos dois anos (o motivo está na comparação por UF). Fontes: Sinesp VDE, registros das polícias estaduais; SIM, registros de óbito. As bases são revisadas pelas UFs depois da publicação.</p>
      </figure>
      <div className="mt-10"><h2 className="font-serif text-2xl">Valores, unidades e cobertura</h2><p id="ajuda-tabela" className="mt-2 text-sm">Em telas estreitas, role a tabela horizontalmente. O CSV contém todos os indicadores do recorte.</p>
        <div role="region" aria-label="Tabela de indicadores" aria-describedby="ajuda-tabela" tabIndex={0} className="mt-4 overflow-x-auto border-y border-linha"><table className="w-full min-w-[820px] text-sm"><caption className="sr-only">{config.titulo}, Brasil, último ano publicado de cada indicador.</caption>
          <thead className="bg-obee-suave"><tr>{['Indicador', 'Ano', 'Volume', 'Taxa nacional', 'Variação', 'Cobertura e comparação por UF'].map((t) => <th key={t} scope="col" className="p-3 text-left">{t}</th>)}</tr></thead>
          <tbody>{linhas.map((l) => <tr key={l.indicador.id} className="border-t border-linha">
            <th scope="row" className="p-3 text-left font-medium">{l.indicador.titulo}<span className="mt-1 block text-xs font-normal text-carvao-muted">{ROTULO_FONTE[l.indicador.fonte]}</span></th>
            <td className="p-3 tabular-nums">{l.ano}</td>
            <td className="p-3 text-right tabular-nums">{contagemComUnidade(l.indicador, l.n)}</td>
            <td className="p-3 text-right tabular-nums">{l.taxa === null ? 'sem taxa' : `${numero(l.taxa, 1)} ${porDenominador(l.indicador.denominador, l.indicador.escala)}`}</td>
            <td className="p-3 text-right tabular-nums">{l.variacao === null ? 'sem comparação' : percentualVariacao(l.variacao)}</td>
            <td className="max-w-xs p-3">{l.cobertura === 27 ? 'As 27 UFs' : `${inteiro(l.cobertura)} de 27 UFs; fora: ${l.fora.join(', ')}`}<Link href={`${rota}/estados?indicador=${l.indicador.id}&ano=${l.ano}`} className="mt-2 flex min-h-[44px] items-center text-obee-dark underline">Comparar as UFs →</Link></td>
          </tr>)}</tbody></table></div></div>
    </>}
  </section>;
}
