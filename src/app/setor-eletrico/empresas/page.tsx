import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasIndisponivel, EmpresasNavegacao } from "@/components/energia/EmpresasPagina";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  ancoraPainel,
  dataTexto,
  emMilhoes,
  inteiro,
  mwTexto,
  nomeOuCnpj,
  padraoFinancas,
  painel,
  pctTexto,
  referenciaPerdasNacional,
  respostaCadastro,
  respostaControle,
  respostaDistribuidoras,
  respostaFinancas,
  rotaEntidade,
  rotaPainel,
  textoFronteiraNoCadastro,
  trimestreTexto,
  vereditoCadastro,
  vereditoControle,
  vereditoDistribuidoras,
  vereditoFinancas,
  type PainelEmpresas,
} from "@/lib/energia/empresas";
import { evidenciasReceita } from "@/lib/energia/empresas-arquivos";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { comValorExibido, type Evidencia } from "@/lib/energia/evidencia";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Empresas do setor elétrico: ativos, distribuidoras, finanças e controle",
  description:
    "Quem opera as usinas e as linhas de transmissão (SIGA e SIGET, pelo CNPJ publicado), o perfil de cada distribuidora (perdas, continuidade e tarifa pelo mesmo CNPJ dos módulos de origem), as demonstrações das companhias abertas na CVM e quem controla quanto da capacidade instalada, com HHI sobre fronteira explícita.",
  alternates: { canonical: "/setor-eletrico/empresas" },
};

/**
 * Síntese do módulo Empresas: as quatro perguntas, cada uma com o veredito em palavras simples (a
 * resposta completa, derivada da gold, fica recolhida logo abaixo), um número com a sua ficha de prova, o recorte e o limite principal, e o caminho para a
 * página completa do painel (mapa, árvore, séries, tabelas, downloads, modos Analisar e
 * Auditar) e para a ficha de cada distribuidora. Página editorial e de navegação: não repete os
 * gráficos dos painéis.
 */
