import Link from 'next/link';
import type { EconomiaAgro, PaisesAgro, SnapshotAgro } from '@/lib/agro/tipos';
import { numeroAgro, mesAgro, PERGUNTAS_AGRO } from '@/lib/agro/modelo';
import { concentracaoAgro, mesCurtoAgro, mesesAgro, safraComparada, trimestreAgro, variacaoPctAgro } from '@/lib/agro/economia';
import { BarrasAgro, LinhasAgro, TabelaAgro } from './Graficos';
import { FonteAgro, LimiteAgro, SecaoAgro } from './Editorial';
import { ExportarAgro } from './Exportar';
import { SetaAgro } from './Figuras';
import { respostasPolitica, respostasSociedade } from './Sociedade';
import s from './Agro.module.css';

/** Nomes curtos dos capítulos do recorte agro; a tabela mantém o nome oficial. */
const CAPITULO_CURTO: Record<string, string> = { '01': 'Animais vivos', '02': 'Carnes', '03': 'Peixes e crustáceos', '04': 'Lácteos, ovos e mel', '05': 'Outros produtos animais', '06': 'Plantas e flores', '07': 'Hortaliças', '08': 'Frutas', '09': 'Café, chá e especiarias', '10': 'Cereais (milho, trigo, arroz)', '11': 'Produtos da moagem', '12': 'Soja e outras oleaginosas', '13': 'Gomas e resinas', '14': 'Outros vegetais', '15': 'Óleos e gorduras', '16': 'Preparações de carne e peixe', '17': 'Açúcares', '18': 'Cacau', '19': 'Preparações de cereais', '20': 'Preparações de frutas e hortaliças (sucos)', '21': 'Preparações alimentícias diversas', '22': 'Bebidas e álcool etílico', '23': 'Farelos e rações', '24': 'Fumo', '41': 'Peles e couros', '44': 'Madeira', '47': 'Celulose', '50': 'Seda', '51': 'Lã e pelos', '52': 'Algodão', '53': 'Outras fibras vegetais' };

const bi = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v / 1e9, casas);
const mi = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v / 1e6, casas);
const pct = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v, casas) + '%';
export const sinalAgro = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : (v > 0 ? '+' : '') + numeroAgro(v, casas) + '%';
const capturado = (dados: SnapshotAgro, id: string) => { const f = dados.fontes.find(x => x.id === id); return f?.capturadoEm ? 'Coletado na fonte em ' + new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(f.capturadoEm)) + '; a fonte pode revisar valores.' : ''; };
const url = (dados: SnapshotAgro, id: string) => dados.fontes.find(f => f.id === id)?.url ?? '';
const rotuloAno = (ano: number, meses: number) => meses === 12 ? String(ano) : `${ano} (${mesesAgro(ano, meses).replace('/' + ano, '')})`;

