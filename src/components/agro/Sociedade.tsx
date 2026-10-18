import Link from 'next/link';
import type { EconomiaAgro, SnapshotAgro } from '@/lib/agro/tipos';
import { numeroAgro, mesAgro } from '@/lib/agro/modelo';
import { mesCurtoAgro, trimestreAgro, variacaoPctAgro } from '@/lib/agro/economia';
import { BarrasAgro, DivergenteAgro, LinhasAgro, TabelaAgro } from './Graficos';
import { FonteAgro, LimiteAgro, SecaoAgro } from './Editorial';
import { ExportarAgro } from './Exportar';
import { AlimentacaoObservadaAgro, ProgramasAgro } from './DadosObservados';
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
    const t = e.produtores.tipologia, tri = e.trabalho.trimestres.filter(r => r.razaoRendimento !== null).at(-1)!, ultimo = e.prato.meses.at(-1)!;
    return {
        produtores: `A agricultura familiar reúne ${pct(100 * t.familiar.estabelecimentos / t.total.estabelecimentos, 0)} dos estabelecimentos e ${pct(100 * t.familiar.area / t.total.area, 0)} da área (Censo 2017). No campo, a renda média do trabalho é ${pct(100 * tri.razaoRendimento!, 0)} da média do país (${trimestreAgro(tri.periodo)}).`,
        prato: `Em 12 meses até ${mesCurtoAgro(e.prato.ultimoMes)}, a alimentação no domicílio variou ${sinal(ultimo.domicilio)}, contra ${sinal(ultimo.geral)} do IPCA geral.`,
    };
}

// ---------------------------------------------------------------- 5. Produtores e trabalho

