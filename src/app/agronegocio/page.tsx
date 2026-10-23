import type { Metadata } from 'next';
import Link from 'next/link';
import { dadosAgro } from '@/lib/agro/dados';
import { CAPITULOS_AGRO, PERGUNTAS_AGRO } from '@/lib/agro/modelo';
import { PainelCadeiasAgro } from '@/components/agro/Cadeias';
import { SetaAgro } from '@/components/agro/Figuras';
import { escalaAgro, respostasAgro } from '@/components/agro/Economia';
import { LimiteAgro } from '@/components/agro/Editorial';
import { ExploradorCadeiaAgro } from '@/components/agro/ExploradorCadeia';
import s from '@/components/agro/Agro.module.css';
import { FaixaFrescor } from '@/components/frescor/FaixaFrescor';
import { FRESCOR_DAS_COLECOES } from '@/lib/frescor/entradas';
import { ParaVoce } from '@/components/observatorios/ParaVoce';
import { EntradaColecao } from '@/components/observatorios/EntradaColecao';
import { destinosDaColecao } from '@/components/observatorios/DestinosDaColecao';
import { ModeloDidatico } from '@/components/observatorios/ModeloDidatico';
import { Recolhido } from '@/components/observatorios/Recolhido';
export const dynamic = 'force-static';
export const metadata: Metadata = { title: { absolute: 'Agronegócio · Scrutiniums' }, description: 'Como está o agronegócio brasileiro: tamanho na economia, safra, custo dos insumos e destino das exportações, com dados oficiais, fonte e período em cada número.', alternates: { canonical: '/agronegocio' } };

/**
 * Entrada do Agronegócio no molde único (Iniciativa 4 do parecer de UX, 22/10/2026). O layout da coleção já abre o <main>, por
 * isso a entrada é um <div> dentro dele (principal={false}). As oito perguntas são os caminhos, com a resposta curta e o número
 * que a prova; o explorador das cadeias é o modelo didático; as doze cadeias, os capítulos e os cenários ficam recolhidos.
 */