function Metrica({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) { return <div className={s.metric}><dt>{rotulo}</dt><dd>{valor}<p>{nota}</p></dd></div>; }

/** Barras dos maiores países com o restante agregado, para não apresentar os maiores como total. */
function PaisesBarras({ titulo, recorte, n, nota }: { titulo: string; recorte: PaisesAgro; n: number; nota: string }) {
    const top = recorte.paises.slice(0, n), resto = recorte.paises.slice(n);
    return <BarrasAgro titulo={titulo} unidade="% do valor FOB em US$" periodo={String(recorte.ano)} linhas={[...top.map((p, i) => ({ nome: p.pais, valor: p.participacao, focal: i === 0 })), ...(resto.length ? [{ nome: `Demais ${resto.length} países`, valor: resto.reduce((soma, p) => soma + p.participacao, 0) }] : [])]} maximo={100} nota={nota}/>;
}

function TabelaPaises({ dados, recorte, titulo, arquivo, universo }: { dados: SnapshotAgro; recorte: PaisesAgro; titulo: string; arquivo: string; universo: string }) {
    const cols = ['País', 'Valor FOB, US$', 'Massa líquida, kg', 'Participação no valor, %', 'Ano', 'Universo', 'Fonte'], linhas = recorte.paises.map(p => [p.pais, p.fob, p.kg, p.participacao, recorte.ano, universo, url(dados, 'comex')]);
    return <details className={s.sourceDetails}><summary>{titulo}</summary><div><TabelaAgro titulo={titulo} colunas={cols.slice(0, 4)} linhas={recorte.paises.map(p => [p.pais, p.fob, p.kg, p.participacao])}/><ExportarAgro nome={arquivo} colunas={cols} linhas={linhas}/></div></details>;
}

export function PerguntasAgro({ e, atual }: { e: EconomiaAgro; atual?: string }) {
    const d = respostasAgro(e);
    return <nav className={s.questionGrid} aria-label="Perguntas sobre o setor">{PERGUNTAS_AGRO.filter(p => p.id !== atual).map(p => <Link key={p.id} href={'/agronegocio/' + p.id} prefetch={false}><span className={s.letter}>{p.numero}</span><h3>{p.titulo}</h3><SetaAgro/><p>{d[p.id]}</p></Link>)}</nav>;
}

/** Resposta curta de cada pergunta, com o número que a prova. */
export function respostasAgro(e: EconomiaAgro): Record<(typeof PERGUNTAS_AGRO)[number]['id'], string> {
    const c = e.comercio, x = c.exportacoes, ult = x.anual.at(-1)!, safra = safraComparada(e, 'graos')!, m = c.insumos.mesmoPeriodo, fert = m.fertilizantes.at(-1)!, china = x.destinos.paises.find(p => p.pais === 'China'), chinaSoja = c.soja.destinos.paises.find(p => p.pais === 'China');
    return {
        tamanho: `${pct(e.pib.ultimos4.participacaoVa)} do valor adicionado do país em quatro trimestres até o ${trimestreAgro(e.pib.ultimos4.fim)}; ${pct(ult.participacao)} das exportações em ${ult.ano}.`,
        conjuntura: `Safra de grãos estimada em ${mi(safra.atual.producao)} milhões de toneladas em ${safra.atual.ano}, ${sinalAgro(safra.variacao)} sobre ${safra.atual.ano - 1}. Exportações agro ${sinalAgro(x.acumulado.variacaoAgro)} em ${mesesAgro(x.acumulado.ano, x.acumulado.meses)}.`,
        insumos: `Fertilizante importado a US$ ${numeroAgro(fert.valorUnitario, 0)} por tonelada em ${mesesAgro(fert.ano, fert.meses)}: ${numeroAgro(m.relacao.at(-1), 2)} t de soja exportada para cada tonelada.`,
        mercados: china && chinaSoja ? `A China comprou ${pct(china.participacao)} das exportações agro e ${pct(chinaSoja.participacao)} da soja em grão em ${x.destinos.ano}.` : `Destinos das exportações agro e da soja em ${x.destinos.ano}, por país.`,
        ...respostasSociedade(e),
        ...respostasPolitica(e),
    };
}

export function DestaquesAgro({ e }: { e: EconomiaAgro }) {
    const c = e.comercio, ult = c.exportacoes.anual.at(-1)!, safra = safraComparada(e, 'graos')!, m = c.insumos.mesmoPeriodo, cresc = e.pib.crescimento.acumulado4.at(-1)!;
    return <dl className={`${s.metrics} ${s.metrics4}`}>
        <Metrica rotulo="Agropecuária no valor adicionado do país" valor={pct(e.pib.ultimos4.participacaoVa)} nota={`IBGE, Contas Nacionais · ${trimestreAgro(e.pib.ultimos4.inicio)} a ${trimestreAgro(e.pib.ultimos4.fim)} · cresceu ${sinalAgro(cresc.agro)} em volume, contra ${sinalAgro(cresc.pib)} do PIB · dentro da porteira, não o agronegócio ampliado`}/>
        <Metrica rotulo="Exportações de base agropecuária" valor={pct(ult.participacao)} nota={`Comex Stat · ${ult.ano} · US$ ${bi(ult.agro)} bi de US$ ${bi(ult.total)} bi exportados · recorte por capítulo do Sistema Harmonizado`}/>
        <Metrica rotulo={`Safra de grãos estimada para ${safra.atual.ano}`} valor={`${mi(safra.atual.producao)} mi t`} nota={`IBGE, LSPA de ${mesAgro(safra.atual.mesEstimativa)} · ${sinalAgro(safra.variacao)} sobre a estimativa de dezembro de ${safra.atual.ano - 1} · cereais, leguminosas e oleaginosas`}/>
        <Metrica rotulo="Toneladas de soja exportada por tonelada de fertilizante importado" valor={numeroAgro(m.relacao.at(-1), 2)} nota={`Comex Stat · ${mesesAgro(m.soja.at(-1)!.ano, m.soja.at(-1)!.meses)} · ${numeroAgro(m.relacao.at(-2), 2)} no mesmo período de ${m.soja.at(-2)!.ano} · valores unitários de comércio, não preços na fazenda`}/>
    </dl>;
}

// ---------------------------------------------------------------- 1. Tamanho

export function TamanhoAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const p = e.pib, u = p.ultimos4, cresc = p.crescimento.acumulado4.at(-1)!, x = e.comercio.exportacoes, ult = x.anual.at(-1)!, anual = p.anual, taxas = p.crescimento.anual;
    const media = (k: 'agro' | 'pib') => { const v = taxas.slice(-10).map(r => r[k]).filter((n): n is number => n !== null); return v.reduce((a, b) => a + b, 0) / v.length; };
    const colsPib = ['Ano', 'Agropecuária, R$ milhões', 'Indústria, R$ milhões', 'Serviços, R$ milhões', 'Valor adicionado, R$ milhões', 'PIB, R$ milhões', 'Agropecuária no valor adicionado, %', 'Crescimento da agropecuária em volume, %', 'Crescimento do PIB em volume, %'];
    const linhasPib = anual.map(r => { const t = taxas.find(q => q.ano === r.ano); return [r.ano, r.agro, r.industria, r.servicos, r.va, r.pib, r.participacaoVa, t?.agro ?? null, t?.pib ?? null]; });
    return <>
        <dl className={s.metrics}>
            <Metrica rotulo="Valor adicionado da agropecuária" valor={`R$ ${numeroAgro(u.agro / 1e3, 1)} bi`} nota={`IBGE · ${trimestreAgro(u.inicio)} a ${trimestreAgro(u.fim)} · soma de quatro trimestres · preços correntes`}/>
            <Metrica rotulo="Parcela no valor adicionado do país" valor={pct(u.participacaoVa)} nota={`Mesmo período · ${pct(u.participacaoPib)} do PIB, que inclui impostos sobre produtos`}/>
            <Metrica rotulo="Crescimento em volume, quatro trimestres" valor={sinalAgro(cresc.agro)} nota={`Contra os quatro trimestres anteriores · PIB: ${sinalAgro(cresc.pib)} · até o ${trimestreAgro(cresc.periodo)}`}/>
        </dl>
        <SecaoAgro titulo="Dentro da porteira não é o agronegócio inteiro." texto="Três medidas respondem a perguntas diferentes. Elas não se somam nem se substituem.">
            <div className={s.conceptGrid}>
                <article><small>MEDIDO AQUI</small><h3>Agropecuária</h3><p>Lavouras, pecuária, produção florestal, pesca e aquicultura, como as Contas Nacionais definem. Valor adicionado é o que a atividade produz menos o que consome de insumos: a renda gerada no campo.</p></article>
                <article><small>NÃO INTEGRADO</small><h3>Agronegócio ampliado</h3><p>Soma insumos, agroindústria, comércio e transporte ligados ao campo. É uma estimativa de pesquisa, com método próprio, que este observatório ainda não incorporou. Não é o número ao lado.</p></article>
                <article><small>MEDIDO AQUI</small><h3>Exportações</h3><p>Valor dos bens vendidos ao exterior, em dólar. Inclui produtos industrializados como óleo, açúcar e celulose. Não é parcela do PIB: faturamento externo e renda gerada são contas diferentes.</p></article>
            </div>
        </SecaoAgro>
        <SecaoAgro titulo="Qual parcela da renda nacional vem do campo?" texto="A parcela em valores correntes sobe quando os preços agrícolas sobem mais que os demais, não só quando se produz mais.">
            <span className={s.status}>Dado observado · Contas Nacionais</span>
            <LinhasAgro titulo="Agropecuária no valor adicionado do Brasil" unidade="% do valor adicionado a preços básicos" rotulos={anual.map(r => String(r.ano))} series={[{ nome: 'Agropecuária', valores: anual.map(r => r.participacaoVa) }]} nota={`Anos civis completos, ${anual[0].ano} a ${anual.at(-1)!.ano}. Soma dos quatro trimestres de cada ano, em preços correntes. Os quatro trimestres mais recentes somam ${pct(u.participacaoVa)}.`}/>
            <LinhasAgro titulo="Crescimento anual em volume: campo e economia" unidade="% ante o ano anterior" rotulos={taxas.map(r => String(r.ano))} series={[{ nome: 'Agropecuária', valores: taxas.map(r => r.agro) }, { nome: 'PIB', valores: taxas.map(r => r.pib), referencia: true }]} nota={`Taxas publicadas pelo IBGE, sem efeito de preço. Nos últimos dez anos, a agropecuária variou em média ${sinalAgro(media('agro'))} ao ano e o PIB ${sinalAgro(media('pib'))}, com oscilações muito maiores no campo: clima e calendário da safra pesam sobre um único ano.`}/>
            <details className={s.sourceDetails}><summary>Ver todos os anos: valores, parcela e crescimento</summary><div><TabelaAgro titulo="Contas Nacionais · Brasil · valores correntes e taxas em volume" colunas={colsPib} linhas={linhasPib}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-valor-adicionado.csv" colunas={[...colsPib, 'Fonte', 'Limite']} linhas={linhasPib.map(r => [...r, url(dados, 'cnt'), 'Agropecuária dentro da porteira; não é o PIB do agronegócio ampliado.'])}/></div>
            <FonteAgro dados={dados} id="cnt" periodo={`${trimestreAgro(p.trimestres[0].periodo)} a ${trimestreAgro(p.trimestres.at(-1)!.periodo)}`} nota={capturado(dados, 'cnt')}/>
        </SecaoAgro>
        <SecaoAgro titulo="Quanto do que o país vende ao exterior vem do campo?" texto={`Em ${ult.ano}, os capítulos de base agropecuária somaram US$ ${bi(ult.agro)} bilhões de US$ ${bi(ult.total)} bilhões exportados.`}>
            <span className={s.status}>Dado observado · comércio exterior</span>
            <LinhasAgro titulo="Parcela agro nas exportações do Brasil" unidade="% do valor FOB em US$" rotulos={x.anual.map(r => String(r.ano))} series={[{ nome: 'Recorte agro', valores: x.anual.map(r => r.participacao) }]} nota={`${e.comercio.definicaoAgro} A parcela também se move com o preço do petróleo e do minério, que pesam no total.`}/>
            <FonteAgro dados={dados} id="comex" periodo={`${x.anual[0].ano} a ${ult.ano}`} nota={capturado(dados, 'comex')}/>
            <div className={s.actions}><Link className={s.button} href="/agronegocio/mercados" prefetch={false}>O que vendemos e para quem</Link></div>
        </SecaoAgro>
    </>;
}

