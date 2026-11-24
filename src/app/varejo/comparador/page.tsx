import type { Metadata } from "next";
import Link from "next/link";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { Controles, FiguraAnalitica, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ApoioNaCuradoria, CaixasLadoALado, CorpoDaPonte, SelecaoDeEmpresas, type ApoioDoPar, type Selecionada } from "@/components/varejo/Comparador";
import { RESUMO_MAIS } from "@/components/varejo/FichaGrupo";
import { LegendaDaCascata } from "@/components/varejo/figuras/CascataCaixa";
import { CuponsLadoALado, LinhaALinha } from "@/components/varejo/figuras/CuponsLadoALado";
import { PontosConectados } from "@/components/varejo/figuras/PontosConectados";
import { LogoEmpresa } from "@/components/varejo/LogoEmpresa";
import { CabecalhoVarejo, LINK } from "@/components/varejo/comum";
import { ExportarRecorte } from "@/components/varejo/ExportarRecorte";
import { Campo, FonteDocumento, NaoDivulgado } from "@/components/varejo/grupos-comum";
import { SeletorUrl } from "@/components/varejo/SeletorUrl";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { parametro, type ParametrosPagina } from "@/lib/painel/recorte";
import type { NumeroProps } from "@/lib/painel/tipos";
import {
  anoDaUrl,
  avisosDaSelecao,
  caixaDe,
  empresasComparaveis,
  hrefComparador,
  linhasDosCupons,
  MAX_EMPRESAS,
  medidasEmPontos,
  MIN_EMPRESAS,
  PAR_PADRAO,
  parDaSelecao,
  PARES,
  PARTES,
  perfilDoExercicio,
  persistencias,
  reconciliacao,
  selecaoDaUrl,
  sinaisPorExercicio,
  substitutos,
  variacaoDaReceita,
} from "@/lib/varejo/comparador";
import { contaDoCupom, curadoria, goldEmpresas } from "@/lib/varejo/dados";
import { dataBr, mesDaData, num, pct, plural, pontos, por100, reais, textoCurado, variacao } from "@/lib/varejo/formato";
import { dividaLiquida, eventosOrdenados, exerciciosDaGold, fichaDoGrupo, hrefFicha, nomeDoSegmento, passivoArrendamento, periodoDe, ROTA_COMPARADOR, ROTA_GRUPOS, TIPO_EVENTO } from "@/lib/varejo/grupos";
import { paginaVarejo, ROTA_METODO } from "@/lib/varejo/paginas";
import { provCvm } from "@/lib/varejo/proveniencia";
import type { FichaCuradoria } from "@/lib/varejo/tipos";

/**
 * "Por que empresas do mesmo ramo têm resultados diferentes?" (coleção Varejo, com conta): de duas a quatro companhias abertas
 * no mesmo exercício (`?e=assai,grupo-mateus&ano=2025`), com a ponte de R$ 100 de receita líquida até o lucro, o caminho do
 * caixa com o ajuste do convênio de fornecedores, as diferenças que se repetem em todos os exercícios, o apoio da curadoria
 * nos dois pares preparados e os avisos de comparabilidade calculados do próprio dado. A página não ordena empresas por
 * desempenho: mostra as contas lado a lado e o que impede compará-las sem ressalva.
 */
export const dynamic = "force-dynamic";

const pagina = paginaVarejo("comparador");

type Busca = { searchParams: ParametrosPagina };

export function generateMetadata(): Metadata {
  return {
    title: tituloNaColecao(pagina.pergunta, ROTA_COMPARADOR),
    description: "Compare de duas a quatro companhias abertas do varejo no mesmo exercício: de cada R$ 100 de receita líquida, quanto chega ao lucro, e para onde foi o caixa, com as demonstrações originais da CVM.",
    alternates: { canonical: ROTA_COMPARADOR },
  };
}

/** O mesmo indicador operacional nas duas fichas de cada par preparado (o nome muda de uma companhia para a outra). */
const APOIO: Record<string, { rotulo: string; padrao: Record<string, RegExp> }[]> = {
  atacarejo: [
    { rotulo: "Vendas nas mesmas lojas", padrao: { assai: /^Vendas nas mesmas lojas/i, "grupo-mateus": /^Vendas nas mesmas lojas/i } },
    { rotulo: "Lojas no fim do exercício", padrao: { assai: /^N[uú]mero de lojas/i, "grupo-mateus": /^N[uú]mero de lojas/i } },
    { rotulo: "Lojas inauguradas", padrao: { assai: /inauguradas/i, "grupo-mateus": /^Inaugura[cç][oõ]es de atacarejo/i } },
    { rotulo: "Área de vendas", padrao: { assai: /[áÁ]rea de vendas/i, "grupo-mateus": /[áÁ]rea de vendas/i } },
  ],
  eletro: [
    { rotulo: "Vendas nas mesmas lojas", padrao: { "magazine-luiza": /^Vendas nas mesmas lojas/i, "casas-bahia": /^Vendas nas mesmas lojas/i } },
    { rotulo: "Lojas no fim do exercício", padrao: { "magazine-luiza": /^N[uú]mero de lojas/i, "casas-bahia": /^N[uú]mero de lojas/i } },
    { rotulo: "Venda própria (1P)", padrao: { "magazine-luiza": /^Vendas pr[oó]prias/i, "casas-bahia": /^Vendas pr[oó]prias/i } },
    { rotulo: "Venda de parceiros no marketplace (3P)", padrao: { "magazine-luiza": /parceiros no marketplace/i, "casas-bahia": /parceiros no marketplace/i } },
    { rotulo: "Pagamentos de convênio no fluxo de financiamento", padrao: { "magazine-luiza": /conv[eê]nio.*fluxo de financiamento/i, "casas-bahia": /conv[eê]nio.*fluxo de financiamento/i } },
  ],
};

const EVENTOS_QUE_MUDAM = ["recuperacao_judicial", "reapresentacao", "mudanca_de_controle", "fechamento_de_capital", "aquisicao", "desinvestimento"];

