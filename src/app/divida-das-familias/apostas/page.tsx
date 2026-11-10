import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import type { NumeroProps } from "@/components/painel";
import { BaixarCsv, CLASSE_BAIXAR, type CelulaCsv } from "@/components/familias/apostas/BaixarCsv";
import { BibliotecaEstudos, CadeiaElos, Corpo, Grau, LegendaGraus, LinhaDoTempo, LinkFonte, Lista, Nota, Subtitulo, Texto, grauTexto } from "@/components/familias/apostas/Evidencia";
import { FiguraExplorador } from "@/components/familias/apostas/FiguraExplorador";
import { dataBr, mesAno, num } from "@/lib/perguntas/leitura";
import {
  DESCRICAO_APOSTAS,
  NATUREZA_DA_SITUACAO,
  PERGUNTA_APOSTAS,
  ROTA_APOSTAS,
  dadosApostas,
  dataDaBase,
  limpar,
  provCurada,
  situacaoTexto,
  type ItemSintese,
} from "@/lib/familias/apostas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: PERGUNTA_APOSTAS,
  description: DESCRICAO_APOSTAS,
  alternates: { canonical: ROTA_APOSTAS },
};

const GOLD = "/obs/data/gold/bets.json";
const GOLD_EPAE = "/obs/data/gold/epae.json";
/** Os quatro números de abertura: os de registro administrativo (grau A) que dão a escala do mercado; os outros quatro ficam na síntese. */
const ABERTURA = ["apostadores_2025", "ggr_2025", "ggr_por_apostador", "autoexclusao"] as const;

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

/**
 * Painel "Apostas e crédito das famílias" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta. Reescrita, no
 * molde de painel, da vista `bets` da aplicação do Crédito (/observatorio/bets-financial-risk): mesma gold (bets.json, epae.json e as
 * séries de crédito de pulse.json), mesmos valores, nenhum cálculo novo. O grau de evidência de cada número (A a E) e a situação
 * (fonte primária, calculado, estimativa, imprensa) acompanham o número em toda tabela e figura; a página investiga associações e
 * não afirma causa.
 */
