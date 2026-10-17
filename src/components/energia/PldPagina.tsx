import type { ReactNode } from "react";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carimbo } from "@/lib/energia/formato";
import { DOWNLOADS_PLD_EN, TEXTOS_CMO_EN, TEXTOS_PLD_EN, traducaoExata } from "@/lib/energia/i18n/mercado-preco";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { PAINEIS_PLD, ROTA_PLD, perguntaPainel, rotaPainel, type PainelPld } from "@/lib/energia/pld";
import type { Natureza } from "@/lib/energia/tipos";
import type { Controle, FonteTextual } from "@/lib/energia/tipos-pld";

/**
 * Peças de servidor das páginas do PLD (um painel por página: /setor-eletrico/pld
 * com o P008 e os capítulos de preço, conceito, formação e previsão; /cmo-e-formacao
 * para o P009; /limites para o P010; /historico para o P011; /diferencas-regionais
 * para o P012): navegação local única, recorte (período, universo e unidade),
 * avisos de ausência e defasagem, próximos passos, passagens normativas citadas,
 * datas de referência de cada parte e os controles automáticos da construção.
 *
 * Navegação local única: nas páginas filhas, a faixa de páginas irmãs (PldNavegacao);
 * na abertura, os capítulos (PldCapitulos) depois da figura principal. Nunca as duas, e
 * o mesmo rótulo não aparece em duas formas na mesma página.
 */

/** Rótulo da abertura na faixa das filhas: a página abre com o preço do último dia e traz a explicação em seguida. */
function rotuloAbertura(): string {
  return tx("Preço e explicação", "Price and explanation");
}

/** Páginas do PLD como itens da navegação local; a descrição de cada capítulo é a pergunta do painel (no idioma da página). */
function itensPaginas(): ItemLocal[] {
  return PAINEIS_PLD.map((p) => ({
    id: p.id,
    href: rotaPainel(p.id),
    rotulo: p.id === "p008" ? rotuloAbertura() : p.rotulo,
    descricao: p.pergunta,
  }));
}

/**
 * Faixa de páginas irmãs nas páginas filhas. A abertura (P008) não leva a faixa: mostra os mesmos destinos como capítulos depois da
 * figura principal (PldCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function PldNavegacao({ atual }: { atual: PainelPld }) {
  if (atual === "p008") return null;
  return <NavegacaoLocal rotulo={tx("Páginas do PLD", "PLD pages")} itens={itensPaginas()} atual={atual} />;
}

/**
 * Capítulos da abertura: as quatro páginas irmãs, cada uma com a pergunta que responde, e o que é âncora da própria página (a aula, a
 * formação do preço e a previsão). Uma navegação só: os dois tipos de destino ficam na mesma lista, e a descrição diz quando o destino
 * é uma parte desta página.
 */
function capitulos(): ItemLocal[] {
  return [
    ...itensPaginas().filter((i) => i.id !== "p008"),
    {
      id: "aula",
      href: "#o-que-e",
      rotulo: tx("Entenda o PLD em 90 segundos", "Understand the PLD in 90 seconds"),
      descricao: tx("O que é o PLD e o que ele não é, em linguagem simples. Nesta página.", "What the PLD is and what it is not, in plain language. On this page."),
    },
    { id: "formacao", href: "#formacao", rotulo: tx("De onde vem o preço", "Where the price comes from"), descricao: tx(`${perguntaPainel("p008")} Nesta página.`, `${perguntaPainel("p008")} On this page.`) },
    {
      id: "previsao",
      href: "#previsao",
      rotulo: tx("Para onde o PLD pode ir", "Where the PLD could go"),
      descricao: tx("O que existe de previsão nesta publicação. Nesta página.", "What forecasts exist in this publication. On this page."),
    },
  ];
}

