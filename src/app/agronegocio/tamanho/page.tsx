import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { numeroAgro } from '@/lib/agro/modelo';
import { trimestreAgro } from '@/lib/agro/economia';
import { FonteAgro } from '@/components/agro/Editorial';
import { ExportarAgro } from '@/components/agro/Exportar';
import { sinalAgro } from '@/components/agro/Economia';
import { OutrasPerguntasAgro, capturadoAgro, fimTrimestre, numeroAgroIndicador, provAgro } from '@/components/agro/Molde';
import { FiguraAnalitica, GraficoLinhas, LeituraGuiada, PaginaPainel } from '@/components/painel';
import s from '@/components/agro/Agro.module.css';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Qual o tamanho do agro na economia?', description: 'Participação da agropecuária no valor adicionado, crescimento em volume e peso nas exportações, com dados do IBGE e do Comex Stat.', alternates: { canonical: '/agronegocio/tamanho' } };

const pct = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v, casas) + '%';
const bi = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v / 1e9, casas);
const url = (id: string) => dadosAgro.fontes.find(f => f.id === id)?.url ?? '';

/**
 * Pergunta 1 do setor no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os três números das Contas Nacionais na faixa do
 * kit; a parcela no valor adicionado, o crescimento em volume e a parcela nas exportações como figuras com gráfico do kit, tabela
 * equivalente e proveniência; as três medidas que não se somam no glossário de uso; as fontes no método. O rótulo é o grupo da
 * navegação ("O setor"), sem o número da pergunta. Textos, números e arredondamentos são os de TamanhoAgro, que segue servindo as
 * demais páginas do Agronegócio até o Grupo 3.
 */
