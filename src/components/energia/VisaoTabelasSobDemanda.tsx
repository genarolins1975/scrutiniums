"use client";

import { useEffect, useRef, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregaJson } from "@/lib/energia/carregaJson";
import type { SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import {
  COLUNAS_ALTERNATIVAS,
  COLUNAS_EPISODIOS,
  COLUNAS_REGRAS,
  COLUNAS_SENSIBILIDADE,
  COLUNAS_VALORES_FRASES,
  COLUNAS_VERSOES,
  URL_GOLD_VISAO,
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

  const comum = { fonte, versao, chaveLinha: "id" as const };
  return (
    <div ref={caixa} className="space-y-4" data-tabelas={conjunto}>
      {!g ? (
        <div className="space-y-2 text-sm text-carvao-muted" role="status" aria-live="polite">
          <p>
            {erro
              ? `As tabelas não puderam ser lidas da base publicada: ${erro}`
              : pedido
                ? "Lendo as tabelas na base publicada…"
                : "As tabelas desta seção são lidas da base publicada quando a seção aparece na tela."}
          </p>
          {!pedido && (
            <button type="button" onClick={() => setPedido(true)} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
              Carregar as tabelas
            </button>
          )}
          {erro && (
            <button type="button" onClick={() => setErro(null)} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
              Tentar de novo
            </button>
          )}
          {downloads.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {downloads.map((d) => (
                <li key={d.url}>
                  <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                    {d.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : conjunto === "sistema-auditoria" ? (
        <>
          <TabelaInterativa {...comum} titulo="Valores usados nas frases" colunas={COLUNAS_VALORES_FRASES} linhas={linhasValoresFrases(g.frases)} colunaRotulo="chave" nomeArquivo="visao-geral-valores" chaveUrl="p004.v" />
          <TabelaInterativa {...comum} titulo="Versões de origem de cada frase" colunas={COLUNAS_VERSOES} linhas={linhasVersoes(g.frases)} colunaRotulo="frase" nomeArquivo="visao-geral-versoes" chaveUrl="p004.s" />
        </>
      ) : (
        <>
          <TabelaInterativa
            {...comum}
            titulo="Regras: estado do dia, limiares e histórico"
            colunas={COLUNAS_REGRAS}
            linhas={linhasRegras(g.observar)}
            colunaRotulo="titulo"
            nomeArquivo="visao-geral-regras"
            chaveUrl="p007.t"
            nota="Percentuais sobre os dias avaliáveis de cada regra, que começam em datas diferentes."
          />
          <TabelaInterativa
            {...comum}
            titulo="Sensibilidade à duração mínima (1, 3, 7 e 14 dias)"
            colunas={COLUNAS_SENSIBILIDADE}
            linhas={linhasSensibilidade(g.observar)}
            colunaRotulo="regra"
            nomeArquivo="visao-geral-sensibilidade"
            chaveUrl="p007.s"
            nota="A duração adotada está marcada; as outras mostram quantos episódios e dias em alerta a regra teria com outro mínimo."
          />
          <TabelaInterativa
            {...comum}
            titulo="Últimos episódios de alerta"
            colunas={COLUNAS_EPISODIOS}
            linhas={linhasEpisodios(g.observar)}
            colunaRotulo="regra"
            nomeArquivo="visao-geral-episodios"
            chaveUrl="p007.e"
            ordemInicial={{ coluna: "inicio", direcao: "desc" }}
          />
          <TabelaInterativa
            {...comum}
            titulo="Variantes avaliadas e não adotadas"
            colunas={COLUNAS_ALTERNATIVAS}
            linhas={linhasAlternativas(g.observar)}
            colunaRotulo="regra"
            nomeArquivo="visao-geral-variantes"
            chaveUrl="p007.a"
            nota="Cada variante foi avaliada no mesmo histórico; a frequência que teria é o motivo registrado para adotar ou rejeitar."
          />
        </>
      )}
    </div>
  );
}
