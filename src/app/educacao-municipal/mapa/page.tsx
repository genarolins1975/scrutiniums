import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { PaginaPainel, FiguraAnalitica } from "@/components/painel";
import { MapaEducacao } from "@/components/educacao/MapaEducacao";
import { goldEducacao, mapaEducacao } from "@/lib/educacao/dados";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import type { Proveniencia } from "@/lib/painel/tipos";
import { num } from "@/lib/educacao/formato";

export const dynamic = "force-static";
const ROTA = "/educacao-municipal/mapa";
export const metadata: Metadata = {title:tituloNaColecao("Mapa do Ideb municipal",ROTA),alternates:{canonical:ROTA}};
export default function PaginaMapaEducacao() {
  const g=goldEducacao(), mapa=mapaEducacao(), fonte=g.fontes.ideb, ano=String(g.ideb.ano);
  const p:Proveniencia={indicador:"Ideb da rede municipal",natureza:"OBSERVADO",fonte:{orgao:fonte.orgao,dataset:fonte.nome,recurso:"Planilhas municipais dos anos iniciais e finais",url_dataset:fonte.pagina,url_primaria:fonte.pagina,licenca:"Não informada na publicação consultada"},unidade:"Ideb, de 0 a 10",frequencia:"Bienal",periodo_referencia:{inicio:ano,fim:ano},publicado_pela_fonte_em:fonte.publicado_em,capturado_em:fonte.capturado_em,validado_em:g.capturado_em,cobertura_historica:{inicio:String(g.ideb.anos[0]),fim:ano},transformacoes:["Recorte da edição mais recente da rede municipal", "Classes fixas de meio ponto; ausência preservada"],formula:null,snapshot:{id:g.versao,sha256:g.hash_dados},versao_pipeline:g.versao,versao_codigo:null,revisoes_conhecidas:null,limitacoes:["O resultado não demonstra causa; municípios pequenos podem oscilar mais entre edições"],download:"/educacao/gold/mapa.json",notas_fonte:null};
  return <><header><CabecalhoPlataforma observatorio="servicos-publicos" destinoConta={ROTA} fontes={["educacao"]}/><NavegacaoColecao colecao="educacao"/></header>
    <main id="conteudo-educacao" className="edm-ficha"><PaginaPainel rota={ROTA} principal={false} idioma="pt"
      abertura={{grupo:"Educação",acento:"obee",titulo:"Onde estão os resultados das redes municipais?",lead:"Escolha a etapa e o estado. O mapa e a tabela mostram o Índice de Desenvolvimento da Educação Básica (Ideb), com os motivos de ausência preservados.",recorte:{periodo:ano,universo:`${num(g.municipios.total)} municípios, rede municipal`,unidade:"Ideb, de 0 a 10",fonte:fonte.orgao},limite:"causa ou qualidade da gestão a partir da posição de um município."}}
      figuras={<FiguraAnalitica id="mapa-ideb" idioma="pt" pergunta="Como o Ideb se distribui no território?" subtitulo={`Rede municipal · anos iniciais e finais · Ideb ${ano}, de 0 a 10`} natureza="OBSERVADO" proveniencia={p} tabela={{naFigura:"A tabela dos municípios acompanha o mapa, à direita em telas largas e abaixo no celular, com os mesmos filtros e valores."}} naoConcluir="O mapa mostra resultado, não causa; cidades pequenas podem oscilar mais entre edições." download={{href:"/educacao/gold/mapa.json",rotulo:"Baixar dados do mapa"}}><MapaEducacao dados={mapa}/></FiguraAnalitica>}
      metodo={<><p>O Ideb municipal vem das planilhas do Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP), edição {ano}. Cada cor corresponde a uma classe fixa de meio ponto. Ausência conserva o motivo publicado; não é convertida em zero.</p><p>A malha municipal é a já publicada na plataforma, do Instituto Brasileiro de Geografia e Estatística (IBGE). Selecionar um estado aproxima sua geometria e filtra a tabela. A divisão territorial e a série de cada cidade estão identificadas nas fichas.</p><p>As contagens de cobertura foram calculadas e validadas no pipeline. O carimbo de captura identifica a coleta original dos dados; a versão da publicação identifica as derivações.</p></>}/></main>
  </>;
}
