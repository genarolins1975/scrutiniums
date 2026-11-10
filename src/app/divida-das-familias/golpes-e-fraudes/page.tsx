import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { FiguraAnalitica, GraficoBarras, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import type { NumeroProps } from "@/components/painel";
import { BaixarCsv, CLASSE_BAIXAR, type CelulaCsv } from "@/components/familias/apostas/BaixarCsv";
import { BibliotecaEstudos, CadeiaElos, Corpo, Grau, LINK, LegendaGraus, LinhaDoTempo, LinkFonte, Nota, Subtitulo, Texto, grauTexto } from "@/components/familias/apostas/Evidencia";
import { FiguraExplorador } from "@/components/familias/apostas/FiguraExplorador";
import { dataBr, num } from "@/lib/perguntas/leitura";
import { NIVEIS, dataDaBase, naturezaDoItem, unidadeSemRepetir, limpar, provCurada, situacaoTexto, type ItemSintese } from "@/lib/familias/apostas";
import { DESCRICAO_GOLPES, PAINEL_PIX, PERGUNTA_GOLPES, ROTA_GOLPES, dadosGolpes } from "@/lib/familias/golpes-e-fraudes";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: PERGUNTA_GOLPES,
  description: DESCRICAO_GOLPES,
  alternates: { canonical: ROTA_GOLPES },
};

const GOLD = "/obs/data/gold/fraudes.json";
/**
 * Os quatro números de abertura, um por conceito: ocorrência registrada, devolução no Pix, vitimização declarada e perda reportada
 * (estimativa privada). Não se somam; os outros quatro indicadores ficam na síntese. A faixa é ordenada pelo grau de evidência da
 * base, do A ao E (auditoria de 10/11/2026, achado 10): a página nunca abre por estimativa privada de grau D.
 */
const ABERTURA = ["estelionato_2025", "med_recuperacao", "vitimas_declaradas", "perdas_bancarias_2024"] as const;