/** A nota em que a companhia descreve o convênio de fornecedores, na ficha (indicador de pagamentos no fluxo de financiamento). */
const notaDoConvenio = (f: FichaCuradoria | null) => (f?.operacionais ?? []).find((o) => /(conv[eê]nio|risco sacado).*fluxo de financiamento/i.test(o.indicador) && o.nota) ?? null;

export default function PaginaComparador({ searchParams }: Busca) {
  const e = goldEmpresas();
  const c = curadoria();
  const anos = exerciciosDaGold(e);
  const ano = anoDaUrl(e, parametro(searchParams, "ano"));
  const todas = empresasComparaveis(e, c);

  // seleção: sem `e`, o primeiro par preparado; com uma empresa só, ela e a primeira substituta do mesmo segmento
  let slugs = selecaoDaUrl(e, searchParams.e);
  if (slugs.length === 0) slugs = [...PAR_PADRAO];
  // uma empresa só: a página completa a dupla apenas com companhia do mesmo segmento; sem nenhuma, pede a segunda ao leitor
  const sozinha = slugs.length === 1 ? slugs[0] : null;
  const substituta = sozinha ? substitutos(todas, sozinha)[0]?.slug ?? null : null;
  if (sozinha && substituta) slugs = [sozinha, substituta];
  const h = (s: readonly string[], a: number = ano) => hrefComparador(e, s, a);

  if (sozinha && !substituta) {
    const emp = e.empresas[sozinha];
    const p = periodoDe(emp, ano);
    const outras = todas.filter((x) => x.slug !== sozinha);
    return (
      <>
        <MarcaVisita secao={pagina.secao} />
        <CabecalhoVarejo rota={ROTA_COMPARADOR} />
        <PaginaPainel
          rota={ROTA_COMPARADOR}
          abertura={{
            grupo: "Comparador",
            acento: "gas",
            titulo: pagina.pergunta,
            lead: "Duas redes vendem as mesmas coisas e chegam a lucros diferentes. Siga R$ 100 de receita até o lucro e veja para onde foi o caixa, empresa ao lado de empresa, no mesmo exercício.",
            recorte: { periodo: `exercício de ${ano}`, universo: `1 de ${num(todas.length)} companhias abertas do varejo escolhida`, unidade: "reais correntes e R$ por R$ 100 de receita líquida", fonte: "CVM, Demonstrações Financeiras Padronizadas" },
            limite: "qual empresa é melhor, nem a causa de cada diferença: as contas mostram onde os números se afastam; perímetro, eventos do ano e critérios contábeis explicam parte da distância.",
          }}
          figuras={
            <>
              <Controles rotulo="Empresas e exercício da comparação" idioma="pt" resumo={<>Uma empresa escolhida: {emp.nome}. Falta a segunda.</>} limpar={{ href: ROTA_COMPARADOR }}>
                <SeletorUrl id="sel-ano" rotulo="Exercício (o mesmo para todas)" atual={String(ano)} opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), href: h([sozinha], a) }))} />
              </Controles>
              <Recolhido id="escolha" aberto nivelTitulo={2} titulo="Escolha a segunda empresa" resumo={`${emp.nome} não tem, na base, outra companhia aberta do mesmo segmento. A página não completa a dupla com uma empresa de outro ramo por conta própria.`}>
                <div data-escolha-segunda={sozinha}>
                  <p className="max-w-prose2 text-base leading-relaxed text-carvao">
                    {p?.ponte_100
                      ? `Em ${ano}, de cada R$ 100 de receita líquida, ${emp.nome} ${p.ponte_100.lucro_liquido < 0 ? "teve" : "ficou com"} ${por100(Math.abs(p.ponte_100.lucro_liquido))} de ${p.ponte_100.lucro_liquido < 0 ? "prejuízo" : "lucro"}.`
                      : `${emp.nome} não tem demonstração de ${ano} na base.`}{" "}
                    Para pôr esse número ao lado de outro, escolha a companhia. Empresas de ramos diferentes têm margens e prazos diferentes por natureza do negócio: a escolha, e a ressalva que vem com ela, é sua.
                  </p>
                  <ul className="mt-5 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
                    {outras.map((x) => (
                      <li key={x.slug} className="border-t border-linha">
                        <Link href={h([sozinha, x.slug])} prefetch={false} scroll={false} className="flex min-h-[44px] items-center gap-3 py-2 text-sm text-carvao" data-segunda={x.slug}>
                          <LogoEmpresa slug={x.slug} nome={x.nome} tamanho="p" decorativo semLogo="placa" />
                          <span className="flex min-w-0 flex-col">
                            <span className={`font-medium ${LINK}`}>{x.nome}</span>
                            <span className="t-meta text-carvao-muted">{x.segmentos.length ? x.segmentos.map(nomeDoSegmento).join(" e ") : "sem segmento na curadoria"}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="t-meta mt-5 text-carvao-muted">
                    Ou comece por um par preparado:{" "}
                    {PARES.map((par, i) => (
                      <span key={par.id}>
                        {i > 0 && ", "}
                        <Link href={h(par.slugs)} prefetch={false} className={LINK}>
                          {par.rotulo}
                        </Link>
                      </span>
                    ))}
                    .
                  </p>
                </div>
              </Recolhido>
            </>
          }
          metodo={
            <p>
              {e.fontes.dfp.orgao}, {e.fontes.dfp.nome}. Exercícios de {anos[0]} a {anos[anos.length - 1]}. Consultado em {dataBr(e.fontes.dfp.capturado_em)}.{" "}
              <Link href={ROTA_METODO} prefetch={false} className={LINK}>
                Fontes, fórmulas, correspondência com o IBGE e lacunas
              </Link>
              .
            </p>
          }
          frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
        />
      </>
    );
  }

  const hrefAno = (a: number) => `${h(slugs, a)}#ponte`;
  const foraDoPadrao = h(slugs) !== ROTA_COMPARADOR;

  const selecionadas: Selecionada[] = slugs.map((slug) => ({ slug, emp: e.empresas[slug], p: periodoDe(e.empresas[slug], ano) }));
  const comDado = selecionadas.filter((x) => x.p?.ponte_100);
  const nomes = selecionadas.map((x) => x.emp.nome);
  const lista = (itens: string[]) => (itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`);
  const par = parDaSelecao(slugs);
  const fichas = selecionadas.map((x) => {
    const slugFicha = todas.find((t) => t.slug === x.slug)?.ficha ?? null;
    return slugFicha ? fichaDoGrupo(c, slugFicha) : null;
  });
  const avisos = avisosDaSelecao(selecionadas, ano);
  const dois = selecionadas.length === 2 ? ([selecionadas[0], selecionadas[1]] as const) : null;
  const pers = dois ? persistencias(e, dois[0].emp, dois[1].emp, ano) : [];
  const repetem = pers.filter((p) => p.repete);
  const trocam = pers.filter((p) => !p.repete && p.comparaveis > 1);
  const comConvenio = selecionadas.filter((x) => caixaDe(x.p).convenio !== null);
  const notasConvenio = selecionadas.map((x, i) => ({ x, o: notaDoConvenio(fichas[i]) })).filter((n) => n.o);
  const apoio: ApoioDoPar[] = par && dois ? (APOIO[par.id] ?? []).map((a) => ({ rotulo: a.rotulo, padroes: [a.padrao[dois[0].slug] ?? /$^/, a.padrao[dois[1].slug] ?? /$^/] as const })) : [];
  const perfis = selecionadas.map((x) => {
    const perfil = perfilDoExercicio(x.slug, x.emp, x.p, "Companhia");
    return perfil ? { ...perfil, conta: contaDoCupom(perfil) } : null;
  });
  const linhasCupons = linhasDosCupons(selecionadas.map((x) => x.p?.ponte_100 ?? null));
  const emPontos = medidasEmPontos(selecionadas.map((x) => x.p));
  const persistenciaDesenhada = dois
    ? Object.fromEntries(
        pers.map((p) => [
          p.medida.id,
          {
            sinais: sinaisPorExercicio(e, dois[0].emp, dois[1].emp, p.medida),
            texto: p.comparaveis < 2 ? "um só exercício comparável" : p.repete ? `mesmo lado nos ${num(p.comparaveis)} exercícios` : `troca de lado: ${dois[0].emp.nome} acima em ${num(p.aAcima)} de ${num(p.comparaveis)}`,
          },
        ]),
      )
    : undefined;
  const eventos = selecionadas
    .map((x, i) => ({ x, slugFicha: fichas[i]?.slug ?? null, lista: eventosOrdenados((fichas[i]?.eventos ?? []).filter((ev) => EVENTOS_QUE_MUDAM.includes(ev.tipo ?? "") && (ev.data ?? "") >= `${ano}-01`)).slice(0, 3) }))
    .filter((g) => g.lista.length > 0);

  const numeros: NumeroProps[] = selecionadas.map((x) => {
    const b = x.p?.ponte_100;
    const base = { rotulo: `${x.emp.nome}: lucro de cada R$ 100 de receita líquida`, unidade: "por R$ 100 de receita líquida", periodo: String(ano), fonte: "CVM, Demonstrações Financeiras Padronizadas", natureza: "CALCULADO" as const, tamanho: "g" as const };
    return b
      ? { ...base, formato: "texto" as const, valorTexto: por100(b.lucro_liquido), nota: `${(x.p!.lucro_liquido ?? 0) < 0 ? "Prejuízo" : "Lucro líquido"} de ${reais(x.p!.lucro_liquido === null ? null : Math.abs(x.p!.lucro_liquido), 2)} sobre receita líquida de ${reais(x.p!.receita_liquida)}.` }
      : { ...base, valor: null, motivoAusencia: `${x.emp.nome} não tem demonstração de ${ano} na base; nenhum outro exercício entra no lugar.` };
  });

  const linhaTabela = (x: Selecionada) => {
    const p = x.p;
    const cx = caixaDe(p);
    const bi = (v: number | null) => (v === null ? null : v / 1e9);
    return [
      x.emp.nome,
      bi(p?.receita_liquida ?? null), p?.margem_bruta_pct ?? null, p?.margem_operacional_pct ?? null, p?.margem_liquida_pct ?? null, bi(p?.lucro_liquido ?? null),
      bi(cx.operacional), bi(cx.aposConvenio), cx.investimentos === null ? null : Math.abs(cx.investimentos) / 1e9, dividaLiquida(p), passivoArrendamento(p),
      p ? (p.base === "individual" ? "individual" : "consolidada") : "sem demonstração",
    ];
  };
  const COLUNAS = [
    "Companhia", "Receita líquida, R$ bilhões", "Margem bruta, %", "Margem operacional, %", "Margem líquida, %", "Lucro líquido, R$ bilhões", "Caixa operacional declarado, R$ bilhões",
    "Caixa operacional depois do convênio, R$ bilhões", "Investimentos, R$ bilhões", "Dívida líquida sem arrendamento, R$ bilhões", "Passivo de arrendamento, R$ bilhões", "Base da demonstração",
  ];

  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoVarejo rota={ROTA_COMPARADOR} />
      <PaginaPainel
        rota={ROTA_COMPARADOR}
        abertura={{
          grupo: "Comparador",
          acento: "gas",
          titulo: pagina.pergunta,
          lead: "Duas redes vendem as mesmas coisas e chegam a lucros diferentes. Siga R$ 100 de receita até o lucro e veja para onde foi o caixa, empresa ao lado de empresa, no mesmo exercício.",
          recorte: { periodo: `exercício de ${ano}`, universo: `${num(selecionadas.length)} de ${num(todas.length)} companhias abertas do varejo`, unidade: "reais correntes e R$ por R$ 100 de receita líquida", fonte: "CVM, Demonstrações Financeiras Padronizadas" },
          limite: "qual empresa é melhor, nem a causa de cada diferença: as contas mostram onde os números se afastam; perímetro, eventos do ano e critérios contábeis explicam parte da distância.",
          acao: (
            <div data-atalhos-pares="">
              <p className="text-sm font-medium text-carvao">Dois pares para começar</p>
              <ul className="mt-2 grid max-w-3xl gap-3 sm:grid-cols-2">
                {PARES.map((p) => {
                  const ativo = par?.id === p.id;
                  return (
                    <li key={p.id}>
                      <Link
                        href={h(p.slugs)}
                        prefetch={false}
                        scroll={false}
                        aria-current={ativo ? "true" : undefined}
                        className={`flex h-full min-h-[44px] flex-col gap-2 border bg-superficie px-3 py-3 text-carvao transition-[border-color,transform] duration-150 ease-out motion-safe:active:scale-[0.98] ${
                          ativo ? "border-carvao shadow-[inset_0_-4px_0_var(--cor-gas)]" : "border-linha [@media(hover:hover)]:hover:border-carvao"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <LogoEmpresa slug={p.slugs[0]} nome={e.empresas[p.slugs[0]]?.nome ?? p.slugs[0]} tamanho="p" decorativo semLogo="placa" />
                          <span aria-hidden="true" className="text-sm text-mineral">×</span>
                          <LogoEmpresa slug={p.slugs[1]} nome={e.empresas[p.slugs[1]]?.nome ?? p.slugs[1]} tamanho="p" decorativo semLogo="placa" />
                        </span>
                        <span className="text-sm font-medium leading-snug">{p.rotulo}</span>
                        <span className="text-xs leading-snug text-carvao-muted">
                          Por que {p.porque} chegam a resultados diferentes?{ativo ? " É a comparação em vigor." : ""}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
        }}
        rotuloNumeros={`Lucro de cada R$ 100 de receita líquida, ${ano}`}
        numeros={numeros}
        notaNumeros="Lucro líquido consolidado dividido pela receita líquida. Um número só não compara empresas: as parcelas, o caixa e os avisos abaixo dizem o que há por trás dele."
        figuras={
          <>
            <Controles
              rotulo="Empresas e exercício da comparação"
              idioma="pt"
              resumo={
                <>
                  Comparando {lista(nomes)} no exercício de {ano}.
                </>
              }
              limpar={foraDoPadrao ? { href: ROTA_COMPARADOR } : undefined}
            >
              <SeletorUrl id="sel-ano" rotulo="Exercício (o mesmo para todas)" atual={String(ano)} opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), href: h(slugs, a) }))} />
              <SelecaoDeEmpresas todas={todas} selecao={slugs} href={(s) => h(s.slice(0, MAX_EMPRESAS).length >= MIN_EMPRESAS ? s.slice(0, MAX_EMPRESAS) : slugs)} />
            </Controles>

            <Recolhido id="avisos" aberto nivelTitulo={2} titulo="Antes de comparar" resumo={`${num(avisos.length + 2)} ${plural(avisos.length + 2, "ponto que muda", "pontos que mudam")} a leitura desta comparação: ${avisos.length > 0 ? `${num(avisos.length)} do recorte escolhido e ` : ""}dois que valem sempre.`}>
              <ul className="grid gap-x-10 gap-y-5 md:grid-cols-2" data-avisos={avisos.length}>
                {avisos.map((a) => (
                  <li key={a.id} className="min-w-0 border-t border-carvao pt-3" data-aviso={a.id}>
                    <p className="text-sm font-medium text-carvao">{a.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{a.texto}</p>
                  </li>
                ))}
                <li className="min-w-0 border-t border-linha pt-3" data-aviso="arrendamento">
                  <p className="text-sm font-medium text-carvao">Aluguéis de loja não estão na dívida</p>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                    A norma contábil registra os aluguéis de longo prazo como passivo de arrendamento. Quem aluga as lojas tem dívida bancária menor e arrendamento maior que quem é dono dos imóveis. A tabela traz os dois separados;
                    olhar só a dívida líquida favorece quem aluga.
                  </p>
                </li>
                <li className="min-w-0 border-t border-linha pt-3" data-aviso="ajustado">
                  <p className="text-sm font-medium text-carvao">Aqui é o resultado contábil, não o ajustado</p>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                    Os releases das companhias trazem lucro e margem ajustados, sem itens que cada administração considera não recorrentes, com critérios próprios. Esta página usa as rubricas padronizadas entregues à CVM, iguais
                    para todas; os números podem diferir dos que a empresa destaca.
                  </p>
                </li>
              </ul>
              {eventos.length > 0 && (
                <p className="t-meta mt-5 text-carvao-muted">
                  As fichas registram {num(eventos.reduce((n, g) => n + g.lista.length, 0))} {plural(eventos.reduce((n, g) => n + g.lista.length, 0), "evento", "eventos")} de {ano} em diante para {lista(eventos.map((g) => g.x.emp.nome))}:{" "}
                  <a href="#eventos" className={LINK}>
                    ver os eventos, com o documento de cada um
                  </a>
                  .
                </p>
              )}
            </Recolhido>

            <FiguraAnalitica
              id="ponte"
              pergunta="De cada R$ 100 de receita líquida, quanto chega ao lucro?"
              subtitulo={`Custo, despesas, resultado financeiro, imposto e lucro · R$ por R$ 100 de receita líquida · ${lista(nomes)} · exercício de ${ano}`}
              natureza="CALCULADO"
              proveniencia={provCvm(e, {
                indicador: "Ponte da receita líquida ao lucro líquido, por R$ 100 de receita", natureza: "CALCULADO", unidade: "R$ por R$ 100 de receita líquida", inicio: String(ano), fim: String(ano), formula: e.formulas.ponte_100,
                limitacoes: ["A conta começa na receita líquida: os impostos sobre a venda já saíram.", "Receita líquida soma mercadoria, serviços, comissões e crédito, na proporção de cada companhia."],
              })}
              leitura={
                <LeituraGuiada>
                  {comDado.length > 0 ? (
                    <>
                      Em {ano}, de cada R$ 100 de receita líquida, {lista(comDado.map((x) => `${x.emp.nome} ${x.p!.ponte_100!.lucro_liquido < 0 ? "teve" : "ficou com"} ${por100(Math.abs(x.p!.ponte_100!.lucro_liquido))} de ${x.p!.ponte_100!.lucro_liquido < 0 ? "prejuízo" : "lucro"}`))}. O custo da mercadoria levou{" "}
                      {lista(comDado.map((x) => `${por100(-x.p!.ponte_100!.custo)} em ${x.emp.nome}`))}.
                      {comDado.length < selecionadas.length && ` ${lista(selecionadas.filter((x) => !x.p?.ponte_100).map((x) => x.emp.nome))} não ${plural(selecionadas.length - comDado.length, "tem", "têm")} demonstração de ${ano} na base.`}
                    </>
                  ) : (
                    <>Nenhuma das empresas escolhidas tem demonstração de {ano} na base.</>
                  )}
                </LeituraGuiada>
              }
              comoInterpretar="Cada cupom lista o que saiu dos R$ 100 de receita líquida de uma companhia, na ordem da demonstração de resultado, e fecha no lucro. A barra no pé de cada cupom usa a mesma régua em todos: o que passa do traço dos R$ 100 é prejuízo, hachurado. Em “linha a linha”, cada parcela aparece companhia a companhia, com a distância entre elas escrita."
              naoConcluir="que a empresa com mais lucro por R$ 100 é mais eficiente: custo e despesa dependem do que cada uma vende, de quanto é serviço ou crédito na receita, de eventos do ano e de onde a contabilidade classifica cada gasto."
              tabela={{
                titulo: `Ponte da receita líquida ao lucro, R$ por R$ 100 de receita líquida, ${ano}`,
                colunas: ["Companhia", ...PARTES.map((p) => `${p.rotulo}, R$ por 100`), "Soma (R$ 100 mais as parcelas), R$", "Fecha com o lucro divulgado?"],
                linhas: selecionadas.map((x) => {
                  const b = x.p?.ponte_100;
                  const rec = x.p ? reconciliacao(x.p) : null;
                  return [x.emp.nome, ...PARTES.map((p) => (b ? b[p.campo] : null)), rec ? Number(rec.soma.toFixed(2)) : null, rec ? (rec.fecha ? "sim" : "não") : "sem demonstração"];
                }),
                casas: [null, ...PARTES.map(() => 2), 2, null],
                limite: selecionadas.length,
              }}
              complemento={
                <div className="space-y-5">
                  <div data-linha-a-linha-bloco="">
                    <h3 className="t-h3 text-carvao">Linha a linha: de onde vem a diferença</h3>
                    <div className="mt-3">
                      <LinhaALinha linhas={linhasCupons} nomes={nomes} slugs={slugs} />
                    </div>
                  </div>
                  <details className="border-t border-linha" data-o-que-e-cada-parcela-recolhido="">
                  <summary className={RESUMO_MAIS}>O que é cada parcela, em palavras simples</summary>
                  <dl className="grid gap-x-10 gap-y-4 pb-3 pt-1 md:grid-cols-2 lg:grid-cols-3" data-o-que-e-cada-parcela="">
                    {PARTES.map((p) => (
                      <Campo key={p.id} rotulo={p.rotulo}>
                        {p.explica}
                      </Campo>
                    ))}
                  </dl>
                  </details>
                </div>
              }
            >
              <div data-grafico="cupons-lado-a-lado">
                <CuponsLadoALado
                  cupons={selecionadas.map((x, i) => ({
                    slug: x.slug,
                    nome: x.emp.nome,
                    legenda: `Exercício de ${ano}${x.p ? `, demonstração ${x.p.base === "individual" ? "individual" : "consolidada"}` : ""}`,
                    perfil: perfis[i],
                    corpo: <CorpoDaPonte x={x} ano={ano} hrefAno={hrefAno} />,
                  }))}
                />
              </div>
            </FiguraAnalitica>

            <FiguraAnalitica
              id="caixa"
              pergunta="Para onde foi o caixa?"
              subtitulo={`Do que a operação gerou ao que sobra depois dos investimentos · R$ por R$ 100 de receita líquida, com o valor em reais · ${lista(nomes)} · exercício de ${ano}`}
              natureza="OBSERVADO"
              proveniencia={provCvm(e, {
                indicador: "Caixa das atividades operacionais, variações de capital de giro e investimentos", natureza: "OBSERVADO", unidade: "reais correntes", inicio: String(ano), fim: String(ano),
                limitacoes: [e.formulas["var_estoques, var_fornecedores, var_recebiveis"] ? `Capital de giro: ${e.formulas["var_estoques, var_fornecedores, var_recebiveis"]}.` : "", e.formulas.capex ? `Investimentos: ${e.formulas.capex}.` : ""].filter(Boolean),
              })}
              complementares={[
                { rotulo: "Sobre o caixa depois do convênio", p: provCvm(e, { indicador: "Caixa operacional depois dos pagamentos de convênio de fornecedores", natureza: "CALCULADO", unidade: "reais correntes", inicio: String(ano), fim: String(ano), formula: e.formulas.caixa_operacional_apos_convenio }) },
              ]}
              leitura={
                <LeituraGuiada>
                  {selecionadas.some((x) => x.p) ? (
                    <>
                      Em {ano}, o caixa operacional declarado foi de {lista(selecionadas.filter((x) => x.p).map((x) => `${reais(caixaDe(x.p).operacional)} em ${x.emp.nome}`))}.
                      {comConvenio.length > 0 && <> Descontados os pagamentos a fornecedores por convênio, que a companhia apresenta no fluxo de financiamento, ficou em {lista(comConvenio.map((x) => `${reais(caixaDe(x.p).aposConvenio)} em ${x.emp.nome}`))}.</>}
                    </>
                  ) : (
                    <>Nenhuma das empresas escolhidas tem demonstração de {ano} na base.</>
                  )}
                </LeituraGuiada>
              }
              ressalva={
                comConvenio.length > 0 ? (
                  <>
                    <span className="font-medium">O convênio de fornecedores muda a leitura do caixa.</span> No convênio (ou risco sacado), o banco paga o fornecedor antes do prazo e a varejista passa a dever ao banco. Algumas companhias mostram o
                    pagamento dessa dívida como financiamento, e não como operação: o caixa operacional declarado fica maior, porque a compra da mercadoria deixa de pesar nele. Somar os dois devolve a compra ao lugar e permite comparar
                    com quem paga o fornecedor direto.
                  </>
                ) : (
                  "Nenhuma das empresas escolhidas apresenta pagamentos a fornecedores por convênio no fluxo de financiamento neste exercício; o caixa operacional declarado já traz a compra de mercadorias."
                )
              }
              comoInterpretar="Leia cada cascata de cima para baixo. As barras escuras são patamares do caixa, a partir do zero; entre elas, cada passo parte de onde o anterior parou: para a direita liberou caixa, para a esquerda consumiu. Tudo em R$ por R$ 100 de receita líquida, na mesma escala em todas as companhias; o valor em reais vem embaixo. O primeiro patamar é conta desta página: o caixa operacional declarado menos as três variações de capital de giro."
              naoConcluir="que caixa operacional alto prova saúde financeira: ele sobe quando a empresa alonga o prazo dos fornecedores ou antecipa recebíveis, e o efeito pode se desfazer no exercício seguinte."
              tabela={{
                titulo: `Caixa operacional, capital de giro e investimentos, R$ bilhões, ${ano}`,
                colunas: ["Companhia", "Caixa operacional declarado", "Variação de estoques", "Variação de fornecedores", "Variação de contas a receber", "Pagamentos de convênio no financiamento", "Caixa operacional depois do convênio", "Investimentos (saída)"],
                linhas: selecionadas.map((x) => {
                  const cx = caixaDe(x.p);
                  const bi = (v: number | null) => (v === null ? null : v / 1e9);
                  return [x.emp.nome, bi(cx.operacional), bi(cx.estoques), bi(cx.fornecedores), bi(cx.recebiveis), bi(cx.convenio), bi(cx.aposConvenio), bi(cx.investimentos)];
                }),
                casas: [null, 2, 2, 2, 2, 2, 2, 2],
                limite: selecionadas.length,
              }}
              complemento={
                <div className="space-y-6">
                  {notasConvenio.length > 0 && (
                    <details className="border-t border-linha" data-como-descrevem-o-convenio="">
                      <summary className={RESUMO_MAIS}>Como cada companhia descreve o convênio nas notas das demonstrações, com a página</summary>
                      <div className={`grid gap-x-10 gap-y-6 pb-3 pt-1 ${notasConvenio.length > 1 ? "lg:grid-cols-2" : ""}`}>
                        {notasConvenio.map(({ x, o }) => (
                          <div key={x.slug} className="min-w-0">
                            <p className="rotulo text-mineral">{x.emp.nome}</p>
                            <p className="mt-2 text-sm leading-relaxed text-carvao">{textoCurado(o!.nota)}</p>
                            <p className="t-meta mt-2 text-carvao-muted">
                              <FonteDocumento f={o!.fonte} prefixo="Fonte: " />
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              }
            >
              <div data-grafico="cascata-do-caixa">
                <LegendaDaCascata comConvenio={comConvenio.length > 0} />
                <div className="mt-5">
                  <CaixasLadoALado selecionadas={selecionadas} ano={ano} hrefAno={hrefAno} />
                </div>
              </div>
            </FiguraAnalitica>

            <Recolhido
              id="o-que-sobrevive"
              aberto
              nivelTitulo={2}
              titulo={dois ? "Quais diferenças não dependem do ano?" : "Onde as companhias se afastam, medida a medida"}
              resumo={
                dois
                  ? `${dois[0].emp.nome} e ${dois[1].emp.nome} em ${num(pers.length)} medidas relativas, nos ${num(Math.max(0, ...pers.map((p) => p.comparaveis)))} exercícios em que as duas têm demonstração.`
                  : `${lista(nomes)} em ${num(emPontos.length)} medidas relativas, no exercício de ${ano}. Com duas companhias, a página mostra também em quantos exercícios a diferença se repete.`
              }
            >
              <PontosConectados medidas={emPontos} nomes={nomes} persistencia={persistenciaDesenhada} />
              <p className="t-meta mt-3 max-w-prose2 text-carvao-muted">
                Exercício de {ano}. Medidas relativas (por receita líquida, por custo), calculadas das demonstrações entregues à CVM; as fórmulas estão no método. Cada marca é uma companhia; o traço liga a menor à maior. Estar mais à direita não é estar melhor: despesa maior e margem maior ficam do mesmo lado.
              </p>
            {dois && (
              <div className="mt-8 border-t border-linha pt-5">
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-leitura-do-par="">
                  {repetem.length > 0 ? (
                    <>
                      Mantêm o mesmo sinal em todos os exercícios comparáveis: {lista(repetem.map((p) => `${p.medida.rotulo.toLowerCase()} (${p.aAcima === p.comparaveis ? dois[0].emp.nome : dois[1].emp.nome} acima nos ${num(p.comparaveis)})`))}.{" "}
                    </>
                  ) : (
                    <>Nenhuma das medidas manteve o mesmo sinal em todos os exercícios comparáveis. </>
                  )}
                  {trocam.length > 0 && <>Mudam de lado conforme o ano: {lista(trocam.map((p) => `${p.medida.rotulo.toLowerCase()} (${dois[0].emp.nome} acima em ${num(p.aAcima)} de ${num(p.comparaveis)})`))}. </>}
                  {(() => {
                    const va = variacaoDaReceita(dois[0].emp, ano);
                    const vb = variacaoDaReceita(dois[1].emp, ano);
                    return va !== null && vb !== null ? (
                      <>
                        Em {ano}, a receita líquida variou {variacao(va)} em {dois[0].emp.nome} e {variacao(vb)} em {dois[1].emp.nome} sobre o exercício anterior, em valores nominais.
                      </>
                    ) : null;
                  })()}
                </p>
                <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
                  Uma diferença que se repete em todos os anos não é efeito do exercício escolhido. Ela ainda pode vir do perímetro de cada demonstração e do tipo de negócio, que os avisos acima e as fichas descrevem; a repetição não
                  aponta a causa.
                </p>
                <details className="mt-3 border-t border-linha" data-tabela-das-medidas="">
                  <summary className={RESUMO_MAIS}>Ver as medidas em tabela, com a menor e a maior diferença nos exercícios</summary>
                  <TabelaDados
                    recolhida={false}
                    idioma="pt"
                    titulo={`${dois[0].emp.nome} e ${dois[1].emp.nome}: medidas relativas em ${ano} e repetição nos exercícios comparáveis`}
                    colunas={["Medida", `${dois[0].emp.nome}, ${ano}`, `${dois[1].emp.nome}, ${ano}`, `Diferença em ${ano}`, "Menor diferença nos exercícios", "Maior diferença nos exercícios", "A diferença se repete?"]}
                    linhas={pers.map((p) => [
                      `${p.medida.rotulo}, ${p.medida.unidade}`,
                      p.a,
                      p.b,
                      p.diferenca,
                      p.menor,
                      p.maior,
                      p.comparaveis < 2 ? "um só exercício comparável" : p.repete ? `sim, nos ${num(p.comparaveis)} exercícios` : `não: ${dois[0].emp.nome} acima em ${num(p.aAcima)} de ${num(p.comparaveis)}`,
                    ])}
                    casas={[null, 1, 1, 1, 1, 1, null]}
                    limite={pers.length}
                    fixarPrimeiraColuna
                    nota={`Diferença: ${dois[0].emp.nome} menos ${dois[1].emp.nome}, em pontos percentuais nas medidas em % e em dias nas de estoque e fornecedores. Valores publicados em cada exercício, sem ajuste de perímetro.`}
                  />
                </details>
                {par && apoio.length > 0 && (
                  <div className="mt-8 border-t border-linha pt-5" data-par-preparado={par.id}>
                    <h3 className="t-h3 text-carvao">O que os documentos das duas dizem sobre a operação em {ano}</h3>
                    <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
                      Indicadores que cada companhia divulga, lidos na ficha do grupo. As definições não são idênticas entre as duas: o nome completo de cada série vem abaixo do valor.
                    </p>
                    <ApoioNaCuradoria itens={apoio} fichas={[fichas[0], fichas[1]]} nomes={[dois[0].emp.nome, dois[1].emp.nome]} ano={ano} />
                  </div>
                )}
                {fichas.some((f) => (f?.fontes_de_receita ?? []).length > 0) && (
                  <details className="mt-6 border-t border-linha" data-receitas-do-par="">
                    <summary className={RESUMO_MAIS}>O que entra na receita de cada uma: mercadoria, serviços, comissões e crédito</summary>
                    <p className="t-meta max-w-prose2 text-carvao-muted">A receita líquida das demonstrações soma tudo o que a companhia fatura. Quando uma tem atacado, marketplace ou crédito em peso diferente, margens e prazos mudam por composição, não por desempenho.</p>
                    <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
                      {dois.map((x, i) => (
                        <div key={x.slug} className="min-w-0">
                          <p className="rotulo text-mineral">
                            {x.emp.nome}
                            {x.p ? `, demonstração ${x.p.base === "individual" ? "individual" : "consolidada"}` : ""}
                          </p>
                          {(fichas[i]?.fontes_de_receita ?? []).length > 0 ? (
                            <dl className="mt-2">
                              {(fichas[i]?.fontes_de_receita ?? []).map((r) => (
                                <div key={r.nome} className="border-t border-linha py-2">
                                  <dt className="text-sm font-medium text-carvao">{textoCurado(r.nome)}</dt>
                                  <dd className="mt-0.5 text-sm leading-relaxed text-carvao-muted">{textoCurado(r.descricao) || <NaoDivulgado>valor não divulgado</NaoDivulgado>}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="mt-2 text-sm">
                              <NaoDivulgado>sem ficha de grupo: composição da receita não registrada</NaoDivulgado>
                            </p>
                          )}
                          {fichas[i] && (
                            <Link href={hrefFicha(fichas[i]!.slug)} prefetch={false} className={`mt-1 inline-flex min-h-[44px] items-center text-sm ${LINK}`}>
                              Abrir a ficha de {x.emp.nome}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            </Recolhido>
            {eventos.length > 0 && (
              <Recolhido id="eventos" nivelTitulo={2} titulo={`O que aconteceu com cada grupo de ${ano} em diante`} resumo="Recuperações judiciais, reapresentações, compras, vendas de negócios e mudanças de controle registradas nas fichas, com o documento de origem.">
                <div data-eventos-da-comparacao="">
                  <div className={`grid gap-x-10 gap-y-6 ${eventos.length > 1 ? "md:grid-cols-2" : ""}`}>
                    {eventos.map((g) => (
                      <div key={g.x.slug} className="min-w-0">
                        <p className="rotulo text-mineral">{g.x.emp.nome}</p>
                        <ul className="mt-2 space-y-3">
                          {g.lista.map((ev, i) => (
                            <li key={i} className="text-sm leading-relaxed text-carvao">
                              <span className="font-medium">
                                {mesDaData(ev.data)}, {(TIPO_EVENTO[ev.tipo ?? "outro"] ?? TIPO_EVENTO.outro).toLowerCase()}.
                              </span>{" "}
                              {textoCurado(ev.descricao)}
                              <span className="t-meta mt-1 block text-carvao-muted">
                                <FonteDocumento f={ev.fonte} prefixo="Fonte: " />
                              </span>
                            </li>
                          ))}
                        </ul>
                        {g.slugFicha && (
                          <Link href={hrefFicha(g.slugFicha)} prefetch={false} className={`mt-1 inline-flex min-h-[44px] items-center text-sm ${LINK}`}>
                            Linha do tempo completa na ficha de {g.x.emp.nome}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Recolhido>
            )}

            <Recolhido id="lado-a-lado" aberto nivelTitulo={2} titulo={`Lado a lado no exercício de ${ano}`} resumo="Os indicadores das demonstrações de cada companhia no mesmo exercício, com a dívida líquida e o passivo de arrendamento em colunas separadas, e o arquivo do recorte.">
              <TabelaDados
                recolhida={false}
                idioma="pt"
                titulo={`Companhias comparadas, exercício de ${ano}`}
                colunas={COLUNAS}
                linhas={selecionadas.map(linhaTabela)}
                casas={[null, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, null]}
                limite={selecionadas.length}
                fixarPrimeiraColuna
                ausencia={{ "Caixa operacional depois do convênio, R$ bilhões": "não apresenta convênio" }}
                nota="Empresa sem demonstração no exercício aparece com as células sem dado; nenhum outro exercício entra no lugar."
              />
              <ExportarRecorte
                nome={`varejo-comparador-${slugs.join("-")}-${ano}`}
                colunas={[
                  "companhia", "exercicio", "base", "receita_liquida_reais", "margem_bruta_pct", "margem_operacional_pct", "margem_liquida_pct", "lucro_liquido_reais",
                  ...PARTES.map((p) => `ponte_${p.id}_reais_por_100`), "caixa_operacional_reais", "var_estoques_reais", "var_fornecedores_reais", "var_recebiveis_reais", "convenio_no_financiamento_reais", "caixa_operacional_apos_convenio_reais",
                  "investimentos_reais", "divida_liquida_sem_arrendamento_reais", "passivo_arrendamento_reais", "documento_cvm",
                ]}
                linhas={selecionadas.map((x) => {
                  const p = x.p;
                  const cx = caixaDe(p);
                  const b = p?.ponte_100;
                  return [
                    x.emp.nome, ano, p?.base ?? null, p?.receita_liquida ?? null, p?.margem_bruta_pct ?? null, p?.margem_operacional_pct ?? null, p?.margem_liquida_pct ?? null, p?.lucro_liquido ?? null,
                    ...PARTES.map((parte) => (b ? b[parte.campo] : null)), cx.operacional, cx.estoques, cx.fornecedores, cx.recebiveis, cx.convenio, cx.aposConvenio, cx.investimentos,
                    p?.divida_liquida_sem_arrendamento ?? null, p?.passivo_arrendamento ?? null, p?.documento?.link ?? null,
                  ];
                })}
                recorte={`${lista(nomes)}, exercício de ${ano}`}
                fonte={`${e.fontes.dfp.orgao}, ${e.fontes.dfp.nome}`}
              />
            </Recolhido>
          </>
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Receita líquida", definicao: "O que a companhia faturou depois de tirar os impostos sobre a venda, as devoluções e os descontos. É o ponto de partida da conta dos R$ 100." },
            { termo: "R$ por R$ 100", definicao: "Cada rubrica dividida pela receita líquida e multiplicada por 100. Permite comparar empresas de tamanhos diferentes.", exemplo: comDado[0] ? `${comDado[0].emp.nome}, ${ano}: custo da mercadoria de ${por100(-comDado[0].p!.ponte_100!.custo)} a cada R$ 100.` : undefined },
            { termo: "Margem bruta e margem operacional", definicao: `Bruta: o que sobra da receita depois do custo da mercadoria. Operacional: o que sobra depois também das despesas da operação, antes dos juros e do imposto.`, exemplo: comDado[0] ? `${comDado[0].emp.nome}, ${ano}: margem bruta de ${pct(comDado[0].p!.margem_bruta_pct)}.` : undefined },
            { termo: "Capital de giro", definicao: "O dinheiro preso em estoque e em vendas a prazo, menos o prazo que os fornecedores dão. Quando o estoque cresce, o caixa diminui, mesmo com lucro." },
            { termo: "Convênio de fornecedores (risco sacado)", definicao: "O banco paga o fornecedor antes do vencimento e a varejista paga o banco depois. A dívida com o fornecedor vira dívida com o banco, e o pagamento pode sair do fluxo operacional para o de financiamento." },
            { termo: "Passivo de arrendamento", definicao: "O valor presente dos aluguéis de longo prazo de lojas e centros de distribuição, que a contabilidade registra como obrigação, ao lado da dívida bancária." },
            { termo: "Individual e consolidada", definicao: "A demonstração consolidada soma a companhia e as empresas que ela controla. A individual é só a companhia; aparece aqui quando ela não tem controladas a consolidar." },
            { termo: "Pontos percentuais", definicao: `A diferença entre duas porcentagens. De 20% para 25% são 5 pontos percentuais (${pontos(5)}), não 5%.` },
          ],
          nota: (
            <>
              Para saber quem são os grupos, suas marcas e os eventos de cada um:{" "}
              <Link href={ROTA_GRUPOS} prefetch={false} className={LINK}>
                {paginaVarejo("grupos").pergunta}
              </Link>
            </>
          ),
        }}
        metodo={
          <>
            <p>
              {e.fontes.dfp.orgao}, {e.fontes.dfp.nome}:{" "}
              <a href={e.fontes.dfp.url} rel="noopener noreferrer" target="_blank" className={LINK}>
                conjunto de dados abertos
              </a>
              . Exercícios de {anos[0]} a {anos[anos.length - 1]}. Consultado em {dataBr(e.fontes.dfp.capturado_em)}. Demonstrações consolidadas; individuais quando a companhia não tem controladas, com a base marcada em cada empresa.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {(["ponte_100", "margem_bruta_pct", "margem_operacional_pct", "margem_liquida_pct", "caixa_operacional_apos_convenio", "capex", "var_estoques, var_fornecedores, var_recebiveis", "divida_liquida_sem_arrendamento"] as const)
                .filter((k) => e.formulas[k])
                .map((k) => (
                  <li key={k}>{e.formulas[k]}</li>
                ))}
              <li>Dias de estoque e de fornecedores: saldo do fim do exercício ÷ custo da mercadoria vendida no exercício × 365.</li>
              <li>A ponte fecha quando R$ 100 mais as parcelas e o lucro divulgado dividido pela receita líquida coincidem com o lucro por R$ 100, com tolerância de R$ 0,05.</li>
            </ul>
            <p>
              Os indicadores operacionais, as fontes de receita, os eventos e a descrição do convênio vêm das fichas dos grupos, que são curadoria da Scrutiniums sobre documentos públicos, com fonte em cada item. Companhia fora dos
              20 maiores grupos não tem ficha e entra só com as demonstrações.{" "}
              <Link href={ROTA_METODO} prefetch={false} className={LINK}>
                Fontes, fórmulas, correspondência com o IBGE e lacunas
              </Link>
              .
            </p>
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
      />
    </>
  );
}
