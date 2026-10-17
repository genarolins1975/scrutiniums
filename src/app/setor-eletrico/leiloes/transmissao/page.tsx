import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { LeiloesAlternar } from "@/components/energia/LeiloesOpcoes";
import { FrasesCitaveis, LeiloesIndisponivel, ListaRegras } from "@/components/energia/LeiloesPagina";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia, type ProvenienciaComplementar } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { FONTE_TRANSMISSAO, PAGINAS_LEILOES, ROTA_LEILOES, ROTA_LEILOES_TRANSMISSAO, frasesTransmissao } from "@/lib/energia/leiloes";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import type { LeiloesGold } from "@/lib/energia/tipos-leiloes";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Leilões de transmissão: receita contratada corrigida pelo IPCA e deságio por lote",
  description:
    "Os leilões de linhas e subestações da ANEEL desde 1999: receita anual permitida (RAP) contratada por ano em reais da época e corrigida pelo IPCA, deságio de cada lote, lotes sem vencedor, extensão de linhas e quem venceu.",
  alternates: { canonical: ROTA_LEILOES_TRANSMISSAO },
};

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

export default function LeiloesTransmissaoPage() {
  const g = lerGold<LeiloesGold>("leiloes.json");
  if (!integra(g)) return <LeiloesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const exp = lerGold<ExpansaoGold>("expansao.json");
  const lei = integra(exp) ? exp.transmissao.leiloes : null;
  const t = g.transmissao;
  const ipca = mesAno(g.referencias.ipca_ate);
  const periodo = `${t.periodo.inicio?.slice(0, 4) ?? "sem data"} a ${t.periodo.fim?.slice(0, 4) ?? "sem data"}`;
  const ult = t.por_ano.at(-1);
  const totalReal = t.por_ano.reduce((s, x) => s + (x.rap_vencedora_real_rs_mi ?? 0), 0);
  const hist = montaHistograma(t.desagios, { largura: 5 });
  const frases = frasesTransmissao(g);
  const porAnoExp = new Map((lei?.por_ano ?? []).map((x) => [x.ano, x]));

  const oQueMudou = ult ? (
    <>
      O último ano com leilão no arquivo é {ult.ano}: {num(ult.lotes_contratados, 0)} lotes contratados, RAP de R$ {num(ult.rap_vencedora_real_rs_mi, 1)} milhões em
      reais de {ipca} e deságio agregado de {pct(ult.desagio_agregado_pct, 2)}. O arquivo termina em {dataBR(t.periodo.fim)}.
    </>
  ) : (
    <>Sem lote contratado no arquivo.</>
  );
  const comoInterpretar = (
    <>
      A RAP é a receita anual que a transmissora vencedora recebe para construir, operar e manter as instalações; vence quem pede a menor. O
      deságio de cada lote é a redução da RAP vencedora sobre a RAP do edital. Valores da época corrigidos pelo IPCA do mês do leilão até {ipca}.
    </>
  );
  const naoConcluir = (
    <>
      Que deságio alto significa obra mais barata ou mais eficiente: lotes têm extensões, tensões e riscos diferentes, e a RAP do edital é uma
      estimativa regulatória. Que a RAP do leilão é a receita vigente: ela é reajustada e revista pela ANEEL. Que não houve leilão depois de{" "}
      {dataBR(t.periodo.fim)}: o arquivo aberto termina aí.
    </>
  );
  const complementares: ProvenienciaComplementar[] = [{ rotulo: "Correção pelo IPCA", p: g.proveniencia.preco_real }];

  return (
    <>
      <CabecalhoEnergia atual="leiloes" />
      <MarcaVisita secao="energia:leiloes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <NavegacaoLocal rotulo="Páginas de leilões" itens={PAGINAS_LEILOES.map((p) => ({ ...p }))} atual="transmissao" />
        <CabecalhoModulo
          siglas={["ANEEL", "RAP", "IPCA", "SIGET", "EPE"]}
          rotulo="Preços e mercado · Leilões · Transmissão"
          titulo="Quanto os leilões de transmissão contrataram, corrigido pelo IPCA"
          lead={
            <>
              Linhas e subestações são concedidas em leilão: vence quem aceita a menor receita anual (RAP) para construir e operar a instalação. Esta
              página corrige a RAP de cada lote pelo IPCA e mostra o deságio lote a lote.
            </>
          }
          recorte={`${periodo} · ${num(t.lotes_contratados, 0)} lotes contratados · R$ milhões e %`}
          fonte={`${FONTE_TRANSMISSAO}; IBGE, IPCA`}
          limite={`O arquivo aberto termina no leilão de ${dataBR(t.periodo.fim)}; anos posteriores aparecem como ausência.`}
          referencia={
            <>
              {FONTE_TRANSMISSAO}, como lido pelo módulo Expansão (arquivo até {dataBR(t.periodo.fim)}); IPCA do IBGE até {ipca}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Leilões de transmissão na base da ANEEL" nota={`Período: ${periodo}. Reais de ${ipca}.`}>
              <Numero variante="faixa" rotulo="Lotes contratados" natureza="OBSERVADO" valor={t.lotes_contratados} casas={0} unidade={lei ? `de ${num(lei.lotes, 0)} ofertados` : "lotes"} periodo={periodo} />
              <Numero variante="faixa" rotulo="Soma das RAPs anuais contratadas" natureza="CALCULADO" valor={totalReal} casas={0} unidade={`R$ milhões de ${ipca} por ano`} periodo={periodo} />
              <Numero variante="faixa" rotulo="Deságio mediano por lote" natureza="CALCULADO" valor={t.desagio_lotes.mediana} formato="pct" casas={1} periodo={periodo} />
              <Numero variante="faixa" rotulo={`Deságio agregado em ${ult?.ano ?? "sem ano"}`} natureza="CALCULADO" valor={ult?.desagio_agregado_pct ?? null} formato="pct" casas={1} periodo={ult?.ano ?? ""} />
            </FaixaMetricas>
          }
        >
          A leitura do arquivo, as obras em andamento e os contratos de concessão estão em{" "}
          <Link href="/setor-eletrico/expansao/geracao-e-transmissao#p042" className={link}>
            Expansão, geração e transmissão
          </Link>
          ; esta página acrescenta a correção pelo IPCA e o deságio de cada lote. Os leilões de geração estão na{" "}
          <Link href={ROTA_LEILOES} className={link}>
            página do ACR
          </Link>
          .
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="transmissao">
            <PainelEvidencia
              id="painel-leiloes-transmissao"
              pergunta="Leilões de transmissão: receita contratada, deságio e lotes sem vencedor"
              subtitulo="RAP vencedora em R$ milhões (da época e corrigida pelo IPCA), deságio em %, lotes"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A RAP das transmissoras é paga por geradores e consumidores pelo uso da rede e entra na conta de luz. Os leilões definem quanto
                  custará cada linha nova por décadas.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.transmissao}
              complementares={complementares}
            >
              <div className="space-y-10">
                <SecaoDoPainel id="como-funciona" titulo="Como funciona um leilão de transmissão">
                  <ol className="grid gap-3 md:grid-cols-4">
                    {[
                      ["Planejamento", "A EPE e o ONS indicam as obras de rede necessárias; o lote reúne linhas e subestações."],
                      ["Edital", "A ANEEL publica o lote com a RAP máxima, o prazo de obra e as exigências técnicas."],
                      ["Leilão", "Vence quem pede a menor RAP. Deságio = 1 − RAP vencedora ÷ RAP do edital."],
                      ["Contrato", "A vencedora assina o contrato de concessão, constrói e passa a receber a RAP quando a instalação entra em operação."],
                    ].map(([a, b], i) => (
                      <li key={a} className="border-t-2 border-carvao bg-superficie px-3 py-2">
                        <span className="rotulo text-mineral">{i + 1}</span>
                        <p className="font-medium text-carvao">{a}</p>
                        <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{b}</p>
                      </li>
                    ))}
                  </ol>
                </SecaoDoPainel>

                <SecaoDoPainel id="quanto" titulo="Receita anual contratada por ano" lead="Soma da RAP vencedora dos lotes contratados no ano.">
                  <LeiloesAlternar
                    rotulo="Reais"
                    nome="leiloes-t-rap"
                    opcoes={[["real", `de ${ipca}`], ["nominal", "da época"]]}
                    conteudo={{
                      real: (
                        <GraficoBarras
                          titulo={`RAP vencedora contratada por ano do leilão, R$ milhões de ${ipca}`}
                          dados={t.por_ano.map((x) => ({ ano: x.ano, rap: x.rap_vencedora_real_rs_mi }))}
                          chaveCategoria="ano"
                          series={[{ id: "rap", rotulo: "RAP vencedora", cor: "var(--cor-energia)" }]}
                          unidade="R$ milhões"
                          casas={0}
                          altura={300}
                        />
                      ),
                      nominal: (
                        <GraficoBarras
                          titulo="RAP vencedora contratada por ano do leilão, R$ milhões da época"
                          dados={t.por_ano.map((x) => ({ ano: x.ano, rap: x.rap_vencedora_rs_mi }))}
                          chaveCategoria="ano"
                          series={[{ id: "rap", rotulo: "RAP vencedora", cor: "var(--serie-referencia)" }]}
                          unidade="R$ milhões"
                          casas={0}
                          altura={300}
                        />
                      ),
                    }}
                  />
                  <TabelaDados
                    titulo="Leilões de transmissão por ano"
                    colunas={["Ano", "Lotes contratados", "Lotes sem vencedor", "km de linhas", "RAP da época (R$ mi)", `RAP de ${ipca} (R$ mi)`, `Investimento previsto de ${ipca} (R$ mi)`, "Deságio agregado (%)"]}
                    linhas={t.por_ano.map((x) => [
                      x.ano,
                      x.lotes_contratados,
                      porAnoExp.get(x.ano)?.lotes_sem_vencedor ?? null,
                      porAnoExp.get(x.ano)?.km ?? null,
                      x.rap_vencedora_rs_mi,
                      x.rap_vencedora_real_rs_mi,
                      x.investimento_real_rs_mi,
                      x.desagio_agregado_pct,
                    ])}
                    casas={[null, 0, 0, 1, 1, 1, 1, 2]}
                    limite={40}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="desagio" titulo="Deságio de cada lote" lead="Quanto a RAP vencedora ficou abaixo da RAP do edital, lote a lote.">
                  <Histograma
                    titulo={`Deságio por lote contratado, ${periodo}`}
                    dados={hist}
                    rotuloX="Deságio sobre a RAP do edital"
                    unidade="%"
                    casas={1}
                    contagem={{ singular: "lote", plural: "lotes" }}
                    periodo={periodo}
                    nota={`${num(t.lotes_desagio_zero, 0)} lotes saíram pela RAP do edital (deságio zero). ${t.regra_desagio}`}
                  />
                  <GraficoLinhas
                    titulo="Deságio por ano: mediana dos lotes, faixa do 1º ao 3º quartil e agregado pela RAP"
                    dados={t.por_ano.map((x) => ({ ano: x.ano, mediana: x.desagio_mediano_lote_pct, p25: x.desagio_p25_pct, p75: x.desagio_p75_pct, agregado: x.desagio_agregado_pct }))}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "mediana", rotulo: "Mediana dos lotes", cor: "var(--cor-energia)" },
                      { id: "agregado", rotulo: "Agregado pela RAP", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    banda={{ inferior: "p25", superior: "p75", rotulo: "1º ao 3º quartil dos lotes" }}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={300}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Anos com poucos lotes têm faixa estreita ou de um ponto só. O arquivo não traz o número de proponentes de cada lote.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="quem" titulo="Quem venceu" lead="Vencedores como publicados pela ANEEL, pelo número de lotes.">
                  <TabelaDados
                    titulo="Vencedores com mais lotes contratados"
                    colunas={["Vencedor publicado", "Lotes", `RAP vencedora de ${ipca} (R$ mi por ano)`]}
                    linhas={t.vencedores.map((x) => [x.nome ?? "sem nome", x.lotes, x.rap_vencedora_real_rs_mi])}
                    casas={[null, 0, 1]}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Nome como publicado no arquivo, sem CNPJ: consórcios e grafias diferentes da mesma empresa ficam separados ({num(t.vencedores_distintos, 0)} grafias distintas). Caracteres
                    trocados por &ldquo;?&rdquo; vêm do próprio arquivo.
                  </p>
                </SecaoDoPainel>

                {frases.length > 0 && (
                  <SecaoDoPainel id="citar" titulo="Números para citar" lead="Frases calculadas da base publicada, com data e fonte.">
                    <FrasesCitaveis frases={frases} rotulo="Frases citáveis sobre os leilões de transmissão" />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="notas" titulo="Leitura e downloads">
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  <ul className="space-y-1 text-sm">
                    <li>
                      <a href="/energia/series/leiloes_transmissao_real.csv" className={link} download>
                        Leilões de transmissão por ano, corrigidos pelo IPCA (CSV)
                      </a>
                    </li>
                    <li>
                      <a href="/energia/series/expansao_leiloes_transmissao.csv" className={link} download>
                        Lotes de transmissão, um por linha (CSV do módulo Expansão)
                      </a>
                    </li>
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="regras" titulo="Regras e cobertura">
                  <ListaRegras
                    itens={[
                      ["Deságio", t.regra_desagio],
                      ["Correção pelo IPCA", t.regra_real],
                      ["Lotes sem vencedor", lei?.regra_sem_vencedor ?? "sem regra publicada nesta atualização"],
                      ["Arquivo", `Lotes de ${t.periodo.inicio ? dataBR(t.periodo.inicio) : "sem data"} a ${dataBR(t.periodo.fim)}; ${num(t.lotes_com_rap, 0)} de ${num(t.lotes_contratados, 0)} lotes contratados com as duas RAPs.`],
                    ]}
                  />
                  {lei && lei.desagio_inconsistente_total > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {lei.desagio_inconsistente_total} lotes têm deságio publicado diferente do calculado pelas RAPs (
                      {lei.desagio_inconsistente.map((x) => `${x.lote}: ${num(x.desagio_fonte_pct, 2)}% publicado, ${num(x.desagio_calculado_pct, 2)}% pelas RAPs`).join("; ")}); esta página usa o calculado.
                    </p>
                  )}
                </SecaoDoPainel>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
