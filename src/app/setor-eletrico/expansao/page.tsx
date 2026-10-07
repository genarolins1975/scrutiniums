import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoIndisponivel, ExpansaoNavegacao, ExpansaoNota } from "@/components/energia/ExpansaoPagina";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  PAINEIS_EXPANSAO,
  dataTexto,
  linhasRalieTipo,
  respostaCarteira,
  respostaCenarios,
  respostaCronograma,
  respostaSintese,
  respostaTransmissao,
  rotaPainel,
  type PainelExpansao,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Expansão da oferta e da rede: carteira, cronograma, transmissão e cenários",
  description:
    "Quanta capacidade está chegando e de que fontes: usinas outorgadas, em construção e em operação (SIGA e RALIE da ANEEL), cronograma com data-base e o que atrasou, obras e leilões de transmissão ao lado da geração, e o PDE 2035 como cenário, com um painel completo para cada pergunta.",
  alternates: { canonical: "/setor-eletrico/expansao" },
};

/**
 * Síntese da Expansão: a resposta à pergunta do módulo (quanta capacidade está chegando
 * e de que fontes) e as quatro perguntas dos painéis, cada uma com a resposta curta
 * derivada da gold, um número com a sua ficha de prova, o recorte e o limite principal,
 * e o caminho para o painel completo (mapa, séries, tabelas, downloads, modos Analisar e
 * Auditar). Página editorial e de navegação: não repete os gráficos dos painéis.
 */
