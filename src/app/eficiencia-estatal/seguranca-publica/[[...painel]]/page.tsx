import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Explorador} from '@/components/eficiencia/seguranca/Explorador';
import {DoisRegistros, type DadosDoisRegistros} from '@/components/eficiencia/seguranca/DoisRegistros';
import {PorEstado, PoliciaSaude} from '@/components/eficiencia/seguranca/PorEstado';
import {SeloComConta} from '@/components/acesso/SeloComConta';
import {prefetchDoLink} from '@/lib/rotasPublicas';
import {amplitude, goldSeguranca, GRUPOS, HREF_CSV, HREF_GOLD, indicador, linhasNacionais, nomeUF, pacoteEstados, ROTA, serieBR, seriePct, serieUF, ultimoIndice, ultimoIndiceSimFinal} from '@/lib/eficiencia/seguranca/dados';
import {contagemComUnidade, dataBr, inteiro, listaNatural, numero, percentualVariacao, reais, ROTULO_SITUACAO} from '@/lib/eficiencia/seguranca/formato';
import type {GoldSeguranca, GrupoId} from '@/lib/eficiencia/seguranca/tipos';

type Grupo = keyof typeof GRUPOS;
const rotas = ['', 'estados', 'letalidade', 'mulheres', 'patrimonio', 'resposta', 'recursos', 'metodos'];
const TITULOS: Record<string, string> = {'': 'Segurança pública', estados: 'Segurança pública por estado', recursos: 'Recursos da segurança pública', metodos: 'Segurança pública: dados e métodos'};
export function generateStaticParams() { return rotas.map((r) => ({painel: r ? [r] : []})); }
export function generateMetadata({params}: {params: {painel?: string[]}}): Metadata {
  const slug = params.painel?.[0] ?? '';
  return {title: `${GRUPOS[slug as Grupo]?.titulo ?? TITULOS[slug] ?? 'Segurança pública'} · OBEE`, description: 'Violência registrada pela polícia e pela saúde em cada estado, em taxa por 100 mil habitantes, e a despesa estadual com segurança pública, com fontes, períodos e ausências explícitas.'};
}

