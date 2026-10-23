'use client';

import {useState} from 'react';
import {Controles, TabelaDados} from '@/components/painel';
import type {LinhaNacional} from '@/lib/eficiencia/seguranca/dados';
import {contagemComUnidade, inteiro, numero, percentualVariacao, porDenominador, ROTULO_FONTE} from '@/lib/eficiencia/seguranca/formato';

type Grupo = {titulo: string; pergunta: string; nota: string};

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rotulo = 'rotulo block text-mineral';
const campo = 'mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-obee';
const botao = 'inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao hover:bg-carvao hover:text-marfim disabled:opacity-50';

/**
 * Um grupo de indicadores no Brasil: o último ano publicado de cada um, a variação sobre o ano anterior (calculada pela
 * gold só quando as 27 UFs têm dado nos dois anos), a taxa nacional e a cobertura. Cada linha leva à comparação por UF.
 *
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, a nota e o recorte passam à abertura da página, no
 * servidor; aqui ficam a busca e a ordem (no Controles do kit), a variação em barras divergentes (forma e escala simétrica de domínio,
 * marcada como legado: o kit não tem o estado "sem comparação" nem a escala de −x% a +x%) e a tabela do kit, à vista como antes, com o
 * link de cada linha para a comparação por UF.
 */
export function Explorador({grupo, config, linhas: todas, rota}: {grupo: string; config: Grupo; linhas: LinhaNacional[]; rota: string}) {
  const [busca, setBusca] = useState(''), [ordem, setOrdem] = useState('titulo');
  const linhas = todas
    .filter((l) => sem(l.indicador.titulo).includes(sem(busca)))
    .sort((a, b) => ordem === 'variacao' ? (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity) : ordem === 'valor' ? b.n - a.n : a.indicador.titulo.localeCompare(b.indicador.titulo, 'pt-BR'));
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
  return <div className="space-y-6">
    <Controles rotulo={`Recorte: ${config.titulo}`} resumo={`${linhas.length} indicadores no recorte. Os volumes têm unidades e conceitos próprios; a ordem não representa gravidade.`}>
      <label className="min-w-0 sm:w-72"><span className={rotulo}>Buscar indicador</span><input value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} type="search"/></label>
      <label className="min-w-0 sm:w-64"><span className={rotulo}>Ordenar por</span><select value={ordem} onChange={(e) => setOrdem(e.target.value)} className={campo}><option value="titulo">Nome</option><option value="variacao">Variação, maior primeiro</option><option value="valor">Volume, maior primeiro</option></select></label>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => {setBusca(''); setOrdem('titulo');}} className={botao}>Limpar</button><button type="button" onClick={baixar} disabled={!linhas.length} className={botao}>Baixar este recorte · CSV</button></div>
    </Controles>
    {linhas.length === 0 ? <p role="status" className="border-l border-carvao pl-4">Nenhum indicador corresponde à busca. Limpe o campo para recuperar o recorte.</p> : <>
      <figure aria-labelledby="titulo-variacao" data-figura-legado="">
        <figcaption id="titulo-variacao" className="t-h3 text-carvao">Variação sobre o ano anterior</figcaption>
        <p className="t-meta mt-2 text-carvao-muted">Percentual · cada indicador comparado com ele mesmo no ano anterior, só quando as 27 UFs têm dado nos dois anos. Esquerda: redução; direita: aumento. Escala de −{limite}% a +{limite}%.</p>
        <div className="mt-5 divide-y divide-linha">{linhas.map((l) => <div key={l.indicador.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_6rem] sm:items-center">
          <span className="text-sm">{l.indicador.titulo}{l.indicador.fonte === 'sim' && ' (SIM)'} <span className="text-carvao-muted">· {l.anoAnterior} a {l.ano}</span></span>
          <div aria-hidden="true" className="relative h-7 bg-obee-suave">{l.variacao !== null && <><span className="absolute inset-y-0 left-1/2 border-l border-obee-dark"/><span className="absolute top-2 h-3 bg-obee" style={{left: `${l.variacao < 0 ? 50 + l.variacao / limite * 50 : 50}%`, width: `${Math.abs(l.variacao) / limite * 50}%`}}/></>}</div>
          <span className="text-right font-semibold tabular-nums">{l.variacao === null ? <span className="text-sm font-normal">sem comparação</span> : percentualVariacao(l.variacao)}</span>
        </div>)}</div>
        <p className="t-meta mt-4 text-carvao-muted">Sem comparação: alguma UF sem dado publicado num dos dois anos (o motivo está na comparação por UF). Fontes: Sinesp VDE, registros das polícias estaduais; SIM, registros de óbito. As bases são revisadas pelas UFs depois da publicação.</p>
      </figure>
      <TabelaDados recolhida={false} tituloVisivel="Valores, unidades e cobertura" lead="Em telas estreitas, role a tabela horizontalmente. O CSV contém todos os indicadores do recorte."
        titulo={`${config.titulo}, Brasil, último ano publicado de cada indicador`} colunas={['Indicador', 'Fonte', 'Ano', 'Volume', 'Taxa nacional', 'Variação', 'Cobertura', 'Comparação por UF']}
        linhas={linhas.map((l) => [l.indicador.titulo, ROTULO_FONTE[l.indicador.fonte], String(l.ano), contagemComUnidade(l.indicador, l.n), l.taxa === null ? 'sem taxa' : `${numero(l.taxa, 1)} ${porDenominador(l.indicador.denominador, l.indicador.escala)}`, l.variacao === null ? 'sem comparação' : percentualVariacao(l.variacao), l.cobertura === 27 ? 'As 27 UFs' : `${inteiro(l.cobertura)} de 27 UFs; fora: ${l.fora.join(', ')}`, 'Comparar as UFs →'])}
        links={{'Comparação por UF': linhas.map((l) => `${rota}/estados?indicador=${l.indicador.id}&ano=${l.ano}`)}} limite={linhas.length}/>
    </>}
  </div>;
}
