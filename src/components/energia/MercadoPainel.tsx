import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { VisaoLinkPainel } from "@/components/energia/VisaoLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { carimbo, mesAno } from "@/lib/energia/formato";
import { datasLegiveis } from "@/lib/energia/visao";
import { PAGINAS_MERCADO, ROTULO_RESULTADO, textoEstado, type IdPaginaMercado } from "@/lib/energia/mercado";
import type { MercadoGold, PainelMercado } from "@/lib/energia/tipos-mercado";

/**
 * Peças de servidor das quatro páginas do módulo Mercado (P032 a P035): navegação entre os
 * painéis, linha de referência das fontes, resposta curta, recorte, estado do painel com as
 * verificações do critério de aceite, limitações, rodapé (downloads, link compartilhável e
 * próxima pergunta) e os blocos dos modos Analisar e Auditar.
 *
 * Quatro páginas e não uma pelo mesmo motivo de Perdas: cada painel leva gráficos, tabelas
 * equivalentes e conferências; juntos, o HTML passaria da meta de cerca de 600 KB (seção 5.1).
 * O link compartilhável é o da Visão geral (endereço atual com a âncora do painel).
 */

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

export function MercadoNavegacao({ atual }: { atual: IdPaginaMercado }) {
  return (
    <nav aria-label="Painéis do módulo Mercado" className="border-y border-linha bg-superficie">
      <ul className="flex flex-wrap gap-x-1 gap-y-0 px-2">
        {PAGINAS_MERCADO.map((p) => {
          const ativo = p.id === atual;
          return (
            <li key={p.id}>
              <Link
                href={p.href}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-1.5 px-3 text-sm ${ativo ? "bg-energia-fundo text-carvao shadow-[inset_0_-3px_0_var(--cor-energia)]" : "text-carvao-muted hover:text-carvao"}`}
              >
                {p.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Linha de referência do cabeçalho, a mesma nas quatro páginas, lida da gold. */
export function ReferenciaMercado({ g }: { g: MercadoGold }) {
  const r = g.referencias;
  return (
    <>
      EPE até {mesAno(r.epe_ultimo_mes)}; CCEE até {r.ccee_ultimo_mes_consumo ? mesAno(r.ccee_ultimo_mes_consumo) : "mês não publicado"} (consumo, agentes e encargos) e{" "}
      {r.ccee_ultimo_mes_gsf ? mesAno(r.ccee_ultimo_mes_gsf) : "mês não publicado"} (GSF); SAMP da ANEEL com ano completo de {r.samp_ano_referencia ?? "ano não publicado"}. Processado em {carimbo(g.gerado_em)}.
    </>
  );
}

export function MercadoResposta({ painel, children, prova }: { painel: string; children: ReactNode; prova?: ReactNode }) {
  return (
    <div className="mb-5 border-l-2 border-energia pl-4" data-resposta={painel}>
      <p className="text-base leading-relaxed text-carvao md:text-lg">{children}</p>
      {prova && <div className="mt-1 flex flex-wrap items-center gap-x-5">{prova}</div>}
    </div>
  );
}

export function MercadoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="mb-4 grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5 leading-relaxed">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5 leading-relaxed">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5 leading-relaxed">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (lacuna da fonte, divergência publicada, mês incompleto). */
export function MercadoAviso({ children }: { children: ReactNode }) {
  return <div className="my-3 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted">{children}</div>;
}

export function MercadoAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="mt-6 scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function MercadoAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="mt-6 scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Estado do painel, verificações do critério de aceite e limitações, como a gold publica. */
export function MercadoVerificacoes({ painel }: { painel: PainelMercado }) {
  return (
    <div className="space-y-3 text-sm" data-estado={painel.estado_dados}>
      <p className="leading-relaxed text-carvao">
        {textoEstado(painel)} Critério de aceite da especificação: {painel.criterio_aceite}
      </p>
      <ul className="space-y-1.5 text-carvao-muted">
        {painel.verificacoes.map((v) => (
          <li key={v.nome} className="leading-relaxed [overflow-wrap:anywhere]">
            <span className={v.resultado === "aprovado" ? "text-carvao" : "text-aviso"}>{ROTULO_RESULTADO[v.resultado]}</span>
            {v.essencial ? "" : " (divergência documentada, fora do critério)"}: {datasLegiveis(v.nome)}. {datasLegiveis(v.detalhe)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MercadoLimitacoes({ painel }: { painel: PainelMercado }) {
  if (!painel.limitacoes.length) return null;
  return (
    <div className="mt-4">
      <p className="rotulo text-mineral">Limitações declaradas</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
        {painel.limitacoes.map((l) => (
          <li key={l}>{datasLegiveis(l)}</li>
        ))}
      </ul>
    </div>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 8 a 10). */
export function MercadoSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: readonly { rotulo: string; url: string }[] }) {
  const unicos = downloads.filter((d, i) => downloads.findIndex((x) => x.url === d.url) === i);
  return (
    <div className="mt-6 space-y-3 border-t border-linha pt-3">
      {unicos.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {unicos.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className={LINK}>
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <VisaoLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={proximo.href} className={LINK}>
            {proximo.pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Definições operacionais do módulo (as que a gold publica, conferidas no documento do módulo). */
export function MercadoDefinicoes({ g, chaves }: { g: MercadoGold; chaves: (keyof MercadoGold["definicoes"])[] }) {
  const nome: Record<string, string> = {
    acl: "ACL",
    acr: "ACR",
    exportacao: "Exportação",
    agente: "Agente",
    perfil: "Perfil",
    parcela_de_carga: "Parcela de carga",
    unidade_consumidora: "Unidade consumidora",
    migracao: "Migração",
    entrada_saida_agente: "Entrada e saída de agente",
    desligamento: "Desligamento",
    variacao_liquida: "Variação líquida",
    mre: "MRE",
    gsf: "GSF",
    risco_hidrologico_acr: "Risco hidrológico do ACR",
    ess: "ESS",
    eer: "EER",
    competencia_pagamento_reprocessamento: "Competência, pagamento e reprocessamento",
    pld: "PLD",
  };
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
      {chaves.map((k) => (
        <div key={k}>
          <dt className="font-medium text-carvao">{nome[k] ?? k}</dt>
          <dd className="mt-0.5 leading-relaxed text-carvao-muted">{g.definicoes[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** As outras perguntas do módulo, com a resposta curta que a gold publica para cada uma. */
export function MercadoOutrasPerguntas({ g, atual }: { g: MercadoGold; atual: IdPaginaMercado }) {
  const outras = PAGINAS_MERCADO.filter((p) => p.id !== atual);
  return (
    <section aria-labelledby="mercado-outras" className="border border-linha bg-superficie px-5 py-6 md:px-8">
      <h2 id="mercado-outras" className="font-serif text-xl text-carvao md:text-2xl">
        As outras perguntas sobre o mercado
      </h2>
      <ul className="mt-4 grid gap-4 lg:grid-cols-3">
        {outras.map((o) => {
          const p = g.paineis.find((x) => x.id === o.painel);
          return (
            <li key={o.id} className="flex flex-col border border-linha bg-papel px-4 py-4">
              <p className="rotulo text-mineral">{o.rotulo}</p>
              <h3 className="mt-1 font-serif text-lg leading-snug text-carvao">{p?.pergunta ?? o.rotulo}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-carvao-muted">{p?.resposta ?? "Sem resposta publicada nesta atualização: falta dado na gold."}</p>
              <Link href={o.href} className={`rotulo ${LINK}`}>
                Abrir o painel {o.rotulo.toLowerCase()}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function MercadoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Mercado indisponível nesta publicação"
          motivo={motivo ?? "A gold do módulo Mercado (public/energia/gold/mercado.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."}
        />
        <p className="mt-6 text-sm">
          <Link href="/setor-eletrico" className="text-energia-dark underline underline-offset-4">
            Voltar ao mapa do observatório
          </Link>
        </p>
      </main>
    </>
  );
}
