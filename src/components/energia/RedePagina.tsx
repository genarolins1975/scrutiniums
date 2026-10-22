import type { ReactNode } from "react";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { traduzDownloads } from "@/lib/energia/i18n/agua-carga-rede";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { ROTA_REDE, paineisRede, rotaPainel, semCaminhosInternos, type PainelRede } from "@/lib/energia/rede";
import type { Natureza } from "@/lib/energia/tipos";
import type { DicionarioOns, DocumentoOns } from "@/lib/energia/tipos-rede";

/**
 * Peças de servidor das páginas da Rede (um painel por página: /setor-eletrico/rede para
 * o P028, /balanco-e-exterior para o P029, /restricoes para o P030 e /programado para o
 * P031): navegação entre as páginas, avisos de ausência e defasagem, as datas de cada
 * parte, o rodapé com downloads, link compartilhável e próxima pergunta, e as listas de
 * documentos conferidos. As seções de Analisar e Auditar são `SecaoDoPainel`, direto nas
 * páginas.
 *
 * Por que um painel por página: cada painel tem séries, várias tabelas equivalentes e
 * fichas de prova; juntos passariam da meta de cerca de 600 KB de HTML por página
 * (contrato, seção 5.1).
 */

/** Páginas do módulo como itens da navegação local; a descrição de cada capítulo é a pergunta do painel. */
const itensRede = () => paineisRede().map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta }));

/**
 * Navegação entre as quatro páginas: faixa de páginas irmãs nas filhas. A abertura (circulação de energia) não leva a faixa, porque mostra
 * os mesmos destinos como capítulos depois da figura principal (RedeCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function RedeNavegacao({ atual }: { atual: PainelRede }) {
  if (atual === "p028") return null;
  return <NavegacaoLocal rotulo={tx("Páginas da rede", "Grid pages")} itens={itensRede()} atual={atual} />;
}

/** Capítulos da abertura: as outras três páginas do módulo, cada uma com a pergunta que responde. */
export function RedeCapitulos({ atual = "p028" }: { atual?: PainelRede }) {
  return (
    <NavegacaoLocal
      rotulo={tx("Capítulos da rede", "Grid chapters")}
      itens={itensRede()}
      atual={atual}
      variante="capitulos"
      titulo={tx("Outras perguntas sobre a rede", "Other questions about the grid")}
      nivelTitulo={3}
    />
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function RedeIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Rede indisponível nesta publicação", "Grid unavailable in this release")}
          motivo={
            motivo ??
            tx(
              "Os dados de detalhe da rede não foram gerados ou não passaram na validação desta publicação; a última publicação válida é mantida quando existe.",
              "The grid detail data were not generated or did not pass validation in this release; the last valid release is kept when it exists.",
            )
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_REDE} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("Voltar à rede", "Back to the grid")}
          </Link>
        </p>
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function RedeRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
      <div className="min-w-0">
        <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div className="min-w-0">
        <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div className="min-w-0">
        <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function RedeAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta, numa linha (SeguirPainel). */
export function RedeSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: { rotulo: string; url: string }[] }) {
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={traduzDownloads(downloads, idiomaEnergia())} />;
}

/** Datas de referência de cada parte da página: cada número diz o seu dia ou a sua hora, sem sugerir simultaneidade. */
export function RedeDatas({ itens }: { itens: { rotulo: string; texto: string | null; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label={tx("Datas de referência de cada parte", "Reference dates of each part")}>
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.texto ?? tx("sem dado nesta publicação", "no data in this release")}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/** Regras publicadas na gold (orientação, energia, nulo, PLD, balanço, limites, materialidade). */
export function RedeRegras({ regras }: { regras: { rotulo: string; texto: string }[] }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {regras.map((r) => (
        <div key={r.rotulo} className="min-w-0">
          <dt className="rotulo text-mineral">{r.rotulo}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-carvao">
            <TrechoPortugues regiao="regra publicada da rede">{semCaminhosInternos(r.texto)}</TrechoPortugues>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Trechos de documentos do ONS conferidos literalmente no arquivo baixado, com o
 * endereço, a captura e o sha256. Trecho não conferido é dito como tal.
 */
export function RedeDocumentos({ documentos }: { documentos: DocumentoOns[] }) {
  return (
    <ul className="space-y-4 text-sm text-carvao-muted">
      {documentos.map((d) => (
        <li key={d.url} className="space-y-1 [overflow-wrap:anywhere]">
          <p>
            <a href={d.url} rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
              <Nome>{d.titulo}</Nome>
            </a>
            {d.capturado_em ? tx(`, capturado em ${carimbo(d.capturado_em)}`, `, captured on ${carimbo(d.capturado_em)}`) : tx(", sem captura", ", not captured")}
            {d.sha256 ? ` (sha256 ${d.sha256.slice(0, 12)}…)` : ""}. <TrechoPortugues regiao="licença do documento do ONS">{d.licenca}</TrechoPortugues>
          </p>
          <ul className="space-y-1 pl-4">
            {d.trechos.map((t) => (
              <li key={t.id}>
                <span className="text-carvao">
                  &ldquo;<TrechoPortugues regiao="trecho de documento do ONS">{t.texto}</TrechoPortugues>&rdquo;
                </span>{" "}
                <span className="text-xs">
                  (
                  {t.confere === true
                    ? tx("conferido no arquivo", "checked in the file")
                    : t.confere === false
                      ? tx("não encontrado no arquivo", "not found in the file")
                      : tx("arquivo não capturado", "file not captured")}
                  )
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Dicionários de dados do ONS: versão, data, se definem o sinal e os trechos conferidos. */
export function RedeDicionarios({ dicionarios }: { dicionarios: DicionarioOns[] }) {
  return (
    <ul className="space-y-4 text-sm text-carvao-muted">
      {dicionarios.map((d) => (
        <li key={d.conjunto} className="space-y-1 [overflow-wrap:anywhere]">
          <p>
            <span className="text-carvao">
              <Nome>{d.conjunto}</Nome>
            </span>
            {tx(": dicionário", ": data dictionary")}
            {d.versoes.length
              ? tx(
                  ` versão ${d.versoes[d.versoes.length - 1].versao} (${d.versoes[d.versoes.length - 1].data.replaceAll("-", "/")})`,
                  ` version ${d.versoes[d.versoes.length - 1].versao} (${dataBR(d.versoes[d.versoes.length - 1].data, "en")})`,
                )
              : ""}
            {d.capturado_em ? tx(`, capturado em ${carimbo(d.capturado_em)}`, `, captured on ${carimbo(d.capturado_em)}`) : ""}
            {d.menciona_sinal === true
              ? tx("; define o sinal do valor", "; defines the sign of the value")
              : d.menciona_sinal === false
                ? tx("; não define o sinal do valor", "; does not define the sign of the value")
                : ""}
            .{" "}
            {d.url && (
              <a href={d.url} rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                {tx("Endereço do dicionário", "Dictionary address")}
              </a>
            )}
          </p>
          {d.trechos.length > 0 && (
            <ul className="space-y-1 pl-4">
              {d.trechos.map((t) => (
                <li key={t.id}>
                  <span className="text-carvao">
                    &ldquo;<TrechoPortugues regiao="trecho de dicionário do ONS">{t.texto}</TrechoPortugues>&rdquo;
                  </span>{" "}
                  <span className="text-xs">
                    (
                    {t.confere === true
                      ? tx("conferido", "checked")
                      : t.confere === false
                        ? tx("não encontrado", "not found")
                        : tx("não capturado", "not captured")}
                    )
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
