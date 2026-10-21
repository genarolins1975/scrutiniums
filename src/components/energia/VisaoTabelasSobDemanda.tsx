"use client";

import { useEffect, useRef, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregaJson } from "@/lib/energia/carregaJson";
import type { SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import { goldNoBloco } from "@/lib/energia/i18n/entrada-visao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  colunasAlternativas,
  colunasEpisodios,
  colunasRegras,
  colunasSensibilidade,
  colunasValoresFrases,
  colunasVersoes,
  URL_GOLD_VISAO,
  corteEpisodios,
  linhasAlternativas,
  linhasEpisodios,
  linhasRegras,
  linhasSensibilidade,
  linhasValoresFrases,
  linhasVersoes,
} from "@/lib/energia/visao";

/**
 * Tabelas de análise e auditoria da Visão geral lidas sob demanda (seção 5.1 do
 * contrato): a gold sintese.json é buscada quando o bloco se aproxima da janela (ou
 * ao toque no botão), e as linhas são derivadas pelas mesmas funções puras que o
 * servidor usaria. Antes disso, o leitor tem os downloads em CSV. Nada aqui recalcula
 * indicador; só escolhe linhas da gold publicada.
 */
export type ConjuntoTabelas = "sistema-auditoria" | "observar-analise";

export function VisaoTabelasSobDemanda({
  conjunto,
  fonte,
  versao,
  downloads,
}: {
  conjunto: ConjuntoTabelas;
  fonte: string;
  versao: string;
  downloads: { rotulo: string; url: string }[];
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const caixa = useRef<HTMLDivElement>(null);
  const [pedido, setPedido] = useState(false);
  const [g, setG] = useState<SinteseVisaoGold | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // o bloco pede a gold quando chega perto da janela; sem IntersectionObserver, só pelo botão
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setPedido(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!pedido || g) return;
    let vivo = true;
    carregaJson<SinteseVisaoGold>(URL_GOLD_VISAO)
      .then((j) => {
        if (vivo) setG(j);
      })
      .catch((x: unknown) => {
        if (vivo) setErro(x instanceof Error ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [pedido, g]);

  const comum = { fonte, versao, chaveLinha: "id" as const, iniciarAberta: true };
  return (
    <div ref={caixa} className="space-y-4" data-tabelas={conjunto}>
      {!g ? (
        <div className="space-y-2 text-sm text-carvao-muted" role="status" aria-live="polite">
          <p>
            {erro
              ? tx(`As tabelas não puderam ser lidas da base publicada: ${erro}`, `The tables could not be read from the published base: ${erro}`)
              : pedido
                ? tx("Lendo as tabelas na base publicada…", "Reading the tables from the published base…")
                : tx("As tabelas desta seção são lidas da base publicada quando a seção aparece na tela.", "The tables in this section are read from the published base when the section comes into view.")}
          </p>
          {!pedido && (
            <button type="button" onClick={() => setPedido(true)} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
              {tx("Carregar as tabelas", "Load the tables")}
            </button>
          )}
          {erro && (
            <button type="button" onClick={() => setErro(null)} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
              {tx("Tentar de novo", "Try again")}
            </button>
          )}
          {downloads.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {downloads.map((d) => (
                <li key={d.url}>
                  <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                    {goldNoBloco(d.rotulo, idioma, "visao-tabelas-download")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : conjunto === "sistema-auditoria" ? (
        <>
          <TabelaInterativa
            {...comum}
            titulo={tx("Valores usados nas frases", "Values used in the sentences")}
            colunas={colunasValoresFrases(idioma)}
            linhas={linhasValoresFrases(g.frases)}
            colunaRotulo="chave"
            nomeArquivo="visao-geral-valores"
            chaveUrl="p004.v"
          />
          <TabelaInterativa
            {...comum}
            titulo={tx("Versões de origem de cada frase", "Source versions of each sentence")}
            colunas={colunasVersoes(idioma)}
            linhas={linhasVersoes(g.frases)}
            colunaRotulo="frase"
            nomeArquivo="visao-geral-versoes"
            chaveUrl="p004.s"
          />
        </>
      ) : (
        <>
          <TabelaInterativa
            {...comum}
            titulo={tx("Regras: estado do dia, limiares e histórico", "Rules: state of the day, thresholds and history")}
            colunas={colunasRegras(idioma)}
            linhas={linhasRegras(g.observar, idioma)}
            colunaRotulo="titulo"
            nomeArquivo="visao-geral-regras"
            chaveUrl="p007.t"
            nota={tx("Percentuais sobre os dias avaliáveis de cada regra, que começam em datas diferentes.", "Percentages over the assessable days of each rule, which start on different dates.")}
          />
          <TabelaInterativa
            {...comum}
            titulo={tx("Sensibilidade à duração mínima (1, 3, 7 e 14 dias)", "Sensitivity to the minimum duration (1, 3, 7 and 14 days)")}
            colunas={colunasSensibilidade(idioma)}
            linhas={linhasSensibilidade(g.observar, idioma)}
            colunaRotulo="regra"
            nomeArquivo="visao-geral-sensibilidade"
            chaveUrl="p007.s"
            nota={tx(
              "A duração adotada está marcada; as outras mostram quantos episódios e dias em alerta a regra teria com outro mínimo.",
              "The adopted duration is marked; the others show how many episodes and days in alert the rule would have with another minimum.",
            )}
          />
          <TabelaInterativa
            {...comum}
            titulo={tx("Últimos episódios de alerta", "Latest alert episodes")}
            colunas={colunasEpisodios(idioma)}
            linhas={linhasEpisodios(g.observar, idioma)}
            colunaRotulo="regra"
            nomeArquivo="visao-geral-episodios"
            chaveUrl="p007.e"
            ordemInicial={{ coluna: "inicio", direcao: "desc" }}
            // o idioma vem do endereço da janela: a tabela só existe no navegador, depois de lida a gold
            nota={corteEpisodios(g.observar, g.historico_regras.inicio).texto}
          />
          <TabelaInterativa
            {...comum}
            titulo={tx("Variantes avaliadas e não adotadas", "Variants assessed and not adopted")}
            colunas={colunasAlternativas(idioma)}
            linhas={linhasAlternativas(g.observar, idioma)}
            colunaRotulo="regra"
            nomeArquivo="visao-geral-variantes"
            chaveUrl="p007.a"
            nota={tx(
              "Cada variante foi avaliada no mesmo histórico; a frequência que teria é o motivo registrado para adotar ou rejeitar.",
              "Each variant was assessed on the same history; the frequency it would have is the recorded reason for adopting or rejecting it.",
            )}
          />

        </>
      )}
    </div>
  );
}
