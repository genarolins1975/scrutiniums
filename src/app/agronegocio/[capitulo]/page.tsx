import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CAPITULOS_AGRO, capituloAgro } from '@/lib/agro/modelo';
import { dadosAgro } from '@/lib/agro/dados';
import { laboratorioAgro } from '@/lib/agro/laboratorios';
import { AberturaAgro, SecaoAgro, LimiteAgro } from '@/components/agro/Editorial';
import { LaboratorioAgro } from '@/components/agro/Laboratorio';
import { ObservadoCapituloAgro, PainelCadeiasAgro } from '@/components/agro/Cadeias';
import { ConceitoAgro } from '@/components/agro/Conceito';
import { conceitoAgro } from '@/lib/agro/conceitos';
import { ExploradorCadeiaAgro } from '@/components/agro/ExploradorCadeia';
import { PainelPrincipal } from '@/components/observatorios/PainelPrincipal';
import { CreditoNacionalAgro, ProgramasAgro, TrabalhoNacionalAgro, AlimentacaoObservadaAgro, InflacaoObservadaAgro } from '@/components/agro/DadosObservados';
import { PerfilTrabalhoAgro } from '@/components/agro/PerfilTrabalho';
import { PoderCompraAgro } from '@/components/agro/PoderCompra';
import s from '@/components/agro/Agro.module.css';
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { Recolhido } from '@/components/observatorios/Recolhido';
import { PaginaPainel } from '@/components/painel';
import { numeroAgroIndicador } from '@/components/agro/Molde';
import { numeroAgro } from '@/lib/agro/modelo';
export const dynamic = 'force-static';
export const dynamicParams = false;
export function generateStaticParams() { return CAPITULOS_AGRO.map(c => ({ capitulo: c.id })); }
export function generateMetadata({ params }: {
    params: {
        capitulo: string;
    };
}): Metadata { const c = capituloAgro(params.capitulo); return { title: c ? tituloNaColecao(c.nome, '/agronegocio/' + params.capitulo) : 'Capítulo não encontrado', description: c?.pergunta, alternates: { canonical: '/agronegocio/' + params.capitulo } }; }
function Artefatos({ ids, primeiroAberto = false }: {
    ids: string[];
    primeiroAberto?: boolean;
}) { return <>{ids.map((id, i) => id === 'B5' ? <PoderCompraAgro key={id} indices={dadosAgro.inflacao.indices} fonte={dadosAgro.fontes.find(f => f.id === 'inflacao')!.url}/> : laboratorioAgro(id) ? <LaboratorioAgro key={id} id={id} aberto={primeiroAberto && i === 0}/> : conceitoAgro(id) ? <ConceitoAgro key={id} id={id} aberto={primeiroAberto && i === 0}/> : null)}</>; }
function Bloqueio({ ids, titulo, children }: {
    ids: string[];
    titulo: string;
    children: React.ReactNode;
}) { return <aside className={s.empty}>{ids.map(id => <span id={id.toLowerCase()} key={id}/>)}<strong>{titulo}</strong>{children}<p className={s.note}>Itens {ids.join(', ')}: sem medição entregue. A explicação do que falta não é contada como indicador ou artefato quantitativo.</p></aside>; }
export default function CapituloAgroPage({ params }: {
    params: {
        capitulo: string;
    };
}) {
    const c = capituloAgro(params.capitulo);
    if (!c)
        notFound();
    // Clima e ambiente tem corpo próprio e é o capítulo do Grupo 1 da Iniciativa 1: só ele entra no molde de painel por enquanto
    if (c.id === 'clima-ambiente')
        return <CapituloClimaAmbiente c={c}/>;
    return <><AberturaAgro rotulo={'Agronegócio / ' + c.letra + ' · ' + c.nome} titulo={c.pergunta} texto={c.exploracao}/><div className={s.twoAxes}><article><p className={`rotulo ${s.eyebrow}`}>Dimensão econômica</p><h2>O que muda na atividade?</h2><p>{c.economia}</p></article><article><p className={`rotulo ${s.eyebrow}`}>Dimensão social</p><h2>Quem sente os efeitos?</h2><p>{c.social}</p></article></div><LimiteAgro titulo="Cobertura desta página">{c.limite} <Link href="/agronegocio/metodologia#cobertura" prefetch={false}>Conferir o que está medido e o que falta.</Link></LimiteAgro>
 {c.id === 'producao' ? <>{dadosAgro.economia && <SecaoAgro id="a1" rotulo="Dado observado · A1" titulo="Quanto o país produz, e onde." texto={`Produção de ${dadosAgro.economia.cadeias.ultimoAnoProducao} pelo IBGE e abate sob inspeção dos últimos quatro trimestres. Cada cartão leva à ficha da cadeia, com estados, série e comércio exterior.`}><PainelCadeiasAgro e={dadosAgro.economia}/><div className={s.actions}><Link className={s.primaryButton} href="/agronegocio/atlas?medida=producao-soja" prefetch={false}>Ver a produção por estado no mapa</Link><Link className={s.button} href="/agronegocio/conjuntura" prefetch={false}>Safra estimada do ano corrente</Link></div></SecaoAgro>}<SecaoAgro titulo="Antes dos números, o caminho." texto="Selecione uma cadeia. Grãos, carne, leite e floresta têm etapas e unidades próprias."><ExploradorCadeiaAgro /></SecaoAgro><SecaoAgro titulo="Experimente a conta e questione a comparação." rotulo="Modelos didáticos" texto="Cenários com valores que você informa, ao lado do dado observado acima. Não são estatística agrícola."><Artefatos ids={['A2', 'A4', 'A5', 'A6']}/></SecaoAgro><SecaoAgro titulo="O que ainda falta medir?"><Bloqueio ids={['A3']} titulo="Calendário regional não medido">O calendário de plantio e colheita da Conab não foi obtido. Não usamos um calendário genérico como recomendação. A régua A5 é cenário; a história A6 é guia conceitual.</Bloqueio><Bloqueio ids={['K7']} titulo="Sem referência internacional harmonizada">FAOSTAT não foi integrado. Sem produto, unidade e ano harmonizados não há referência internacional de rendimento, valor unitário de comércio ou participação de mercado.</Bloqueio></SecaoAgro></> :
            c.id === 'custos-renda' ? <>{dadosAgro.economia && <ObservadoCapituloAgro e={dadosAgro.economia} capitulo={c.id}/>}<SecaoAgro titulo="Monte a base. Altere uma hipótese." rotulo="Modelo didático · margem, não faturamento" texto="Informe preço e rendimento na mesma unidade. Defina o conjunto de custos antes de interpretar o resultado."><Artefatos ids={['B1']}/></SecaoAgro><SecaoAgro titulo="Abra a conta por outro ângulo." texto="Cascata, sensibilidade, relações de troca e poder de compra respondem perguntas distintas."><Artefatos ids={['B2', 'B3', 'B4', 'B5', 'B6']}/><InflacaoObservadaAgro dados={dadosAgro}/></SecaoAgro><SecaoAgro titulo="Caixa, investimento e perdas têm outro calendário." texto="Necessidade de capital e retorno no tempo não se resumem à margem por hectare."><Artefatos ids={['K1', 'K2', 'K3', 'K4', 'K10']}/></SecaoAgro></> :
                c.id === 'alimentos-consumo' ? <>{dadosAgro.economia && <ObservadoCapituloAgro e={dadosAgro.economia} capitulo={c.id}/>}<SecaoAgro titulo="Produzir, disponibilizar e conseguir comprar." texto="A condição dos domicílios é medida por pesquisa própria, não pelo volume da safra."><ConceitoAgro id="C6"/><AlimentacaoObservadaAgro dados={dadosAgro}/><Artefatos ids={['C2']}/></SecaoAgro><SecaoAgro titulo="A mesma cesta, outro orçamento." rotulo="Modelos didáticos" texto="Teste suas hipóteses sem enviar gastos pessoais ao servidor."><Artefatos ids={['C1', 'C5']}/></SecaoAgro><SecaoAgro titulo="As trajetórias de preço precisam de correspondência."><Bloqueio ids={['C3', 'C4']} titulo="Sem série pareada ou sazonalidade de alimentos medida">Não há preços ao produtor e no atacado compatíveis com os do consumidor. A inflação de alimentos e dos itens da cesta está em <Link href="/agronegocio/prato" prefetch={false}>Comida no prato</Link>, mas variação em 12 meses não é sazonalidade nem preço por quilo.</Bloqueio></SecaoAgro></> :
                    c.id === 'credito-protecao' ? <><SecaoAgro titulo="Quanto foi contratado e em que calendário?" texto="Observe a trajetória nacional antes de combinar outras aberturas."><CreditoNacionalAgro dados={dadosAgro}/><div className={s.actions}><Link className={s.primaryButton} href="/agronegocio/atlas#d1" prefetch={false}>Explorar crédito por UF e finalidade</Link><Link className={s.button} href="/agronegocio/politicas-inclusao#h2" prefetch={false}>Comparar os programas no Brasil</Link><Link className={s.button} href="/observatorio/rural-credit" prefetch={false}>Aprofundar no painel de crédito rural</Link></div></SecaoAgro><SecaoAgro titulo="Financiar e proteger são tarefas diferentes."><Artefatos ids={['D4', 'D2', 'D3', 'D5']}/></SecaoAgro><SecaoAgro titulo="A proteção precisa do universo próprio."><Bloqueio ids={['D6']} titulo="Seguro subvencionado e Proagro sem mapa observado">As bases de cobertura do MAPA/BCB ainda não foram obtidas e validadas. Não se usa crédito como substituto de seguro nem se interpreta ausência de registro como ausência de proteção. A comparação D2 é cenário, sem denominador observado de estabelecimentos.</Bloqueio></SecaoAgro></> :
                        c.id === 'logistica-mercados' ? <>{dadosAgro.economia && <ObservadoCapituloAgro e={dadosAgro.economia} capitulo={c.id}/>}<SecaoAgro titulo="O trajeto tem etapas, custos e transformação."><ExploradorCadeiaAgro /></SecaoAgro><SecaoAgro titulo="Mude o fluxo, não invente a rota." rotulo="Modelos didáticos" texto="Armazenagem, concentração e custos são modelos com hipóteses editáveis."><Artefatos ids={['E2', 'E4', 'E5', 'K5', 'K6', 'K9']}/></SecaoAgro><SecaoAgro titulo="Destinos e insumos, com dados observados." texto="O comércio exterior tem páginas próprias. Os cenários acima continuam sendo hipóteses."><div className={s.actions}><Link className={s.primaryButton} href="/agronegocio/mercados#e3" prefetch={false}>Para quem o agro vende (E3)</Link><Link className={s.button} href="/agronegocio/insumos#e6" prefetch={false}>Insumos importados e relação de troca (E6)</Link></div><Bloqueio ids={['E1']} titulo="Corredores e armazenagem ainda não medidos">Faltam fonte e geometria de corredores, portos, fretes e armazenagem. Não há rotas inferidas a partir do país de destino. E5 ensina a identidade em cenário; a decomposição observada por preço e quantidade não foi publicada.</Bloqueio></SecaoAgro></> :
                            c.id === 'empresas-trabalho' ? <><SecaoAgro titulo="Quantos vínculos e qual variação?" texto="O emprego formal nacional tem uma classificação própria."><TrabalhoNacionalAgro dados={dadosAgro}/></SecaoAgro><SecaoAgro titulo="Pessoas, renda e território em outra pesquisa." texto="No Censo 2022, grupo ocupacional, sexo e rendimento são observados com universo explícito."><PerfilTrabalhoAgro dados={dadosAgro}/></SecaoAgro><SecaoAgro titulo="Agentes, estoque, resultado e caixa."><Artefatos ids={['F1', 'F3', 'F5', 'K8', 'K12']}/></SecaoAgro><SecaoAgro titulo="O que os dois recortes não cobrem."><div className={s.actions}><Link className={s.primaryButton} href="/agronegocio/produtores#f4" prefetch={false}>Estabelecimentos, área e agricultura familiar (F4)</Link></div><Bloqueio ids={['F6']} titulo="Sem emprego formal por UF × atividade">Não há recorte formal UF × CNAE validado. O grupo ocupacional por UF não substitui essa medida. F2 cobre a seção A nacional, não remuneração formal territorial; K12 é cenário, sem mapa observado de especialização produtiva.</Bloqueio></SecaoAgro></> :
                                c.id === 'clima-ambiente' ? <>{dadosAgro.economia && <ObservadoCapituloAgro e={dadosAgro.economia} capitulo={c.id}/>}<PainelPrincipal rota="/agronegocio/clima-ambiente"/><SecaoAgro titulo="Um fenômeno, diferentes tipos de evidência." rotulo="Guia e modelos didáticos" texto="Aprenda a separar medidas e explore hipóteses sem fabricar uma nota de risco."><Artefatos ids={['G6', 'G5', 'G3', 'G4']}/></SecaoAgro><SecaoAgro titulo="A sobreposição exige dados compatíveis."><Bloqueio ids={['G1', 'G2']} titulo="Sem camadas produção/clima ou linha do tempo de safra medida">Não foram capturadas camadas ambientais com geometria e janela compatíveis com a produção. As séries nacionais de desmatamento, emissões e uso da terra estão em <Link href="/agronegocio/ambiente" prefetch={false}>Desmatamento e emissões</Link>. A série de temperatura de Energia descreve outro recorte e não foi usada como exposição agrícola. Água e uso do solo são cenários: não medem retirada, perda, desmatamento ou responsabilidade de um produtor.</Bloqueio></SecaoAgro></> :
                                    <><SecaoAgro titulo="Que instrumento aparece no registro?" texto="Valores de crédito descrevem financiamento; a despesa fiscal precisa de base própria."><ProgramasAgro dados={dadosAgro}/></SecaoAgro><SecaoAgro titulo="Da execução ao alcance, sem pular etapas."><Artefatos ids={['H1', 'H3', 'H4', 'H5', 'K11']}/></SecaoAgro><SecaoAgro titulo="O que a evidência de uma política permite dizer?" id="h6"><div className={s.conceptGrid}><article><small>INSTRUMENTO</small><h3>Contratação de crédito</h3><p>A base permite observar valores e contratos por programa. A identificação vem da fonte, sem inferir perfil ou elegibilidade fora dela.</p></article><article><small>ALCANCE OBSERVADO</small><h3>Contratos, não pessoas</h3><p>Quantidades não foram deduplicadas por beneficiário. Não há denominador integrado de população elegível nem custo fiscal do programa.</p></article><article><small>RESULTADO E IMPACTO</small><h3>Outra investigação</h3><p>Renda, emprego, alimentação ou bem-estar atribuíveis à política não são inferidos da contratação. Objetivos e regras atuais devem ser conferidos na documentação oficial.</p></article></div><p className={s.note}>H6 · explicação conceitual apoiada no registro de crédito. Objetivo declarado de cada programa não está integrado; os pagamentos do Tesouro por ação orçamentária estão em <Link href="/agronegocio/apoio" prefetch={false}>Apoio público</Link>. Não é avaliação de eficácia.</p><Link className={s.button} href="/contas-publicas" prefetch={false}>Como acompanhar a execução federal</Link></SecaoAgro></>}
 <SecaoAgro titulo="Continue pela pergunta que importa."><div className={s.actions}><Link className={s.button} href="/agronegocio/aprenda" prefetch={false}>Percursos e catálogo didático</Link><Link className={s.button} href="/agronegocio/comparar" prefetch={false}>Centro de comparações</Link><Link className={s.button} href="/agronegocio/metodologia#cobertura" prefetch={false}>Fonte, cobertura e reprodução</Link></div></SecaoAgro></>;
}

