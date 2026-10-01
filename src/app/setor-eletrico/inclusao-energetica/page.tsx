import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { InclusaoIndisponivel, InclusaoNavegacao } from "@/components/energia/InclusaoPagina";
import { Numero } from "@/components/energia/Numero";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { PAINEIS_INCLUSAO, mes, respostaAcesso, respostaCobertura, respostaOrcamento, respostaTarifaSocial, rotaPainel, type PainelInclusao } from "@/lib/energia/inclusao";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Inclusão energética: Tarifa Social, cobertura, orçamento e acesso",
  description:
    "Síntese da inclusão energética: Tarifa Social (ANEEL, SCS e Beneficiários da CDE), cobertura potencial contra o Cadastro Único (proxy declarada), peso da energia no orçamento por classe de rendimento (POF 2017-2018) e acesso à energia, sistemas isolados e Luz para Todos, com um painel completo para cada pergunta.",
  alternates: { canonical: "/setor-eletrico/inclusao-energetica" },
};

/**
 * Síntese da Inclusão energética: as quatro perguntas, cada uma com a resposta
 * curta derivada da gold, um número com a sua ficha de prova, o recorte e o
 * limite principal, e o caminho para o painel completo (mapa, séries, tabelas,
 * downloads, modos Analisar e Auditar). Página editorial e de navegação: não
 * repete os gráficos dos painéis.
 */