function Cartao({ id, resposta, numero, recorte, limite, conteudo }: { id: PainelExpansao; resposta: string; numero: ReactNode; recorte: ReactNode; limite: ReactNode; conteudo: string }) {
  const p = PAINEIS_EXPANSAO.find((x) => x.id === id)!;
  return (
    <section id={`sintese-${id}`} aria-labelledby={`sintese-${id}-titulo`} className="scroll-mt-28 border border-linha bg-superficie">
      <div className="space-y-4 px-5 py-6 md:px-8">
        <p className="rotulo text-mineral">{p.rotulo}</p>
        <h2 id={`sintese-${id}-titulo`} className="font-serif text-xl leading-snug text-carvao md:text-2xl">
          {p.pergunta}
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
            Abrir o painel {p.rotulo}: {conteudo}
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function ExpansaoPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const ref = g.referencias;
  const ev = g.evidencias;
  const r = g.estagios.ralie;

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["SIGA", "RALIE", "PDE", "ANEEL", "EPE"]}
          rotulo="Expansão"
          titulo="Quanta capacidade está chegando, e de que fontes?"
          referencia={
            <>
              SIGA da ANEEL de {dataTexto(ref.siga)}; RALIE na fotografia de {dataTexto(ref.ralie)} (histórico desde {dataTexto(ref.ralie_historico_desde)}); liberações comerciais até{" "}
              {dataTexto(ref.liberacoes_ultima_data)}; atos de outorga até {dataTexto(ref.atos)}; SIGET de {dataTexto(ref.siget)}; leilões de transmissão até {dataTexto(ref.leiloes_transmissao)};
              linhas da EPE capturadas em {dataTexto(ref.rede_epe_capturada_em)}; {ref.pde}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          O que está outorgado e em obra, quando deve entrar, se a rede acompanha e como o planejamento oficial enxerga a matriz. Carteira, cronograma e cenário aparecem separados do
          que já opera: outorga não é obra, obra não é entrada certa e cenário não é previsão.
        </CabecalhoModulo>
        <ExpansaoNavegacao atual="sintese" />

        <section aria-labelledby="chegando" className="space-y-4 pb-8">
          <h2 id="chegando" className="sr-only">
            Capacidade em implantação por fonte
          </h2>
          <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="sintese">
            {respostaSintese(g)}
          </p>
          <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
            <Numero
              rotulo="Unidades em implantação no RALIE"
              natureza="CALCULADO"
              evidencia={ev.ralie_em_implantacao ?? null}
              casas={1}
              tamanho="medio"
              endereco="/setor-eletrico/expansao#chegando"
              motivoAusencia="Sem a fotografia do RALIE nesta publicação."
              nota="Potência das unidades geradoras acompanhadas pela fiscalização; não é energia nem garantia física."
            />
            <GraficoBarras
              titulo={`Carteira em implantação por tipo de geração, fotografia do RALIE de ${dataTexto(r.data_ralie)} (MW das unidades)`}
              dados={linhasRalieTipo(g)}
              chaveCategoria="id"
              chaveRotulo="tipo"
              series={[{ id: "mw", rotulo: "Unidades em implantação", cor: "var(--cor-energia)" }]}
              unidade="MW"
              casas={1}
              orientacao="horizontal"
              rotulosValor
            />
          </div>
          <ExpansaoNota>
            A carteira em implantação é o que está outorgado e acompanhado, com obra iniciada ou não. Quanto dela entra e quando está nos painéis de carteira e de cronograma.
          </ExpansaoNota>
        </section>

        <section aria-labelledby="camadas" className="pb-6">
          <h2 id="camadas" className="rotulo pb-2 text-mineral">
            Três camadas que não se misturam
          </h2>
          <ul className="grid gap-px border border-linha bg-linha md:grid-cols-3">
            {[
              ["Realizado", "O que já opera e o que entrou: usinas em operação no SIGA, liberações para operação comercial e obras de transmissão energizadas no SIGET."],
              ["Carteira", "O que está outorgado ou em obra, com a previsão da fiscalização datada pela fotografia do RALIE, e as obras de transmissão em andamento."],
              ["Cenário", "O Plano Decenal de Expansão: o que o planejamento oficial supõe para os próximos dez anos, com data-base e hipóteses da edição. Não é previsão."],
            ].map(([n, d]) => (
              <li key={n} className="bg-superficie p-4">
                <p className="rotulo text-mineral">{n}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-carvao">{d}</p>
              </li>
            ))}
          </ul>
          <h2 className="rotulo pb-2 pt-6 text-mineral">Unidades que não se somam</h2>
          <ul className="grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["MW", "Potência de geração. Não é energia (MWh) nem garantia física."],
              ["km de circuito", "Extensão das linhas no SIGET: linha de circuito duplo conta cada circuito."],
              ["km de traçado", "Comprimento da geometria das linhas no mapa da EPE."],
              ["MVA", "Capacidade de transformação das subestações, sem o transformador reserva."],
              ["R$ nominais", "Investimento previsto e receita anual dos leilões, na moeda da data de cada leilão."],
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
            id="p040"
            conteudo="etapas, desfechos, mapa, tabelas e dados"
            resposta={respostaCarteira(g)}
            numero={
              <Numero
                rotulo="Outorgado com construção não iniciada"
                natureza="CALCULADO"
                evidencia={ev.outorgado_sem_obra ?? null}
                casas={1}
                tamanho="medio"
                endereco={`${rotaPainel("p040")}#p040`}
                motivoAusencia="Sem a soma do SIGA nesta publicação."
              />
            }
            recorte={<p>Fases do SIGA de {dataTexto(g.estagios.data_referencia)}; desfecho das usinas acompanhadas pelo RALIE desde {dataTexto(ref.ralie_historico_desde)}; outorgas encerradas desde {g.estagios.encerramentos.desde}.</p>}
            limite="quanto da carteira atual vai entrar: o desfecho das coortes passadas não é probabilidade para a carteira de hoje."
          />
          <Cartao
            id="p041"
            conteudo="previsões datadas, revisões, tabelas e dados"
            resposta={respostaCronograma(g)}
            numero={
              <Numero
                rotulo="Da potência prevista para 12 meses, liberada no prazo"
                natureza="CALCULADO"
                evidencia={ev.confiabilidade_ultima ?? null}
                formato="pct"
                casas={1}
                tamanho="medio"
                endereco={`${rotaPainel("p041")}#p041`}
                motivoAusencia="Sem janela de 12 meses encerrada nesta publicação."
              />
            }
            recorte={
              <p>
                Previsões da fotografia de {dataTexto(g.cronograma.data_ralie)}; confiabilidade em {g.cronograma.confiabilidade.length} fotografias mensais desde {dataTexto(g.cronograma.confiabilidade[0]?.ralie)}, contra as
                liberações até {dataTexto(ref.liberacoes_ultima_data)}.
              </p>
            }
            limite="a data provável de cada usina: boa parte da carteira tem previsão numa data convencional atribuída em bloco."
          />
          <Cartao
            id="p042"
            conteudo="mapas, séries anuais, tabelas e dados"
            resposta={respostaTransmissao(g)}
            numero={
              <Numero
                rotulo="Linhas novas em obras de transmissão em andamento"
                natureza="CALCULADO"
                evidencia={ev.transmissao_em_andamento ?? null}
                casas={1}
                tamanho="medio"
                endereco={`${rotaPainel("p042")}#p042`}
                motivoAusencia="Sem o SIGET nesta publicação."
              />
            }
            recorte={
              <p>
                SIGET de {dataTexto(g.transmissao.obras.data_referencia)}; leilões de transmissão até o {g.transmissao.leiloes.ultimo_leilao.leilao ?? "último do arquivo"} ({dataTexto(g.transmissao.leiloes.ultimo_leilao.data)}); rede da EPE
                capturada em {dataTexto(ref.rede_epe_capturada_em)}; por UF e por ano.
              </p>
            }
            limite="se a rede é suficiente para escoar a geração de uma UF: isso depende da topologia e dos limites da rede, não de km ou MVA."
          />
          <Cartao
            id="p043"
            conteudo="camadas, figuras, hipóteses e dados"
            resposta={respostaCenarios(g)}
            numero={
              <Numero
                rotulo="Capacidade nacional em dez/2035 no cenário de referência"
                natureza="CENARIO"
                evidencia={ev.pde_capacidade_2035 ?? null}
                casas={1}
                tamanho="medio"
                endereco={`${rotaPainel("p043")}#p043`}
                motivoAusencia="Sem a Figura 3-25 nesta publicação."
              />
            }
            recorte={
              <p>
                {g.cenarios.edicao}, data-base {g.cenarios.data_base_premissas}, horizonte {g.cenarios.horizonte}; realizado do SIGA e carteira do RALIE em camadas separadas.
              </p>
            }
            limite="que o cenário vai se realizar, nem que a distância entre o cenário e o realizado é atraso: as categorias não coincidem uma a uma."
          />
        </div>

        <section aria-labelledby="arquivos" className="border-t border-linha py-8">
          <h2 id="arquivos" className="font-serif text-xl text-carvao">
            Arquivos do módulo
          </h2>
          <p className="mt-2 max-w-prose2 text-sm text-carvao-muted">CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; os JSON são lidos pelos mapas sob demanda.</p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {g.downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
          {g.ressalvas.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="rotulo text-mineral">Ressalvas da validação desta publicação</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                {g.ressalvas.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
