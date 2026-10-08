import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { TransicaoIndisponivel, TransicaoNavegacao } from "@/components/energia/TransicaoPagina";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  GRANDEZAS,
  LIGACAO_GERACAO,
  PERGUNTA_ONS,
  data,
  kgPorMwh,
  mes,
  perguntaPainel,
  respostaEmissoes,
  respostaMmgd,
  respostaOns,
  rotaPainel,
  vereditoEmissoes,
  vereditoMmgd,
  vereditoOns,
} from "@/lib/energia/transicao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Transição e ambiente: geração distribuída e emissões",
  description:
    "Síntese da transição: onde a micro e minigeração distribuída cresce (cadastro da ANEEL, por UF e município), quanta energia ela entrega ao SIN (estimativa do ONS) e como varia a intensidade de emissões da geração (fator médio do MCTI), cada pergunta com o seu painel completo.",
  alternates: { canonical: "/setor-eletrico/transicao" },
};

/**
 * Síntese da Transição e ambiente: as perguntas do módulo, cada uma com a resposta
 * curta derivada da gold, um número com a sua ficha de prova, o recorte e o limite
 * principal, e o caminho para o painel completo (mapa, séries, tabelas, downloads,
 * modos Analisar e Auditar). Página editorial e de navegação: não repete os
 * gráficos dos painéis.
 */
