import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { Controles, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel, TabelaDados, type NumeroProps } from "@/components/painel";
import { BaixarCsv } from "@/components/familias/bancos-cobrando-na-justica/BaixarCsv";
import { OpcoesRecorte } from "@/components/familias/bancos-cobrando-na-justica/OpcoesRecorte";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { hrefComRecorte, parametroEntre, type ParametrosPagina } from "@/lib/painel/recorte";
import { mesAno, num } from "@/lib/perguntas/leitura";
import {
  DESCRICAO_BANCOS_COBRANDO,
  MEDIDAS_UF,
  MEDIDA_UF,
  PERGUNTA_BANCOS_COBRANDO,
  ROTA_BANCOS_COBRANDO,
  SECAO_BANCOS_COBRANDO,
  TITULO_BANCOS_COBRANDO,
  classes,
  csvSerie,
  diaBr,
  goldCobranca,
  janelaTexto,
  nomeFonte,
  periodoSerie,
  prosa,
  provenienciaCobranca,
  serieDaClasse,
  seriePorVia,
  ufsOrdenadas,
  viaMaisUsada,
  type Classe,
  type MedidaUf,
} from "@/lib/familias/bancos-cobrando-na-justica";

/** A classe da série e a medida por UF vêm de ?classe= e ?medida= (o servidor lê e a página já sai no recorte pedido). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: tituloNaColecao(TITULO_BANCOS_COBRANDO, ROTA_BANCOS_COBRANDO),
  description: DESCRICAO_BANCOS_COBRANDO,
  alternates: { canonical: ROTA_BANCOS_COBRANDO },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
const ROTA_CLIENTES = "/divida-das-familias/clientes-contra-bancos";
const PAINEL_RECUPERACOES = "/observatorio/recoveries";
const PAINEL_ESTADOS = "/observatorio/states";
/** Tokens de série comuns (bronze, o --serie-3, é destaque e fica fora). */
const CORES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-4)", "var(--serie-5)"] as const;
const n0 = (v: number) => num(v, 0);
const pct0 = (v: number | null) => (v == null ? "parcela não publicada" : `${num(v, 0)}%`);

function Cabecalho() {
  return (
    <header>
      <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_BANCOS_COBRANDO} fontes={["credito"]} />
      <NavegacaoColecao colecao="divida" />
    </header>
  );
}

/**
 * Painel "Bancos cobrando na Justiça" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta. Reescrita em
 * página Next da vista `cobranca` da aplicação do Crédito (/observatorio/debt-collection-lawsuits, renderCobranca em
 * public/obs/app.js), no molde de painel, lendo a mesma gold (public/obs/data/gold/cobranca.json) e mostrando os mesmos valores.
 *
 * Uma fonte (DataJud, por agregação) e dois recortes que nunca se somam: assunto bancário e qualquer credor. Os meses que a gold
 * marca como parciais ficam fora dos números e dos gráficos. Nenhuma ação é atribuída a instituição.
 */
