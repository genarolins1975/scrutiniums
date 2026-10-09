import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { carimbo, mesAno } from "@/lib/energia/formato";
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

/** Páginas do módulo como itens da navegação local; a descrição de cada uma é a pergunta que ela responde. */
const ITENS_MERCADO: ItemLocal[] = PAGINAS_MERCADO.map((p) => ({ id: p.id, href: p.href, rotulo: p.rotulo, descricao: TITULO_PAGINA_MERCADO[p.id] }));

/** Faixa de páginas irmãs nas filhas. A abertura mostra os mesmos destinos como capítulos (MercadoCapitulos) e não leva a faixa. */
export function MercadoNavegacao({ atual }: { atual: IdPaginaMercado }) {
  if (atual === "livre-regulado") return null;
  return <NavegacaoLocal rotulo="Painéis do módulo Mercado" itens={ITENS_MERCADO} atual={atual} />;
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

/** Período, universo e unidade do painel, como legenda logo abaixo da figura principal (mesma forma da Água e clima). */
export function MercadoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
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
  return <div className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">{children}</div>;
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
    <div className="border-t border-linha pt-4" data-limitacoes="">
      <p className="rotulo text-mineral">Limitações declaradas</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
        {painel.limitacoes.map((l) => (
          <li key={l}>{datasLegiveis(l).replace(/\bp\.p\./g, "pontos percentuais")}</li>
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

/**
 * Resposta do painel em duas camadas: o veredito (palavras simples, no máximo dois números) fica à vista e a resposta completa da
 * gold fica em Analisar e Auditar, inteira. Vem depois das figuras quando a faixa de métricas já traz os números. Sem veredito
 * (dado ausente), a mensagem de ausência vale como resposta.
 */
export function MercadoResposta({ painel, veredito, children, depois = true }: { painel: string; veredito?: string; children: ReactNode; depois?: boolean }) {
  if (veredito) {
    return (
      <RespostaCurta id={painel} depois={depois} veredito={veredito}>
        {children}
      </RespostaCurta>
    );
  }
  return (
    <div data-resposta={painel} {...(depois ? { "data-resposta-depois": "" } : {})}>
      <p className="max-w-prose2 text-base leading-relaxed text-carvao md:text-lg">{children}</p>
    </div>
  );
}

/**
 * Pendências e bloqueios que a gold declara, com a descrição completa e a evidência (endereço, captura, impressão digital e a
 * observação), para quem confere por que cada dado ainda não aparece. Datas ISO do texto da gold saem na forma da página.
 */
export function MercadoPendenciasAuditoria({ g }: { g: Pick<MercadoGold, "pendencias" | "bloqueios"> }) {
  const itens = [
    ...g.pendencias.map((p) => ({ tipo: "Pendência", id: p.id, descricao: p.descricao, efeito: p.efeito, evidencia: p.evidencia as { url: string; capturado_em?: string | null; sha256?: string | null; observacao: string }, alternativas: [] as string[] })),
    ...g.bloqueios.map((b) => ({ tipo: "Bloqueio", id: b.id, descricao: b.descricao, efeito: b.efeito, evidencia: b.evidencia as { url: string; capturado_em?: string | null; sha256?: string | null; observacao: string }, alternativas: b.alternativas })),
  ];
  if (!itens.length) return null;
  return (
    <ul className="space-y-3 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]" data-pendencias="">
      {itens.map((i) => (
        <li key={`${i.tipo}:${i.id}`}>
          <span className="text-carvao">
            {i.tipo} ({i.id})
          </span>
          : {datasLegiveis(i.descricao)} Efeito: {datasLegiveis(i.efeito)} Evidência: {datasLegiveis(i.evidencia.observacao)}{" "}
          <a href={i.evidencia.url} className="text-energia-dark underline underline-offset-4" target="_blank" rel="noopener noreferrer">
            endereço consultado<span className="sr-only"> (abre em nova aba)</span>
          </a>
          {i.evidencia.capturado_em ? `, capturado em ${carimbo(i.evidencia.capturado_em)}` : ""}
          {i.evidencia.sha256 ? `, sha256 ${i.evidencia.sha256}` : ""}.
          {i.alternativas.length > 0 && <> Alternativas integradas: {i.alternativas.map(datasLegiveis).join("; ")}.</>}
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
            <p className="mt-1 leading-relaxed text-carvao-muted">{i.texto}</p>
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
        As outras perguntas sobre o mercado
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
                    {p?.resposta}
                  </RespostaCurta>
                ) : (
                  <p className="text-sm leading-relaxed text-carvao-muted">{p?.resposta ?? "Sem resposta publicada nesta atualização: falta dado na gold."}</p>
                )}
              </div>
              <Link href={o.href} className={`rotulo ${LINK}`}>
                Abrir o painel {o.rotulo.toLowerCase()}
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
