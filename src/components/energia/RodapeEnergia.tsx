import Link from "@/components/i18n/LinkIdioma";
import { gold } from "@/lib/energia/gold";
import { carimbo, num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { listaPorExtenso } from "@/lib/energia/navegacao";
import { listaEmPortugues, orgaosDasFontes } from "@/lib/energia/dados";
import { publicacaoDados } from "@/lib/energia/dados-servidor";
import { catalogoDados } from "@/lib/energia/datasets";
import { conciliarCatalogoEIntegracoes, textoRodapeDasFontes } from "@/lib/energia/dados-leitor";

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
  const cat = catalogoDados();
  // o rodapé conta integrações (uso de um conjunto por um módulo), como a página Saúde; o catálogo conta conjuntos
  const conc = pub && cat && orgaos.length > 0 ? conciliarCatalogoEIntegracoes(cat, pub) : null;
  const siglas = orgaos.map((o) => o.orgao);
  const textos = conc
    ? tx(textoRodapeDasFontes(conc, siglas), {
        resumo: `${num(conc.orgaosComIntegracao, 0)} ${conc.orgaosComIntegracao === 1 ? "agency" : "agencies"}, ${num(conc.integracoes, 0)} ${conc.integracoes === 1 ? "integration" : "integrations"}`,
        detalhe: `Open data from ${listaPorExtenso(siglas)}, in ${num(conc.integracoes, 0)} dataset integrations (${num(conc.conjuntosComIntegracao, 0)} of the ${num(conc.conjuntos, 0)} datasets in the catalog). The catalog covers ${num(conc.orgaos, 0)} agencies.`,
      })
    : null;
  const resumo = textos
    ? textos.resumo
    : orgaos.length > 0
      ? tx(`${orgaos.length} órgãos, ${pub!.conjuntos.length} integrações`, `${orgaos.length} agencies, ${pub!.conjuntos.length} integrations`)
      : tx("CCEE, ONS e ANEEL", "CCEE, ONS and ANEEL");
  const link = "inline-flex min-h-[44px] items-center text-carvao underline-offset-4 hover:underline";
  return (
    <aside aria-label={tx("Observatório Brasileiro do Setor Elétrico: mapa e fontes", "Brazilian power sector observatory: map and sources")} className="border-t border-linha bg-papel">
      <div className="ed-pagina py-4">
        <details className="border-b border-linha pb-1">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <span className="rotulo text-mineral">{tx("Fontes deste observatório", "Sources for this observatory")}</span>
            <span className="text-xs text-carvao-muted">
              {resumo} <span aria-hidden="true">▾</span>
            </span>
          </summary>
          <div className="pb-3 pt-1">
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              {textos ? `${textos.detalhe} ` : orgaos.length > 0
                ? tx(
                    `Dados abertos de ${listaEmPortugues(siglas)}, em ${pub!.conjuntos.length} integrações de conjuntos. `,
                    `Open data from ${listaPorExtenso(siglas)}, in ${pub!.conjuntos.length} dataset integrations. `,
                  )
                : tx("Dados abertos da CCEE, do ONS e da ANEEL. ", "Open data from CCEE, ONS and ANEEL. ")}
              {tx(
                <>
                  Licença, frequência e estado de cada conjunto estão no catálogo; cada número tem natureza, fonte, período e
                  limitações no painel &quot;Sobre este dado&quot;.
                </>,
                <>
                  License, frequency and status of each dataset are in the catalog; every number has its data type, source, period and
                  limitations in the &quot;About this data&quot; panel.
                </>,
              )}
            </p>
          </div>
        </details>
        {meta && (
          <p className="max-w-prose2 py-1 text-xs leading-relaxed text-mineral">
            {pub ? tx("Catálogo e saúde processados em ", "Catalog and health processed on ") : tx("Dados processados em ", "Data processed on ")}
            {carimbo(meta.gerado_em)}
            {tx(
              ". Cada painel traz a data de referência dos próprios dados. A versão técnica da publicação está em ",
              ". Each panel shows the reference date of its own data. The technical version of the release is in ",
            )}
            <Link href="/setor-eletrico/dados/reproducao" className="underline underline-offset-4">
              {tx("Download e reprodução", "Download and reproduction")}
            </Link>
            .
          </p>
        )}
        <ul className="flex flex-wrap gap-x-6 text-sm">
          <li><Link prefetch={false} href="/setor-eletrico" className={link}>{tx("Mapa do Observatório: por onde começar", "Observatory map: where to start")}</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/dados" className={link}>{tx("Catálogo de dados e downloads", "Data catalog and downloads")}</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/metodologia" className={link}>{tx("Metodologia e regras publicadas", "Methodology and published rules")}</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/pld/modelos" className={link}>{tx("Registro de modelos do PLD", "PLD model register")}</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/pld/previsoes" className={link}>{tx("Histórico de previsões", "Forecast history")}</Link></li>
          <li><Link prefetch={false} href="/setor-eletrico/aprenda" className={link}>{tx("Aprenda: base de conhecimento", "Learn: knowledge base")}</Link></li>
        </ul>
      </div>
    </aside>
  );
}