// ---------------------------------------------------------------- 2. Conjuntura

export function ConjunturaAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const safra = safraComparada(e, 'graos')!, cresc = e.pib.crescimento, ult = cresc.acumulado4.at(-1)!, x = e.comercio.exportacoes, a = x.acumulado, c = dados.credito;
    const ids = ['graos', 'soja', 'milho', 'milho1', 'milho2', 'arroz', 'feijao', 'trigo', 'algodao', 'cana'];
    const linhasSafra = ids.map(id => safraComparada(e, id)!).map(r => [r.nome, r.anterior?.producao ?? null, r.atual.producao, r.variacao, r.anterior?.area ?? null, r.atual.area, variacaoPctAgro(r.atual.area, r.anterior?.area), r.anterior?.rendimento ?? null, r.atual.rendimento, variacaoPctAgro(r.atual.rendimento, r.anterior?.rendimento)]);
    const colsSafra = ['Produto', `Produção ${safra.atual.ano - 1}, t`, `Produção ${safra.atual.ano}, t`, 'Variação da produção, %', `Área colhida ${safra.atual.ano - 1}, ha`, `Área colhida ${safra.atual.ano}, ha`, 'Variação da área, %', `Rendimento ${safra.atual.ano - 1}, kg/ha`, `Rendimento ${safra.atual.ano}, kg/ha`, 'Variação do rendimento, %'];
    const graos = e.safra.produtos.find(p => p.id === 'graos')!.anos, soja = safraComparada(e, 'soja')!;
    const trimestres = cresc.trimestral.slice(-12), meses = Array.from({ length: 12 }, (_, i) => mesCurtoAgro(`2000-${String(i + 1).padStart(2, '0')}`).slice(0, 3));
    const serieMes = (ano: number) => meses.map((_, i) => { const r = x.mensal.find(m => m.mes === `${ano}-${String(i + 1).padStart(2, '0')}`); return r ? r.agro / 1e9 : null; });
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo={`Safra de grãos ${safra.atual.ano}`} valor={`${mi(safra.atual.producao)} mi t`} nota={`IBGE, LSPA de ${mesAgro(safra.atual.mesEstimativa)} · ${sinalAgro(safra.variacao)} sobre a estimativa de dezembro de ${safra.atual.ano - 1}`}/>
            <Metrica rotulo="Agropecuária em volume, quatro trimestres" valor={sinalAgro(ult.agro)} nota={`IBGE · até o ${trimestreAgro(ult.periodo)} · PIB: ${sinalAgro(ult.pib)} no mesmo período`}/>
            <Metrica rotulo={`Exportações agro, ${mesesAgro(a.ano, a.meses)}`} valor={`US$ ${bi(a.agro)} bi`} nota={`Comex Stat · ${sinalAgro(a.variacaoAgro)} sobre o mesmo período de ${a.ano - 1} · dólares correntes`}/>
            <Metrica rotulo="Crédito rural contratado em 12 meses" valor={`R$ ${bi(c.nacional.valor)} bi`} nota={`BCB/Sicor · ${mesAgro(c.janela.ini)} a ${mesAgro(c.janela.fim)} · ${sinalAgro(c.anteriorAdjacente.variacaoPct)} sobre os 12 meses anteriores · snapshot preservado, não coleta desta edição`}/>
        </dl>
        <SecaoAgro titulo="A safra cresce com mais área ou com mais produtividade?" texto={`Na soja, maior lavoura do país, a produção estimada varia ${sinalAgro(soja.variacao)}: área colhida ${sinalAgro(variacaoPctAgro(soja.atual.area, soja.anterior?.area))} e rendimento por hectare ${sinalAgro(variacaoPctAgro(soja.atual.rendimento, soja.anterior?.rendimento))}.`}>
            <span className={s.status}>Dado observado · estimativa oficial de safra</span>
            <BarrasAgro titulo="Safra de grãos, ano a ano" unidade="milhões de toneladas" periodo={`${graos[0].ano} a ${safra.atual.ano}`} linhas={graos.map(g => ({ nome: g.mesEstimativa.endsWith('-12') ? String(g.ano) : `${g.ano}, estimativa de ${mesAgro(g.mesEstimativa)}`, valor: g.producao == null ? null : g.producao / 1e6, focal: g.ano === safra.atual.ano }))} nota="Cereais, leguminosas e oleaginosas. Anos anteriores: estimativa de dezembro do próprio LSPA, depois substituída pela Produção Agrícola Municipal. O ano corrente ainda pode ser revisto."/>
            <TabelaAgro titulo={`Produção, área e rendimento · ${safra.atual.ano} contra ${safra.atual.ano - 1}`} colunas={colsSafra} linhas={linhasSafra}/>
            <p className={s.note}>Milho e feijão somam a produção das safras do ano; a área não é somada porque a mesma terra pode receber duas safras, e o rendimento fica por safra. O IBGE não publica rendimento para o agregado de grãos. Cana-de-açúcar não entra nos grãos.</p>
            <div className={s.actions}><ExportarAgro nome="agro-safra-lspa.csv" colunas={[...colsSafra, 'Estimativa', 'Fonte']} linhas={linhasSafra.map(r => [...r, mesAgro(safra.atual.mesEstimativa), url(dados, 'lspa')])}/></div>
            <FonteAgro dados={dados} id="lspa" periodo={`dezembros de ${graos[0].ano} a ${safra.atual.ano - 1} e ${mesAgro(safra.atual.mesEstimativa)}`} nota={capturado(dados, 'lspa')}/>
        </SecaoAgro>
        <SecaoAgro titulo="O ritmo trimestre a trimestre." texto="Cada ponto compara o trimestre com o mesmo trimestre do ano anterior. A colheita da soja concentra o resultado do campo no primeiro semestre.">
            <LinhasAgro titulo="Crescimento em volume contra o mesmo trimestre do ano anterior" unidade="%" rotulos={trimestres.map(t => trimestreAgro(t.periodo))} series={[{ nome: 'Agropecuária', valores: trimestres.map(t => t.agro) }, { nome: 'PIB', valores: trimestres.map(t => t.pib), referencia: true }]} nota="Taxas publicadas pelo IBGE (SIDRA 5932, variável 6561), sem ajuste sazonal. Trimestres de entressafra pesam pouco no ano e oscilam muito."/>
            <FonteAgro dados={dados} id="cnt" periodo={`${trimestreAgro(trimestres[0].periodo)} a ${trimestreAgro(trimestres.at(-1)!.periodo)}`} nota={capturado(dados, 'cnt')}/>
        </SecaoAgro>
        <SecaoAgro titulo="Exportações agro, mês a mês." texto={`Em ${mesesAgro(a.ano, a.meses)}, ${sinalAgro(a.variacaoAgro)} em dólares sobre o mesmo período de ${a.ano - 1}. Valor em dólar reflete preço e quantidade.`}>
            <LinhasAgro titulo="Exportações do recorte agro por mês" unidade="US$ bilhões FOB" rotulos={meses} series={[{ nome: String(a.ano), valores: serieMes(a.ano) }, { nome: String(a.ano - 1), valores: serieMes(a.ano - 1), referencia: true }]} nota={`Meses sem dado publicado não são preenchidos. Último mês disponível: ${mesAgro(e.comercio.ultimoMes)}, atualizado pelo Comex Stat em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(e.comercio.atualizadoNaFonte))}.`}/>
            <FonteAgro dados={dados} id="comex" periodo={`jan/${a.ano - 1} a ${mesCurtoAgro(e.comercio.ultimoMes)}`} nota={capturado(dados, 'comex')}/>
        </SecaoAgro>
        <SecaoAgro titulo={c.anteriorAdjacente.variacaoPct == null ? 'O crédito rural contratado.' : c.anteriorAdjacente.variacaoPct < 0 ? 'O crédito rural contratado caiu.' : 'O crédito rural contratado subiu.'} texto={`Foram R$ ${bi(c.nacional.valor)} bilhões contratados de ${mesAgro(c.janela.ini)} a ${mesAgro(c.janela.fim)}, ${sinalAgro(c.anteriorAdjacente.variacaoPct)} sobre os 12 meses anteriores, em valores nominais.`}>
            <LimiteAgro titulo="Calendário próprio">Este número vem de um snapshot preservado do Observatório de Crédito, processado em {c.capturaOriginal.slice(0, 10)}, e não da coleta desta edição. Contratação não é desembolso, saldo devedor nem custo fiscal.</LimiteAgro>
            <div className={s.actions}><Link className={s.button} href="/agronegocio/credito-protecao" prefetch={false}>Série mensal, finalidades e programas</Link><Link className={s.button} href="/agronegocio/atlas" prefetch={false}>Crédito rural por UF</Link></div>
        </SecaoAgro>
    </>;
}

