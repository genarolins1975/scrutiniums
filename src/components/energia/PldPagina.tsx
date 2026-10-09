import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { carimbo } from "@/lib/energia/formato";
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
const ROTULO_ABERTURA = "Preço e explicação";

/** Páginas do PLD como itens da navegação local; a descrição de cada capítulo é a pergunta do painel. */
const ITENS_PAGINAS: ItemLocal[] = PAINEIS_PLD.map((p) => ({
  id: p.id,
  href: rotaPainel(p.id),
  rotulo: p.id === "p008" ? ROTULO_ABERTURA : p.rotulo,
  descricao: p.pergunta,
}));

/**
 * Faixa de páginas irmãs nas páginas filhas. A abertura (P008) não leva a faixa: mostra os mesmos destinos como capítulos depois da
 * figura principal (PldCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function PldNavegacao({ atual }: { atual: PainelPld }) {
  if (atual === "p008") return null;
  return <NavegacaoLocal rotulo="Páginas do PLD" itens={ITENS_PAGINAS} atual={atual} />;
}

/**
 * Capítulos da abertura: as quatro páginas irmãs, cada uma com a pergunta que responde, e o que é âncora da própria página (a aula, a
 * formação do preço e a previsão). Uma navegação só: os dois tipos de destino ficam na mesma lista, e a descrição diz quando o destino
 * é uma parte desta página.
 */
const CAPITULOS: ItemLocal[] = [
  ...ITENS_PAGINAS.filter((i) => i.id !== "p008"),
  { id: "aula", href: "#o-que-e", rotulo: "Entenda o PLD em 90 segundos", descricao: "O que é o PLD e o que ele não é, em linguagem simples. Nesta página." },
  { id: "formacao", href: "#formacao", rotulo: "De onde vem o preço", descricao: `${perguntaPainel("p008")} Nesta página.` },
  { id: "previsao", href: "#previsao", rotulo: "Para onde o PLD pode ir", descricao: "O que existe de previsão nesta publicação. Nesta página." },
];

export function PldCapitulos() {
  return <NavegacaoLocal rotulo="Capítulos do PLD" itens={CAPITULOS} atual="p008" variante="capitulos" titulo="Outras perguntas sobre o preço" />;
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function PldIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Painel do PLD indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold de detalhe do PLD (public/energia/gold/pld_detalhe.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_PLD} className="text-energia-dark underline underline-offset-4">
            Voltar ao PLD
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
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={downloads} />;
}

/** Datas de referência de cada parte da página: cada número diz o seu dia, sem sugerir simultaneidade. `ate` já vem escrito (data ou data e hora). */
export function PldDatas({ itens }: { itens: { rotulo: string; ate: string | null; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label="Datas de referência de cada parte">
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.ate ?? "sem dado nesta publicação"}
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
      <p>“{p.texto}”</p>
      <footer className="mt-1 text-xs text-carvao-muted">
        {compacta ? (p.dispositivo ?? p.origem) : p.origem}
        {p.url && !compacta ? (
          <>
            {" "}
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
              documento
            </a>
          </>
        ) : null}
        {p.capturado_em && !compacta ? `; captura de ${carimbo(p.capturado_em)}` : ""}
      </footer>
    </blockquote>
  );
}

const ROTULO_RESULTADO: Record<Controle["resultado"], string> = { aprovado: "aprovado", ressalva: "com ressalva", reprovado: "reprovado" };
const GLIFO_RESULTADO: Record<Controle["resultado"], string> = { aprovado: "●", ressalva: "◐", reprovado: "○" };

/** Controles automáticos executados na construção da gold, com o resultado em palavra e glifo (nunca só cor). */
export function PldControles({ controles }: { controles: Controle[] }) {
  if (!controles.length) return <p className="text-sm text-carvao-muted">Nenhum controle publicado para este painel.</p>;
  return (
    <ul className="space-y-2 text-sm text-carvao-muted">
      {controles.map((c) => (
        <li key={c.nome} className="leading-relaxed [overflow-wrap:anywhere]">
          <span className="text-carvao">
            <span aria-hidden="true">{GLIFO_RESULTADO[c.resultado]}</span> {c.nome}
          </span>
          : {ROTULO_RESULTADO[c.resultado]}. {c.detalhe}
        </li>
      ))}
    </ul>
  );
}
