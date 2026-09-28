import Link from "next/link";
import { gold } from "@/lib/energia/gold";
import { carimbo } from "@/lib/energia/formato";

/**
 * Rodapé do domínio: fontes com licença, data de processamento e o caminho para
 * o catálogo e a metodologia. O rodapé institucional da plataforma vem depois.
 */
export function RodapeEnergia() {
  const meta = gold.meta();
  return (
    <aside aria-label="Observatório Brasileiro do Setor Elétrico: mapa e fontes" className="border-t border-linha bg-papel">
      <div className="mx-auto grid max-w-page gap-8 px-6 py-10 md:grid-cols-3">
        <div className="md:col-span-2">
          <p className="rotulo text-mineral">Fontes deste observatório</p>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Dados abertos da CCEE (PLD horário, licença CC-BY-4.0), do ONS (EAR, ENA, carga, balanço de energia,
            intercâmbios e CMO, licença Creative Commons Atribuição) e metadados dos portais do ONS e da ANEEL. Cada
            número tem natureza, fonte, período e limitações no painel &quot;Sobre este dado&quot;.
          </p>
          {meta && (
            <p className="mt-3 text-xs text-mineral">
              Dados processados em {carimbo(meta.gerado_em)} · versão do processamento {meta.versao_pipeline}
              {meta.versao_codigo ? ` · código ${meta.versao_codigo}` : ""}
            </p>
          )}
        </div>
        <ul className="space-y-2 text-sm">
          <li><Link href="/setor-eletrico/dados" className="text-carvao underline-offset-4 hover:underline">Catálogo de dados e downloads</Link></li>
          <li><Link href="/setor-eletrico/metodologia" className="text-carvao underline-offset-4 hover:underline">Metodologia e regras publicadas</Link></li>
          <li><Link href="/setor-eletrico/pld/modelos" className="text-carvao underline-offset-4 hover:underline">Registro de modelos do PLD</Link></li>
          <li><Link href="/setor-eletrico/pld/previsoes" className="text-carvao underline-offset-4 hover:underline">Histórico de previsões</Link></li>
          <li><Link href="/setor-eletrico/aprenda" className="text-carvao underline-offset-4 hover:underline">Aprenda: base de conhecimento</Link></li>
        </ul>
      </div>
    </aside>
  );
}
