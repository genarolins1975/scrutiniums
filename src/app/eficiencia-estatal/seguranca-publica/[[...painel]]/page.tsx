import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Explorador} from '@/components/eficiencia/seguranca/Explorador';
import {DoisRegistros, type DadosDoisRegistros} from '@/components/eficiencia/seguranca/DoisRegistros';
import {PorEstado, PoliciaSaude} from '@/components/eficiencia/seguranca/PorEstado';
import {SeloComConta} from '@/components/acesso/SeloComConta';
import {prefetchDoLink} from '@/lib/rotasPublicas';
import {amplitude, goldSeguranca, GRUPOS, HREF_CSV, HREF_GOLD, indicador, linhasNacionais, nomeUF, pacoteEstados, pacotePoliciaSaude, ROTA, serieBR, seriePct, serieUF, ultimoIndice, ultimoIndiceSimFinal} from '@/lib/eficiencia/seguranca/dados';
import {contagemComUnidade, dataBr, inteiro, listaNatural, numero, reais, ROTULO_SITUACAO} from '@/lib/eficiencia/seguranca/formato';
import type {GoldSeguranca, GrupoId} from '@/lib/eficiencia/seguranca/tipos';
import {FiguraAnalitica, PaginaPainel, TabelaDados} from '@/components/painel';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';

type Grupo = keyof typeof GRUPOS;
const rotas = ['', 'estados', 'letalidade', 'mulheres', 'patrimonio', 'resposta', 'recursos', 'metodos'];
const TITULOS: Record<string, string> = {'': 'Segurança pública', estados: 'Segurança pública por estado', recursos: 'Recursos da segurança pública', metodos: 'Segurança pública: dados e métodos'};
export function generateStaticParams() { return rotas.map((r) => ({painel: r ? [r] : []})); }
export function generateMetadata({params}: {params: {painel?: string[]}}): Metadata {
  const slug = params.painel?.[0] ?? '';
  return {title: `${GRUPOS[slug as Grupo]?.titulo ?? TITULOS[slug] ?? 'Segurança pública'} · OBEE`, description: 'Violência registrada pela polícia e pela saúde em cada estado, em taxa por 100 mil habitantes, e a despesa estadual com segurança pública, com fontes, períodos e ausências explícitas.'};
}