export default function PaginaTamanhoAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    const p = e.pib, u = p.ultimos4, cresc = p.crescimento.acumulado4.at(-1)!, x = e.comercio.exportacoes, ult = x.anual.at(-1)!, anual = p.anual, taxas = p.crescimento.anual;
    const media = (k: 'agro' | 'pib') => { const v = taxas.slice(-10).map(r => r[k]).filter((n): n is number => n !== null); return v.reduce((a, b) => a + b, 0) / v.length; };
    const colsPib = ['Ano', 'Agropecuária, R$ milhões', 'Indústria, R$ milhões', 'Serviços, R$ milhões', 'Valor adicionado, R$ milhões', 'PIB, R$ milhões', 'Agropecuária no valor adicionado, %', 'Crescimento da agropecuária em volume, %', 'Crescimento do PIB em volume, %'];
    const linhasPib = anual.map(r => { const t = taxas.find(q => q.ano === r.ano); return [r.ano, r.agro, r.industria, r.servicos, r.va, r.pib, r.participacaoVa, t?.agro ?? null, t?.pib ?? null]; });
    const quatro = `${trimestreAgro(u.inicio)} a ${trimestreAgro(u.fim)}`;
    const periodoCnt = `${trimestreAgro(p.trimestres[0].periodo)} a ${trimestreAgro(p.trimestres.at(-1)!.periodo)}`;
    const cnt = (indicador: string, natureza: 'OBSERVADO' | 'CALCULADO', unidade: string) => provAgro(dadosAgro, 'cnt', { indicador, natureza, unidade, frequencia: 'trimestral, somada em anos civis', inicio: String(anual[0].ano), fim: fimTrimestre(p.trimestres.at(-1)!.periodo), limitacoes: ['Agropecuária dentro da porteira; não é o PIB do agronegócio ampliado.'] });
    return <PaginaPainel
        rota="/agronegocio/tamanho"
        principal={false}
        abertura={{
            grupo: 'O setor',
            acento: 'energia',
            titulo: 'Qual o tamanho do agro na economia?',
            lead: 'O peso da agropecuária na renda do país, o ritmo em que cresce e a fatia que ocupa nas exportações. Cada medida tem fonte, período e limite próprios.',
            recorte: { periodo: `${anual[0].ano} a ${trimestreAgro(u.fim)}`, universo: 'Brasil, agropecuária dentro da porteira', unidade: '% do valor adicionado e das exportações', fonte: 'IBGE, Contas Nacionais; MDIC, Comex Stat' },
            limite: 'o tamanho do agronegócio ampliado. A agropecuária medida aqui é a de dentro da porteira, e exportação é faturamento externo, não parcela do PIB.',
        }}
        rotuloNumeros={`Agropecuária nas Contas Nacionais, ${quatro}`}
        numeros={[
            numeroAgroIndicador({ rotulo: 'Valor adicionado da agropecuária', unidade: 'em preços correntes', periodo: quatro, recorte: 'soma de quatro trimestres', fonte: 'IBGE, Contas Nacionais', natureza: 'CALCULADO' }, u.agro, `R$ ${numeroAgro(u.agro / 1e3, 1)} bi`),
            numeroAgroIndicador({ rotulo: 'Parcela no valor adicionado do país', unidade: 'do valor adicionado', periodo: quatro, fonte: 'IBGE, Contas Nacionais', natureza: 'CALCULADO', nota: `Mesmo período · ${pct(u.participacaoPib)} do PIB, que inclui impostos sobre produtos` }, u.participacaoVa, pct(u.participacaoVa)),
            numeroAgroIndicador({ rotulo: 'Crescimento em volume, quatro trimestres', unidade: 'contra os quatro trimestres anteriores', periodo: `até o ${trimestreAgro(cresc.periodo)}`, fonte: 'IBGE, Contas Nacionais', natureza: 'OBSERVADO', nota: `PIB: ${sinalAgro(cresc.pib)}` }, cresc.agro, sinalAgro(cresc.agro)),
        ]}
        figuras={<>
            <FiguraAnalitica
                id="parcela-va"
                pergunta="Qual parcela da renda nacional vem do campo?"
                subtitulo={`Agropecuária no valor adicionado do Brasil · % do valor adicionado a preços básicos · anos civis completos, ${anual[0].ano} a ${anual.at(-1)!.ano}`}
                natureza="CALCULADO"
                proveniencia={cnt('Agropecuária no valor adicionado do Brasil', 'CALCULADO', '% do valor adicionado a preços básicos')}
                extraFonte={<>{capturadoAgro(dadosAgro, 'cnt')}</>}
                leitura={<LeituraGuiada>A parcela em valores correntes sobe quando os preços agrícolas sobem mais que os demais, não só quando se produz mais.</LeituraGuiada>}
                comoInterpretar={`Anos civis completos, ${anual[0].ano} a ${anual.at(-1)!.ano}. Soma dos quatro trimestres de cada ano, em preços correntes. Os quatro trimestres mais recentes somam ${pct(u.participacaoVa)}.`}
                naoConcluir="que o campo produziu mais num ano em que a parcela subiu: em valores correntes, ela também sobe quando os preços agrícolas sobem mais que os demais."
                tabela={{ titulo: 'Contas Nacionais · Brasil · valores correntes e taxas em volume', colunas: colsPib, linhas: linhasPib.map(r => [String(r[0]), ...r.slice(1)]), casas: [null, 0, 0, 0, 0, 0, 2, 1, 1], limite: linhasPib.length }}
                depois={<div className={s.actions}><ExportarAgro nome="agro-valor-adicionado.csv" colunas={[...colsPib, 'Fonte', 'Limite']} linhas={linhasPib.map(r => [...r, url('cnt'), 'Agropecuária dentro da porteira; não é o PIB do agronegócio ampliado.'])}/></div>}
            >
                <GraficoLinhas semTabela titulo="Agropecuária no valor adicionado do Brasil" dados={anual.map(r => ({ ano: String(r.ano), va: r.participacaoVa }))} chaveX="ano" formatoX="texto" series={[{ id: 'va', rotulo: 'Agropecuária', cor: 'var(--cor-energia)' }]} unidade="%" casas={1} zeroNoEixo/>
            </FiguraAnalitica>
            <FiguraAnalitica
                id="crescimento"
                pergunta="Crescimento anual em volume: campo e economia"
                subtitulo="% ante o ano anterior · taxas publicadas pelo IBGE, sem efeito de preço · Brasil"
                natureza="OBSERVADO"
                proveniencia={cnt('Crescimento anual em volume da agropecuária e do PIB', 'OBSERVADO', '% ante o ano anterior')}
                leitura={<LeituraGuiada>Nos últimos dez anos, a agropecuária variou em média {sinalAgro(media('agro'))} ao ano e o PIB {sinalAgro(media('pib'))}, com oscilações muito maiores no campo: clima e calendário da safra pesam sobre um único ano.</LeituraGuiada>}
                naoConcluir="que a agropecuária cresce mais que a economia: num único ano, clima e calendário da safra pesam muito, e a média de dez anos esconde essas oscilações."
                tabela={{ titulo: 'Crescimento anual em volume: campo e economia (% ante o ano anterior)', colunas: ['Ano', 'Agropecuária, %', 'PIB, %'], linhas: taxas.map(r => [String(r.ano), r.agro, r.pib]), casas: [null, 1, 1], limite: taxas.length }}
            >
                <GraficoLinhas semTabela titulo="Crescimento anual em volume: campo e economia" dados={taxas.map(r => ({ ano: String(r.ano), agro: r.agro, pib: r.pib }))} chaveX="ano" formatoX="texto" series={[{ id: 'agro', rotulo: 'Agropecuária', cor: 'var(--cor-energia)' }, { id: 'pib', rotulo: 'PIB', cor: 'var(--serie-referencia)' }]} unidade="%" casas={1} zeroNoEixo/>
            </FiguraAnalitica>
            <FiguraAnalitica
                id="exportacoes"
                pergunta="Quanto do que o país vende ao exterior vem do campo?"
                subtitulo={`Parcela agro nas exportações do Brasil · % do valor FOB em US$ · ${x.anual[0].ano} a ${ult.ano}`}
                natureza="CALCULADO"
                proveniencia={provAgro(dadosAgro, 'comex', { indicador: 'Parcela agro nas exportações do Brasil', natureza: 'CALCULADO', unidade: '% do valor FOB em US$', frequencia: 'anual', inicio: String(x.anual[0].ano), fim: String(ult.ano), limitacoes: [e.comercio.definicaoAgro] })}
                extraFonte={<>{capturadoAgro(dadosAgro, 'comex')}</>}
                leitura={<LeituraGuiada>Em {ult.ano}, os capítulos de base agropecuária somaram US$ {bi(ult.agro)} bilhões de US$ {bi(ult.total)} bilhões exportados.</LeituraGuiada>}
                comoInterpretar={`${e.comercio.definicaoAgro} A parcela também se move com o preço do petróleo e do minério, que pesam no total.`}
                naoConcluir="que o agro responde por essa parte da economia: exportação é faturamento externo em dólar, inclui produtos industrializados como óleo, açúcar e celulose, e não é parcela do PIB."
                tabela={{ titulo: 'Parcela agro nas exportações do Brasil (% do valor FOB em US$)', colunas: ['Ano', 'Recorte agro, % do valor FOB'], linhas: x.anual.map(r => [String(r.ano), r.participacao]), casas: [null, 1], limite: x.anual.length }}
                depois={<>
                    <div className={s.actions}><Link className={s.button} href="/agronegocio/mercados" prefetch={false}>O que vendemos e para quem</Link></div>
                    <OutrasPerguntasAgro e={e} atual="tamanho"/>
                </>}
            >
                <GraficoLinhas semTabela titulo="Parcela agro nas exportações do Brasil" dados={x.anual.map(r => ({ ano: String(r.ano), parcela: r.participacao }))} chaveX="ano" formatoX="texto" series={[{ id: 'parcela', rotulo: 'Recorte agro', cor: 'var(--cor-energia)' }]} unidade="%" casas={1} zeroNoEixo/>
            </FiguraAnalitica>
        </>}
        notas={{
            id: 'tres-medidas',
            titulo: 'Dentro da porteira não é o agronegócio inteiro.',
            nivelTitulo: 2,
            itens: [
                { termo: <>Agropecuária <span className="rotulo text-mineral">medido aqui</span></>, definicao: 'Lavouras, pecuária, produção florestal, pesca e aquicultura, como as Contas Nacionais definem. Valor adicionado é o que a atividade produz menos o que consome de insumos: a renda gerada no campo.' },
                { termo: <>Agronegócio ampliado <span className="rotulo text-mineral">não integrado</span></>, definicao: 'Soma insumos, agroindústria, comércio e transporte ligados ao campo. É uma estimativa de pesquisa, com método próprio, que este observatório ainda não incorporou. Não é o número ao lado.' },
                { termo: <>Exportações <span className="rotulo text-mineral">medido aqui</span></>, definicao: 'Valor dos bens vendidos ao exterior, em dólar. Inclui produtos industrializados como óleo, açúcar e celulose. Não é parcela do PIB: faturamento externo e renda gerada são contas diferentes.' },
            ],
            nota: 'Três medidas respondem a perguntas diferentes. Elas não se somam nem se substituem.',
        }}
        metodo={<>
            <FonteAgro dados={dadosAgro} id="cnt" periodo={periodoCnt} nota={capturadoAgro(dadosAgro, 'cnt')}/>
            <FonteAgro dados={dadosAgro} id="comex" periodo={`${x.anual[0].ano} a ${ult.ano}`} nota={capturadoAgro(dadosAgro, 'comex')}/>
            <p>Valor adicionado e parcelas em preços correntes, somando os quatro trimestres de cada ano das Contas Nacionais Trimestrais; crescimento em volume são as taxas publicadas pelo IBGE. A parcela nas exportações usa o recorte agro por capítulo do Sistema Harmonizado sobre o valor FOB em dólar do Comex Stat. <Link href="/agronegocio/metodologia#cobertura" prefetch={false}>Fonte, cobertura e reprodução</Link>.</p>
        </>}
    />;
}
