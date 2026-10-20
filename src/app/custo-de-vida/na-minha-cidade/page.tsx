import type { Metadata } from "next";
import Link from "next/link";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { CabecalhoCustoDeVida } from "@/components/inflacao/CabecalhoCustoDeVida";
import { InflacaoNaArea } from "@/components/inflacao/InflacaoNaArea";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldInflacao, primeiraTela } from "@/lib/inflacao/dados";
import { dataBr, mesExtenso } from "@/lib/inflacao/formato";
import { ROTA_INFLACAO, paginaInflacao } from "@/lib/inflacao/paginas";
import { leva2Aprovada, prefetchDoLink } from "@/lib/rotasPublicas";

export const dynamic = "force-static";

const pagina = paginaInflacao("na-minha-cidade");

export const metadata: Metadata = {
  title: "Quanto subiu o custo de vida na minha cidade?",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/**
 * Consulta "Quanto subiu o custo de vida na minha cidade?" (leva 2 da estratégia "aberto e com conta", item
 * quanto-subiu-o-custo-de-vida de src/lib/rotasPublicas.ts). Modo de consulta: só o último mês da área escolhida, com a
 * inflação em 12 meses do índice geral e dos nove grupos ao lado da do Brasil, fonte e data. O último mês das 16 áreas vai
 * no HTML, montado no servidor a partir de public/inflacao/gold/ipca.json; nenhum arquivo é buscado no navegador. A série
 * desde 2020, a comparação entre as 16 áreas, os produtos e serviços que mais subiram, o artefato dos pesos e os downloads
 * ficam no painel /custo-de-vida. Enquanto o dono não aprova, a rota é fechada como os painéis e a faixa não aparece.
 */
export default function ConsultaCustoDeVidaPagina() {
  const aberta = leva2Aprovada("quanto-subiu-o-custo-de-vida");
  const g = goldInflacao();
  const proxima = g.fonte.proxima_divulgacao;
  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoCustoDeVida atual="na-minha-cidade" />
      {aberta && (
        <AvisoConsultaAberta
          className="ed-pagina"
          comConta="A série mês a mês desde 2020, as 16 áreas lado a lado, os produtos e serviços que mais subiram, a conta dos pesos de cada grupo e os arquivos para baixar"
        />
      )}
      <main id="conteudo" className="ed-pagina pb-12">
        <div className="cab-modulo familias-abertura">
          <p className="rotulo text-bronze-dark">Custo de vida · {pagina.rotulo}</p>
          <h1 className="ed-h1 mt-3 max-w-4xl font-serif text-carvao">{pagina.pergunta}</h1>
          <div className="ed-lead mt-4 max-w-prose2 text-carvao-muted">
            <p>
              Escolha a sua cidade ou região para ver a inflação oficial, o IPCA do IBGE, nos 12 meses até {mesExtenso(g.ultimo_mes)}: no índice geral e nos
              nove grupos de despesa, ao lado da do Brasil.
            </p>
          </div>
        </div>

        <section aria-label="Inflação na sua cidade" className="pb-8">
          <InflacaoNaArea dados={primeiraTela(g)} />
        </section>

        <section aria-label="Fonte e ressalvas" className="max-w-prose2 space-y-3 border-t border-linha py-6 text-sm leading-relaxed text-carvao">
          <p>
            Fonte: IBGE, Índice Nacional de Preços ao Consumidor Amplo (IPCA), tabela {g.fonte.tabela} do SIDRA, mês de referência {mesExtenso(g.ultimo_mes)},
            divulgado em {dataBr(g.fonte.divulgado_em)}. Dados capturados em {dataBr(g.capturado_em)}.
            {proxima && <> Próxima divulgação do IBGE: {dataBr(proxima.data)}, com {mesExtenso(proxima.referencia)}.</>}
          </p>
          <p className="text-carvao-muted">
            O IPCA mede a variação dos preços da cesta das famílias com renda de 1 a 40 salários mínimos nas 16 áreas pesquisadas, com o peso de cada despesa
            no orçamento médio dessas famílias. Não é o custo de vida de uma família específica: quem gasta mais com aluguel, escola ou transporte sente uma
            inflação diferente. Inflação é variação de preço, não nível de preço: uma área com inflação menor pode ter preços mais altos que outra.
          </p>
          <p>
            <Link href={ROTA_INFLACAO} prefetch={prefetchDoLink(ROTA_INFLACAO)} className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>
              O painel completo: a série desde 2020, as 16 áreas lado a lado, os produtos e serviços que mais subiram e os arquivos
              <SeloComConta href={ROTA_INFLACAO} />
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
