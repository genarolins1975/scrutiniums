import type {Metadata} from 'next';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PaginaPainel} from '@/components/painel';
import {FaixaRecursos,FiguraRecursos,MetodoRecursos,ProvedorRecursos,TabelasRecursos,type Dados} from '@/components/eficiencia/trabalho-renda/RecursosTrabalho';
export const metadata:Metadata={title:'Recursos públicos para o trabalho'};

const ROTA='/eficiencia-estatal/trabalho-renda/recursos';

/**
 * Recursos públicos para o trabalho no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a abertura sai daqui, no servidor,
 * com o perímetro e os anos lidos da base; a faixa, os controles, a distribuição das capitais, as tabelas e o método seguem o recorte da
 * URL nas ilhas de RecursosTrabalho, que leem a base pelo provedor (uma vez só no HTML). Sem a base, nenhum valor é substituído por zero.
 */
export default async function Pagina(){
  let dados:Dados;
  try{dados=JSON.parse(await readFile(path.join(process.cwd(),'public/eficiencia/trabalho-renda/recursos.json'),'utf8')) as Dados}catch{return <section className="tr-empty"><h1>Recursos indisponíveis nesta publicação</h1><p>Nenhum valor é substituído por zero.</p></section>}
  return <ProvedorRecursos dados={dados}><PaginaPainel
    rota={ROTA}
    principal={false}
    idioma="pt"
    abertura={{
      grupo:'Trabalho e renda',
      acento:'obee',
      titulo:'Quanto as capitais declaram na função Trabalho?',
      lead:'Despesa liquidada pelas prefeituras, com conferência entre declarações, evolução e composição. O perímetro municipal é apresentado separadamente dos resultados do mercado de trabalho.',
      recorte:{periodo:`${dados.periodos[0]} a ${dados.periodos.at(-1)}`,universo:`${dados.territorios.length} capitais estaduais, função 11 Trabalho`,unidade:'R$ nominais ou reais de 2025',fonte:'Tesouro Nacional, Siconfi'},
      limite:'o custo por atendimento ou por colocação no emprego, nem toda a política de trabalho no território: execução federal, estadual e ações de outras funções ficam fora.',
      fontesDatasSiglas:<>
        <p>Tesouro Nacional, Siconfi: Declaração de Contas Anuais (DCA), Anexo I-E, e Relatório Resumido da Execução Orçamentária (RREO), Anexo 02, sexto bimestre. {dados.universo}</p>
        <p><span className="font-medium">DCA:</span> Declaração de Contas Anuais. <span className="font-medium">RREO:</span> Relatório Resumido da Execução Orçamentária. <span className="font-medium">IPCA:</span> Índice Nacional de Preços ao Consumidor Amplo.</p>
      </>,
    }}
    faixaNumeros={<FaixaRecursos/>}
    figuras={<FiguraRecursos rota={ROTA}/>}
    tabelas={<TabelasRecursos/>}
    metodo={<MetodoRecursos/>}
  /></ProvedorRecursos>;
}
