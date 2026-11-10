import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { destinosDaColecao } from "@/components/observatorios/DestinosDaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { GraficoLinhas } from "@/components/painel";
import { DuasReguas } from "@/components/divida/DuasReguas";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { dataBr, mesAno, num } from "@/lib/perguntas/leitura";
import { dadosDivida, numeroDivida, type SerieMedida } from "@/lib/divida/dados";
import { DESCRICAO_DIVIDA, PERGUNTA_DIVIDA, ROTA_DIVIDA, SECAO_DIVIDA } from "@/lib/divida/paginas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao(PERGUNTA_DIVIDA, ROTA_DIVIDA),
  description: DESCRICAO_DIVIDA,
  alternates: { canonical: ROTA_DIVIDA },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
const PAINEL_SISTEMA = "/observatorio/credit";

/** Frase factual da série: último valor, extremos e janela, calculada da mesma série do gráfico. */
function leitura(s: SerieMedida, oQue: string): string {
  const v = (n: number) => `${num(n, s.medida.casas)}%`;
  return `${oQue}: ${v(s.ultimo.v)} em ${mesAno(s.ultimo.ref)}. Desde ${mesAno(s.primeiro.ref)}, o menor valor foi ${v(s.minimo.v)}, em ${mesAno(s.minimo.ref)}, e o maior foi ${v(s.maximo.v)}, em ${mesAno(s.maximo.ref)}.`;
}

function Fonte({ series, capturado, extra }: Readonly<{ series: SerieMedida[]; capturado: string; extra?: ReactNode }>) {
  return (
    <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
      Fonte:{" "}
      {series.map((s, i) => (
        <span key={s.codigo}>
          {i > 0 && " e "}
          <a href={s.url} className="underline underline-offset-2" rel="noopener noreferrer">
            {s.fonte}
          </a>
        </span>
      ))}
      ; leitura da Scrutiniums em {dataBr(capturado)}. {extra}
    </p>
  );
}

function Secao({ id, titulo, subtitulo, children }: Readonly<{ id: string; titulo: string; subtitulo: ReactNode; children: ReactNode }>) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="familias-secao scroll-mt-24 border-t border-linha py-8 md:py-10">
      <h2 id={`${id}-h`} className="ed-h2 max-w-3xl font-serif text-carvao">{titulo}</h2>
      <div className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{subtitulo}</div>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Cuidado({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="max-w-prose2 border-l-2 border-carvao pl-4 text-sm leading-relaxed text-carvao">
      <span className="font-semibold">Não permite concluir: </span>
      {children}
    </p>
  );
}

/**
 * Painel "Dívida das famílias" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta, porta da
 * coleção desde 10/11/2026. Responde à pergunta das Famílias com o recorte de pessoa física da gold do Crédito
 * (public/obs/data/gold/pulse.json): o dado é o mesmo do painel Crédito, na Economia; a página é outra, com outra pergunta.
 * Arquétipo entrada no molde EntradaColecao: quatro números com prova, as consultas pessoais, os painéis da coleção, o
 * modelo didático das duas medidas de peso na renda, as três séries recolhidas e o método no fim.
 */
