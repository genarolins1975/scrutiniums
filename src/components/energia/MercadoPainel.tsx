import type { ReactNode } from "react";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carimbo, mesAno } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { DEFINICOES_MERCADO_EN, traducaoExata } from "@/lib/energia/i18n/mercado-preco";
import { datasLegiveis } from "@/lib/energia/visao";
import {
  PAGINAS_MERCADO,
  ROTULO_RESULTADO,
  TITULO_PAGINA_MERCADO,
  textoEstado,
  vereditoPainelMercado,
  type IdPaginaMercado,
  type ItemAusenteMercado,
} from "@/lib/energia/mercado";
import type { MercadoGold, PainelMercado } from "@/lib/energia/tipos-mercado";

/**
 * Peças de servidor das quatro páginas do módulo Mercado (P032 a P035): faixa de irmãs nas filhas e capítulos com o veredito de
 * cada painel na abertura, linha de referência das fontes, recorte como legenda da figura, aviso, o que a página ainda não
 * mostra (estado honesto do que a fonte não publica ou o observatório não integrou), estado do painel com as verificações do
 * critério de aceite e limitações. O rodapé é o SeguirPainel compartilhado e as seções de Analisar e Auditar são SecaoDoPainel.
 *
 * Quatro páginas e não uma pelo mesmo motivo de Perdas: cada painel leva gráficos, tabelas equivalentes e conferências; juntos,
 * o HTML passaria da meta de cerca de 600 KB (seção 5.1).
 */

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

/** Páginas do módulo como itens da navegação local; a descrição de cada uma é a pergunta que ela responde (lidas no render, no idioma da página). */
function itensMercado(): ItemLocal[] {
  return PAGINAS_MERCADO.map((p) => ({ id: p.id, href: p.href, rotulo: p.rotulo, descricao: TITULO_PAGINA_MERCADO[p.id] }));
}

/** Texto em prosa da gold (só em português): na página inglesa sai marcado como trecho em português. */
export function TextoGold({ children, regiao }: { children: ReactNode; regiao: string }) {
  if (children === null || children === undefined || children === "") return null;
  return <TrechoPortugues regiao={regiao}>{children}</TrechoPortugues>;
}

/** Faixa de páginas irmãs nas filhas. A abertura mostra os mesmos destinos como capítulos (MercadoCapitulos) e não leva a faixa. */
export function MercadoNavegacao({ atual }: { atual: IdPaginaMercado }) {
  if (atual === "livre-regulado") return null;
  return <NavegacaoLocal rotulo={tx("Painéis do módulo Mercado", "Market module panels")} itens={itensMercado()} atual={atual} />;
}

/** Linha de referência do cabeçalho, a mesma nas quatro páginas, lida da gold. */
export function ReferenciaMercado({ g }: { g: MercadoGold }) {
  const r = g.referencias;
  return (
    <>
      {tx(
        <>
          EPE até {mesAno(r.epe_ultimo_mes)}; CCEE até {r.ccee_ultimo_mes_consumo ? mesAno(r.ccee_ultimo_mes_consumo) : "mês não publicado"} (consumo, agentes e encargos) e{" "}
          {r.ccee_ultimo_mes_gsf ? mesAno(r.ccee_ultimo_mes_gsf) : "mês não publicado"} (GSF); SAMP da ANEEL com ano completo de {r.samp_ano_referencia ?? "ano não publicado"}. Processado em {carimbo(g.gerado_em)}.
        </>,
        <>
          EPE to {mesAno(r.epe_ultimo_mes)}; CCEE to {r.ccee_ultimo_mes_consumo ? mesAno(r.ccee_ultimo_mes_consumo) : "month not published"} (consumption, agents and charges) and{" "}
          {r.ccee_ultimo_mes_gsf ? mesAno(r.ccee_ultimo_mes_gsf) : "month not published"} (GSF); ANEEL SAMP with a complete year for {r.samp_ano_referencia ?? "year not published"}. Processed on {carimbo(g.gerado_em)}.
        </>,
      )}
    </>
  );
}

