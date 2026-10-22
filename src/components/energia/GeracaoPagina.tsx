import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
export { GeracaoAviso, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { ROTA_GERACAO, emPortugues, paineisGeracao, rotaPainel, type PainelGeracao } from "@/lib/energia/geracao";
import { tx } from "@/lib/energia/idioma";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import type { Natureza } from "@/lib/energia/tipos";
import type { EvidenciaDocumental } from "@/lib/energia/tipos-geracao";

/**
 * Peças de servidor das páginas da Geração (um painel por página: /setor-eletrico/geracao
 * para o P021, /termica para o P022, /restricoes para o P023 e /capacidade para o P024):
 * navegação local, avisos de ausência, rodapé com downloads, link compartilhável e próxima
 * pergunta, a lista de documentos oficiais citados e as datas de cada parte do módulo.
 *
 * Por que um painel por página: cada painel tem séries, várias tabelas equivalentes e
 * fichas de prova; juntos passariam da meta de cerca de 600 KB de HTML por página
 * (contrato, seção 5.1).
 */

/**
 * Páginas do módulo como itens da navegação local; a descrição de cada capítulo é a pergunta do painel (a mesma do Anexo A).
 * Painel ainda não publicado não é link: sai da lista (os quatro estão publicados). A seção Curtailment fecha a lista, com o
 * mesmo rótulo e a mesma pergunta do destino do menu (navegacao.ts), para a página não ficar escondida atrás das restrições.
 */
function itensGeracao() {
  const curtailment = DESTINOS_NAVEGACAO.find((d) => d.slug === "curtailment");
  return [
    ...paineisGeracao()
      .filter((p) => p.publicado)
      .map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta })),
    ...(curtailment?.publicado ? [{ id: curtailment.slug, href: curtailment.href, rotulo: curtailment.rotulo, descricao: curtailment.pergunta }] : []),
  ];
}

/**
 * Navegação entre os quatro painéis: faixa de páginas irmãs no alto das páginas filhas; a abertura (matriz efetiva) não leva a
 * faixa, porque mostra os mesmos destinos como capítulos depois da figura principal (GeracaoCapitulos), e o mesmo rótulo não
 * aparece duas vezes.
 */
export function GeracaoNavegacao({ atual }: { atual: PainelGeracao }) {
  if (atual === "p021") return null;
  return <NavegacaoLocal rotulo={tx("Páginas de geração", "Generation pages")} itens={itensGeracao()} atual={atual} />;
}

/** Capítulos da abertura: os outros três painéis do módulo, cada um com a pergunta que responde. */
export function GeracaoCapitulos({ atual = "p021" }: { atual?: PainelGeracao }) {
  return (
    <NavegacaoLocal
      rotulo={tx("Capítulos de geração", "Generation chapters")}
      itens={itensGeracao()}
      atual={atual}
      variante="capitulos"
      titulo={tx("Outras perguntas sobre a geração", "Other questions about generation")}
    />
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function GeracaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Geração indisponível nesta publicação", "Generation unavailable in this release")}
          motivo={
            motivo ??
            tx(
              "Os dados de detalhe da geração não foram gerados ou não passaram na validação da publicação; a última publicação válida é mantida quando existe.",
              "The detailed generation data were not produced or did not pass the release validation; the latest valid release is kept when there is one.",
            )
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_GERACAO} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("Voltar à geração", "Back to generation")}
          </Link>
        </p>
      </main>
    </>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta, numa linha (SeguirPainel). */
export function GeracaoSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string } | null; downloads: { rotulo: string; url: string }[] }) {
  return <SeguirPainel ancora={ancora} proximo={proximo ?? undefined} downloads={downloads} />;
}

/** Datas de referência de cada parte do módulo: cada número diz o seu período, sem sugerir simultaneidade. */
export function GeracaoDatas({ itens }: { itens: { rotulo: string; texto: string; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label={tx("Datas de referência de cada parte", "Reference dates of each part")}>
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

/** Regras publicadas na gold, com rótulo legível; o texto da regra só existe em português (na página inglesa, marcado como tal). */
export function GeracaoRegras({ regras }: { regras: { rotulo: string; texto: string }[] }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {regras.map((r) => (
        <div key={r.rotulo} className="min-w-0">
          <dt className="rotulo text-mineral">{r.rotulo}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
            <TrechoPortugues regiao="geracao-regra">{emPortugues(r.texto)}</TrechoPortugues>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Lista de frases (limitações da proveniência, tratamento do A11, controles). `daFonte`: as frases são prosa da gold, que só
 * existe em português (na página inglesa saem marcadas como tal); sem ele, já vêm no idioma da página.
 */
export function GeracaoFrases({ itens, daFonte = false }: { itens: string[]; daFonte?: boolean }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
      {itens.map((t) => (
        <li key={t}>{daFonte ? <TrechoPortugues regiao="geracao-frase">{emPortugues(t)}</TrechoPortugues> : emPortugues(t)}</li>
      ))}
    </ul>
  );
}

/**
 * Documentos oficiais que sustentam o achado A11, com o trecho literal capturado (quando o
 * texto foi encontrado) e a constatação da plataforma separada da citação.
 */
export function GeracaoDocumentos({ documentos }: { documentos: EvidenciaDocumental[] }) {
  return (
    <ul className="space-y-4 text-sm text-carvao-muted">
      {documentos.map((d, i) => (
        <li key={`${d.documento}:${i}`} className="space-y-1 [overflow-wrap:anywhere]">
          <p>
            {d.url ? (
              <a href={d.url} rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                {d.orgao}, <Nome>{d.documento}</Nome>
              </a>
            ) : (
              <span className="text-carvao">
                {d.orgao}, <Nome>{d.documento}</Nome>
              </span>
            )}
            {d.versao ? tx(`, versão ${d.versao}`, `, version ${d.versao}`) : ""}
            {d.data_documento ? tx(` de ${d.data_documento.replaceAll("-", "/")}`, ` of ${dataBR(d.data_documento.replace(/^(\d{2})-(\d{2})-(\d{4})$/, "$3-$2-$1"))}`) : ""}
            {d.capturado_em ? tx(`; capturado em ${carimbo(d.capturado_em)}`, `; captured on ${carimbo(d.capturado_em)}`) : tx("; sem captura registrada", "; no capture recorded")}.
          </p>
          {d.trecho ? (
            <p className="pl-4">
              <TrechoPortugues regiao="geracao-documento-trecho">
                <span className="text-carvao">&ldquo;{d.trecho}&rdquo;</span>
              </TrechoPortugues>{" "}
              <span className="text-xs">{tx("(trecho literal do documento)", "(literal excerpt from the document)")}</span>
            </p>
          ) : (
            <p className="pl-4 text-xs">{tx("Trecho não encontrado na captura; o documento é citado só como referência.", "Excerpt not found in the capture; the document is cited only as a reference.")}</p>
          )}
          {d.constatacao && (
            <p className="pl-4 text-xs">
              {tx("Constatação da plataforma, não citação: ", "Platform finding, not a quotation: ")}
              <TrechoPortugues regiao="geracao-documento-constatacao">{d.constatacao}</TrechoPortugues>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
