"use client";

import { useEffect, useRef, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregaJson } from "@/lib/energia/carregaJson";
import { mesAno } from "@/lib/energia/formato";
import {
  COLUNAS_ESS,
  COLUNAS_INFOMERCADO,
  COLUNAS_LIQUIDACAO,
  COLUNAS_PAGAMENTO,
  COLUNAS_SAMP,
  URL_GOLD_MERCADO,
  linhasEss,
  linhasInfoMercado,
  linhasLiquidacao,
  linhasPagamento,
  linhasSamp,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

/**
 * Tabelas longas de análise e auditoria do módulo Mercado lidas sob demanda (seção 5.1 do
 * contrato): a gold mercado.json é buscada quando o bloco se aproxima da janela (ou ao toque
 * no botão), e as linhas saem das mesmas funções puras que o servidor usaria. Antes disso, o
 * leitor tem os downloads em CSV. Nada aqui recalcula indicador; só escolhe linhas da gold.
 */
export type ConjuntoMercado = "livre-auditoria" | "encargos-analise" | "encargos-auditoria";

export function MercadoTabelasSobDemanda({ conjunto, versao, downloads }: { conjunto: ConjuntoMercado; versao: string; downloads: readonly { rotulo: string; url: string }[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pedido, setPedido] = useState(false);
  const [g, setG] = useState<MercadoGold | null>(null);
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
    if (!pedido || g || erro) return;
    let vivo = true;
    carregaJson<MercadoGold>(URL_GOLD_MERCADO)
      .then((j) => {
        if (vivo) setG(j);
      })
      .catch((x: unknown) => {
        if (vivo) setErro(x instanceof Error ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [pedido, g, erro]);

  const comum = { versao, chaveLinha: "id" as const };
  return (
    <div ref={caixa} className="space-y-4" data-tabelas={conjunto}>
      {!g ? (
        <div className="space-y-2 text-sm text-carvao-muted" role="status" aria-live="polite">
          <p>
            {erro
              ? `As tabelas não puderam ser lidas da gold publicada: ${erro}`
              : pedido
                ? "Lendo as tabelas na gold publicada…"
                : "As tabelas desta seção são lidas da gold publicada quando a seção aparece na tela."}
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
      ) : conjunto === "livre-auditoria" ? (
        <>
          <TabelaInterativa
            {...comum}
            titulo="Consumo contabilizado, exportação e variação do ACL × InfoMercado da CCEE"
            colunas={COLUNAS_INFOMERCADO}
            linhas={linhasInfoMercado(g.livre_regulado.reconciliacao.infomercado)}
            colunaRotulo="medida"
            fonte="CCEE, InfoMercado mensal (PDF) e conjuntos abertos"
            nomeArquivo="mercado-infomercado-consumo"
            chaveUrl="im"
          />
          <TabelaInterativa
            {...comum}
            titulo="Completude do SAMP por mês e unidades livres × EPE"
            colunas={COLUNAS_SAMP}
            linhas={linhasSamp(g)}
            colunaRotulo="mes"
            fonte="ANEEL, SAMP; EPE, consumo mensal"
            nomeArquivo="mercado-samp-completude"
            chaveUrl="samp"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
            nota={`Mês incompleto ou com linhas repetidas fica fora da comparação com a EPE. Série desde ${mesAno(g.livre_regulado.samp_nacional_mensal_desde)}; desde 2019 no CSV nacional.`}
          />
        </>
      ) : conjunto === "encargos-analise" ? (
        <>
          <TabelaInterativa
            {...comum}
            titulo="Liquidação mês a mês, com a situação de cada mês"
            colunas={COLUNAS_LIQUIDACAO}
            linhas={linhasLiquidacao(g)}
            colunaRotulo="mes"
            fonte="CCEE, SUMARIO_MENSAL_LIQUIDACAO"
            nomeArquivo="mercado-liquidacao"
            chaveUrl="liq"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
            nota="A grade tem todos os meses: o mês ausente do arquivo e os meses com zero publicado no lugar da liquidação aparecem sem valor, com a situação escrita."
          />
          <TabelaInterativa
            {...comum}
            titulo="Pagamento e alívio do ESS por mês"
            colunas={COLUNAS_PAGAMENTO}
            linhas={linhasPagamento(g)}
            colunaRotulo="mes"
            fonte="CCEE, ENCARGO_PGTO_MENSAL"
            nomeArquivo="mercado-pagamento-ess"
            chaveUrl="pag"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
          />
          <TabelaInterativa
            {...comum}
            titulo="ESS por tipo e mês de competência"
            colunas={COLUNAS_ESS}
            linhas={linhasEss(g)}
            colunaRotulo="mes"
            fonte="CCEE, ENCARGO_ESS_ANCILAR e RD_ENCARGOS_CONTAB_MENSAL"
            nomeArquivo="mercado-ess-tipos"
            chaveUrl="ess"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
          />
        </>
      ) : (
        <TabelaInterativa
          {...comum}
          titulo="Encargos e pagamento × InfoMercado da CCEE"
          colunas={COLUNAS_INFOMERCADO}
          linhas={linhasInfoMercado(g.encargos.reconciliacao_infomercado)}
          colunaRotulo="medida"
          fonte="CCEE, InfoMercado mensal (PDF) e conjuntos abertos"
          nomeArquivo="mercado-infomercado-encargos"
          chaveUrl="im"
        />
      )}
    </div>
  );
}