/** Período, universo e unidade do painel, como legenda logo abaixo da figura principal (mesma forma da Água e clima). */
export function MercadoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
        <dd className="mt-0.5 leading-relaxed">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
        <dd className="mt-0.5 leading-relaxed">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="mt-0.5 leading-relaxed">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (lacuna da fonte, divergência publicada, mês incompleto). */
export function MercadoAviso({ children }: { children: ReactNode }) {
  return <div className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">{children}</div>;
}

/** Estado do painel, verificações do critério de aceite e limitações, como a gold publica. */
export function MercadoVerificacoes({ painel }: { painel: PainelMercado }) {
  return (
    <div className="space-y-3 text-sm" data-estado={painel.estado_dados}>
      <p className="leading-relaxed text-carvao">
        {textoEstado(painel)} {tx("Critério de aceite da especificação:", "Specification acceptance criterion:")} <TextoGold regiao="mercado-criterio">{painel.criterio_aceite}</TextoGold>
      </p>
      <ul className="space-y-1.5 text-carvao-muted">
        {painel.verificacoes.map((v) => (
          <li key={v.nome} className="leading-relaxed [overflow-wrap:anywhere]">
            <span className={v.resultado === "aprovado" ? "text-carvao" : "text-aviso"}>{ROTULO_RESULTADO[v.resultado]}</span>
            {v.essencial ? "" : tx(" (divergência documentada, fora do critério)", " (documented divergence, outside the criterion)")}: <TextoGold regiao="mercado-verificacao">{datasLegiveis(v.nome)}. {datasLegiveis(v.detalhe)}</TextoGold>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MercadoLimitacoes({ painel }: { painel: PainelMercado }) {
  if (!painel.limitacoes.length) return null;
  return (
    <div className="border-t border-linha pt-4" data-limitacoes="">
      <p className="rotulo text-mineral">{tx("Limitações declaradas", "Declared limitations")}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
        {painel.limitacoes.map((l) => (
          <li key={l}>
            <TextoGold regiao="mercado-limitacao">{datasLegiveis(l).replace(/\bp\.p\./g, "pontos percentuais")}</TextoGold>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Definições operacionais do módulo (as que a gold publica, conferidas no documento do módulo). */
export function MercadoDefinicoes({ g, chaves }: { g: MercadoGold; chaves: (keyof MercadoGold["definicoes"])[] }) {
  const nome: Record<string, string> = {
    acl: "ACL",
    acr: "ACR",
    exportacao: tx("Exportação", "Exports"),
    agente: tx("Agente", "Agent"),
    perfil: tx("Perfil", "Profile"),
    parcela_de_carga: tx("Parcela de carga", "Load parcel"),
    unidade_consumidora: tx("Unidade consumidora", "Consumer unit"),
    migracao: tx("Migração", "Migration"),
    entrada_saida_agente: tx("Entrada e saída de agente", "Agent entry and exit"),
    desligamento: tx("Desligamento", "Disconnection"),
    variacao_liquida: tx("Variação líquida", "Net change"),
    mre: "MRE",
    gsf: "GSF",
    risco_hidrologico_acr: tx("Risco hidrológico do ACR", "ACR hydrological risk"),
    ess: "ESS",
    eer: "EER",
    competencia_pagamento_reprocessamento: tx("Competência, pagamento e reprocessamento", "Accounting month, payment and reprocessing"),
    pld: "PLD",
  };
  const idioma = idiomaEnergia();
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
      {chaves.map((k) => (
        <div key={k}>
          <dt className="font-medium text-carvao">{nome[k] ?? k}</dt>
          <dd className="mt-0.5 leading-relaxed text-carvao-muted">{traducaoExata(DEFINICOES_MERCADO_EN, g.definicoes[k], idioma) ?? <TextoGold regiao="mercado-definicao">{g.definicoes[k]}</TextoGold>}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Resposta do painel em duas camadas: o veredito (palavras simples, no máximo dois números) fica à vista e a resposta completa da
 * gold fica em Analisar e Auditar, inteira. Vem depois das figuras quando a faixa de métricas já traz os números. Sem veredito
 * (dado ausente), a mensagem de ausência vale como resposta.
 */
export function MercadoResposta({ painel, veredito, children, depois = true }: { painel: string; veredito?: string; children: ReactNode; depois?: boolean }) {
  if (veredito) {
    return (
      <RespostaCurta id={painel} depois={depois} veredito={veredito}>
        <TextoGold regiao="mercado-resposta">{children}</TextoGold>
      </RespostaCurta>
    );
  }
  return (
    <div data-resposta={painel} {...(depois ? { "data-resposta-depois": "" } : {})}>
      <p className="max-w-prose2 text-base leading-relaxed text-carvao md:text-lg">
        <TextoGold regiao="mercado-resposta">{children}</TextoGold>
      </p>
    </div>
  );
}

/**
 * Pendências e bloqueios que a gold declara, com a descrição completa e a evidência (endereço, captura, impressão digital e a
 * observação), para quem confere por que cada dado ainda não aparece. Datas ISO do texto da gold saem na forma da página.
 */
export function MercadoPendenciasAuditoria({ g }: { g: Pick<MercadoGold, "pendencias" | "bloqueios"> }) {
  const itens = [
    ...g.pendencias.map((p) => ({ tipo: tx("Pendência", "Pending item"), id: p.id, descricao: p.descricao, efeito: p.efeito, evidencia: p.evidencia as { url: string; capturado_em?: string | null; sha256?: string | null; observacao: string }, alternativas: [] as string[] })),
    ...g.bloqueios.map((b) => ({ tipo: tx("Bloqueio", "Blocked item"), id: b.id, descricao: b.descricao, efeito: b.efeito, evidencia: b.evidencia as { url: string; capturado_em?: string | null; sha256?: string | null; observacao: string }, alternativas: b.alternativas })),
  ];
  if (!itens.length) return null;
  return (
    <ul className="space-y-3 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]" data-pendencias="">
      {itens.map((i) => (
        <li key={`${i.tipo}:${i.id}`}>
          <span className="text-carvao">
            {i.tipo} ({i.id})
          </span>
          : <TextoGold regiao="mercado-pendencia">{datasLegiveis(i.descricao)}</TextoGold> {tx("Efeito:", "Effect:")} <TextoGold regiao="mercado-pendencia">{datasLegiveis(i.efeito)}</TextoGold> {tx("Evidência:", "Evidence:")}{" "}
          <TextoGold regiao="mercado-pendencia">{datasLegiveis(i.evidencia.observacao)}</TextoGold>{" "}
          <a href={i.evidencia.url} className="text-energia-dark underline underline-offset-4" target="_blank" rel="noopener noreferrer">
            {tx("endereço consultado", "address consulted")}
            <span className="sr-only">{tx(" (abre em nova aba)", " (opens in a new tab)")}</span>
          </a>
          {i.evidencia.capturado_em ? tx(`, capturado em ${carimbo(i.evidencia.capturado_em)}`, `, captured on ${carimbo(i.evidencia.capturado_em)}`) : ""}
          {i.evidencia.sha256 ? `, sha256 ${i.evidencia.sha256}` : ""}.
          {i.alternativas.length > 0 && (
            <>
              {" "}
              {tx("Alternativas integradas:", "Integrated alternatives:")} <TextoGold regiao="mercado-pendencia">{i.alternativas.map((x) => datasLegiveis(x)).join("; ")}</TextoGold>.
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * O que a página ainda não mostra: cada item é um dado que a fonte não publica, que está atrás de login ou que o observatório
 * verificou e não integrou, dito com o efeito sobre o painel. Estado honesto: nenhum número, barra ou previsão de entrega entra
 * no lugar do que falta. Sem itens, a seção não existe.
 */
export function MercadoAusencias({ id, titulo, lead, itens }: { id: string; titulo: string; lead?: ReactNode; itens: ItemAusenteMercado[] }) {
  if (!itens.length) return null;
  return (
    <SecaoDoPainel id={id} titulo={titulo} lead={lead}>
      <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2" data-ausencias="">
        {itens.map((i) => (
          <li key={i.id} className="min-w-0 border-l-2 border-linha pl-4 text-sm" data-ausente={i.id}>
            <p className="font-serif text-base text-carvao">{i.titulo}</p>
            <p className="mt-1 leading-relaxed text-carvao-muted">
              {i.emPortugues && i.efeito ? (
                <>
                  {i.prefixo}
                  <TextoGold regiao="mercado-ausencia">{i.efeito}</TextoGold>
                </>
              ) : (
                i.texto
              )}
            </p>
          </li>
        ))}
      </ul>
    </SecaoDoPainel>
  );
}

/**
 * Capítulos da abertura: as outras três perguntas do módulo, cada uma com o veredito do painel (a resposta completa da gold fica
 * por trás, em Analisar) e o link para a página. O destino e a pergunta vêm da lista do módulo; o veredito, dos mesmos campos da
 * resposta da gold. Um painel sem resposta diz que falta dado, em vez de mostrar um resumo vazio.
 */
export function MercadoCapitulos({ g, atual }: { g: MercadoGold; atual: IdPaginaMercado }) {
  const outras = PAGINAS_MERCADO.filter((p) => p.id !== atual);
  return (
    <nav aria-labelledby="mercado-outras" data-navegacao-local="capitulos" className="border-t border-linha pt-6">
      <h2 id="mercado-outras" className="ed-h2 font-serif text-carvao">
        {tx("As outras perguntas sobre o mercado", "The other questions about the market")}
      </h2>
      <ul className="mt-5 grid gap-x-8 gap-y-8 lg:grid-cols-3">
        {outras.map((o) => {
          const p = g.paineis.find((x) => x.id === o.painel);
          const veredito = p?.resposta ? vereditoPainelMercado(g, o.painel) : "";
          return (
            <li key={o.id} className="flex min-w-0 flex-col">
              <p className="rotulo text-mineral">{o.rotulo}</p>
              <h3 className="ed-h3 mt-1 font-serif text-carvao">
                <Link href={o.href} className="hover:text-energia-dark">
                  {TITULO_PAGINA_MERCADO[o.id]}
                </Link>
              </h3>
              <div className="mt-2 flex-1">
                {veredito ? (
                  <RespostaCurta id={o.painel} atributo="data-resposta-resumo" tamanho="sm" veredito={veredito}>
                    <TextoGold regiao="mercado-resposta">{p?.resposta}</TextoGold>
                  </RespostaCurta>
                ) : (
                  <p className="text-sm leading-relaxed text-carvao-muted">{p?.resposta ? <TextoGold regiao="mercado-resposta">{p.resposta}</TextoGold> : tx("Sem resposta publicada nesta atualização: falta dado na gold.", "No answer published in this update: data is missing from the gold layer.")}</p>
                )}
              </div>
              <Link href={o.href} className={`rotulo ${LINK}`}>
                {tx(`Abrir o painel ${o.rotulo.toLowerCase()}`, `Open the panel: ${o.rotulo}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function MercadoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Mercado indisponível nesta publicação", "Market unavailable in this publication")}
          motivo={motivo ?? tx("A gold do módulo Mercado (public/energia/gold/mercado.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.", "The Market module gold file (public/energia/gold/mercado.json) was not generated or did not pass validation; the last valid publication is kept when there is one.")}
        />
        <p className="mt-6 text-sm">
          <Link href="/setor-eletrico" className="text-energia-dark underline underline-offset-4">
            {tx("Voltar ao mapa do observatório", "Back to the observatory map")}
          </Link>
        </p>
      </main>
    </>
  );
}