export default function DividaDasFamiliasPage() {
  const d = dadosDivida();
  const { comprometimento, endividamento, inad_pf: atraso, taxa_pf: juros } = d.series;
  const janela = `${mesAno(comprometimento.primeiro.ref)} a ${mesAno(comprometimento.ultimo.ref)}`;
  return (
    <>
      <MarcaVisita secao={SECAO_DIVIDA} />
      <header>
        <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_DIVIDA} fontes={["credito"]} />
        <NavegacaoColecao colecao="divida" />
      </header>
      <EntradaColecao
        tipo="colecao"
        rota={ROTA_DIVIDA}
        acento="bronze"
        titulo={PERGUNTA_DIVIDA}
        frase="Quatro medidas do Banco Central sobre o crédito às famílias: quanto da renda vai para as parcelas, quanto elas devem, quanto está em atraso e quanto custam os juros. Só dívidas com bancos e financeiras."
        frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/divida-das-familias"]} conteiner="mx-auto max-w-page px-6" />}
        escala={[numeroDivida("comprometimento"), numeroDivida("endividamento"), numeroDivida("inad_pf"), numeroDivida("taxa_pf")]}
        notaEscala="As quatro medidas têm bases diferentes (renda do mês, renda de 12 meses, saldo da carteira e contratos novos) e não se somam nem se comparam entre si."
        paraVoce={<ParaVoce entrada={ROTA_DIVIDA} />}
        destinos={destinosDaColecao("divida")}
        artefato={
          <ModeloDidatico
            id="duas-reguas"
            titulo="Duas réguas para a mesma dívida"
            descricao={<>O Banco Central mede o peso da dívida das famílias de dois jeitos. Um olha o mês, o outro olha o ano. As barras abaixo traduzem cada percentual para uma renda de R$ 100.</>}
            deixaDeFora={[
              "A situação de uma família específica: são médias do país, e quem não tem dívida entra na renda mas não nas parcelas",
              "Dívidas fora dos bancos: crediário de loja, contas de consumo atrasadas e empréstimos entre pessoas",
              "A diferença entre faixas de renda, que estas duas séries não publicam",
            ]}
          >
            <DuasReguas comprometimento={comprometimento} endividamento={endividamento} />
          </ModeloDidatico>
        }
        caminhos={[
          { pergunta: "A dívida pesa mais ou menos que antes?", resumo: `As parcelas do mês e a dívida total sobre a renda, mês a mês, de ${janela}.`, href: "#peso-na-renda" },
          { pergunta: "As famílias estão atrasando mais as dívidas?", resumo: "A parte do crédito às famílias com parcelas vencidas há mais de 90 dias, mês a mês.", href: "#atraso", numero: numeroDivida("inad_pf") },
          { pergunta: "Quanto custa pegar um empréstimo novo?", resumo: "Os juros médios dos contratos novos das famílias, mês a mês.", href: "#juros", numero: numeroDivida("taxa_pf") },
          {
            pergunta: "E o crédito das empresas e dos bancos?",
            resumo: "Saldo, concessões, juros e atrasos de famílias e empresas lado a lado, no painel Crédito, do Observatório da Economia.",
            href: PAINEL_SISTEMA,
            rotulo: "Abrir o painel Crédito",
          },
        ]}
        recolhidos={
          <>
            <Recolhido id="recolhido-peso-na-renda" titulo="O peso da dívida na renda, mês a mês" resumo="As parcelas do mês e a dívida total, sobre a renda das famílias.">
              <Secao
                id="peso-na-renda"
                titulo="O peso da dívida na renda, mês a mês"
                subtitulo={<>Comprometimento de renda (parcelas sobre a renda do mês) e endividamento (dívida total sobre a renda de 12 meses), em %, Brasil, {janela}.</>}
              >
                <GraficoLinhas
                  titulo="Parcelas do mês e dívida total sobre a renda das famílias"
                  dados={d.linhas}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "endividamento", rotulo: "Dívida total sobre a renda de 12 meses", sigla: "Dívida total", cor: "var(--serie-1)" },
                    { id: "comprometimento", rotulo: "Parcelas sobre a renda do mês", sigla: "Parcelas", cor: "var(--serie-2)" },
                  ]}
                  unidade="%"
                  casas={1}
                  zeroNoEixo
                  zoom
                />
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                  {leitura(comprometimento, "Parcelas sobre a renda do mês")} {leitura(endividamento, "Dívida total sobre a renda de 12 meses")}
                </p>
                <Cuidado>
                  que as famílias estão em dificuldade ou folgadas. As duas linhas têm denominadores diferentes e a distância entre elas não é uma medida. A dívida total sobe
                  também quando mais famílias financiam a casa própria.
                </Cuidado>
                <Fonte series={[comprometimento, endividamento]} capturado={d.geradoEm} extra="Séries com ajuste sazonal, publicadas com cerca de dois meses de defasagem." />
              </Secao>
            </Recolhido>
            <Recolhido id="recolhido-atraso" titulo="O crédito das famílias em atraso" resumo="A parte do saldo com parcelas vencidas há mais de 90 dias.">
              <Secao
                id="atraso"
                titulo="O crédito das famílias em atraso"
                subtitulo={<>Saldo das operações de pessoas físicas com parcelas vencidas há mais de 90 dias, em % da carteira de crédito às famílias, Brasil, {mesAno(atraso.primeiro.ref)} a {mesAno(atraso.ultimo.ref)}.</>}
              >
                <GraficoLinhas
                  titulo="Crédito das famílias com atraso acima de 90 dias"
                  dados={d.linhas}
                  chaveX="mes"
                  formatoX="mes"
                  series={[{ id: "inad_pf", rotulo: "Atraso acima de 90 dias", sigla: "Atraso", cor: "var(--serie-1)" }]}
                  unidade="% da carteira"
                  casas={2}
                  zeroNoEixo
                  zoom
                />
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{leitura(atraso, "Atraso acima de 90 dias, em parte da carteira")}</p>
                <Cuidado>
                  quantas pessoas estão inadimplentes. A medida é a parte do dinheiro emprestado que está em atraso, não a parte das pessoas. Dívidas renegociadas ou já
                  baixadas como prejuízo saem da conta.
                </Cuidado>
                <Fonte series={[atraso]} capturado={d.geradoEm} />
              </Secao>
            </Recolhido>
            <Recolhido id="recolhido-juros" titulo="Os juros dos empréstimos novos" resumo="A taxa média dos contratos novos das famílias, mês a mês.">
              <Secao
                id="juros"
                titulo="Os juros dos empréstimos novos"
                subtitulo={<>Taxa média de juros das operações contratadas no mês por pessoas físicas, em % ao ano, Brasil, {mesAno(juros.primeiro.ref)} a {mesAno(juros.ultimo.ref)}.</>}
              >
                <GraficoLinhas
                  titulo="Juros médios dos empréstimos novos às famílias"
                  dados={d.linhas}
                  chaveX="mes"
                  formatoX="mes"
                  series={[{ id: "taxa_pf", rotulo: "Juros médios, pessoas físicas", sigla: "Juros", cor: "var(--serie-1)" }]}
                  unidade="% ao ano"
                  casas={1}
                  zeroNoEixo
                  zoom
                />
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{leitura(juros, "Juros médios ao ano")}</p>
                <Cuidado>
                  quanto um contrato específico vai custar. A média junta modalidades de custo muito diferente, do consignado ao rotativo do cartão, e muda quando muda a
                  mistura do que é contratado. Para o seu caso, use{" "}
                  <Link href="/observatorio-do-credito/quanto-meu-banco-cobra" prefetch={false} className={link}>
                    Quanto meu banco cobra?
                  </Link>
                  .
                </Cuidado>
                <Fonte series={[juros]} capturado={d.geradoEm} />
              </Secao>
            </Recolhido>
          </>
        }
        metodo={
          <>
            <p>
              Os quatro números e as três séries vêm do Sistema Gerenciador de Séries Temporais do Banco Central: comprometimento de renda (série {comprometimento.codigo}),
              endividamento (série {endividamento.codigo}), inadimplência de pessoas físicas (série {atraso.codigo}) e taxa média de juros de pessoas físicas (série{" "}
              {juros.codigo}). A Scrutiniums não recalcula nenhuma delas: mostra o valor publicado e o mês de referência.
            </p>
            <p>
              Comprometimento e endividamento usam a renda disponível das famílias estimada pelo Banco Central e saem com cerca de dois meses de defasagem, por isso o mês
              deles pode ser anterior ao do atraso e ao dos juros. O endividamento inclui o financiamento imobiliário.
            </p>
            <p>
              Fica de fora o que não passa pelo sistema financeiro: crediário de loja, contas de água, luz e telefone em atraso e empréstimos entre pessoas. Nenhuma das
              séries separa as famílias por renda, idade ou região.
            </p>
            <p>
              Os mesmos dados alimentam o painel{" "}
              <Link href={PAINEL_SISTEMA} prefetch={false} className={link}>
                Crédito
              </Link>
              , do Observatório da Economia, que os mostra ao lado do crédito às empresas. Definições no{" "}
              <Link href="/glossario" prefetch={false} className={link}>
                glossário
              </Link>{" "}
              e método completo em{" "}
              <Link href="/observatorio-do-credito/metodologia" prefetch={false} className={link}>
                Metodologia e fontes do Crédito
              </Link>
              .
            </p>
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/divida-das-familias"]} variante="metodo" />}
      />
    </>
  );
}
