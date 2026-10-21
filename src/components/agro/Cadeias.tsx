import Link from 'next/link';
import type { CadeiaId, EconomiaAgro, MedidaProducaoAgro, SnapshotAgro } from '@/lib/agro/tipos';
import { CADEIAS, numeroAgro } from '@/lib/agro/modelo';
import { mesCurtoAgro, variacaoPctAgro } from '@/lib/agro/economia';
import { BarrasAgro, SerieAgro, TabelaAgro } from './Graficos';
import { FonteAgro, SecaoAgro } from './Editorial';
import { ExportarAgro } from './Exportar';
import { IconeAgro } from './Figuras';
import s from './Agro.module.css';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = mesCurtoAgro;

const sinal = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : (v > 0 ? '+' : '') + numeroAgro(v, casas) + '%';
const pct = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v, casas) + '%';
const capturado = (dados: SnapshotAgro, id: string) => { const f = dados.fontes.find(x => x.id === id); return f?.capturadoEm ? 'Coletado na fonte em ' + new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(f.capturadoEm)) + '; a fonte pode revisar valores.' : ''; };
const url = (dados: SnapshotAgro, id: string) => dados.fontes.find(f => f.id === id)?.url ?? '';

/** Valor físico com a unidade da fonte, em escala legível: milhões de toneladas, bilhões de litros, milhões de m³. */
export function fisicoAgro(v: number | null | undefined, unidade: string) {
    if (v == null) return 'Não disponível';
    if (unidade === 'mil litros') return numeroAgro(v / 1e6, 1) + ' bilhões de litros';
    if (unidade === 'cabeças') return numeroAgro(v / 1e6, 1) + ' milhões de cabeças';
    if (unidade === 'm³') return numeroAgro(v / 1e6, 1) + ' milhões de m³';
    return v >= 1e6 ? numeroAgro(v / 1e6, 1) + ' milhões de t' : numeroAgro(v / 1e3, 0) + ' mil t';
}
/** US$ em bilhões a partir de 1 bilhão; abaixo disso, em milhões. */
export function dolarAgro(v: number | null | undefined) { return v == null ? 'Não disponível' : v >= 1e9 ? 'US$ ' + numeroAgro(v / 1e9, 1) + ' bi' : 'US$ ' + numeroAgro(v / 1e6, 0) + ' mi'; }

/** Números de uma cadeia, calculados do snapshot; nada é estimado aqui. */
export function resumoCadeiaAgro(e: EconomiaAgro, id: CadeiaId) {
    const c = e.cadeias.itens[id], p = c.producao.producao, serie = p.serie, ult = serie.at(-1)!, ant = serie.at(-2) ?? null, pri = serie[0];
    const atual = p.totalUltimos4 ?? ult.valor, conhecidos = p.ufs.filter(u => u.valor !== null), top = conhecidos.slice(0, 3);
    const exp = c.comercio.anual.at(-1)!, expAnt = c.comercio.anual.at(-2) ?? null, [mpAnt, mpAtual] = c.comercio.mesmoPeriodo, destino = c.comercio.destinos[0] ?? null;
    const ipca = c.ipca ? e.prato.itens.find(i => i.id === c.ipca) ?? null : null;
    return { c, p, atual, ult, ant, pri, top, conhecidos, sigilosos: p.ufs.filter(u => u.sigilo).length, semValor: p.ufs.filter(u => u.valor === null).length, exp, expAnt, mpAnt, mpAtual, destino, ipca, variacaoAno: variacaoPctAgro(ult.valor, ant?.valor ?? null), variacaoDecada: variacaoPctAgro(ult.valor, pri.valor), variacaoExp: variacaoPctAgro(exp.fob, expAnt?.fob ?? null), variacaoParcial: variacaoPctAgro(mpAtual?.fob ?? null, mpAnt?.fob ?? null) };
}