function Fonte({children, dd = false}: {children: React.ReactNode; dd?: boolean}) { const T = dd ? 'dd' : 'p'; return <T className="mt-3 text-xs leading-relaxed text-carvao-muted">{children}</T>; }

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
    {href: 'estados', titulo: 'Por estado', pergunta: 'Como cada UF se compara à taxa do Brasil?', prova: `${amp.comparadas} UFs comparadas em ${g.anos[kH]}, homicídio doloso por 100 mil habitantes`},
    {href: 'letalidade', titulo: GRUPOS.letalidade.titulo, pergunta: GRUPOS.letalidade.pergunta, prova: contagemComUnidade(iH, bH.n[kH] as number) + ` de homicídio doloso em ${g.anos[kH]}`},
    {href: 'mulheres', titulo: GRUPOS.mulheres.titulo, pergunta: GRUPOS.mulheres.pergunta, prova: `${contagemComUnidade(iF, bF.n[kF] as number)} de feminicídio em ${g.anos[kF]}`},
    {href: 'patrimonio', titulo: GRUPOS.patrimonio.titulo, pergunta: GRUPOS.patrimonio.pergunta, prova: `${contagemComUnidade(indicador(g, 'roubo_veiculo'), serieBR(g, 'roubo_veiculo').n[ultimoIndice(g, 'roubo_veiculo')] as number)} de roubo de veículo em ${g.anos[ultimoIndice(g, 'roubo_veiculo')]}`},
    {href: 'resposta', titulo: GRUPOS.resposta.titulo, pergunta: GRUPOS.resposta.pergunta, prova: `${inteiro(serieBR(g, 'desaparecidos').n[ultimoIndice(g, 'desaparecidos')] as number)} registros de desaparecimento em ${g.anos[ultimoIndice(g, 'desaparecidos')]}`},
    {href: 'recursos', titulo: 'Recursos', pergunta: 'Quanto os governos estaduais gastam com segurança pública?', prova: `${reais(bD.taxa?.[kD] as number)} por habitante em ${g.anos[kD]}, ${bD.cobertura[kD]} governos estaduais`},
    {href: 'metodos', titulo: 'Dados e métodos', pergunta: 'O que cada fonte permite medir?', prova: `Sinesp, SIM, Siconfi e IBGE; ${g.ausencias.length} combinações de UF, ano e indicador tratadas como ausência`},
  ];
  return <section className="mt-8">
    <p className="rotulo text-obee-dark">Proteção e direitos · 27 UFs · {g.anos[0]} a {g.anos[kH]}</p>
    <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">Quanta violência cada estado registra?</h1>
    <p className="mt-4 max-w-2xl text-lg leading-relaxed">A mesma morte violenta é contada duas vezes: pela polícia e pela saúde. O painel mostra os dois registros em cada UF, em taxa por 100 mil habitantes, ao lado dos crimes patrimoniais, da busca por pessoas e da despesa dos governos estaduais.</p>
    <dl className="mt-8 grid border-y border-linha sm:grid-cols-2 lg:grid-cols-4">
      <div className="border-linha py-6 sm:pr-5 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:pl-5">
        <dt className="text-sm">Óbitos por agressão, registro de saúde</dt>
        <dd className="mt-3 font-serif text-4xl tabular-nums">{numero(bS.taxa?.[kS] as number, 1)}</dd>
        <dd className="mt-2 text-sm">por 100 mil habitantes em {g.anos[kS]} · {inteiro(bS.n[kS] as number)} óbitos</dd>
        <Fonte dd>SIM, Ministério da Saúde, dado final (extração de {g.fontes.sim.extracao_final}); UF de residência.</Fonte>
      </div>
      <div className="border-linha py-6 sm:pl-5 sm:border-l lg:pl-5">
        <dt className="text-sm">Vítimas de homicídio doloso, registro policial</dt>
        <dd className="mt-3 font-serif text-4xl tabular-nums">{numero(bH.taxa?.[kH] as number, 1)}</dd>
        <dd className="mt-2 text-sm">por 100 mil habitantes em {g.anos[kH]} · {inteiro(bH.n[kH] as number)} vítimas{bH.variacao[kH] !== null && ` · ${percentualVariacao(bH.variacao[kH] as number)} sobre ${g.anos[kH - 1]}`}</dd>
        <Fonte dd>Sinesp VDE, Ministério da Justiça, captura de {capturaSinesp}; polícias estaduais, UF do fato.</Fonte>
      </div>
      <div className="border-t border-linha py-6 sm:border-t-0 sm:pr-5 lg:border-l lg:pl-5">
        <dt className="text-sm">Vítimas de feminicídio</dt>
        <dd className="mt-3 font-serif text-4xl tabular-nums">{numero(bF.taxa?.[kF] as number, 2)}</dd>
        <dd className="mt-2 text-sm">por 100 mil mulheres em {g.anos[kF]} · {inteiro(bF.n[kF] as number)} vítimas</dd>
        <Fonte dd>Sinesp VDE, captura de {capturaSinesp}; mulheres residentes pela Projeção do IBGE.</Fonte>
      </div>
      <div className="border-t border-linha py-6 sm:border-l sm:border-t-0 sm:pl-5">
        <dt className="text-sm">Distância entre as UFs no homicídio doloso</dt>
        <dd className="mt-3 font-serif text-4xl tabular-nums">{numero(amp.min.taxa, 1)} a {numero(amp.max.taxa, 1)}</dd>
        <dd className="mt-2 text-sm">por 100 mil habitantes em {g.anos[kH]}: de {nomeUF(g, amp.min.uf)} a {nomeUF(g, amp.max.uf)}</dd>
        <Fonte dd>Sinesp VDE; {amp.comparadas} UFs com dado no ano.</Fonte>
      </div>
    </dl>
    <p className="mt-4 max-w-3xl text-sm text-carvao-muted">Os dois registros não se somam nem se substituem: contam a mesma realidade com regras diferentes. Bases revisadas pelas UFs depois da publicação.</p>

    <Link href={`${ROTA}/estados`} prefetch={prefetchDoLink(`${ROTA}/estados`)} className="group mt-10 block border border-linha bg-superficie p-5 sm:p-6">
      <p className="text-xs uppercase tracking-label text-obee-dark">O destino mais procurado</p>
      <h2 className="mt-2 font-serif text-2xl group-hover:underline sm:text-3xl">Compare os estados →<SeloComConta href={`${ROTA}/estados`}/></h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed">Escolha o indicador e o ano: cada UF na taxa por 100 mil, a referência do Brasil, a posição, a distância e o motivo de cada ausência. Abaixo, homicídio doloso em {g.anos[kH]}: cada ponto é uma UF; a linha, o Brasil.</p>
      <svg viewBox="0 0 1000 70" className="mt-4 h-auto w-full" role="img" aria-label={`Taxa de homicídio doloso por 100 mil habitantes em ${g.anos[kH]}: de ${numero(amp.min.taxa, 1)} em ${nomeUF(g, amp.min.uf)} a ${numero(amp.max.taxa, 1)} em ${nomeUF(g, amp.max.uf)}; Brasil ${numero(bH.taxa?.[kH] as number, 1)}.`}>
        <line x1="20" x2="980" y1="38" y2="38" stroke="var(--cor-grade)" strokeWidth="1"/>
        <line x1={x(bH.taxa?.[kH] as number)} x2={x(bH.taxa?.[kH] as number)} y1="14" y2="58" stroke="var(--serie-referencia)" strokeDasharray="4 3" strokeWidth="2"/>
        <text x={x(bH.taxa?.[kH] as number)} y="10" textAnchor="middle" fontSize="14" fill="var(--cor-carvao-muted)">Brasil {numero(bH.taxa?.[kH] as number, 1)}</text>
        {pontos.filter((p) => p.taxa !== null).map((p) => <circle key={p.sigla} cx={x(p.taxa as number)} cy="38" r="7" fill="var(--cor-obee)" fillOpacity="0.55"><title>{`${p.nome}: ${numero(p.taxa as number, 1)}`}</title></circle>)}
        <text x="20" y="68" fontSize="13" fill="var(--cor-carvao-muted)">0</text>
        <text x="980" y="68" textAnchor="end" fontSize="13" fill="var(--cor-carvao-muted)">{numero(max, 0)} por 100 mil</text>
      </svg>
    </Link>

    <section className="mt-12" aria-labelledby="dois-registros">
      <h2 id="dois-registros" className="font-serif text-2xl sm:text-3xl">Uma morte, dois registros</h2>
      <p className="mt-3 max-w-prose2 leading-relaxed">Por que a polícia e a saúde chegam a números diferentes para a mesma violência, e qual dos dois serve para cada pergunta.</p>
      <div className="mt-6"><DoisRegistros dados={dois}/></div>
    </section>

    <section className="mt-12">
      <h2 className="font-serif text-2xl sm:text-3xl">Escolha a pergunta que deseja explorar</h2>
      <div className="mt-5 grid gap-x-10 md:grid-cols-2">{caminhos.map((c, n) => <Link key={c.href} href={`${ROTA}/${c.href}`} prefetch={prefetchDoLink(`${ROTA}/${c.href}`)} className="group border-t border-linha py-6">
        <p className="text-xs text-obee-dark">{String(n + 1).padStart(2, '0')} · {c.titulo}</p>
        <h3 className="mt-2 font-serif text-2xl group-hover:underline">{c.pergunta}<SeloComConta href={`${ROTA}/${c.href}`}/></h3>
        <p className="mt-3 text-sm text-carvao-muted">{c.prova} →</p>
      </Link>)}</div>
    </section>

    <aside className="mt-8 border-l-4 border-obee bg-superficie p-5"><h2 className="font-serif text-xl">Três dimensões, três perguntas</h2><p className="mt-3 max-w-3xl leading-relaxed">Recursos: quanto foi mobilizado? Atividade: o que foi registrado? Resultados: qual violência é observada? Colocar essas dimensões lado a lado ajuda a formular perguntas, mas não identifica, sozinho, a eficiência do Estado.</p></aside>

    <details className="mt-10 border-y border-linha py-4">
      <summary className="min-h-[44px] cursor-pointer py-2 font-serif text-xl">Método, fontes e atualização</summary>
      <div className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed">
        <p>Registros policiais: Sinesp VDE, planilhas anuais de {g.fontes.sinesp.anos[0]} a {g.fontes.sinesp.anos.at(-1)}, só as polícias estaduais, somadas por UF e ano{g.fontes.sinesp.ano_parcial ? `; ${g.fontes.sinesp.ano_parcial.ano} tem ${g.fontes.sinesp.ano_parcial.meses} meses e fica fora até fechar o ano` : ''}. Registros de óbito: SIM pelo TabNet, dados finais até {g.fontes.sim.final_ate}{Object.keys(g.fontes.sim.extracao_preliminar).length ? ` e ${listaNatural(Object.keys(g.fontes.sim.extracao_preliminar))} preliminar` : ''}. Despesa: Siconfi, DCA dos 27 governos estaduais. População: IBGE, {g.fontes.ibge.rotulo}, a mesma série para todos os anos.</p>
        <p>Ausência não vira zero: um ano inteiro sem registro numa UF onde o esperado seria de {g.regra_ausencia.limiar_ano} ou mais, ou meses zerados que, pela média do próprio ano, teriam chance menor que {numero(g.regra_ausencia.prob_meses_zerados * 100, 0)}% de acontecer por acaso, ficam sem valor publicado, com o motivo ao lado.</p>
        <p>Coleta mensal automática; a publicação só muda quando um número muda e os testes passam. Última captura: Sinesp em {capturaSinesp}, SIM em {dataBr(g.fontes.sim.capturado_em)}, Siconfi em {dataBr(g.fontes.siconfi.capturado_em)}.</p>
        <Link className="inline-flex min-h-[44px] items-center text-obee-dark underline" href={`${ROTA}/metodos`}>Ler o método completo →</Link>
      </div>
    </details>
  </section>;
}

