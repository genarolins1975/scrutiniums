import { semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { SituacaoDoModelo } from "@/components/energia/EstadoModelo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { PrevisoesFichas, PrevisoesPesos } from "@/components/energia/PrevisoesModelos";
import {
  PrevisoesAnalise,
  PrevisoesAuditoria,
  PrevisoesCapitulos,
  PrevisoesDatas,
  PrevisoesFichaLinha,
  PrevisoesIndisponivel,
  PrevisoesLegenda,
  PrevisoesPainel,
  PrevisoesRecorte,
  PrevisoesResposta,
  PrevisoesSeguir,
  PrevisoesTermos,
} from "@/components/energia/PrevisoesPagina";
import { PrevisoesReexecucao } from "@/components/energia/PrevisoesReexecucao";
import { TabelaAdaptativa, type ColunaAdaptativa } from "@/components/energia/PrevisoesTabela";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, plural } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_AMOSTRA,
  COLUNAS_DECISOES,
  COLUNAS_DESEMPENHO,
  COLUNAS_PROSPECTIVO,
  COLUNAS_VALIDACOES,
  GOLD_PREVISOES,
  ROTA_MODELOS,
  ROTULO_CONFERENCIA,
  cartoesModelos,
  coeficientesDoSegmento,
  colunasCoeficientes,
  d7AcimaDe1,
  decisoesPendentes,
  downloadsDoPainel,
  enderecoPainel,
  fichasOrdenadas,
  linhasAmostra,
  linhasCoeficientes,
  linhasDesempenho,
  linhasEntradasFormula,
  linhasModelos,
  linhasProspectivo,
  linhasReexecucao,
  liberacaoEmPalavras,
  listaE,
  matrizModelos,
  metricasModelos,
  minimoCalibracao,
  notaEntradas,
  partirInterno,
  perguntaPainel,
  proximoPainel,
  respostaP014,
  respostaP016,
  revisaoIndependentePendente,
  rotuloEstadoModelo,
  segmentosCoeficientes,
  semCodigosInternos,
  termosPrevisoes,
  textoCoeficientes,
  vereditoP014,
  vereditoP016,
  type LinhaEntradas,
  type LinhaMatrizModelo,
} from "@/lib/energia/previsoes";
import type { ModelosGold } from "@/lib/energia/tipos";
import type { PrevisoesDesempenhoGold } from "@/lib/energia/tipos-previsoes";
import { snapshotLegivel } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "O que os modelos de previsão do PLD conseguem prever",
  description:
    "Estado de pesquisa, papel, número publicado e protocolo de cada modelo de previsão do PLD (B0, S0, C1, C2-P e C2-H), com entradas, fórmula, pesos do último ajuste, reexecução das previsões arquivadas e a situação do teste fora da amostra e da calibração das faixas.",
  alternates: { canonical: ROTA_MODELOS },
};

const LINK_MODELO =
  "inline-flex min-h-[44px] items-center font-serif text-lg text-energia-dark underline underline-offset-4 hover:text-carvao [@media(pointer:fine)]:md:min-h-0";

const COLUNAS_MATRIZ: ColunaAdaptativa<LinhaMatrizModelo>[] = [
  {
    id: "modelo",
    rotulo: "Modelo",
    classe: "w-[12rem]",
    celula: (l) => (
      <>
        <Link href={l.href} className={LINK_MODELO}>
          {l.codigo} · {l.nome}
        </Link>
        <span className="block text-xs text-mineral">versão {l.versao}</span>
      </>
    ),
  },
  { id: "papel", rotulo: "Papel", classe: "w-[8.5rem]", celula: (l) => l.papel },
  { id: "situacao", rotulo: "Situação", classe: "w-[11rem]", celula: (l) => <SituacaoDoModelo situacao={l.situacao} /> },
  { id: "comparado", rotulo: "Comparado com", classe: "w-[8.5rem]", celula: (l) => l.comparado },
  { id: "emissao", rotulo: "Número publicado", classe: "w-[12rem]", celula: (l) => l.emissao },
  {
    id: "protocolo",
    rotulo: "Protocolo",
    celula: (l) => (
      <>
        {l.protocolo}
        <span className="mt-1 block text-xs text-carvao-muted">Reexecução do arquivo: {l.reexecucao}</span>
      </>
    ),
  },
];