export default function InicioAgro() {
    const d = dadosAgro, c = d.credito, f = d.trabalho.formal, e = d.economia;
    const respostas = e ? respostasAgro(e) : null;
    return (
        <EntradaColecao
            tipo="colecao"
            rota="/agronegocio"
            acento="energia"
            principal={false}
            titulo="Como está o agronegócio brasileiro?"
            frase="O tamanho do setor na economia, o ritmo da safra, quanto custam os insumos importados e para quem o país vende. Dados oficiais com fonte, período e limite em cada número."
            frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/agronegocio"]} conteiner="mx-auto max-w-page px-6" />}
            escala={e ? escalaAgro(e) : undefined}
            paraVoce={<ParaVoce entrada="/agronegocio" />}
            destinos={destinosDaColecao('agro')}
            artefato={
                <ModeloDidatico
                    id="explorador-cadeias"
                    titulo="Um sistema. Caminhos diferentes."
                    descricao="Escolha uma cadeia e reconheça o que muda entre o campo, a transformação e o uso. As setas explicam etapas; não medem transações."
                    deixaDeFora={[
                        'Os volumes e os valores que passam de uma etapa a outra',
                        'A participação de cada etapa no preço final',
                        'A origem de um alimento específico comprado por uma família',
                    ]}
                >
                    <ExploradorCadeiaAgro />
                </ModeloDidatico>
            }
            caminhos={respostas ? PERGUNTAS_AGRO.map(p => ({ pergunta: p.titulo, resumo: respostas[p.id], href: '/agronegocio/' + p.id })) : undefined}
            recolhidos={
                <>
                    {e && (
                        <Recolhido id="recolhido-cadeias" titulo="Doze cadeias: quanto produzem e quanto vendem ao exterior." resumo="As maiores exportações do agro e os alimentos de peso na mesa.">
                            <p className="mb-6 max-w-prose2 text-sm leading-relaxed text-carvao-muted">As maiores exportações do agro e os alimentos de peso na mesa. Cada cadeia tem sua medida física; não se somam toneladas de soja, litros de leite e metros cúbicos de madeira.</p>
                            <PainelCadeiasAgro e={e} />
                        </Recolhido>
                    )}
                    <Recolhido id="recolhido-capitulos" titulo="Aprofunde por tema." resumo="Oito capítulos com conceitos, cenários e os dados de cada tema.">
                        <p className="mb-6 max-w-prose2 text-sm leading-relaxed text-carvao-muted">Oito capítulos com conceitos, cenários e os dados disponíveis de cada tema. A cobertura muda de um capítulo para outro e está declarada em cada página.</p>
                        <div className={s.chapterGrid}>{CAPITULOS_AGRO.map(c => <Link href={'/agronegocio/' + c.id} key={c.id} prefetch={false}><span className={s.letter}>{c.letra}</span><div><h3>{c.nome}</h3><p>{c.pergunta}</p></div><SetaAgro /></Link>)}</div>
                    </Recolhido>
                    <Recolhido id="recolhido-cenarios" titulo="Entender também é poder testar." resumo="Cenários com os seus próprios números.">
                        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">Cenários com os seus próprios números, para examinar hipóteses. Não são estatísticas do setor, e os valores que você informa não são transmitidos.</p>
                        <div className={s.routeCards}><Link href="/agronegocio/alimentos-consumo#c1" prefetch={false}><strong>Orçamento da família</strong><p>Como as variações escolhidas alteram a despesa com alimentação?</p></Link><Link href="/agronegocio/custos-renda#b1" prefetch={false}><strong>Margem da produção</strong><p>O que muda quando preço, rendimento e custos variam?</p></Link><Link href="/agronegocio/custos-renda#k1" prefetch={false}><strong>Caixa da safra</strong><p>Em qual mês os desembolsos exigem capital?</p></Link><Link href="/agronegocio/custos-renda#k2" prefetch={false}><strong>Investimento no tempo</strong><p>Como vida útil e desconto afetam o valor presente?</p></Link><Link href="/agronegocio/comparar" prefetch={false}><strong>Territórios lado a lado</strong><p>Mesma medida e período, com denominadores visíveis.</p></Link><Link href="/agronegocio/aprenda" prefetch={false}><strong>Percursos e oficinas</strong><p>Atividades por público, glossário e índice dos artefatos.</p></Link></div>
                    </Recolhido>
                </>
            }
            metodo={
                <div className="space-y-4 text-sm leading-relaxed text-carvao">
                    <p className="text-carvao-muted">Crédito rural, trabalho e alimentação vêm de recortes preservados, cada um com seu período. A data da coleta mais recente e a situação da atualização estão na faixa do alto da página.</p>
                    <p>Coletados na fonte e atualizados por rotina automática: IBGE (Contas Nacionais, LSPA, Produção Agrícola e Pecuária Municipal, Abate, Silvicultura, Censo Agro, PNAD Contínua e IPCA), MDIC (Comex Stat), BCB (Sicor), Tesouro Nacional, INPE (PRODES), SEEG e MapBiomas. Crédito rural: snapshot BCB/Sicor preservado, processado em {c.capturaOriginal.slice(0, 10)}. Emprego formal: seção A nacional até {f.periodo}, preliminar. Grupo ocupacional por UF: Censo Demográfico 2022. Segurança alimentar: PNADC 2023/2024. Os arquivos de origem têm hashes registrados.</p>
                    <LimiteAgro titulo="Limitações materiais">Ainda faltam o calendário regional de plantio e colheita, custos de produção de referência da Conab, preço ao produtor por alimento, seguro rural (PSR), PIB do agronegócio ampliado e camadas ambientais territoriais. Explicações e cenários preservam as perguntas, sem substituir essas medições.</LimiteAgro>
                    <div className={s.actions}><Link className={s.button} href="/agronegocio/metodologia" prefetch={false}>Conferir método, cobertura e downloads</Link><Link className={s.button} href="/agronegocio/glossario" prefetch={false}>Glossário visual e pesquisável</Link></div>
                </div>
            }
            frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/agronegocio"]} variante="metodo" />}
        />
    );
}
