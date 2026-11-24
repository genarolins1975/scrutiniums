import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Explorador} from '@/components/eficiencia/seguranca/Explorador';
import {Panorama} from '@/components/eficiencia/seguranca/Panorama';
import {fichasSeguranca} from '@/components/eficiencia/seguranca/fichas';
import {PorEstado, PoliciaSaude} from '@/components/eficiencia/seguranca/PorEstado';
import {SeloComConta} from '@/components/acesso/SeloComConta';
import {goldSeguranca, GRUPOS, HREF_CSV, HREF_GOLD, indicador, linhasNacionais, pacoteEstados, pacotePoliciaSaude, ROTA, serieBR, seriePct, ultimoIndice} from '@/lib/eficiencia/seguranca/dados';
import {contagemComUnidade, dataBr, inteiro, listaNatural, numero, reais, ROTULO_SITUACAO} from '@/lib/eficiencia/seguranca/formato';
import type {GoldSeguranca, GrupoId} from '@/lib/eficiencia/seguranca/tipos';
import {FiguraAnalitica, PaginaPainel} from '@/components/painel';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';

type Grupo = keyof typeof GRUPOS;
const rotas = ['', 'estados', 'letalidade', 'mulheres', 'patrimonio', 'resposta', 'recursos', 'metodos'];
const TITULOS: Record<string, string> = {'': 'Segurança pública', estados: 'Segurança pública por estado', recursos: 'Recursos da segurança pública', metodos: 'Segurança pública: dados e métodos'};
export function generateStaticParams() { return rotas.map((r) => ({painel: r ? [r] : []})); }
export function generateMetadata({params}: {params: {painel?: string[]}}): Metadata {
  const slug = params.painel?.[0] ?? '';
  return {title: `${GRUPOS[slug as Grupo]?.titulo ?? TITULOS[slug] ?? 'Segurança pública'}`, description: 'Violência registrada pela polícia e pela saúde em cada estado, em taxa por 100 mil habitantes, e a despesa estadual com segurança pública, com fontes, períodos e ausências explícitas.'};
}

function Fonte({children, dd = false}: {children: React.ReactNode; dd?: boolean}) { const T = dd ? 'dd' : 'p'; return <T className="mt-3 text-xs leading-relaxed text-carvao-muted">{children}</T>; }

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
    abertura={{grupo: TEMAS_EFICIENCIA.seguranca.contexto, acento: 'obee', titulo: 'A violência registrada é comparável entre os estados?',
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

function Recursos({g}: {g: GoldSeguranca}) {
  const rec = pacoteEstados(g, (i) => i.grupo === 'recursos');
  const k = ultimoIndice(g, 'despesa_habitante'), br = serieBR(g, 'despesa_habitante');
  const part = seriePct(g, 'despesa_participacao', 'BR');
  return <section className="mt-8">
    <p className="rotulo text-obee-dark">Financiamento · governos estaduais · {g.anos[0]} a {g.anos[k]}</p>
    <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Quanto os governos estaduais gastam com segurança pública?</h1>
    <p className="mt-4 max-w-3xl leading-relaxed">Despesa liquidada na função Segurança Pública declarada por cada estado e pelo DF ao Tesouro Nacional, na Declaração de Contas Anuais. É o gasto do governo estadual; a despesa da União e a dos municípios ficam de fora.</p>
    <dl className="mt-8 grid border-y border-linha sm:grid-cols-3">
      <div className="py-6 sm:pr-5"><dt className="text-sm">Despesa dos governos estaduais por habitante</dt><dd className="mt-3 font-serif text-4xl tabular-nums">{reais(br.taxa?.[k] as number)}</dd><dd className="mt-2 text-sm">em {g.anos[k]}, reais do próprio ano · {br.cobertura[k]} governos</dd></div>
      <div className="border-t border-linha py-6 sm:border-l sm:border-t-0 sm:px-5"><dt className="text-sm">Despesa total na função</dt><dd className="mt-3 font-serif text-4xl tabular-nums">{contagemComUnidade(indicador(g, 'despesa_habitante'), br.n[k] as number)}</dd><dd className="mt-2 text-sm">soma dos governos com DCA em {g.anos[k]}</dd></div>
      <div className="border-t border-linha py-6 sm:border-l sm:border-t-0 sm:pl-5"><dt className="text-sm">Peso na despesa dos estados</dt><dd className="mt-3 font-serif text-4xl tabular-nums">{numero(part.pct[k] as number, 1)}%</dd><dd className="mt-2 text-sm">da despesa liquidada, exceto intraorçamentária</dd></div>
    </dl>
    <Fonte>Siconfi, Tesouro Nacional, DCA Anexo I-E, captura de {dataBr(g.fontes.siconfi.capturado_em)}; população: IBGE, {g.fontes.ibge.rotulo}.</Fonte>
    <div className="mt-10"><PorEstado pacote={rec} inicial="despesa_habitante"/></div>
    <section className="mt-12">
      <h2 className="font-serif text-2xl">Peso da segurança pública na despesa de cada estado, {g.anos[k]}</h2>
      <div className="mt-4 overflow-x-auto border-y border-linha"><table className="w-full min-w-[480px] text-sm"><caption className="sr-only">Despesa liquidada na função 06 sobre a despesa liquidada total, por UF, {g.anos[k]}.</caption>
        <thead className="bg-obee-suave"><tr><th scope="col" className="p-3 text-left">UF</th><th scope="col" className="p-3 text-right">% da despesa do estado</th></tr></thead>
        <tbody>{[...g.ufs].map((u) => ({u, v: seriePct(g, 'despesa_participacao', u.sigla).pct[k]})).sort((a, b) => (b.v ?? -1) - (a.v ?? -1)).map(({u, v}) => <tr key={u.sigla} className="border-t border-linha"><th scope="row" className="p-3 text-left font-medium">{u.nome}</th><td className="p-3 text-right tabular-nums">{v === null ? 'sem dado' : `${numero(v, 1)}%`}</td></tr>)}</tbody>
      </table></div>
    </section>
    <section className="mt-10 border-l-4 border-obee pl-5"><h2 className="font-serif text-2xl">O que esta despesa não mostra</h2><ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 leading-relaxed">
      <li>No Distrito Federal, as polícias Civil e Militar e o Corpo de Bombeiros são pagos pela União, pelo Fundo Constitucional do DF, fora do orçamento distrital. A despesa do DF aqui não inclui esse gasto.</li>
      <li>Aposentadorias e pensões de policiais costumam ser pagas na função Previdência, e não aparecem aqui. Estados classificam de formas diferentes o que vai para cada subfunção.</li>
      <li>Valores em reais de cada ano, sem correção pela inflação: compare UFs no mesmo ano; na série, parte do aumento é inflação.</li>
      <li>Não calculamos custo por crime evitado nem classificação de eficiência: gasto, atividade e resultado ficam lado a lado, sem relação de causa.</li>
    </ul></section>
  </section>;
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
  if (slug in GRUPOS) return <Explorador grupo={slug} config={GRUPOS[slug as Grupo]} linhas={linhasNacionais(g, slug as GrupoId)} rota={ROTA} anos={g.anos}/>;
  if (slug === 'estados') return <Estados g={g}/>;
  if (slug === 'recursos') return <Recursos g={g}/>;
  if (slug === 'metodos') return <Metodos g={g}/>;
  return <Panorama g={g} rota={ROTA}/>;
}