export function ProdutoresAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const t = e.produtores.tipologia, part = (k: keyof typeof t.total) => 100 * t.familiar[k] / t.total[k], tri = e.trabalho.trimestres, completos = tri.filter(r => r.ocupadosAgro !== null && r.ocupadosTotal !== null && r.rendimentoAgro !== null && r.rendimentoTotal !== null), ult = completos.at(-1)!, pri = completos[0], ano = completos.find(r => r.periodo === `${Number(ult.periodo.slice(0, 4)) - 1}${ult.periodo.slice(4)}`) ?? null;
    const { linhas: faixas, semArea } = faixasAgro(e), grande = faixas.at(-1)!, pequena = faixas[0];
    const colsTip = ['Medida', 'Agricultura familiar', 'Não familiar', 'Total', 'Parcela familiar, %'];
    const medidas: [keyof typeof t.total, string][] = [['estabelecimentos', 'Estabelecimentos'], ['area', 'Área, hectares'], ['pessoal', 'Pessoal ocupado, pessoas'], ['valorProducao', 'Valor da produção, R$ de 2017']];
    const linhasTip = medidas.map(([k, n]) => [n, t.familiar[k], t.naoFamiliar[k], t.total[k], part(k)]);
    const colsTri = ['Trimestre', 'Ocupados no agro', 'Ocupados no país', 'Parcela agro, %', 'Rendimento médio real no agro, R$', 'Rendimento médio real no país, R$', 'Agro em relação ao país, %'];
    const linhasTri = tri.map(r => [trimestreAgro(r.periodo), r.ocupadosAgro, r.ocupadosTotal, r.participacao, r.rendimentoAgro, r.rendimentoTotal, r.razaoRendimento === null ? null : 100 * r.razaoRendimento]);
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo="Estabelecimentos agropecuários" valor={`${mi(t.total.estabelecimentos, 2)} mi`} nota={`IBGE, Censo Agropecuário ${e.produtores.ano} · ${pct(part('estabelecimentos'), 0)} de agricultura familiar`}/>
            <Metrica rotulo="Área da agricultura familiar" valor={pct(part('area'), 0)} nota={`Da área dos estabelecimentos · ${pct(part('valorProducao'), 0)} do valor da produção · ${e.produtores.ano}`}/>
            <Metrica rotulo={`Ocupados no campo, ${trimestreAgro(ult.periodo)}`} valor={`${mi(ult.ocupadosAgro)} mi`} nota={`IBGE, PNAD Contínua · ${pct(ult.participacao)} dos ocupados do país${ano ? ` · ${sinal(variacaoPctAgro(ult.ocupadosAgro, ano.ocupadosAgro))} em um ano` : ''}`}/>
            <Metrica rotulo="Renda média do trabalho no campo" valor={`R$ ${numeroAgro(ult.rendimentoAgro, 0)}`} nota={`Habitual, real, por mês · ${pct(100 * ult.razaoRendimento!, 0)} da média do país (R$ ${numeroAgro(ult.rendimentoTotal, 0)}) · ${trimestreAgro(ult.periodo)}`}/>
        </dl>
        <SecaoAgro id="f4" rotulo="Dado observado · F4" titulo="Muitos estabelecimentos pequenos, pouca terra." texto={`Em ${e.produtores.ano}, os estabelecimentos com menos de 10 hectares eram ${pct(100 * pequena.estabelecimentos / t.total.estabelecimentos, 0)} do total e ocupavam ${pct(100 * pequena.area / t.total.area, 1)} da área. Os de 1.000 hectares ou mais eram ${pct(100 * grande.estabelecimentos / t.total.estabelecimentos, 1)} e ocupavam ${pct(100 * grande.area / t.total.area, 0)}.`}>
                        <BarrasAgro titulo="Parcela no número de estabelecimentos" unidade="% dos estabelecimentos" periodo={String(e.produtores.ano)} maximo={100} linhas={faixas.map(f => ({ nome: f.nome, valor: 100 * f.estabelecimentos / t.total.estabelecimentos }))} nota={`Grupos de área total do Censo reunidos em quatro faixas. ${semArea ? `Produtores sem área (${numeroAgro(semArea)} estabelecimentos) entram no total, mas não em nenhuma faixa.` : ''}`}/>
            <BarrasAgro titulo="Parcela na área dos estabelecimentos" unidade="% da área" periodo={String(e.produtores.ano)} maximo={100} linhas={faixas.map(f => ({ nome: f.nome, valor: 100 * f.area / t.total.area, focal: f === grande }))} nota="Área total dos estabelecimentos, inclusive matas, pastagens e áreas não usadas para produção. Não é área plantada."/>
            <TabelaAgro titulo={`Agricultura familiar e não familiar · Censo ${e.produtores.ano}`} colunas={colsTip} linhas={linhasTip}/>
            <p className={s.note}>Agricultura familiar pela Lei 11.326/2006: área de até quatro módulos fiscais, mão de obra e renda predominantemente da família e gestão familiar. Valor da produção em reais de 2017, sem correção. O Censo é um retrato de 2017; o próximo ainda não foi publicado.</p>
            <div className={s.actions}><ExportarAgro nome="agro-censo-tipologia.csv" colunas={[...colsTip, 'Ano', 'Fonte']} linhas={linhasTip.map(r => [...r, e.produtores.ano, url(dados, 'censoagro')])}/></div>
            <FonteAgro dados={dados} id="censoagro" periodo={String(e.produtores.ano)} nota={capturado(dados, 'censoagro')}/>
        </SecaoAgro>
        <SecaoAgro titulo={`${ult.ocupadosAgro! < pri.ocupadosAgro! ? 'Menos' : 'Mais'} gente no campo, renda ${ult.razaoRendimento! < 1 ? 'abaixo' : 'acima'} da média do país.`} texto={`O campo ocupava ${pct(pri.participacao)} dos trabalhadores do país em ${trimestreAgro(pri.periodo)} e ${pct(ult.participacao)} em ${trimestreAgro(ult.periodo)}. A renda média passou de ${pct(100 * pri.razaoRendimento!, 0)} para ${pct(100 * ult.razaoRendimento!, 0)} da média nacional.`}>
            <span className={s.status}>Dado observado · PNAD Contínua</span>
            <LinhasAgro titulo="Ocupados na agropecuária" unidade="milhões de pessoas" rotulos={tri.map(r => trimestreAgro(r.periodo))} series={[{ nome: 'Agropecuária', valores: tri.map(r => r.ocupadosAgro === null ? null : r.ocupadosAgro / 1e6) }]} nota="Pessoas de 14 anos ou mais cujo trabalho principal é agricultura, pecuária, produção florestal, pesca ou aquicultura, formais ou informais. Não inclui agroindústria, comércio e transporte ligados ao campo."/>
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

// ---------------------------------------------------------------- 6. Apoio público