function Cartao({ id, veredito, resposta, numero, recorte, limite, extra }: { id: PainelEmpresas; veredito: string; resposta: string; numero: ReactNode; recorte: ReactNode; limite: ReactNode; extra?: ReactNode }) {
  const p = painel(id);
  return (
    <section id={`sintese-${id}`} aria-labelledby={`sintese-${id}-titulo`} className="scroll-mt-28 border border-linha bg-superficie">
      <div className="space-y-4 px-5 py-6 md:px-8">
        <p className="rotulo text-mineral">{p.rotulo}</p>
        <h2 id={`sintese-${id}-titulo`} className="font-serif text-xl leading-snug text-carvao md:text-2xl">
          {p.pergunta}
        </h2>
        <RespostaCurta id={id} veredito={veredito}>
          <details>
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center underline underline-offset-4">Ver a resposta completa</summary>
            <p className="mt-1">{resposta}</p>
          </details>
        </RespostaCurta>
        <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
          {numero}
          <div className="space-y-3 text-sm text-carvao-muted">
            {recorte}
            <p>
              <span className="rotulo mr-2 text-mineral">Não permite concluir</span>
              {limite}
            </p>
            {extra}
          </div>
        </div>
        <p>
          <Link href={rotaPainel(id)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            Abrir o painel {p.rotulo}: gráficos, tabelas, dados e evidências
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function EmpresasPage() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const a = c.ativos;
  const t = c.transmissao;
  const d = g.distribuidoras;
  const f = g.financas;
  const ct = g.controle;
  const datas = g.datas;
  const janela = datas.polimero_janela.length ? `${trimestreTexto(datas.polimero_janela[0])} a ${trimestreTexto(datas.polimero_janela.at(-1))}` : "sem janela";
  const inicioJanela = datas.polimero_janela.length ? trimestreTexto(datas.polimero_janela[0]) : "sem janela";

  const evTaxaNacional = lerGold<{ evidencias?: { taxa_nacional?: Evidencia } }>("perdas.json")?.evidencias?.taxa_nacional ?? null;
  const anoPerdas = d.indice.find((x) => x.perdas?.ano)?.perdas?.ano ?? null;
  const refPerdas = referenciaPerdasNacional(evTaxaNacional, anoPerdas);
  // a taxa nacional aparece com duas casas, como as perdas de cada distribuidora e a legenda do gráfico do comparador
  const evTaxaNacional2 = evTaxaNacional ? comValorExibido(evTaxaNacional, pctTexto(evTaxaNacional.valor_calculo, 2)) : null;
  const padraoFin = padraoFinancas(f.companhias);
  const compPadrao = f.companhias.find((x) => x.cnpj === padraoFin[0]) ?? null;
  const evReceita = padraoFin.length ? (evidenciasReceita(g.series.evidencias, padraoFin)[padraoFin[0]] ?? null) : null;
  const grupo = ct.concentracao.grupo_proporcional;
  const exemplos = d.indice
    .filter((x) => x.ativa && x.qualidade?.ucs)
    .slice()
    .sort((x, y) => (y.qualidade!.ucs as number) - (x.qualidade!.ucs as number))
    .slice(0, 4);

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo siglas={["CNPJ", "SIGA", "SIGET", "CVM", "DFP", "ITR"]}
          rotulo="Empresas"
          titulo="Quem é dono de quê no setor elétrico?"
          referencia={
            <>
              SIGA de {dataTexto(datas.siga)}; SIGET de {dataTexto(t?.data)}; cadastro de agentes de {dataTexto(datas.cadastro_agentes)}; composição societária declarada à ANEEL de {janela}; CVM com
              DFP até {f.periodos.ultimo_exercicio ?? "sem dado"} e ITR até {dataTexto(f.periodos.ultimo_trimestre)}; números das distribuidoras copiados das bases publicadas de Perdas, Qualidade e Conta de luz.
              Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quatro perguntas sobre quem atua no setor: quem opera as usinas e as linhas, como cada distribuidora atende a sua área, como evoluem os números que as companhias abertas
          reportam e quem controla quanto da capacidade instalada. Toda ligação entre empresa e ativo é o CNPJ publicado pela fonte oficial no mesmo registro; nenhuma é feita por
          semelhança de nome.
        </CabecalhoModulo>
        <EmpresasNavegacao atual="sintese" />

        <ModoProfundidade>
        <div className="space-y-6 pb-10">
          <Cartao
            id="p036"
            veredito={vereditoCadastro(c)}
            resposta={respostaCadastro(c)}
            numero={
              <Numero
                rotulo="Potência em operação com vínculo provado"
                natureza="CALCULADO"
                evidencia={comValorExibido(a.evidencia, pctTexto(a.evidencia.valor_calculo, 2))}
                formato="pct"
                casas={2}
                tamanho="medio"
                nota={`${inteiro(a.sem_vinculo_total)} usinas em operação sem vínculo completo, todas identificadas.`}
                endereco={ancoraPainel("p036")}
              />
            }
            recorte={
              <p>
                SIGA de {dataTexto(a.data)}, {inteiro(a.usinas)} usinas em todas as fases; SIGET de {dataTexto(t?.data)}. Potência fiscalizada em operação, em MW.
              </p>
            }
            limite={<>capacidade instalada não é energia gerada, e o dono direto não é o controlador econômico (essa pergunta está no painel de controle).</>}
          />
          <Cartao
            id="p037"
            veredito={vereditoDistribuidoras(d, refPerdas?.valor ?? null, anoPerdas)}
            resposta={respostaDistribuidoras(d)}
            numero={
              evTaxaNacional2 && refPerdas ? (
                <Numero
                  rotulo="Referência: perdas totais na distribuição, Brasil"
                  natureza={g.proveniencia.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                  evidencia={evTaxaNacional2}
                  formato="pct"
                  casas={2}
                  tamanho="medio"
                  nota="Número do módulo Perdas, a referência das barras de perdas no comparador de distribuidoras."
                  endereco={ancoraPainel("p037")}
                />
              ) : (
                <Numero rotulo="Referência: perdas totais na distribuição, Brasil" natureza="CALCULADO" valor={null} motivoAusencia="A base publicada de Perdas não publica a taxa nacional do mesmo ano." tamanho="medio" />
              )
            }
            recorte={
              <p>
                {inteiro(d.resumo.distribuidoras)} distribuidoras pelo CNPJ; perdas e continuidade do ano de referência de cada módulo de origem, tarifa vigente na data do arquivo de tarifas.
              </p>
            }
            limite={<>eficiência ou culpa da distribuidora: perdas, interrupções e tarifa dependem da área atendida, e anos de referência diferentes não se comparam.</>}
            extra={
              exemplos.length > 0 && (
                <p>
                  Fichas das distribuidoras com mais unidades consumidoras:{" "}
                  {exemplos.map((x, i) => (
                    <span key={x.slug}>
                      {i ? ", " : ""}
                      <Link href={rotaEntidade(x.slug)} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {x.sigla}
                      </Link>
                    </span>
                  ))}
                  ; as demais estão no índice do painel.
                </p>
              )
            }
          />
          <Cartao
            id="p038"
            veredito={vereditoFinancas(f)}
            resposta={respostaFinancas(f)}
            numero={
              compPadrao ? (
                <Numero
                  rotulo={`Receita ${compPadrao.ultimo_exercicio ?? ""}: ${nomeOuCnpj(compPadrao.nome, compPadrao.cnpj)}`}
                  natureza={compPadrao.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                  valor={emMilhoes(evReceita?.valor_calculo ?? null)}
                  casas={1}
                  unidade="R$ milhões"
                  evidencia={evReceita}
                  tamanho="medio"
                  motivoAusencia="A receita do último exercício não tem ficha publicada."
                  nota="A companhia ativa de maior ativo total sem controladora aberta acima dela; no painel, escolha qualquer outra."
                  endereco={ancoraPainel("p038")}
                />
              ) : (
                <Numero rotulo="Receita do último exercício" natureza="OBSERVADO" valor={null} motivoAusencia="Nenhuma companhia ativa com ativo total publicado." tamanho="medio" />
              )
            }
            recorte={
              <p>
                Exercícios de {f.periodos.exercicios[0] ?? "sem dado"} a {f.periodos.ultimo_exercicio ?? "sem dado"} (DFP) e trimestres até {dataTexto(f.periodos.ultimo_trimestre)} (ITR), em R$ nominais.
              </p>
            }
            limite={<>o desempenho do setor inteiro (só companhias abertas), nem soma entre companhias; as demonstrações regulatórias da ANEEL estão bloqueadas na fonte e não foram substituídas.</>}
          />
          <Cartao
            id="p039"
            veredito={vereditoControle(ct)}
            resposta={respostaControle(ct)}
            numero={
              <Numero
                rotulo="HHI por grupo de controle"
                natureza="CALCULADO"
                evidencia={ct.concentracao.evidencia}
                casas={0}
                unidade="pontos"
                tamanho="medio"
                nota={grupo ? `${inteiro(grupo.participantes)} grupos; fronteira de ${mwTexto(ct.fronteira.mw)}. O período vai do primeiro trimestre de declarações considerado (${inicioJanela}) à data do SIGA.` : undefined}
                endereco={ancoraPainel("p039")}
              />
            }
            recorte={
              <p>
                SIGA de {dataTexto(ct.fronteira.data)} e declarações de composição societária à ANEEL de {janela}; usinas em operação com participações válidas. {textoFronteiraNoCadastro(ct.fronteira, a)}
              </p>
            }
            limite={<>poder de mercado: a fronteira é capacidade instalada, não energia vendida nem mercado relevante, e a participação indireta não é calculada.</>}
          />
        </div>
        <section aria-labelledby="medidas" className="pb-8">
          <h2 id="medidas" className="rotulo pb-2 text-mineral">
            Medidas que não se somam
          </h2>
          <ul className="grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Capacidade proporcional", "A potência de cada usina repartida pela participação de cada dono. As parcelas somam a potência da usina, sem dupla contagem."],
              ["Capacidade sob controle", "A usina inteira para quem tem mais de 50% dela. Mede comando, não propriedade; não se soma à proporcional."],
              ["Consolidado e individual", "O consolidado inclui as controladas; o individual, só a companhia. São séries separadas, e nada se soma entre companhias."],
              ["Potência e energia", "MW é capacidade instalada (potência); o que as usinas geram é energia, em MWh, e está na página de Geração."],
            ].map(([n, x]) => (
              <li key={n} className="bg-superficie p-4">
                <p className="rotulo text-mineral">{n}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-carvao">{x}</p>
              </li>
            ))}
          </ul>
        </section>

        {g.downloads.length > 0 && (
          <section aria-labelledby="dados-do-modulo" className="mt-10 border-t border-linha pb-16 pt-6">
            <h2 id="dados-do-modulo" className="rotulo text-mineral">
              Baixar os dados do módulo
            </h2>
            <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {g.downloads.map((x) => (
                <li key={x.url}>
                  <a href={x.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                    {x.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        </ModoProfundidade>
      </main>
    </>
  );
}
