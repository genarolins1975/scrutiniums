import type { Metadata } from "next";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { CabecalhoCombustiveis } from "@/components/combustiveis/CabecalhoCombustiveis";
import { PrecoNoEstado } from "@/components/combustiveis/PrecoNoEstado";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, mesExtenso } from "@/lib/gas/formato";
import { dadosDoEstado, dataNota, goldCombustiveis } from "@/lib/combustiveis/dados";
import { ROTA_COMBUSTIVEIS, paginaCombustiveis } from "@/lib/combustiveis/paginas";
import { leva2Aprovada } from "@/lib/rotasPublicas";
import { RotuloContexto } from "@/components/layout/RotuloContexto";

export const dynamic = "force-static";

const pagina = paginaCombustiveis("no-meu-estado");

export const metadata: Metadata = {
  title: "Quanto custa encher o tanque no meu estado?",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

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
  const dados = dadosDoEstado(g);
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
          <RotuloContexto rota={pagina.href} pagina={pagina.rotulo} className="text-gas-dark" />
          <h1 className="ed-h1 mt-3 max-w-4xl font-serif text-carvao">{pagina.pergunta}</h1>
          <div className="ed-lead mt-4 max-w-prose2 text-carvao-muted">
            <p>Escolha o estado para ver o preço médio do litro de gasolina, etanol e diesel em {mesExtenso(g.ultimo_mes)}, comparado com a média do Brasil.</p>
          </div>
        </div>

        <section aria-label="Preço no seu estado" className="pb-8">
          <PrecoNoEstado dados={dados} />
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
        </section>
        {/* princípio do aperitivo: a página aberta sempre mostra o que o painel com conta tem a mais */}
        <ConviteAperitivo
          rota={ROTA_COMBUSTIVEIS}
          comConta={[
            `O preço do litro mês a mês desde ${mesExtenso(g.primeiro_mes)}, em valores da época e corrigidos pela inflação`,
            `As ${dados.ufs.length} unidades da federação lado a lado, para comparar com a sua`,
            "Quanto o litro de etanol custa em relação ao de gasolina, em cada estado",
            "Como a ANP mede o preço, quantos postos entram na pesquisa a cada mês e onde ela tem lacunas",
            "O método, as notas da planilha e os arquivos para baixar",
          ]}
        />
      </main>
    </>
  );
}