function Estados({g}: {g: GoldSeguranca}) {
  const p = pacoteEstados(g);
  const ausH = g.ausencias.filter((a) => a.indicador === 'homicidio');
  const anosAusentesH = [...new Set(ausH.map((a) => a.ano))].sort();
  const ufsAusentesH = [...new Set(ausH.map((a) => a.uf))].sort();
  return <section className="mt-8">
    <p className="rotulo text-obee-dark">27 UFs · {g.anos[0]} a {g.anos.at(-1)} · taxa por 100 mil habitantes</p>
    <h1 className="mt-3 max-w-3xl font-serif text-3xl sm:text-4xl">A violência registrada é comparável entre os estados?</h1>
    <p className="mt-4 max-w-3xl leading-relaxed">Em taxa por 100 mil habitantes, sim, dentro de cada registro: a polícia de cada estado classifica e envia os seus números, e a saúde codifica a causa de cada óbito. Escolha o indicador, o ano e uma UF. A referência é o Brasil do mesmo ano; a posição e a distância descrevem onde a UF está, não se está bem ou mal.</p>
    <div className="mt-8"><PorEstado pacote={p} inicial="homicidio"/></div>
    <section id="policia-e-saude" className="mt-14 border-t border-linha pt-8">
      <h2 className="font-serif text-2xl sm:text-3xl">Polícia e saúde contam de formas diferentes</h2>
      <p className="mt-3 max-w-3xl leading-relaxed">Vítimas de homicídio doloso registradas pela polícia (UF do fato) e óbitos por agressão no SIM (UF de residência), na mesma escala. Onde a saúde classifica muitas mortes como de intenção indeterminada, o SIM capta menos; onde a polícia deixa de classificar, o registro policial capta menos.</p>
      <div className="mt-6"><PoliciaSaude pacote={p}/></div>
    </section>
    <section className="mt-12 border-l-4 border-obee pl-5">
      <h2 className="font-serif text-2xl">Antes de comparar</h2>
      <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 leading-relaxed">
        {anosAusentesH.length > 0 && <li>Em {listaNatural(anosAusentesH.map(String))}, o homicídio doloso de {ufsAusentesH.length === 1 ? 'uma UF' : `${ufsAusentesH.length} UFs`} ({listaNatural(ufsAusentesH)}) não chegou completo ao Sinesp; esses anos aparecem como ausência, não como queda. Outros indicadores têm ausências próprias, listadas no método.</li>}
        <li>O Sinesp traz o que as polícias estaduais registraram e classificaram. Mudança de sistema ou de regra de classificação numa UF muda a série dela.</li>
        <li>A população é a do IBGE, {g.fontes.ibge.rotulo}, {g.fontes.ibge.base}. Taxas publicadas antes, com as estimativas da época, diferem destas.</li>
        <li>O dado mais recente do SIM é preliminar e costuma subir quando se torna final.</li>
      </ul>
      <Link className="mt-4 inline-flex min-h-[44px] items-center text-obee-dark underline" href={`${ROTA}/metodos`}>Ver a lista de ausências e o método →</Link>
    </section>
  </section>;
}

function Recursos({g}: {g: GoldSeguranca}) {
  const p = pacoteEstados(g);
  const rec = {...p, indicadores: p.indicadores.filter((i) => i.grupo === 'recursos')};
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
  if (slug in GRUPOS) return <Explorador grupo={slug} config={GRUPOS[slug as Grupo]} linhas={linhasNacionais(g, slug as GrupoId)} rota={ROTA}/>;
  if (slug === 'estados') return <Estados g={g}/>;
  if (slug === 'recursos') return <Recursos g={g}/>;
  if (slug === 'metodos') return <Metodos g={g}/>;
  return <Panorama g={g}/>;
}
