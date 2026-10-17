"use client";

import { useEffect, useRef, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregaJson } from "@/lib/energia/carregaJson";
import { mesAno } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  colunasEss,
  colunasInfoMercado,
  colunasLiquidacao,
  colunasPagamento,
  colunasSamp,
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
  const idioma = useIdioma();
  const tx = useTx();

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

  const comum = { versao, chaveLinha: "id" as const, iniciarAberta: true };
  return (
    <div ref={caixa} className="space-y-4" data-tabelas={conjunto}>
      {!g ? (
        <div className="space-y-2 text-sm text-carvao-muted" role="status" aria-live="polite">
          <p>
            {erro
              ? tx(`As tabelas não puderam ser lidas da base publicada: ${erro}`, `The tables could not be read from the published database: ${erro}`)
              : pedido
                ? tx("Lendo as tabelas na base publicada…", "Reading the tables from the published database…")
                : tx("As tabelas desta seção são lidas da base publicada quando a seção aparece na tela.", "The tables in this section are read from the published database when the section comes into view.")}
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
            titulo={tx("Consumo contabilizado, exportação e variação do ACL × InfoMercado da CCEE", "Accounted consumption, exports and ACL change × CCEE InfoMercado")}
            colunas={colunasInfoMercado(idioma)}
            linhas={linhasInfoMercado(g.livre_regulado.reconciliacao.infomercado, idioma)}
            colunaRotulo="medida"
            fonte={tx("CCEE, InfoMercado mensal (PDF) e conjuntos abertos", "CCEE, monthly InfoMercado (PDF) and open datasets")}
            nomeArquivo="mercado-infomercado-consumo"
            chaveUrl="im"
          />
          <TabelaInterativa
            {...comum}
            titulo={tx("Completude do SAMP por mês e unidades livres × EPE", "SAMP completeness by month and free consumer units × EPE")}
            colunas={colunasSamp(idioma)}
            linhas={linhasSamp(g, idioma)}
            colunaRotulo="mes"
            fonte={tx("ANEEL, SAMP; EPE, consumo mensal", "ANEEL, SAMP; EPE, monthly consumption")}
            nomeArquivo="mercado-samp-completude"
            chaveUrl="samp"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
            nota={tx(`Mês incompleto ou com linhas repetidas fica fora da comparação com a EPE. Série desde ${mesAno(g.livre_regulado.samp_nacional_mensal_desde, idioma)}; desde 2019 no CSV nacional.`, `An incomplete month or one with repeated rows is excluded from the comparison with EPE. Series since ${mesAno(g.livre_regulado.samp_nacional_mensal_desde, idioma)}; since 2019 in the national CSV.`)}
          />
        </>
      ) : conjunto === "encargos-analise" ? (
        <>
          <TabelaInterativa
            {...comum}
            titulo={tx("Liquidação mês a mês, com a situação de cada mês", "Settlement month by month, with the status of each month")}
            colunas={colunasLiquidacao(idioma)}
            linhas={linhasLiquidacao(g, idioma)}
            colunaRotulo="mes"
            fonte="CCEE, SUMARIO_MENSAL_LIQUIDACAO"
            nomeArquivo="mercado-liquidacao"
            chaveUrl="liq"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
            nota={tx("A grade tem todos os meses: o mês ausente do arquivo e os meses com zero publicado no lugar da liquidação aparecem sem valor, com a situação escrita.", "The grid has every month: the month missing from the file and the months with a zero published in place of settlement appear without a value, with the status stated.")}
          />
          <TabelaInterativa
            {...comum}
            titulo={tx("Pagamento e alívio do ESS por mês", "ESS payment and relief by month")}
            colunas={colunasPagamento(idioma)}
            linhas={linhasPagamento(g, idioma)}
            colunaRotulo="mes"
            fonte="CCEE, ENCARGO_PGTO_MENSAL"
            nomeArquivo="mercado-pagamento-ess"
            chaveUrl="pag"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
          />
          <TabelaInterativa
            {...comum}
            titulo={tx("ESS por tipo e mês de competência", "ESS by type and accounting month")}
            colunas={colunasEss(idioma)}
            linhas={linhasEss(g)}
            colunaRotulo="mes"
            fonte={tx("CCEE, ENCARGO_ESS_ANCILAR e RD_ENCARGOS_CONTAB_MENSAL", "CCEE, ENCARGO_ESS_ANCILAR and RD_ENCARGOS_CONTAB_MENSAL")}
            nomeArquivo="mercado-ess-tipos"
            chaveUrl="ess"
            ordemInicial={{ coluna: "mes", direcao: "desc" }}
          />
        </>
      ) : (
        <TabelaInterativa
          {...comum}
          titulo={tx("Encargos e pagamento × InfoMercado da CCEE", "Charges and payment × CCEE InfoMercado")}
          colunas={colunasInfoMercado(idioma)}
          linhas={linhasInfoMercado(g.encargos.reconciliacao_infomercado, idioma)}
          colunaRotulo="medida"
          fonte={tx("CCEE, InfoMercado mensal (PDF) e conjuntos abertos", "CCEE, monthly InfoMercado (PDF) and open datasets")}
          nomeArquivo="mercado-infomercado-encargos"
          chaveUrl="im"
        />
      )}
    </div>
  );
}
