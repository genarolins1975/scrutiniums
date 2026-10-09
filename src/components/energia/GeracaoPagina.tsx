import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
export { GeracaoAviso, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { carimbo } from "@/lib/energia/formato";
import { PAINEIS_GERACAO, ROTA_GERACAO, rotaPainel, type PainelGeracao } from "@/lib/energia/geracao";
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
 * Painel ainda não publicado não é link: sai da lista (os quatro estão publicados).
 */
const ITENS_GERACAO = PAINEIS_GERACAO.filter((p) => p.publicado).map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta }));

/**
 * Navegação entre os quatro painéis: faixa de páginas irmãs no alto das páginas filhas; a abertura (matriz efetiva) não leva a
 * faixa, porque mostra os mesmos destinos como capítulos depois da figura principal (GeracaoCapitulos), e o mesmo rótulo não
 * aparece duas vezes.
 */
export function GeracaoNavegacao({ atual }: { atual: PainelGeracao }) {
  if (atual === "p021") return null;
  return <NavegacaoLocal rotulo="Páginas de geração" itens={ITENS_GERACAO} atual={atual} />;
}

/** Capítulos da abertura: os outros três painéis do módulo, cada um com a pergunta que responde. */
export function GeracaoCapitulos({ atual = "p021" }: { atual?: PainelGeracao }) {
  return <NavegacaoLocal rotulo="Capítulos de geração" itens={ITENS_GERACAO} atual={atual} variante="capitulos" titulo="Outras perguntas sobre a geração" />;
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function GeracaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Geração indisponível nesta publicação"
          motivo={
            motivo ??
            "Os dados de detalhe da geração não foram gerados ou não passaram na validação da publicação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_GERACAO} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Voltar à geração
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

/** Regras publicadas na gold, com rótulo legível. */
export function GeracaoRegras({ regras }: { regras: { rotulo: string; texto: string }[] }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {regras.map((r) => (
        <div key={r.rotulo} className="min-w-0">
          <dt className="rotulo text-mineral">{r.rotulo}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">{r.texto}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Lista de frases (limitações da proveniência, tratamento do A11, controles). */
export function GeracaoFrases({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
      {itens.map((t) => (
        <li key={t}>{t}</li>
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
                {d.orgao}, {d.documento}
              </a>
            ) : (
              <span className="text-carvao">
                {d.orgao}, {d.documento}
              </span>
            )}
            {d.versao ? `, versão ${d.versao}` : ""}
            {d.data_documento ? ` de ${d.data_documento.replaceAll("-", "/")}` : ""}
            {d.capturado_em ? `; capturado em ${carimbo(d.capturado_em)}` : "; sem captura registrada"}.
          </p>
          {d.trecho ? (
            <p className="pl-4">
              <span className="text-carvao">&ldquo;{d.trecho}&rdquo;</span> <span className="text-xs">(trecho literal do documento)</span>
            </p>
          ) : (
            <p className="pl-4 text-xs">Trecho não encontrado na captura; o documento é citado só como referência.</p>
          )}
          {d.constatacao && <p className="pl-4 text-xs">Constatação da plataforma, não citação: {d.constatacao}</p>}
        </li>
      ))}
    </ul>
  );
}
