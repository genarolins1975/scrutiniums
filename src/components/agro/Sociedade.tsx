import Link from 'next/link';
import type { EconomiaAgro, SnapshotAgro } from '@/lib/agro/tipos';
import { numeroAgro, mesAgro } from '@/lib/agro/modelo';
import { mesCurtoAgro, trimestreAgro, variacaoPctAgro } from '@/lib/agro/economia';
import { BarrasAgro, DivergenteAgro, LinhasAgro, TabelaAgro } from './Graficos';
import { FonteAgro, LimiteAgro, SecaoAgro } from './Editorial';
import { ExportarAgro } from './Exportar';
import { AlimentacaoObservadaAgro } from './DadosObservados';
import s from './Agro.module.css';

const pct = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v, casas) + '%';
const sinal = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : (v > 0 ? '+' : '') + numeroAgro(v, casas) + '%';
const mi = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v / 1e6, casas);
const capturado = (dados: SnapshotAgro, id: string) => { const f = dados.fontes.find(x => x.id === id); return f?.capturadoEm ? 'Coletado na fonte em ' + new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(f.capturadoEm)) + '; a fonte pode revisar valores.' : ''; };
const url = (dados: SnapshotAgro, id: string) => dados.fontes.find(f => f.id === id)?.url ?? '';
function Metrica({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) { return <div className={s.metric}><dt>{rotulo}</dt><dd>{valor}<p>{nota}</p></dd></div>; }

/** Faixas do Censo agrupadas em quatro tamanhos legíveis, preservando a soma publicada. */
export function faixasAgro(e: EconomiaAgro) {
    const grupos = e.produtores.gruposArea, limite = (nome: string) => { const m = nome.replace(/\./g, '').replace(',', '.').match(/[\d.]+/); return m ? Number(m[0]) : null; };
    const faixas = [
        { nome: 'Menos de 10 ha', teste: (n: number) => n < 10 },
        { nome: 'De 10 a menos de 100 ha', teste: (n: number) => n >= 10 && n < 100 },
        { nome: 'De 100 a menos de 1.000 ha', teste: (n: number) => n >= 100 && n < 1000 },
        { nome: '1.000 ha ou mais', teste: (n: number) => n >= 1000 },
    ];
    const comArea = grupos.filter(g => g.id !== '111560'), semArea = grupos.find(g => g.id === '111560');
    const linhas = faixas.map(f => { const sel = comArea.filter(g => { const n = limite(g.nome.startsWith('Mais de 0') ? '0' : g.nome); return n !== null && f.teste(n); }); return { nome: f.nome, estabelecimentos: sel.reduce((a, g) => a + (g.estabelecimentos ?? 0), 0), area: sel.reduce((a, g) => a + (g.area ?? 0), 0) }; });
    return { linhas, semArea: semArea?.estabelecimentos ?? null };
}

export function respostasSociedade(e: EconomiaAgro) {
    const t = e.produtores.tipologia, tri = e.trabalho.trimestres.at(-1)!, ultimo = e.prato.meses.at(-1)!;
    return {
        produtores: `A agricultura familiar reúne ${pct(100 * t.familiar.estabelecimentos / t.total.estabelecimentos, 0)} dos estabelecimentos e ${pct(100 * t.familiar.area / t.total.area, 0)} da área (Censo 2017). No campo, a renda média do trabalho é ${pct(100 * tri.razaoRendimento, 0)} da média do país (${trimestreAgro(tri.periodo)}).`,
        prato: `Em 12 meses até ${mesCurtoAgro(e.prato.ultimoMes)}, a alimentação no domicílio variou ${sinal(ultimo.domicilio)}, contra ${sinal(ultimo.geral)} do IPCA geral.`,
    };
}

// ---------------------------------------------------------------- 5. Produtores e trabalho

export function ProdutoresAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const t = e.produtores.tipologia, part = (k: keyof typeof t.total) => 100 * t.familiar[k] / t.total[k], tri = e.trabalho.trimestres, ult = tri.at(-1)!, ano = tri.find(r => r.periodo === `${Number(ult.periodo.slice(0, 4)) - 1}${ult.periodo.slice(4)}`) ?? null;
    const { linhas: faixas, semArea } = faixasAgro(e), grande = faixas.at(-1)!, pequena = faixas[0];
    const colsTip = ['Medida', 'Agricultura familiar', 'Não familiar', 'Total', 'Parcela familiar, %'];
    const medidas: [keyof typeof t.total, string][] = [['estabelecimentos', 'Estabelecimentos'], ['area', 'Área, hectares'], ['pessoal', 'Pessoal ocupado, pessoas'], ['valorProducao', 'Valor da produção, R$ de 2017']];
    const linhasTip = medidas.map(([k, n]) => [n, t.familiar[k], t.naoFamiliar[k], t.total[k], part(k)]);
    const colsTri = ['Trimestre', 'Ocupados no agro', 'Ocupados no país', 'Parcela agro, %', 'Rendimento médio real no agro, R$', 'Rendimento médio real no país, R$', 'Agro em relação ao país, %'];
    const linhasTri = tri.map(r => [trimestreAgro(r.periodo), r.ocupadosAgro, r.ocupadosTotal, r.participacao, r.rendimentoAgro, r.rendimentoTotal, 100 * r.razaoRendimento]);
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo="Estabelecimentos agropecuários" valor={`${mi(t.total.estabelecimentos, 2)} mi`} nota={`IBGE, Censo Agropecuário ${e.produtores.ano} · ${pct(part('estabelecimentos'), 0)} de agricultura familiar`}/>
            <Metrica rotulo="Área da agricultura familiar" valor={pct(part('area'), 0)} nota={`Da área dos estabelecimentos · ${pct(part('valorProducao'), 0)} do valor da produção · ${e.produtores.ano}`}/>
            <Metrica rotulo={`Ocupados no campo, ${trimestreAgro(ult.periodo)}`} valor={`${mi(ult.ocupadosAgro)} mi`} nota={`IBGE, PNAD Contínua · ${pct(ult.participacao)} dos ocupados do país${ano ? ` · ${sinal(variacaoPctAgro(ult.ocupadosAgro, ano.ocupadosAgro))} em um ano` : ''}`}/>
            <Metrica rotulo="Renda média do trabalho no campo" valor={`R$ ${numeroAgro(ult.rendimentoAgro, 0)}`} nota={`Habitual, real, por mês · ${pct(100 * ult.razaoRendimento, 0)} da média do país (R$ ${numeroAgro(ult.rendimentoTotal, 0)}) · ${trimestreAgro(ult.periodo)}`}/>
        </dl>
        <SecaoAgro id="f4" rotulo="Dado observado · F4" titulo="Muitos estabelecimentos pequenos, pouca terra." texto={`Em ${e.produtores.ano}, os estabelecimentos com menos de 10 hectares eram ${pct(100 * pequena.estabelecimentos / t.total.estabelecimentos, 0)} do total e ocupavam ${pct(100 * pequena.area / t.total.area, 1)} da área. Os de 1.000 hectares ou mais eram ${pct(100 * grande.estabelecimentos / t.total.estabelecimentos, 1)} e ocupavam ${pct(100 * grande.area / t.total.area, 0)}.`}>
                        <BarrasAgro titulo="Parcela no número de estabelecimentos" unidade="% dos estabelecimentos" periodo={String(e.produtores.ano)} maximo={100} linhas={faixas.map(f => ({ nome: f.nome, valor: 100 * f.estabelecimentos / t.total.estabelecimentos }))} nota={`Grupos de área total do Censo reunidos em quatro faixas. ${semArea ? `Produtores sem área (${numeroAgro(semArea)} estabelecimentos) entram no total, mas não em nenhuma faixa.` : ''}`}/>
            <BarrasAgro titulo="Parcela na área dos estabelecimentos" unidade="% da área" periodo={String(e.produtores.ano)} maximo={100} linhas={faixas.map(f => ({ nome: f.nome, valor: 100 * f.area / t.total.area, focal: f === grande }))} nota="Área total dos estabelecimentos, inclusive matas, pastagens e áreas não usadas para produção. Não é área plantada."/>
            <TabelaAgro titulo={`Agricultura familiar e não familiar · Censo ${e.produtores.ano}`} colunas={colsTip} linhas={linhasTip}/>
            <p className={s.note}>Agricultura familiar pela Lei 11.326/2006: área de até quatro módulos fiscais, mão de obra e renda predominantemente da família e gestão familiar. Valor da produção em reais de 2017, sem correção. O Censo é um retrato de 2017; o próximo ainda não foi publicado.</p>
            <div className={s.actions}><ExportarAgro nome="agro-censo-tipologia.csv" colunas={[...colsTip, 'Ano', 'Fonte']} linhas={linhasTip.map(r => [...r, e.produtores.ano, url(dados, 'censoagro')])}/></div>
            <FonteAgro dados={dados} id="censoagro" periodo={String(e.produtores.ano)} nota={capturado(dados, 'censoagro')}/>
        </SecaoAgro>
        <SecaoAgro titulo={`${ult.ocupadosAgro < tri[0].ocupadosAgro ? 'Menos' : 'Mais'} gente no campo, renda ${ult.razaoRendimento < 1 ? 'abaixo' : 'acima'} da média do país.`} texto={`O campo ocupava ${pct(tri[0].participacao)} dos trabalhadores do país em ${trimestreAgro(tri[0].periodo)} e ${pct(ult.participacao)} em ${trimestreAgro(ult.periodo)}. A renda média passou de ${pct(100 * tri[0].razaoRendimento, 0)} para ${pct(100 * ult.razaoRendimento, 0)} da média nacional.`}>
            <span className={s.status}>Dado observado · PNAD Contínua</span>
            <LinhasAgro titulo="Ocupados na agropecuária" unidade="milhões de pessoas" rotulos={tri.map(r => trimestreAgro(r.periodo))} series={[{ nome: 'Agropecuária', valores: tri.map(r => r.ocupadosAgro / 1e6) }]} nota="Pessoas de 14 anos ou mais cujo trabalho principal é agricultura, pecuária, produção florestal, pesca ou aquicultura, formais ou informais. Não inclui agroindústria, comércio e transporte ligados ao campo."/>
            <LinhasAgro titulo="Renda média mensal do trabalho" unidade="R$ do último trimestre, habitual" casas={0} rotulos={tri.map(r => trimestreAgro(r.periodo))} series={[{ nome: 'Agropecuária', valores: tri.map(r => r.rendimentoAgro) }, { nome: 'Todos os ocupados', valores: tri.map(r => r.rendimentoTotal), referencia: true }]} nota="Rendimento habitual do trabalho principal, deflacionado pelo IBGE. Média por pessoa ocupada com rendimento; não inclui renda de propriedade nem lucro do estabelecimento."/>
            <details className={s.sourceDetails}><summary>Ver todos os trimestres</summary><div><TabelaAgro titulo="Ocupação e renda · PNAD Contínua" colunas={colsTri} linhas={linhasTri}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-pnadc-ocupacao-renda.csv" colunas={[...colsTri, 'Fonte']} linhas={linhasTri.map(r => [...r, url(dados, 'pnadc')])}/></div>
            <FonteAgro dados={dados} id="pnadc" periodo={`${trimestreAgro(tri[0].periodo)} a ${trimestreAgro(ult.periodo)}`} nota={capturado(dados, 'pnadc')}/>
        </SecaoAgro>
        <LimiteAgro titulo="Três fontes, três universos">O Censo conta estabelecimentos em 2017; a PNAD conta pessoas pelo trabalho principal, a cada trimestre; o emprego formal da <Link href="/agronegocio/empresas-trabalho" prefetch={false}>seção A da CNAE</Link> conta vínculos com carteira. Os números não se somam nem se substituem. Informalidade e renda por estado ainda não estão integradas.</LimiteAgro>
    </>;
}

