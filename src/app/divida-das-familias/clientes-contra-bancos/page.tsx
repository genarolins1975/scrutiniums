import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada, PaginaPainel, TabelaDados, type NumeroProps } from "@/components/painel";
import { BaixarCsv } from "@/components/familias/clientes-contra-bancos/BaixarCsv";
import { OpcoesRecorte } from "@/components/familias/clientes-contra-bancos/OpcoesRecorte";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { hrefComRecorte, parametroEntre, type ParametrosPagina } from "@/lib/painel/recorte";
import { num } from "@/lib/perguntas/leitura";
import {
  DESCRICAO_CLIENTES_CONTRA_BANCOS,
  NOME_RAMO,
  PERGUNTA_CLIENTES_CONTRA_BANCOS,
  RAMOS,
  ROTA_CLIENTES_CONTRA_BANCOS,
  SECAO_CLIENTES_CONTRA_BANCOS,
  TITULO_CLIENTES_CONTRA_BANCOS,
  competencia,
  csvAssuntos,
  dataEscala,
  diaBr,
  goldJudicial,
  nomeFonte,
  prosa,
  provenienciaNacional,
  provenienciaNominal,
  recorteDoRamo,
  rotuloCategoria,
  type Ramo,
} from "@/lib/familias/clientes-contra-bancos";

/** O ramo da Justiça vem de ?ramo= (o servidor lê o parâmetro e a página já sai no recorte pedido). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: tituloNaColecao(TITULO_CLIENTES_CONTRA_BANCOS, ROTA_CLIENTES_CONTRA_BANCOS),
  description: DESCRICAO_CLIENTES_CONTRA_BANCOS,
  alternates: { canonical: ROTA_CLIENTES_CONTRA_BANCOS },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
const ROTA_COBRANCA = "/divida-das-familias/bancos-cobrando-na-justica";
/** Tokens de série comuns (bronze, o --serie-3, é destaque e fica fora). */
const CORES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-4)", "var(--serie-5)"] as const;
const n0 = (v: number) => num(v, 0);

function Cabecalho() {
  return (
    <header>
      <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_CLIENTES_CONTRA_BANCOS} fontes={["credito"]} />
      <NavegacaoColecao colecao="divida" />
    </header>
  );
}

/**
 * Painel "Clientes contra bancos na Justiça" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta.
 * Reescrita em página Next da vista `judicial` da aplicação do Crédito (/observatorio/lawsuits, renderJudicial em
 * public/obs/app.js), no molde de painel, lendo a mesma gold (public/obs/data/gold/judicial.json) e mostrando os mesmos valores.
 *
 * Duas bases que não se cruzam: a nacional (DataJud, por assunto e tribunal, sem instituição) e a nominal (os dez maiores
 * litigantes do TST no mês). A coleta da base está retida desde 24/09/2026: a abertura, cada número e cada figura levam a data
 * que a gold declara, e o aviso logo abaixo da abertura diz isso em palavras.
 */