export default function BancosCobrandoNaJusticaPage({ searchParams = {} }: { searchParams?: ParametrosPagina }) {
  const g = goldCobranca();
  if (!g.disponivel) {
    return (
      <>
        <Cabecalho />
        <main id="conteudo" tabIndex={-1} className="ed-pagina pb-6">
          <h1 className="t-h1 max-w-4xl text-carvao">{TITULO_BANCOS_COBRANDO}</h1>
          <p className="t-lead mt-3 max-w-3xl text-carvao-muted">Esta base não está disponível nesta publicação. Nenhum número é mostrado no lugar dela.</p>
          <p className="t-meta mt-3 max-w-prose2 text-carvao-muted">{g.motivo}</p>
        </main>
      </>
    );
  }

  const B = g.brasil;
  const C = g.cobertura;
  const classe: Classe = parametroEntre(searchParams, "classe", classes(g), "todas");
  const medida: MedidaUf = parametroEntre(searchParams, "medida", MEDIDAS_UF, "por_mil_hab");
  const href = (r: { classe?: Classe; medida?: MedidaUf }) =>
    hrefComRecorte(ROTA_BANCOS_COBRANDO, { classe: r.classe ?? classe, medida: r.medida ?? medida }, { classe: "todas", medida: "por_mil_hab" });

  const periodo = periodoSerie(g);
  const serieToda = `${mesAno(periodo.inicio)} a ${mesAno(periodo.fim)}`;
  const janela = janelaTexto(g.janela_12m);
  const ate = `12 meses até ${mesAno(g.janela_12m.fim)}`;
  const parciais = g.meses_parciais.map((m) => mesAno(m)).join(", ");
  const tribunais = `${n0(C.tribunais)} tribunais estaduais`;
  const cobertura = C.faltam.length ? `${tribunais}; ainda não coletados: ${C.faltam.join(", ")}` : `${tribunais}, todos os estados e o Distrito Federal`;
  const coletado = diaBr(C.coletado_em);
  const dataScr = g.ufs.find((u) => u.data_scr)?.data_scr ?? null;
  const scr = dataScr ? mesAno(dataScr) : null;
  const FONTE = "CNJ, DataJud";
  const via = viaMaisUsada(g);
  const grupo = g.grupos.find((x) => x.id === classe) ?? null;
  const nomeClasse = grupo ? grupo.nome : "Todas as vias";

  const ausente = (rotulo: string, unidade: string, fonte: string): NumeroProps => ({
    rotulo,
    valor: null,
    motivoAusencia: "A gold não publicou esta razão nesta execução; falta o denominador de alguma UF coberta.",
    unidade,
    periodo: ate,
    fonte,
    natureza: "CALCULADO",
    tamanho: "m",
  });

  const numeros: NumeroProps[] = [
    {
      rotulo: "Ações de cobrança de crédito bancário",
      valor: B.casos_12m,
      formato: "inteiro",
      unidade: "casos",
      periodo: ate,
      recorte: "assunto bancário",
      fonte: FONTE,
      natureza: "CALCULADO",
      tamanho: "m",
      variacao: B.var_12m_pct == null ? undefined : { valor: B.var_12m_pct, base: "contra os 12 meses anteriores", unidade: "%", casas: 1 },
      nota: `${pct0(B.bancario_share)} das ações das mesmas classes com qualquer credor.`,
    },
    {
      rotulo: "Ações das mesmas classes, qualquer credor",
      valor: B.casos_12m_todos,
      formato: "inteiro",
      unidade: "casos",
      periodo: ate,
      recorte: "qualquer credor",
      fonte: FONTE,
      natureza: "CALCULADO",
      tamanho: "m",
      variacao: B.var_12m_todos_pct == null ? undefined : { valor: B.var_12m_todos_pct, base: "contra os 12 meses anteriores", unidade: "%", casas: 1 },
      nota: "Condomínio, locação, fornecedores e bancos. É contexto: não se soma ao recorte bancário.",
    },
    B.por_mil_hab == null
      ? ausente("Ações bancárias por mil habitantes", "casos por mil habitantes", "CNJ, DataJud; IBGE, Censo 2022")
      : {
          rotulo: "Ações bancárias por mil habitantes",
          valor: B.por_mil_hab,
          casas: 2,
          unidade: "casos por mil habitantes",
          periodo: ate,
          fonte: "CNJ, DataJud; IBGE, Censo 2022",
          natureza: "CALCULADO",
          tamanho: "m",
          nota: C.populacao_coberta_pct == null ? "População do Censo 2022." : `População do Censo 2022. Os tribunais cobertos reúnem ${num(C.populacao_coberta_pct, 0)}% dela.`,
        },
    B.por_bi_carteira == null
      ? ausente("Ações bancárias por R$ bilhão de carteira", "casos por R$ bilhão", "CNJ, DataJud; Banco Central, SCR.data")
      : {
          rotulo: "Ações bancárias por R$ bilhão de carteira",
          valor: B.por_bi_carteira,
          casas: 1,
          unidade: "casos por R$ bilhão",
          periodo: ate,
          fonte: "CNJ, DataJud; Banco Central, SCR.data",
          natureza: "CALCULADO",
          tamanho: "m",
          nota: `Casos bancários divididos pela carteira de crédito das UFs cobertas${scr ? `, de ${scr}` : ""}. Datas diferentes; a carteira soma pessoas e empresas.`,
        },
  ];

  // ---------- série mensal: bancário e qualquer credor, na classe escolhida ----------
  const serie = serieDaClasse(g, classe);
  const ultimo = serie[serie.length - 1];
  const porVia = seriePorVia(g);
  const seriesVia = g.grupos.map((x, i) => ({ id: x.id, rotulo: x.nome, cor: CORES[i % CORES.length] }));

  // ---------- UFs ----------
  const ufs = ufsOrdenadas(g, medida);
  const M = MEDIDA_UF[medida];
  const primeira = ufs.find((u) => u[medida] != null);
  const temPosicao = ufs.some((u) => u.posicoes?.[medida] != null);

  return (
    <>
      <MarcaVisita secao={SECAO_BANCOS_COBRANDO} />
      <Cabecalho />
      <PaginaPainel
        rota={ROTA_BANCOS_COBRANDO}
        idioma="pt"
        abertura={{
          acento: "bronze",
          titulo: PERGUNTA_BANCOS_COBRANDO,
          lead: "Execuções de título, buscas e apreensões de bens financiados, monitórias e execuções hipotecárias ajuizadas mês a mês nos tribunais estaduais, no recorte bancário e com qualquer credor.",
          recorte: { periodo: serieToda, universo: cobertura, unidade: "casos únicos", fonte: FONTE },
          limite:
            "o nível de inadimplência nem a conduta de um banco. Entrar com a ação é uma decisão do credor, a cobertura da base varia entre tribunais e a fonte pública não identifica quem cobra: o recorte bancário é o assunto do processo.",
          fontesDatasSiglas: (
            <>
              <p>
                {nomeFonte(g.fonte.nome)}. Coleta em {coletado}. Janela dos números: {janela}. Meses ainda parciais, fora dos números e dos gráficos: {parciais}.
                {scr ? ` Carteira de crédito e inadimplência por UF: Banco Central, SCR.data, ${scr}.` : ""} População: IBGE, Censo 2022.
              </p>
              <p>
                <span className="font-medium">CNJ:</span> Conselho Nacional de Justiça. <span className="font-medium">DataJud:</span> base nacional de dados processuais do CNJ.{" "}
                <span className="font-medium">TPU:</span> Tabelas Processuais Unificadas, a lista oficial de classes e assuntos dos processos.{" "}
                <span className="font-medium">SCR:</span> Sistema de Informações de Crédito do Banco Central. <span className="font-medium">SFH:</span> Sistema Financeiro da Habitação.{" "}
                <span className="font-medium">UF:</span> unidade da Federação.
              </p>
            </>
          ),
        }}
        rotuloNumeros={`Cobrança judicial de crédito, ${ate}`}
        numeros={numeros}
        notaNumeros={
          <>
            <p>{prosa(g.sintese)}</p>
            <p className="mt-2">
              Síntese calculada pela mesma regra dos números. Janela de {janela}; meses parciais fora: {parciais}; {cobertura}.
              {via ? ` Via mais usada: ${via.nome.toLowerCase()}, com ${n0(via.bancario.casos_12m)} casos, ${pct0(via.bancario_share)} deles com assunto bancário.` : ""}
            </p>
          </>
        }
        figuras={
          <>
            <Controles rotulo="Via de cobrança da série mensal" idioma="pt" resumo={`Mostrando ${nomeClasse.toLowerCase()}, ${serieToda}.`} limpar={classe === "todas" ? undefined : { href: href({ classe: "todas" }) }}>
              <OpcoesRecorte
                rotulo="Via de cobrança"
                opcoes={classes(g).map((c) => ({ rotulo: g.grupos.find((x) => x.id === c)?.nome ?? "Todas as vias", href: href({ classe: c }), atual: c === classe }))}
              />
            </Controles>
            <FiguraAnalitica
              id="serie"
              idioma="pt"
              pergunta="Quantas ações de cobrança entram na Justiça a cada mês?"
              subtitulo={`Ajuizamentos por mês · ${nomeClasse} · casos únicos · ${tribunais} · ${serieToda}`}
              natureza="OBSERVADO"
              proveniencia={provenienciaCobranca(g, { indicador: `Ajuizamentos mensais de ações de cobrança, ${nomeClasse.toLowerCase()}`, natureza: "OBSERVADO", unidade: "casos únicos por mês" })}
              leitura={
                ultimo ? (
                  <LeituraGuiada>
                    Em {mesAno(ultimo.mes)}, o último mês fechado, foram {n0(ultimo.bancario)} ações com assunto bancário e {n0(ultimo.todos)} com qualquer credor{grupo ? `, na via ${grupo.nome.toLowerCase()}` : ", nas quatro vias"}. A linha de qualquer credor é contexto: inclui a
                    bancária e não se soma a ela.
                  </LeituraGuiada>
                ) : undefined
              }
              ressalva={`Os três últimos meses (${parciais}) ficam fora: os tribunais enviam os dados ao DataJud com atraso e o mês só fecha depois. A cobertura é menor antes de 2020.`}
              comoInterpretar="Comece pela linha do assunto bancário e pela sua variação; depois troque a via, acima do gráfico. A busca e apreensão é o caminho do financiamento de veículos."
              porQueImporta="Entre o atraso e a recuperação judicial existe a cobrança: execução de título, busca e apreensão do bem financiado, monitória e execução hipotecária. É o crédito que virou processo, e mostra quando o credor decide pagar o custo de cobrar em juízo."
              naoConcluir="que a inadimplência subiu ou caiu na mesma proporção. Volume de ações é a decisão do credor de cobrar em juízo, que depende de custo, garantia e estratégia, e a base não diz qual instituição cobra."
              tabela={{
                titulo: `Ajuizamentos por mês · ${nomeClasse} · casos únicos`,
                colunas: ["Mês", "Assunto bancário", "Qualquer credor"],
                linhas: serie.map((p) => [mesAno(p.mes), p.bancario, p.todos]),
                casas: [null, 0, 0],
                limite: serie.length,
              }}
              complemento={<BaixarCsv nome={`cobranca_judicial_${g.mes}.csv`} conteudo={csvSerie(g)} rotulo="Baixar a série mensal completa (CSV)" />}
            >
              <GraficoLinhas
                semTabela
                titulo={`Ajuizamentos por mês: ${nomeClasse.toLowerCase()}`}
                dados={serie}
                chaveX="mes"
                formatoX="mes"
                series={[
                  { id: "bancario", rotulo: "Assunto bancário", sigla: "Bancário", cor: "var(--serie-1)" },
                  { id: "todos", rotulo: "Qualquer credor", sigla: "Todos", cor: "var(--serie-2)" },
                ]}
                unidade="casos"
                casas={0}
                zeroNoEixo
                zoom
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="vias-por-mes"
              idioma="pt"
              pergunta="Por qual via se cobra?"
              subtitulo={`Ajuizamentos por mês e por via · assunto bancário · casos únicos · ${tribunais} · ${serieToda}`}
              natureza="OBSERVADO"
              proveniencia={provenienciaCobranca(g, { indicador: "Ajuizamentos mensais de ações de cobrança por via, assunto bancário", natureza: "OBSERVADO", unidade: "casos únicos por mês" })}
              leitura={
                <LeituraGuiada>
                  A busca e apreensão é a via do financiamento de veículos com alienação fiduciária. A execução de título cobra cédulas e contratos. A monitória cobra dívida sem título executivo. A execução hipotecária do SFH é
                  residual desde que os imóveis passaram a ser financiados com alienação fiduciária.
                </LeituraGuiada>
              }
              ressalva={`Meses parciais fora: ${parciais}.`}
              naoConcluir="que uma via cresce porque há mais dívida daquele tipo. O assunto é cadastrado pelo tribunal e nem sempre existe, e a cobertura do DataJud muda ao longo do tempo."
              tabela={{
                titulo: "Ajuizamentos por mês e por via · assunto bancário · casos únicos",
                colunas: ["Mês", ...g.grupos.map((x) => x.nome)],
                linhas: porVia.map((p) => [mesAno(p.mes), ...g.grupos.map((x) => p[x.id])]),
                casas: [null, ...g.grupos.map(() => 0)],
                limite: porVia.length,
              }}
            >
              <GraficoLinhas semTabela titulo="Ajuizamentos por mês e por via, assunto bancário" dados={porVia} chaveX="mes" formatoX="mes" series={seriesVia} unidade="casos" casas={0} zeroNoEixo zoom legendaInterativa />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="vias-12-meses"
              idioma="pt"
              pergunta="Quanto cada via somou em 12 meses?"
              subtitulo={`As quatro vias · casos únicos em 12 meses · assunto bancário e qualquer credor · ${janela}`}
              natureza="CALCULADO"
              proveniencia={provenienciaCobranca(g, {
                indicador: "Ações de cobrança em 12 meses por via, assunto bancário e qualquer credor",
                natureza: "CALCULADO",
                unidade: "casos únicos em 12 meses",
                inicio: g.janela_12m.inicio,
                fim: g.janela_12m.fim,
                formula: "soma dos ajuizamentos dos 12 meses até o último mês fechado; variação contra os 12 meses anteriores",
              })}
              leitura={
                via ? (
                  <LeituraGuiada>
                    {via.nome} somou {n0(via.bancario.casos_12m)} casos com assunto bancário em 12 meses, {pct0(via.bancario_share)} das ações dessa classe com qualquer credor.
                  </LeituraGuiada>
                ) : undefined
              }
              comoInterpretar={`O recorte bancário reúne os assuntos ${g.assuntos_bancarios.map((a) => `${a.nome} (${a.codigo})`).join(", ")}. Execução e monitória cobram qualquer título, e o assunto é cadastrado pelo tribunal e nem sempre existe: o recorte bancário é piso, não teto.`}
              naoConcluir="a soma das duas barras de cada via. As ações com assunto bancário já estão dentro das de qualquer credor."
              tabela={{
                titulo: `As quatro vias em 12 meses · casos únicos · ${janela}`,
                colunas: ["Via", "Classes TPU", "Bancário, 12 meses", "Bancário, 12 meses anteriores", "Bancário, variação em %", "Qualquer credor, 12 meses", "Qualquer credor, variação em %", "% com assunto bancário"],
                linhas: g.grupos.map((x) => [x.nome, x.classes_tpu.join(", "), x.bancario.casos_12m, x.bancario.casos_12m_anterior, x.bancario.var_12m_pct, x.todos.casos_12m, x.todos.var_12m_pct, x.bancario_share]),
                casas: [null, null, 0, 0, 1, 0, 1, 0],
                limite: g.grupos.length,
              }}
              depois={
                <ul className="t-corpo max-w-prose2 space-y-2 text-carvao">
                  <li>
                    Quando é o cliente que aciona o banco, por revisão de contrato ou indenização:{" "}
                    <Link href={ROTA_CLIENTES} prefetch={false} className={link}>
                      Clientes contra bancos na Justiça
                    </Link>
                    .
                  </li>
                  <li>
                    Quando a cobrança não basta, do mesmo DataJud, nas classes de recuperação judicial e falência:{" "}
                    <Link href={PAINEL_RECUPERACOES} prefetch={false} className={link}>
                      Recuperações e falências
                    </Link>
                    , no painel Crédito.
                  </li>
                </ul>
              }
            >
              <GraficoBarras
                semTabela
                titulo="Casos em 12 meses por via"
                dados={g.grupos.map((x) => ({ id: x.id, nome: x.nome, bancario: x.bancario.casos_12m, todos: x.todos.casos_12m }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[
                  { id: "bancario", rotulo: "Assunto bancário", cor: "var(--serie-1)" },
                  { id: "todos", rotulo: "Qualquer credor", cor: "var(--serie-2)" },
                ]}
                unidade="casos"
                casas={0}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>

            <Controles rotulo="Medida da comparação entre estados" idioma="pt" resumo={`Mostrando ${M.rotulo.toLowerCase()}, ${ate}.`} limpar={medida === "por_mil_hab" ? undefined : { href: href({ medida: "por_mil_hab" }) }}>
              <OpcoesRecorte rotulo="Medida por estado" opcoes={MEDIDAS_UF.map((m) => ({ rotulo: MEDIDA_UF[m].rotulo, href: href({ medida: m }), atual: m === medida }))} />
            </Controles>
            <FiguraAnalitica
              id="estados"
              idioma="pt"
              pergunta="Onde há mais ações de cobrança bancária?"
              subtitulo={`${M.titulo} · por UF · ${cobertura} · ${ate}`}
              natureza="CALCULADO"
              proveniencia={provenienciaCobranca(g, {
                indicador: `${M.titulo}, por UF`,
                natureza: "CALCULADO",
                unidade: M.unidade,
                inicio: g.janela_12m.inicio,
                fim: g.janela_12m.fim,
                extra: ["Por mil habitantes usa a população do Censo 2022; por R$ bilhão usa a carteira de crédito do SCR na UF, de outra data e com pessoas e empresas somadas."],
              })}
              leitura={
                primeira ? (
                  <LeituraGuiada>
                    {primeira.nome} tem o maior valor nesta medida: {`${num(primeira[medida] as number, M.casas)}${M.unidade === "%" ? "%" : ` ${M.unidade}`}`}. As posições são entre as UFs cobertas, dentro de cada medida.
                  </LeituraGuiada>
                ) : undefined
              }
              ressalva="Mais ações por habitante em uma UF pode refletir cobertura melhor do tribunal no DataJud, não mais cobrança."
              naoConcluir="que os moradores de um estado devem mais ou pagam pior que os de outro. A medida conta processos ajuizados, e a remessa de cada tribunal ao DataJud tem atraso e cobertura próprios."
              tabela={{
                titulo: `${M.titulo} · por UF · ${ate}`,
                colunas: ["UF", "Estado", "Tribunal", M.titulo, ...(temPosicao ? ["Posição entre as UFs cobertas"] : [])],
                linhas: ufs.map((u) => [u.uf, u.nome, u.tribunal, u[medida], ...(temPosicao ? [u.posicoes?.[medida] != null ? `${u.posicoes[medida]}º` : null] : [])]),
                casas: [null, null, null, M.casas],
                limite: ufs.length,
              }}
            >
              <GraficoBarras
                semTabela
                titulo={M.titulo}
                dados={ufs.map((u) => ({ id: u.uf, nome: `${u.nome} (${u.uf})`, valor: u[medida] }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[{ id: "valor", rotulo: M.rotulo, cor: "var(--serie-1)" }]}
                unidade={M.unidade}
                casas={M.casas}
                orientacao="horizontal"
                rotulosValor
                limiteInicial={12}
              />
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <TabelaDados
            idioma="pt"
            ordenavel
            recolhida={false}
            titulo={`Cobrança judicial de crédito por UF, ${ate}`}
            nomeArquivo={`cobranca_judicial_por_uf_${g.mes}`}
            colunas={["UF", "Estado", "Tribunal", "Bancário, 12 meses", "Variação em %", "Qualquer credor, 12 meses", "Por mil habitantes", "Por R$ bilhão de carteira", "Inadimplência no SCR, %", "Busca e apreensão", "Execução de título"]}
            linhas={g.ufs.map((u) => [u.uf, u.nome, u.tribunal, u.casos_12m, u.var_12m_pct, u.casos_12m_todos, u.por_mil_hab, u.por_bi_carteira, u.inad_scr, u.grupos.busca_apreensao, u.grupos.execucao])}
            casas={[null, null, null, 0, 1, 0, 2, 1, 2, 0, 0]}
            links={{ UF: g.ufs.map((u) => `${PAINEL_ESTADOS}/${u.uf}`) }}
            ausencia={{ "Por mil habitantes": "não calculado", "Por R$ bilhão de carteira": "não calculado", "Inadimplência no SCR, %": "não publicado", "Variação em %": "não calculado" }}
            nota={
              <>
                Toque no cabeçalho de uma coluna para ordenar. A inadimplência do SCR é outra régua (saldo em atraso dividido pela carteira{scr ? `, ${scr}` : ""}) e está ao lado para leitura, nunca somada. Mais ações por
                habitante pode ser cobertura melhor do tribunal no DataJud. A sigla de cada UF leva à página do estado no painel Crédito, com carteira, inadimplência, presença bancária, emprego e cobrança lado a lado.
              </>
            }
          />
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Busca e apreensão", definicao: "Ação em que o credor pede a retomada do bem dado em garantia, quase sempre um veículo financiado com alienação fiduciária." },
            { termo: "Execução de título extrajudicial", definicao: "Cobrança direta de uma dívida que já tem documento com força de cobrança, como uma cédula de crédito ou um contrato assinado." },
            { termo: "Ação monitória", definicao: "Cobrança de dívida que tem prova escrita, mas não tem título executivo. O juiz primeiro reconhece a dívida." },
            { termo: "Execução hipotecária do SFH", definicao: "Cobrança de financiamento de imóvel garantido por hipoteca. É residual: hoje os imóveis são financiados com alienação fiduciária." },
            {
              termo: "Assunto bancário",
              definicao: "Processo cujo tema, cadastrado pelo tribunal, é um contrato de crédito. Nem todo processo tem o assunto preenchido, por isso o recorte é um piso.",
              exemplo: B.bancario_share == null ? undefined : `Nos ${ate}, ${pct0(B.bancario_share)} das ações das quatro vias tinham assunto bancário.`,
            },
            { termo: "Caso único", definicao: "Um processo, contado uma vez pelo número único do CNJ. A contagem é aproximada, com erro típico abaixo de 1%." },
          ],
          nota: "Volume de ações não é inadimplência, e o total com qualquer credor é contexto, nunca soma.",
        }}
        metodo={
          <>
            <p>{prosa(g.metodo)}</p>
            <TabelaDados
              idioma="pt"
              recolhida={false}
              titulo="Catálogo dos indicadores desta página"
              colunas={["Indicador", "Definição", "Unidade", "Fonte", "Limitações"]}
              linhas={g.catalogo.map((c) => [c.nome, prosa(c.definicao), c.unidade, c.fonte, prosa(c.limitacoes)])}
              limite={g.catalogo.length}
            />
            <p>{prosa(g.limitacoes)}</p>
            <div>
              <p className="font-medium text-carvao">Cautelas</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {g.cautelas.map((c) => (
                  <li key={c}>{prosa(c)}</li>
                ))}
              </ul>
            </div>
            <p>
              Fonte:{" "}
              <a href={g.fonte.catalogo} className={link} rel="noopener noreferrer">
                {nomeFonte(g.fonte.nome)}
              </a>{" "}
              ({g.fonte.licenca}; nível {g.fonte.nivel.replace(/\s+—\s+/, ", ")}). Coletado em {coletado}. Natureza declarada pela base: contagens do DataJud observadas; janelas, variações e razões por habitante e por carteira
              calculadas.
            </p>
            <p>
              Método geral em{" "}
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
