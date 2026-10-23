/**
 * Peças comuns das páginas de Segurança alimentar no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o índice da página
 * (as âncoras de cada figura e tabela, que já existiam), as siglas e datas da abertura, a ficha "Sobre este dado" da EBIA no Brasil e nas
 * regiões e o método da página, com a ficha completa de cada medida mostrada. Componentes de servidor: só leem e formatam a gold.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { Proveniencia } from "@/lib/painel/tipos";
import type { PanoramaAlimentar } from "@/lib/eficiencia/alimentar/dados";
import { ficha as fichaDe, fonte, type Complementos } from "@/lib/eficiencia/alimentar/complementos";
import { provenienciaObee } from "@/lib/eficiencia/proveniencia";
import { dataBr } from "@/lib/eficiencia/formato";
import { METODOS } from "./Complementos";

const link = "inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4";

/** "Nesta página": as âncoras das seções, logo depois dos números. */
export function NavegacaoAlimentar({ itens }: { itens: readonly (readonly [string, string])[] }) {
  return (
    <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-x-5 text-sm">
      {itens.map(([href, rotulo]) => (
        <a key={href} href={href} className={link}>
          {rotulo}
        </a>
      ))}
    </nav>
  );
}

/** Fontes, datas e siglas da abertura: a captura das bases complementares e as siglas que a página usa. */
export function siglasAlimentar(c: Complementos, siglas: readonly (readonly [string, string])[], extra?: ReactNode): ReactNode {
  return (
    <>
      <p>
        Bases complementares (EBIA por estado e por grupo social, CadINSAN, PAA, PNAE, IPCA e SISVAN) capturadas em {dataBr(c.manifesto.capturado_em)}. Cada medida tem o seu período de referência, escrito junto do dado. {extra}
      </p>
      <p>
        {siglas.map(([s, n], i) => (
          <span key={s}>
            {i > 0 && " "}
            <span className="font-medium">{s}:</span> {n}.
          </span>
        ))}
      </p>
    </>
  );
}

/** A EBIA no Brasil e nas Grandes Regiões, da publicação do IBGE conferida no PDF (página 6), com o arquivo e o hash da captura. */
export function provenienciaPnadRegioes(g: PanoramaAlimentar): Proveniencia {
  const pdf = g.manifest.sources.find((s) => s.file.endsWith(".pdf")) ?? g.manifest.sources[0];
  return provenienciaObee({
    indicador: "Domicílios por situação de segurança alimentar, Brasil e Grandes Regiões",
    natureza: "OBSERVADO",
    orgao: "IBGE",
    dataset: "PNAD Contínua Segurança Alimentar 2024",
    recurso: `Tabela na página ${g.manifest.source_page} da publicação (${pdf.file})`,
    url: pdf.url,
    unidade: "% dos domicílios particulares",
    frequencia: "Suplemento da PNAD Contínua; duas edições integradas.",
    inicio: "2023",
    fim: "2024",
    capturadoEm: g.manifest.captured_at,
    transformacoes: [g.manifest.review],
    limitacoes: ["EBIA mede experiência de restrição alimentar, não a entrega do serviço público.", "Não há estimativas municipais neste recorte.", "Categorias não são rescaladas para corrigir arredondamento."],
    snapshot: { id: pdf.file, sha256: pdf.sha256 },
  });
}

/**
 * O método da página: a ficha de cada medida mostrada (definição, universo, período, unidade, fórmula, estado do dado, ausências e
 * limitações, com a fonte e o arquivo da captura), a fonte da EBIA nas regiões quando a página a mostra, e o caminho para o método completo.
 */
export function MetodoAlimentar({ c, fichas, pnad = false, g, extra }: { c: Complementos; fichas: readonly string[]; pnad?: boolean; g?: PanoramaAlimentar; extra?: ReactNode }) {
  return (
    <>
      {pnad && (
        <div>
          <p className="font-medium text-carvao">EBIA no Brasil e nas Grandes Regiões</p>
          <p>Fonte: IBGE, PNAD Contínua Segurança Alimentar 2024, tabela na página 6. Domicílios particulares; Brasil e grandes regiões, 2023 e 2024. Percentuais publicados, com o arredondamento original.{g ? ` Captura: ${dataBr(g.manifest.captured_at)}.` : ""}</p>
        </div>
      )}
      {fichas.map((id) => {
        const f = fichaDe(c, id);
        const src = fonte(c, f.fonte_id);
        return (
          <div key={id}>
            <p className="font-medium text-carvao">{f.nome}</p>
            <p>
              {f.definicao} Universo: {f.universo} Período: {f.periodo}. Unidade: {f.unidade}. Fórmula: {f.formula} Estado do dado: {f.estado_do_dado} Ausências: {f.ausencias} Limitações: {f.limitacoes}
            </p>
            <p>
              Fonte: <a href={src.pagina} className={link}>{src.nome}</a>.
            </p>
          </div>
        );
      })}
      {extra}
      <p>
        Bases complementares capturadas em {dataBr(c.manifesto.capturado_em)}, com o hash de cada arquivo. Fichas completas, fontes com hash e o que não foi integrado, e por quê, em{" "}
        <Link href={METODOS} className={link}>
          Método e fontes
        </Link>
        ; os registros de cada município em{" "}
        <Link href="/eficiencia-estatal/seguranca-alimentar/dados" className={link}>
          Explorar dados
        </Link>
        .
      </p>
    </>
  );
}
