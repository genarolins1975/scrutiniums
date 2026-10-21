import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, NotaGas, ProximasPerguntas, SecaoGas } from "@/components/gas/Blocos";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("regulacao");

export const metadata: Metadata = {
  title: "Regulação do gás natural",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const COMPETENCIAS: { quem: string; papel: string }[] = [
  { quem: "União", papel: "Detém o monopólio de pesquisa, lavra, importação, exportação e transporte de gás por conduto (Constituição, art. 177). Desde a Emenda Constitucional 9/1995 pode contratar empresas privadas para essas atividades." },
  { quem: "CNPE e Ministério de Minas e Energia", papel: "Definem a política energética: diretrizes para o mercado de gás, para o planejamento da infraestrutura e para a transição entre modelos." },
  { quem: "ANP", papel: "Regula e fiscaliza a indústria do gás no âmbito federal: autoriza transporte, estocagem, processamento, importação e comercialização, registra contratos e publica os dados usados neste observatório." },
  { quem: "Estados", papel: "Exploram diretamente, ou por concessão, os serviços locais de gás canalizado (Constituição, art. 25, §2º). Cada estado regula a sua distribuidora, a tarifa e as condições do consumidor livre." },
  { quem: "CADE", papel: "Defende a concorrência: analisa concentrações e condutas, inclusive acordos que tratam da venda de ativos e do acesso à infraestrutura de gás." },
];

type Marco = { data: string; ato: string; texto: string; url: string; situacao?: string };

const MARCOS: Marco[] = [
  { data: "15/08/1995", ato: "Emenda Constitucional 5", texto: "Dá aos estados a exploração dos serviços locais de gás canalizado, diretamente ou por concessão.", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc05.htm" },
  { data: "09/11/1995", ato: "Emenda Constitucional 9", texto: "Permite à União contratar com empresas estatais ou privadas as atividades do monopólio do petróleo e do gás natural.", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc09.htm" },
  { data: "06/08/1997", ato: "Lei 9.478 (Lei do Petróleo)", texto: "Cria o CNPE e a ANP e organiza as atividades do petróleo e do gás natural.", url: "https://www.planalto.gov.br/ccivil_03/leis/l9478.htm" },
  { data: "04/03/2009", ato: "Lei 11.909 (primeira Lei do Gás)", texto: "Estabelece regras para o transporte de gás natural por concessão.", url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l11909.htm", situacao: "Revogada pela Lei 14.134/2021" },
  { data: "24/06/2019", ato: "Resolução CNPE 16 (Novo Mercado de Gás)", texto: "Fixa diretrizes para a transição a um mercado de gás com mais concorrência.", url: "https://www.gov.br/mme/pt-br/assuntos/conselhos-e-comites/cnpe/resolucoes-do-cnpe/arquivos/2019/ResoluoCNPEn162019.pdf", situacao: "Revogada pela Resolução CNPE 3/2022" },
  { data: "08/04/2021", ato: "Lei 14.134 (nova Lei do Gás)", texto: "Troca a concessão pela autorização no transporte, separa transporte de outras atividades e assegura a terceiros o acesso a gasodutos, terminais e unidades de processamento.", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14134.htm" },
  { data: "02/06/2021", ato: "Decreto 10.712", texto: "Regulamenta a Lei 14.134/2021.", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/decreto/D10712.htm" },
  { data: "26/08/2024", ato: "Decreto 12.153 (Gás para Empregar)", texto: "Altera o Decreto 10.712/2021, entre outros pontos para harmonizar a regulação federal, distrital e estadual e para aplicar regras de acesso ao escoamento e ao processamento.", url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/decreto/d12153.htm" },
];

export default function RegulacaoPage() {
  return (
    <>
      <MarcaVisita secao="gas:regulacao" />
      <CabecalhoGas atual="regulacao" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina}>
          <p>
            A indústria do gás natural tem duas camadas de regras. Da produção ao transporte, vale a regulação federal, a cargo da ANP. Da entrega à distribuidora
            até o consumidor final, valem as regras de cada estado, que concede a distribuição de gás canalizado e aprova as tarifas.
          </p>
          <p>Esta página descreve competências e atos com o link para o texto oficial. Não traz número nem avaliação de política.</p>
        </AberturaGas>

        <SecaoGas id="quem" titulo="Quem faz o quê">
          <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {COMPETENCIAS.map((c) => (
              <div key={c.quem} className="border-t border-linha pt-3">
                <dt className="font-serif text-lg text-carvao">{c.quem}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.papel}</dd>
              </div>
            ))}
          </dl>
        </SecaoGas>

        <SecaoGas id="marcos" titulo="Os marcos legais, em ordem" subtitulo="Data de assinatura do ato. O link abre o texto no portal oficial.">
          <ol className="space-y-0">
            {MARCOS.map((m) => (
              <li key={m.ato} className="grid gap-1 border-t border-linha py-4 sm:grid-cols-[8rem_1fr] sm:gap-6">
                <p className="text-sm text-mineral [font-variant-numeric:tabular-nums]">{m.data}</p>
                <div>
                  <p className="font-serif text-lg leading-snug text-carvao">
                    <a href={m.url} rel="noopener noreferrer" className="underline decoration-linha underline-offset-4 hover:decoration-gas">{m.ato}</a>
                  </p>
                  <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{m.texto}</p>
                  {m.situacao && <p className="mt-1 text-xs text-mineral">{m.situacao}.</p>}
                </div>
              </li>
            ))}
          </ol>
        </SecaoGas>

        <SecaoGas id="lacunas" titulo="O que esta página ainda não mostra">
          <NotaGas titulo="Sem base estruturada nacional">
            <p>
              O limite de consumo para ser consumidor livre, o modelo tarifário e o prazo de cada concessão de distribuição são definidos estado a estado, em leis,
              resoluções e contratos. Não há conjunto nacional em dados abertos com essas regras; elas entram no observatório quando puderem ser lidas de fonte
              estruturada, com data e link para cada ato.
            </p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/mercado", pergunta: "Mais empresas estão comprando e vendendo gás?", motivo: "O uso da malha de transporte depois da Lei 14.134/2021." },
            { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "O preço declarado à ANP por região e por mercado." },
            { href: "/gas-natural/gnv-e-gas-encanado", pergunta: "Quanto custa o GNV e como varia o gás encanado?", motivo: "O GNV por UF e a inflação do gás encanado." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