function Cartao({
  id,
  rotulo,
  pergunta,
  resposta,
  veredito,
  numero,
  recorte,
  limite,
  href,
  ligacao,
}: {
  id: string;
  rotulo: string;
  pergunta: string;
  resposta: string;
  veredito: string;
  numero: ReactNode;
  recorte: ReactNode;
  limite: ReactNode;
  href: string;
  ligacao: string;
}) {
  return (
    <section id={`sintese-${id}`} aria-labelledby={`sintese-${id}-titulo`} className="scroll-mt-28 border border-linha bg-superficie">
      <div className="space-y-4 px-5 py-6 md:px-8">
        <p className="rotulo text-mineral">{rotulo}</p>
        <h2 id={`sintese-${id}-titulo`} className="font-serif text-xl leading-snug text-carvao md:text-2xl">
          {pergunta}
        </h2>
        <RespostaCurta id={id} veredito={veredito || resposta}>
          {resposta}
        </RespostaCurta>
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
          <Link href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {ligacao}
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Painéis de outros módulos que continuam a mesma narrativa, com a pergunta de cada um. */
const LIGACOES = [
  { href: "/setor-eletrico/carga/perfil-horario#p026", rotulo: "Carga: MMGD e perfil horário", texto: "Qual parcela da carga é estimada e quando ocorre o pico? A mesma estimativa de MMGD do ONS, hora a hora." },
  { href: LIGACAO_GERACAO.href, rotulo: "Geração: matriz efetiva", texto: `${LIGACAO_GERACAO.pergunta} A composição da geração do SIN por fonte, segundo o ONS; o fator médio do MCTI também se refere à geração no SIN.` },
  { href: "/setor-eletrico/expansao", rotulo: "Expansão", texto: "O que está sendo construído e quando pode entrar? A geração centralizada que se soma à distribuída." },
];

export default function TransicaoPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const m = g.mmgd;
  const o = g.ons_mmgd;
  const e = g.emissoes;

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["MWmed", "SIN", "ANEEL", "ONS", "MCTI", "IBGE"]}
          rotulo="Transição e ambiente"
          titulo="Como a transformação do setor se distribui e afeta as emissões?"
          referencia={
            <>
              Cadastro de MMGD da ANEEL de {data(m.data_cadastro)}; estimativa do ONS até {data(o?.fim_serie)}; fatores de emissão do MCTI até {mes(e?.ultimo_mes?.m)}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
        >
          Três perguntas, cada uma com a sua fonte e a sua unidade: onde a micro e minigeração distribuída cresce, quanta energia ela entrega ao sistema e quanto CO2 a geração emite
          por MWh. Os números são agregados por território; nenhum titular de unidade aparece aqui.
        </CabecalhoModulo>
        <TransicaoNavegacao atual="sintese" />

        <ModoProfundidade>
        <section aria-labelledby="grandezas" className="pb-6">
          <h2 id="grandezas" className="rotulo pb-2 text-mineral">
            Três grandezas que não se somam
          </h2>
          <ul className="grid gap-px border border-linha bg-linha sm:grid-cols-3">
            {GRANDEZAS.map((x) => (
              <li key={x.nome} className="bg-superficie p-4">
                <p className="rotulo text-mineral">
                  {x.nome} · {x.unidade}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-carvao">{x.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6 pb-10">
          <Cartao
            id="p063"
            rotulo="MMGD no território"
            pergunta={perguntaPainel("p063")}
            resposta={respostaMmgd(m)}
            veredito={vereditoMmgd(m)}
            numero={
              <Numero
                rotulo="Potência instalada de MMGD cadastrada"
                natureza="OBSERVADO"
                evidencia={m.evidencias.potencia}
                casas={1}
                unidade="MW"
                tamanho="medio"
                nota="Capacidade, não energia gerada."
                endereco={`${rotaPainel("p063")}#p063`}
              />
            }
            recorte={
              <p>
                Cadastro vigente em {data(m.data_cadastro)}, por UF, município, distribuidora e perfil; conexões por ano e mês, com os meses depois de {mes(m.corte_provisorio)}{" "}
                provisórios; população estimada pelo IBGE para {m.ano_populacao ?? "sem dado"}.
              </p>
            }
            limite="quanta energia cada lugar gera, nem a renda de quem tem o sistema: o cadastro mede capacidade, e o crédito pode ser usado em outro município."
            href={`${rotaPainel("p063")}#p063`}
            ligacao="Abrir o painel da MMGD: mapa, histórico, municípios e distribuidoras"
          />
          {o ? (
            <Cartao
              id="ons"
              rotulo="Energia estimada"
              pergunta={PERGUNTA_ONS}
              resposta={respostaOns(o)}
              veredito={vereditoOns(o)}
              numero={
                <Numero
                  rotulo="MMGD estimada no SIN, último mês completo"
                  natureza="ESTIMADO"
                  evidencia={o.evidencia}
                  casas={1}
                  unidade="MWmed"
                  tamanho="medio"
                  motivoAusencia="Nenhum mês com os quatro submercados completos nesta publicação."
                  endereco={`${rotaPainel("ons")}#ons`}
                />
              }
              recorte={
                <p>
                  Carga verificada do ONS de {data(o.inicio_serie)} a {data(o.fim_serie)}, por submercado e no SIN, em MWmed e em participação na carga global.
                </p>
              }
              limite="que o valor seja medido (é estimativa da fonte), nem nada fora do SIN; e não se soma à capacidade cadastrada."
              href={`${rotaPainel("ons")}#ons`}
              ligacao="Abrir a energia estimada pelo ONS: série mensal e anual"
            />
          ) : (
            <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
              A estimativa de MMGD do ONS não foi montada nesta publicação ({g.pendencias.join(" ") || "sem motivo registrado"}); nenhum valor de energia é estimado no lugar.
            </p>
          )}
          {e ? (
            <Cartao
              id="p064"
              rotulo="Emissões"
              pergunta={perguntaPainel("p064")}
              resposta={respostaEmissoes(e)}
              veredito={vereditoEmissoes(e)}
              numero={
                <Numero
                  rotulo={`Fator médio anual de ${e.ultimo_ano?.ano ?? "sem dado"}`}
                  natureza="ESTIMADO"
                  evidencia={e.evidencia}
                  casas={4}
                  unidade="tCO2/MWh"
                  tamanho="medio"
                  motivoAusencia="Nenhum ano completo publicado nesta versão."
                  nota={e.ultimo_ano ? `Toneladas de CO2 por MWh gerado no SIN; ${kgPorMwh(e.ultimo_ano.valor)}.` : undefined}
                  endereco={`${rotaPainel("p064")}#p064`}
                />
              }
              recorte={
                <p>
                  Fator médio do MCTI, mensal até {mes(e.ultimo_mes?.m)} e anual até {e.ultimo_ano?.ano ?? "sem dado"}, só CO2, geração no SIN; fatores do MDL em séries separadas.
                </p>
              }
              limite="o efeito de consumir ou economizar um MWh a mais (o fator médio não é marginal), emissões em CO2 equivalente, nem intensidade por hora ou por município."
              href={`${rotaPainel("p064")}#p064`}
              ligacao="Abrir o painel de emissões: série, comparação de anos e revisões"
            />
          ) : (
            <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
              Os fatores de emissão do MCTI não foram montados nesta publicação ({g.pendencias.join(" ") || "sem motivo registrado"}); nenhum fator é estimado no lugar do oficial.
            </p>
          )}
        </div>

        <section aria-labelledby="ligacoes" className="border-t border-linha py-8">
          <h2 id="ligacoes" className="font-serif text-xl text-carvao">
            A mesma narrativa em outros painéis
          </h2>
          <ul className="mt-3 grid gap-4 md:grid-cols-3">
            {LIGACOES.map((l) => (
              <li key={l.href} className="border border-linha bg-superficie p-4 text-sm">
                <Link href={l.href} className="inline-flex min-h-[44px] items-center font-medium text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {l.rotulo}
                </Link>
                <p className="mt-1 leading-relaxed text-carvao-muted">{l.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="arquivos" className="border-t border-linha py-8">
          <h2 id="arquivos" className="font-serif text-xl text-carvao">
            Arquivos do módulo
          </h2>
          <p className="mt-2 max-w-prose2 text-sm text-carvao-muted">CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; o JSON municipal é lido pelo mapa sob demanda.</p>
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
        </ModoProfundidade>
      </main>
    </>
  );
}