/**
 * Clima e ambiente no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A pergunta do capítulo abre o PaginaPainel, com o
 * grupo da navegação ("Capítulos") no lugar de "Agronegócio / G · Clima e ambiente" e a cobertura da página como o que ela não permite
 * concluir; o aviso do painel principal vem logo depois da abertura; os três números observados (os mesmos de ObservadoCapituloAgro) vão
 * para a faixa do kit; as duas dimensões, os guias e modelos didáticos, o que falta medir e os próximos caminhos ficam em capítulos
 * recolhidos abertos, com o conteúdo inteiro de antes. O capítulo não tem gráfico próprio: as séries estão em Desmatamento e emissões.
 */
function CapituloClimaAmbiente({ c }: { c: NonNullable<ReturnType<typeof capituloAgro>> }) {
    const e = dadosAgro.economia;
    const pct = (v: number) => numeroAgro(v, 0) + '%';
    const t = e?.ambiente.prodes.taxaAmazoniaLegal.filter(r => !r.estimada).at(-1), em = e?.ambiente.emissoes.anos.at(-1), u = e?.ambiente.usoTerra.anos.at(-1);
    const motivo = 'O snapshot do Agronegócio não traz esta série nesta publicação.';
    return <PaginaPainel
        rota={'/agronegocio/' + c.id}
        principal={false}
        abertura={{
            grupo: 'Capítulos',
            acento: 'energia',
            titulo: c.pergunta,
            lead: c.exploracao,
            recorte: { periodo: [t && `PRODES ${t.inicio}/${String(t.fim).slice(2)}`, em && `SEEG ${em.ano}`, u && `MapBiomas ${u.ano}`].filter(Boolean).join(', ') || 'sem série nesta publicação', universo: 'Brasil; Amazônia Legal no desmatamento', unidade: 'km², Mt CO2e e milhões de hectares', fonte: 'INPE, PRODES; SEEG; MapBiomas' },
            limite: <>a exposição, o risco ou a responsabilidade de um produtor ou de uma cadeia. {c.limite} <Link href="/agronegocio/metodologia#cobertura" prefetch={false}>Conferir o que está medido e o que falta.</Link></>,
        }}
        aviso={<PainelPrincipal rota="/agronegocio/clima-ambiente"/>}
        rotuloNumeros="Antes dos modelos, o que os satélites e inventários mostram."
        numeros={[
            numeroAgroIndicador({ rotulo: t ? `Desmatamento na Amazônia Legal, ${t.inicio}/${String(t.fim).slice(2)}` : 'Desmatamento na Amazônia Legal', unidade: 'km²', periodo: t ? `${t.inicio}/${String(t.fim).slice(2)}` : 'sem ano', fonte: 'INPE, PRODES', natureza: 'OBSERVADO', nota: 'Taxa oficial consolidada' }, t?.km2, t ? numeroAgro(t.km2, 0) : '', motivo),
            numeroAgroIndicador({ rotulo: em ? `Emissões da agropecuária, ${em.ano}` : 'Emissões da agropecuária', unidade: 'Mt CO2e', periodo: em ? String(em.ano) : 'sem ano', fonte: 'SEEG', natureza: 'ESTIMADO', nota: 'Estimativa da sociedade civil, não o inventário oficial' }, em ? em.agropecuaria / 1e6 : null, em ? numeroAgro(em.agropecuaria / 1e6, 0) : '', motivo),
            numeroAgroIndicador({ rotulo: u ? `Área de agropecuária, ${u.ano}` : 'Área de agropecuária', unidade: 'mi ha', periodo: u ? String(u.ano) : 'sem ano', fonte: 'MapBiomas', natureza: 'OBSERVADO', nota: u ? `${pct(100 * u.agropecuaria / u.total)} do território mapeado` : undefined }, u ? u.agropecuaria / 1e6 : null, u ? numeroAgro(u.agropecuaria / 1e6, 0) : '', motivo),
        ]}
        notaNumeros={<>
            <p>Dado observado. Números das páginas de perguntas, com fonte e período. Os modelos abaixo usam valores que você informa e não substituem estas medições.</p>
            <div className={s.actions}><Link className={s.primaryButton} href="/agronegocio/ambiente" prefetch={false}>Quanto se desmata e quanto o campo emite</Link></div>
        </>}
        figuras={<>
            <Recolhido id="dimensoes" aberto nivelTitulo={2} titulo="O que muda na atividade, e quem sente os efeitos?" resumo="Dimensão econômica e dimensão social do capítulo.">
                <div className={s.twoAxes}><article><p className={`rotulo ${s.eyebrow}`}>Dimensão econômica</p><h3>O que muda na atividade?</h3><p>{c.economia}</p></article><article><p className={`rotulo ${s.eyebrow}`}>Dimensão social</p><h3>Quem sente os efeitos?</h3><p>{c.social}</p></article></div>
            </Recolhido>
            <Recolhido id="evidencias" aberto nivelTitulo={2} titulo="Um fenômeno, diferentes tipos de evidência." resumo="Guia e modelos didáticos · Aprenda a separar medidas e explore hipóteses sem fabricar uma nota de risco.">
                <Artefatos ids={['G6', 'G5', 'G3', 'G4']}/>
            </Recolhido>
            <Recolhido id="o-que-falta" aberto nivelTitulo={2} titulo="A sobreposição exige dados compatíveis." resumo="O que ainda falta medir neste capítulo.">
                <Bloqueio ids={['G1', 'G2']} titulo="Sem camadas produção/clima ou linha do tempo de safra medida">Não foram capturadas camadas ambientais com geometria e janela compatíveis com a produção. As séries nacionais de desmatamento, emissões e uso da terra estão em <Link href="/agronegocio/ambiente" prefetch={false}>Desmatamento e emissões</Link>. A série de temperatura de Energia descreve outro recorte e não foi usada como exposição agrícola. Água e uso do solo são cenários: não medem retirada, perda, desmatamento ou responsabilidade de um produtor.</Bloqueio>
            </Recolhido>
            <Recolhido id="continuar" aberto nivelTitulo={2} titulo="Continue pela pergunta que importa." resumo="Percursos didáticos, comparações e a reprodução dos números.">
                <div className={s.actions}><Link className={s.button} href="/agronegocio/aprenda" prefetch={false}>Percursos e catálogo didático</Link><Link className={s.button} href="/agronegocio/comparar" prefetch={false}>Centro de comparações</Link><Link className={s.button} href="/agronegocio/metodologia#cobertura" prefetch={false}>Fonte, cobertura e reprodução</Link></div>
            </Recolhido>
        </>}
        metodo={<>
            <p>Os três números do topo são os das páginas de perguntas: taxa oficial consolidada do PRODES (INPE) para a Amazônia Legal, emissões da agropecuária estimadas pelo SEEG (Observatório do Clima), que não são o inventário oficial, e a área de agropecuária mapeada pelo MapBiomas, com acurácia própria por classe. Os modelos didáticos usam valores que você informa e não são estatística agrícola.</p>
            <p><Link href="/agronegocio/metodologia#cobertura" prefetch={false}>Fonte, cobertura e reprodução</Link>.</p>
        </>}
    />;
}
