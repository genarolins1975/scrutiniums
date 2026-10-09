import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { PAINEIS_PLD, perguntaPainel as perguntaPld, rotaPainel as rotaPld } from "@/lib/energia/pld";
import { dataBR, reais } from "@/lib/energia/formato";
import {
  ALCANCE_LIMITE,
  ARTIGO_LIMITE,
  CAMPOS_LIMITE,
  PAINEIS_REGULACAO,
  ROTA_REGULACAO,
  ROTULO_CONFERENCIA,
  ROTULO_RESULTADO_CONFERENCIA,
  marcosDoAto,
  textoDefasagemEvento,
  textoReuniao,
  type IdPainelRegulacao,
} from "@/lib/energia/regulacao";
import type { Natureza } from "@/lib/energia/tipos";
import type { AtoLimite } from "@/lib/energia/tipos-regulacao";

/**
 * Peças de servidor das páginas da Regulação (um painel por página: /setor-eletrico/regulacao para o P044, /linha-do-tempo para o
 * P045 e /consultas-e-agenda para o P046): navegação local (faixa de irmãs nas filhas, capítulos na abertura), recorte do painel,
 * aviso de ausência e de fonte defasada, datas de cada parte, a ficha de um ato de limites (o que fixou, publicação e vigência em
 * marcos separados) e o link externo para documento oficial. O rodapé é o SeguirPainel compartilhado, e as seções de Analisar e
 * Auditar são SecaoDoPainel.
 *
 * Por que um painel por página: os três juntos trazem atos com trechos literais, todos os procedimentos do PRODIST e do PRORET,
 * os eventos da linha do tempo e as consultas com fases e resultados, além das tabelas equivalentes e das fichas de prova; numa
 * página só passariam da meta de cerca de 600 KB de HTML (contrato, seção 5.1).
 */

/** Páginas do módulo como itens da navegação local; a descrição de cada capítulo é a pergunta do painel. */
const ITENS_REGULACAO: ItemLocal[] = PAINEIS_REGULACAO.map((p) => ({ id: p.id, href: p.rota, rotulo: p.rotulo, descricao: p.pergunta }));

/**
 * Faixa de páginas irmãs nas filhas. A abertura (limites) não leva a faixa: mostra os mesmos destinos como capítulos depois da
 * figura principal (RegulacaoCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function RegulacaoNavegacao({ atual }: { atual: IdPainelRegulacao }) {
  if (atual === "p044") return null;
  return <NavegacaoLocal rotulo="Painéis da regulação" itens={ITENS_REGULACAO} atual={atual} />;
}

/**
 * Capítulos da abertura: as duas páginas irmãs e, no painel de preços, onde os limites são cruzados com o PLD observado (o piso e os
 * tetos aqui são o que a regra diz; lá, quantas horas o preço chegou a eles). O destino e a pergunta vêm da lista do módulo PLD.
 */
export function RegulacaoCapitulos() {
  const limites = PAINEIS_PLD.find((p) => p.id === "p010");
  const itens: ItemLocal[] = [
    ...ITENS_REGULACAO,
    ...(limites ? [{ id: "pld-limites", href: rotaPld("p010"), rotulo: "No PLD: limites, piso e tetos", descricao: perguntaPld("p010") }] : []),
  ];
  return <NavegacaoLocal rotulo="Capítulos da regulação" itens={itens} atual="p044" variante="capitulos" titulo="Outras perguntas sobre as regras" nivelTitulo={3} />;
}