function Metrica({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) { return <div className={s.metric}><dt>{rotulo}</dt><dd>{valor}<p>{nota}</p></dd></div>; }

const SUJEITO: Partial<Record<CadeiaId, string>> = { bovinos: 'a carne bovina', frango: 'o frango', suinos: 'a carne suína', leite: 'o leite', celulose: 'a madeira da celulose', feijao: 'o feijão', cafe: 'o café', arroz: 'o arroz', milho: 'o milho', algodao: 'o algodão', soja: 'a soja', cana: 'a cana' };
const ehAbate = (p: MedidaProducaoAgro) => !!p.trimestres;

/** Estados com a maior parcela, o restante agregado e os sigilosos fora das barras. */
function EstadosBarras({ p, n = 8, titulo }: { p: MedidaProducaoAgro; n?: number; titulo: string }) {
    const conhecidos = p.ufs.filter(u => u.valor !== null), top = conhecidos.slice(0, n), resto = conhecidos.slice(n), sigilo = p.ufs.filter(u => u.sigilo).map(u => u.sigla), soma = conhecidos.reduce((a, u) => a + (u.participacao ?? 0), 0);
    const linhas = [...top.map((u, i) => ({ nome: u.sigla, valor: u.participacao, focal: i === 0 })), ...(resto.length ? [{ nome: `Demais ${resto.length} estados`, valor: resto.reduce((a, u) => a + (u.participacao ?? 0), 0) }] : [])];
    return <BarrasAgro titulo={titulo} unidade="% do total nacional" periodo={p.periodo} maximo={100} linhas={linhas} nota={`${p.medida}, ${p.tabela}. ${sigilo.length ? `${sigilo.length === 1 ? 'Um estado tem' : sigilo.length + ' estados têm'} dado sigiloso em algum trimestre (${sigilo.join(', ')}) e fica${sigilo.length === 1 ? '' : 'm'} fora das barras, sem virar zero; os estados com valor somam ${pct(soma)} do total.` : 'Os estados somam o total nacional.'}`}/>;
}

/** Produção, estados, comércio e mesa de uma cadeia, só com dado observado. */
export function CadeiaObservadaAgro({ dados, e, id }: { dados: SnapshotAgro; e: EconomiaAgro; id: CadeiaId }) {
    const r = resumoCadeiaAgro(e, id), meta = CADEIAS.find(c => c.id === id)!, { c, p } = r, abate = ehAbate(p), nomeMin = meta.nome.toLowerCase();
    const colsUf = ['UF', p.medida + ', ' + p.unidade, 'Parcela do total nacional, %', 'Sigilo em algum trimestre', 'Período'];
    const linhasUf = p.ufs.map(u => [u.sigla, u.valor, u.participacao, u.sigilo ? 'sim' : 'não', p.periodo]);
    const colsSerie = ['Ano', p.medida + ', ' + p.unidade, ...(c.producao.area ? ['Área colhida, ha'] : []), ...(c.producao.valorProducao ? ['Valor da produção, R$ correntes'] : []), ...(abate ? ['Animais abatidos, cabeças'] : [])];
    const linhasSerie = p.serie.map((x, i) => [x.ano, x.valor, ...(c.producao.area ? [c.producao.area[i]?.valor ?? null] : []), ...(c.producao.valorProducao ? [c.producao.valorProducao[i]?.valor ?? null] : []), ...(abate ? [x.cabecas ?? null] : [])]);
    const colsCom = ['Ano', 'Exportação, US$ FOB', 'Exportação, kg', 'Importação, US$ FOB', 'Importação, kg'];
    const linhasCom = c.comercio.anual.map(x => [x.ano, x.fob, x.kg, x.importFob, x.importKg]);
    const importa = r.exp.importFob > r.exp.fob;
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo={abate ? `Abate, ${p.periodo}` : `Produção em ${r.ult.ano}`} valor={fisicoAgro(r.atual, p.unidade)} nota={`${p.medida} · IBGE, ${p.tabela}${!abate && r.ant ? ` · ${sinal(r.variacaoAno)} sobre ${r.ant.ano}` : ''}`}/>
            <Metrica rotulo={`Maior produtor, ${r.top[0]?.sigla ?? ''}`} valor={pct(r.top[0]?.participacao, 0)} nota={`Do total nacional · os três maiores (${r.top.map(u => u.sigla).join(', ')}) somam ${pct(r.top.reduce((a, u) => a + (u.participacao ?? 0), 0), 0)} · ${p.periodo}`}/>
            <Metrica rotulo={`Exportação em ${r.exp.ano}`} valor={dolarAgro(r.exp.fob)} nota={`Comex Stat, posições ${c.comercio.posicoes.map(x => x.posicao).join(', ')} · ${r.expAnt ? sinal(r.variacaoExp) + ' sobre ' + r.expAnt.ano : ''}${importa ? ` · importação maior: ${dolarAgro(r.exp.importFob)}` : ''}`}/>
            <Metrica rotulo={r.destino ? `Principal destino, ${r.exp.ano}` : 'Principal destino'} valor={r.destino ? pct(r.destino.participacao, 0) : 'Não disponível'} nota={r.destino ? `${r.destino.pais} · de ${c.comercio.paisesDestino} países que compraram em ${r.exp.ano}` : 'Sem exportação registrada no ano'}/>
        </dl>
        <SecaoAgro id="producao" rotulo="Dado observado · produção" titulo={`De onde vem ${SUJEITO[id] ?? 'a produção de ' + nomeMin}?`} texto={`${r.top[0] ? `${r.top[0].sigla} responde por ${pct(r.top[0].participacao, 0)} ${abate ? 'do peso abatido' : 'do total'}; com ${r.top.slice(1).map(u => u.sigla).join(' e ')}, os três primeiros somam ${pct(r.top.reduce((a, u) => a + (u.participacao ?? 0), 0), 0)}.` : ''} ${!abate ? `Em dez anos, a produção ${(r.variacaoDecada ?? 0) >= 0 ? 'cresceu' : 'caiu'} ${pct(Math.abs(r.variacaoDecada ?? 0), 0)} (${r.pri.ano} a ${r.ult.ano}).` : ''}`}>
            <EstadosBarras p={p} titulo={`Parcela de cada estado · ${meta.nome}`}/>
            <SerieAgro titulo={abate ? 'Peso das carcaças por ano' : p.medida + ' por ano'} unidade={p.unidade} linhas={p.serie.map(x => ({ periodo: String(x.ano), valor: x.valor }))} nota={abate ? 'Soma dos quatro trimestres de cada ano, abate sob inspeção federal, estadual ou municipal.' : 'Produção anual publicada pelo IBGE; a do último ano pode ser revista.'}/>
            {c.producao.rebanho && <EstadosBarras p={c.producao.rebanho} titulo={`Rebanho por estado, 31/12/${c.producao.rebanho.periodo}`}/>}
            <TabelaAgro titulo={`Dez maiores estados · ${p.medida}`} colunas={colsUf} linhas={p.ufs.filter(u => u.valor !== null).slice(0, 10).map(u => [u.sigla, Math.round(u.valor!), u.participacao, u.sigilo ? 'sim' : 'não', p.periodo])}/><p className={s.note}>A tabela completa, com os 27 estados e os que não têm valor, está no CSV.</p>
            <div className={s.actions}><ExportarAgro nome={`agro-cadeia-${id}-estados.csv`} colunas={[...colsUf, 'Fonte']} linhas={linhasUf.map(l => [...l, url(dados, 'producao')])}/><ExportarAgro nome={`agro-cadeia-${id}-serie.csv`} colunas={[...colsSerie, 'Fonte']} linhas={linhasSerie.map(l => [...l, url(dados, 'producao')])} rotulo="Baixar série anual · CSV"/></div>
            <FonteAgro dados={dados} id="producao" periodo={p.periodo} nota={capturado(dados, 'producao')}/>
        </SecaoAgro>
        <SecaoAgro id="comercio" rotulo="Dado observado · comércio exterior" titulo={importa ? 'O Brasil compra mais do que vende.' : `Quanto se vende ao exterior e para quem?`} texto={`Em ${r.exp.ano}, as exportações de ${nomeMin} somaram ${dolarAgro(r.exp.fob)}${r.destino ? `; ${r.destino.pais} comprou ${pct(r.destino.participacao, 0)}` : ''}. ${r.mpAtual ? `De janeiro a ${['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][r.mpAtual.meses]} de ${r.mpAtual.ano}, ${sinal(r.variacaoParcial)} sobre o mesmo período de ${r.mpAnt.ano}.` : ''}`}>
            {c.comercio.destinos.length > 0 && <BarrasAgro titulo={`Destinos · ${meta.nome}`} unidade="% do valor FOB em US$" periodo={String(r.exp.ano)} maximo={100} linhas={[...c.comercio.destinos.map((d, i) => ({ nome: d.pais, valor: d.participacao, focal: i === 0 })), ...(c.comercio.paisesDestino > c.comercio.destinos.length ? [{ nome: `Demais ${c.comercio.paisesDestino - c.comercio.destinos.length} países`, valor: 100 - c.comercio.destinos.reduce((a, d) => a + (d.participacao ?? 0), 0) }] : [])]} nota="Soma das posições SH da cadeia. Valor FOB, sem frete e seguro."/>}
            <SerieAgro titulo="Exportação por ano" unidade="US$ FOB" linhas={c.comercio.anual.map(x => ({ periodo: String(x.ano), valor: x.fob }))} nota="Anos fechados, em dólares correntes, sem correção pela inflação americana."/>
            <TabelaAgro titulo="Posições do comércio exterior desta cadeia" colunas={['Posição SH', 'Produto', `Exportação ${r.exp.ano}, US$ FOB`, `Exportação ${r.exp.ano}, kg`]} linhas={c.comercio.posicoes.map(x => [x.posicao, x.nome, x.fob, x.kg])}/>
            <div className={s.actions}><ExportarAgro nome={`agro-cadeia-${id}-comercio.csv`} colunas={[...colsCom, 'Posições SH', 'Fonte']} linhas={linhasCom.map(l => [...l, c.comercio.posicoes.map(x => x.posicao).join(' '), url(dados, 'comexcadeias')])}/></div>
            <FonteAgro dados={dados} id="comexcadeias" periodo={`2010 a ${mesCurto(e.cadeias.comercioUltimoMes)}`} nota={`${capturado(dados, 'comexcadeias')} Valor de comércio não é preço recebido na fazenda.`}/>
        </SecaoAgro>
        {r.ipca && <SecaoAgro id="mesa" rotulo="Dado observado · preço ao consumidor" titulo="E no prato?" texto={`${r.ipca.nome}: ${sinal(r.ipca.doze, 2)} em 12 meses até ${mesCurto(e.prato.ultimoMes)}, contra ${sinal(e.prato.itens.find(i => i.id === '7169')?.doze, 2)} do IPCA geral. Peso de ${numeroAgro(r.ipca.peso ?? null, 2)}% na cesta das famílias.`}>
            <p className={s.note}>O preço ao consumidor inclui transporte, processamento, embalagem e varejo; não é o preço recebido pelo produtor. {id === 'bovinos' ? 'O item Carnes do IPCA reúne cortes bovinos e suínos.' : ''} <Link href="/agronegocio/prato" prefetch={false}>Ver todos os itens da cesta</Link>.</p>
        </SecaoAgro>}
    </>;
}

/** Cartões das 12 cadeias com um número de produção e um de exportação cada. */
export function PainelCadeiasAgro({ e }: { e: EconomiaAgro }) {
    return <div className={s.chainGrid}>{CADEIAS.map(meta => { const r = resumoCadeiaAgro(e, meta.id); return <Link href={'/agronegocio/cadeias/' + meta.id} key={meta.id} className={s.chainTile} prefetch={false}><IconeAgro tema={meta.id}/><h2 className={s.blockTitle}>{meta.nome}</h2><p><strong>{fisicoAgro(r.atual, r.p.unidade)}</strong> · {ehAbate(r.p) ? 'abate, ' + r.p.periodo : r.p.periodo}{r.top[0] ? ` · ${r.top[0].sigla} ${pct(r.top[0].participacao, 0)}` : ''}</p><p><strong>{dolarAgro(r.exp.fob)}</strong> exportados em {r.exp.ano}{r.destino ? ` · ${r.destino.pais} ${pct(r.destino.participacao, 0)}` : ''}</p></Link>; })}</div>;
}

/** Tabela-resumo das 12 cadeias, para comparação lado a lado e download. */
export function ResumoCadeiasAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const cols = ['Cadeia', 'Medida de produção', 'Valor', 'Unidade', 'Período', 'Maior estado', 'Parcela do maior estado, %', 'Exportação no último ano fechado, US$ FOB', 'Importação, US$ FOB', 'Principal destino', 'Parcela do principal destino, %'];
    const linhas = CADEIAS.map(meta => { const r = resumoCadeiaAgro(e, meta.id); return [meta.nome, r.p.medida, r.atual, r.p.unidade, r.p.periodo, r.top[0]?.sigla ?? null, r.top[0]?.participacao ?? null, r.exp.fob, r.exp.importFob, r.destino?.pais ?? null, r.destino?.participacao ?? null]; });
    const tela = CADEIAS.map(meta => { const r = resumoCadeiaAgro(e, meta.id); return [meta.nome, fisicoAgro(r.atual, r.p.unidade) + ' · ' + r.p.periodo, r.top[0] ? `${r.top[0].sigla} ${pct(r.top[0].participacao, 0)}` : null, dolarAgro(r.exp.fob), r.destino ? `${r.destino.pais} ${pct(r.destino.participacao, 0)}` : null]; });
    return <><TabelaAgro titulo={`As 12 cadeias lado a lado · exportação de ${e.cadeias.comercioAnoCompleto}`} colunas={['Cadeia', 'Produção', 'Maior estado', 'Exportação', 'Principal destino']} linhas={tela}/><p className={s.note}>O CSV traz os valores completos, unidades, períodos e a importação de cada cadeia.</p><div className={s.actions}><ExportarAgro nome="agro-cadeias-resumo.csv" colunas={[...cols, 'Fontes']} linhas={linhas.map(l => [...l, url(dados, 'producao') + ' ' + url(dados, 'comexcadeias')])}/></div></>;
}


/** O dado observado do tema no topo do capítulo, antes dos modelos didáticos, com link à pergunta. */
export function ObservadoCapituloAgro({ e, capitulo }: { e: EconomiaAgro; capitulo: string }) {
    const blocos: Record<string, { titulo: string; metricas: [string, string, string][]; links: [string, string][] }> = {
        'custos-renda': (() => { const f = e.comercio.insumos.mesmoPeriodo, fa = f.fertilizantes.at(-1)!, fp = f.fertilizantes.at(-2)!, rel = f.relacao.at(-1) ?? null, j = e.apoio.juros.meses.at(-1)!; return { titulo: 'Antes das contas, o que se observa sobre custos.', metricas: [[`Fertilizante importado, ${fa.meses < 12 ? 'jan a ' + MES[fa.meses - 1] + '/' : ''}${fa.ano}`, `US$ ${numeroAgro(fa.valorUnitario, 0)}/t`, `Valor médio de importação · ${sinal(variacaoPctAgro(fa.valorUnitario, fp.valorUnitario))} sobre o mesmo período de ${fp.ano} · Comex Stat`], ['Soja que paga 1 t de adubo', rel === null ? 'Não disponível' : numeroAgro(rel, 2) + ' t', 'Valor unitário do fertilizante importado sobre o da soja exportada, mesmo período · não é preço na fazenda'], [`Juros do crédito rural, ${mesCurto(j.mes)}`, pct(j.geral), `Taxa média contratada sem indexador · Pronaf ${pct(j.pronaf)} · Selic ${pct(j.selic)} · BCB, Sicor`]], links: [['/agronegocio/insumos', 'Quanto custam os insumos importados'], ['/agronegocio/apoio', 'Juros e subvenções do crédito rural']] }; })(),
        'alimentos-consumo': (() => { const g = e.prato.itens.find(i => i.id === '7169'), d = e.prato.itens.find(i => i.id === '7171'), maior = [...e.prato.itens].filter(i => !['7169', '7170', '7171', '7432'].includes(i.id)).sort((a, b) => (b.doze ?? -1e9) - (a.doze ?? -1e9))[0]; return { titulo: 'Antes do seu orçamento, o que os preços mostram.', metricas: [['Alimentação no domicílio, 12 meses', sinal(d?.doze, 2), `IPCA até ${mesCurto(e.prato.ultimoMes)} · índice geral ${sinal(g?.doze, 2)} · IBGE`], [`Maior alta da cesta acompanhada`, sinal(maior?.doze, 1), `${maior?.nome ?? ''} · 12 meses até ${mesCurto(e.prato.ultimoMes)}`]], links: [['/agronegocio/prato', 'Quanto custa a comida para as famílias']] }; })(),
        'logistica-mercados': (() => { const x = e.comercio.exportacoes.anual.at(-1)!, dst = e.comercio.exportacoes.destinos.paises[0]; return { titulo: 'Antes dos cenários, o que o comércio registra.', metricas: [[`Exportações de base agro, ${x.ano}`, dolarAgro(x.agro), `${pct(x.participacao)} de tudo o que o país exportou · Comex Stat`], [`Principal destino, ${x.ano}`, pct(dst.participacao, 0), `${dst.pais} · do valor exportado pelo recorte agro`]], links: [['/agronegocio/mercados', 'Para quem o agro vende'], ['/agronegocio/cadeias', 'Exportação por cadeia']] }; })(),
        'clima-ambiente': (() => { const t = e.ambiente.prodes.taxaAmazoniaLegal.filter(r => !r.estimada).at(-1)!, em = e.ambiente.emissoes.anos.at(-1)!, u = e.ambiente.usoTerra.anos.at(-1)!; return { titulo: 'Antes dos modelos, o que os satélites e inventários mostram.', metricas: [[`Desmatamento na Amazônia Legal, ${t.inicio}/${String(t.fim).slice(2)}`, numeroAgro(t.km2, 0) + ' km²', 'Taxa oficial consolidada · INPE, PRODES'], [`Emissões da agropecuária, ${em.ano}`, numeroAgro(em.agropecuaria / 1e6, 0) + ' Mt CO2e', 'Estimativa da sociedade civil, não o inventário oficial · SEEG'], [`Área de agropecuária, ${u.ano}`, numeroAgro(u.agropecuaria / 1e6, 0) + ' mi ha', `${pct(100 * u.agropecuaria / u.total, 0)} do território mapeado · MapBiomas`]], links: [['/agronegocio/ambiente', 'Quanto se desmata e quanto o campo emite']] }; })(),
    };
    const b = blocos[capitulo];
    if (!b) return null;
    return <SecaoAgro rotulo="Dado observado" titulo={b.titulo} texto="Números das páginas de perguntas, com fonte e período. Os modelos abaixo usam valores que você informa e não substituem estas medições."><dl className={`${s.metrics} ${b.metricas.length > 3 ? s.metrics4 : ''}`}>{b.metricas.map(([r, v, n]) => <Metrica key={r} rotulo={r} valor={v} nota={n}/>)}</dl><div className={s.actions}>{b.links.map(([h, t], i) => <Link key={h} className={i === 0 ? s.primaryButton : s.button} href={h} prefetch={false}>{t}</Link>)}</div></SecaoAgro>;
}