// ---------------------------------------------------------------- 3. Insumos

export function InsumosAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const c = e.comercio, i = c.insumos, m = i.mesmoPeriodo, fert = i.fertilizantes, def = i.defensivos, completo = fert.find(r => r.ano === c.anoCompleto)!, defCompleto = def.find(r => r.ano === c.anoCompleto)!, troca = c.relacaoTroca, origens = i.origensFertilizantes;
    const fertAtual = m.fertilizantes.at(-1)!, fertAnterior = m.fertilizantes.at(-2)!;
    const pico = troca.reduce((a, b) => (b.relacao ?? 0) > (a.relacao ?? 0) ? b : a);
    const colsPos = ['Posição SH4', 'Grupo', 'Valor FOB, US$', 'Massa líquida, kg', 'Valor unitário, US$/t'], linhasPos = i.posicoes.map(p => { const r = p.anos.find(a => a.ano === c.anoCompleto)!; return [p.posicao, p.nome, r.fob, r.kg, r.valorUnitario]; });
    const colsTroca = ['Ano', 'Meses', 'Soja exportada, US$/t', 'Fertilizantes importados, US$/t', 'Toneladas de soja por tonelada de fertilizante'], linhasTroca = troca.map(r => [r.ano, r.meses, r.soja, r.fertilizantes, r.relacao]);
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo={`Fertilizantes importados em ${c.anoCompleto}`} valor={`${mi(completo.kg / 1000)} mi t`} nota={`Comex Stat · US$ ${bi(completo.fob)} bi FOB · posições 3101 a 3105`}/>
            <Metrica rotulo="Valor médio da tonelada importada" valor={`US$ ${numeroAgro(fertAtual.valorUnitario, 0)}`} nota={`${mesesAgro(fertAtual.ano, fertAtual.meses)} · ${sinalAgro(variacaoPctAgro(fertAtual.valorUnitario, fertAnterior.valorUnitario))} sobre o mesmo período de ${fertAnterior.ano} · volume ${sinalAgro(variacaoPctAgro(fertAtual.kg, fertAnterior.kg))}`}/>
            <Metrica rotulo="Soja exportada por tonelada de fertilizante" valor={`${numeroAgro(m.relacao.at(-1), 2)} t`} nota={`${mesesAgro(fertAtual.ano, fertAtual.meses)} · ${numeroAgro(m.relacao.at(-2), 2)} t no mesmo período de ${fertAnterior.ano} · quanto maior, mais caro o insumo em soja`}/>
            <Metrica rotulo={`Defensivos importados em ${c.anoCompleto}`} valor={`US$ ${bi(defCompleto.fob)} bi`} nota="Comex Stat · posição 3808, que inclui desinfetantes e produtos de uso doméstico · massa do produto, não do ingrediente ativo"/>
        </dl>
        <SecaoAgro id="e6" rotulo="Dado observado · E6" titulo="Quanto da soja paga o adubo?" texto={`Dividir o valor médio da tonelada de fertilizante importado pelo da tonelada de soja exportada mostra quanto grão compra uma tonelada de insumo. O pico da série foi ${numeroAgro(pico.relacao, 2)} t em ${rotuloAno(pico.ano, pico.meses)}.`}>
            <LinhasAgro titulo="Valor médio por tonelada: o que entra e o que sai" unidade="US$ FOB por tonelada" casas={0} rotulos={troca.map(r => rotuloAno(r.ano, r.meses))} series={[{ nome: 'Fertilizantes importados', valores: troca.map(r => r.fertilizantes) }, { nome: 'Soja exportada', valores: troca.map(r => r.soja), referencia: true }]} nota="Valor FOB dividido pela massa líquida. Mistura produtos diferentes: muda com a composição das compras. Não inclui frete interno, tributos e margens, e não é o preço pago ou recebido na fazenda."/>
            <LinhasAgro titulo="Toneladas de soja exportada por tonelada de fertilizante importado" unidade="t por t" casas={2} rotulos={troca.map(r => rotuloAno(r.ano, r.meses))} series={[{ nome: 'Relação', valores: troca.map(r => r.relacao) }]} nota="Indicador de comércio exterior. A relação de troca na fazenda depende do frete, do câmbio na data da compra, do prêmio de porto e da fórmula de adubação de cada lavoura. O ano corrente cobre só os meses publicados."/>
            <details className={s.sourceDetails}><summary>Ver os valores de cada ano</summary><div><TabelaAgro titulo="Valores unitários e relação, por ano" colunas={colsTroca} linhas={linhasTroca}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-relacao-troca.csv" colunas={[...colsTroca, 'Fonte', 'Limite']} linhas={linhasTroca.map(r => [...r, url(dados, 'comex'), 'Valores unitários de comércio exterior, não preços na fazenda.'])}/></div>
        </SecaoAgro>
        <SecaoAgro titulo="Quanto adubo entra e de que tipo." texto={`Em ${c.anoCompleto}, o país importou ${mi(completo.kg / 1000)} milhões de toneladas de fertilizantes. Em ${mesesAgro(fertAtual.ano, fertAtual.meses)}, o volume variou ${sinalAgro(variacaoPctAgro(fertAtual.kg, fertAnterior.kg))} e o valor médio ${sinalAgro(variacaoPctAgro(fertAtual.valorUnitario, fertAnterior.valorUnitario))} sobre o mesmo período de ${fertAnterior.ano}.`}>
            <BarrasAgro titulo="Fertilizantes importados por ano" unidade="milhões de toneladas" periodo={`${fert[0].ano} a ${fert.at(-1)!.ano}`} linhas={fert.map(r => ({ nome: rotuloAno(r.ano, r.meses), valor: r.kg / 1e9, focal: r.ano === c.anoCompleto }))} nota="Massa líquida das posições 3101 a 3105. O ano corrente cobre só os meses publicados e não se compara com anos inteiros."/>
            <TabelaAgro titulo={`Fertilizantes por grupo · ${c.anoCompleto}`} colunas={colsPos} linhas={linhasPos}/>
            <BarrasAgro titulo="Defensivos importados por ano" unidade="US$ bilhões FOB" periodo={`${def[0].ano} a ${def.at(-1)!.ano}`} linhas={def.map(r => ({ nome: rotuloAno(r.ano, r.meses), valor: r.fob / 1e9, focal: r.ano === c.anoCompleto }))} nota="Posição 3808: inseticidas, fungicidas, herbicidas e produtos semelhantes, inclusive desinfetantes e itens de uso doméstico. Valor em dólar correntes; a massa é do produto formulado."/>
            <FonteAgro dados={dados} id="comex" periodo={`${fert[0].ano} a ${mesCurtoAgro(c.ultimoMes)}`} nota={capturado(dados, 'comex')}/>
        </SecaoAgro>
        <SecaoAgro titulo="De onde vem o fertilizante." texto={`Os três maiores fornecedores responderam por ${pct(concentracaoAgro(origens.paises, 3))} do valor importado em ${origens.ano}.`}>
            <PaisesBarras titulo="Origem dos fertilizantes importados" recorte={origens} n={8} nota="País de origem declarado na importação, capítulo 31. Parcela do valor FOB do ano."/>
            <TabelaPaises dados={dados} recorte={origens} titulo={`Todas as origens · ${origens.ano}`} arquivo="agro-fertilizantes-origens.csv" universo="Importações do capítulo 31 (adubos)"/>
        </SecaoAgro>
        <SecaoAgro titulo="E o custo do dinheiro?" texto={`Quem financia o insumo paga juros. Em ${mesAgro(e.apoio.juros.ultimoMes)}, a taxa média dos contratos de crédito rural sem indexador foi ${numeroAgro(e.apoio.juros.meses.at(-1)!.geral, 1)}% ao ano: ${numeroAgro(e.apoio.juros.meses.at(-1)!.pronaf, 1)}% no Pronaf e ${numeroAgro(e.apoio.juros.meses.at(-1)!.demais, 1)}% fora dos programas.`}>
            <div className={s.actions}><Link className={s.button} href="/agronegocio/apoio" prefetch={false}>Juros por programa e subvenções do Tesouro</Link></div>
        </SecaoAgro>
        <LimiteAgro titulo="O que esta página ainda não mede">Custo de produção por lavoura (a Conab publica planilhas por município de referência, sob licença CC BY-ND, que não permite adaptar os dados, e com formato diferente a cada aba), preço do insumo na fazenda e consumo nacional de fertilizantes. Sem o consumo, não se calcula a parcela importada. Para testar hipóteses com seus próprios números, use os cenários de <Link href="/agronegocio/custos-renda#b1" prefetch={false}>margem</Link> e de <Link href="/agronegocio/custos-renda#k1" prefetch={false}>caixa da safra</Link>; eles não são estatística do setor.</LimiteAgro>
    </>;
}

