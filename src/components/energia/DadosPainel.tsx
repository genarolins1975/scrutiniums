import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { carimbo } from "@/lib/energia/formato";
import { PAGINAS_DADOS, type IdPaginaDados } from "@/lib/energia/dados";

/**
 * Peças de servidor das páginas de Dados e de Metodologia (P067 a P071): navegação local de cada módulo, linha de referência, resposta
 * curta, recorte, avisos, seções dos níveis Analisar e Auditar e o rodapé do painel (downloads, link com o recorte, próxima pergunta).
 *
 * Dois módulos, cada um com a sua abertura: Dados (catálogo, saúde e reprodução) e Metodologia (regras e avaliação). Na abertura, as
 * outras páginas do módulo viram capítulos depois da figura principal; nas páginas filhas, uma faixa de irmãs no alto. Nunca as duas.
 *
 * Quatro páginas e não uma: o catálogo (415 conjuntos), a saúde (151), o manifesto (270 arquivos) e as regras (276 indicadores) são
 * listas grandes; juntas passariam da meta de cerca de 600 KB de HTML (seção 5.1 do contrato dos módulos).
 */

type ModuloDados = "dados" | "metodologia";

const itensDoModulo = (modulo: ModuloDados): ItemLocal[] =>
  PAGINAS_DADOS.filter((p) => p.modulo === modulo).map((p) => ({ id: p.id, href: p.href, rotulo: p.rotulo, descricao: p.pergunta }));

/** A página que abre cada módulo: nela não há faixa, porque os capítulos mostram os mesmos destinos depois da figura principal. */
const ABERTURA: Record<ModuloDados, IdPaginaDados> = { dados: "catalogo", metodologia: "regras" };

const moduloDe = (id: IdPaginaDados): ModuloDados => PAGINAS_DADOS.find((p) => p.id === id)?.modulo ?? "dados";

/** Faixa de páginas irmãs nas páginas filhas de cada módulo; a abertura do módulo não leva faixa. */
export function DadosNavegacao({ atual }: { atual: IdPaginaDados }) {
  const modulo = moduloDe(atual);
  if (atual === ABERTURA[modulo]) return null;
  return <NavegacaoLocal rotulo={modulo === "dados" ? "Páginas de Dados" : "Páginas de Metodologia"} itens={itensDoModulo(modulo)} atual={atual} />;
}

/** Capítulos da abertura de cada módulo: as outras páginas, cada uma com a pergunta que responde. */
export function DadosCapitulos({ atual }: { atual: IdPaginaDados }) {
  const modulo = moduloDe(atual);
  return (
    <NavegacaoLocal
      rotulo={modulo === "dados" ? "Capítulos de Dados" : "Capítulos de Metodologia"}
      itens={itensDoModulo(modulo)}
      atual={atual}
      variante="capitulos"
      titulo={modulo === "dados" ? "Outras perguntas sobre os dados" : "Outra pergunta sobre o método"}
      nivelTitulo={3}
    />
  );
}

/**
 * Linha de referência do cabeçalho: as datas que o leitor precisa para não ler o painel como o dia em que abre a página, cada
 * uma com o que mede. A data de referência é o dia a que valem a situação e as contagens; o processamento é a hora em que o
 * catálogo e a saúde foram calculados; a lista de arquivos (manifesto) é refeita no fim de cada execução que reescreve
 * arquivos publicados, por isso pode ser mais recente.
 */
export function ReferenciaDados({ processadoEm, geradoEm, referencia, manifestoEm, extra }: { processadoEm?: string; geradoEm?: string; referencia?: string; manifestoEm?: string; extra?: ReactNode }) {
  // `geradoEm` é a forma antiga (uma só data de processamento), mantida para a página de avaliação dos painéis
  if (processadoEm === undefined) {
    return (
      <>
        {referencia ? <>Data de referência da publicação: {referencia}. </> : null}Publicação processada em {carimbo(geradoEm)}. {extra}
      </>
    );
  }
  return (
    <>
      {referencia ? <>Data de referência dos dados: {referencia}. </> : null}Catálogo e saúde processados em {carimbo(processadoEm)}. {manifestoEm ? <>Lista de arquivos gerada em {carimbo(manifestoEm)}. </> : null}
      {extra}
    </>
  );
}

/**
 * Resposta do painel. Com `veredito`, em duas camadas: o veredito à vista e a resposta completa em Analisar e Auditar; as provas
 * (Comprove este número) ficam fora das duas camadas. Sem `veredito`, a resposta completa à vista (página de avaliação).
 * `depois` mantém a resposta na ordem do documento, depois das figuras, quando a faixa de métricas já traz os mesmos números.
 */
export function DadosResposta({ painel, veredito, children, prova, depois = false }: { painel: string; veredito?: string; children: ReactNode; prova?: ReactNode; depois?: boolean }) {
  if (veredito === undefined) {
    return (
      <div className="border-l-2 border-energia pl-4" data-resposta={painel}>
        <p className="text-base leading-relaxed text-carvao md:text-lg">{children}</p>
        {prova && <div className="mt-1 flex flex-wrap items-center gap-x-5">{prova}</div>}
      </div>
    );
  }
  return (
    <div className="border-l-2 border-energia pl-4">
      <RespostaCurta id={painel} veredito={veredito} depois={depois}>
        {children}
      </RespostaCurta>
      {prova && <div className="mt-1 flex flex-wrap items-center gap-x-5">{prova}</div>}
    </div>
  );
}

export function DadosRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3">
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

/** Aviso que muda a leitura (data de referência, lacuna, divergência publicada). */
export function DadosAviso({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted">
      {children}
    </div>
  );
}

/** Seção de Analisar: tabela completa, regra por extenso, comparação. Mesma estrutura de SecaoDoPainel, com o nível fixo. */
export function DadosAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="analisar">
      {children}
    </SecaoDoPainel>
  );
}

/** Seção de Auditar: fórmula, versões, arquivos, hashes, controles e limitações. */
export function DadosAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="auditar">
      {children}
    </SecaoDoPainel>
  );
}

/** Limitações do painel: as de leitor sempre; as `tecnicas` (nome de banco, versão do código, arquivo) só em Analisar e Auditar. */
export function DadosLimitacoes({ itens, tecnicas = [] }: { itens: readonly ReactNode[]; tecnicas?: readonly ReactNode[] }) {
  if (!itens.length && !tecnicas.length) return null;
  return (
    <div>
      <p className="rotulo text-mineral">Limitações declaradas</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
        {itens.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
        {tecnicas.map((l, i) => (
          <li key={`t${i}`} data-nivel="analisar">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rodapé do painel: downloads, link com o recorte e próxima pergunta, numa linha (SeguirPainel). */
export function DadosSeguir({ ancora, proximo, downloads, extra }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: readonly { rotulo: string; url: string }[]; extra?: ReactNode }) {
  const unicos = downloads.filter((d, i) => downloads.findIndex((x) => x.url === d.url) === i);
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={unicos} extra={extra} />;
}

/** Gold ausente: a página diz o que falta, nunca mostra número de reserva. */
export function DadosIndisponivel({ atual, motivo }: { atual: "dados" | "metodologia"; motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual={atual} />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Dados indisponíveis nesta publicação"
          motivo={motivo ?? "As golds do módulo Dados (catalogo.json, publicacao.json, manifesto.json) não foram geradas ou não passaram na validação; a última publicação válida é mantida quando existe."}
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