export function PldCapitulos() {
  // dentro do painel de abertura (que já é h2), o título do bloco de capítulos é h3
  return (
    <NavegacaoLocal
      rotulo={tx("Capítulos do PLD", "PLD chapters")}
      itens={capitulos()}
      atual="p008"
      variante="capitulos"
      titulo={tx("Outras perguntas sobre o preço", "Other questions about the price")}
      nivelTitulo={3}
    />
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function PldIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Painel do PLD indisponível nesta publicação", "PLD panel unavailable in this publication")}
          motivo={
            motivo ??
            tx(
              "Os dados detalhados do PLD não foram gerados ou não passaram na validação desta publicação; a última publicação válida é mantida quando existe.",
              "The detailed PLD data were not generated or did not pass validation in this publication; the last valid publication is kept when there is one.",
            )
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_PLD} className="text-energia-dark underline underline-offset-4">
            {tx("Voltar ao PLD", "Back to the PLD")}
          </Link>
        </p>
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function PldRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function PldAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta, numa linha (SeguirPainel). */
export function PldSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: { rotulo: string; url: string }[] }) {
  const idioma = idiomaEnergia();
  // rótulos fixos da gold (pld_detalhe.json, downloads[].rotulo) pela tabela exata; rótulo novo da fonte segue como publicado
  const lista = downloads.map((d) => ({ ...d, rotulo: traducaoExata(DOWNLOADS_PLD_EN, d.rotulo, idioma) ?? d.rotulo }));
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={lista} />;
}

/**
 * Texto fixo da gold do PLD (regras, notas de método): a forma inglesa vem da tabela exata (TEXTOS_PLD_EN); texto que não está na
 * tabela sai em português marcado, nunca traduzido por aproximação.
 */
export function PldTextoGold({ texto, regiao }: { texto: string; regiao: string }) {
  const idioma = idiomaEnergia();
  const en = traducaoExata(TEXTOS_PLD_EN, texto, idioma) ?? traducaoExata(TEXTOS_CMO_EN, texto, idioma);
  return en ? <>{en}</> : <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>;
}

/** Datas de referência de cada parte da página: cada número diz o seu dia, sem sugerir simultaneidade. `ate` já vem escrito (data ou data e hora). */
export function PldDatas({ itens }: { itens: { rotulo: string; ate: string | null; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label={tx("Datas de referência de cada parte", "Reference dates for each part")}>
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.ate ?? tx("sem dado nesta publicação", "no data in this publication")}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/** Passagem normativa ou técnica conferida no documento baixado: dispositivo, texto literal e origem. */
export function PldPassagem({ p, compacta = false }: { p: FonteTextual; compacta?: boolean }) {
  return (
    <blockquote className="border-l-2 border-energia pl-3 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
      <p>
        <TrechoPortugues regiao="pld-passagem-normativa">“{p.texto}”</TrechoPortugues>
      </p>
      <footer className="mt-1 text-xs text-carvao-muted">
        <Nome>{compacta ? (p.dispositivo ?? p.origem) : p.origem}</Nome>
        {p.url && !compacta ? (
          <>
            {" "}
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
              {tx("documento", "document")}
            </a>
          </>
        ) : null}
        {p.capturado_em && !compacta ? tx(`; captura de ${carimbo(p.capturado_em)}`, `; captured on ${carimbo(p.capturado_em)}`) : ""}
      </footer>
    </blockquote>
  );
}

function rotuloResultado(r: Controle["resultado"]): string {
  switch (r) {
    case "aprovado":
      return tx("aprovado", "passed");
    case "ressalva":
      return tx("com ressalva", "with caveat");
    case "reprovado":
      return tx("reprovado", "failed");
  }
}
const GLIFO_RESULTADO: Record<Controle["resultado"], string> = { aprovado: "●", ressalva: "◐", reprovado: "○" };

/** Controles automáticos executados na construção da gold, com o resultado em palavra e glifo (nunca só cor). */
export function PldControles({ controles }: { controles: Controle[] }) {
  if (!controles.length) return <p className="text-sm text-carvao-muted">{tx("Nenhum controle publicado para este painel.", "No checks published for this panel.")}</p>;
  return (
    <ul className="space-y-2 text-sm text-carvao-muted">
      {controles.map((c) => (
        <li key={c.nome} className="leading-relaxed [overflow-wrap:anywhere]">
          <span className="text-carvao">
            <span aria-hidden="true">{GLIFO_RESULTADO[c.resultado]}</span> <TrechoPortugues regiao="pld-controle">{c.nome}</TrechoPortugues>
          </span>
          : {rotuloResultado(c.resultado)}. <TrechoPortugues regiao="pld-controle">{c.detalhe}</TrechoPortugues>
        </li>
      ))}
    </ul>
  );
}