function Cartao({
  id,
  pergunta,
  resposta,
  numero,
  recorte,
  limite,
}: {
  id: PainelInclusao;
  pergunta: string;
  resposta: string;
  numero: ReactNode;
  recorte: ReactNode;
  limite: ReactNode;
}) {
  const p = PAINEIS_INCLUSAO.find((x) => x.id === id)!;
  return (
    <section id={`sintese-${id}`} aria-labelledby={`sintese-${id}-titulo`} className="scroll-mt-28 border border-linha bg-superficie">
      <div className="space-y-4 px-5 py-6 md:px-8">
        <p className="rotulo text-mineral">{p.rotulo}</p>
        <h2 id={`sintese-${id}-titulo`} className="font-serif text-xl leading-snug text-carvao md:text-2xl">
          {pergunta}
        </h2>
        <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta={id}>
          {resposta}
        </p>
        <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
          {numero}
          <div className="space-y-3 text-sm text-carvao-muted">
            {recorte}
            <p>
              <span className="rotulo mr-2 text-mineral">Não permite concluir</span>
              {limite}
            </p>
          </div>
        </div>
        <p>
          <Link href={rotaPainel(id)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            Abrir o painel {p.rotulo.toLowerCase()}: mapa, séries, tabelas e dados
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function InclusaoEnergeticaPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const t = g.tarifa_social;
  const c = g.cobertura;
  const o = g.orcamento;
  const a = g.acesso;
  const si = a.sistemas_isolados;
  const lpt = a.universalizacao.luz_para_todos;
  const geracaoScs = t.diagnostico_scs?.data_geracao.at(-1) ?? null;

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-energetica" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Inclusão energética"
          titulo="Quem tem acesso adequado e para quem a energia pesa mais?"
          referencia={
            <>
              SCS da ANEEL até {mes(g.referencias.scs_ultimo_mes_no_arquivo)} (arquivo gerado pela fonte em {dataBR(geracaoScs)}); Beneficiários da CDE até{" "}
              {mes(g.referencias.cde_mes_mais_recente)}; Cadastro Único de {mes(c.brasil?.mes)}; POF 2017-2018; PNAD Contínua {a.ano_referencia}; PASI ciclo {si?.ciclo ?? "sem dado"};
              Luz para Todos até {mes(lpt?.ultimo_mes)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quatro perguntas, cada uma com a sua fonte e a sua unidade: quanto a Tarifa Social alcança, quem pode estar ficando de fora, para quem a conta pesa mais no orçamento e quem
          ainda não tem acesso adequado. Os números são agregados: nenhum beneficiário individual aparece aqui.
        </CabecalhoModulo>
        <InclusaoNavegacao atual="sintese" />

        <section aria-labelledby="unidades" className="pb-6">
          <h2 id="unidades" className="rotulo pb-2 text-mineral">
            Cinco unidades que não se somam
          </h2>
          <ul className="grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Unidade consumidora (UC)", "O ponto de ligação com conta própria. É a unidade do SCS, em que a distribuidora pede o reembolso do desconto."],
              ["Fatura", "Cada conta emitida com desconto no mês. É a unidade dos arquivos de Beneficiários da CDE; uma UC pode ter mais de uma fatura no arquivo."],
              ["Família", "A unidade do Cadastro Único e da POF. Uma família pode não ser titular da conta de luz da casa em que mora."],
              ["Domicílio", "A unidade da PNAD Contínua e do Luz para Todos: a moradia, com ou sem ligação à rede."],
              ["Pessoa", "A população das localidades isoladas, informada pelas distribuidoras ao PASI."],
            ].map(([n, d]) => (
              <li key={n} className="bg-superficie p-4">
                <p className="rotulo text-mineral">{n}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-carvao">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6 pb-10">
          <Cartao
            id="p059"
            pergunta={t.pergunta}
            resposta={respostaTarifaSocial(t)}
            numero={
              <Numero
                rotulo="UC com Tarifa Social"
                natureza="OBSERVADO"
                evidencia={t.kpis.uc_tsee.evidencia}
                casas={0}
                unidade="UC"
                tamanho="medio"
                nota={`${t.distribuidoras.length} distribuidoras; último mês completo do SCS.`}
                endereco={`${rotaPainel("p059")}#p059`}
              />
            }
            recorte={
              <p>
                SCS de {mes(t.serie_mensal[0]?.m)} a {mes(t.serie_mensal.at(-1)?.m)}, em UC; arquivos da CDE até {mes(g.referencias.cde_mes_mais_recente)}, em faturas, com o último mês
                completo em {mes(t.mes_mapa)}.
              </p>
            }
            limite="número de famílias ou de pessoas beneficiadas: UC e fatura são unidades da conta, e a DMR não é o desconto de cada família."
          />
          <Cartao
            id="p060"
            pergunta={c.pergunta}
            resposta={respostaCobertura(c)}
            numero={
              <Numero
                rotulo="Faturas por 100 famílias elegíveis pela renda (proxy)"
                natureza="CALCULADO"
                evidencia={c.brasil?.evidencia ?? null}
                casas={1}
                unidade="por 100 famílias"
                tamanho="medio"
                motivoAusencia="Sem cruzamento entre faturas e Cadastro Único nesta publicação."
                endereco={`${rotaPainel("p060")}#p060`}
              />
            }
            recorte={<p>Faturas da CDE e famílias do Cadastro Único com renda por pessoa até meio salário mínimo, no mesmo mês ({mes(c.brasil?.mes)}), por UF e município.</p>}
            limite="quantas famílias elegíveis estão fora do benefício: fatura não é família, e o numerador inclui critérios que o denominador não tem."
          />
          <Cartao
            id="p061"
            pergunta={o.pergunta}
            resposta={respostaOrcamento(o)}
            numero={
              <Numero
                rotulo="Energia na despesa total das famílias (razão de médias)"
                natureza="ESTIMADO"
                evidencia={o.evidencias.razao_medias_brasil}
                formato="pct"
                casas={1}
                tamanho="medio"
                endereco={`${rotaPainel("p061")}#p061`}
              />
            }
            recorte={<p>{o.referencia}; Brasil e grandes regiões por classe de rendimento, UF só no total; nada municipal.</p>}
            limite="o peso da conta hoje: a POF é de 2017-2018 e nenhuma atualização modelada é publicada."
          />
          <Cartao
            id="p062"
            pergunta={a.pergunta}
            resposta={respostaAcesso(a)}
            numero={
              <Numero
                rotulo="Domicílios sem energia elétrica de nenhuma fonte"
                natureza="ESTIMADO"
                evidencia={a.evidencia_sem_energia}
                casas={0}
                unidade="mil domicílios"
                tamanho="medio"
                motivoAusencia="Sem estimativa da PNAD nesta publicação."
                endereco={`${rotaPainel("p062")}#p062`}
              />
            }
            recorte={
              <p>
                PNAD Contínua de {a.pnad_serie[0]?.ano} a {a.ano_referencia}; PASI ciclo {si?.ciclo ?? "sem dado"}; Luz para Todos até {mes(lpt?.ultimo_mes)}.
              </p>
            }
            limite="qualidade do serviço a partir da ligação feita; e a carga do SIN não mede acesso, porque os sistemas isolados ficam fora dela."
          />
        </div>

        <section aria-labelledby="arquivos" className="border-t border-linha py-8">
          <h2 id="arquivos" className="font-serif text-xl text-carvao">
            Arquivos do módulo
          </h2>
          <p className="mt-2 max-w-prose2 text-sm text-carvao-muted">CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; os JSON são lidos pelos gráficos sob demanda.</p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {g.downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