export default function PaginaApostas() {
  const { B, E, credito, sintese, niveis, cadeia, estudos, linhaDoTempo } = dadosApostas();
  const S = B.series;
  const g = (nivel: string) => grauTexto(nivel, niveis);
  const porId = (id: string) => sintese.find((k) => k.id === id);
  const curadoria = `Curadoria da gold bets.json, versão ${B.versao}`;

  const numeros: NumeroProps[] = ABERTURA.map((id) => porId(id))
    .filter((k): k is ItemSintese => Boolean(k) && k!.situacao !== "imprensa")
    .map((k) => ({
      rotulo: k.rotulo,
      formato: "texto" as const,
      valorTexto: k.exibir,
      unidade: k.unidade,
      periodo: k.periodo,
      fonte: k.fonte,
      natureza: NATUREZA_DA_SITUACAO[k.situacao as "oficial" | "calculado" | "estimativa"],
      tamanho: "m" as const,
      nota: (
        <>
          <Grau nivel={k.nivel} niveis={niveis} /> <span className="mt-1 block">{k.conceito}.</span>
        </>
      ),
    }));

  /* ------------------------------------------------------------------ mercado regulado */
  const ggr = S.ggr_regulado;
  const ggrObs: any[] = ggr.obs;
  const sufixo = (o: any) => (o.status === "calculado" ? " (calculado)" : o.status === "imprensa" ? " (imprensa)" : "");
  const oficiaisGgr = ggrObs.filter((o) => o.status === "oficial").length;
  const calculadosGgr = ggrObs.filter((o) => o.status === "calculado").length;
  const imprensaGgr = ggrObs.filter((o) => o.status === "imprensa").length;
  const provGgr = (natureza: "OBSERVADO" | "CALCULADO", o: any) =>
    provCurada({
      indicador: natureza === "OBSERVADO" ? "GGR do mercado regulado de apostas, por período oficial" : `GGR de ${limpar(o.periodo)}, por subtração`,
      natureza,
      orgao: "SPA/MF",
      dataset: "Panoramas semestrais do mercado de apostas (SIGAP)",
      recurso: limpar(o.fonte),
      url: String(o.url),
      unidade: limpar(ggr.unidade),
      frequencia: limpar(ggr.freq),
      inicio: "2025-01",
      fim: natureza === "OBSERVADO" ? "2026-03" : "2025-12",
      geradoEm: B.gerado_em,
      formula: o.derivacao ? limpar(o.derivacao) : null,
      limitacoes: [limpar(ggr.nota)],
      pipeline: curadoria,
    });
  const calculadoGgr = ggrObs.find((o) => o.status === "calculado");
  const ap = S.apostadores;
  const arr: any[] = S.arrecadacao.obs;
  const arr25 = arr.find((o) => o.ref === "2025");
  const arr26 = arr.find((o) => o.ref !== "2025");
  const pix = S.pix_pre_regulacao;
  const pix0 = pix.obs[0];
  const blo = S.bloqueios_ilegais;

  /* ------------------------------------------------------------------ quem aposta, vulnerabilidade */
  const P = B.perfil;
  const ds = P.datasenado_2024;
  const V = B.vulnerabilidade;

  /* ------------------------------------------------------------------ explorador */
  const EX = B.explorador;
  const desde = "2023-01";

  /* ------------------------------------------------------------------ autoexclusão */
  const ax = S.autoexclusao;
  const axObs: any[] = ax.obs;
  const kAuto = porId("autoexclusao");
  const kApost = porId("apostadores_2025");
  const sus = (V.grupos as any[]).find((x) => /SUS/.test(String(x.rotulo)));

  /* ------------------------------------------------------------------ mercado ilegal e Pix da seção */
  const MI = B.mercado_ilegal;
  const o: any[] = E.serie.obs;
  const ult = o[o.length - 1];
  const comp = E.comparacao;
  const T = E.taxonomia;
  const provEpae = (natureza: "OBSERVADO" | "CALCULADO", indicador: string, formula: string | null = null) =>
    provCurada({
      indicador,
      natureza,
      orgao: "Banco Central",
      dataset: "Estatísticas de Pagamentos por Atividade Econômica (EPAE)",
      recurso: `${limpar(E.fonte.instrumento)}, seção ${E.secao.codigo} da CNAE (${limpar(E.secao.rotulo)})`,
      url: String(E.fonte.pagina),
      unidade: "R$ bilhões por mês",
      frequencia: limpar(E.fonte.frequencia),
      inicio: E.cobertura.inicio,
      fim: E.cobertura.fim,
      geradoEm: E.gerado_em,
      capturadoEm: E.fonte.coletado_em,
      sha256: E.fonte.sha256,
      formula,
      limitacoes: (E.limitacoes as string[]).map(limpar),
      pipeline: "Pipeline do Observatório do Crédito, gold epae.json",
      curada: false,
    });

  /* ------------------------------------------------------------------ downloads (as mesmas linhas da vista de origem) */
  const csvBase: CelulaCsv[][] = [
    ["bloco", "referencia", "indicador", "valor", "unidade", "nivel_evidencia", "status", "fonte", "url"],
    ...sintese.map((k) => ["sintese", k.periodo, k.rotulo, k.valor ?? k.exibir, k.unidade, k.nivel, k.situacao, k.fonte, k.url]),
    ...ggrObs.map((x) => ["ggr_regulado", x.ref, "GGR", x.v, "R$ bi", x.nivel, x.status, x.fonte || "SPA/MF", x.url]),
    ...(ap.obs as any[]).map((x) => ["apostadores", x.ref, x.conceito, x.v, "milhões", x.nivel, x.status, "SPA/MF", x.url]),
    ...axObs.map((x) => ["autoexclusao", x.ref, "solicitações acumuladas", x.v, "mil", x.nivel, x.status, "SPA/MF", x.url]),
    ...(blo.obs as any[]).map((x) => ["bloqueios_ilegais", x.ref, "URLs bloqueadas (acum.)", x.v, "mil", x.nivel, x.status, "SPA/Anatel", x.url]),
    ...arr.map((x) => ["arrecadacao", x.ref, "tributos federais", x.tributos, "R$ bi", x.nivel, x.status, "RFB/SPA", x.url]),
  ];
  const csvEpae: CelulaCsv[][] = [
    ["mes", "pf_para_secao_rs_bi", "secao_para_pf_rs_bi", "liquido_rs_bi", "transacoes_pf_para_secao_mi", "transacoes_secao_para_pf_mi", "pf_para_pj_total_rs_bi", "participacao_pct", "secao_cnae", "fonte"],
    ...o.map((x) => [x.ref, x.pf_para_secao, x.secao_para_pf, x.liquido, x.tx_pf_para_secao, x.tx_secao_para_pf, x.pf_para_pj_total, x.participacao, E.secao.rotulo, E.fonte.nome]),
  ];
  const M = B.metodologia;

  return (
    <>
      <header>
        <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_APOSTAS} fontes={["credito"]} />
        <NavegacaoColecao colecao="divida" />
      </header>
      <PaginaPainel
        rota={ROTA_APOSTAS}
        abertura={{
          acento: "bronze",
          titulo: PERGUNTA_APOSTAS,
          lead: "O tamanho do mercado regulado de apostas, quem aposta e o que se sabe da ligação com dívida e atraso. Cada número traz o grau de evidência, de A (registro oficial) a E (sinal ainda não validado).",
          recorte: {
            periodo: limpar(B.periodo_coberto),
            universo: "Brasil, apostas de quota fixa",
            fonte: "SPA/MF, Banco Central, DataSenado e os estudos citados em cada bloco",
          },
          limite:
            "que as apostas causam inadimplência. A página investiga associações e nenhum gráfico aqui demonstra causa. Estimativas privadas têm o grau de evidência declarado e não se somam ao dado oficial.",
          fontesDatasSiglas: (
            <>
              <p>
                Última revisão da curadoria em {dataBr(B.gerado_em)}; corte da pesquisa em {dataBr(B.corte_pesquisa)}. Processo de atualização: {limpar(B.atualizacao.processo)}. Próxima
                atualização esperada: {limpar(B.atualizacao.proxima_esperada)}. A série de pagamentos Pix por atividade vai de {mesAno(E.cobertura.inicio)} a {mesAno(E.cobertura.fim)},
                coletada em {dataBr(E.fonte.coletado_em)}.
              </p>
              <p>
                GGR: receita bruta de jogo, o total apostado menos os prêmios pagos. SPA/MF: Secretaria de Prêmios e Apostas do Ministério da Fazenda. SIGAP: sistema de gestão de apostas da
                SPA. EPAE: Estatísticas de Pagamentos por Atividade Econômica, do Banco Central. CNAE: Classificação Nacional de Atividades Econômicas. BF e BPC: Bolsa Família e Benefício de
                Prestação Continuada.
              </p>
            </>
          ),
        }}
        rotuloNumeros="Escala do mercado regulado de apostas, com o grau de evidência de cada número"
        numeros={numeros}
        notaNumeros={
          <div className="space-y-4">
            <p>
              Cada número declara conceito, período e grau de evidência. {limpar(B.aviso)} Os outros indicadores da síntese, inclusive os de estimativa e de imprensa, estão na tabela logo
              abaixo, com a situação de cada um.
            </p>
            <LegendaGraus niveis={niveis} />
          </div>
        }
        figuras={
          <>
            <Recolhido id="sintese" aberto nivelTitulo={2} titulo="O que os números oficiais permitem afirmar" resumo="Os oito indicadores da síntese, cada um com período, grau de evidência, situação, fonte e conceito.">
              <Corpo>
                <TabelaDados
                  recolhida={false}
                  titulo="Síntese do mercado de apostas: indicador, valor, período, grau de evidência, situação, fonte e conceito"
                  colunas={["Indicador", "Valor", "Unidade", "Período", "Grau de evidência", "Situação", "Fonte", "Conceito e ressalva"]}
                  linhas={sintese.map((k) => [
                    k.rotulo,
                    k.exibir,
                    k.unidade,
                    k.periodo,
                    g(k.nivel),
                    situacaoTexto(k.situacao),
                    <LinkFonte key={k.id} href={k.url}>
                      {k.fonte}
                    </LinkFonte>,
                    k.nota ? `${k.conceito}. ${k.nota}` : `${k.conceito}.`,
                  ])}
                  limite={sintese.length}
                  fixarPrimeiraColuna
                  nota="Números do pedido original que ficaram desatualizados (por exemplo, 603 mil autoexclusões) estão registrados no método, em indicadores avaliados e descartados."
                />
              </Corpo>
            </Recolhido>

            <Recolhido id="canais" aberto nivelTitulo={2} titulo="Como as apostas podem chegar ao crédito" resumo="A cadeia plausível entre aposta, renda e crédito, com o grau de evidência de cada elo.">
              <Corpo>
                <Texto>{cadeia.descricao}</Texto>
                <CadeiaElos cadeia={cadeia} rotulo="Cadeia plausível entre apostas e crédito, na ordem do raciocínio" />
                <TabelaDados
                  recolhida={false}
                  titulo="Evidência de cada elo da cadeia entre apostas e crédito"
                  colunas={["Elo", "Grau de evidência", "O que sustenta"]}
                  linhas={cadeia.elos.map((e) => [`${e.de} → ${e.para}`, e.grau, e.evidencia])}
                  limite={cadeia.elos.length}
                  nota="A seta indica a ordem do raciocínio, não uma relação de causa medida."
                />
              </Corpo>
            </Recolhido>

            <FiguraAnalitica
              id="mercado-regulado"
              pergunta="Qual o tamanho do mercado regulado de apostas?"
              subtitulo={`GGR por período oficial · ${limpar(ggr.unidade)} · Brasil, operadores autorizados, jan/2025 a mar/2026`}
              natureza="OBSERVADO"
              proveniencia={provGgr("OBSERVADO", ggrObs[0])}
              complementares={calculadoGgr ? [{ rotulo: `Sobre ${limpar(calculadoGgr.periodo)}, calculado`, p: provGgr("CALCULADO", calculadoGgr) }] : []}
              leitura={
                <LeituraGuiada>
                  {ggrObs.map((x) => `${limpar(x.periodo)}: R$ ${num(x.v, 1)} bi${sufixo(x)}`).join("; ")}. Os períodos têm durações diferentes: dois semestres e um trimestre.
                </LeituraGuiada>
              }
              comoInterpretar={limpar(ggr.conceito)}
              ressalva={
                <>
                  Sem série mensal: a SPA publica por semestre e esta página não interpola. Das {ggrObs.length} barras, {oficiaisGgr} {oficiaisGgr === 1 ? "é" : "são"} de fonte primária,{" "}
                  {calculadosGgr} {calculadosGgr === 1 ? "é derivada" : "são derivadas"} por subtração (ano menos primeiro semestre, da mesma fonte) e {imprensaGgr}{" "}
                  {imprensaGgr === 1 ? "é número de imprensa a partir do SIGAP, que aguarda" : "são números de imprensa a partir do SIGAP, que aguardam"} o Panorama oficial. {limpar(ggr.nota)}
                </>
              }
              naoConcluir="quanto foi apostado nem quanto cada pessoa perdeu. O GGR é a receita bruta dos operadores autorizados: não é volume apostado, não é depósito e não é lucro, e não inclui o mercado ilegal."
              tabela={{
                titulo: "GGR do mercado regulado por período oficial, com grau de evidência, situação e fonte",
                colunas: ["Período", "GGR, R$ bilhões", "Grau de evidência", "Situação", "Fonte", "Como se obtém"],
                linhas: ggrObs.map((x) => [limpar(x.periodo), x.v, g(x.nivel), situacaoTexto(x.status), limpar(x.fonte), x.derivacao ? limpar(x.derivacao) : "valor publicado"]),
                casas: [null, 2, null, null, null, null],
                limite: ggrObs.length,
              }}
              depois={
                <>
                  <TabelaDados
                    recolhida={false}
                    id="quantos-apostam"
                    tituloVisivel="Quantos apostam: conceitos que não se misturam"
                    lead={limpar(ap.conceito)}
                    titulo="Apostadores no mercado regulado por período, com o conceito medido em cada um"
                    colunas={["Período", `Valor, ${limpar(ap.unidade)}`, "Conceito medido", "Grau de evidência", "Situação"]}
                    linhas={(ap.obs as any[]).map((x) => [limpar(String(x.ref).replace("-S", ", semestre ").replace("-T", ", trimestre ")), x.v, limpar(x.conceito), g(x.nivel), situacaoTexto(x.status)])}
                    casas={[null, 1, null, null, null]}
                    limite={ap.obs.length}
                  />
                  <TabelaDados
                    recolhida={false}
                    id="arrecadacao"
                    tituloVisivel="Arrecadação e destinações em 2025"
                    lead={limpar(S.arrecadacao.conceito)}
                    titulo="Arrecadação e destinações do setor regulado de apostas em 2025"
                    colunas={["Conceito", "Valor em 2025, R$ bilhões", "Grau de evidência", "Situação"]}
                    linhas={
                      arr25
                        ? [
                            ["Tributos federais", arr25.tributos, g(arr25.nivel), situacaoTexto(arr25.status)],
                            ["Destinações legais (12% do GGR)", arr25.destinacoes, g(arr25.nivel), situacaoTexto(arr25.status)],
                            ["Outorgas", arr25.outorgas, g(arr25.nivel), situacaoTexto(arr25.status)],
                            ["Taxa de fiscalização", arr25.taxa_fiscalizacao, g(arr25.nivel), situacaoTexto(arr25.status)],
                          ]
                        : []
                    }
                    casas={[null, 2, null, null]}
                    nota={
                      <>
                        Os quatro conceitos são distintos e não se somam num total.{" "}
                        {arr26 && (
                          <>
                            Em 2026, de janeiro a maio: R$ {num(arr26.tributos, 2)} bi em tributos ({situacaoTexto(arr26.status).toLowerCase()}; {limpar(arr26.nota)}).{" "}
                          </>
                        )}
                        {arr25 && <LinkFonte href={arr25.url}>SPA/MF, gov.br</LinkFonte>}
                      </>
                    }
                  />
                  <section id="pix-pre-regulacao" aria-labelledby="pix-pre-regulacao-t" className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
                    <Subtitulo id="pix-pre-regulacao-t">Fluxo Pix antes da regulação, em 2024: uma quebra de método</Subtitulo>
                    <Texto>
                      De R$ {num(pix0.faixa[0], 0)} a {num(pix0.faixa[1], 0)} bilhões por mês entre janeiro e agosto de 2024, com pico de R$ {num(pix0.v, 1)} bi em {limpar(pix0.periodo)}.{" "}
                      <Grau nivel={pix0.nivel} niveis={niveis} /> · {situacaoTexto(pix0.status)} · <LinkFonte href={pix0.url}>{limpar(pix0.fonte)}</LinkFonte> · série descontinuada.
                    </Texto>
                    <Nota rotulo="Não comparável ao GGR.">
                      {limpar(pix.conceito)} {limpar(pix.nota)}
                    </Nota>
                  </section>
                  <TabelaDados
                    recolhida={false}
                    id="bloqueios"
                    tituloVisivel="Fiscalização e bloqueio de sites ilegais"
                    lead={limpar(blo.conceito)}
                    titulo="Endereços de apostas sem autorização bloqueados, acumulado por data"
                    colunas={["Data", `Valor, ${limpar(blo.unidade)}`, "Grau de evidência", "Situação", "Fonte"]}
                    linhas={(blo.obs as any[]).map((x) => [
                      dataDaBase(x.ref),
                      x.v,
                      g(x.nivel),
                      situacaoTexto(x.status),
                      <LinkFonte key={x.ref} href={x.url}>
                        publicação de origem
                      </LinkFonte>,
                    ])}
                    casas={[null, 0, null, null, null]}
                    limite={blo.obs.length}
                    nota="No ano de 2025: 132 processos de fiscalização e cerca de 550 contas bancárias de operadores ilegais encerradas (SPA/MF, 2º Panorama Semestral)."
                  />
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo="GGR do mercado regulado de apostas por período oficial"
                dados={ggrObs.map((x) => ({ id: String(x.ref), rotulo: `${limpar(x.periodo)}${sufixo(x)}`, v: x.v }))}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[{ id: "v", rotulo: "GGR", cor: "var(--serie-1)" }]}
                unidade="R$ bi"
                casas={1}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>

            <Recolhido id="quem-aposta" aberto nivelTitulo={2} titulo="Quem aposta: populações e métodos separados" resumo="Registro administrativo, pesquisa oficial e pesquisas privadas, cada um com o seu universo.">
              <Corpo>
                <Nota>{limpar(P.aviso_populacoes)}</Nota>
                <TabelaDados
                  recolhida={false}
                  id="perfil-sigap"
                  tituloVisivel="Registro administrativo, ano de 2025"
                  lead={
                    <>
                      <Grau nivel={P.sigap.nivel} niveis={niveis} /> · <LinkFonte href={P.sigap.url}>{limpar(P.sigap.fonte)}</LinkFonte>
                    </>
                  }
                  titulo="Perfil dos apostadores no registro administrativo do SIGAP, 2025"
                  colunas={["Grupo", "Parcela, %", "Base do percentual"]}
                  linhas={(P.sigap.itens as any[]).map((i) => [limpar(i.rotulo), i.v, limpar(i.unidade).replace(/^%\s*/, "")])}
                  casas={[null, 1, null]}
                  nota={limpar(P.sigap.nota)}
                />
                <TabelaDados
                  recolhida={false}
                  id="perfil-datasenado"
                  tituloVisivel="Pesquisa oficial representativa, 2024"
                  lead={
                    <>
                      <Grau nivel={ds.nivel} niveis={niveis} /> · <LinkFonte href={ds.url}>{limpar(ds.fonte)}</LinkFonte>. <span className="font-medium text-carvao">{limpar(ds.prevalencia.texto)}.</span>
                    </>
                  }
                  titulo="Perfil de quem apostou nos últimos 30 dias, DataSenado 2024"
                  colunas={["Grupo", "Parcela, %", "Base do percentual"]}
                  linhas={(ds.itens as any[]).map((i) => [limpar(i.rotulo), i.v, limpar(i.unidade).replace(/^%\s*/, "")])}
                  casas={[null, 0, null]}
                />
                <TabelaDados
                  recolhida={false}
                  id="gasto-declarado"
                  tituloVisivel="Gasto declarado em 30 dias"
                  lead={`DataSenado 2024: ${limpar(ds.gasto_30d.nota)}.`}
                  titulo="Gasto declarado com apostas em 30 dias, por faixa, DataSenado 2024"
                  colunas={["Faixa de gasto", "Parcela da população de 16 anos ou mais, %"]}
                  linhas={(ds.gasto_30d.faixas as any[]).map((f) => [limpar(f.rotulo), f.v])}
                  casas={[null, 0]}
                />
                <TabelaDados
                  recolhida={false}
                  id="regioes"
                  tituloVisivel="Extremos regionais"
                  lead={`DataSenado 2024: ${limpar(ds.regioes.nota)}.`}
                  titulo="Parcela que apostou nos últimos 30 dias, extremos regionais, DataSenado 2024"
                  colunas={["Recorte", "Parcela que apostou em 30 dias, %"]}
                  linhas={(ds.regioes.itens as any[]).map((r) => [limpar(r.rotulo), r.v])}
                  casas={[null, 0]}
                  nota="Sem mapa estadual: nenhuma amostra publica o estado com precisão adequada."
                />
                <Nota rotulo="Dívida em atraso declarada:">
                  {limpar(ds.endividamento.texto).replace(/\bvs\b/, "contra").replace(">90", "acima de 90")}. {limpar(ds.endividamento.nota)}.
                </Nota>
                <TabelaDados
                  recolhida={false}
                  id="pesquisas-privadas"
                  tituloVisivel="Pesquisas privadas: intervalos, não consenso"
                  lead={<Grau nivel="D" niveis={niveis} />}
                  titulo="Pesquisas privadas sobre apostadores: método, achado e ressalva"
                  colunas={["Fonte", "Método declarado", "Achado central", "Ressalva", "Grau de evidência"]}
                  linhas={(P.outras_pesquisas as any[]).map((x, i) => [
                    <LinkFonte key={i} href={x.url}>
                      {limpar(x.fonte)}
                    </LinkFonte>,
                    limpar(x.metodo),
                    limpar(x.achado),
                    limpar(x.status),
                    g(x.nivel),
                  ])}
                  limite={P.outras_pesquisas.length}
                  nota="Prevalências de 7% a 17% refletem conceitos e janelas de lembrança diferentes: são um intervalo entre definições, não uma contradição."
                />
              </Corpo>
            </Recolhido>

            <Recolhido id="vulnerabilidade" aberto nivelTitulo={2} titulo="Vulnerabilidade financeira" resumo="Beneficiários de programas sociais, grupos com sinal de exposição e as proteções criadas pela regulação.">
              <Corpo>
                <section aria-labelledby="beneficiarios-t" className="space-y-3">
                  <Subtitulo id="beneficiarios-t">{limpar(V.bolsa_familia.titulo)}</Subtitulo>
                  <Texto>
                    {limpar(V.bolsa_familia.dado_central.texto)}. <Grau nivel={V.bolsa_familia.dado_central.nivel} niveis={niveis} /> ·{" "}
                    <LinkFonte href={V.bolsa_familia.dado_central.url}>{limpar(V.bolsa_familia.dado_central.fonte)}</LinkFonte>
                  </Texto>
                  <Nota rotulo="Dado contestado.">{limpar(V.bolsa_familia.contestacao)}</Nota>
                  <Texto suave>
                    {limpar(V.bolsa_familia.restricao.texto)} <Grau nivel={V.bolsa_familia.restricao.nivel} niveis={niveis} />
                  </Texto>
                </section>
                <TabelaDados
                  recolhida={false}
                  id="grupos-expostos"
                  tituloVisivel="Grupos com sinal de exposição"
                  titulo="Grupos com sinal de exposição às apostas e a evidência de cada um"
                  colunas={["Grupo", "Evidência, com a fonte e o grau entre parênteses"]}
                  linhas={(V.grupos as any[]).map((x) => [limpar(x.rotulo), limpar(x.evidencia)])}
                  limite={V.grupos.length}
                />
                <section aria-labelledby="protecoes-t" className="space-y-3 border-t border-linha pt-6">
                  <Subtitulo id="protecoes-t">Evolução das proteções regulatórias</Subtitulo>
                  <ol className="max-w-prose2 space-y-2 border-l border-linha pl-4">
                    {(V.protecoes as any[]).map((pr, i) => (
                      <li key={i} className="t-meta text-carvao">
                        <span className="block text-xs tabular-nums text-mineral">{dataDaBase(pr.data)}</span>
                        {limpar(pr.texto)}
                      </li>
                    ))}
                  </ol>
                  <Texto suave>{limpar(V.leitura_institucional)}</Texto>
                </section>
              </Corpo>
            </Recolhido>

            <FiguraExplorador
              id="credito"
              pergunta="Como andam os indicadores de crédito das famílias?"
              credito={credito}
              desde={desde}
              marcos={(EX.eventos as any[]).map((e) => ({ x: String(e.x).slice(0, 7), rotulo: limpar(e.label) }))}
              rotuloMarcos="Mostrar os marcos do mercado de apostas"
              arquivo="apostas_explorador"
              comoInterpretar={limpar(EX.descricao)}
              naoConcluir="que as apostas movem o indicador escolhido. Rótulo desta leitura: sem evidência suficiente. Um marco perto de uma mudança na linha é coincidência de datas, não causa demonstrada."
              ressalva={
                <>
                  Por que não há correlação nem defasagens: a exposição regulada às apostas tem {ggrObs.length} observações públicas ({oficiaisGgr + calculadosGgr} semestres e{" "}
                  {imprensaGgr} {imprensaGgr === 1 ? "trimestre não confirmado" : "trimestres não confirmados"}), abaixo do mínimo de {EX.min_obs_correlacao} definido no método. Um gráfico de
                  dois eixos com GGR e inadimplência produziria uma relação visual artificial; por isso as séries de crédito aparecem sozinhas, com os marcos anotados.
                </>
              }
              depois={
                <Texto suave>
                  Indicadores ainda não integrados à base: {(EX.indicadores_ausentes as any[]).map((i) => limpar(i.rotulo)).join("; ")}.
                  {credito.ausentes.length > 0 && ` Sem série nesta publicação: ${credito.ausentes.join("; ")}.`} Rótulos que o método admite para uma leitura conjunta:{" "}
                  {(EX.rotulos_validos as string[]).map(limpar).join("; ")}.
                </Texto>
              }
            />

            <FiguraAnalitica
              id="autoexclusao"
              pergunta="Quantas pessoas pediram para ser bloqueadas das apostas?"
              subtitulo={`Solicitações acumuladas de autoexclusão · ${limpar(ax.unidade)} · Brasil, ${dataDaBase(axObs[0].ref)} a ${dataDaBase(axObs[axObs.length - 1].ref)}`}
              natureza="OBSERVADO"
              proveniencia={provCurada({
                indicador: "Solicitações acumuladas na Plataforma Centralizada de Autoexclusão",
                natureza: "OBSERVADO",
                orgao: "SPA/MF",
                dataset: "Plataforma Centralizada de Autoexclusão",
                url: String(axObs[0].url),
                unidade: limpar(ax.unidade),
                frequencia: "divulgações avulsas, sem calendário fixo",
                inicio: String(axObs[0].ref),
                fim: String(axObs[axObs.length - 1].ref),
                geradoEm: B.gerado_em,
                limitacoes: ["A última observação é número divulgado à imprensa, sem publicação primária até o corte da pesquisa."],
                pipeline: curadoria,
              })}
              leitura={
                <LeituraGuiada>
                  {axObs.map((x) => `${dataDaBase(x.ref)}: ${num(x.v, x.v % 1 ? 1 : 0)} mil${x.status === "imprensa" ? " (imprensa)" : ""}`).join("; ")}. O número é acumulado desde o
                  lançamento da plataforma.
                </LeituraGuiada>
              }
              comoInterpretar={limpar(ax.conceito)}
              ressalva={
                kAuto && kApost && kAuto.valor && kApost.valor ? (
                  <>
                    O total de autoexclusões não é prevalência de dependência. É demanda voluntária, que depende de conhecer a ferramenta, ter acesso e decidir usá-la. Para comparar:{" "}
                    {kAuto.exibir} solicitações ({kAuto.periodo}) e {kApost.exibir} de CPFs apostadores ({kApost.periodo}), cerca de {num((kAuto.valor / kApost.valor) * 100, 1)}%.
                    {sus && ` No SUS: ${limpar(sus.evidencia)}.`}
                  </>
                ) : (
                  "O total de autoexclusões não é prevalência de dependência. É demanda voluntária, que depende de conhecer a ferramenta, ter acesso e decidir usá-la."
                )
              }
              naoConcluir="quantas pessoas têm problema com jogo. Quem pede o bloqueio é quem conhece a ferramenta e decide usá-la; a maioria dos casos não aparece neste número, nem nos atendimentos do SUS."
              tabela={{
                titulo: "Solicitações acumuladas de autoexclusão por data de divulgação",
                colunas: ["Data", "Solicitações acumuladas, mil", "Grau de evidência", "Situação", "Observação"],
                linhas: axObs.map((x) => [dataDaBase(x.ref), x.v, g(x.nivel), situacaoTexto(x.status), x.nota ? limpar(x.nota) : "sem observação"]),
                casas: [null, 1, null, null, null],
                limite: axObs.length,
              }}
              depois={
                <>
                  <TabelaDados
                    recolhida={false}
                    id="motivos"
                    tituloVisivel="Motivos declarados"
                    lead={limpar(ax.motivos.fonte)}
                    titulo="Motivos declarados e prazo escolhido nos pedidos de autoexclusão"
                    colunas={["Declaração", "Parcela, %"]}
                    linhas={(ax.motivos.itens as any[]).map((m) => [limpar(m.rotulo), m.v])}
                    casas={[null, 0]}
                    nota={limpar(ax.motivos.nota)}
                  />
                  <Nota rotulo="Onde buscar ajuda.">
                    {limpar(B.links_apoio.nota)} <LinkFonte href={B.links_apoio.autoexclusao.url}>{limpar(B.links_apoio.autoexclusao.rotulo)}</LinkFonte> ·{" "}
                    <LinkFonte href={B.links_apoio.saude.url}>{limpar(B.links_apoio.saude.rotulo)}</LinkFonte>
                  </Nota>
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo="Solicitações acumuladas de autoexclusão"
                dados={axObs.map((x) => ({ id: String(x.ref), rotulo: `${dataDaBase(x.ref)}${x.status === "imprensa" ? " (imprensa)" : ""}`, v: x.v }))}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[{ id: "v", rotulo: "Solicitações acumuladas", cor: "var(--serie-1)" }]}
                unidade="mil"
                casas={1}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>

            <Recolhido id="mercado-ilegal" aberto nivelTitulo={2} titulo="Mercado ilegal: estimativas, não medições" resumo="As estimativas de terceiros, o método de cada uma e as ações de contenção.">
              <Corpo>
                <Nota>{limpar(MI.aviso)}</Nota>
                <TabelaDados
                  recolhida={false}
                  titulo="Estimativas do mercado ilegal de apostas: fonte, valor, método e grau de evidência"
                  colunas={["Fonte", "Estimativa", "Método", "Grau de evidência"]}
                  linhas={(MI.estimativas as any[]).map((x, i) => [
                    <LinkFonte key={i} href={x.url}>
                      {limpar(x.fonte)}
                    </LinkFonte>,
                    limpar(x.valor),
                    limpar(x.metodo),
                    g(x.nivel),
                  ])}
                  limite={MI.estimativas.length}
                />
                <section aria-labelledby="contencao-t" className="space-y-3">
                  <Subtitulo id="contencao-t">Ações de contenção</Subtitulo>
                  <Lista itens={(MI.acoes as any[]).map((a) => limpar(a.texto))} />
                  <Texto suave>{limpar(MI.riscos)}</Texto>
                </section>
              </Corpo>
            </Recolhido>

            <FiguraAnalitica
              id="pix-da-secao"
              pergunta="Quanto as pessoas pagam por Pix à seção que contém as apostas?"
              subtitulo={`Pix entre pessoas físicas e a seção ${E.secao.codigo} da CNAE (${limpar(E.secao.rotulo).toLowerCase()}) · R$ bilhões por mês · Brasil, ${mesAno(E.cobertura.inicio)} a ${mesAno(E.cobertura.fim)}`}
              natureza="OBSERVADO"
              proveniencia={provEpae("OBSERVADO", "Pagamentos Pix entre pessoas físicas e a seção de artes, cultura, esporte e recreação")}
              complementares={[{ rotulo: "Sobre o líquido, calculado", p: provEpae("CALCULADO", "Líquido entre o que as pessoas pagam à seção e o que recebem dela", "valor pago por pessoas à seção menos valor pago pela seção a pessoas, no mês") }]}
              leitura={
                <LeituraGuiada>
                  Em {mesAno(ult.ref)}, último mês publicado, as pessoas pagaram R$ {num(ult.pf_para_secao, 1)} bi à seção, em {num(ult.tx_pf_para_secao, 0)} milhões de transações, e
                  receberam R$ {num(ult.secao_para_pf, 1)} bi dela.
                </LeituraGuiada>
              }
              oQueMudou={
                <>
                  Duas mudanças de patamar acontecem em 2025. O sinal do líquido se inverte: até 2024 a seção devolvia às pessoas mais do que recebia; a partir de janeiro de 2025 passa a
                  absorver saldo. E o peso da seção salta de cerca de 2% para cerca de 12% de tudo o que pessoas físicas pagam a empresas por Pix (calculado); as outras divisões da seção
                  não crescem nesse ritmo.
                </>
              }
              comoInterpretar={
                <>
                  A seção {E.secao.codigo} da CNAE abrange {limpar(E.secao.abrange)}, e é nela que as casas de apostas são classificadas. O dado do Banco Central é publicado aqui sem
                  atribuir parcela alguma às apostas: a atribuição é sempre de quem a faz, e aparece separada mais abaixo. {limpar(E.revisao)}
                </>
              }
              ressalva={<>Esta não é uma série de apostas. {limpar(E.aviso)}</>}
              naoConcluir="que os valores são apostas, nem que a inversão de 2025 se deve a elas. A coincidência com o início do mercado regulado é factual, mas a seção inteira se move junto e nenhuma transação vem identificada."
              tabela={{
                titulo: "Pix entre pessoas físicas e a seção de artes, cultura, esporte e recreação, mês a mês",
                colunas: ["Mês", "Pessoas para a seção, R$ bi", "Seção para pessoas, R$ bi", "Líquido, R$ bi", "Transações de pessoas para a seção, milhões", "Transações da seção para pessoas, milhões", "Pix de pessoas a empresas, total, R$ bi", "Parcela da seção no Pix de pessoas a empresas, %"],
                linhas: o.map((x) => [mesAno(x.ref), x.pf_para_secao, x.secao_para_pf, x.liquido, x.tx_pf_para_secao, x.tx_secao_para_pf, x.pf_para_pj_total, x.participacao]),
                casas: [null, 3, 3, 3, 2, 2, 1, 2],
                limite: o.length,
              }}
              complemento={
                <details className="border-t border-linha pt-2" open>
                  <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-carvao underline decoration-linha underline-offset-4">
                    Por que uma série desta seção está num painel de apostas
                  </summary>
                  <div className="space-y-3 pb-2">
                    <Texto suave>{limpar(T.explicacao)}</Texto>
                    <TabelaDados
                      recolhida={false}
                      titulo="Divisões da seção de artes, cultura, esporte e recreação na CNAE"
                      colunas={["Divisão", "O que reúne"]}
                      linhas={(T.divisoes as any[]).map((d) => [String(d.codigo), d.jogos ? `${limpar(d.nome)} (as casas de apostas se registram aqui)` : limpar(d.nome)])}
                      linhasDestacadas={(T.divisoes as any[]).map((d, i) => (d.jogos ? i : -1)).filter((i) => i >= 0)}
                    />
                    <Texto suave>
                      {limpar(T.granularidade)} <LinkFonte href={T.url}>{limpar(T.fonte)}</LinkFonte>.
                    </Texto>
                  </div>
                </details>
              }
              depois={
                <>
                  <TabelaDados
                    recolhida={false}
                    id="pix-por-ano"
                    tituloVisivel="Por ano civil"
                    lead="Soma dos meses publicados, em R$ bilhões. Ano incompleto não é anualizado."
                    titulo="Pix entre pessoas físicas e a seção de artes, cultura, esporte e recreação, por ano civil"
                    colunas={["Ano", "Pessoas para a seção, R$ bi", "Seção para pessoas, R$ bi", "Líquido, R$ bi", "Parcela no Pix de pessoas a empresas, %", "Meses publicados"]}
                    linhas={(E.anuais as any[]).map((a) => [String(a.ano), a.pf_para_secao, a.secao_para_pf, a.liquido, a.participacao ?? null, a.completo ? `${a.meses}` : `${a.meses} (ano incompleto, sem anualização)`])}
                    casas={[null, 1, 1, 1, 1, null]}
                    limite={E.anuais.length}
                  />
                  {E.leitura && (
                    <div className="grid gap-x-10 gap-y-6 border-t border-linha pt-6 md:grid-cols-2">
                      <section aria-labelledby="permite-t" className="space-y-3">
                        <Subtitulo id="permite-t">O que esta série permite dizer</Subtitulo>
                        <Lista itens={(E.leitura.permite as string[]).map(limpar)} />
                      </section>
                      <section aria-labelledby="nao-permite-t" className="space-y-3">
                        <Subtitulo id="nao-permite-t">O que ela não permite dizer</Subtitulo>
                        <Lista itens={(E.leitura.nao_permite as string[]).map(limpar)} />
                      </section>
                    </div>
                  )}
                  {comp && (
                    <TabelaDados
                      recolhida={false}
                      id="observado-e-atribuido"
                      tituloVisivel={`O observado e o atribuído não são a mesma grandeza (${comp.ano})`}
                      titulo={`Líquido observado na seção e valor atribuído às apostas por estudo, ${comp.ano}`}
                      colunas={["Grandeza", "Valor, R$ bilhões", "Como se obtém", "Situação", "Grau de evidência"]}
                      linhas={[
                        [limpar(comp.observado.rotulo), comp.observado.valor, limpar(comp.observado.derivacao), situacaoTexto(comp.observado.status), g(comp.observado.nivel)],
                        [
                          <LinkFonte key="estudo" href={comp.atribuido_estudo.url}>
                            {limpar(comp.atribuido_estudo.rotulo)}
                          </LinkFonte>,
                          comp.atribuido_estudo.valor,
                          limpar(comp.atribuido_estudo.derivacao),
                          situacaoTexto(comp.atribuido_estudo.status),
                          g(comp.atribuido_estudo.nivel),
                        ],
                      ]}
                      casas={[null, 1, null, null, null]}
                      nota={limpar(comp.leitura)}
                    />
                  )}
                  <TabelaDados
                    titulo="Conceitos da série de pagamentos Pix por atividade"
                    colunas={["Termo", "Definição"]}
                    linhas={(E.conceitos as any[]).map((c) => [String(c.termo), limpar(c.def)])}
                    limite={E.conceitos.length}
                    nota={`Limites desta série: ${(E.limitacoes as string[]).map(limpar).join(" ")}`}
                  />
                  <p>
                    <BaixarCsv nome="epae_artes_cultura_esporte_recreacao.csv" linhas={csvEpae} rotulo="Baixar a série mensal completa (CSV)" />
                  </p>
                </>
              }
            >
              <GraficoLinhas
                semTabela
                titulo="Pix entre pessoas físicas e a seção de artes, cultura, esporte e recreação"
                dados={o.map((x) => ({ mes: String(x.ref), pf: x.pf_para_secao, secao: x.secao_para_pf, liquido: x.liquido }))}
                chaveX="mes"
                formatoX="mes"
                series={[
                  { id: "pf", rotulo: "Pessoas para a seção", sigla: "Pessoas", cor: "var(--serie-1)" },
                  { id: "secao", rotulo: "Seção para pessoas", sigla: "Seção", cor: "var(--serie-2)" },
                  { id: "liquido", rotulo: "Líquido (calculado)", sigla: "Líquido", cor: "var(--serie-4)", tracejada: true },
                ]}
                unidade="R$ bi"
                casas={1}
                zeroNoEixo
                zoom
              />
            </FiguraAnalitica>

            <Recolhido id="evidencias" nivelTitulo={2} titulo="Evidências científicas: biblioteca resumida" resumo={`${estudos.length} estudos, com base, desenho, resultado, limitações e aplicabilidade ao Brasil.`}>
              <Corpo>
                <Nota>
                  Evidência causal estrangeira demonstra mecanismos plausíveis; não é estimativa do efeito brasileiro. Textos para discussão estão marcados: os números podem mudar entre
                  versões.
                </Nota>
                <BibliotecaEstudos estudos={estudos} niveis={niveis} />
              </Corpo>
            </Recolhido>

            <Recolhido id="linha-do-tempo" nivelTitulo={2} titulo="Linha do tempo regulatória" resumo={`${linhaDoTempo.length} atos e marcos, de ${linhaDoTempo[0]?.data.slice(-4)} a ${linhaDoTempo[linhaDoTempo.length - 1]?.data.slice(-4)}, cada um com o documento de origem.`}>
              <LinhaDoTempo marcos={linhaDoTempo} />
            </Recolhido>
          </>
        }
        notas={{
          id: "conceitos",
          titulo: "Conceitos que não podem ser confundidos",
          itens: (M.conceitos as any[]).map((c) => ({ termo: limpar(c.termo), definicao: limpar(c.def) })),
          nota: `Tipos de dado distinguidos em toda a página: ${(M.tipos_de_dado as string[]).map(limpar).join("; ")}.`,
        }}
        metodo={
          <>
            <p>
              <span className="font-medium text-carvao">Princípio.</span> {limpar(M.principio)}
            </p>
            <div>
              <h3 className="text-sm font-medium text-carvao">Roteiro de análise</h3>
              <p className="mt-1">
                <span className="font-medium text-carvao">Fase atual:</span> {limpar(M.roadmap.fase_atual)}
              </p>
              <p className="mt-1">
                <span className="font-medium text-carvao">Próximas fases:</span> {(M.roadmap.proximas_fases as string[]).map(limpar).join("; ")}.
              </p>
              <p className="mt-1">
                <span className="font-medium text-carvao">Um modelo causal só será publicado quando houver:</span> {(M.roadmap.requisitos_causais as string[]).map(limpar).join("; ")}.
              </p>
              <p className="mt-1">
                {limpar(M.roadmap.aviso_regulacao)} {limpar(M.roadmap.previsao)}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-carvao">Open Finance e pesquisa futura</h3>
              <p className="mt-1">{limpar(M.open_finance.potencial)}</p>
              <p className="mt-1">
                <span className="font-medium text-carvao">Salvaguardas obrigatórias:</span> {(M.open_finance.salvaguardas as string[]).map(limpar).join("; ")}.
              </p>
              <p className="mt-1 border-l border-carvao pl-4 text-carvao">{limpar(M.open_finance.vedacoes)}</p>
            </div>
            <TabelaDados
              recolhida={false}
              titulo="Indicadores avaliados e descartados, com o motivo do descarte"
              colunas={["Item avaliado e descartado", "Motivo do descarte"]}
              linhas={(M.descartados as any[]).map((d) => [limpar(d.item), limpar(d.motivo)])}
              limite={M.descartados.length}
            />
            <p>
              Rastreabilidade completa (instituição, endereço, período, população, limitações e confiabilidade de cada fonte) nos documentos FONTES_BETS.md, METODOLOGIA_BETS.md e
              DICIONARIO_DADOS_BETS.md, no repositório da plataforma. Processo de atualização: {limpar(B.atualizacao.processo)}. Próxima atualização esperada:{" "}
              {limpar(B.atualizacao.proxima_esperada)}. Última verificação em {dataBr(B.atualizacao.verificado_em)}.
            </p>
            <div className="flex flex-wrap items-center gap-x-6">
              <BaixarCsv nome={`bets_dados_${B.corte_pesquisa}.csv`} linhas={csvBase} rotulo="Baixar os dados da página (CSV)" />
              <a href={GOLD} download={`bets_risco_financeiro_${B.corte_pesquisa}.json`} className={CLASSE_BAIXAR}>
                Baixar a base curada completa (JSON)
              </a>
              <a href={GOLD_EPAE} download className={CLASSE_BAIXAR}>
                Baixar a base do Pix por atividade (JSON)
              </a>
            </div>
          </>
        }
      />
    </>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
