import type { Metadata } from "next";
import Link from "next/link";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { CabecalhoCombustiveis } from "@/components/combustiveis/CabecalhoCombustiveis";
import { PrecoNoEstado } from "@/components/combustiveis/PrecoNoEstado";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, mesExtenso } from "@/lib/gas/formato";
import { dadosDoEstado, dataNota, goldCombustiveis } from "@/lib/combustiveis/dados";
import { ROTA_COMBUSTIVEIS, paginaCombustiveis } from "@/lib/combustiveis/paginas";
import { leva2Aprovada, prefetchDoLink } from "@/lib/rotasPublicas";

export const dynamic = "force-static";

const pagina = paginaCombustiveis("no-meu-estado");

export const metadata: Metadata = {
  title: "Quanto custa encher o tanque no meu estado?",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/**
 * Consulta "Quanto custa encher o tanque no meu estado?" (leva 2 da estratégia "aberto e com conta", item
 * quanto-custa-encher-o-tanque de src/lib/rotasPublicas.ts). Modo de consulta: o preço médio do litro de cada combustível
 * na UF escolhida, no último mês, com fonte, data e a distância para a média do Brasil. Os dados do último mês vão no HTML
 * (nenhum arquivo é buscado no navegador). A série desde 2013, a comparação entre as UFs, o etanol em % da gasolina e os
 * downloads ficam no painel /combustiveis. Enquanto o dono não aprova, a rota é fechada como os painéis e a faixa de
 * consulta aberta não aparece.
 */
export default function ConsultaTanquePagina() {
  const aberta = leva2Aprovada("quanto-custa-encher-o-tanque");
  const g = goldCombustiveis();
  const lacuna = g.pesquisa.eventos.find((e) => e.tipo === "sem_pesquisa");
  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoCombustiveis atual="no-meu-estado" />
      {aberta && (
        <AvisoConsultaAberta
          className="ed-pagina"
          comConta="A série mensal desde 2013, a comparação entre os estados, o etanol em porcentagem da gasolina e os arquivos para baixar"
        />
      )}
      <main id="conteudo" className="ed-pagina pb-12">
        <div className="cab-modulo gas-abertura">
          <p className="rotulo text-gas-dark">Combustíveis · {pagina.rotulo}</p>
          <h1 className="ed-h1 mt-3 max-w-4xl font-serif text-carvao">{pagina.pergunta}</h1>
          <div className="ed-lead mt-4 max-w-prose2 text-carvao-muted">
            <p>Escolha o estado para ver o preço médio do litro de gasolina, etanol e diesel em {mesExtenso(g.ultimo_mes)}, comparado com a média do Brasil.</p>
          </div>
        </div>

        <section aria-label="Preço no seu estado" className="pb-8">
          <PrecoNoEstado dados={dadosDoEstado(g)} />
        </section>

        <section aria-label="Fonte e ressalvas" className="max-w-prose2 space-y-3 border-t border-linha py-6 text-sm leading-relaxed text-carvao">
          <p>
            Fonte: ANP, Levantamento de Preços de Combustíveis, série mensal por estado e Brasil, mês de referência {mesExtenso(g.ultimo_mes)}. Dados capturados
            em {carimbo(g.dados_capturados_em)}.
          </p>
          <p className="text-carvao-muted">
            São médias de uma amostra de postos pesquisados pela ANP no mês, não o preço de um posto. A média do Brasil é calculada pela própria ANP.
            {lacuna && <> A pesquisa teve lacuna de {dataNota(lacuna.inicio)} a {dataNota(lacuna.fim)}, registrada no painel.</>}
          </p>
          <p>
            <Link href={ROTA_COMBUSTIVEIS} prefetch={prefetchDoLink(ROTA_COMBUSTIVEIS)} className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>
              O painel completo: a série desde 2013, os estados lado a lado e os arquivos
              <SeloComConta href={ROTA_COMBUSTIVEIS} />
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
