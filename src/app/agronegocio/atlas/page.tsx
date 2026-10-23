import type { Metadata } from 'next';
import Link from 'next/link';
import { dadosAgro, malhaAgro } from '@/lib/agro/dados';
import type { CamadaGeo } from '@/lib/energia/geo';
import { MEDIDAS_TERRITORIAIS_AGRO, compararTerritoriosAgro, distribuicaoAgro, observacoesTerritoriaisAgro, type MedidaTerritorialAgro } from '@/lib/agro/consulta';
import { numeroAgro } from '@/lib/agro/modelo';
import { ExportarAgro } from '@/components/agro/Exportar';
import { FormularioAtlas, MapaAtlas } from '@/components/agro/AtlasControles';
import { provAgro } from '@/components/agro/Molde';
import { Recolhido } from '@/components/observatorios/Recolhido';
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada, PaginaPainel, type NumeroProps } from '@/components/painel';
import s from '@/components/agro/Agro.module.css';
export const metadata: Metadata = { title: 'Atlas territorial', alternates: { canonical: '/agronegocio/atlas' } };

/** Fonte curta da faixa e da abertura; o nome completo da fonte fica no rodapé de cada figura e no método. */
const FONTE_CURTA: Record<string, string> = { producao: 'IBGE, produção por estado', credito: 'BCB, MDCR/Sicor', ocupacoes: 'IBGE, Censo Demográfico 2022' };
const CORES = ['var(--escala-seq-1)', 'var(--escala-seq-2)', 'var(--escala-seq-3)', 'var(--escala-seq-4)', 'var(--escala-seq-5)'];
/** O recorte padrão do Atlas, o mesmo do explorador de antes: soja, Mato Grosso, Paraná e Rio Grande do Sul, com Mato Grosso em foco. */
const PADROES = { medida: 'producao-soja', u1: '51', u2: '41', u3: '43', foco: '51' };
type Estado = typeof PADROES;

function hrefAtlas(e: Estado, mudanca: Partial<Estado>, ancora: string) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...e, ...mudanca }))
        if (v !== PADROES[k as keyof Estado])
            q.set(k, v);
    const t = q.toString();
    return `/agronegocio/atlas${t ? `?${t}` : ''}#${ancora}`;
}

/**
 * Atlas territorial do Agronegócio no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). O recorte (medida, até três UFs e a
 * UF em foco) é lido da URL no servidor, nos mesmos parâmetros e padrões do explorador de antes (ExploracaoTerritorialAgro, que segue no
 * Comparar até o Grupo 3), e o HTML já sai no recorte pedido: o link copiado reproduz a página. A escolha da medida é a primeira ação; a
 * UF em foco, o valor mediano e a cobertura ficam na faixa de números; o mapa (legado, até a Iniciativa 5), a comparação de até três UFs
 * e a distribuição são figuras com tabela equivalente, proveniência e o que não permitem concluir; as fontes vão para o método.
 */
