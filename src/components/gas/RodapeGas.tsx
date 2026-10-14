import Link from "next/link";
import { goldGas } from "@/lib/gas/gold";
import { carimbo } from "@/lib/gas/formato";

/** Rodapé do domínio: órgãos das fontes, data da captura mais recente e caminhos para dados e método. */
export function RodapeGas() {
  const meta = goldGas.meta();
  const orgaos = Array.from(new Set(meta.fontes.map((f) => f.orgao)));
  const lista = orgaos.length > 1 ? `${orgaos.slice(0, -1).join(", ")} e ${orgaos.at(-1)}` : orgaos.join("");
  const link = "inline-flex min-h-[44px] items-center text-carvao underline-offset-4 hover:underline";
  return (
    <aside aria-label="Observatório Brasileiro de Gás Natural: fontes e método" className="border-t border-linha bg-papel">
      <div className="ed-pagina py-4">
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {meta.fontes.length} conjuntos de dados abertos de {lista}. Cada número traz fonte, período e natureza; as fórmulas, as validações e
          o sha256 de cada arquivo original estão em Dados e downloads.
        </p>
        {meta.dados_capturados_em && (
          <p className="py-1 text-xs text-mineral">Captura mais recente das fontes: {carimbo(meta.dados_capturados_em)}. Versão {meta.versao_pipeline}, {meta.versao_codigo}.</p>
        )}
        <ul className="flex flex-wrap gap-x-6 text-sm">
          <li><Link prefetch={false} href="/gas-natural" className={link}>Mapa do observatório</Link></li>
          <li><Link prefetch={false} href="/gas-natural/dados" className={link}>Dados e downloads</Link></li>
          <li><Link prefetch={false} href="/gas-natural/metodologia" className={link}>Método e glossário</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/geracao/termica" className={link}>Gás na geração de eletricidade (Setor Elétrico)</Link></li>
        </ul>
      </div>
    </aside>
  );
}