export default function ClientesContraBancosPage({ searchParams = {} }: { searchParams?: ParametrosPagina }) {
  const g = goldJudicial();
  if (!g.disponivel) {
    return (
      <>
        <Cabecalho />
        <main id="conteudo" tabIndex={-1} className="ed-pagina pb-6">
          <h1 className="t-h1 max-w-4xl text-carvao">{TITULO_CLIENTES_CONTRA_BANCOS}</h1>
          <p className="t-lead mt-3 max-w-3xl text-carvao-muted">Esta base não está disponível nesta publicação. Nenhum número é mostrado no lugar dela.</p>
          <p className="t-meta mt-3 max-w-prose2 text-carvao-muted">{g.motivo}</p>
        </main>
      </>
    );
  }

  const ramo: Ramo = parametroEntre(searchParams, "ramo", RAMOS, "civel");
  const r = recorteDoRamo(g, ramo);
  const N = g.camada_nacional;
  const B = g.camada_nominal;
  const coletado = diaBr(g.coletado_em);
  const acervo = `acervo coletado em ${coletado}`;
  const comp = competencia(B.competencia);
  const escala = dataEscala(B.data_escala);
  const nRamo = (x: Ramo) => N.tribunais.filter((t) => t.ramo === x).length;
  const civel = ramo === "civel";
  const temas = civel ? "temas bancários cíveis" : "temas trabalhistas";
  const universoRamo = `${NOME_RAMO[ramo]}, ${r.tribunais.length} tribunais`;
  const FONTE_DATAJUD = "CNJ, DataJud";

  const numeros: NumeroProps[] = [
    {
      rotulo: "Casos únicos",
      valor: r.casos,
      formato: "inteiro",
      unidade: "processos",
      periodo: acervo,
      recorte: temas,
      fonte: FONTE_DATAJUD,
      natureza: "CALCULADO",
      tamanho: "m",
      nota: "Processos distintos pelo número único do CNJ. A contagem é aproximada, com erro típico abaixo de 1%.",
    },
    {
      rotulo: "Registros (tramitações)",
      valor: r.registros,
      formato: "inteiro",
      unidade: "registros",
      periodo: acervo,
      recorte: temas,
      fonte: FONTE_DATAJUD,
      natureza: "CALCULADO",
      tamanho: "m",
      nota: "O mesmo caso em primeiro e em segundo grau conta duas vezes. Não é número de litígios.",
    },
    r.registrosPorCaso === null
      ? { rotulo: "Registros por caso", valor: null, motivoAusencia: "O ramo não tem caso no acervo coletado, e a razão não se calcula.", unidade: "registros por caso", periodo: acervo, fonte: FONTE_DATAJUD, natureza: "CALCULADO", tamanho: "m" }
      : {
          rotulo: "Registros por caso",
          valor: r.registrosPorCaso,
          casas: 2,
          unidade: "registros por caso",
          periodo: acervo,
          recorte: temas,
          fonte: FONTE_DATAJUD,
          natureza: "CALCULADO",
          tamanho: "m",
          nota: "Razão alta indica que mais casos passaram por recurso. Não mede gravidade.",
        },
    {
      rotulo: "Tribunais cobertos",
      valor: r.tribunais.length,
      formato: "inteiro",
      unidade: "tribunais",
      periodo: acervo,
      recorte: NOME_RAMO[ramo],
      fonte: FONTE_DATAJUD,
      natureza: "CALCULADO",
      tamanho: "m",
      nota: r.tribunais.map((t) => t.tribunal).join(", "),
    },
  ];

  // ---------- camada nacional: natureza da ação, assuntos e tribunais ----------
  const cats = r.categorias;
  const top = r.assuntos.slice(0, 12);
  const serieCats = r.ordemCategorias.map((id, i) => ({ id, rotulo: rotuloCategoria(g, id), cor: CORES[i % CORES.length] }));
  const maior = cats[0];
  const ressalvaPartes = civel
    ? "A base não identifica as partes. Uma indenização por dano moral entra na contagem mesmo quando o réu não é um banco, e as ações de garantia e cobrança costumam ser movidas pela instituição, não contra ela."
    : "A base não identifica as partes. Os assuntos trabalhistas contam processos contra qualquer empregador, não só contra bancos.";

  // ---------- camada nominal: os dez maiores litigantes do TST ----------
  const linhas = B.linhas ?? [];
  const ifs = linhas.filter((l) => l.eh_if && l.por_100bi_ativo != null);
  const quando = comp ?? "competência não informada pela fonte";

  const hrefRamo = (x: Ramo) => hrefComRecorte(ROTA_CLIENTES_CONTRA_BANCOS, { ramo: x }, { ramo: "civel" });

  return (
    <>
      <MarcaVisita secao={SECAO_CLIENTES_CONTRA_BANCOS} />
      <Cabecalho />
      <PaginaPainel
        rota={ROTA_CLIENTES_CONTRA_BANCOS}
        idioma="pt"
        abertura={{
          acento: "bronze",
          titulo: PERGUNTA_CLIENTES_CONTRA_BANCOS,
          lead: `Processos sobre contratos bancários, indenizações e garantias em ${N.n_tribunais} tribunais, e os bancos entre os dez maiores litigantes do TST. São duas bases que não se cruzam: a primeira não identifica nenhuma instituição.`,
          recorte: {
            periodo: `${acervo}; TST, ${quando}`,
            universo: `${nRamo("civel")} tribunais de Justiça, ${nRamo("trabalhista")} tribunais do Trabalho e o TST`,
            unidade: "casos únicos",
            fonte: "CNJ, DataJud; TST, Ranking das Partes",
          },
          limite:
            "que um banco age de forma irregular ou atende pior. O volume de processos depende do tamanho da instituição, do perfil dos clientes, de onde ela atua e da prática local de recorrer à Justiça, e a base nacional não diz quem são as partes.",
          acao: (
            <Controles rotulo="Ramo da Justiça" idioma="pt" resumo={`Mostrando ${NOME_RAMO[ramo]}: ${r.tribunais.length} tribunais.`}>
              <OpcoesRecorte rotulo="Ramo da Justiça" opcoes={RAMOS.map((x) => ({ rotulo: NOME_RAMO[x], href: hrefRamo(x), atual: x === ramo }))} />
            </Controles>
          ),
          fontesDatasSiglas: (
            <>
              <p>
                {nomeFonte(N.fonte)}: coleta em {coletado}; publicação gerada em {diaBr(g.gerado_em)}. {nomeFonte(B.fonte)}: competência {quando}
                {escala ? <>; tamanho das instituições pelo IF.data do Banco Central, data-base {escala}</> : null}.
              </p>
              <p>
                <span className="font-medium">CNJ:</span> Conselho Nacional de Justiça. <span className="font-medium">DataJud:</span> base nacional de dados processuais do CNJ.{" "}
                <span className="font-medium">TPU:</span> Tabelas Processuais Unificadas, a lista oficial de assuntos e classes dos processos.{" "}
                <span className="font-medium">TST:</span> Tribunal Superior do Trabalho. <span className="font-medium">TJ:</span> Tribunal de Justiça estadual.{" "}
                <span className="font-medium">TRT:</span> Tribunal Regional do Trabalho. <span className="font-medium">IF.data:</span> base de balanços das instituições financeiras, do Banco Central.
              </p>
            </>
          ),
        }}
        aviso={
          <aside aria-label="Antes de ler estes números" data-aviso-base="" className="mt-6 border-l-2 border-bronze bg-marfim px-4 py-3 text-sm leading-relaxed text-carvao">
            <p className="font-medium" data-data-da-base="">
              Os números desta página são do acervo coletado em {coletado}. A base não é atualizada desde então.
            </p>
            <p className="mt-1 text-carvao-muted">
              As coletas seguintes não reuniram todos os tribunais, e a plataforma mantém a última publicação completa em vez de mostrar uma parcial. O ranking do TST é o de {quando}.
            </p>
            <p className="mt-3">{prosa(g.limitacao_central)}</p>
            <ul className="mt-2 space-y-1 text-carvao-muted">
              <li>
                <span className="font-medium text-carvao">Base nacional:</span> {N.n_tribunais} tribunais, {n0(N.total_civel_casos + N.total_trabalhista_casos)} casos únicos. Não identifica instituição.
              </li>
              <li>
                <span className="font-medium text-carvao">Base nominal:</span> {quando}, {B.n_ifs} instituições financeiras entre os dez maiores litigantes. Somente o TST.
              </li>
            </ul>
            <p className="mt-3 text-carvao-muted">{prosa(g.aviso_permanente)}</p>
          </aside>
        }
        rotuloNumeros={`Base nacional, ${NOME_RAMO[ramo]}, ${acervo}`}
        numeros={numeros}
        notaNumeros={`Base nacional do DataJud, ${universoRamo}. As contagens são do acervo acumulado de cada tribunal, sem recorte de ano: as datas de ajuizamento da base não permitem montar uma série anual confiável. O motivo está na figura dos tribunais.`}
        figuras={
          <>
            <FiguraAnalitica
              id="natureza"
              idioma="pt"
              pergunta={civel ? "Quais temas bancários mais ocupam a Justiça comum?" : "Quais temas mais ocupam a Justiça do Trabalho?"}
              subtitulo={`Casos únicos por natureza da ação · ${universoRamo} · ${acervo} · não atribuível a instituição`}
              natureza="CALCULADO"
              proveniencia={provenienciaNacional(g, { indicador: `Casos únicos por natureza da ação, ${NOME_RAMO[ramo]}`, natureza: "CALCULADO", unidade: "casos únicos" })}
              leitura={
                maior ? (
                  <LeituraGuiada>
                    {prosa(maior.rotulo)} é o maior grupo deste ramo, com {n0(maior.casos_unicos)} casos únicos, {num(maior.part, 1)}% do total. A comparação principal usa casos únicos, contados pelo número único do CNJ.
                  </LeituraGuiada>
                ) : undefined
              }
              ressalva={ressalvaPartes}
              comoInterpretar={prosa(N.nota_polo)}
              porQueImporta="Processo é custo para o banco e para o cliente, sinal de atrito entre os dois e possível despesa futura para a instituição."
              naoConcluir="quantas ações cada banco responde nem quem tem razão. A base nacional conta processos por assunto e não informa autor nem réu."
              tabela={{
                titulo: `Casos únicos e registros por natureza da ação · ${universoRamo} · ${acervo}`,
                colunas: ["Natureza da ação", "Casos únicos", "% dos casos do ramo", "Registros", "Registros por caso"],
                linhas: cats.map((c) => [prosa(c.rotulo), c.casos_unicos, c.part, c.registros, c.razao_reg_caso]),
                casas: [null, 0, 1, 0, 2],
                limite: cats.length,
              }}
            >
              <GraficoBarras
                semTabela
                titulo="Casos únicos por natureza da ação"
                dados={cats.map((c) => ({ id: c.categoria, nome: prosa(c.rotulo), casos: c.casos_unicos }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[{ id: "casos", rotulo: "Casos únicos", cor: "var(--serie-1)" }]}
                unidade="casos"
                casas={0}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="assuntos"
              idioma="pt"
              pergunta="Quais são os assuntos mais frequentes?"
              subtitulo={`Casos únicos por assunto das Tabelas Processuais Unificadas · os ${top.length} mais frequentes de ${r.assuntos.length} · ${universoRamo} · ${acervo}`}
              natureza="CALCULADO"
              proveniencia={provenienciaNacional(g, { indicador: `Casos únicos por assunto, ${NOME_RAMO[ramo]}`, natureza: "CALCULADO", unidade: "casos únicos" })}
              leitura={
                top[0] ? (
                  <LeituraGuiada>
                    O assunto mais frequente é {top[0].nome}, com {n0(top[0].casos_unicos)} casos únicos. Os códigos dos assuntos foram descobertos por agregação nos índices reais dos tribunais: nenhum código foi presumido.
                  </LeituraGuiada>
                ) : undefined
              }
              ressalva="O mesmo processo pode ter mais de um assunto e entrar em mais de uma linha. Os assuntos não se somam."
              naoConcluir="o total de processos do ramo somando os assuntos, nem a parcela de cada banco. O gráfico mostra os mais frequentes; a tabela traz todos os assuntos coletados."
              tabela={{
                titulo: `Assuntos coletados · ${universoRamo} · ${acervo}`,
                colunas: ["Assunto", "Código TPU", "Natureza da ação", "Casos únicos", "Registros"],
                linhas: r.assuntos.map((a) => [a.nome, String(a.codigo), rotuloCategoria(g, a.categoria), a.casos_unicos, a.registros]),
                casas: [null, null, null, 0, 0],
                limite: r.assuntos.length,
              }}
              complemento={<BaixarCsv nome="judicial_assuntos.csv" conteudo={csvAssuntos(g)} rotulo="Baixar os assuntos dos dois ramos (CSV)" />}
            >
              <GraficoBarras
                semTabela
                titulo="Assuntos mais frequentes"
                dados={top.map((a) => ({ id: String(a.codigo), nome: a.nome, casos: a.casos_unicos }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[{ id: "casos", rotulo: "Casos únicos", cor: "var(--serie-1)" }]}
                unidade="casos"
                casas={0}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="tribunais"
              idioma="pt"
              pergunta="Como os temas se distribuem em cada tribunal?"
              subtitulo={`Casos únicos por tribunal e natureza da ação · ${universoRamo} · ${acervo}`}
              natureza="CALCULADO"
              proveniencia={provenienciaNacional(g, { indicador: `Casos únicos por tribunal e natureza da ação, ${NOME_RAMO[ramo]}`, natureza: "CALCULADO", unidade: "casos únicos" })}
              leitura={<LeituraGuiada>Leia cada barra por dentro: as partes mostram como os temas se dividem naquele tribunal. Cada parte são os casos únicos daquele grupo de assuntos no acervo do tribunal, não o total de processos do tribunal.</LeituraGuiada>}
              comoInterpretar={`Sem recorte temporal. ${prosa(N.nota_temporal)}`}
              naoConcluir="que um tribunal tem mais litígios bancários que outro. O acervo indexado varia por tribunal, por sistema de origem e por período de adesão ao DataJud; a leitura válida é a composição dentro de cada tribunal."
              tabela={{
                titulo: `Casos únicos por tribunal e natureza da ação · ${universoRamo} · ${acervo}`,
                colunas: ["Tribunal", "UF", ...serieCats.map((s) => s.rotulo), "Casos únicos no tribunal", "Registros no tribunal"],
                linhas: r.tribunais.map((t) => [t.tribunal, t.uf ?? null, ...serieCats.map((s) => t.por_categoria[s.id] ?? null), t.casos_unicos, t.registros]),
                casas: [null, null, ...serieCats.map(() => 0), 0, 0],
                limite: r.tribunais.length,
              }}
            >
              <GraficoBarras
                semTabela
                titulo="Casos únicos por tribunal e natureza da ação"
                dados={r.tribunais.map((t) => ({ id: t.tribunal, nome: t.uf ? `${t.tribunal} (${t.uf})` : t.tribunal, ...Object.fromEntries(serieCats.map((s) => [s.id, t.por_categoria[s.id] ?? null])) }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={serieCats}
                unidade="casos"
                casas={0}
                orientacao="horizontal"
                empilhado
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="litigantes"
              idioma="pt"
              pergunta="Quem são os maiores litigantes no TST?"
              subtitulo={`Casos novos no mês, por parte · os dez maiores litigantes · TST · ${quando}`}
              natureza="OBSERVADO"
              proveniencia={provenienciaNominal(g, { indicador: "Casos novos no TST no mês, dez maiores litigantes", natureza: "OBSERVADO", unidade: "processos por mês" })}
              leitura={
                <LeituraGuiada>
                  {B.n_ifs} das dez partes com mais casos novos no TST em {quando} são instituições financeiras. Entes públicos e empresas de outros setores aparecem porque o ranking é geral.
                </LeituraGuiada>
              }
              comoInterpretar="O ranking do TST traz o nome das partes e por isso permite identificar instituições. Em troca, cobre só o tribunal superior, só os dez maiores e só os casos novos do mês."
              ressalva={prosa(B.cobertura)}
              naoConcluir="o total de ações trabalhistas de cada instituição no país, nem que estar na lista indica conduta irregular. A ordem é a publicada pelo TST."
              tabela={{
                titulo: `Dez maiores litigantes do TST em casos novos · ${quando}`,
                colunas: ["Posição no ranking", "Parte, como publicada pelo TST", "É instituição financeira?", "Casos novos no mês", "% dos casos dos dez maiores"],
                linhas: linhas.map((l) => [`${l.posicao}º`, l.parte, l.eh_if ? "sim" : "não", l.processos, l.part_top10 ?? null]),
                casas: [null, null, null, 0, 2],
                limite: linhas.length,
              }}
            >
              <GraficoBarras
                semTabela
                titulo="Casos novos no TST no mês, dez maiores litigantes"
                dados={linhas.map((l) => ({ id: l.parte, nome: l.parte, banco: l.eh_if ? l.processos : null, outro: l.eh_if ? null : l.processos }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[
                  { id: "banco", rotulo: "Instituição financeira", cor: "var(--serie-1)", opcional: true },
                  { id: "outro", rotulo: "Ente público ou empresa de outro setor", cor: "var(--serie-2)", opcional: true },
                ]}
                unidade="processos"
                casas={0}
                orientacao="horizontal"
                empilhado
                rotulosValor
                rotulosSaoNomes
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="por-escala"
              idioma="pt"
              pergunta="E em relação ao tamanho de cada banco?"
              subtitulo={`Casos novos no TST por R$ 100 bilhões de ativo total · instituições financeiras entre os dez maiores litigantes · ${quando}${escala ? ` · ativo de ${escala}` : ""}`}
              natureza="CALCULADO"
              proveniencia={provenienciaNominal(g, {
                indicador: "Casos novos no TST por R$ 100 bilhões de ativo total",
                natureza: "CALCULADO",
                unidade: "processos por R$ 100 bilhões de ativo",
                formula: "casos novos no mês ÷ (ativo total ÷ R$ 100 bilhões)",
              })}
              leitura={
                <LeituraGuiada>
                  Só entram as instituições financeiras com tamanho conhecido no IF.data. As barras seguem a ordem do ranking do TST, não a do valor; a tabela mostra as duas medidas lado a lado.
                </LeituraGuiada>
              }
              comoInterpretar={`A divisão usa o ativo total do IF.data, do Banco Central${escala ? `, na data-base ${escala}` : ""}. A identificação de cada parte como instituição foi revisada à mão, com o grau de confiança na tabela.`}
              ressalva="Numerador e denominador têm períodos e perímetros diferentes: os processos são do mês no TST e o ativo é do conglomerado inteiro. É leitura de ordem de grandeza, não taxa exata."
              naoConcluir="que um banco é mais processado que outro em todo o país. A medida compara um mês de um único tribunal com o balanço inteiro da instituição."
              tabela={{
                titulo: `Instituições financeiras entre os dez maiores litigantes do TST · ${quando}`,
                colunas: ["Parte no TST", "Instituição identificada", "Entidade usada para o tamanho", "Confiança da identificação", "Casos novos no mês", "Por R$ 100 bilhões de ativo"],
                linhas: linhas.filter((l) => l.eh_if).map((l) => [l.parte, l.cod_if ?? null, l.entidade_escala ?? null, l.confianca, l.processos, l.por_100bi_ativo]),
                casas: [null, null, null, null, 0, 1],
                limite: linhas.length,
              }}
              depois={
                <p className="t-corpo max-w-prose2 text-carvao">
                  O outro lado do balcão, quando é o banco que entra com a ação, está em{" "}
                  <Link href={ROTA_COBRANCA} prefetch={false} className={link}>
                    Bancos cobrando na Justiça
                  </Link>
                  : execuções, buscas e apreensões e monitórias, mês a mês e por estado.
                </p>
              }
            >
              <GraficoBarras
                semTabela
                titulo="Casos novos no TST por R$ 100 bilhões de ativo total"
                dados={ifs.map((l) => ({ id: l.parte, nome: l.parte, valor: l.por_100bi_ativo }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[{ id: "valor", rotulo: "Casos novos por R$ 100 bilhões de ativo", cor: "var(--serie-1)" }]}
                unidade="processos por R$ 100 bi"
                casas={1}
                orientacao="horizontal"
                rotulosValor
                rotulosSaoNomes
              />
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <TabelaDados
            id="nao-calcula"
            idioma="pt"
            recolhida={false}
            tituloVisivel="O que esta página não calcula, e por quê"
            lead="Medidas que fariam sentido e que nenhuma base pública permite montar. Ficam declaradas como indisponíveis, sem estimativa no lugar."
            titulo="Medidas não calculadas e o motivo de cada uma"
            colunas={["Medida", "Por que não é calculada"]}
            linhas={g.denominadores_indisponiveis.map((d) => [d.metrica, prosa(d.motivo)])}
            limite={g.denominadores_indisponiveis.length}
            nota={prosa(g.privacidade)}
          />
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Caso único", definicao: "Um processo, contado uma vez pelo número único do CNJ, mesmo que tenha passado por mais de uma instância." },
            { termo: "Registro (tramitação)", definicao: "Cada passagem do processo por um grau da Justiça. O mesmo caso em primeiro e em segundo grau soma dois registros." },
            { termo: "Assunto (TPU)", definicao: "O tema do processo, escolhido numa lista nacional do CNJ quando a ação é cadastrada. Um processo pode ter mais de um." },
            { termo: "Base nacional", definicao: "O DataJud, do CNJ: informa assunto, classe, tribunal e movimentos, mas não informa quem são as partes. Por isso não aponta nenhum banco." },
            { termo: "Base nominal", definicao: "O Ranking das Partes do TST: traz o nome dos dez maiores litigantes do mês, só no tribunal superior do Trabalho." },
            { termo: "Revisional", definicao: "Ação em que o cliente pede à Justiça a revisão de um contrato bancário: juros, tarifas ou cláusulas." },
          ],
          nota: "As duas bases nunca se cruzam: a nacional não identifica instituições e a nominal cobre um único tribunal.",
        }}
        metodo={
          <>
            <p>
              Fontes: {nomeFonte(N.fonte)} (
              <a href="https://api-publica.datajud.cnj.jus.br/" className={link} rel="noopener noreferrer">
                api-publica.datajud.cnj.jus.br
              </a>
              ), coletada em {coletado}; {nomeFonte(B.fonte)} (
              <a href="https://www.tst.jus.br/web/estatistica/tst/ranking-das-partes" className={link} rel="noopener noreferrer">
                tst.jus.br
              </a>
              ), competência {quando}
              {escala ? <>; Banco Central, IF.data, data-base {escala}, para o tamanho das instituições</> : null}. Selos da página: observado para os metadados processuais do DataJud e o ranking publicado pelo TST;
              calculado para as agregações, os casos únicos e a divisão pelo tamanho.
            </p>
            <p>
              A publicação desta base está parada em {coletado}. Desde então as coletas diárias não reuniram todos os pares de tribunal e categoria, e a regra do pipeline é manter a última versão completa em vez de
              publicar um retrato parcial. Enquanto um tribunal faltar, a base nacional fica na data acima.
            </p>
            <TabelaDados
              idioma="pt"
              recolhida={false}
              titulo="Catálogo dos indicadores desta página"
              colunas={["Identificador", "Indicador", "Definição", "Fórmula", "Unidade", "Fonte", "Cobertura", "Limitações"]}
              linhas={g.catalogo.map((c) => [c.id, c.nome, prosa(c.definicao), prosa(c.formula), c.unidade, nomeFonte(c.fonte), prosa(c.cobertura), prosa(c.limitacoes)])}
              limite={g.catalogo.length}
            />
            <p>{prosa(g.privacidade)}</p>
            <p>
              A auditoria completa das fontes, com o teste de cada endereço e o motivo de cada base descartada, está no repositório do projeto (docs/AUDITORIA_JUDICIAL.md). Método geral em{" "}
              <Link href="/observatorio-do-credito/metodologia" prefetch={false} className={link}>
                Metodologia e fontes do Crédito
              </Link>{" "}
              e definições no{" "}
              <Link href="/glossario" prefetch={false} className={link}>
                glossário
              </Link>
              .
            </p>
          </>
        }
      />
    </>
  );
}