const COLUNAS_ENTRADAS: ColunaAdaptativa<LinhaEntradas>[] = [
  {
    id: "modelo",
    rotulo: "Modelo",
    classe: "w-[12rem]",
    celula: (l) => (
      <Link href={l.href} className={LINK_MODELO}>
        {l.codigo} · {l.nome}
      </Link>
    ),
  },
  {
    id: "entradas",
    rotulo: "Entradas",
    classe: "w-[17rem]",
    celula: (l) =>
      l.entradas ? (
        <ul className="list-disc space-y-0.5 pl-4">
          {l.entradas.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        "não publicadas"
      ),
  },
  { id: "formula", rotulo: "Como calcula", celula: (l) => <span className="[overflow-wrap:anywhere]">{l.formula}</span> },
  { id: "pesos", rotulo: "Pesos", classe: "w-[13rem]", celula: (l) => l.pesos },
];

export default function ModelosPage() {
  const g = lerGold<PrevisoesDesempenhoGold>(GOLD_PREVISOES);
  if (!integra(g)) return <PrevisoesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const fichas = fichasOrdenadas(g.fichas);
  const registro = lerGold<ModelosGold>("modelos.json");
  const reg = integra(registro) ? registro : null;
  const cartoes = cartoesModelos(g, reg);
  const matriz = matrizModelos(g, reg);
  const entradas = linhasEntradasFormula(fichas);
  const mm = metricasModelos(g);
  const coef = linhasCoeficientes(fichas);
  const segmentos = segmentosCoeficientes(fichas);
  const barras = Object.fromEntries(segmentos.map((s) => [s.id, coeficientesDoSegmento(fichas, s.id)]));
  const textos = Object.fromEntries(segmentos.map((s) => [s.id, textoCoeficientes(fichas, s.id)]));
  const acima = d7AcimaDe1(fichas);
  const ajuste = coef[0]?.origem_ajuste ?? null;
  const reexec = linhasReexecucao(g);
  const amostra = linhasAmostra(g);
  const prospectivo = linhasProspectivo(g);
  const minimo = minimoCalibracao(g.definicoes.calibracao);
  const estadosAmostra = Array.from(new Set(amostra.map((a) => a.estado)));
  const versao = g.gerado_em.slice(0, 10);
  const fonte = "Observatório, registro de modelos de previsão do PLD";
  const pubDes = g.publicacao_desempenho;
  const pendentes = decisoesPendentes(g);
  const revisaoPendente = revisaoIndependentePendente(g);
  const decisoes = g.governanca.decisao_revisavel.map((d, i) => ({
    id: `d${i}`,
    item: d.item,
    estado: d.estado ?? "sem estado",
    responsavel: d.responsavel ?? "não indicado",
    evidencia: d.evidencia ?? "sem evidência registrada",
  }));
  const validacoes = g.validacoes.map((v, i) => ({ id: `v${i}`, nome: v.nome, resultado: ROTULO_CONFERENCIA[v.resultado] ?? v.resultado, detalhe: v.detalhe }));
  const avaliados = g.modelos.filter((m) => m.avaliado).map((m) => m.codigo);
  const naoAvaliados = g.modelos.filter((m) => !m.avaliado);
  const desempenho = g.desempenho.publicado ? linhasDesempenho(g.desempenho.por_horizonte) : [];
  const termos = termosPrevisoes(g.definicoes);
  const dia = g.gerado_em.slice(0, 10);
  const tolerancia = fichas.find((f) => f.reproducao?.reexecucao_do_arquivo)?.reproducao?.reexecucao_do_arquivo?.tolerancia;

  const configuracaoIgual = g.dados.configuracao_registrada_sha256 === g.dados.configuracao_sha256;
  const oQueMudou14 = (
    <>
      {ajuste ? `Último ajuste dos candidatos C2 em ${dataBR(ajuste)} (os pesos mudam a cada domingo). ` : ""}A configuração registrada dos modelos é{" "}
      {configuracaoIgual ? "igual" : "diferente"} à usada para calcular esta página.
      {pendentes.length ? ` ${plural(pendentes.length, "decisão da governança segue pendente", "decisões da governança seguem pendentes")} (lista em Auditar).` : ""}
    </>
  );
  const comoInterpretar14 = (
    <>
      Pesquisa quer dizer que o modelo está em estudo e não alimenta a previsão principal; referência experimental, que o número é publicado e identificado como tal, sem
      aprovação; produção, que o modelo está aprovado. B0 e S0 são referências simples: repetir o último período ou o mesmo período do ano anterior. Os candidatos C2 partem do
      B0 e somam correções pesadas pelos coeficientes; coeficiente zero não corrige, e acima de 1 na média dos 7 dias amplia o desvio recente.
    </>
  );
  const naoConcluir14 = (
    <>
      Situação, número publicado e protocolo não dizem se um modelo acerta: isso é o painel de desempenho. Coeficiente grande não quer dizer que a variável cause o preço. A
      reexecução refaz o número arquivado com o dado do corte; é uma conferência do próprio observatório e não substitui a revisão metodológica independente
      {revisaoPendente ? ", que está pendente" : ""}.{" "}
      {fichas
        .filter((f) => !f.implementado_no_repositorio)
        .map((f) => `Os pesos do ${f.codigo} não são publicáveis e não foram reconstruídos.`)
        .join(" ")}
    </>
  );
  const oQueMudou16 = (
    <>
      {pubDes.publicado
        ? "Números de desempenho liberados para o portal."
        : `Decisão de publicação: ${pubDes.decisao?.estado === "PENDENTE" || !pubDes.decisao ? "pendente" : (pubDes.decisao?.estado ?? "").toLowerCase()}.`}{" "}
      {g.prospectivo.leitura}
    </>
  );
  const comoInterpretar16 = (
    <>
      O teste fora da amostra refaz, para cada dia desde {dataBR(g.dados.origens.inicio)}, a previsão com o dado disponível naquele corte (um dado só entra se o seu período
      terminou até 1 dia antes do corte) e a compara com o realizado; o acompanhamento depois da emissão usa só rodadas registradas antes do resultado. Uma faixa é calibrada
      quando contém o realizado na proporção prometida, medida em entregas distintas, não em origens.
    </>
  );
  const naoConcluir16 = (
    <>
      {pubDes.publicado
        ? "Ganho pequeno com intervalo que inclui zero não mostra que um modelo supera outro."
        : "Enquanto os números estiverem retidos, nada aqui diz que um modelo supera outro."}{" "}
      Teste com dados do passado é reconstrução sob hipótese, não operação real. Origens vizinhas preveem a mesma entrega: o tamanho que conta é o de entregas distintas, e a
      contagem de controles que passam não mede a capacidade de prever.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <MarcaVisita secao="energia:pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["PLD", "MLT", "CCEE", "ONS", "EAR", "ENA"]}
          titulo="O que os modelos conseguem prever?"
          lead="O estado de cada modelo de previsão do Preço de Liquidação das Diferenças (PLD), o que ele publica e o que já se pode afirmar sobre o acerto fora da amostra."
          recorte={`Registro de ${dataBR(dia)} · ${plural(fichas.length, "modelo", "modelos")} · 7 horizontes e 4 submercados · R$/MWh nominais`}
          fonte="Observatório, registro de modelos de previsão do PLD"
          referencia={
            <>
              {plural(fichas.length, "modelo registrado", "modelos registrados")}; teste fora da amostra com {g.dados.origens.n.toLocaleString("pt-BR")} origens diárias; processado em{" "}
              {carimbo(g.gerado_em)}.<span data-nivel="analisar"> Configuração sha256 {g.dados.configuracao_sha256.slice(0, 12)}.</span>
            </>
          }
          datas={
            <PrevisoesDatas
              itens={[
                { rotulo: "Registro de modelos", texto: `processado em ${carimbo(g.gerado_em)}`, natureza: "CALCULADO" },
                { rotulo: "PLD horário", texto: `até ${dataBR(g.dados.ultimo_dia_pld)}`, natureza: "OBSERVADO" },
                { rotulo: "EAR", texto: g.dados.ultimo_dia_ear ? `até ${dataBR(g.dados.ultimo_dia_ear)}` : "sem dado nesta publicação", natureza: "OBSERVADO" },
                { rotulo: "ENA", texto: g.dados.ultimo_dia_ena ? `até ${dataBR(g.dados.ultimo_dia_ena)}` : "sem dado nesta publicação", natureza: "OBSERVADO" },
                { rotulo: "Pesos dos candidatos C2", texto: ajuste ? `ajuste de ${dataBR(ajuste)}` : "sem ajuste registrado", natureza: "CALCULADO" },
                { rotulo: "Teste fora da amostra", texto: `origens de ${dataBR(g.dados.origens.inicio)} a ${dataBR(g.dados.origens.fim)}`, natureza: "CALCULADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Indicadores do registro de modelos">
              <Numero
                variante="faixa"
                rotulo="Modelos registrados"
                natureza="CALCULADO"
                valor={mm.registrados.length}
                formato="num"
                casas={0}
                unidade={mm.registrados.length === 1 ? "modelo" : "modelos"}
                periodo={`registro de ${dataBR(dia)}`}
                cor="var(--cor-energia)"
                nota={listaE(mm.registrados)}
              />
              <Numero
                variante="faixa"
                rotulo="Em produção"
                natureza="CALCULADO"
                valor={mm.emProducao.length}
                formato="num"
                casas={0}
                unidade={mm.emProducao.length === 1 ? "modelo" : "modelos"}
                periodo={`registro de ${dataBR(dia)}`}
                cor="var(--serie-referencia)"
                nota="Produção alimenta a previsão principal."
              />
              <Numero
                variante="faixa"
                rotulo="Com número publicado"
                natureza="CALCULADO"
                valor={mm.comNumero.length}
                formato="num"
                casas={0}
                unidade={mm.comNumero.length === 1 ? "modelo" : "modelos"}
                periodo="arquivo de emissões"
                cor="var(--cor-energia)"
                nota={mm.comNumeroExperimental.length ? `${listaE(mm.comNumeroExperimental)}, como referência experimental.` : undefined}
              />
              <Numero
                variante="faixa"
                rotulo="Com desempenho publicado"
                natureza="CALCULADO"
                valor={mm.desempenhoPublicado.length}
                formato="num"
                casas={0}
                unidade={`de ${mm.avaliados.length} avaliados`}
                periodo="teste fora da amostra"
                cor="var(--serie-referencia)"
                nota={mm.publicado ? undefined : "Números retidos até a liberação formal."}
              />
            </FaixaMetricas>
          }
        >
          Cada modelo tem uma ficha com entradas, fórmula, pesos, corte, hipóteses, aprovação e limitações, e cada previsão arquivada pode ser refeita. O segundo painel diz o que
          já se pode afirmar sobre o desempenho: o teste fora da amostra, o acompanhamento depois de cada rodada e a calibração das faixas.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="registro">
            <PrevisoesPainel id="p014">
              <PainelEvidencia
                id="p014"
                pergunta={perguntaPainel("p014")}
                subtitulo="Registro de modelos: situação, número publicado e protocolo · entradas, fórmulas e pesos · reexecução do arquivo"
                natureza="PREVISTO"
                porQueImporta={
                  <>
                    Um número de previsão sem a receita não pode ser conferido nem comparado. A ficha diz que informação entra, como é transformada, o que estava disponível no
                    corte e quem aprovou o uso; a reexecução mostra que o número arquivado sai de novo do mesmo dado.
                  </>
                }
                oQueMudou={oQueMudou14}
                comoInterpretar={comoInterpretar14}
                naoConcluir={naoConcluir14}
                naoConcluirNoCorpo
                proveniencia={g.proveniencia}
              >
                <div className="space-y-6">
                  <PrevisoesResposta id="p014" veredito={vereditoP014(g)}>
                    {respostaP014(g)}
                  </PrevisoesResposta>
                  <section aria-labelledby="matriz-titulo" className="space-y-3" data-matriz-modelos="">
                    <h3 id="matriz-titulo" className="ed-h3 font-serif text-carvao">
                      {plural(fichas.length, "modelo registrado", "modelos registrados")}: situação, número publicado e protocolo
                    </h3>
                    <TabelaAdaptativa
                      legenda="Modelos de previsão do PLD: papel, situação, referência de comparação, número publicado e protocolo"
                      colunas={COLUNAS_MATRIZ}
                      linhas={matriz}
                      nome="matriz-modelos"
                    />
                    <PrevisoesLegenda>
                      <span className="font-medium text-carvao">Pesquisa</span>: o modelo está em estudo e não alimenta previsão.{" "}
                      <span className="font-medium text-carvao">Referência experimental</span>: em pesquisa, com número publicado e identificado como tal, sem aprovação.{" "}
                      <span className="font-medium text-carvao">Produção</span>: aprovado, alimenta a previsão principal. São situações diferentes, e o número de controles
                      que passam não mede a capacidade de prever.
                    </PrevisoesLegenda>
                    <PrevisoesLegenda>
                      Protocolo do teste fora da amostra, igual para os modelos avaliados: seleção com as {g.definicoes.periodos.desenvolvimento}; teste final com as{" "}
                      {g.definicoes.periodos.teste}; {g.definicoes.periodos.fronteira}. {semCodigosInternos(g.definicoes.cenario_de_elegibilidade)}
                    </PrevisoesLegenda>
                  </section>

                  <PrevisoesRecorte
                    periodo={
                      <>
                        Versões vigentes em {carimbo(g.gerado_em)}
                        {ajuste ? `; pesos do ajuste de ${dataBR(ajuste)}` : ""}
                      </>
                    }
                    universo={<>{fichas.map((f) => f.codigo).join(", ")}; sete horizontes e quatro submercados</>}
                    unidade="R$/MWh nas previsões; coeficientes em R$/MWh de correção por R$/MWh (ou por ponto percentual) da variável"
                  />


                  <NotasDoPainel oQueMudou={oQueMudou14} comoInterpretar={comoInterpretar14} naoConcluir={naoConcluir14} />

                  <PrevisoesCapitulos pagina="modelos" />

                  <SecaoDoPainel id="entradas" titulo="O que cada modelo recebe e como calcula">
                    <TabelaAdaptativa
                      legenda="Entradas, fórmula em palavras e pesos de cada modelo registrado"
                      colunas={COLUNAS_ENTRADAS}
                      linhas={entradas}
                      nome="entradas-formula"
                    />
                    {notaEntradas({ entradas: fichas.flatMap((f) => f.entradas ?? []) }) && (
                      <PrevisoesLegenda>{notaEntradas({ entradas: fichas.flatMap((f) => f.entradas ?? []) })}</PrevisoesLegenda>
                    )}
                    <PrevisoesTermos itens={termos} />
                  </SecaoDoPainel>

                  {reexec.length > 0 && (
                    <SecaoDoPainel
                      id="reexecucao"
                      titulo="Os números arquivados do B0 se repetem com o dado do corte?"
                      lead="Cada valor abaixo é o número arquivado na rodada mais recente; a prova de cada um mostra as horas somadas, os arquivos da CCEE capturados até o corte e o resultado da reexecução."
                    >
                      <PrevisoesReexecucao linhas={reexec} evidencias={g.evidencias} endereco={enderecoPainel("p014")} tolerancia={tolerancia} />
                    </SecaoDoPainel>
                  )}

                  <SecaoDoPainel id="pesos" titulo="Pesos do último ajuste dos candidatos C2, por segmento" nivel="analisar">
                    <PrevisoesPesos
                      coeficientes={coef}
                      colunasCoeficientes={colunasCoeficientes(fichas)}
                      segmentos={segmentos}
                      barras={barras}
                      textos={textos}
                      segmentoPadrao={segmentos[0]?.id ?? ""}
                      fonte={fonte}
                      versao={versao}
                    />
                    <PrevisoesLegenda>
                      A barra à direita do zero soma ao B0 quando a variável é positiva, e à esquerda subtrai. A linha 1 marca o ponto a partir do qual a correção pela média dos 7
                      dias amplia o desvio. Os coeficientes são do último ajuste e mudam a cada domingo.{" "}
                      {acima.length
                        ? `No último ajuste, ${plural(acima.length, "segmento passa", "segmentos passam")} de 1 na média dos 7 dias (${acima.map((a) => `${a.modelo} ${a.segmento}`).join(", ")}), um sinal de que a correção amplia o desvio recente em vez de reduzi-lo.`
                        : "No último ajuste, nenhum segmento passa de 1 na média dos 7 dias."}
                    </PrevisoesLegenda>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="fichas" titulo="Como as fichas dos modelos se comparam lado a lado?" nivel="analisar">
                    <PrevisoesFichas cartoes={cartoes} linhasModelos={linhasModelos(g)} fonte={fonte} versao={versao} />
                  </SecaoDoPainel>

                  <PrevisoesAuditoria id="configuracao" titulo="Configuração congelada, dados de entrada e pendências da governança">
                    <dl>
                      <PrevisoesFichaLinha rotulo="Configuração">
                        sha256 <span className="font-mono text-xs">{g.dados.configuracao_sha256}</span>;{" "}
                        {g.dados.configuracao_registrada_sha256 === g.dados.configuracao_sha256 ? "confere com a registrada no registro de modelos" : "diferente da registrada no registro de modelos"}.
                      </PrevisoesFichaLinha>
                      {Object.entries(g.dados.snapshots).map(([k, s]) => (
                        <PrevisoesFichaLinha key={k} rotulo={`Dado ${k}`}>
                          {s.id ? snapshotLegivel(s.id) : "sem identificador"}; última captura {carimbo(s.ultima_captura)}; {s.revisoes ?? 0} revisões detectadas
                        </PrevisoesFichaLinha>
                      ))}
                      {(["ear", "ena"] as const).map((k) => (
                        <PrevisoesFichaLinha key={k} rotulo={`Dicionário ONS (${k.toUpperCase()})`}>
                          {g.dados.dicionarios_ons[k].leitura}{" "}
                          <a href={g.dados.dicionarios_ons[k].url} className="text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                            dicionário em PDF
                          </a>
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo="Integrado até">
                        PLD até {dataBR(g.dados.ultimo_dia_pld)}; <Termo slug="ear">EAR</Termo> até {dataBR(g.dados.ultimo_dia_ear)}; <Termo slug="ena">ENA</Termo> até{" "}
                        {dataBR(g.dados.ultimo_dia_ena)}
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Estados">{g.governanca.estados}</PrevisoesFichaLinha>
                      {g.governanca.pendencias.map((p) => (
                        <PrevisoesFichaLinha key={p.id} rotulo={`${p.id}: ${p.titulo}`}>
                          {p.descricao} Encaminhamento: {p.encaminhamento} Responsável: {p.responsavel}. Estado: {p.estado.replace(/_/g, " ").toLowerCase()}.
                        </PrevisoesFichaLinha>
                      ))}
                    </dl>
                    <TabelaInterativa
                      titulo="Decisões revisáveis e quem as toma"
                      colunas={COLUNAS_DECISOES}
                      linhas={decisoes}
                      chaveLinha="id"
                      colunaRotulo="item"
                      fonte={fonte}
                      versao={versao}
                      nomeArquivo="previsoes-pld-decisoes-revisaveis"
                    />
                  </PrevisoesAuditoria>

                  <PrevisoesSeguir
                    ancora="p014"
                    proximo={{ href: `#${proximoPainel("p014").id}`, pergunta: proximoPainel("p014").pergunta }}
                    downloads={downloadsDoPainel(g, "p014")}
                  />
                </div>
              </PainelEvidencia>
            </PrevisoesPainel>
          </Bloco>

          <Bloco id="desempenho">
            <PrevisoesPainel id="p016">
              <PainelEvidencia
                id="p016"
                pergunta={perguntaPainel("p016")}
                subtitulo="Desempenho e calibração: teste fora da amostra, acompanhamento depois da emissão e calibração das faixas · entregas e R$/MWh"
                natureza="PREVISTO"
                porQueImporta={
                  <>
                    Um modelo só se distingue da referência simples se errar menos que repetir o último preço (B0) ou o do ano anterior (S0), em amostra que ele não viu e com a
                    informação disponível em cada corte. Sem isso, um gráfico de previsão não diz nada sobre acerto.
                  </>
                }
                oQueMudou={oQueMudou16}
                comoInterpretar={comoInterpretar16}
                naoConcluir={naoConcluir16}
                naoConcluirNoCorpo
                proveniencia={g.proveniencia}
              >
                <div className="space-y-6">
                  <PrevisoesResposta id="p016" veredito={vereditoP016(g)}>
                    {respostaP016(g)}
                  </PrevisoesResposta>
                  {!pubDes.publicado && (
                    <Indisponivel
                      titulo="Desempenho fora da amostra: números retidos"
                      motivo={
                        <>
                          <p>
                            <span className="font-medium">Por que não há números de desempenho aqui:</span> {partirInterno(pubDes.motivo).leitor || pubDes.motivo}
                          </p>
                          <p className="mt-2">
                            <span className="font-medium">O que libera a publicação:</span> {liberacaoEmPalavras(pubDes.para_liberar)}
                          </p>
                          <p className="mt-2 text-carvao-muted">
                            Quando liberados, o erro médio absoluto (MAE), o ganho sobre o B0 e a cobertura entram aqui por modelo e horizonte, nas mesmas células do B0 e com o
                            número de entregas distintas de cada recorte.
                          </p>
                          <div data-nivel="analisar" className="mt-3 border-t border-linha pt-2 text-xs text-carvao-muted">
                            <p className="rotulo text-mineral">Texto do registro, sem edição</p>
                            <p className="mt-1">{pubDes.motivo}</p>
                            <p className="mt-1">{pubDes.para_liberar}</p>
                          </div>
                        </>
                      }
                    />
                  )}

                  <PrevisoesRecorte
                    periodo={
                      <>
                        Origens de {dataBR(g.dados.origens.inicio)} a {dataBR(g.dados.origens.fim)}; {g.definicoes.periodos.desenvolvimento}; {g.definicoes.periodos.teste}
                      </>
                    }
                    universo={
                      <>
                        Modelos avaliados: {avaliados.join(", ")}
                        {naoAvaliados.length ? ` (sem avaliação: ${naoAvaliados.map((m) => m.codigo).join(", ")})` : ""}; sete horizontes; quatro submercados
                      </>
                    }
                    unidade="Entregas distintas; R$/MWh nominais para erro e ganho"
                  />

                  {g.desempenho.publicado && desempenho.length > 0 && (
                    <SecaoDoPainel
                      id="desempenho-fora-da-amostra"
                      titulo="Quanto cada modelo erra no teste final, contra o B0 nas mesmas células?"
                      lead="Erro médio absoluto (MAE) por modelo e horizonte no período de teste, com o MAE do B0 nas mesmas células e o número de entregas distintas de cada recorte."
                    >
                      <GraficoPontos
                        titulo="MAE no teste final por modelo e horizonte, contra o B0 nas mesmas células"
                        itens={desempenho
                          .filter((l) => l.periodo === "teste" && l.modelo !== "B0")
                          .map((l) => ({ id: l.id, rotulo: `${l.modelo} ${l.horizonte}`, valor: l.mae, referencia: l.mae_b0, detalhe: `${l.entregas} entregas distintas` }))}
                        unidade="R$/MWh"
                        casas={2}
                        rotuloValor="MAE do modelo"
                        rotuloReferencia="MAE do B0"
                      />
                      <TabelaInterativa
                        titulo="Métricas por modelo, horizonte e período"
                        colunas={COLUNAS_DESEMPENHO}
                        linhas={desempenho}
                        chaveLinha="id"
                        colunaRotulo="modelo"
                        fonte={fonte}
                        versao={versao}
                        nomeArquivo="previsoes-pld-desempenho"
                        chaveUrl="des"
                      />
                    </SecaoDoPainel>
                  )}

                  {amostra.length > 0 && (
                    <SecaoDoPainel
                      id="calibracao"
                      titulo="Há entregas suficientes para calibrar uma faixa de incerteza?"
                      lead={
                        minimo !== null
                          ? `A regra pede pelo menos ${minimo} entregas distintas fora do ajuste em cada horizonte. Semanas (W1 a W4) e meses (M1 a M3) têm amostras diferentes.`
                          : "Semanas (W1 a W4) e meses (M1 a M3) têm amostras diferentes."
                      }
                    >
                      <GraficoPontos
                        titulo="Entregas distintas do teste por horizonte, contra o mínimo para calibrar a faixa"
                        itens={amostra.map((a) => ({ id: a.id, rotulo: a.horizonte, valor: a.entregas, referencia: a.minimo, detalhe: `estado: ${a.estado}` }))}
                        unidade="entregas"
                        casas={0}
                        rotuloValor="Entregas no teste"
                        rotuloReferencia={minimo !== null ? `Mínimo de ${minimo}` : "Mínimo para calibrar"}
                        unidadeDiferenca="entregas"
                        zeroNoEixo
                      />
                      <div data-nivel="analisar">
                        <TabelaInterativa
                          titulo="Amostra de calibração por horizonte"
                          colunas={COLUNAS_AMOSTRA}
                          linhas={amostra}
                          chaveLinha="id"
                          colunaRotulo="horizonte"
                          fonte={fonte}
                          versao={versao}
                          nomeArquivo="previsoes-pld-amostra-calibracao"
                          nota="Contagem de entregas distintas do período de teste com faixas de incerteza, gravada em cada célula da rodada mais recente; a cobertura medida está retida com os demais números de desempenho."
                        />
                      </div>
                      <PrevisoesLegenda>
                        O círculo é o número de entregas distintas do teste em cada horizonte e o losango, o mínimo da regra de calibração; a diferença aparece escrita. Estado da
                        calibração: {estadosAmostra.length === 1 ? `${estadosAmostra[0]} em todos os horizontes` : amostra.map((a) => `${a.horizonte}, ${a.estado}`).join("; ")}. Sem amostra
                        mínima, a calibração não é avaliada: não se pode dizer que a faixa de algum modelo é confiável.
                      </PrevisoesLegenda>
                    </SecaoDoPainel>
                  )}

                  <NotasDoPainel oQueMudou={oQueMudou16} comoInterpretar={comoInterpretar16} naoConcluir={naoConcluir16} />

                  {prospectivo.length > 0 && (
                    <SecaoDoPainel
                      id="acompanhamento"
                      titulo="Quantas previsões em acompanhamento já têm resultado?"
                      lead="Cada previsão com número só ganha realizado quando a entrega termina. A contagem de previsões apuradas não é medida de acerto."
                    >
                      <GraficoBarras
                        titulo="Acompanhamento prospectivo: previsões com número por horizonte, com e sem realizado"
                        dados={prospectivo}
                        chaveCategoria="id"
                        chaveRotulo="horizonte"
                        series={[
                          { id: "apuradas", rotulo: "com realizado", cor: "var(--cor-energia)" },
                          { id: "aguardando", rotulo: "aguardando o fim da entrega", cor: "var(--cor-mineral-soft)" },
                        ]}
                        unidade="previsões"
                        casas={0}
                        empilhado
                        rotulosValor
                        altura={200}
                      />
                      <div data-nivel="analisar">
                        <TabelaInterativa
                          titulo="Previsões registradas e apuradas por horizonte"
                          colunas={COLUNAS_PROSPECTIVO}
                          linhas={prospectivo}
                          chaveLinha="id"
                          colunaRotulo="horizonte"
                          fonte={fonte}
                          versao={versao}
                          nomeArquivo="previsoes-pld-prospectivo"
                        />
                      </div>
                      <PrevisoesLegenda>
                        Cada barra soma as previsões com número de um horizonte, separando as que já têm realizado das que aguardam o fim da entrega.
                      </PrevisoesLegenda>
                    </SecaoDoPainel>
                  )}

                  <PrevisoesAnalise id="metodo" titulo="Como o desempenho é medido">
                    <dl>
                      {(["alvo", "realizado", "entregas", "cenario_de_elegibilidade", "erro", "ganho", "perda_quantilica", "cobertura", "calibracao", "quantis"] as const).map((k) => (
                        <PrevisoesFichaLinha key={k} rotulo={rotuloDefinicao(k)}>
                          {g.definicoes[k]}
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo="Fronteira entre períodos">{g.definicoes.periodos.fronteira}</PrevisoesFichaLinha>
                      {naoAvaliados.map((m) => (
                        <PrevisoesFichaLinha key={m.codigo} rotulo={`${m.codigo} sem avaliação`}>
                          {semCaminhosDeArquivo(m.motivo_sem_avaliacao ?? "motivo não registrado")}
                        </PrevisoesFichaLinha>
                      ))}
                    </dl>
                  </PrevisoesAnalise>

                  <PrevisoesAnalise id="controles" titulo="Controles do teste retrospectivo, executados a cada publicação">
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                      Os controles conferem a integridade do cálculo (datas, limites de preço, refazer o B0 por outro caminho). São verificações do próprio observatório: não medem a
                      capacidade de prever e não substituem a revisão independente.
                    </p>
                    <TabelaInterativa
                      titulo="Controles do teste e da rodada"
                      colunas={COLUNAS_VALIDACOES}
                      linhas={validacoes}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte={fonte}
                      versao={versao}
                      nomeArquivo="previsoes-pld-controles"
                    />
                  </PrevisoesAnalise>

                  <PrevisoesAuditoria id="publicacao" titulo="Regra de publicação e decisão pendente">
                    <dl>
                      <PrevisoesFichaLinha rotulo="Regra">{pubDes.regra}</PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Decisão">
                        {pubDes.decisao
                          ? `${pubDes.decisao.estado.toLowerCase()}; decidido por ${pubDes.decisao.decidido_por ?? "ninguém registrado"} em ${pubDes.decisao.decidido_em ? dataBR(pubDes.decisao.decidido_em) : "data não registrada"}`
                          : "nenhuma registrada"}
                        {pubDes.decisao?.pergunta ? `. Pergunta: ${pubDes.decisao.pergunta}` : ""}
                      </PrevisoesFichaLinha>
                      {pubDes.decisao?.registro && <PrevisoesFichaLinha rotulo="Registro">{pubDes.decisao.registro}</PrevisoesFichaLinha>}
                      {!pubDes.publicado && <PrevisoesFichaLinha rotulo="Leitura do implementador">{pubDes.interpretacao_do_implementador}</PrevisoesFichaLinha>}
                      <PrevisoesFichaLinha rotulo="Onde estão os resultados">{g.desempenho.publicado ? "nesta página" : g.desempenho.calculado}</PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Linhas do teste">
                        {g.dados.linhas_csv.semanal.toLocaleString("pt-BR")} semanais e {g.dados.linhas_csv.mensal.toLocaleString("pt-BR")} mensais; última entrega apurada no
                        teste: {g.dados.ultima_entrega_apurada_teste ? dataBR(g.dados.ultima_entrega_apurada_teste) : "nenhuma"}
                      </PrevisoesFichaLinha>
                      {Object.entries(g.dados.revisoes_hidrologia).map(([k, r]) => (
                        <PrevisoesFichaLinha key={k} rotulo={`Revisões em ${k.split(":")[1] ?? k}`}>
                          {r.observacoes_revisadas} observações revisadas pelo ONS entre capturas; maior revisão {r.maior_revisao === null ? "sem registro" : `${r.maior_revisao.toLocaleString("pt-BR")} p.p.`}.
                          O teste retrospectivo do modelo com hidrologia usa o valor revisado.
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo="Estado dos modelos">
                        {g.modelos.map((m) => `${m.codigo} em ${rotuloEstadoModelo(m.estado)}`).join("; ")}
                      </PrevisoesFichaLinha>
                    </dl>
                  </PrevisoesAuditoria>

                  <PrevisoesSeguir
                    ancora="p016"
                    proximo={{ href: enderecoPainel(proximoPainel("p016").id), pergunta: proximoPainel("p016").pergunta }}
                    downloads={downloadsDoPainel(g, "p016")}
                  />
                </div>
              </PainelEvidencia>
            </PrevisoesPainel>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}

const ROTULOS_DEFINICAO: Record<string, string> = {
  alvo: "Alvo",
  realizado: "Realizado",
  entregas: "Entregas",
  cenario_de_elegibilidade: "Dado elegível no corte",
  erro: "Erro e viés",
  ganho: "Ganho sobre o B0",
  perda_quantilica: "Perda quantílica",
  cobertura: "Cobertura",
  calibracao: "Calibração",
  quantis: "Quantis",
};
const rotuloDefinicao = (k: string) => ROTULOS_DEFINICAO[k] ?? k;
