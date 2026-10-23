import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dadosAgro } from '@/lib/agro/dados';
import { numeroAgro, mesAgro } from '@/lib/agro/modelo';
import { mesCurtoAgro } from '@/lib/agro/economia';
import { FonteAgro, LimiteAgro } from '@/components/agro/Editorial';
import { ExportarAgro } from '@/components/agro/Exportar';
import { OutrasPerguntasAgro, capturadoAgro, numeroAgroIndicador, provAgro } from '@/components/agro/Molde';
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel } from '@/components/painel';
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import s from '@/components/agro/Agro.module.css';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: tituloNaColecao('Quanto custa a comida para as famílias?', '/agronegocio/prato'), description: 'Inflação de alimentos no IPCA, itens da cesta e segurança alimentar dos domicílios.', alternates: { canonical: '/agronegocio/prato' } };

const pct = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : numeroAgro(v, casas) + '%';
const sinal = (v: number | null | undefined, casas = 1) => v == null ? 'Não disponível' : (v > 0 ? '+' : '') + numeroAgro(v, casas) + '%';
const url = (id: string) => dadosAgro.fontes.find(f => f.id === id)?.url ?? '';

/**
 * Pergunta "Quanto custa a comida para as famílias?" no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os quatro números
 * do IPCA na faixa do kit; a inflação da comida em casa contra o índice geral, os itens da cesta e a segurança alimentar dos domicílios
 * como figuras com gráfico do kit, tabela equivalente e proveniência; o que a página não diz e a navegação entre as perguntas no fim; as
 * fontes no método. O rótulo é o grupo da navegação ("O setor"), sem o número da pergunta ("Pergunta 8"). Textos, números e cortes são
 * os de PratoAgro e AlimentacaoObservadaAgro, que seguem servindo as demais páginas do Agronegócio até o Grupo 3.
 */