// ---------------------------------------------------------------- 4. Mercados

export function MercadosAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const c = e.comercio, x = c.exportacoes, dest = x.destinos, soja = c.soja.destinos, origens = c.insumos.origensFertilizantes, ult = x.anual.at(-1)!;
    const composicao = x.composicao, top = composicao.slice(0, 10), resto = composicao.slice(10);
    const colsComp = ['Capítulo SH', 'Nome oficial', 'Valor FOB, US$', 'Massa líquida, kg', 'Parcela no recorte agro, %'], linhasComp = composicao.map(r => [r.capitulo, r.nome, r.fob, r.kg, 100 * r.fob / ult.agro]);
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo={`Maior destino das exportações agro em ${dest.ano}`} valor={pct(dest.paises[0].participacao)} nota={`${dest.paises[0].pais} · US$ ${bi(dest.paises[0].fob)} bi de US$ ${bi(dest.fob)} bi · Comex Stat`}/>
            <Metrica rotulo="Cinco maiores destinos somados" valor={pct(concentracaoAgro(dest.paises, 5))} nota={`${dest.paises.slice(0, 5).map(p => p.pais).join(', ')} · ${dest.paises.length} destinos no ano, entre países e territórios`}/>
            <Metrica rotulo="Maior comprador da soja em grão" valor={pct(soja.paises[0].participacao)} nota={`${soja.paises[0].pais} · ${dest.ano} · NCM 12019000`}/>
            <Metrica rotulo="Maior origem dos fertilizantes importados" valor={pct(origens.paises[0].participacao)} nota={`${origens.paises[0].pais} · ${origens.ano} · três maiores: ${pct(concentracaoAgro(origens.paises, 3))}`}/>
        </dl>
        <SecaoAgro titulo="O que o agro vende ao exterior." texto={`Em ${ult.ano}, dez capítulos responderam por ${pct(100 * top.reduce((a, b) => a + b.fob, 0) / ult.agro)} do recorte agro.`}>
            <span className={s.status}>Dado observado · comércio exterior</span>
            <BarrasAgro titulo="Exportações por grupo de produto" unidade="US$ bilhões FOB" periodo={String(ult.ano)} linhas={[...top.map((r, i) => ({ nome: CAPITULO_CURTO[r.capitulo] ?? r.nome, valor: r.fob / 1e9, focal: i === 0 })), ...(resto.length ? [{ nome: `Demais ${resto.length} capítulos do recorte`, valor: resto.reduce((a, b) => a + b.fob, 0) / 1e9 }] : [])]} nota={`Capítulos do Sistema Harmonizado com nome abreviado; a tabela traz o nome oficial. ${c.definicaoAgro}`}/>
            <details className={s.sourceDetails}><summary>Ver todos os capítulos do recorte</summary><div><TabelaAgro titulo={`Exportações por capítulo · ${ult.ano}`} colunas={colsComp} linhas={linhasComp}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-exportacoes-capitulos.csv" colunas={[...colsComp, 'Ano', 'Fonte']} linhas={linhasComp.map(r => [...r, ult.ano, url(dados, 'comex')])}/></div>
        </SecaoAgro>
        <SecaoAgro id="e3" rotulo="Dado observado · E3" titulo="Para quem o agro vende." texto={`A China levou ${pct(dest.paises[0].pais === 'China' ? dest.paises[0].participacao : dest.paises.find(p => p.pais === 'China')?.participacao)} do valor exportado pelo recorte agro em ${dest.ano} e ${pct(soja.paises.find(p => p.pais === 'China')?.participacao)} da soja em grão.`}>
            <PaisesBarras titulo="Destinos das exportações agro" recorte={dest} n={10} nota="País de destino declarado na exportação, não necessariamente o consumidor final: parte da carga é revendida em portos como os dos Países Baixos."/>
            <TabelaPaises dados={dados} recorte={dest} titulo={`Todos os destinos do recorte agro · ${dest.ano}`} arquivo="agro-exportacoes-destinos.csv" universo="Exportações dos capítulos do recorte agro"/>
            <PaisesBarras titulo="Destinos da soja em grão" recorte={soja} n={6} nota="NCM 12019000, soja mesmo triturada, exceto para semeadura. Farelo e óleo têm outros códigos e outros compradores."/>
            <TabelaPaises dados={dados} recorte={soja} titulo={`Todos os destinos da soja em grão · ${soja.ano}`} arquivo="agro-soja-destinos.csv" universo="Exportações da NCM 12019000"/>
            <FonteAgro dados={dados} id="comex" periodo={String(dest.ano)} nota={capturado(dados, 'comex')}/>
        </SecaoAgro>
        <SecaoAgro titulo="De quem dependemos." texto="A dependência aparece dos dois lados: comprador concentrado na venda e fornecedor concentrado no insumo.">
            <PaisesBarras titulo="Origem dos fertilizantes importados" recorte={origens} n={6} nota="Capítulo 31, parcela do valor FOB importado no ano. Sem o consumo nacional, não se calcula a parcela do adubo usado no país que vem de fora."/>
            <div className={s.actions}><Link className={s.button} href="/agronegocio/insumos" prefetch={false}>Preço e volume dos insumos importados</Link></div>
        </SecaoAgro>
        <LimiteAgro titulo="Como ler a concentração">Participação alta de um país descreve o ano observado; não mede risco nem prevê o próximo ano. Valores em dólar mudam com preço e quantidade. Corredores, portos e fretes ainda não estão integrados (item E1).</LimiteAgro>
    </>;
}