/** Referência de série da base ("2025-S1", "2025-01a09", "2022-01a2026-04", "2025-01") em palavras, sem data crua. */
function periodoDaBase(ref: unknown): string {
  const s = String(ref ?? "");
  const faixa = /^(\d{4})-(\d{2})a(?:(\d{4})-)?(\d{2})$/.exec(s);
  if (faixa) return `${dataDaBase(`${faixa[1]}-${faixa[2]}`)} a ${dataDaBase(`${faixa[3] ?? faixa[1]}-${faixa[4]}`)}`;
  const semestre = /^(\d{4})-S(\d)$/.exec(s);
  if (semestre) return `${semestre[2]}º semestre de ${semestre[1]}`;
  return dataDaBase(s);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

/**
 * Painel "Golpes e fraudes" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta. Reescrita, no molde de
 * painel, da vista `fraudes` da aplicação do Crédito (/observatorio/financial-fraud): mesma gold (fraudes.json e as séries de crédito
 * de pulse.json), mesmos valores, nenhum cálculo novo. Fraude consumada, tentativa bloqueada, ocorrência registrada e vitimização
 * declarada são conceitos diferentes e nunca se somam; cada número traz o grau de evidência (A a E) e a situação.
 */
export default function PaginaGolpes() {
  const { F, credito, sintese, niveis, cadeia, estudos, linhaDoTempo } = dadosGolpes();
  const S = F.series;
  const g = (nivel: string) => grauTexto(nivel, niveis);
  const porId = (id: string) => sintese.find((k) => k.id === id);
  const curadoria = `Curadoria da gold fraudes.json, versão ${F.versao}`;

  const numeros: NumeroProps[] = ABERTURA.map((id) => porId(id))
    .filter((k): k is ItemSintese => Boolean(k) && k!.situacao !== "imprensa")
    // ordenação estável pelo grau: se a curadoria rebaixar um número, ele desce na faixa sem ninguém editar a lista
    .sort((x, y) => NIVEIS.indexOf(x.nivel) - NIVEIS.indexOf(y.nivel))
    .map((k) => ({
      rotulo: k.rotulo,
      formato: "texto" as const,
      valorTexto: k.exibir,
      unidade: unidadeSemRepetir(k.exibir, k.unidade, k.periodo),
      periodo: k.periodo,
      fonte: k.fonte,
      natureza: naturezaDoItem(k),
      tamanho: "m" as const,
      nota: (
        <>
          <Grau nivel={k.nivel} niveis={niveis} /> <span className="mt-1 block">{k.conceito}.</span>
        </>
      ),
    }));

  const est = S.estelionato;
  const estObs: any[] = est.obs;
  const feb = S.perdas_febraban;
  const ser = S.serasa_tentativas;
  const inc = S.incidentes_ciberneticos;
  const med = S.med;
  const medOficial = (med.obs as any[]).find((x) => x.metrica === "taxa_recuperacao");
  const medImprensa = (med.obs as any[]).find((x) => x.metrica === "valor_contestado");
  const T = F.tipos;
  const P = F.perfil;
  const SUB = F.subnotificacao;
  const EX = F.explorador;
  const MIT = F.mitigacao;
  const M = F.metodologia;
  const desde = "2019-01";

  const csvBase: CelulaCsv[][] = [
    ["bloco", "referencia", "indicador", "valor", "unidade", "nivel_evidencia", "status", "fonte", "url"],
    ...sintese.map((k) => ["sintese", k.periodo, k.rotulo, k.valor ?? k.exibir, k.unidade, k.nivel, k.situacao, k.fonte, k.url]),
    ...estObs.map((x) => ["estelionato", x.ref, "ocorrências registradas", x.v, "ocorrências", x.nivel, x.status, "FBSP/SINESP", x.url]),
    ...(feb.obs as any[]).map((x) => ["perdas_febraban", x.ref, "perdas consumadas reportadas", x.v, "R$ bi", x.nivel, x.status, "Febraban", x.url]),
    ...(ser.obs as any[]).map((x) => ["serasa_tentativas", x.ref, "tentativas detectadas", x.v, "milhões", x.nivel, x.status, "Serasa Experian", x.url]),
    ...(inc.obs as any[]).map((x) => ["incidentes_ciberneticos", x.ref, "incidentes relevantes no SFN", x.v, "incidentes", x.nivel, x.status, "BCB/REF", x.url]),
    ...(med.obs as any[]).map((x) => ["med", x.ref, x.metrica, x.v, x.unidade, x.nivel, x.status, x.fonte || "BCB", x.url]),
  ];

  return (
    <>
      <MarcaVisita secao="familias:golpes-e-fraudes" />
      <header>
        <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_GOLPES} fontes={["credito"]} />
        <NavegacaoColecao colecao="divida" />
      </header>
      <PaginaPainel
        rota={ROTA_GOLPES}
        abertura={{
          grupo: "Dívida e crédito das famílias", acento: "bronze",
          titulo: PERGUNTA_GOLPES,
          lead: "Perda confirmada, tentativa bloqueada, ocorrência registrada e estimativa são números diferentes. A página separa cada um, com o grau de evidência de A (registro oficial) a E (sinal ainda não validado).",
          recorte: {
            periodo: limpar(F.periodo_coberto),
            universo: "Brasil, golpes e fraudes financeiras",
            fonte: "Banco Central, Fórum Brasileiro de Segurança Pública, DataSenado, Febraban e Serasa Experian",
          },
          limite:
            "que os golpes explicam a inadimplência, nem quanto se perde ao todo. Volume de contestações não é volume de fraude, as fontes cobrem recortes sobrepostos do mesmo fenômeno e nenhuma delas é somada a outra.",
          fontesDatasSiglas: (
            <>
              <p>
                Última revisão da curadoria em {dataBr(F.gerado_em)}; corte da pesquisa em {dataBr(F.corte_pesquisa)}. Processo de atualização: {limpar(F.atualizacao.processo)}. Próximas
                atualizações esperadas: {limpar(F.atualizacao.proxima_esperada)}.
              </p>
              <p>
                MED: Mecanismo Especial de Devolução do Pix. FBSP: Fórum Brasileiro de Segurança Pública. SINESP: sistema nacional de informações de segurança pública. SFN: Sistema
                Financeiro Nacional. BO: boletim de ocorrência. REF: Relatório de Estabilidade Financeira, do Banco Central.
              </p>
            </>
          ),
        }}
        rotuloNumeros="Quatro medidas de golpes e fraudes, cada uma com o seu conceito e o seu grau de evidência"
        numeros={numeros}
        notaNumeros={
          <div className="space-y-4">
            <p>
              Cada número declara conceito, período e grau de evidência, e nenhum soma fontes distintas: perdas (Febraban), tentativas (Serasa), ocorrências (FBSP) e vitimização
              (DataSenado) cobrem recortes sobrepostos do mesmo fenômeno. {limpar(F.aviso)}
            </p>
            <LegendaGraus niveis={niveis} />
          </div>
        }
        figuras={
          <>
            <Recolhido id="sintese" aberto nivelTitulo={2} titulo="Fraude confirmada, tentativa bloqueada e estimativa são coisas diferentes" resumo="Os oito indicadores da síntese, cada um com período, grau de evidência, situação, fonte e conceito.">
              <Corpo>
                <TabelaDados
                  recolhida={false}
                  titulo="Síntese de golpes e fraudes: indicador, valor, período, grau de evidência, situação, fonte e conceito"
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
                />
              </Corpo>
            </Recolhido>

            <Recolhido id="canais" aberto nivelTitulo={2} titulo="Como fraudes podem chegar ao crédito" resumo="A cadeia plausível entre exposição digital, fraude e crédito, com o grau de evidência de cada elo.">
              <Corpo>
                <Texto>{cadeia.descricao}</Texto>
                <CadeiaElos cadeia={cadeia} rotulo="Cadeia plausível entre fraude e crédito, na ordem do raciocínio" />
                <TabelaDados
                  recolhida={false}
                  titulo="Evidência de cada elo da cadeia entre fraude e crédito"
                  colunas={["Elo", "Grau de evidência", "O que sustenta"]}
                  linhas={cadeia.elos.map((e) => [`${e.de} → ${e.para}`, e.grau, e.evidencia])}
                  limite={cadeia.elos.length}
                  nota="A seta indica a ordem do raciocínio, não uma relação de causa medida."
                />
              </Corpo>
            </Recolhido>

            <FiguraAnalitica
              id="dimensao"
              pergunta="Quantos estelionatos são registrados por ano?"
              subtitulo={`Ocorrências de estelionato registradas pelas polícias · milhões de ocorrências por ano · Brasil, ${estObs[0].ref} a ${estObs[estObs.length - 1].ref}`}
              natureza="OBSERVADO"
              proveniencia={provCurada({
                indicador: "Ocorrências de estelionato registradas, todas as modalidades",
                natureza: "OBSERVADO",
                orgao: "Fórum Brasileiro de Segurança Pública",
                dataset: "Anuário Brasileiro de Segurança Pública",
                recurso: "Registros do SINESP e das secretarias estaduais de segurança, consolidados nos Anuários de 2019 a 2026",
                url: String(estObs[0].url),
                unidade: limpar(est.unidade),
                frequencia: limpar(est.freq),
                inicio: String(estObs[0].ref),
                fim: String(estObs[estObs.length - 1].ref),
                geradoEm: F.gerado_em,
                limitacoes: [limpar(est.nota)],
                pipeline: curadoria,
              })}
              leitura={
                <LeituraGuiada>
                  De {num(estObs[0].v, 0)} ocorrências em {estObs[0].ref} para {num(estObs[estObs.length - 1].v, 0)} em {estObs[estObs.length - 1].ref}. A barra conta boletins
                  registrados, não vítimas.
                </LeituraGuiada>
              }
              comoInterpretar={limpar(est.conceito)}
              ressalva={limpar(est.nota)}
              naoConcluir="quantas pessoas sofreram golpe, nem que o crime cresceu na mesma proporção. A série conta boletins registrados: a maior parte das vítimas não registra, e a mudança de 2020 e 2021 altera o regime da série."
              tabela={{
                titulo: "Ocorrências de estelionato registradas por ano, com grau de evidência e situação",
                colunas: ["Ano", "Ocorrências registradas", "Grau de evidência", "Situação"],
                linhas: estObs.map((x) => [String(x.ref), x.v, g(x.nivel), situacaoTexto(x.status)]),
                casas: [null, 0, null, null],
                limite: estObs.length,
              }}
              depois={
                <>
                  <section id="med" aria-labelledby="med-t" className="scroll-mt-28 space-y-3 border-t border-linha pt-6">
                    <Subtitulo id="med-t">Devolução no Pix pelo MED</Subtitulo>
                    {medOficial && (
                      <Texto>
                        <span className="numero-p">{num(medOficial.v, 1)}%</span> do valor contestado pelas vítimas foi recuperado em {dataDaBase(medOficial.ref)}.{" "}
                        <Grau nivel={medOficial.nivel} niveis={niveis} /> · {situacaoTexto(medOficial.status)} · <LinkFonte href={medOficial.url}>{limpar(medOficial.fonte)}</LinkFonte>
                      </Texto>
                    )}
                    {medImprensa && (
                      <Texto suave>
                        Acumulado de {periodoDaBase(medImprensa.ref)}: R$ {num(medImprensa.v, 1)} bi contestados. {limpar(medImprensa.nota)} <Grau nivel={medImprensa.nivel} niveis={niveis} /> ·{" "}
                        {situacaoTexto(medImprensa.status)} · <LinkFonte href={medImprensa.url}>{limpar(medImprensa.fonte)}</LinkFonte>
                      </Texto>
                    )}
                    <Texto suave>{limpar(med.conceito)}</Texto>
                    <Nota rotulo="Quebra de método:">{limpar(med.nota)}</Nota>
                    <Nota rotulo="Em caso de golpe.">
                      {limpar(F.links_apoio.nota)} <LinkFonte href={F.links_apoio.med.url}>{limpar(F.links_apoio.med.rotulo)}</LinkFonte> ·{" "}
                      <LinkFonte href={F.links_apoio.celular_seguro.url}>{limpar(F.links_apoio.celular_seguro.rotulo)}</LinkFonte> ·{" "}
                      <LinkFonte href={F.links_apoio.consumidor.url}>{limpar(F.links_apoio.consumidor.rotulo)}</LinkFonte>
                    </Nota>
                    <p className="t-meta text-carvao-muted">
                      <Link href={PAINEL_PIX} prefetch={false} className={`inline-flex min-h-[44px] items-center text-carvao ${LINK}`}>
                        A série completa do MED, mês a mês, no painel do Pix
                      </Link>{" "}
                      Mesma fonte (Banco Central), universo do sistema de pagamentos instantâneos. Contestação não é fraude confirmada, lá como aqui.
                    </p>
                  </section>
                  <TabelaDados
                    recolhida={false}
                    id="perdas-bancos"
                    tituloVisivel="Perdas reportadas pelos bancos"
                    lead={limpar(feb.conceito)}
                    titulo="Perdas com golpes e fraudes reportadas pelos bancos, por ano"
                    colunas={["Ano", `Perdas, ${limpar(feb.unidade)}`, "Grau de evidência", "Situação", "Fonte"]}
                    linhas={(feb.obs as any[]).map((x) => [
                      String(x.ref),
                      x.v,
                      g(x.nivel),
                      situacaoTexto(x.status),
                      <LinkFonte key={x.ref} href={x.url}>
                        publicação de origem
                      </LinkFonte>,
                    ])}
                    casas={[null, 1, null, null, null]}
                    nota={limpar(feb.nota)}
                  />
                  <TabelaDados
                    recolhida={false}
                    id="tentativas"
                    tituloVisivel="Tentativas de fraude detectadas"
                    lead={limpar(ser.conceito)}
                    titulo="Tentativas de fraude detectadas pela Serasa Experian, por período divulgado"
                    colunas={["Período", `Tentativas, ${limpar(ser.unidade).replace(/ de tentativas$/, "")}`, "Grau de evidência", "Situação", "Observação", "Fonte"]}
                    linhas={(ser.obs as any[]).map((x) => [
                      periodoDaBase(x.ref),
                      x.v,
                      g(x.nivel),
                      situacaoTexto(x.status),
                      x.nota ? limpar(x.nota) : "sem observação",
                      <LinkFonte key={x.ref} href={x.url}>
                        publicação de origem
                      </LinkFonte>,
                    ])}
                    casas={[null, 3, null, null, null, null]}
                    nota="Os períodos têm durações diferentes (um mês, um semestre e nove meses) e não formam uma série: cada linha é uma divulgação."
                  />
                  <TabelaDados
                    recolhida={false}
                    id="incidentes"
                    tituloVisivel="Incidentes cibernéticos relevantes no sistema financeiro"
                    lead={limpar(inc.conceito)}
                    titulo="Incidentes cibernéticos relevantes reportados ao Banco Central, por período"
                    colunas={["Período", "Incidentes reportados", "Grau de evidência", "Situação", "Fonte"]}
                    linhas={(inc.obs as any[]).map((x) => [
                      periodoDaBase(x.ref),
                      x.v,
                      g(x.nivel),
                      situacaoTexto(x.status),
                      <LinkFonte key={x.ref} href={x.url}>
                        publicação de origem
                      </LinkFonte>,
                    ])}
                    casas={[null, 0, null, null, null]}
                  />
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo="Ocorrências de estelionato registradas por ano"
                dados={estObs.map((x) => ({ ano: String(x.ref), v: x.v / 1e6 }))}
                chaveCategoria="ano"
                series={[{ id: "v", rotulo: "Ocorrências registradas", cor: "var(--serie-1)" }]}
                unidade="milhões"
                casas={2}
                rotulosValor
              />
            </FiguraAnalitica>

            <Recolhido id="tipos" aberto nivelTitulo={2} titulo="Tipos de fraude: o melhor dado disponível para cada um" resumo="Frequência, perda média e recuperação por tipo de golpe, com a fonte de cada célula.">
              <Corpo>
                <Texto>{limpar(T.descricao)}</Texto>
                <TabelaDados
                  recolhida={false}
                  titulo="Tipos de fraude: frequência, perda média, recuperação e grau de evidência"
                  colunas={["Tipo", "Frequência", "Perda média", "Recuperação", "Grau de evidência", "Observação"]}
                  linhas={(T.itens as any[]).map((t) => [limpar(t.tipo), limpar(t.frequencia), limpar(t.perda_media), limpar(t.recuperacao), g(t.nivel), t.nota ? limpar(t.nota) : "sem observação"])}
                  limite={T.itens.length}
                  fixarPrimeiraColuna
                  nota="Onde não existe medição publicada, a célula diz que o dado não está disponível: nada aqui é preenchido com estimativa improvisada."
                />
              </Corpo>
            </Recolhido>

            <Recolhido id="quem-sofre" aberto nivelTitulo={2} titulo="Quem é mais afetado: associações declaradas, lacunas à vista" resumo="Os grupos com evidência de exposição e o tamanho da subnotificação.">
              <Corpo>
                <Nota>{limpar(P.aviso_populacoes)}</Nota>
                <TabelaDados
                  recolhida={false}
                  titulo="Grupos mais afetados por golpes e fraudes e a evidência de cada um"
                  colunas={["Grupo", "Evidência, com a fonte e o grau entre parênteses"]}
                  linhas={(P.grupos as any[]).map((x) => [limpar(x.rotulo), limpar(x.evidencia)])}
                  limite={P.grupos.length}
                  nota={limpar(P.lacunas)}
                />
                <TabelaDados
                  recolhida={false}
                  id="subnotificacao"
                  tituloVisivel="Fraude reportada e fraude estimada: o tamanho da subnotificação"
                  lead={limpar(SUB.aviso)}
                  titulo="Camadas de medição de golpes e fraudes: valor, grau de evidência e o que cada uma captura"
                  colunas={["Camada de medição", "Valor", "Grau de evidência", "O que captura"]}
                  linhas={(SUB.camadas as any[]).map((c) => [limpar(c.rotulo), limpar(c.valor), g(c.nivel), limpar(c.conceito)])}
                  limite={SUB.camadas.length}
                  nota={limpar(SUB.gap)}
                />
              </Corpo>
            </Recolhido>

            <FiguraExplorador
              id="credito"
              pergunta="Como andam os indicadores de crédito das famílias?"
              credito={credito}
              desde={desde}
              marcos={(EX.eventos as any[]).map((e) => ({ x: String(e.x).slice(0, 7), rotulo: limpar(e.label) }))}
              rotuloMarcos="Mostrar os marcos de fraude e de segurança dos pagamentos"
              arquivo="fraudes_explorador"
              comoInterpretar={limpar(EX.descricao)}
              naoConcluir="que os golpes movem o indicador escolhido. Rótulo desta leitura: sem evidência suficiente. Um marco perto de uma mudança na linha é coincidência de datas, não causa demonstrada."
              ressalva={
                <>
                  Por que não há correlação nem defasagens: {limpar(EX.justificativa_min_obs)} Um gráfico de dois eixos com estelionato e inadimplência produziria uma relação visual
                  artificial; por isso as séries de crédito aparecem sozinhas, com os marcos anotados.
                </>
              }
              depois={
                <Texto suave>
                  Séries identificadas e ainda não integradas: {(EX.indicadores_ausentes as any[]).map((i) => limpar(i.rotulo)).join("; ")}.
                  {credito.ausentes.length > 0 && ` Sem série nesta publicação: ${credito.ausentes.join("; ")}.`} Rótulos que o método admite para uma leitura conjunta:{" "}
                  {(EX.rotulos_validos as string[]).map(limpar).join("; ")}.
                </Texto>
              }
            />

            <Recolhido id="mitigacao" aberto nivelTitulo={2} titulo="Recuperação e mitigação: o elo institucional" resumo="As camadas de recuperação e de proteção existentes e o que se sabe da eficácia de cada uma.">
              <Corpo>
                <Texto>{limpar(MIT.descricao)}</Texto>
                <TabelaDados
                  recolhida={false}
                  titulo="Camadas de recuperação e mitigação de fraudes e a eficácia conhecida de cada uma"
                  colunas={["Camada", "Eficácia conhecida", "Observação"]}
                  linhas={(MIT.itens as any[]).map((m) => [limpar(m.rotulo), limpar(m.eficacia), m.nota ? limpar(m.nota) : "sem observação"])}
                  limite={MIT.itens.length}
                />
              </Corpo>
            </Recolhido>

            <Recolhido id="evidencias" nivelTitulo={2} titulo="Evidências científicas e referências internacionais" resumo={`${estudos.length} estudos e referências, com base, desenho, resultado, limitações e aplicabilidade ao Brasil.`}>
              <Corpo>
                <Nota>
                  Evidência estrangeira demonstra mecanismos plausíveis e desenhos institucionais; não é estimativa do efeito brasileiro. O achado menos intuitivo, dos Estados Unidos: com
                  remediação eficaz, o dano de crédito do roubo de identidade é pequeno e transitório. A variável decisiva é a capacidade de recuperação, não o golpe em si.
                </Nota>
                <BibliotecaEstudos estudos={estudos} niveis={niveis} />
              </Corpo>
            </Recolhido>

            <Recolhido id="linha-do-tempo" nivelTitulo={2} titulo="Linha do tempo da segurança contra fraudes digitais" resumo={`${linhaDoTempo.length} atos e marcos, de ${linhaDoTempo[0]?.data.slice(-4)} a ${linhaDoTempo[linhaDoTempo.length - 1]?.data.slice(-4)}, cada um com o documento de origem.`}>
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
                <span className="font-medium text-carvao">Uma leitura causal só será publicada quando houver:</span> {(M.roadmap.requisitos_causais as string[]).map(limpar).join("; ")}.
              </p>
              <p className="mt-1">
                {limpar(M.roadmap.aviso)} {limpar(M.roadmap.previsao)}
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
              Rastreabilidade completa nos documentos FONTES_FRAUDES.md, METODOLOGIA_FRAUDES.md e DICIONARIO_DADOS_FRAUDES.md, no repositório da plataforma. Processo de atualização:{" "}
              {limpar(F.atualizacao.processo)}. Próximas atualizações esperadas: {limpar(F.atualizacao.proxima_esperada)}. Última verificação em {dataBr(F.atualizacao.verificado_em)}.
            </p>
            <div className="flex flex-wrap items-center gap-x-6">
              <BaixarCsv nome={`fraudes_dados_${F.corte_pesquisa}.csv`} linhas={csvBase} rotulo="Baixar os dados da página (CSV)" />
              <a href={GOLD} download={`fraudes_risco_credito_${F.corte_pesquisa}.json`} className={CLASSE_BAIXAR}>
                Baixar a base curada completa (JSON)
              </a>
            </div>
          </>
        }
      />
    </>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
