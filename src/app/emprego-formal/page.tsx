import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import type { NumeroProps } from "@/components/painel";
import { BaixarCsv } from "@/components/familias/emprego-formal/BaixarCsv";
import { SerieEscolhida } from "@/components/familias/emprego-formal/SerieEscolhida";
import { TabelaOrdenada } from "@/components/familias/emprego-formal/TabelaOrdenada";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { mesAno, num } from "@/lib/perguntas/leitura";
import { DESCRICAO_EMPREGO, PERGUNTA_EMPREGO, ROTA_EMPREGO, dadosEmprego, provEmprego, textoDaGold, type Setor, type Uf } from "@/lib/familias/emprego-formal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao(PERGUNTA_EMPREGO, ROTA_EMPREGO),
  description: DESCRICAO_EMPREGO,
  alternates: { canonical: ROTA_EMPREGO },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
const acao = "inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao";
const SEM = "sem dado";

const n0 = (v: number | null | undefined) => (typeof v === "number" ? num(v, 0) : SEM);
/** Número com sinal explícito: saldo positivo leva "+", negativo o sinal de menos tipográfico. */
const sn = (v: number | null | undefined, casas = 0) => (typeof v !== "number" ? SEM : v > 0 ? `+${num(v, casas)}` : v < 0 ? `−${num(Math.abs(v), casas)}` : num(v, casas));
const pc = (v: number | null | undefined, casas = 1) => (typeof v === "number" ? `${num(v, casas)}%` : SEM);
const spc = (v: number | null | undefined, casas = 1) => (typeof v === "number" ? `${sn(v, casas)}%` : SEM);

/** Número da faixa a partir de um valor da gold: presente com o texto formatado, ou ausente com o motivo. */
function numero(base: Omit<NumeroProps, "valor" | "valorTexto" | "motivoAusencia" | "formato">, v: number | null | undefined, texto: (v: number) => string): NumeroProps {
  return typeof v === "number"
    ? ({ ...base, formato: "texto", valorTexto: texto(v) } as NumeroProps)
    : ({ ...base, valor: null, motivoAusencia: "A publicação do Novo Caged usada nesta página não traz este valor." } as NumeroProps);
}

function fraseSecao(s: Setor, inicioJanela: string): string {
  return `${s.nome}: ${n0(s.estoque)} vínculos em ${mesAno(s.mes)}${typeof s.share_pct === "number" ? ` (${pc(s.share_pct)} do total)` : ""}, saldo de ${sn(s.saldo_12m)} em 12 meses e variação de ${spc(s.yoy_pct, 2)} no estoque. Média da própria seção desde ${mesAno(inicioJanela)}: ${spc(s.yoy_media_janela, 2)} (desvio-padrão de ${typeof s.yoy_dp_janela === "number" ? num(s.yoy_dp_janela, 2) : SEM}, em ${n0(s.n_obs_z)} observações). Distância da média: ${sn(s.z, 2)} desvio-padrão, faixa “${s.faixa ?? SEM}”.`;
}

function fraseUf(u: Uf): string {
  const pos = (k: string) => (typeof u.posicoes[k] === "number" ? `, ${u.posicoes[k]}ª posição entre as 27 UFs` : "");
  return `${u.nome}: saldo de ${sn(u.saldo_12m)} vínculos nos 12 meses até ${mesAno(u.mes)}${pos("saldo_12m")}, contra ${sn(u.saldo_12m_anterior)} nos 12 meses anteriores. Foram ${n0(u.admissoes_12m)} admissões e ${n0(u.desligamentos_12m)} desligamentos, com retenção de ${pc(u.retencao_pct)}${pos("retencao_pct")}. No mês, saldo de ${sn(u.saldo_mes)} (${n0(u.admissoes_mes)} admissões e ${n0(u.desligamentos_mes)} desligamentos), ainda preliminar.`;
}