export default function PaginaPratoAgro() {
    const e = dadosAgro.economia;
    if (!e)
        notFound();
    const p = e.prato, meses = p.meses.filter(m => m.geral !== null), ult = meses.at(-1)!, itens = p.itens.filter(i => !['7169', '7170', '7171', '7432'].includes(i.id) && i.doze !== null).sort((a, b) => (b.doze ?? 0) - (a.doze ?? 0));
    const pico = meses.reduce((a, b) => (b.domicilio ?? -Infinity) > (a.domicilio ?? -Infinity) ? b : a);
    const domicilio = p.itens.find(i => i.id === '7171')!;
    const colsMes = ['Mês', 'IPCA geral, % em 12 meses', 'Alimentação e bebidas, %', 'Alimentação no domicílio, %', 'Alimentação fora do domicílio, %'], linhasMes = meses.map(m => [m.mes, m.geral, m.alimentacaoBebidas, m.domicilio, m.fora]);
    const colsItem = ['Item', 'Variação em 12 meses, %', 'Peso no IPCA, %'], linhasItem = itens.map(i => [i.nome, i.doze, i.peso]);
    const ate = mesCurtoAgro(p.ultimoMes);
    const ipca = (indicador: string, natureza: 'OBSERVADO' | 'CALCULADO', inicio: string) => provAgro(dadosAgro, 'ipca', { indicador, natureza, unidade: '% em 12 meses', frequencia: 'mensal', inicio, fim: p.ultimoMes });
    // segurança alimentar: o ano mais recente no gráfico, todas as observações preservadas na tabela
    const obs = dadosAgro.alimentos.observacoes, ano = Math.max(...obs.map(r => r.year)), recentes = obs.filter(r => r.year === ano);
    const colsAli = ['Território', 'Ano', 'Segurança alimentar, %', 'Insegurança, %', 'Leve, %', 'Moderada, %', 'Grave, %', 'Universo', 'Fonte'];
    const fonteAli = dadosAgro.fontes.find(f => f.id === 'alimentacao')!;
    const linhasAli = obs.map(r => [r.territory, r.year, r.secure, r.insecure, r.mild, r.moderate, r.severe, dadosAgro.alimentos.universo, fonteAli.url]);
    const base = { periodo: `12 meses até ${ate}`, fonte: 'IBGE, IPCA' };
    return <PaginaPainel
        rota="/agronegocio/prato"
        principal={false}
        abertura={{
            grupo: 'O setor',
            acento: 'energia',
            titulo: 'Quanto custa a comida para as famílias?',
            lead: 'A inflação dos alimentos comprados para casa, item a item, comparada com a inflação geral, e a condição alimentar dos domicílios. Preço ao consumidor não é preço ao produtor.',
            recorte: { periodo: `${mesCurtoAgro(meses[0].mes)} a ${ate}`, universo: 'famílias das 16 áreas do IPCA; domicílios da PNAD Contínua', unidade: '% em 12 meses e % dos domicílios', fonte: 'IBGE, IPCA e PNAD Contínua' },
            limite: 'a causa da alta de um alimento. O IPCA mede o preço pago pelas famílias, não o efeito da exportação, do clima ou de uma política, nem o preço pago ao produtor.',
        }}
        rotuloNumeros={`Inflação da comida no IPCA, 12 meses até ${ate}`}
        numeros={[
            numeroAgroIndicador({ ...base, rotulo: 'Alimentação no domicílio, 12 meses', unidade: 'em 12 meses', natureza: 'OBSERVADO', nota: `IPCA geral: ${sinal(ult.geral, 2)}` }, ult.domicilio, sinal(ult.domicilio, 2)),
            numeroAgroIndicador({ ...base, periodo: ate, rotulo: 'Peso da comida em casa no IPCA', unidade: 'do orçamento das famílias da pesquisa', natureza: 'OBSERVADO', nota: `Fora de casa: ${pct(p.itens.find(i => i.id === '7432')?.peso, 1)}` }, domicilio.peso, pct(domicilio.peso, 1)),
            numeroAgroIndicador({ ...base, rotulo: 'Maior alta entre os itens acompanhados', unidade: 'em 12 meses', recorte: itens[0]?.nome, natureza: 'CALCULADO' }, itens[0]?.doze, sinal(itens[0]?.doze)),
            numeroAgroIndicador({ ...base, rotulo: 'Maior queda entre os itens acompanhados', unidade: 'em 12 meses', recorte: itens.at(-1)?.nome, natureza: 'CALCULADO' }, itens.at(-1)?.doze, sinal(itens.at(-1)?.doze)),
        ]}
        figuras={<>
            <FiguraAnalitica
                id="comida-e-geral"
                pergunta="A comida sobe mais ou menos que o resto?"
                subtitulo={`Inflação em 12 meses: comida em casa e índice geral · % · ${mesCurtoAgro(meses[0].mes)} a ${ate}`}
                natureza="OBSERVADO"
                proveniencia={ipca('Inflação em 12 meses: alimentação no domicílio e IPCA geral', 'OBSERVADO', meses[0].mes)}
                extraFonte={<>{capturadoAgro(dadosAgro, 'ipca')}</>}
                leitura={<LeituraGuiada>Desde {meses[0].mes.slice(0, 4)}, a maior alta em 12 meses da alimentação no domicílio foi de {sinal(pico.domicilio)}, em {mesAgro(pico.mes)}. Em {mesAgro(p.ultimoMes)}, foi de {sinal(ult.domicilio)}.</LeituraGuiada>}
                comoInterpretar="Variação acumulada em 12 meses publicada pelo IBGE. Preço pago pelas famílias nas 16 áreas da pesquisa; inclui transporte, processamento e varejo, não só o preço ao produtor."
                naoConcluir="que o produtor recebeu mais quando a comida subiu: o IPCA mede o preço pago pelas famílias, que inclui transporte, processamento e varejo."
                tabela={{ titulo: 'IPCA · variação em 12 meses', colunas: colsMes, linhas: linhasMes.map(r => [mesCurtoAgro(r[0] as string), ...r.slice(1)]), casas: [null, 2, 2, 2, 2], limite: linhasMes.length }}
                depois={<div className={s.actions}><ExportarAgro nome="agro-ipca-alimentos.csv" colunas={[...colsMes, 'Fonte']} linhas={linhasMes.map(r => [...r, url('ipca')])}/></div>}
            >
                <GraficoLinhas semTabela titulo="Inflação em 12 meses: comida em casa e índice geral" dados={meses.map(m => ({ mes: m.mes, domicilio: m.domicilio, geral: m.geral }))} chaveX="mes" formatoX="mes" series={[{ id: 'domicilio', rotulo: 'Alimentação no domicílio', cor: 'var(--cor-energia)' }, { id: 'geral', rotulo: 'IPCA geral', cor: 'var(--serie-referencia)' }]} unidade="%" casas={2} zeroNoEixo/>
            </FiguraAnalitica>
            <FiguraAnalitica
                id="cesta"
                pergunta="O que subiu e o que caiu na cesta."
                subtitulo={`Variação em 12 meses por item · % · 12 meses até ${ate} · itens do IPCA ligados às cadeias deste observatório`}
                natureza="OBSERVADO"
                proveniencia={ipca('Variação em 12 meses dos itens da cesta e peso no IPCA', 'OBSERVADO', p.ultimoMes)}
                leitura={<LeituraGuiada>Itens do IPCA ligados às cadeias deste observatório. Variações grandes de um item com peso pequeno mexem pouco no orçamento médio.</LeituraGuiada>}
                comoInterpretar="Altas à direita do zero, quedas à esquerda. A tabela traz o peso de cada item no índice."
                naoConcluir="quanto cada item pesou no orçamento de uma família: a variação de um item com peso pequeno no índice mexe pouco no orçamento médio, e o peso está na tabela."
                tabela={{ titulo: `Itens da cesta · ${ate}`, colunas: colsItem, linhas: linhasItem, casas: [null, 2, 2], limite: linhasItem.length }}
            >
                <GraficoBarras semTabela titulo={`Variação em 12 meses por item, 12 meses até ${ate}`} dados={itens.map(i => ({ id: i.id, nome: i.nome, doze: i.doze }))} chaveCategoria="id" chaveRotulo="nome" series={[{ id: 'doze', rotulo: 'Variação em 12 meses', cor: 'var(--cor-energia)' }]} unidade="%" casas={1} orientacao="horizontal" alturaMaxima={itens.length * 48 + 48} rotulosValor rotulosSaoNomes/>
            </FiguraAnalitica>
            <FiguraAnalitica
                id="c6-dados"
                pergunta="Preço é uma parte; acesso é outra."
                subtitulo={`A alimentação chega com regularidade e qualidade? · % dos domicílios com insegurança alimentar · ${ano}`}
                natureza="OBSERVADO"
                proveniencia={provAgro(dadosAgro, 'alimentacao', { indicador: 'Domicílios com insegurança alimentar, Brasil e Grandes Regiões', natureza: 'OBSERVADO', unidade: '% dos domicílios', frequencia: 'pesquisa suplementar da PNAD Contínua', inicio: String(Math.min(...obs.map(r => r.year))), fim: String(ano), limitacoes: [dadosAgro.alimentos.universo] })}
                leitura={<LeituraGuiada>A segurança alimentar dos domicílios é medida por pesquisa própria, com outro calendário.</LeituraGuiada>}
                comoInterpretar={`${dadosAgro.alimentos.universo} Produção agrícola não é denominador da insegurança alimentar. Brasil é agregado nacional; as regiões são recortes próprios, não parcelas percentuais para somar.`}
                naoConcluir="que a produção agrícola explica a insegurança alimentar: domicílios não são estabelecimentos agrícolas, e não há inferência de causa pela produção."
                tabela={{ titulo: 'PNAD Contínua · segurança alimentar · todas as observações preservadas', colunas: colsAli.slice(0, 7), linhas: linhasAli.map(r => [r[0], String(r[1]), ...r.slice(2, 7)]), casas: [null, null, 1, 1, 1, 1, 1], limite: linhasAli.length }}
                depois={<>
                    <div className={s.actions}><ExportarAgro nome="agro-seguranca-alimentar.csv" colunas={colsAli} linhas={linhasAli}/></div>
                    <LimiteAgro titulo="O que esta página não diz">Não atribui a alta de um alimento à exportação, ao clima ou a uma política: o IPCA mede o preço, não a causa. Também não mede o preço pago ao produtor. Para testar o efeito de uma alta no seu orçamento, use o <Link href="/agronegocio/alimentos-consumo#c1" prefetch={false}>cenário de orçamento familiar</Link>.</LimiteAgro>
                    <OutrasPerguntasAgro e={e} atual="prato"/>
                </>}
            >
                <GraficoBarras semTabela titulo={`Domicílios com insegurança alimentar, ${ano}`} dados={recentes.map(r => ({ id: r.territory, insegura: r.insecure }))} chaveCategoria="id" series={[{ id: 'insegura', rotulo: '% dos domicílios com insegurança alimentar', cor: 'var(--cor-energia)' }]} unidade="%" casas={1} orientacao="horizontal" rotulosValor rotulosSaoNomes/>
            </FiguraAnalitica>
        </>}
        metodo={<>
            <FonteAgro dados={dadosAgro} id="ipca" periodo={`${mesCurtoAgro(meses[0].mes)} a ${ate}`} nota={capturadoAgro(dadosAgro, 'ipca')}/>
            <FonteAgro dados={dadosAgro} id="alimentacao" periodo="2023 e 2024" nota="Fonte original conferida no pipeline de Segurança Alimentar. Domicílios não são estabelecimentos agrícolas; não há inferência de causa pela produção."/>
            <p>A inflação é a variação acumulada em 12 meses publicada pelo IBGE, sem cálculo da página; a maior alta e a maior queda são a ordenação dos itens ligados às cadeias do observatório, sem o índice geral e os grupos de alimentação. <Link href="/agronegocio/metodologia#cobertura" prefetch={false}>Fonte, cobertura e reprodução</Link>.</p>
        </>}
    />;
}