export function respostasPolitica(e: EconomiaAgro) {
    const j = e.apoio.juros.meses.at(-1)!, pag = e.apoio.pagamentos.anos.filter(a => a.ano < Number(e.apoio.pagamentos.ultimoMesPagamento.slice(0, 4)) || e.apoio.pagamentos.ultimoMesPagamento.endsWith('-12')).at(-1)!, taxa = e.ambiente.prodes.taxaAmazoniaLegal.filter(t => !t.estimada).at(-1)!, emi = e.ambiente.emissoes.anos.at(-1)!;
    return {
        apoio: `Em ${mesCurtoAgro(j.mes)}, o Pronaf saiu a ${pct(j.pronaf)} ao ano em média, contra ${pct(j.demais)} nos demais contratos e Selic de ${pct(j.selic)}. O Tesouro pagou R$ ${numeroAgro(pag.total / 1e9, 1)} bi em subvenções ao crédito rural em ${pag.ano}.`,
        ambiente: `A Amazônia Legal perdeu ${numeroAgro(taxa.km2)} km² de vegetação nativa em ${taxa.inicio}/${String(taxa.fim).slice(2)} (INPE). A agropecuária emitiu ${numeroAgro(emi.agropecuaria / 1e6, 0)} milhões de t de CO2e em ${emi.ano} (SEEG).`,
    };
}