/** Fichas "Sobre este dado" das quatro fontes da base, montadas com o que a gold registra (página, captura, versão e impressão digital). */
function fichasSeguranca(g: GoldSeguranca) {
  const periodo = {inicio: String(g.anos[0]), fim: String(g.anos.at(-1))};
  const base = {referencia: periodo, versao: g.versao, sha256: g.hash_dados, snapshot: HREF_GOLD.replace(/^\//, 'public/')};
  return {
    sinesp: fichaDaFigura({...base, indicador: 'Ocorrências e vítimas registradas pelas polícias estaduais, por UF, e taxa por 100 mil habitantes', natureza: 'CALCULADO', orgao: 'Ministério da Justiça e Segurança Pública', conjunto: 'Sinesp VDE', recurso: 'Bases anuais do Sinesp VDE, uma planilha por ano', url: g.fontes.sinesp.pagina, unidade: 'ocorrências ou vítimas; taxa por 100 mil habitantes', frequencia: 'Mensal, somada nos 12 meses do ano', capturadoEm: g.fontes.sinesp.capturado_em, formula: 'Taxa = contagem do ano ÷ população residente da UF (IBGE) × 100 mil', limitacoes: ['O Sinesp traz o que as polícias estaduais registraram e classificaram. Mudança de sistema ou de regra de classificação numa UF muda a série dela.', 'Ano que não chegou completo ao Sinesp aparece como ausência, não como queda.']}),
    sim: fichaDaFigura({...base, indicador: 'Óbitos por agressão, por UF de residência, e taxa por 100 mil habitantes', natureza: 'CALCULADO', orgao: 'Ministério da Saúde', conjunto: 'SIM, pelo TabNet do DATASUS', recurso: 'Óbitos por causas externas, por UF de residência', url: g.fontes.sim.pagina, unidade: 'óbitos; taxa por 100 mil habitantes', frequencia: 'Anual', capturadoEm: g.fontes.sim.capturado_em, limitacoes: ['O dado mais recente do SIM é preliminar e costuma subir quando se torna final.']}),
    ibge: fichaDaFigura({...base, indicador: 'População residente por UF, total e mulheres', natureza: 'ESTIMADO', orgao: 'IBGE', conjunto: g.fontes.ibge.rotulo, recurso: g.fontes.ibge.nome, url: g.fontes.ibge.url, unidade: 'pessoas', frequencia: 'Anual (população em 1º de julho)', capturadoEm: g.fontes.ibge.capturado_em, limitacoes: [`A população é a do IBGE, ${g.fontes.ibge.rotulo}, ${g.fontes.ibge.base}. Taxas publicadas antes, com as estimativas da época, diferem destas.`]}),
    siconfi: fichaDaFigura({...base, referencia: {inicio: String(g.fontes.siconfi.anos[0]), fim: String(g.fontes.siconfi.anos.at(-1))}, indicador: 'Despesa liquidada na função Segurança Pública dos governos estaduais, total, por habitante e sobre a despesa do estado', natureza: 'CALCULADO', orgao: 'Tesouro Nacional', conjunto: 'Siconfi, DCA Anexo I-E', recurso: `Conta “${g.fontes.siconfi.conta}”, coluna “${g.fontes.siconfi.coluna}”, exceto intraorçamentárias`, url: g.fontes.siconfi.pagina, unidade: 'reais correntes; reais por habitante; % da despesa liquidada', frequencia: 'Anual', capturadoEm: g.fontes.siconfi.capturado_em, formula: 'Por habitante = despesa da função ÷ população residente da UF (IBGE)', limitacoes: ['Valores em reais de cada ano, sem correção pela inflação.', 'No Distrito Federal, as polícias e o Corpo de Bombeiros são pagos pela União, fora do orçamento distrital.', 'Aposentadorias e pensões de policiais costumam ser pagas na função Previdência.']}),
  };
}

/** Frases inteiras da nota do grupo até o teto do lead (220 caracteres); o resto vai para o "Como interpretar" da figura. */
function dividirNota(nota: string): [string, string] {
  const frases = nota.match(/[^.]+\.(\s|$)/g)?.map((f) => f.trim()) ?? [nota];
  let lead = '';
  let i = 0;
  while (i < frases.length && (lead ? `${lead} ${frases[i]}` : frases[i]).length <= 220) { lead = lead ? `${lead} ${frases[i]}` : frases[i]; i++; }
  return lead ? [lead, frases.slice(i).join(' ')] : [nota, ''];
}

/**
 * Panorama (a entrada do tema) no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). Os quatro números passam à faixa do kit,
 * o destino mais procurado e os caminhos por pergunta ficam logo depois deles, a faixa das UFs no homicídio doloso vira figura (o desenho
 * de pontos de domínio, marcado como legado, com a tabela equivalente), o artefato "Uma morte, dois registros" segue aberto num bloco do
 * molde, o quadro das três dimensões vira o glossário da página e o método recolhido vira a fatia de método.
 */
function Panorama({g}: {g: GoldSeguranca}) {
  const kH = ultimoIndice(g, 'homicidio'), kS = ultimoIndiceSimFinal(g), kF = ultimoIndice(g, 'feminicidio');
  const iH = indicador(g, 'homicidio'), iF = indicador(g, 'feminicidio');
  const bH = serieBR(g, 'homicidio'), bS = serieBR(g, 'agressoes'), bF = serieBR(g, 'feminicidio');
  const amp = amplitude(g, 'homicidio', kH);
  const capturaSinesp = dataBr(g.fontes.sinesp.capturado_em);
  // faixa das 27 UFs na taxa de homicídio doloso do último ano: posição, nunca cor de julgamento
  const pontos = g.ufs.map((u) => ({sigla: u.sigla, nome: u.nome, taxa: serieUF(g, 'homicidio', u.sigla).taxa?.[kH] ?? null}));
  const max = Math.max(...pontos.map((p) => p.taxa ?? 0)) * 1.05;
  const x = (v: number) => 20 + (v / max) * 960;
  const anoComum = g.anos[kS];
  const dois: DadosDoisRegistros = {
    ano: anoComum,
    simSituacao: g.fontes.sim.situacao[String(anoComum)],
    ufs: g.ufs.map(({sigla, nome}) => ({sigla, nome})),
    valores: Object.fromEntries(['BR', ...g.ufs.map((u) => u.sigla)].map((uf) => {
      const h = g.series.homicidio[uf] as {n: (number | null)[]; situacao: string[]};
      const s = g.series.agressoes[uf] as {n: (number | null)[]};
      return [uf, {policia: h.situacao[kS] === 'ok' ? h.n[kS] : null, saude: s.n[kS], indeterminadas: seriePct(g, 'indeterminadas_pct', uf).pct[kS]}];
    })),
  };
  const kD = ultimoIndice(g, 'despesa_habitante'), bD = serieBR(g, 'despesa_habitante');
  const caminhos: {href: string; titulo: string; pergunta: string; prova: string}[] = [
    {href: 'letalidade', titulo: GRUPOS.letalidade.titulo, pergunta: GRUPOS.letalidade.pergunta, prova: contagemComUnidade(iH, bH.n[kH] as number) + ` de homicídio doloso em ${g.anos[kH]}`},
    {href: 'mulheres', titulo: GRUPOS.mulheres.titulo, pergunta: GRUPOS.mulheres.pergunta, prova: `${contagemComUnidade(iF, bF.n[kF] as number)} de feminicídio em ${g.anos[kF]}`},
    {href: 'patrimonio', titulo: GRUPOS.patrimonio.titulo, pergunta: GRUPOS.patrimonio.pergunta, prova: `${contagemComUnidade(indicador(g, 'roubo_veiculo'), serieBR(g, 'roubo_veiculo').n[ultimoIndice(g, 'roubo_veiculo')] as number)} de roubo de veículo em ${g.anos[ultimoIndice(g, 'roubo_veiculo')]}`},
    {href: 'resposta', titulo: GRUPOS.resposta.titulo, pergunta: GRUPOS.resposta.pergunta, prova: `${inteiro(serieBR(g, 'desaparecidos').n[ultimoIndice(g, 'desaparecidos')] as number)} registros de desaparecimento em ${g.anos[ultimoIndice(g, 'desaparecidos')]}`},
    {href: 'recursos', titulo: 'Recursos', pergunta: 'Quanto os governos estaduais gastam com segurança pública?', prova: `${reais(bD.taxa?.[kD] as number)} por habitante em ${g.anos[kD]}, ${bD.cobertura[kD]} governos estaduais`},
    {href: 'metodos', titulo: 'Dados e métodos', pergunta: 'O que cada fonte permite medir?', prova: `Sinesp, SIM, Siconfi e IBGE; ${g.ausencias.length} combinações de UF, ano e indicador tratadas como ausência`},
  ];
  const f = fichasSeguranca(g);
  return <PaginaPainel rota={ROTA} principal={false}
    abertura={{grupo: TEMAS_EFICIENCIA.seguranca.nome, acento: 'obee', titulo: 'Quanta violência cada estado registra?',
      lead: 'A mesma morte violenta é contada duas vezes: pela polícia e pela saúde. O painel mostra os dois registros em cada UF, em taxa por 100 mil habitantes.',
      recorte: {periodo: `${g.anos[0]} a ${g.anos[kH]}`, universo: '27 UFs', unidade: 'taxa por 100 mil habitantes', fonte: 'Sinesp (polícias), SIM (saúde), Siconfi (despesa) e IBGE (população)'},
      limite: 'a eficiência do Estado: recursos, atividade e resultados lado a lado ajudam a formular perguntas, e os dois registros de morte violenta não se somam nem se substituem.',
      fontesDatasSiglas: <p>Proteção e direitos. Sinesp VDE: Validador de Dados Estatísticos do Sistema Nacional de Informações de Segurança Pública. SIM: Sistema de Informações sobre Mortalidade. Siconfi: Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro. UF: unidade da Federação.</p>}}
    numeros={[
      {rotulo: 'Óbitos por agressão, registro de saúde', valor: bS.taxa?.[kS] as number, formato: 'decimal', casas: 1, unidade: 'por 100 mil habitantes', periodo: String(g.anos[kS]), recorte: `${inteiro(bS.n[kS] as number)} óbitos`, fonte: `SIM, Ministério da Saúde, dado final (extração de ${g.fontes.sim.extracao_final})`, natureza: 'CALCULADO', nota: 'UF de residência.'},
      {rotulo: 'Vítimas de homicídio doloso, registro policial', valor: bH.taxa?.[kH] as number, formato: 'decimal', casas: 1, unidade: 'por 100 mil habitantes', periodo: String(g.anos[kH]), recorte: `${inteiro(bH.n[kH] as number)} vítimas`, fonte: `Sinesp VDE, Ministério da Justiça, captura de ${capturaSinesp}`, natureza: 'CALCULADO', nota: 'Polícias estaduais, UF do fato.', ...(bH.variacao[kH] !== null ? {variacao: {valor: bH.variacao[kH] as number, base: `sobre ${g.anos[kH - 1]}`, unidade: '%' as const}} : {})},
      {rotulo: 'Vítimas de feminicídio', valor: bF.taxa?.[kF] as number, formato: 'decimal', casas: 2, unidade: 'por 100 mil mulheres', periodo: String(g.anos[kF]), recorte: `${inteiro(bF.n[kF] as number)} vítimas`, fonte: `Sinesp VDE, captura de ${capturaSinesp}`, natureza: 'CALCULADO', nota: 'Mulheres residentes pela Projeção do IBGE.'},
      {rotulo: 'Distância entre as UFs no homicídio doloso', valorTexto: `${numero(amp.min.taxa, 1)} a ${numero(amp.max.taxa, 1)}`, formato: 'texto', unidade: 'por 100 mil habitantes', periodo: String(g.anos[kH]), recorte: `de ${nomeUF(g, amp.min.uf)} a ${nomeUF(g, amp.max.uf)}`, fonte: `Sinesp VDE; ${amp.comparadas} UFs com dado no ano`, natureza: 'CALCULADO'},
    ]}
    notaNumeros="Os dois registros não se somam nem se substituem: contam a mesma realidade com regras diferentes. Bases revisadas pelas UFs depois da publicação."
    navegacaoLocal={<section aria-labelledby="caminhos-seguranca" className="mt-10 space-y-8">
      <Link href={`${ROTA}/estados`} prefetch={prefetchDoLink(`${ROTA}/estados`)} className="group block border-y border-linha py-5">
        <span className="rotulo block text-mineral">O destino mais procurado</span>
        <span className="t-h2 mt-2 block text-carvao group-hover:underline">Compare os estados →<SeloComConta href={`${ROTA}/estados`}/></span>
        <span className="t-meta mt-2 block max-w-2xl text-carvao-muted">Escolha o indicador e o ano: cada UF na taxa por 100 mil, a referência do Brasil, a posição, a distância e o motivo de cada ausência. {amp.comparadas} UFs comparadas em {g.anos[kH]}, homicídio doloso por 100 mil habitantes.</span>
      </Link>
      <div>
        <h2 id="caminhos-seguranca" className="t-h2 text-carvao">Escolha a pergunta que deseja explorar</h2>
        <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">Ao lado dos dois registros, os crimes patrimoniais, a busca por pessoas e a despesa dos governos estaduais.</p>
        <ul className="mt-4 grid gap-x-10 md:grid-cols-2">{caminhos.map((c) => <li key={c.href} className="border-t border-linha"><Link href={`${ROTA}/${c.href}`} prefetch={prefetchDoLink(`${ROTA}/${c.href}`)} className="group block min-h-[44px] py-5">
          <span className="rotulo block text-mineral">{c.titulo}</span>
          <span className="t-h3 mt-2 block text-carvao group-hover:underline">{c.pergunta}<SeloComConta href={`${ROTA}/${c.href}`}/></span>
          <span className="t-meta mt-2 block text-carvao-muted">{c.prova} →</span>
        </Link></li>)}</ul>
      </div>
    </section>}
    figuras={<>
      <FiguraAnalitica id="faixa-ufs" pergunta="Onde cada UF está na taxa de homicídio doloso?" subtitulo={`Homicídio doloso · vítimas por 100 mil habitantes · 27 UFs, ${g.anos[kH]}`} natureza="CALCULADO" idioma="pt"
        proveniencia={f.sinesp} complementares={[{rotulo: 'Sobre a população', p: f.ibge}]}
        comoInterpretar="Cada ponto é uma UF; a linha tracejada, o Brasil. A posição descreve onde a UF está entre as que têm dado."
        naoConcluir="A posição não diz se a situação de uma UF é boa ou ruim; diferenças pequenas podem vir de classificação e de registro, e UF sem dado no ano fica fora da faixa."
        tabela={{colunas: ['UF', 'Vítimas por 100 mil habitantes'], linhas: pontos.map((p) => [p.nome, p.taxa]), casas: [null, 1]}}
        complemento={<Link href={`${ROTA}/estados`} prefetch={prefetchDoLink(`${ROTA}/estados`)} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4">Comparar as UFs em qualquer indicador e ano →<SeloComConta href={`${ROTA}/estados`}/></Link>}>
        <div data-figura-legado="">
          <svg viewBox="0 0 1000 70" className="h-auto w-full" role="img" aria-label={`Taxa de homicídio doloso por 100 mil habitantes em ${g.anos[kH]}: de ${numero(amp.min.taxa, 1)} em ${nomeUF(g, amp.min.uf)} a ${numero(amp.max.taxa, 1)} em ${nomeUF(g, amp.max.uf)}; Brasil ${numero(bH.taxa?.[kH] as number, 1)}.`}>
            <line x1="20" x2="980" y1="38" y2="38" stroke="var(--cor-grade)" strokeWidth="1"/>
            <line x1={x(bH.taxa?.[kH] as number)} x2={x(bH.taxa?.[kH] as number)} y1="14" y2="58" stroke="var(--serie-referencia)" strokeDasharray="4 3" strokeWidth="2"/>
            <text x={x(bH.taxa?.[kH] as number)} y="10" textAnchor="middle" fontSize="14" fill="var(--cor-carvao-muted)">Brasil {numero(bH.taxa?.[kH] as number, 1)}</text>
            {pontos.filter((p) => p.taxa !== null).map((p) => <circle key={p.sigla} cx={x(p.taxa as number)} cy="38" r="7" fill="var(--cor-obee)" fillOpacity="0.55"><title>{`${p.nome}: ${numero(p.taxa as number, 1)}`}</title></circle>)}
            <text x="20" y="68" fontSize="13" fill="var(--cor-carvao-muted)">0</text>
            <text x="980" y="68" textAnchor="end" fontSize="13" fill="var(--cor-carvao-muted)">{numero(max, 0)} por 100 mil</text>
          </svg>
        </div>
      </FiguraAnalitica>
      <Recolhido id="dois-registros" aberto nivelTitulo={2} titulo="Uma morte, dois registros" resumo="Por que a polícia e a saúde chegam a números diferentes para a mesma violência, e qual dos dois serve para cada pergunta.">
        <div className="pb-6"><DoisRegistros dados={dois}/></div>
      </Recolhido>
    </>}
    notas={{id: 'tres-dimensoes', titulo: 'Três dimensões, três perguntas', itens: [
      {termo: 'Recursos', definicao: 'Quanto foi mobilizado?'},
      {termo: 'Atividade', definicao: 'O que foi registrado?'},
      {termo: 'Resultados', definicao: 'Qual violência é observada?'},
    ], nota: 'Colocar essas dimensões lado a lado ajuda a formular perguntas, mas não identifica, sozinho, a eficiência do Estado.'}}
    metodo={<>
      <p>Registros policiais: Sinesp VDE, planilhas anuais de {g.fontes.sinesp.anos[0]} a {g.fontes.sinesp.anos.at(-1)}, só as polícias estaduais, somadas por UF e ano{g.fontes.sinesp.ano_parcial ? `; ${g.fontes.sinesp.ano_parcial.ano} tem ${g.fontes.sinesp.ano_parcial.meses} meses e fica fora até fechar o ano` : ''}. Registros de óbito: SIM pelo TabNet, dados finais até {g.fontes.sim.final_ate}{Object.keys(g.fontes.sim.extracao_preliminar).length ? ` e ${listaNatural(Object.keys(g.fontes.sim.extracao_preliminar))} preliminar` : ''}. Despesa: Siconfi, DCA dos 27 governos estaduais. População: IBGE, {g.fontes.ibge.rotulo}, a mesma série para todos os anos.</p>
      <p>Ausência não vira zero: um ano inteiro sem registro numa UF onde o esperado seria de {g.regra_ausencia.limiar_ano} ou mais, ou meses zerados que, pela média do próprio ano, teriam chance menor que {numero(g.regra_ausencia.prob_meses_zerados * 100, 0)}% de acontecer por acaso, ficam sem valor publicado, com o motivo ao lado.</p>
      <p>Coleta mensal automática; a publicação só muda quando um número muda e os testes passam. Última captura: Sinesp em {capturaSinesp}, SIM em {dataBr(g.fontes.sim.capturado_em)}, Siconfi em {dataBr(g.fontes.siconfi.capturado_em)}.</p>
      <Link className="inline-flex min-h-[44px] items-center underline" href={`${ROTA}/metodos`}>Ler o método completo →</Link>
    </>}
  />;
}

/** H1 com até 60 caracteres (teto do molde): a pergunta do grupo, quando cabe; a pergunta inteira continua no título da figura. */
const TITULO_PAINEL: Partial<Record<Grupo, string>> = {mulheres: 'O que os registros mostram sobre violência contra mulheres?'};

/**
 * Os quatro grupos de indicadores nacionais (violência letal, mulheres e violência sexual, crimes patrimoniais, busca e atividade policial)
 * têm o mesmo corpo, o Explorador: o molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026) vale para os quatro. A pergunta e a nota
 * passam à abertura (as frases que cabem no lead; o resto vai para o "Como interpretar" da figura), e a variação com a tabela formam a figura.
 */
function GrupoNacional({g, slug}: {g: GoldSeguranca; slug: Grupo}) {
  const config = GRUPOS[slug];
  const linhas = linhasNacionais(g, slug as GrupoId);
  const anos = [...new Set(linhas.map((l) => l.ano))].sort();
  const temSim = linhas.some((l) => l.indicador.fonte === 'sim'), temSinesp = linhas.some((l) => l.indicador.fonte === 'sinesp');
  const [lead, resto] = dividirNota(config.nota);
  const f = fichasSeguranca(g);
  const principal = temSinesp ? f.sinesp : f.sim;
  const complementares = [...(temSinesp && temSim ? [{rotulo: 'Sobre o SIM', p: f.sim}] : []), {rotulo: 'Sobre a população', p: f.ibge}];
  return <PaginaPainel rota={`${ROTA}/${slug}`} principal={false}
    abertura={{grupo: TEMAS_EFICIENCIA.seguranca.nome, acento: 'obee', titulo: TITULO_PAINEL[slug] ?? config.pergunta, lead,
      recorte: {periodo: anos.length === 1 ? String(anos[0]) : `último ano publicado de cada fonte (${listaNatural(anos.map(String))})`, universo: 'Brasil, soma das 27 UFs', unidade: 'contagens, taxas e variação percentual', fonte: [temSinesp && 'Sinesp VDE (polícias estaduais)', temSim && 'SIM (saúde)'].filter(Boolean).join(' e ')},
      limite: 'a gravidade de um crime diante de outro: os volumes têm unidades e conceitos próprios, e a variação dos registros depende também da denúncia e da classificação.'}}
    figuras={<FiguraAnalitica id="variacao" pergunta={TITULO_PAINEL[slug] ? config.pergunta : `${config.titulo}: quanto cada indicador variou?`} subtitulo="Variação sobre o ano anterior · % · Brasil, último ano publicado de cada indicador" natureza="CALCULADO" idioma="pt"
      proveniencia={principal} complementares={complementares}
      comoInterpretar={resto || undefined}
      naoConcluir="A variação compara cada indicador com ele mesmo no ano anterior; a ordem não representa gravidade, e ano sem as 27 UFs fica sem comparação, nunca como queda."
      tabela={{naFigura: 'logo abaixo das barras, à vista, com volume, taxa nacional, variação, cobertura e o link da comparação por UF de cada indicador.'}}>
      <Explorador grupo={slug} config={config} linhas={linhas} rota={ROTA}/>
    </FiguraAnalitica>}
    metodo={<><p>Contagens, taxas, variações e coberturas vêm prontas da base do painel; a página só escolhe o recorte. A variação sobre o ano anterior é calculada só quando as 27 UFs têm dado nos dois anos. Fontes: Sinesp VDE, registros das polícias estaduais; SIM, registros de óbito; população do IBGE, {g.fontes.ibge.rotulo}.</p><p>A lista completa de ausências por indicador, UF e ano, as regras de cada medida e os arquivos estão em <Link className="underline" href={`${ROTA}/metodos`}>Dados e métodos</Link>.</p></>}
  />;
}

/**
 * Comparação por estado no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026); os outros capítulos seguem como estão. O
 * parágrafo de abertura se divide entre o lead (o que se compara) e o "como interpretar" da figura (o que o leitor escolhe e como ler a
 * posição); a comparação e a conta da polícia com a saúde viram duas FiguraAnalitica, cada uma com as fichas das fontes que usa, e o
 * "Antes de comparar" vira o ParaLer da página. Anos, períodos e datas continuam vindo da gold.
 */
function Estados({g}: {g: GoldSeguranca}) {
  const p = pacoteEstados(g, (i) => i.grupo !== 'recursos');
  const ausH = g.ausencias.filter((a) => a.indicador === 'homicidio');
  const anosAusentesH = [...new Set(ausH.map((a) => a.ano))].sort();
  const ufsAusentesH = [...new Set(ausH.map((a) => a.uf))].sort();
  const {sinesp, sim, ibge} = fichasSeguranca(g);
  return <PaginaPainel rota={`${ROTA}/estados`} principal={false}
    abertura={{grupo: TEMAS_EFICIENCIA.seguranca.nome, acento: 'obee', titulo: 'A violência registrada é comparável entre os estados?',
      lead: 'Em taxa por 100 mil habitantes, sim, dentro de cada registro: a polícia de cada estado classifica e envia os seus números, e a saúde codifica a causa de cada óbito.',
      recorte: {periodo: `${g.anos[0]} a ${g.anos.at(-1)}`, universo: '27 UFs', unidade: 'taxa por 100 mil habitantes', fonte: 'Sinesp (polícias), SIM (saúde) e IBGE (população)'},
      limite: 'se a situação de uma UF é boa ou ruim: a posição e a distância para o Brasil descrevem onde ela está entre as que têm dado, e diferenças pequenas podem vir de classificação e de registro.',
      fontesDatasSiglas: <><p>{p.rotuloFonte.sinesp}; {p.rotuloFonte.sim}; população: {p.rotuloFonte.ibge}, {g.fontes.ibge.base}.</p><p>Sinesp VDE: Validador de Dados Estatísticos do Sistema Nacional de Informações de Segurança Pública. SIM: Sistema de Informações sobre Mortalidade. UF: unidade da Federação.</p></>}}
    figuras={<>
      <FiguraAnalitica id="por-estado" pergunta="Como cada UF se compara à taxa do Brasil?" subtitulo="Indicador escolhido · taxa por 100 mil habitantes ou contagem · 27 UFs, ano escolhido" natureza="CALCULADO" idioma="pt"
        proveniencia={sinesp} complementares={[{rotulo: 'Sobre o SIM', p: sim}, {rotulo: 'Sobre a população', p: ibge}]}
        comoInterpretar="Escolha o indicador, o ano e uma UF. A referência é o Brasil do mesmo ano; a posição e a distância descrevem onde a UF está, não se está bem ou mal."
        naoConcluir="A posição descreve onde a UF está entre as que têm dado, não se a situação é boa ou ruim; diferenças pequenas podem vir de classificação e de registro."
        tabela={{naFigura: 'logo abaixo do gráfico, com contagem, denominador, taxa, diferença para o Brasil, posição e situação de cada UF.'}}>
        <PorEstado pacote={p} inicial="homicidio"/>
      </FiguraAnalitica>
      <FiguraAnalitica id="policia-e-saude" pergunta="Polícia e saúde contam de formas diferentes" subtitulo="Homicídio doloso (Sinesp, UF do fato) e óbito por agressão (SIM, UF de residência) · por 100 mil habitantes · 27 UFs" natureza="CALCULADO" idioma="pt"
        proveniencia={sim} complementares={[{rotulo: 'Sobre o Sinesp', p: sinesp}, {rotulo: 'Sobre a população', p: ibge}]}
        comoInterpretar="Vítimas de homicídio doloso registradas pela polícia (UF do fato) e óbitos por agressão no SIM (UF de residência), na mesma escala. Onde a saúde classifica muitas mortes como de intenção indeterminada, o SIM capta menos; onde a polícia deixa de classificar, o registro policial capta menos."
        naoConcluir="A diferença entre os dois registros não é erro de um deles, porque cada um conta uma coisa: a razão varia por UF e não mede qual registro está certo."
        tabela={{naFigura: 'logo abaixo do gráfico, com as duas taxas e a razão entre os registros de cada UF.'}}>
        <PoliciaSaude pacote={pacotePoliciaSaude(g)}/>
      </FiguraAnalitica>
    </>}
    notas={{id: 'antes-de-comparar', titulo: 'Antes de comparar', itens: [
      ...(anosAusentesH.length > 0 ? [{termo: 'Ausência não é queda', definicao: <>Em {listaNatural(anosAusentesH.map(String))}, o homicídio doloso de {ufsAusentesH.length === 1 ? 'uma UF' : `${ufsAusentesH.length} UFs`} ({listaNatural(ufsAusentesH)}) não chegou completo ao Sinesp; esses anos aparecem como ausência, não como queda. Outros indicadores têm ausências próprias, listadas no método.</>}] : []),
      {termo: 'Registro policial', definicao: 'O Sinesp traz o que as polícias estaduais registraram e classificaram. Mudança de sistema ou de regra de classificação numa UF muda a série dela.'},
      {termo: 'População', definicao: `A população é a do IBGE, ${g.fontes.ibge.rotulo}, ${g.fontes.ibge.base}. Taxas publicadas antes, com as estimativas da época, diferem destas.`},
      {termo: 'Dado preliminar do SIM', definicao: 'O dado mais recente do SIM é preliminar e costuma subir quando se torna final.'},
    ], nota: <Link className="inline-flex min-h-[44px] items-center underline" href={`${ROTA}/metodos`}>Ver a lista de ausências e o método →</Link>}}
    metodo={<><p>Contagens, taxas, posições, diferenças e coberturas vêm prontas da base do painel, gerada a partir das fontes abaixo; a página só escolhe o recorte. {p.rotuloFonte.sinesp}; {p.rotuloFonte.sim}; população: {p.rotuloFonte.ibge}.</p><p>A lista completa de ausências por indicador, UF e ano, as regras de cada medida e os arquivos estão em <Link className="underline" href={`${ROTA}/metodos`}>Dados e métodos</Link>.</p></>}
  />;
}

/**
 * Recursos no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os três números na faixa do kit, a comparação por UF como
 * figura (o mesmo PorEstado da comparação por estado), a tabela do peso na despesa como TabelaDados à vista (a tabela à mão de antes era
 * uma região rolável sem foco) e "O que esta despesa não mostra" como o glossário da página, com a frase de limite na abertura.
 */
function Recursos({g}: {g: GoldSeguranca}) {
  const rec = pacoteEstados(g, (i) => i.grupo === 'recursos');
  const k = ultimoIndice(g, 'despesa_habitante'), br = serieBR(g, 'despesa_habitante');
  const part = seriePct(g, 'despesa_participacao', 'BR');
  const f = fichasSeguranca(g);
  const ano = String(g.anos[k]);
  const fonte = `Siconfi, Tesouro Nacional, DCA Anexo I-E, captura de ${dataBr(g.fontes.siconfi.capturado_em)}`;
  const peso = [...g.ufs].map((u) => ({u, v: seriePct(g, 'despesa_participacao', u.sigla).pct[k]})).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  return <PaginaPainel rota={`${ROTA}/recursos`} principal={false}
    abertura={{grupo: TEMAS_EFICIENCIA.seguranca.nome, acento: 'obee', titulo: 'Quanto os governos estaduais gastam com segurança pública?',
      lead: 'Despesa liquidada na função Segurança Pública declarada por cada estado e pelo DF ao Tesouro Nacional, na Declaração de Contas Anuais. É o gasto do governo estadual; a despesa da União e a dos municípios ficam de fora.',
      recorte: {periodo: `${g.anos[0]} a ${ano}`, universo: 'governos estaduais e do DF', unidade: 'reais de cada ano', fonte: `Siconfi, DCA Anexo I-E; população: IBGE, ${g.fontes.ibge.rotulo}`},
      limite: 'custo por crime evitado nem classificação de eficiência: gasto, atividade e resultado ficam lado a lado, sem relação de causa, e os valores não são corrigidos pela inflação.',
      fontesDatasSiglas: <p>Financiamento. DCA: Declaração de Contas Anuais. Siconfi: Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro. DF: Distrito Federal.</p>}}
    numeros={[
      {rotulo: 'Despesa dos governos estaduais por habitante', valor: br.taxa?.[k] as number, formato: 'reais', casas: 2, unidade: 'por habitante', periodo: ano, recorte: `${br.cobertura[k]} governos`, fonte, natureza: 'CALCULADO', nota: 'Reais do próprio ano.'},
      {rotulo: 'Despesa total na função', valorTexto: contagemComUnidade(indicador(g, 'despesa_habitante'), br.n[k] as number), formato: 'texto', unidade: '', periodo: ano, fonte, natureza: 'CALCULADO', nota: `Soma dos governos com DCA em ${ano}.`},
      {rotulo: 'Peso na despesa dos estados', valor: part.pct[k] as number, formato: 'percentual', casas: 1, unidade: 'da despesa liquidada', periodo: ano, fonte, natureza: 'CALCULADO', nota: 'Exceto intraorçamentária.'},
    ]}
    notaNumeros={`População: IBGE, ${g.fontes.ibge.rotulo}.`}
    figuras={<FiguraAnalitica id="por-estado" pergunta="Quanto cada governo estadual gasta?" subtitulo="Despesa na função Segurança Pública · reais por habitante ou total · 27 UFs, ano escolhido" natureza="CALCULADO" idioma="pt"
      proveniencia={f.siconfi} complementares={[{rotulo: 'Sobre a população', p: f.ibge}]}
      comoInterpretar="Escolha o indicador, o ano e uma UF. Compare UFs no mesmo ano; na série, parte do aumento é inflação."
      naoConcluir="Gastar mais por habitante não indica mais ou menos segurança: o gasto não é corrigido pela inflação, o DF tem as polícias pagas pela União e as aposentadorias de policiais ficam em outra função."
      tabela={{naFigura: 'logo abaixo do gráfico, com o valor, o denominador, a posição e a situação de cada UF.'}}>
      <PorEstado pacote={rec} inicial="despesa_habitante"/>
    </FiguraAnalitica>}
    tabelas={<TabelaDados recolhida={false} id="peso-na-despesa" tituloVisivel={`Peso da segurança pública na despesa de cada estado, ${ano}`}
      titulo={`Despesa liquidada na função 06 sobre a despesa liquidada total, por UF, ${ano}`} colunas={['UF', '% da despesa do estado']} linhas={peso.map(({u, v}) => [u.nome, v])} casas={[null, 1]}
      ausencia={{'% da despesa do estado': 'sem dado'}} limite={peso.length} nota={`${fonte}; ordem decrescente do peso.`}/>}
    notas={{id: 'o-que-nao-mostra', titulo: 'O que esta despesa não mostra', itens: [
      {termo: 'Distrito Federal', definicao: 'No Distrito Federal, as polícias Civil e Militar e o Corpo de Bombeiros são pagos pela União, pelo Fundo Constitucional do DF, fora do orçamento distrital. A despesa do DF aqui não inclui esse gasto.'},
      {termo: 'Aposentadorias e pensões', definicao: 'Aposentadorias e pensões de policiais costumam ser pagas na função Previdência, e não aparecem aqui. Estados classificam de formas diferentes o que vai para cada subfunção.'},
      {termo: 'Valores de cada ano', definicao: 'Valores em reais de cada ano, sem correção pela inflação: compare UFs no mesmo ano; na série, parte do aumento é inflação.'},
      {termo: 'Sem relação de causa', definicao: 'Não calculamos custo por crime evitado nem classificação de eficiência: gasto, atividade e resultado ficam lado a lado, sem relação de causa.'},
    ]}}
    metodo={<><p>Despesa: Siconfi, DCA dos governos estaduais, Anexo I-E, conta “{g.fontes.siconfi.conta}”, coluna “{g.fontes.siconfi.coluna}”, exceto intraorçamentárias, de {g.fontes.siconfi.anos[0]} a {g.fontes.siconfi.anos.at(-1)}, reais de cada ano. Captura de {dataBr(g.fontes.siconfi.capturado_em)}. População: IBGE, {g.fontes.ibge.rotulo}.</p><p>Regras de cada medida e arquivos em <Link className="underline" href={`${ROTA}/metodos`}>Dados e métodos</Link>.</p></>}
  />;
}

function Metodos({g}: {g: GoldSeguranca}) {
  const porInd = new Map<string, {sem: number; inc: number; ufs: Set<string>; anos: Set<number>}>();
  for (const a of g.ausencias) {
    const x = porInd.get(a.indicador) ?? {sem: 0, inc: 0, ufs: new Set<string>(), anos: new Set<number>()};
    if (a.situacao === 'sem_registro') x.sem++; else x.inc++;
    x.ufs.add(a.uf); x.anos.add(a.ano);
    porInd.set(a.indicador, x);
  }
  const s = g.fontes;
  const ultimoArquivo = s.sinesp.arquivos[String(s.sinesp.anos.at(-1))];
  return <section className="mt-8">
    <p className="rotulo text-obee-dark">Reproduzir e entender</p>
    <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Dados, conceitos e limites</h1>
    <p className="mt-4 max-w-3xl leading-relaxed">Quatro fontes oficiais, coletadas todo mês por rotina automática e publicadas só quando os números mudam e as validações passam. Cada número do painel vem da mesma base publicada abaixo; nada é digitado à mão.</p>
    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
      <a className="inline-flex min-h-[44px] items-center text-obee-dark underline" download href={HREF_CSV}>Baixar taxas por UF · CSV<SeloComConta href={HREF_CSV}/></a>
      <a className="inline-flex min-h-[44px] items-center text-obee-dark underline" download href={HREF_GOLD}>Baixar base e metadados · JSON<SeloComConta href={HREF_GOLD}/></a>
    </div>
    <div className="mt-8 grid gap-8 md:grid-cols-2">
      <section className="border-t border-linha pt-5"><h2 className="font-serif text-2xl">Registros policiais: Sinesp VDE</h2><p className="mt-3 leading-relaxed">Planilhas anuais do Validador de Dados Estatísticos do Ministério da Justiça, de {s.sinesp.anos[0]} a {s.sinesp.anos.at(-1)}, com registros por município ou UF e mês do fato. Entram só as linhas das polícias estaduais (abrangência “{s.sinesp.abrangencia}”); as da Polícia Federal e da Polícia Rodoviária Federal ficam de fora por terem outro perímetro. Vítimas para crimes contra a pessoa; ocorrências para crimes patrimoniais; registros para armas e mandados.{s.sinesp.ano_parcial && ` ${s.sinesp.ano_parcial.ano} tem ${s.sinesp.ano_parcial.meses} meses na planilha e só entra quando fechar o ano.`} Captura de {dataBr(s.sinesp.capturado_em)}; a planilha mais recente tem {inteiro(ultimoArquivo.linhas)} linhas.</p><p className="mt-3 flex flex-wrap gap-x-5"><a className="inline-flex min-h-[44px] items-center text-obee-dark underline" href={s.sinesp.pagina}>Página das planilhas</a><a className="inline-flex min-h-[44px] items-center text-obee-dark underline" href={s.sinesp.notas}>Notas dos gestores estaduais</a></p></section>
      <section className="border-t border-linha pt-5"><h2 className="font-serif text-2xl">Registros de óbito: SIM</h2><p className="mt-3 leading-relaxed">Óbitos por causas externas pelo TabNet do DATASUS, por UF de residência e ano do óbito. Agressões são a causa básica de X85 a Y09 da CID-10; intenção indeterminada, de Y10 a Y34. Dados finais até {s.sim.final_ate} (extração de {s.sim.extracao_final}){Object.entries(s.sim.extracao_preliminar).map(([a, d]) => `; ${a} preliminar (extração de ${d})`).join('')}{Object.keys(s.sim.previas_fora).length ? `; ${listaNatural(Object.keys(s.sim.previas_fora))} é prévia e fica fora` : ''}. Intervenções legais (Y35 e Y36) não entram nas agressões.</p><p className="mt-3"><a className="inline-flex min-h-[44px] items-center text-obee-dark underline" href={s.sim.pagina}>Tabela do TabNet</a></p></section>
      <section className="border-t border-linha pt-5"><h2 className="font-serif text-2xl">Despesa: Siconfi</h2><p className="mt-3 leading-relaxed">Declaração de Contas Anuais dos 27 governos estaduais, Anexo I-E, conta “{s.siconfi.conta}”, coluna “{s.siconfi.coluna}”, exceto intraorçamentárias, de {s.siconfi.anos[0]} a {s.siconfi.anos.at(-1)}. Reais de cada ano. Captura de {dataBr(s.siconfi.capturado_em)}.</p><p className="mt-3"><a className="inline-flex min-h-[44px] items-center text-obee-dark underline" href={s.siconfi.pagina}>API de dados abertos do Siconfi</a></p></section>
      <section className="border-t border-linha pt-5"><h2 className="font-serif text-2xl">População: IBGE</h2><p className="mt-3 leading-relaxed">{g.fontes.ibge.rotulo}: residentes em 1º de julho por UF e sexo, a mesma série para todos os anos, {g.fontes.ibge.base}. A taxa de feminicídio e a de óbito de mulheres por agressão usam as mulheres residentes. Captura de {dataBr(s.ibge.capturado_em)}.</p><p className="mt-3 flex flex-wrap gap-x-5"><a className="inline-flex min-h-[44px] items-center text-obee-dark underline" href={s.ibge.url}>Planilha da projeção</a><a className="inline-flex min-h-[44px] items-center text-obee-dark underline" href={s.ibge.metodo}>Relatório metodológico</a></p></section>
    </div>
    <section className="mt-10 border-t border-linha pt-6"><h2 className="font-serif text-2xl">Ausência não é zero</h2>
      <p className="mt-3 max-w-3xl leading-relaxed">A planilha do Sinesp traz zero tanto para “nenhum caso” quanto para “a UF não enviou”. O painel separa os dois casos por uma regra fixa: um ano com os 12 meses zerados, quando o esperado pela taxa nacional do ano ou pela média da própria UF seria de {g.regra_ausencia.limiar_ano} registros ou mais, é “{ROTULO_SITUACAO.sem_registro.toLowerCase()}”; meses zerados num ano com registros tornam o ano “{ROTULO_SITUACAO.incompleto.toLowerCase()}” quando, pela média mensal do próprio ano, a chance de tantos meses zerados acontecer por acaso seria menor que {numero(g.regra_ausencia.prob_meses_zerados * 100, 0)}% (um mês zerado num ano com média de 12 por mês é ausência; num ano com média de 4, pode ser zero de verdade). Nos dois casos o total do ano não é publicado, a UF sai da ordem e da referência nacional, e o motivo aparece ao lado. A regra pode marcar como ausência um zero verdadeiro, ou deixar passar um mês não enviado num ano de poucos casos; por isso o motivo traz o número esperado ou a média do ano.</p>
      <div className="mt-5 overflow-x-auto border-y border-linha"><table className="w-full min-w-[640px] text-sm"><caption className="sr-only">Combinações de UF e ano sem valor publicado, por indicador do Sinesp.</caption>
        <thead className="bg-obee-suave"><tr><th scope="col" className="p-3 text-left">Indicador</th><th scope="col" className="p-3 text-right">Sem registro no ano</th><th scope="col" className="p-3 text-right">Ano incompleto</th><th scope="col" className="p-3 text-left">Anos afetados</th></tr></thead>
        <tbody>{g.indicadores.filter((i) => i.fonte === 'sinesp').map((i) => { const x = porInd.get(i.id); return <tr key={i.id} className="border-t border-linha"><th scope="row" className="p-3 text-left font-medium">{i.titulo}</th><td className="p-3 text-right tabular-nums">{x?.sem ?? 0}</td><td className="p-3 text-right tabular-nums">{x?.inc ?? 0}</td><td className="p-3">{x ? listaNatural([...x.anos].sort().map(String)) : 'nenhum'}</td></tr>; })}</tbody>
      </table></div>
    </section>
    <div className="mt-10 grid gap-8 md:grid-cols-2">{[
      ['Registros policiais e registros de saúde', 'O Sinesp classifica registros enviados pelas secretarias estaduais de segurança, pela UF e pelo mês do fato. O SIM registra a causa de cada morte na saúde, pela UF de residência e pelo ano do óbito. Homicídio doloso, óbito por agressão e mortes violentas intencionais são conceitos diferentes; o painel não os soma nem os emenda numa série única.'],
      ['Quebras de série', 'Algumas UFs deixaram de enviar eventos ao Sinesp em parte dos anos, sobretudo no começo da série; a tabela acima diz em quais indicadores e anos, e cada ausência aparece com o motivo na comparação por UF. As UFs revisam os números depois da publicação, e cada coleta traz a versão do dia. No SIM, o ano preliminar muda quando se torna final.'],
      ['Taxa, posição e distância', 'Taxa por 100 mil habitantes (ou mulheres) com a população do mesmo ano. A referência é o Brasil: soma das UFs com dado sobre a população dessas UFs, com a cobertura ao lado. Posição na ordem decrescente entre as UFs com dado; distância em pontos da mesma taxa. Nenhuma ordem é nota: diferenças vêm também de registro e de classificação.'],
      ['O que fica de fora', 'Tempo de atendimento, elucidação de crimes, efetivo policial, vitimização não registrada, recortes por raça e idade e dados por município ainda não estão no painel. Medidas de atividade (armas apreendidas, mandados cumpridos, agentes do Estado mortos, roubos de carga e a instituições financeiras) aparecem sem taxa por habitante.'],
    ].map(([t, x]) => <section key={t} className="border-t border-linha pt-5"><h2 className="font-serif text-2xl">{t}</h2><p className="mt-3 leading-relaxed">{x}</p></section>)}</div>
    <p className="mt-8 max-w-3xl text-sm text-carvao-muted">Versão da base {g.versao}, impressão digital dos dados {g.hash_dados.slice(0, 12)}. Rotina: pipeline/seguranca no repositório da plataforma.</p>
  </section>;
}

export default function Pagina({params}: {params: {painel?: string[]}}) {
  const slug = params.painel?.[0] ?? '';
  if ((params.painel?.length ?? 0) > 1 || !rotas.includes(slug)) notFound();
  const g = goldSeguranca();
  if (slug in GRUPOS) return <GrupoNacional g={g} slug={slug as Grupo}/>;
  if (slug === 'estados') return <Estados g={g}/>;
  if (slug === 'recursos') return <Recursos g={g}/>;
  if (slug === 'metodos') return <Metodos g={g}/>;
  return <Panorama g={g}/>;
}
