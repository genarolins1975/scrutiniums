import Link from "next/link";
import { gold } from "@/lib/energia/gold";
import { carimbo } from "@/lib/energia/formato";
import { listaEmPortugues, orgaosDasFontes } from "@/lib/energia/dados";
import { publicacaoDados } from "@/lib/energia/dados-servidor";

/**
 * Rodapé do domínio: os órgãos das fontes, a data da última publicação e o caminho para
 * o catálogo e a metodologia. Os órgãos e a data vêm de publicacao.json (a mesma fonte que o
 * cabeçalho das páginas de dados); o meta.json é de um processamento completo anterior e
 * só entra quando a publicação não existe. O rodapé institucional da plataforma vem depois.
 */
export function RodapeEnergia() {
  const pub = publicacaoDados();
  const meta = pub ?? gold.meta();
  const orgaos = orgaosDasFontes(pub);
  const resumo = orgaos.length > 0 ? `${orgaos.length} órgãos, ${pub!.conjuntos.length} conjuntos` : "CCEE, ONS e ANEEL";
  const link = "inline-flex min-h-[44px] items-center text-carvao underline-offset-4 hover:underline";
  return (
    <aside aria-label="Observatório Brasileiro do Setor Elétrico: mapa e fontes" className="border-t border-linha bg-papel">
      <div className="mx-auto max-w-page px-6 py-4">
        <details className="border-b border-linha pb-1">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <span className="rotulo text-mineral">Fontes deste observatório</span>
            <span className="text-xs text-carvao-muted">
              {resumo} <span aria-hidden="true">▾</span>
            </span>
          </summary>
          <div className="pb-3 pt-1">
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              {orgaos.length > 0
                ? `Dados abertos de ${listaEmPortugues(orgaos.map((o) => o.orgao))}, em ${pub!.conjuntos.length} integrações de conjuntos. `
                : "Dados abertos da CCEE, do ONS e da ANEEL. "}
              Licença, frequência e estado de cada conjunto estão no catálogo; cada número tem natureza, fonte, período e
              limitações no painel &quot;Sobre este dado&quot;.
            </p>
          </div>
        </details>
        {meta && (
          <p className="max-w-prose2 py-1 text-xs leading-relaxed text-mineral">
            {pub ? "Catálogo e manifesto publicados em " : "Dados processados em "}
            {carimbo(meta.gerado_em)}. Cada painel traz a data de referência dos próprios dados. A versão técnica da publicação está em{" "}
            <Link href="/setor-eletrico/dados/reproducao" className="underline underline-offset-4">
              Download e reprodução
            </Link>
            .
          </p>
        )}
        <ul className="flex flex-wrap gap-x-6 text-sm">
          <li><Link prefetch={false} href="/setor-eletrico" className={link}>Mapa do Observatório: por onde começar</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/dados" className={link}>Catálogo de dados e downloads</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/metodologia" className={link}>Metodologia e regras publicadas</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/pld/modelos" className={link}>Registro de modelos do PLD</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/pld/previsoes" className={link}>Histórico de previsões</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/aprenda" className={link}>Aprenda: base de conhecimento</Link></li>
        </ul>
      </div>
    </aside>
  );
}