export function ApoioAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const j = e.apoio.juros, meses = j.meses, ult = meses.at(-1)!, pag = e.apoio.pagamentos, c = dados.credito;
    const anoAberto = !pag.ultimoMesPagamento.endsWith('-12') ? Number(pag.ultimoMesPagamento.slice(0, 4)) : null;
    const fechados = pag.anos.filter(a => a.ano !== anoAberto), ultFechado = fechados.at(-1)!;
    const pronaf = c.programas.find(p => /pronaf/i.test(p.nome)), pronamp = c.programas.find(p => /pronamp/i.test(p.nome));
    const rotuloMes = meses.map(m => mesCurtoAgro(m.mes));
    const colsJ = ['Mês', 'Geral, % a.a.', 'Pronaf', 'Pronamp', 'Demais', 'Equalizada', 'Controlada sem equalização', 'Livre ou não controlada', 'Selic, % a.a.', 'Valor contratado, R$', 'Parcela do valor na média, %'];
    const linhasJ = meses.map(m => [m.mes, m.geral, m.pronaf, m.pronamp, m.demais, m.equalizada, m.controlada, m.livre, m.selic, m.valor, 100 * m.coberturaTaxa]);
    // Mesmo mês fechado nas duas bases: microdados do Sicor (tabela de juros) e MDCR (volumes do crédito rural).
    const comum = [...meses].reverse().find(m => c.serie.some(x => x.mes === m.mes && !x.parcial));
    const mdcr = comum ? c.serie.find(x => x.mes === comum.mes) : undefined;
    const acoes = Object.entries(pag.acoes).filter(([k]) => fechados.some(a => (a.acoes[k] ?? 0) !== 0));
    const colsP = ['Ano', 'Total, R$', ...acoes.map(([, n]) => n + ', R$')], linhasP = pag.anos.map(a => [a.ano === anoAberto ? `${a.ano} (até ${mesCurtoAgro(pag.ultimoMesPagamento)})` : String(a.ano), a.total, ...acoes.map(([k]) => a.acoes[k] ?? 0)]);
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo="Taxa média do Pronaf" valor={pct(ult.pronaf, 1)} nota={`Ao ano · ${mesCurtoAgro(ult.mes)} · contratos sem indexador · BCB/Sicor`}/>
            <Metrica rotulo="Taxa média dos demais contratos" valor={pct(ult.demais, 1)} nota={`Fora de Pronaf e Pronamp · ${mesCurtoAgro(ult.mes)} · Selic do mês: ${pct(ult.selic)}`}/>
            <Metrica rotulo="Pronaf no crédito rural contratado" valor={pronaf ? pct(100 * pronaf.valor / c.nacional.valor, 0) : 'Não disponível'} nota={`R$ ${pronaf ? numeroAgro(pronaf.valor / 1e9, 1) : '?'} bi de R$ ${numeroAgro(c.nacional.valor / 1e9, 1)} bi · ${mesAgro(c.janela.ini)} a ${mesAgro(c.janela.fim)} · snapshot preservado`}/>
            <Metrica rotulo={`Subvenções pagas pelo Tesouro em ${ultFechado.ano}`} valor={`R$ ${numeroAgro(ultFechado.total / 1e9, 1)} bi`} nota="Equalização de juros, Pronaf, alongamento de dívidas e indenizações do Proagro · Tesouro Transparente · R$ correntes"/>
        </dl>
        <SecaoAgro titulo="Quanto custa o dinheiro do crédito rural?" texto={`Em ${mesAgro(ult.mes)}, a taxa média ficou em ${pct(ult.pronaf)} no Pronaf, ${pct(ult.pronamp)} no Pronamp e ${pct(ult.demais)} nos demais contratos. A Selic do mês foi ${pct(ult.selic)}.`}>
            <span className={s.status}>Dado observado · microdados do Sicor</span>
            <LinhasAgro titulo="Taxa média contratada por programa" unidade="% ao ano" rotulos={rotuloMes} series={[{ nome: 'Pronaf', valores: meses.map(m => m.pronaf) }, { nome: 'Pronamp', valores: meses.map(m => m.pronamp) }, { nome: 'Demais', valores: meses.map(m => m.demais) }, { nome: 'Selic', valores: meses.map(m => m.selic), referencia: true }]} nota={`Média ponderada pelo valor de cada contrato, só os sem indexador (${pct(100 * ult.coberturaTaxa, 0)} do valor em ${mesCurtoAgro(ult.mes)}). Taxa contratada, não custo efetivo total. Selic: média do mês anualizada (BCB, série 4189).`}/>
            <LinhasAgro titulo="Taxa média pela origem do dinheiro" unidade="% ao ano" rotulos={rotuloMes} series={[{ nome: 'Equalizada pelo Tesouro', valores: meses.map(m => m.equalizada) }, { nome: 'Controlada sem equalização', valores: meses.map(m => m.controlada) }, { nome: 'Livre ou não controlada', valores: meses.map(m => m.livre) }]} nota="Grupos pela descrição oficial da fonte de recursos. Equalizada: o Tesouro paga ao banco a diferença entre o custo de captação e a taxa do programa. Controlada: taxa limitada por regra, como recursos obrigatórios e fundos constitucionais. Livre: taxa de mercado, como a LCA não controlada."/>
            <details className={s.sourceDetails}><summary>Ver todos os meses</summary><div><TabelaAgro titulo="Juros do crédito rural · média ponderada por valor" colunas={colsJ} linhas={linhasJ}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-juros-credito-rural.csv" colunas={[...colsJ, 'Fonte']} linhas={linhasJ.map(r => [...r, url(dados, 'sicor')])}/></div>
            <FonteAgro dados={dados} id="sicor" periodo={`${meses[0].mes} a ${ult.mes}`} nota={capturado(dados, 'sicor')}/>
            {comum && mdcr && <LimiteAgro titulo="Dois números para o valor contratado">O valor contratado desta tabela vem dos microdados do Sicor, uma linha por operação, pela data de emissão. Os volumes de crédito rural deste observatório e do <Link href="/observatorio/rural-credit" prefetch={false}>painel do Crédito</Link> vêm da MDCR, a matriz agregada que o Banco Central publica a partir do mesmo registro, capturada em {c.capturaOriginal.slice(0, 10).split('-').reverse().join('/')}. Em {mesAgro(comum.mes)}: R$ {numeroAgro(comum.valor / 1e9, 2)} bi em {numeroAgro(comum.contratos, 0)} linhas nos microdados e R$ {numeroAgro(mdcr.valor / 1e9, 2)} bi em {numeroAgro(mdcr.contratos, 0)} contratos na MDCR. Causas prováveis, não conferidas linha a linha: datas de captura diferentes, porque o Sicor recebe revisões, e a unidade de contagem. Os dois não se misturam: para quanto foi contratado, vale a MDCR; os microdados servem à taxa por programa.</LimiteAgro>}
        </SecaoAgro>
        <SecaoAgro titulo="Quanto o Tesouro paga para o juro ser menor?" texto={`Os pagamentos de subvenção ao crédito rural somaram R$ ${numeroAgro(ultFechado.total / 1e9, 1)} bilhões em ${ultFechado.ano}. Eles se referem a contratos de safras anteriores e oscilam com a Selic, que define o custo de captação dos bancos.`}>
            <span className={s.status}>Dado observado · Tesouro Transparente</span>
            <BarrasAgro titulo="Subvenções ao crédito rural pagas por ano" unidade="R$ bilhões correntes" periodo={`${pag.anos[0].ano} a ${mesCurtoAgro(pag.ultimoMesPagamento)}`} linhas={pag.anos.map(a => ({ nome: a.ano === anoAberto ? `${a.ano} (até ${mesCurtoAgro(pag.ultimoMesPagamento)})` : String(a.ano), valor: a.total / 1e9, focal: a.ano === ultFechado.ano }))} nota="Ações orçamentárias do crédito rural e do Proagro, pela data de pagamento. O ano em curso só tem os meses publicados."/>
            <TabelaAgro titulo="Pagamentos por ação orçamentária" colunas={colsP} linhas={linhasP}/>
            <div className={s.actions}><ExportarAgro nome="agro-subvencoes-tesouro.csv" colunas={[...colsP, 'Fonte']} linhas={linhasP.map(r => [...r, url(dados, 'tesouro')])}/></div>
            <FonteAgro dados={dados} id="tesouro" periodo={`${pag.anos[0].ano} a ${mesCurtoAgro(pag.ultimoMesPagamento)}`} nota={capturado(dados, 'tesouro')}/>
        </SecaoAgro>
        <SecaoAgro titulo="Quem recebe o crédito." texto={`Pronaf${pronamp ? ' e Pronamp' : ''} são os programas para agricultores familiares e médios produtores. O restante sai sem programa ou por linhas de investimento.`}>
            <ProgramasAgro dados={dados}/>
        </SecaoAgro>
        <LimiteAgro titulo="O que ainda não está nesta conta">Subvenção ao prêmio do seguro rural (PSR), renúncia tributária, custo implícito dos fundos constitucionais e das exigibilidades bancárias. Contratos não são beneficiários únicos, e taxa menor não demonstra impacto sobre renda ou produção. Para simular uma parcela, use o <Link href="/agronegocio/credito-protecao#d4" prefetch={false}>cenário de financiamento</Link>.</LimiteAgro>
    </>;
}

