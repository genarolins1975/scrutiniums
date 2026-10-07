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
  return (
    <aside aria-label="Observatório Brasileiro do Setor Elétrico: mapa e fontes" className="border-t border-linha bg-papel">
      <div className="mx-auto grid max-w-page gap-8 px-6 py-10 md:grid-cols-3">
        <div className="md:col-span-2">
          <p className="rotulo text-mineral">Fontes deste observatório</p>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {orgaos.length > 0
              ? `Dados abertos de ${listaEmPortugues(orgaos.map((o) => o.orgao))}, em ${pub!.conjuntos.length} conjuntos integrados. `
              : "Dados abertos da CCEE, do ONS e da ANEEL. "}
            Licença, frequência e estado de cada conjunto estão no catálogo; cada número tem natureza, fonte, período e
            limitações no painel &quot;Sobre este dado&quot;.
          </p>
          {meta && (
            <p className="mt-3 text-xs text-mineral">
              {pub ? "Catálogo e manifesto publicados em " : "Dados processados em "}
              {carimbo(meta.gerado_em)} · versão do processamento {meta.versao_pipeline}
              {meta.versao_codigo ? ` · código ${meta.versao_codigo}` : ""}. Cada painel traz a data de referência dos próprios dados.
            </p>
          )}
        </div>
        <ul className="space-y-2 text-sm">
          <li><Link href="/setor-eletrico" className="text-carvao underline-offset-4 hover:underline">Mapa do Observatório: por onde começar</Link></li>
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
