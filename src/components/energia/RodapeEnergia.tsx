import Link from "@/components/i18n/LinkIdioma";
import { gold } from "@/lib/energia/gold";
import { carimbo, num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { listaPorExtenso } from "@/lib/energia/navegacao";
import { listaEmPortugues, orgaosDasFontes } from "@/lib/energia/dados";
import { publicacaoDados } from "@/lib/energia/dados-servidor";
import { catalogoDados } from "@/lib/energia/datasets";
import { conciliarCatalogoEIntegracoes, textoRodapeDasFontes } from "@/lib/energia/dados-leitor";
import { RodapeColecao } from "@/components/layout/RodapeColecao";

/**
 * Rodapé do domínio: os órgãos das fontes, a data da última publicação e o caminho para
 * o catálogo e a metodologia. Os órgãos e a data vêm de publicacao.json (a mesma fonte que o
 * cabeçalho das páginas de dados); o meta.json é de um processamento completo anterior e
 * só entra quando a publicação não existe. Monta-se sobre o rodapé da coleção (RodapeColecao, Iniciativa 2 do parecer de UX de
 * 21/10/2026): a entrada, os dados, o método e a marca da parceria técnica com o FGV CERI vêm dele, como no Gás, no Saneamento e
 * nos Combustíveis; aqui ficam as fontes, a data da publicação e os caminhos próprios do Setor Elétrico (modelos e previsões
 * do PLD, Aprenda). O rodapé institucional da plataforma vem depois.
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
  return (
    <RodapeColecao
      colecao="setor-eletrico"
      extras={[
        { rotulo: tx("Registro de modelos do PLD", "PLD model register"), href: "/setor-eletrico/pld/modelos" },
        { rotulo: tx("Histórico de previsões", "Forecast history"), href: "/setor-eletrico/pld/previsoes" },
        { rotulo: tx("Aprenda: base de conhecimento", "Learn: knowledge base"), href: "/setor-eletrico/aprenda" },
      ]}
    >
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
    </RodapeColecao>
  );
}