// ---------------------------------------------------------------- 7. Ambiente

export function AmbienteAgro({ dados, e }: { dados: SnapshotAgro; e: EconomiaAgro }) {
    const pr = e.ambiente.prodes, taxa = pr.taxaAmazoniaLegal, fechada = taxa.filter(t => !t.estimada).at(-1)!, estimada = taxa.find(t => t.estimada) ?? null, pico = taxa.reduce((a, b) => b.km2 > a.km2 ? b : a), minimo = taxa.filter(t => !t.estimada).reduce((a, b) => b.km2 < a.km2 ? b : a);
    const em = e.ambiente.emissoes.anos, ultEm = em.at(-1)!, uso = e.ambiente.usoTerra.anos, ultUso = uso.at(-1)!, priUso = uso[0];
    const ano = (p: { inicio: number; fim: number }) => `${p.inicio}/${String(p.fim).slice(2)}`;
    const ultimos = pr.biomas.map(b => ({ b, p: b.periodos.filter(p => p.anual && !p.parcial).at(-1) ?? null }));
    const cerrado = pr.biomas.find(b => b.id === 'cerrado')!, cerradoAnual = cerrado.periodos.filter(p => p.anual && !p.parcial);
    const colsT = ['Ano PRODES', 'Taxa, km²', 'Natureza'], linhasT = taxa.map(t => [ano(t), t.km2, t.estimada ? 'Estimativa preliminar' : 'Taxa consolidada']);
    const colsE = ['Ano', 'Agropecuária, t CO2e', 'Mudança de uso da terra, emissão bruta, t CO2e', 'Mudança de uso da terra, remoções, t CO2e'], linhasE = em.map(r => [r.ano, r.agropecuaria, r.mudancaUsoTerra, r.mudancaUsoTerraRemocao]);
    const colsU = ['Ano', 'Pastagem, ha', 'Agricultura, ha', 'Silvicultura, ha', 'Mosaico de usos, ha', 'Agropecuária, ha', 'Vegetação nativa, ha'], linhasU = uso.map(r => [r.ano, r.pastagem, r.agricultura, r.silvicultura, r.mosaico, r.agropecuaria, r.vegetacaoNativa]);
    return <>
        <dl className={`${s.metrics} ${s.metrics4}`}>
            <Metrica rotulo={`Desmatamento na Amazônia Legal, ${ano(fechada)}`} valor={`${numeroAgro(fechada.km2)} km²`} nota={`INPE, PRODES · taxa oficial · ${sinal(variacaoPctAgro(fechada.km2, taxa[taxa.indexOf(fechada) - 1]?.km2))} sobre o ano anterior${estimada ? ` · ${ano(estimada)}: ${numeroAgro(estimada.km2)} km², estimativa preliminar` : ''}`}/>
            <Metrica rotulo={`Desmatamento mapeado no Cerrado, ${cerradoAnual.length ? ano(cerradoAnual.at(-1)!) : ''}`} valor={`${numeroAgro(cerradoAnual.at(-1)?.km2 ?? null)} km²`} nota="INPE, PRODES · incremento mapeado, não taxa · soma das UFs do bioma"/>
            <Metrica rotulo={`Emissões da agropecuária, ${ultEm.ano}`} valor={`${numeroAgro(ultEm.agropecuaria / 1e6, 0)} Mt CO2e`} nota={`SEEG ${e.ambiente.emissoes.versao ?? ''} · mudança de uso da terra: ${numeroAgro(ultEm.mudancaUsoTerra / 1e6, 0)} Mt de emissão bruta · estimativa da sociedade civil`}/>
            <Metrica rotulo={`Área de agropecuária, ${ultUso.ano}`} valor={`${numeroAgro(ultUso.agropecuaria / 1e6, 0)} mi ha`} nota={`MapBiomas · ${pct(100 * ultUso.agropecuaria / ultUso.total, 0)} do território · ${numeroAgro(priUso.agropecuaria / 1e6, 0)} mi ha em ${priUso.ano}`}/>
        </dl>
        <SecaoAgro titulo="Quanto se desmata na Amazônia?" texto={`A taxa oficial chegou a ${numeroAgro(pico.km2)} km² em ${ano(pico)} e ao menor valor da série, ${numeroAgro(minimo.km2)} km², em ${ano(minimo)}. Em ${ano(fechada)}, foram ${numeroAgro(fechada.km2)} km².`}>
            <span className={s.status}>Dado observado · INPE PRODES</span>
            <LinhasAgro titulo="Taxa anual de desmatamento na Amazônia Legal" unidade="km²" casas={0} rotulos={taxa.map(t => ano(t))} series={[{ nome: 'Taxa consolidada', valores: taxa.map(t => t.estimada ? null : t.km2) }, ...(estimada ? [{ nome: 'Estimativa preliminar', valores: taxa.map((t, i) => t.estimada || (taxa[i + 1]?.estimada ?? false) ? t.km2 : null), referencia: true }] : [])]} nota={`Corte raso da vegetação nativa, ano PRODES de agosto a julho. ${estimada ? `O último ponto (${ano(estimada)}) é estimativa preliminar do INPE, revista na consolidação.` : ''} Painel atualizado em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(pr.atualizado))}.`}/>
            <details className={s.sourceDetails}><summary>Ver todos os anos</summary><div><TabelaAgro titulo="Taxa PRODES · Amazônia Legal" colunas={colsT} linhas={linhasT}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-prodes-amazonia-legal.csv" colunas={[...colsT, 'Fonte']} linhas={linhasT.map(r => [...r, url(dados, 'prodes')])}/></div>
        </SecaoAgro>
        <SecaoAgro titulo="E nos outros biomas?" texto="Fora da Amazônia, o INPE publica a área mapeada a cada ano, não uma taxa oficial. Os números servem para acompanhar cada bioma, não para somar com a taxa amazônica.">
            <LinhasAgro titulo="Desmatamento mapeado no Cerrado" unidade="km²" casas={0} rotulos={cerradoAnual.map(p => ano(p))} series={[{ nome: 'Cerrado', valores: cerradoAnual.map(p => p.km2) }]} nota="Só os anos com mapeamento anual; o início da série tem períodos de dois a quatro anos, fora do gráfico."/>
            <TabelaAgro titulo="Último ano completo mapeado em cada bioma" colunas={['Bioma', 'Ano PRODES', 'Área mapeada, km²']} linhas={ultimos.map(({ b, p }) => [b.nome, p ? ano(p) : null, p?.km2 ?? null])}/>
            <p className={s.note}>A Amazônia como bioma é outro recorte que a Amazônia Legal, que inclui parte do Cerrado. O PRODES mede supressão da vegetação nativa, sem dizer se foi legal, nem qual atividade ocupou a área depois.</p>
            <FonteAgro dados={dados} id="prodes" periodo={`${ano(taxa[0])} a ${ano(taxa.at(-1)!)}`} nota={capturado(dados, 'prodes')}/>
        </SecaoAgro>
        <SecaoAgro titulo="Quanto o campo emite?" texto={`Em ${ultEm.ano}, a agropecuária respondeu por ${numeroAgro(ultEm.agropecuaria / 1e6, 0)} milhões de toneladas de CO2 equivalente, sobretudo pela fermentação entérica do gado e pelos solos manejados. A mudança de uso da terra, que inclui o desmatamento, emitiu ${numeroAgro(ultEm.mudancaUsoTerra / 1e6, 0)} milhões em termos brutos.`}>
            <span className={s.status}>Estimativa · SEEG, Observatório do Clima</span>
            <LinhasAgro titulo="Emissões brutas por setor" unidade="milhões de t CO2e (GWP-AR5)" casas={0} rotulos={em.map(r => String(r.ano))} series={[{ nome: 'Agropecuária', valores: em.map(r => r.agropecuaria / 1e6) }, { nome: 'Mudança de uso da terra', valores: em.map(r => r.mudancaUsoTerra / 1e6), referencia: true }]} nota={`Estimativa da sociedade civil, não o inventário oficial do governo. A mudança de uso da terra inclui desmatamento por qualquer causa e tem remoções (${numeroAgro((ultEm.mudancaUsoTerraRemocao ?? 0) / 1e6, 0)} Mt em ${ultEm.ano}) que não aparecem no gráfico.`}/>
            <details className={s.sourceDetails}><summary>Ver todos os anos</summary><div><TabelaAgro titulo="Emissões SEEG · Brasil" colunas={colsE} linhas={linhasE}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-emissoes-seeg.csv" colunas={[...colsE, 'Fonte']} linhas={linhasE.map(r => [...r, url(dados, 'seeg')])}/></div>
            <FonteAgro dados={dados} id="seeg" periodo={`${em[0].ano} a ${ultEm.ano}`} nota={capturado(dados, 'seeg')}/>
        </SecaoAgro>
        <SecaoAgro titulo="Quanta terra a agropecuária ocupa?" texto={`Pastagem, agricultura, silvicultura e mosaico de usos passaram de ${numeroAgro(priUso.agropecuaria / 1e6, 0)} para ${numeroAgro(ultUso.agropecuaria / 1e6, 0)} milhões de hectares entre ${priUso.ano} e ${ultUso.ano}; a vegetação nativa, de ${numeroAgro(priUso.vegetacaoNativa / 1e6, 0)} para ${numeroAgro(ultUso.vegetacaoNativa / 1e6, 0)} milhões.`}>
            <span className={s.status}>Dado observado · MapBiomas</span>
            <LinhasAgro titulo="Agropecuária e vegetação nativa no território" unidade="milhões de hectares" casas={0} rotulos={uso.map(r => String(r.ano))} series={[{ nome: 'Agropecuária', valores: uso.map(r => r.agropecuaria / 1e6) }, { nome: 'Vegetação nativa', valores: uso.map(r => r.vegetacaoNativa / 1e6), referencia: true }]} nota="Mapeamento anual por satélite. Vegetação nativa reúne formações florestais e não florestais naturais. As curvas não provam que cada hectare de uma virou o da outra; para isso há a matriz de transição do MapBiomas, não integrada."/>
            <details className={s.sourceDetails}><summary>Ver todos os anos e classes</summary><div><TabelaAgro titulo="Uso da terra · Brasil · MapBiomas" colunas={colsU} linhas={linhasU}/></div></details>
            <div className={s.actions}><ExportarAgro nome="agro-uso-terra-mapbiomas.csv" colunas={[...colsU, 'Fonte']} linhas={linhasU.map(r => [...r, url(dados, 'mapbiomas')])}/></div>
            <FonteAgro dados={dados} id="mapbiomas" periodo={`${priUso.ano} a ${ultUso.ano}`} nota={capturado(dados, 'mapbiomas')}/>
        </SecaoAgro>
        <LimiteAgro titulo="O que esta página não diz">Não atribui desmatamento nem emissão a um produtor, cadeia ou estado: as séries são nacionais ou por bioma. Desmatamento legal e ilegal não se distinguem aqui. Risco climático, seguro e perdas de safra ainda não estão integrados. Conceitos e cenários continuam no capítulo <Link href="/agronegocio/clima-ambiente" prefetch={false}>Clima e ambiente</Link>.</LimiteAgro>
    </>;
}