/**
 * Painel "Emprego formal" (Observatório das Famílias, coleção Renda e trabalho), com conta. Reescrita, no molde de painel, da vista
 * "Emprego formal" da aplicação do Crédito (/observatorio/formal-employment, renderEmprego em public/obs/app.js): a mesma gold
 * (public/obs/data/gold/emprego.json) e os mesmos valores. As cinco medidas do placar viram quatro números e a nota da faixa; o saldo
 * e a variação do estoque no país, as seções de atividade, as UFs e o papel no Risco setorial são figuras com gráfico do kit, tabela
 * equivalente e proveniência; método, catálogo, cautelas e fontes ficam no método.
 */
export default function EmpregoFormalPage() {
  const d = dadosEmprego();
  const cabecalho = (
    <header>
      <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_EMPREGO} fontes={["credito"]} />
      <NavegacaoColecao colecao="renda" />
    </header>
  );
  if ("indisponivel" in d) {
    return (
      <>
        {cabecalho}
        <main id="conteudo" tabIndex={-1} className="ed-pagina pb-6">
          <h1 className="t-h1 mt-6 max-w-4xl text-carvao">{PERGUNTA_EMPREGO}</h1>
          <p className="t-corpo mt-4 max-w-prose2 text-carvao" data-ausencia="">
            Painel indisponível nesta publicação. {textoDaGold(d.indisponivel)} Nenhum número é mostrado no lugar.
          </p>
        </main>
      </>
    );
  }

  const B = d.brasil;
  const total = d.total;
  const mes = mesAno(d.mes);
  const mesRotulo = d.mesPreliminar ? `${mes}, preliminar` : mes;
  const inicioJanela = mesAno(d.janelaZ.inicio);
  const ser = d.serie;
  const s36 = ser.slice(-36);
  const comVariacao = ser.filter((p) => typeof p.yoy_pct === "number");
  const fonteSgs = "Novo Caged, via Banco Central";
  const fonteIpea = "Novo Caged, via Ipeadata";

  // seções na ordem do painel antigo: crescente pela distância da própria média; sem valor por último
  const ordem = [...d.secoes].sort((a, b) => (a.z ?? 9) - (b.z ?? 9));
  const semAgregado = ordem.filter((s) => !s.agregado);
  const ufs = [...d.ufs].sort((a, b) => (b.saldo_12m ?? -1e15) - (a.saldo_12m ?? -1e15));
  const ufsMes = mesAno(d.ufsMes);
  const maiorUf = ufs[0];
  const inicioSecoes = total.serie_yoy[0]?.ref ?? d.mes;
  const inicioUfs = maiorUf?.serie_saldo[0]?.ref ?? d.ufsMes;

  const colunasCsv = ["key", "nome", "cnae", "agregado", "mes", "estoque", "share_pct", "saldo_mes", "saldo_mes_sa", "saldo_12m", "saldo_12m_anterior", "yoy_pct", "z", "faixa", "yoy_media_janela", "yoy_dp_janela", "n_obs_z"] as const;

  return (
    <>
      {cabecalho}
      <PaginaPainel
        rota={ROTA_EMPREGO}
        abertura={{
          grupo: "Renda e trabalho",
          acento: "bronze",
          titulo: PERGUNTA_EMPREGO,
          lead: "Quantos vínculos com carteira assinada o país tem, onde a folha cresce e onde encolhe por seção de atividade, e onde se contrata e se demite por estado. Cada medida é comparada com a própria história.",
          recorte: {
            periodo: `${mesAno(ser[0]?.ref ?? d.mes)} a ${mesRotulo}`,
            universo: `Brasil, ${semAgregado.length} seções de atividade e ${d.ufs.length} UFs, vínculos celetistas`,
            unidade: "vínculos e %",
            fonte: "Ministério do Trabalho e Emprego, Novo Caged, republicado pelo Banco Central e pelo Ipeadata",
          },
          limite:
            "que saldo positivo é demanda por crédito ou capacidade de pagamento. O último mês é preliminar e é revisado; o painel não cobre estatutários, informais nem MEI, e mede postos de trabalho, não salários.",
          fontesDatasSiglas: (
            <>
              <p>
                Estoque por seção: {textoDaGold(d.fontes.sgs.nome)} ({d.fontes.sgs.licenca}), até {mesRotulo}.{" "}
                <a href={d.fontes.sgs.catalogo} className={link} rel="noopener noreferrer">
                  Catálogo de séries do Banco Central
                </a>
                .
              </p>
              <p>
                Admissões e desligamentos por UF: {textoDaGold(d.fontes.ipea.nome)} ({d.fontes.ipea.licenca}), 12 meses até {ufsMes}.{" "}
                <a href={d.fontes.ipea.catalogo} className={link} rel="noopener noreferrer">
                  Ipeadata
                </a>
                .
              </p>
              <p>
                Caged: Cadastro Geral de Empregados e Desempregados. CNAE: Classificação Nacional de Atividades Econômicas. SGS: Sistema Gerenciador de Séries Temporais do Banco
                Central. UF: unidade da federação. MEI: microempreendedor individual.
              </p>
            </>
          ),
        }}
        rotuloNumeros={`Emprego formal no Brasil em ${mes}`}
        numeros={[
          numero(
            { rotulo: "Vínculos formais", unidade: "vínculos", periodo: mesRotulo, recorte: "Brasil", fonte: `${fonteSgs} (SGS 28763)`, natureza: "OBSERVADO", nota: `${pc(B.nao_itemizado_pct, 2)} dos vínculos não são itemizados por seção.` },
            B.estoque,
            (v) => num(v, 0),
          ),
          numero(
            { rotulo: "Saldo do mês", unidade: "vínculos", periodo: mesRotulo, recorte: "Brasil", fonte: `${fonteSgs} (SGS 28763 e 28784)`, natureza: "OBSERVADO", tamanho: "m", nota: `${sn(B.saldo_mes_sa)} com o ajuste sazonal do Banco Central.` },
            B.saldo_mes,
            (v) => sn(v),
          ),
          numero(
            { rotulo: "Saldo em 12 meses", unidade: "vínculos", periodo: `12 meses até ${mes}`, recorte: "Brasil", fonte: `${fonteSgs} (SGS 28763)`, natureza: "CALCULADO", tamanho: "m", nota: `${sn(B.saldo_12m_anterior)} nos 12 meses anteriores.` },
            B.saldo_12m,
            (v) => sn(v),
          ),
          numero(
            {
              rotulo: "Variação do estoque em 12 meses",
              unidade: "ante o mesmo mês do ano anterior",
              periodo: mesRotulo,
              recorte: "Brasil",
              fonte: `${fonteSgs} (SGS 28763)`,
              natureza: "CALCULADO",
              tamanho: "m",
              nota: `${sn(total.z, 2)} desvio-padrão em relação à média desde ${inicioJanela}, faixa “${total.faixa ?? SEM}”.`,
            },
            total.yoy_pct,
            (v) => `${sn(v, 2)}%`,
          ),
        ]}
        notaNumeros={
          <>
            No mês, {n0(B.admissoes_mes)} admissões e {n0(B.desligamentos_mes)} desligamentos (Novo Caged, via Ipeadata, {mesRotulo}, observado); a rotatividade em 12 meses foi de{" "}
            {pc(B.rotatividade_12m_pct, 0)} do estoque (calculado). Saldo é a variação do estoque de vínculos; não é renda nem massa salarial.
          </>
        }
        navegacaoLocal={
          <div className="mt-6 space-y-4">
            <p className="t-corpo max-w-prose2 text-carvao" data-sintese="">
              {textoDaGold(d.sintese)}
            </p>
            <p className="t-meta max-w-prose2 text-carvao-muted">
              Síntese escrita por regra fixa a partir dos mesmos números da página, com dados até {mesRotulo}. A distância de cada seção é medida contra a própria história desde{" "}
              {inicioJanela}.
            </p>
            <nav aria-label="Seções desta página" className="flex flex-wrap gap-x-6">
              {[
                ["#brasil-saldo", "Brasil"],
                ["#secoes", "Seções de atividade"],
                ["#ufs", "Estados"],
                ["#risco-setorial", "Risco setorial"],
              ].map(([href, rotulo]) => (
                <a key={href} href={href} className={acao}>
                  {rotulo}
                </a>
              ))}
            </nav>
          </div>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="brasil-saldo"
              pergunta="O país abriu ou fechou vagas formais em cada mês?"
              subtitulo={`Saldo mensal de vínculos formais, com e sem ajuste sazonal · vínculos · Brasil, ${mesAno(s36[0]?.ref ?? d.mes)} a ${mesRotulo}`}
              natureza="OBSERVADO"
              proveniencia={provEmprego(d, "sgs", {
                indicador: "Saldo mensal de vínculos formais, com e sem ajuste sazonal",
                natureza: "OBSERVADO",
                unidade: "vínculos",
                inicio: ser[0]?.ref ?? d.mes,
                fim: d.mes,
                transformacoes: ["Saldo do mês é a variação do estoque de vínculos no mês.", "O ajuste sazonal é do Banco Central."],
              })}
              leitura={
                <LeituraGuiada>
                  Em {mes}, o saldo foi de {sn(B.saldo_mes)} vínculos; com o ajuste sazonal do Banco Central, {sn(B.saldo_mes_sa)}. Nos 12 meses até {mes}, {sn(B.saldo_12m)}.
                </LeituraGuiada>
              }
              comoInterpretar="Saldo é a variação do estoque no mês. Dezembro concentra desligamentos todos os anos; a linha com ajuste sazonal desconta esse calendário."
              porQueImporta="Vínculo formal é renda recorrente, e renda recorrente é o que paga a parcela. Por seção de atividade, o estoque de vínculos diz onde a folha cresce ou encolhe; por UF, o saldo de admissões e desligamentos diz onde a economia contrata."
              ressalva={`O último mês (${mes}) é preliminar: declarações entregues fora do prazo revisam o estoque e o saldo dos meses anteriores.`}
              naoConcluir="que as famílias têm mais ou menos renda: o saldo conta postos de trabalho com carteira, não salários, e não inclui estatutários, informais nem microempreendedores."
              tabela={{
                titulo: "Estoque, saldo mensal e variação em 12 meses do emprego formal, Brasil",
                colunas: ["Mês", "Estoque, vínculos", "Saldo do mês, vínculos", "Saldo com ajuste sazonal, vínculos", "Variação do estoque em 12 meses, %"],
                linhas: ser.map((p) => [p.ref === d.mes && d.mesPreliminar ? `${mesAno(p.ref)} (preliminar)` : mesAno(p.ref), p.estoque, p.saldo, p.saldo_sa, p.yoy_pct]),
                casas: [null, 0, 0, 0, 2],
                limite: ser.length,
              }}
            >
              <GraficoLinhas
                semTabela
                titulo="Saldo mensal de vínculos formais, Brasil"
                dados={s36.map((p) => ({ mes: p.ref, saldo: p.saldo, saldo_sa: p.saldo_sa }))}
                chaveX="mes"
                formatoX="mes"
                series={[
                  { id: "saldo", rotulo: "Saldo do mês", sigla: "Saldo", cor: "var(--serie-1)" },
                  { id: "saldo_sa", rotulo: "Com ajuste sazonal", sigla: "Com ajuste", cor: "var(--serie-2)" },
                ]}
                unidade="vínculos"
                casas={0}
                zeroNoEixo
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="brasil-estoque"
              pergunta="O total de vínculos cresce mais ou menos que o costume?"
              subtitulo={`Variação do estoque de vínculos formais ante o mesmo mês do ano anterior · % · Brasil, ${mesAno(comVariacao[0]?.ref ?? d.mes)} a ${mesRotulo}`}
              natureza="CALCULADO"
              proveniencia={provEmprego(d, "sgs", {
                indicador: "Variação do estoque de vínculos formais em 12 meses",
                natureza: "CALCULADO",
                unidade: "%",
                inicio: comVariacao[0]?.ref ?? d.mes,
                fim: d.mes,
                formula: "variação em 12 meses = saldo em 12 meses ÷ estoque de 12 meses antes",
              })}
              leitura={
                <LeituraGuiada>
                  Em {mes}, o estoque variou {spc(total.yoy_pct, 2)} em 12 meses. A média desde {inicioJanela} é de {spc(total.yoy_media_janela, 2)}; a distância entre os dois valores é de{" "}
                  {sn(total.z, 2)} desvio-padrão.
                </LeituraGuiada>
              }
              comoInterpretar={`A linha fina é a média da variação desde ${inicioJanela}, a mesma régua usada para comparar cada seção de atividade com a própria história.`}
              naoConcluir="que a economia vai bem ou mal: a variação mede só vínculos com carteira e o último ponto é preliminar. A média histórica é uma referência de costume, não uma meta."
              tabela={{
                titulo: "Variação do estoque de vínculos formais em 12 meses, Brasil",
                colunas: ["Mês", "Variação do estoque em 12 meses, %", `Média desde ${inicioJanela}, %`],
                linhas: comVariacao.map((p) => [mesAno(p.ref), p.yoy_pct, total.yoy_media_janela]),
                casas: [null, 2, 2],
                limite: comVariacao.length,
              }}
            >
              <GraficoLinhas
                semTabela
                titulo="Variação do estoque de vínculos formais em 12 meses, Brasil"
                dados={comVariacao.map((p) => ({ mes: p.ref, yoy: p.yoy_pct, media: total.yoy_media_janela }))}
                chaveX="mes"
                formatoX="mes"
                series={[
                  { id: "yoy", rotulo: "Estoque, variação em 12 meses", sigla: "Estoque", cor: "var(--serie-1)" },
                  { id: "media", rotulo: `Média desde ${inicioJanela}`, sigla: "Média", cor: "var(--serie-referencia)", espessura: 1 },
                ]}
                unidade="%"
                casas={2}
                zeroNoEixo
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="secoes"
              pergunta="Em quais atividades a folha cresce e em quais encolhe?"
              subtitulo={`Estoque de vínculos por seção de atividade (CNAE) e variação em 12 meses · vínculos e % · Brasil, ${mesAno(inicioSecoes)} a ${mesRotulo}`}
              natureza="CALCULADO"
              proveniencia={provEmprego(d, "sgs", {
                indicador: "Estoque de vínculos formais por seção de atividade e variação em 12 meses",
                natureza: "CALCULADO",
                unidade: "vínculos e %",
                inicio: inicioSecoes,
                fim: d.mes,
                formula: "distância da média = (variação em 12 meses − média da seção) ÷ desvio-padrão da seção",
                transformacoes: [textoDaGold(d.metodo)],
              })}
              comoInterpretar={`A distância da média compara a variação em 12 meses de cada seção com a média e o desvio-padrão da própria seção desde ${inicioJanela}. A tabela está em ordem crescente dessa distância. Linhas marcadas como agregado (energia, água e esgoto somados; serviços somados) não se somam às demais.`}
              naoConcluir="que uma seção emprega mais ou paga melhor que outra: a distância da média compara cada seção com a própria história, não uma seção com a outra em nível."
              tabela={{ naFigura: "a tabela das seções, logo abaixo do gráfico, traz o último valor de cada seção; a série de 36 meses da seção escolhida abre no resumo em tabela do próprio gráfico." }}
              complemento={
                <>
                  <TabelaDados
                    titulo={`Seções de atividade: estoque, saldos e variação em 12 meses, ${mes}`}
                    colunas={["Seção", "CNAE", "Estoque, vínculos", "Parte do total, %", "Saldo do mês, vínculos", "Saldo em 12 meses, vínculos", "Variação em 12 meses, %", "Distância da média, desvios-padrão", "Faixa"]}
                    linhas={ordem.map((s) => [s.agregado ? `${s.nome} (agregado)` : s.nome, s.cnae, s.estoque, s.share_pct, s.saldo_mes, s.saldo_12m, s.yoy_pct, s.z, s.faixa])}
                    casas={[null, null, 0, 1, 0, 0, 2, 2, null]}
                    limite={ordem.length}
                    recolhida={false}
                    fixarPrimeiraColuna
                    nota={`Estoque e saldos em ${mesRotulo}. Fonte: ${fonteSgs} (SGS 28763 a 28804). ${pc(B.nao_itemizado_pct, 2)} dos vínculos (${n0(B.nao_itemizado)}) não são itemizados por seção.`}
                  />
                  <p>
                    <BaixarCsv
                      rotulo="Baixar CSV das seções"
                      nomeArquivo={`emprego-formal-secoes-${d.mes}.csv`}
                      cabecalho={[
                        "Scrutiniums, Observatório das Famílias: estoque de vínculos formais por seção CNAE (Novo Caged via Banco Central, SGS 28763 a 28804)",
                        `saldo = variação do estoque; yoy_pct = saldo em 12 meses ÷ estoque de 12 meses antes; z = yoy_pct contra a média da própria seção desde ${d.janelaZ.inicio}; último mês preliminar`,
                      ]}
                      colunas={[...colunasCsv]}
                      linhas={d.setores.map((s) => colunasCsv.map((c) => s[c] as string | number | boolean | null))}
                    />
                  </p>
                </>
              }
            >
              <SerieEscolhida
                rotulo="Seção de atividade no gráfico"
                titulo="Variação do estoque de vínculos em 12 meses"
                inicial="total"
                opcoes={d.setores.map((s) => ({ id: s.key, nome: s.agregado && s.key !== "total" ? `${s.nome} (agregado)` : s.nome, frase: fraseSecao(s, d.janelaZ.inicio), pontos: s.serie_yoy, media: s.yoy_media_janela }))}
                referencia={{ id: "total", rotulo: "Total do país", pontos: total.serie_yoy }}
                rotuloMedia={`Média da seção desde ${inicioJanela}`}
                unidade="%"
                casas={2}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="ufs"
              pergunta="Em quais estados se contrata mais do que se demite?"
              subtitulo={`Admissões, desligamentos e saldo por UF · vínculos · 12 meses até ${ufsMes} e saldo mensal de ${mesAno(inicioUfs)} a ${ufsMes}`}
              natureza="OBSERVADO"
              proveniencia={provEmprego(d, "ipea", {
                indicador: "Admissões, desligamentos e saldo de vínculos formais por UF",
                natureza: "OBSERVADO",
                unidade: "vínculos",
                inicio: inicioUfs,
                fim: d.ufsMes,
                formula: "saldo = admissões − desligamentos; retenção = saldo em 12 meses ÷ admissões em 12 meses",
              })}
              comoInterpretar="Retenção é o saldo em 12 meses dividido pelas admissões em 12 meses: de cada 100 contratações, quantas viraram vínculo a mais. Não é rotatividade e não é variação do estoque, que o Ipeadata não publica por UF. As posições são entre as 27 UFs, dentro de cada coluna."
              ressalva={
                <>
                  O corte por UF usa outra régua que o corte por seção: admissões e desligamentos, sem estoque.
                  {d.reconciliacao && (
                    <>
                      {" "}
                      Conferência: no Brasil, {sn(d.reconciliacao.saldo_ipea)} (admissões menos desligamentos, Ipeadata) contra {sn(d.reconciliacao.saldo_sgs)} (variação do estoque, Banco
                      Central) em {mesAno(d.reconciliacao.mes)}; diferença de {sn(d.reconciliacao.diferenca)}.
                    </>
                  )}
                  {d.ufsNaoIdentificado && (
                    <>
                      {" "}
                      Em {mesAno(d.ufsNaoIdentificado.mes)}, {n0(d.ufsNaoIdentificado.admissoes)} admissões e {n0(d.ufsNaoIdentificado.desligamentos)} desligamentos sem UF identificada ficam
                      fora das 27 UFs.
                    </>
                  )}
                </>
              }
              naoConcluir="que um estado tem mais emprego que outro por ter saldo maior: o saldo acompanha o tamanho da economia do estado, e retenção alta não diz nada sobre salário nem sobre a qualidade do vínculo."
              tabela={{ naFigura: "a tabela das 27 UFs, logo abaixo do gráfico, traz admissões, desligamentos, saldos, retenção e posições; a série de 36 meses da UF escolhida abre no resumo em tabela do próprio gráfico." }}
              complemento={
                <TabelaOrdenada
                  titulo={`Admissões, desligamentos e saldo por UF, 12 meses até ${ufsMes}`}
                  colunas={["UF", "Região", "Admissões em 12 meses", "Desligamentos em 12 meses", "Saldo em 12 meses", "Posição no saldo em 12 meses", "Saldo nos 12 meses anteriores", "Retenção, %", "Posição na retenção", "Saldo do mês (preliminar)"]}
                  linhas={ufs.map((u) => [`${u.nome} (${u.uf})`, u.regiao, u.admissoes_12m, u.desligamentos_12m, u.saldo_12m, u.posicoes.saldo_12m ?? null, u.saldo_12m_anterior, u.retencao_pct, u.posicoes.retencao_pct ?? null, u.saldo_mes])}
                  casas={[null, null, 0, 0, 0, 0, 0, 1, 0, 0]}
                  ordens={[
                    { rotulo: "saldo em 12 meses", coluna: 4 },
                    { rotulo: "retenção", coluna: 7 },
                    { rotulo: "saldo do mês", coluna: 9 },
                  ]}
                  links={ufs.map((u) => `/observatorio/states/${u.uf}`)}
                  nota={`Em vínculos. Fonte: ${fonteIpea} (séries ADMISNC e DESLIGNC). O nome de cada UF abre a página do estado no painel Estados, com o emprego ao lado do crédito.`}
                />
              }
              depois={
                <p>
                  <Link href="/observatorio/states" prefetch={false} className={acao}>
                    O emprego na página de cada estado, ao lado do crédito: painel Estados
                  </Link>
                </p>
              }
            >
              <SerieEscolhida
                rotulo="UF no gráfico"
                titulo="Saldo mensal de vínculos formais"
                inicial={maiorUf?.uf ?? ""}
                opcoes={[...d.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ id: u.uf, nome: u.nome, frase: fraseUf(u), pontos: u.serie_saldo }))}
                unidade="vínculos"
                casas={0}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="risco-setorial"
              pergunta="Como o emprego entra no Risco setorial?"
              subtitulo={`Distância entre a variação em 12 meses do estoque de cada seção e a média da própria seção desde ${inicioJanela} · desvios-padrão · ${mesRotulo}`}
              natureza="CALCULADO"
              proveniencia={provEmprego(d, "sgs", {
                indicador: "Distância da média histórica da variação em 12 meses do estoque, por seção de atividade",
                natureza: "CALCULADO",
                unidade: "desvios-padrão",
                inicio: d.janelaZ.inicio,
                fim: d.mes,
                formula: "distância da média = (variação em 12 meses − média da seção) ÷ desvio-padrão da seção",
              })}
              comoInterpretar="No painel Risco setorial, do Observatório de Crédito, cada atividade herda a distância da média da sua seção, com o sinal invertido: folha encolhendo fora do padrão puxa a medida de estresse para cima. É o componente chamado lá de capacidade financeira. Divisões da indústria herdam a seção C; grupos de serviços que cruzam seções recebem a média das seções listadas; o comércio herda a seção G. Os pesos de cada componente estão no próprio painel."
              naoConcluir="que uma atividade com a folha abaixo da média vai deixar de pagar dívidas: o emprego é um dos insumos do Risco setorial, com peso declarado lá, e não mede inadimplência."
              tabela={{
                titulo: `Distância da média histórica por seção de atividade, ${mes}`,
                colunas: ["Seção", "CNAE", "Variação em 12 meses, %", "Média da seção, %", "Distância da média, desvios-padrão", "Faixa"],
                linhas: semAgregado.map((s) => [s.nome, s.cnae, s.yoy_pct, s.yoy_media_janela, s.z, s.faixa]),
                casas: [null, null, 2, 2, 2, null],
                limite: semAgregado.length,
              }}
              depois={
                <p>
                  <Link href="/observatorio/sectors" prefetch={false} className={acao}>
                    A medida por atividade, com os componentes abertos: painel Risco setorial
                  </Link>
                </p>
              }
            >
              <GraficoBarras
                semTabela
                titulo={`Distância da média histórica por seção de atividade, ${mes}`}
                dados={semAgregado.map((s) => ({ id: s.key, nome: s.nome, z: s.z }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[{ id: "z", rotulo: "Distância da média da própria seção", cor: "var(--serie-1)" }]}
                unidade="desvios-padrão"
                casas={2}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>
          </>
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Vínculo formal", definicao: "Contrato de trabalho com carteira assinada, ativo no fim do mês. Uma pessoa com dois empregos conta duas vezes.", exemplo: `${n0(B.estoque)} vínculos em ${mesRotulo}.` },
            { termo: "Saldo", definicao: "Quanto o número de vínculos mudou no período: admissões menos desligamentos. Positivo quando se contratou mais do que se demitiu." },
            { termo: "Variação em 12 meses", definicao: "O saldo dos últimos 12 meses dividido pelo estoque de 12 meses antes. Compara o mês com o mesmo mês do ano anterior." },
            {
              termo: "Distância da média (desvio-padrão)",
              definicao: `Quanto a variação em 12 meses está acima ou abaixo da média da própria seção desde ${inicioJanela}, medida em desvios-padrão. A publicação chama de contração o que fica abaixo de −1 e de aquecido o que fica acima de +1.`,
            },
            { termo: "Retenção", definicao: "Saldo em 12 meses dividido pelas admissões em 12 meses, por UF. De cada 100 contratações, quantas viraram vínculo a mais." },
            { termo: "Seção CNAE", definicao: "O nível mais agregado da classificação oficial de atividades econômicas, identificado por uma letra (C é a indústria de transformação, G é o comércio)." },
          ],
          nota: "Para ler: comece pelo saldo em 12 meses e pela variação do total; depois olhe a distância da média de cada seção. O corte por UF usa outra régua, saldo e retenção, porque ali não há estoque.",
        }}
        metodo={
          <>
            <p>{textoDaGold(d.metodo)}</p>
            <TabelaDados
              titulo="Catálogo de indicadores do emprego formal"
              colunas={["Indicador", "Definição", "Unidade", "Fonte", "Limitações"]}
              linhas={d.catalogo.map((c) => [textoDaGold(c.nome), textoDaGold(c.definicao), c.unidade === "σ" ? "desvios-padrão" : c.unidade, textoDaGold(c.fonte), textoDaGold(c.limitacoes)])}
              limite={d.catalogo.length}
              recolhida={false}
            />
            <p>{textoDaGold(d.limitacoes)}</p>
            <div>
              <p className="font-medium text-carvao">Cautelas</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {d.cautelas.map((c) => (
                  <li key={c}>{textoDaGold(c)}</li>
                ))}
              </ul>
            </div>
            <p>
              Fontes:{" "}
              <a href={d.fontes.sgs.catalogo} className={link} rel="noopener noreferrer">
                {textoDaGold(d.fontes.sgs.nome)}
              </a>{" "}
              ({d.fontes.sgs.licenca}; nível {textoDaGold(d.fontes.sgs.nivel)}) e{" "}
              <a href={d.fontes.ipea.catalogo} className={link} rel="noopener noreferrer">
                {textoDaGold(d.fontes.ipea.nome)}
              </a>{" "}
              ({d.fontes.ipea.licenca}; nível {textoDaGold(d.fontes.ipea.nivel)}). A Scrutiniums não recalcula nenhum valor desta página: estoque, saldos, variação, distância da média,
              retenção e posições são os da publicação do Observatório de Crédito.
            </p>
            <p>
              Um resumo nacional do mesmo tema, com outra captura, está em{" "}
              <Link href="/eficiencia-estatal/trabalho-renda/emprego-formal" prefetch={false} className={link}>
                Emprego formal nacional
              </Link>
              , na coleção Renda e trabalho. Método do Observatório de Crédito em{" "}
              <Link href="/observatorio-do-credito/metodologia" prefetch={false} className={link}>
                Metodologia e fontes do Crédito
              </Link>
              .
            </p>
          </>
        }
      />
    </>
  );
}
