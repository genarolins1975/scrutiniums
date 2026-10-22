import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import PainelEstadual, { MetodoEstadual } from "@/components/contas-estaduais/PainelEstadual";
import { SeletorEstadoNaUrl } from "@/components/contas-estaduais/AberturaEstadual";
import PercursoOrcamentario from "@/components/contas-estaduais/PercursoOrcamentario";
import LaboratorioOrcamentario from "@/components/contas-estaduais/LaboratorioOrcamentario";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { lerFiltrosComparacao } from "@/lib/contas-estaduais/comparacao";
import { primarios, recorte } from "@/lib/contas-estaduais/dados";
import { escalaEstadual } from "@/lib/contas-estaduais/entrada";

/**
 * Entrada das Contas Estaduais no molde único (Iniciativa 4 do parecer de UX, 22/10/2026). O estado e o ano escolhidos vivem no
 * endereço (?uf=&ano=): a escala mostra os dois números desse recorte, as bandeiras ficam no "Para você", o painel dos estados
 * (comparação, ficha, provas, cobertura e catálogo) é a seção própria, e o laboratório do orçamento, antes dentro de um bloco
 * fechado, é o modelo didático.
 */
export default function Page({ searchParams }: { searchParams: { uf?: string; ano?: string; indicador?: string; regiao?: string; df?: string; ordem?: string } }) {
  const sel = recorte(searchParams.uf, searchParams.ano);
  return (
    <>
      <MarcaVisita secao="estados:ficha" />
      <EntradaColecao
        tipo="colecao"
        rota="/contas-publicas-estaduais"
        acento="obee"
        idPrincipal="conteudo-estados"
        titulo="Como estão as contas do seu estado?"
        frase="Compare o orçamento, o financiamento e a dívida dos governos estaduais. Escolha um território e acompanhe os recursos até as evidências de entrega."
        frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/contas-publicas-estaduais"]} conteiner="mx-auto max-w-page px-6" />}
        escala={escalaEstadual(sel.uf, sel.ano)}
        notaEscala={`Fonte: Tesouro / Siconfi, respostas originais conferidas, captura em ${primarios.captura.split("-").reverse().join("/")}. Liquidação é um estágio contábil; não atesta a qualidade da entrega.${sel.uf === "DF" ? " O DF reúne competências estaduais e municipais." : ""}`}
        paraVoce={
          <ParaVoce entrada="/contas-publicas-estaduais">
            <SeletorEstadoNaUrl uf={sel.uf} ano={sel.ano} />
          </ParaVoce>
        }
        secaoPropria={<PainelEstadual inicial={sel} comparacaoInicial={lerFiltrosComparacao(searchParams)} />}
        artefato={
          <ModeloDidatico
            id="laboratorio-orcamento"
            titulo="Gastar e entregar são medidas diferentes"
            descricao="Um programa tem orçamento de R$ 100 milhões e meta de 100 unidades de serviço. Mova os controles e compare as duas medidas. Exemplo didático, sem dados de governos."
            deixaDeFora={[
              "Programas e estados reais: a meta é didática e não representa nenhum governo",
              "A defasagem entre a despesa e a entrega, e a diferença de qualidade entre as entregas",
              "A efetividade: o exercício não mede os resultados para a população",
            ]}
          >
            <LaboratorioOrcamentario embutido />
          </ModeloDidatico>
        }
        recolhidos={
          <Recolhido id="leitura-gestao" titulo="Entender o caminho do orçamento à entrega" resumo="Planejar, executar e entregar, e as cinco perguntas diferentes da gestão pública.">
            <div className="ce-main" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <PercursoOrcamentario />
              <section className="ce-dimensions" aria-label="Como ler a gestão pública">
                <h2>São perguntas diferentes.</h2>
                <div>
                  {[["Economicidade", "Quanto se paga por um objeto equivalente?"], ["Eficiência", "Que recursos são usados por entrega, com qualidade comparável?"], ["Eficácia", "As metas físicas foram cumpridas no prazo?"], ["Efetividade", "Que resultados mudaram para a população?"], ["Sustentabilidade", "Os compromissos podem ser mantidos ao longo do tempo?"]].map(([t, d]) => (
                    <div key={t}>
                      <h3>{t}</h3>
                      <p>{d}</p>
                    </div>
                  ))}
                </div>
                <p className="ce-note">Equidade e qualidade dos dados atravessam todas as dimensões. Executar o orçamento, sozinho, não demonstra eficiência.</p>
              </section>
            </div>
          </Recolhido>
        }
        metodo={<MetodoEstadual />}
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/contas-publicas-estaduais"]} variante="metodo" />}
      />
    </>
  );
}