// ---------------------------------------------------------------- 8. Comida no prato

export function PratoAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const p = e.prato, meses = p.meses.filter(m => m.geral !== null), ult = meses.at(-1)!, itens = p.itens.filter(i => !['7169', '7170', '7171', '7432'].includes(i.id) && i.doze !== null).sort((a, b) => (b.doze ?? 0) - (a.doze ?? 0));
    const pico = meses.reduce((a, b) => (b.domicilio ?? -Infinity) > (a.domicilio ?? -Infinity) ? b : a);
    const domicilio = p.itens.find(i => i.id === '7171')!;
    const colsMes = ['Mês', 'IPCA geral, % em 12 meses', 'Alimentação e bebidas, %', 'Alimentação no domicílio, %', 'Alimentação fora do domicílio, %'], linhasMes = meses.map(m => [m.mes, m.geral, m.alimentacaoBebidas, m.domicilio, m.fora]);
    const colsItem = ['Item', 'Variação em 12 meses, %', 'Peso no IPCA, %'], linhasItem = itens.map(i => [i.nome, i.doze, i.peso]);
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo="Alimentação no domicílio, 12 meses" valor={sinal(ult.domicilio, 2)} nota={`IBGE, IPCA · até ${mesCurtoAgro(p.ultimoMes)} · IPCA geral: ${sinal(ult.geral, 2)}`}/>
            <Metrica rotulo="Peso da comida em casa no IPCA" valor={pct(domicilio.peso, 1)} nota={`Do orçamento das famílias da pesquisa · ${mesCurtoAgro(p.ultimoMes)} · fora de casa: ${pct(p.itens.find(i => i.id === '7432')?.peso, 1)}`}/>
            <Metrica rotulo="Maior alta entre os itens acompanhados" valor={sinal(itens[0]?.doze)} nota={`${itens[0]?.nome} · 12 meses até ${mesCurtoAgro(p.ultimoMes)}`}/>
            <Metrica rotulo="Maior queda entre os itens acompanhados" valor={sinal(itens.at(-1)?.doze)} nota={`${itens.at(-1)?.nome} · 12 meses até ${mesCurtoAgro(p.ultimoMes)}`}/>
        </dl>
        <SecaoAgro titulo="A comida sobe mais ou menos que o resto?" texto={`Desde ${meses[0].mes.slice(0, 4)}, a maior alta em 12 meses da alimentação no domicílio foi de ${sinal(pico.domicilio)}, em ${mesAgro(pico.mes)}. Em ${mesAgro(p.ultimoMes)}, foi de ${sinal(ult.domicilio)}.`}>
            <span className={s.status}>Dado observado · IPCA</span>
            <LinhasAgro titulo="Inflação em 12 meses: comida em casa e índice geral" unidade="%" rotulos={meses.map(m => mesCurtoAgro(m.mes))} series={[{ nome: 'Alimentação no domicílio', valores: meses.map(m => m.domicilio) }, { nome: 'IPCA geral', valores: meses.map(m => m.geral), referencia: true }]} nota="Variação acumulada em 12 meses publicada pelo IBGE. Preço pago pelas famílias nas 16 áreas da pesquisa; inclui transporte, processamento e varejo, não só o preço ao produtor."/>
            <details className={s.sourceDetails}><summary>Ver todos os meses</summary><div><TabelaAgro titulo="IPCA · variação em 12 meses" colunas={colsMes} linhas={linhasMes}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-ipca-alimentos.csv" colunas={[...colsMes, 'Fonte']} linhas={linhasMes.map(r => [...r, url(dados, 'ipca')])}/></div>
        </SecaoAgro>
        <SecaoAgro titulo="O que subiu e o que caiu na cesta." texto="Itens do IPCA ligados às cadeias deste observatório. Variações grandes de um item com peso pequeno mexem pouco no orçamento médio.">
            <DivergenteAgro titulo="Variação em 12 meses por item" unidade="%" periodo={`12 meses até ${mesCurtoAgro(p.ultimoMes)}`} linhas={itens.map(i => ({ nome: i.nome, valor: i.doze }))} nota="Altas à direita do zero, quedas à esquerda. A tabela traz o peso de cada item no índice."/>
            <TabelaAgro titulo={`Itens da cesta · ${mesCurtoAgro(p.ultimoMes)}`} colunas={colsItem} linhas={linhasItem}/>
            <FonteAgro dados={dados} id="ipca" periodo={`${meses[0].mes} a ${p.ultimoMes}`} nota={capturado(dados, 'ipca')}/>
        </SecaoAgro>
        <SecaoAgro titulo="Preço é uma parte; acesso é outra." texto="A segurança alimentar dos domicílios é medida por pesquisa própria, com outro calendário.">
            <AlimentacaoObservadaAgro dados={dados}/>
        </SecaoAgro>
        <LimiteAgro titulo="O que esta página não diz">Não atribui a alta de um alimento à exportação, ao clima ou a uma política: o IPCA mede o preço, não a causa. Também não mede o preço pago ao produtor. Para testar o efeito de uma alta no seu orçamento, use o <Link href="/agronegocio/alimentos-consumo#c1" prefetch={false}>cenário de orçamento familiar</Link>.</LimiteAgro>
    </>;
}