export default function AtlasAgro({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
    const geometria = malhaAgro as unknown as CamadaGeo;
    const territorios = geometria.features.map(f => ({ id: f.id, nome: f.nome, uf: f.uf ?? f.id })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const ids = ['', ...territorios.map(t => t.id)];
    const um = (k: string) => { const v = searchParams[k]; return Array.isArray(v) ? v[0] : v; };
    const opcao = (k: keyof Estado, validos: readonly string[]) => { const v = um(k); return v !== undefined && validos.includes(v) ? v : PADROES[k]; };
    const estado: Estado = { medida: opcao('medida', MEDIDAS_TERRITORIAIS_AGRO.map(m => m.id)), u1: opcao('u1', ids), u2: opcao('u2', ids), u3: opcao('u3', ids), foco: opcao('foco', ids) };
    const medida = estado.medida as MedidaTerritorialAgro, meta = MEDIDAS_TERRITORIAIS_AGRO.find(m => m.id === medida)!;
    const rows = observacoesTerritoriaisAgro(dadosAgro, territorios, medida), comparison = compararTerritoriosAgro(rows, [estado.u1, estado.u2, estado.u3]);
    const periodo = rows[0]?.periodo ?? '', fonte = dadosAgro.fontes.find(f => f.id === meta.fonte)!, dist = distribuicaoAgro(rows.map(r => r.valor));
    const mapaEscala = meta.unidade === 'R$ correntes' ? 1e9 : 1;
    const unidadeEscala = mapaEscala === 1e9 ? 'R$ bilhões correntes' : meta.unidade;
    const casas = medida === 'credito' || medida === 'contratos' || medida === 'ocupados' || medida.startsWith('producao-') ? 0 : 2;
    const casasEscala = mapaEscala === 1e9 ? 1 : casas;
    const escalar = (v: number | null) => (v === null ? null : v / mapaEscala);
    const focus = rows.find(r => r.id === estado.foco);
    const comValor = rows.filter(r => r.valor !== null).length;
    const colunas = ['UF', 'Nome', 'Valor', 'Unidade', 'Período', 'Denominador', 'Selecionada', 'Fonte', 'Limite'];
    const csv = (rs: typeof rows) => rs.map(r => [r.uf, r.nome, r.valor, r.unidade, r.periodo, r.denominador, comparison.selecionados.some(x => x.id === r.id) ? 'Sim' : 'Não', fonte.url, meta.descricao]);
    const prov = (indicador: string, natureza: 'OBSERVADO' | 'CALCULADO') => provAgro(dadosAgro, meta.fonte, { indicador, natureza, unidade: meta.unidade, frequencia: meta.fonte === 'credito' ? 'janela de contratação' : meta.fonte === 'producao' ? 'anual (abate: quatro trimestres)' : 'censo', inicio: periodo, fim: periodo, limitacoes: [meta.descricao] });
    const universo = meta.fonte === 'credito' ? 'Todas as cadeias financiadas, sem abertura conjunta por produto.' : meta.fonte === 'producao' ? 'Uma cadeia por vez, com a medida física publicada pelo IBGE.' : 'Grupo ocupacional do Censo, sem identificação de cadeia ou formalidade.';
    const tabelaUfs = (rs: typeof rows) => rs.map(r => [r.nome, r.valor, r.unidade, r.periodo, r.denominador]);
    const ocultos = (manter: (keyof Estado)[]) => (Object.keys(PADROES) as (keyof Estado)[]).filter(k => !manter.includes(k)).map(k => <input key={k} type="hidden" name={k} value={estado[k]} data-padrao={PADROES[k]}/>);
    const fonteCurta = FONTE_CURTA[meta.fonte] ?? fonte.nome;
    const base = { periodo, fonte: fonteCurta, unidade: meta.unidade, tamanho: 'm' as const };
    const numeros: NumeroProps[] = [
        focus && focus.valor !== null
            ? { ...base, rotulo: `${meta.nome} em ${focus.nome}`, valor: focus.valor, valorTexto: numeroAgro(focus.valor, casas), natureza: medida === 'credito-contrato' || medida === 'parcela-ocupados' ? 'CALCULADO' : 'OBSERVADO', nota: 'A UF em foco no mapa; toque outra UF para trocar.' }
            : { ...base, rotulo: `${meta.nome}${focus ? ` em ${focus.nome}` : ', UF em foco'}`, valor: null, natureza: 'OBSERVADO', motivoAusencia: focus ? 'Sem valor para esta UF na fonte (sigilo ou ausência); ausência não vira zero.' : 'Nenhuma UF em foco: toque uma UF no mapa.' },
        dist
            ? { ...base, rotulo: 'Mediana das UFs', valor: dist.mediana, valorTexto: numeroAgro(dist.mediana, casas), natureza: 'CALCULADO', nota: 'Peso igual por UF; não é a mediana das pessoas nem pondera população.' }
            : { ...base, rotulo: 'Mediana das UFs', valor: null, natureza: 'CALCULADO', motivoAusencia: 'Nenhuma UF com valor nesta medida.' },
        { ...base, rotulo: 'UFs com valor', valor: comValor, formato: 'inteiro', unidade: `de ${rows.length}`, natureza: 'CALCULADO', nota: universo },
    ];
    // as ações da comparação: as exportações CSV, a síntese para impressão e o recorte inicial
    const acoes = <div className={s.actions}>
            {comparison.selecionados.length > 0 && <ExportarAgro nome={'agro-' + medida + '-selecionadas.csv'} colunas={colunas} linhas={csv(comparison.selecionados)} rotulo="Baixar UFs selecionadas · CSV"/>}
            <ExportarAgro nome={'agro-' + medida + '-27-ufs.csv'} colunas={colunas} linhas={csv(rows)} rotulo="Baixar todas as 27 UFs · CSV"/>
            <Link className={s.button} href={'/agronegocio/sintese?medida=' + medida + '&u1=' + estado.u1 + '&u2=' + estado.u2 + '&u3=' + estado.u3} prefetch={false}>Preparar síntese para impressão</Link>
            <Link className={s.textButton} href={hrefAtlas(estado, { medida: 'credito', u1: '51', u2: '41', u3: '43', foco: '51' }, 'comparar')} scroll={false}>Restaurar comparação inicial</Link>
        </div>;
    return <PaginaPainel
        rota="/agronegocio/atlas"
        principal={false}
        abertura={{
            acento: 'energia',
            titulo: 'De onde vem o que o país produz?',
            lead: 'Escolha uma cadeia e veja a produção de cada estado, ou troque para crédito rural por finalidade e o grupo ocupacional do Censo 2022. Cada medida preserva seu universo, calendário e denominador.',
            acao: <FormularioAtlas ancora="d1" rotulo="Medida territorial do Agro">
                <label className={s.field}>Medida territorial<select name="medida" aria-label="Medida territorial do Agro" defaultValue={medida} data-padrao={PADROES.medida}>{MEDIDAS_TERRITORIAIS_AGRO.map(m => <option value={m.id} key={m.id}>{m.nome}</option>)}</select></label>
                {ocultos(['medida'])}
            </FormularioAtlas>,
            recorte: { periodo, universo: `${comValor} UFs com valor de ${rows.length}`, unidade: meta.unidade, fonte: fonteCurta },
            limite: 'que medidas de fontes diferentes são equivalentes. Produção é a medida física do IBGE de cada cadeia; o abate é o local do frigorífico, não a origem do animal, e estados sob sigilo ficam sem valor. Crédito não é produção; grupo ocupacional não é emprego formal de toda a cadeia.',
        }}
        rotuloNumeros={`${meta.nome}: UF em foco, mediana e cobertura`}
        numeros={numeros}
        notaNumeros={<>{meta.descricao} Ao mudar de fonte, o período e o universo mudam junto; os filtros não os tornam equivalentes.</>}
        figuras={<>
            <FiguraAnalitica
                id="d1"
                pergunta={`${meta.nome}, estado a estado`}
                subtitulo={`${unidadeEscala} · ${periodo} · ${comValor} UFs com valor de ${rows.length} · classes por quantis`}
                natureza={medida === 'credito-contrato' || medida === 'parcela-ocupados' ? 'CALCULADO' : 'OBSERVADO'}
                proveniencia={prov(`${meta.nome}, por UF`, medida === 'credito-contrato' || medida === 'parcela-ocupados' ? 'CALCULADO' : 'OBSERVADO')}
                extraFonte={<Link href={'/agronegocio/metodologia#fonte-' + meta.fonte} prefetch={false} className="underline">Conferir origem, data e limites</Link>}
                complemento={focus && <div className={s.twoAxes}><div><p className={`rotulo ${s.eyebrow}`}>{focus.nome} · {focus.uf}</p><p className="numero-m mt-2 text-carvao">{numeroAgro(focus.valor, casas)}</p><p>{focus.unidade} · {focus.periodo}</p></div><div><p className={`rotulo ${s.eyebrow}`}>Ler a medida</p><p>{focus.limite}</p>{focus.denominador !== null && <p>Denominador: {numeroAgro(focus.denominador)} {medida === 'credito-contrato' ? 'contratos' : 'ocupados com rendimento'}.</p>}<Link className={s.button} href={'/agronegocio/comparar?medida=' + medida + '&u1=' + focus.id + '&u2=&u3='} prefetch={false}>Comparar este território</Link></div></div>}
                ressalva={meta.fonte === 'producao' ? 'Produção do último período publicado pelo IBGE, uma cadeia por vez; a série anual e o comércio exterior estão na ficha de cada cadeia. Produção municipal e calendário regional de plantio e colheita não estão integrados.' : 'Esta medida não é produção. A produção por estado de cada cadeia está nas medidas "Produção" deste mesmo seletor.'}
                naoConcluir="que um estado é mais eficiente, tem mais acesso ou mais bem-estar: valores maiores não significam isso, e as classes do mapa são quantis, sem julgamento de desempenho."
                tabela={{ titulo: `${meta.nome} · todas as ${rows.length} UFs · ${meta.unidade} · ${periodo}`, colunas: ['Território', meta.nome, 'Unidade', 'Período', 'Denominador'], linhas: tabelaUfs(rows), casas: [null, casas, null, null, 0], limite: rows.length }}
            >
                <div data-mapa-legado="uf">
                    <MapaAtlas titulo={meta.nome} geometria={geometria} parametros={estado} padroes={PADROES} valores={Object.fromEntries(rows.map(r => [r.id, escalar(r.valor)]))} cores={CORES} unidade={unidadeEscala} casas={casasEscala} rotulos selecionado={estado.foco || null} altura={450} alturaCelular={340} periodo={periodo} nota={'Malha oficial do IBGE; ' + meta.descricao + ' Classes por quantis, sem julgamento de desempenho.' + (mapaEscala === 1e9 ? ' No mapa, valores em bilhões de reais; tabela e CSV em reais completos.' : '')}/>
                </div>
            </FiguraAnalitica>
            <Controles rotulo="Até três UFs, mesma medida" resumo={comparison.duplicados ? 'Território repetido aparece uma única vez, sem duplicar comparação ou exportação.' : `${comparison.selecionados.length} de 3 UFs escolhidas`}>
                <FormularioAtlas ancora="comparar" rotulo="Territórios da comparação">
                    {(['u1', 'u2', 'u3'] as const).map((key, i) => <label key={key} className={s.field}>Território {i + 1}<select name={key} aria-label={'Território do Agro ' + (i + 1)} defaultValue={estado[key]} data-padrao={PADROES[key]}><option value="">Sem seleção</option>{territorios.map(t => <option value={t.id} key={t.id}>{t.nome} ({t.uf})</option>)}</select></label>)}
                    {ocultos(['u1', 'u2', 'u3'])}
                </FormularioAtlas>
            </Controles>
            {comparison.selecionados.length ? <FiguraAnalitica
                id="comparar"
                pergunta="Contextos lado a lado."
                subtitulo={`Até três UFs, mesma medida · ${meta.unidade} · ${periodo}`}
                natureza={medida === 'credito-contrato' || medida === 'parcela-ocupados' ? 'CALCULADO' : 'OBSERVADO'}
                proveniencia={prov(`${meta.nome}, UFs selecionadas`, medida === 'credito-contrato' || medida === 'parcela-ocupados' ? 'CALCULADO' : 'OBSERVADO')}
                leitura={<LeituraGuiada>Escolha estados, preserve o recorte na URL e consulte os pares. Valores maiores não significam maior eficiência, acesso ou bem-estar.</LeituraGuiada>}
                comoInterpretar={meta.descricao}
                naoConcluir="que um estado vai melhor que outro: a comparação usa a mesma medida, período e universo, mas não divide pelo tamanho do estado nem mede eficiência, acesso ou bem-estar."
                tabela={{ titulo: `${meta.nome} · UFs selecionadas · ${meta.unidade} · ${periodo}`, colunas: ['Território', meta.nome, 'Unidade', 'Período', 'Denominador'], linhas: tabelaUfs(comparison.selecionados), casas: [null, casas, null, null, 0], limite: 3 }}
                depois={acoes}
            >
                <GraficoBarras semTabela titulo={`${meta.nome}, UFs selecionadas`} dados={comparison.selecionados.map(r => ({ id: r.id, nome: r.nome, valor: escalar(r.valor) }))} chaveCategoria="id" chaveRotulo="nome" series={[{ id: 'valor', rotulo: meta.nome, cor: 'var(--cor-energia)' }]} unidade={unidadeEscala} casas={casasEscala} orientacao="horizontal" rotulosValor rotulosSaoNomes/>
            </FiguraAnalitica> : <Recolhido id="comparar" aberto nivelTitulo={2} titulo="Contextos lado a lado." resumo="Até três UFs, mesma medida">
                <p className={s.empty}>Nenhuma UF selecionada. A distribuição e a tabela das UFs continuam disponíveis; a seleção vazia não vira zero.</p>
                {acoes}
            </Recolhido>}
            {dist && <FiguraAnalitica
                id="distribuicao"
                pergunta="Como os valores se distribuem nas UFs?"
                subtitulo={`${meta.unidade} · ${periodo} · ${dist.n} UFs · peso igual por UF`}
                natureza="CALCULADO"
                proveniencia={prov(`${meta.nome}: distribuição entre as UFs`, 'CALCULADO')}
                comoInterpretar="As linhas marcam o primeiro quartil, a mediana e o terceiro quartil; o mínimo e o máximo estão nas pontas da lista. Quantis com interpolação linear em (n−1) × p. A mediana de valores por UF não é a mediana das pessoas nem pondera população."
                naoConcluir="qual é o valor típico das pessoas ou dos produtores: cada UF tem o mesmo peso, sem ponderar população, e estados sob sigilo ou sem valor ficam fora."
                tabela={{ titulo: 'Distribuição · ' + meta.unidade, colunas: ['Medida', 'Mínimo', 'Primeiro quartil', 'Mediana das UFs', 'Terceiro quartil', 'Máximo'], linhas: [[meta.nome, dist.min, dist.q1, dist.mediana, dist.q3, dist.max]], casas: [null, casas, casas, casas, casas, casas] }}
            >
                <GraficoBarras semTabela titulo={`${meta.nome}: todas as UFs, do maior ao menor valor`} dados={[...rows].sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity)).map(r => ({ id: r.id, nome: r.nome, valor: escalar(r.valor) }))} chaveCategoria="id" chaveRotulo="nome" series={[{ id: 'valor', rotulo: meta.nome, cor: 'var(--cor-energia)' }]} unidade={unidadeEscala} casas={casasEscala} orientacao="horizontal" limiteInicial={12} referencias={[{ valor: dist.q1 / mapaEscala, rotulo: 'Primeiro quartil' }, { valor: dist.mediana / mapaEscala, rotulo: 'Mediana das UFs' }, { valor: dist.q3 / mapaEscala, rotulo: 'Terceiro quartil' }]} rotulosSaoNomes/>
            </FiguraAnalitica>}
        </>}
        metodo={<>
            <p>Fonte: <a href={fonte.url} className="underline">{fonte.nome}</a>. {meta.descricao} <Link href={'/agronegocio/metodologia#fonte-' + meta.fonte} prefetch={false} className="underline">Conferir origem, data e limites</Link>.</p>
            <p>Malha oficial do IBGE, já projetada pelo pipeline de Energia. Cada UF tem peso igual na mediana e nos quartis; não foi calculada razão com outra pesquisa ou outro ano. O recorte (medida, até três UFs e a UF em foco) fica no endereço da página.</p>
        </>}
    />;
}