/** Gold ausente ou reprovada na validação: a página diz o que falta, nunca mostra número de reserva. */
export function RegulacaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Regulação indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold da regulação (public/energia/gold/regulacao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_REGULACAO} className="text-energia-dark underline underline-offset-4">
            Voltar à regulação
          </Link>
        </p>
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, como legenda logo abaixo da figura principal e da tabela (mesma forma da Água e clima). */
export function RegulacaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function RegulacaoAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Datas de referência de cada parte da página (conferência dos atos, geração dos recursos, verificação das páginas): cada uma diz o seu dia. */
export function RegulacaoDatas({ itens }: { itens: { rotulo: string; texto: string; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label="Datas de referência de cada parte">
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.texto}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/** Link externo para documento oficial ou cópia pública; abre em nova aba com aviso para leitor de tela. */
export function RegulacaoLinkExterno({ href, children, bloco = false }: { href: string; children: ReactNode; bloco?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere] hover:text-carvao${bloco ? " inline-flex min-h-[44px] items-center" : ""}`}
    >
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

/** Marca de um marco do ato: círculo vazado (publicação), círculo cheio (início da vigência) e traço (fim do intervalo registrado). */
function MarcaDoMarco({ chave }: { chave: "publicacao" | "inicio" | "fim" }) {
  return (
    <svg width="14" height="14" aria-hidden="true" className="shrink-0">
      {chave === "publicacao" && <circle cx="7" cy="7" r="5" fill="var(--cor-superficie)" stroke="var(--cor-carvao-muted)" strokeWidth="2" />}
      {chave === "inicio" && <circle cx="7" cy="7" r="5" fill="var(--cor-carvao-muted)" />}
      {chave === "fim" && <rect x="5.5" y="1" width="3" height="12" fill="var(--cor-carvao-muted)" />}
    </svg>
  );
}

/**
 * Os marcos de um ato de limites, um por data, na ordem em que aconteceram: publicação no Diário Oficial, início da vigência e fim do
 * intervalo registrado. As marcas são as mesmas do gráfico da linha do tempo (círculo vazado, círculo cheio). Publicação não
 * conferida fica dita, sem data de reserva; publicação depois do início da vigência aparece depois dele (vigência retroativa).
 */
export function MarcosDoAto({ ato }: { ato: Pick<AtoLimite, "data_publicacao" | "vigencia_inicio" | "vigencia_fim"> }) {
  const marcos = marcosDoAto(ato);
  const espera = textoDefasagemEvento({ data_publicacao: ato.data_publicacao, vigencia_inicio: ato.vigencia_inicio, vigencia_grao: "dia", vigencia_calculada: false });
  return (
    <div data-marcos-ato="" className="mt-3">
      <ol aria-label="Marcos do ato" className="grid gap-y-1 sm:flex sm:flex-wrap sm:gap-x-6">
        {marcos.map((m) => (
          <li key={m.chave} data-marco={m.chave} className="inline-flex flex-wrap items-center gap-x-2">
            <MarcaDoMarco chave={m.chave} />
            <span className="text-carvao-muted">{m.chave === "publicacao" ? "Publicação" : m.rotulo}</span>
            {m.data ? (
              <time dateTime={m.data} className="tabular-nums text-carvao">
                {dataBR(m.data)}
              </time>
            ) : (
              <span className="italic text-carvao-muted">{m.ausencia}</span>
            )}
          </li>
        ))}
      </ol>
      {ato.data_publicacao && <p className="mt-1 text-xs text-carvao-muted">{espera.charAt(0).toUpperCase() + espera.slice(1)}.</p>}
    </div>
  );
}

/**
 * Um ato de limites. Em Entender: o que fixou (com o que cada limite limita), a publicação no Diário Oficial e o início e o fim da
 * vigência, em marcos separados. A data do ato, o dispositivo, onde foi lido, as conferências feitas sobre o texto, o trecho
 * literal e o documento ficam em Analisar.
 */
export function FichaDoAto({ a }: { a: AtoLimite }) {
  const fixou = CAMPOS_LIMITE.filter((c) => a[c] !== null);
  return (
    <article className="min-w-0 border-l-2 border-linha pl-4 text-sm" data-ato={a.ato}>
      <h4 className="font-serif text-base text-carvao">{a.ato}</h4>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 [&_dd]:[overflow-wrap:anywhere]">
        <dt className="text-carvao-muted">Fixou</dt>
        <dd className="text-carvao">
          {fixou.length ? (
            <ul className="space-y-0.5">
              {fixou.map((c) => (
                <li key={c}>
                  {ARTIGO_LIMITE[c].replace(/^o /, "")} {reais(a[c], 2)}/MWh <span className="text-carvao-muted">({ALCANCE_LIMITE[c]})</span>
                </li>
              ))}
            </ul>
          ) : (
            "nenhum dos três limites"
          )}
          {fixou.length < 3 && fixou.length > 0 ? <span className="block text-carvao-muted">Os demais limites do ano vêm de outro ato.</span> : null}
        </dd>
      </dl>
      <MarcosDoAto ato={a} />
      <div data-nivel="analisar" className="mt-3 space-y-2 border-t border-linha pt-3">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 [&_dd]:[overflow-wrap:anywhere]">
          <dt className="text-carvao-muted">Data do ato</dt>
          <dd className="tabular-nums text-carvao">{a.data_do_ato ? dataBR(a.data_do_ato) : "não informada"}</dd>
          {a.dou ? (
            <>
              <dt className="text-carvao-muted">Diário Oficial</dt>
              <dd className="text-carvao">{a.dou}</dd>
            </>
          ) : null}
          <dt className="text-carvao-muted">Dispositivo</dt>
          <dd className="text-carvao">{a.dispositivo}</dd>
          <dt className="text-carvao-muted">Onde foi lido</dt>
          <dd className="text-carvao">
            {a.nivel_conferencia === "texto_do_ato" ? "no texto do próprio ato" : "em documento oficial do mesmo processo (o texto do ato não está acessível)"}
            {a.documento_titulo ? `: ${a.documento_titulo}` : ""}
            {a.pagina !== null ? `, página ${a.pagina}` : ""}
          </dd>
          {a.deliberacao && (
            <>
              <dt className="text-carvao-muted">Deliberação</dt>
              <dd className="text-carvao">
                reunião {textoReuniao(a.deliberacao.reuniao)} da Diretoria, em {dataBR(a.deliberacao.data)}
                {a.deliberacao.processo ? `, processo ${a.deliberacao.processo}` : ""}
              </dd>
            </>
          )}
          {a.altera_ou_revoga && (
            <>
              <dt className="text-carvao-muted">Altera ou revoga</dt>
              <dd className="text-carvao">{a.altera_ou_revoga}</dd>
            </>
          )}
        </dl>
        <ul className="space-y-0.5 text-xs text-carvao-muted" aria-label={`Conferências de ${a.ato}`}>
          {a.conferencias.map((c, i) => (
            <li key={`${c.conferencia}:${c.campo}:${i}`}>
              <span className="text-carvao">{ROTULO_CONFERENCIA[c.conferencia] ?? c.conferencia}</span>
              {c.campo && ARTIGO_LIMITE[c.campo as keyof typeof ARTIGO_LIMITE] ? ` (${ARTIGO_LIMITE[c.campo as keyof typeof ARTIGO_LIMITE].replace(/^o /, "")})` : ""}: {ROTULO_RESULTADO_CONFERENCIA[c.resultado] ?? c.resultado}. {c.detalhe}
            </li>
          ))}
        </ul>
        <details className="text-xs">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Trecho literal, documento e observações</summary>
          <div className="mt-1 space-y-1.5 border-l-2 border-linha pl-3 text-carvao-muted">
            <p>
              <q>{a.trecho}</q>
            </p>
            {a.observacoes.map((o) => (
              <p key={o}>{o}</p>
            ))}
            <p className="flex flex-wrap gap-x-4">
              {a.url_oficial && <RegulacaoLinkExterno bloco href={a.url_oficial}>Endereço oficial (ANEEL)</RegulacaoLinkExterno>}
              {a.copia_publica && <RegulacaoLinkExterno bloco href={a.copia_publica}>Cópia pública lida, conferida por sha256</RegulacaoLinkExterno>}
            </p>
            {a.sha256 && <p className="[overflow-wrap:anywhere]">sha256 {a.sha256}</p>}
          </div>
        </details>
      </div>
    </article>
  );
}
