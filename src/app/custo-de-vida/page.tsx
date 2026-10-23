import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { InflacaoNaArea } from "@/components/inflacao/InflacaoNaArea";
import { ComoPesa } from "@/components/inflacao/ComoPesa";
import { ComparacaoAreas, Destaques, SerieArea } from "@/components/inflacao/Graficos";
import { DownloadsInflacao, FonteIpca, NotaInflacao, ProximasInflacao, SecaoInflacao } from "@/components/inflacao/Blocos";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { artefato, destaques, goldInflacao, primeiraTela, referencia, series } from "@/lib/inflacao/dados";
import { dataBr, mesAno, mesExtenso, pct, pp } from "@/lib/inflacao/formato";
import { ROTA_COMIDA, paginaInflacao } from "@/lib/inflacao/paginas";
import { BRASIL } from "@/lib/inflacao/tipos";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { destinosDaColecao } from "@/components/observatorios/DestinosDaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

const pagina = paginaInflacao("painel");

export const metadata: Metadata = {
  title: tituloNaColecao("Quanto subiu o custo de vida na minha cidade?", "/custo-de-vida"),
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/**
 * Painel "Inflação por cidade" (Observatório das Famílias, coleção Custo de vida), com conta. Arquétipo panorama com
 * consulta: a pergunta e a inflação da área do leitor na primeira tela; o artefato do mecanismo (como os pesos do IPCA
 * formam a inflação); a série desde 2020; as 16 áreas lado a lado; os produtos e serviços que mais subiram e caíram; método,
 * fontes, notas e downloads recolhidos no fim. Todos os números saem de public/inflacao/gold/ipca.json (pipeline/inflacao).
 */
export default function InflacaoPage() {
  const g = goldInflacao();
  const tela = primeiraTela(g);
  const ref = referencia(g);
  const nomes = g.areas;
  const mes = mesExtenso(g.ultimo_mes);
  const janela = `${mesAno(g.inicio_janela)} a ${mesAno(g.ultimo_mes)}`;
  const br = g.ultimo[BRASIL];
  const proxima = g.fonte.proxima_divulgacao;
  const ordenadas = g.areas.filter((a) => a.id !== BRASIL).sort((x, y) => g.ultimo[y.id].geral.doze - g.ultimo[x.id].geral.doze || x.nome.localeCompare(y.nome, "pt-BR"));
  const maior = ordenadas[0];
  const menor = ordenadas[ordenadas.length - 1];
  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <header>
        <CabecalhoPlataforma observatorio="familias" destinoConta="/custo-de-vida" fontes={["inflacao"]} />
        <NavegacaoColecao colecao="custo-de-vida" />
      </header>
      <EntradaColecao
        tipo="colecao"
        rota={pagina.href}
        acento="bronze"
        titulo={pagina.pergunta}
        frase="A inflação oficial, o IPCA do IBGE, nas 16 áreas onde o IBGE pesquisa preços e no Brasil: índice geral e nove grupos de despesa, com o peso de cada grupo, mês a mês desde janeiro de 2020."
        frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/custo-de-vida"]} conteiner="mx-auto max-w-page px-6" />}
        escala={[
          { rotulo: "IPCA do Brasil em 12 meses", valor: pct(br.geral.doze), unidade: "índice geral", periodo: `12 meses até ${mes}`, fonte: `IBGE, IPCA, tabela ${g.fonte.tabela}`, href: "#serie" },
          { rotulo: "IPCA do Brasil no mês", valor: pct(br.geral.mensal), unidade: "índice geral", periodo: mes, fonte: `IBGE, IPCA, tabela ${g.fonte.tabela}`, href: "#serie" },
          { rotulo: `Maior variação em 12 meses: ${maior.nome}`, valor: pct(g.ultimo[maior.id].geral.doze), unidade: "índice geral", periodo: `12 meses até ${mes}`, fonte: `IBGE, IPCA, tabela ${g.fonte.tabela}`, href: "#areas" },
          { rotulo: `Menor variação em 12 meses: ${menor.nome}`, valor: pct(g.ultimo[menor.id].geral.doze), unidade: "índice geral", periodo: `12 meses até ${mes}`, fonte: `IBGE, IPCA, tabela ${g.fonte.tabela}`, href: "#areas" },
        ]}
        paraVoce={
          <ParaVoce entrada="/custo-de-vida">
            <section aria-label="Inflação na sua cidade">
              <InflacaoNaArea dados={tela} />
            </section>
          </ParaVoce>
        }
        destinos={destinosDaColecao("custo-de-vida")}
        artefato={
          <ModeloDidatico
            recolhido
            id="como-pesa"
            titulo="Como o IPCA pesa o seu orçamento"
            descricao={<>A fatia de cada grupo no orçamento das famílias da pesquisa e quanto cada um contribuiu, em pontos percentuais, para a inflação de 12 meses até {mes}.</>}
            deixaDeFora={[
              "O orçamento de uma família específica: o peso é o do orçamento médio das famílias da pesquisa",
              "A mudança dos pesos ao longo da janela: a contribuição usa o peso do primeiro mês",
              "O INPC, das famílias com renda de 1 a 5 salários mínimos, com outros pesos",
            ]}
          >
            <ComoPesa grupos={g.grupos} areas={artefato(g)} nomes={nomes} referencia={ref} />
            <FonteIpca g={g} extra="Contribuição calculada pela Scrutiniums: peso do grupo no primeiro mês da janela × variação do grupo em 12 meses ÷ 100." />
          </ModeloDidatico>
        }
        caminhos={[
          { pergunta: "Como a inflação mudou desde 2020?", resumo: "O IPCA em 12 meses ou no mês, na área escolhida e no Brasil.", href: "#serie" },
          {
            pergunta: "Como as 16 áreas se comparam?",
            resumo: "A variação em 12 meses de cada área, no índice geral e nos nove grupos, com a diferença para o Brasil.",
            href: "#areas",
            numero: { rotulo: `Diferença de ${maior.nome} para o Brasil`, valor: pp(g.ultimo[maior.id].geral.dif_brasil_pp, 2, true), unidade: "em 12 meses", periodo: mes, fonte: `IBGE, IPCA, tabela ${g.fonte.tabela}`, href: "#areas" },
          },
          { pergunta: "Que produtos e serviços mais subiram e caíram?", resumo: "Os subitens do IPCA, com o peso no orçamento e a contribuição para a inflação.", href: "#itens" },
          { pergunta: "Por que a comida subiu?", resumo: "A inflação dos alimentos item por item, a cesta e a segurança alimentar, no painel Comida no prato.", href: ROTA_COMIDA },
        ]}
        recolhidos={
          <>
            <Recolhido id="recolhido-serie" titulo="A inflação mês a mês desde 2020" resumo="A série da área escolhida e do Brasil.">
                <SecaoInflacao
                  id="serie"
                  titulo="A inflação mês a mês desde 2020"
                  subtitulo={<>Variação percentual do IPCA índice geral, em 12 meses ou no mês, na área escolhida e no Brasil, desde o início da tabela 7060 até {mes}.</>}
                >
                  <SerieArea meses={g.meses} porArea={series(g).porArea} areas={nomes} primeiroDoze={g.primeiro_mes_doze} />
                  <FonteIpca g={g} />
                </SecaoInflacao>
            </Recolhido>
            <Recolhido id="recolhido-areas" titulo="As 16 áreas lado a lado" resumo="A tabela das áreas, dos grupos e da diferença para o Brasil.">
                <SecaoInflacao
                  id="areas"
                  titulo="As 16 áreas lado a lado"
                  subtitulo={
                    <>
                      Variação em 12 meses até {mes} ({janela}), da maior para a menor, com o Brasil ({pct(br.geral.doze)} no índice geral) como referência. A ordem não diz
                      se a inflação de uma área é alta ou baixa para quem mora nela.
                    </>
                  }
                >
                  <ComparacaoAreas areas={tela.areas} grupos={g.grupos} ultimoMes={g.ultimo_mes} />
                  <figure className="min-w-0">
                    <figcaption className="mb-2 text-sm text-carvao">
                      Variação em 12 meses até {mesAno(g.ultimo_mes)}, em %, no índice geral e nos nove grupos, e a diferença do índice geral para o Brasil, em pontos percentuais
                    </figcaption>
                    <div className="relative overflow-x-auto border-y border-linha" tabIndex={0} role="region" aria-label="Tabela das 16 áreas e do Brasil">
                      <table className="w-full min-w-[64rem] border-collapse text-sm [font-variant-numeric:tabular-nums]">
                        <thead>
                          <tr className="border-b border-linha text-left align-bottom">
                            <th scope="col" className="px-2 py-2 font-normal text-carvao-muted">Área</th>
                            <th scope="col" className="px-2 py-2 text-right font-normal text-carvao-muted">Índice geral</th>
                            <th scope="col" className="px-2 py-2 text-right font-normal text-carvao-muted">Diferença para o Brasil</th>
                            {g.grupos.map((gr) => (
                              <th key={gr.id} scope="col" className="px-2 py-2 text-right font-normal text-carvao-muted">{gr.nome}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[g.areas.find((a) => a.id === BRASIL)!, ...ordenadas].map((a) => {
                            const u = g.ultimo[a.id];
                            return (
                              <tr key={a.id} className={`border-b border-linha last:border-b-0 ${a.id === BRASIL ? "bg-marfim" : ""}`}>
                                <th scope="row" className="px-2 py-2 text-left font-normal text-carvao">{a.id === BRASIL ? "Brasil" : `${a.nome} (${a.uf})`}</th>
                                <td className="px-2 py-2 text-right text-carvao">{pct(u.geral.doze)}</td>
                                <td className="px-2 py-2 text-right text-carvao">{a.id === BRASIL ? "referência" : pp(u.geral.dif_brasil_pp, 2, true)}</td>
                                {g.grupos.map((gr) => (
                                  <td key={gr.id} className="px-2 py-2 text-right text-carvao">{pct(u.grupos[gr.id].doze)}</td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-mineral">
                      Em {mes}, a variação em 12 meses foi de {pct(g.ultimo[menor.id].geral.doze)} ({menor.nome}) a {pct(g.ultimo[maior.id].geral.doze)} ({maior.nome}). Regiões
                      metropolitanas e municípios não são a mesma unidade: em Rio Branco, São Luís, Aracaju, Campo Grande, Goiânia e Brasília, o IBGE pesquisa só o município.
                    </p>
                  </figure>
                  <FonteIpca g={g} extra="Diferença para o Brasil: variação da área menos a do Brasil, em pontos percentuais." />
                </SecaoInflacao>
            </Recolhido>
            <Recolhido id="recolhido-itens" titulo="Os produtos e serviços que mais subiram e mais caíram" resumo="Os subitens com peso de pelo menos o mínimo da regra.">
                <SecaoInflacao
                  id="itens"
                  titulo="Os produtos e serviços que mais subiram e mais caíram"
                  subtitulo={
                    <>
                      Subitens do IPCA, a unidade mais detalhada da pesquisa, com a variação em 12 meses até {mes}, o peso no orçamento da área e a contribuição para a
                      inflação dela, em pontos percentuais. Só entram os que pesam pelo menos {pct(g.regras.peso_minimo_destaque)} do orçamento, para que um item quase
                      ausente das compras não apareça como destaque.
                    </>
                  }
                >
                  <Destaques porArea={destaques(g)} areas={nomes} grupos={g.grupos} ultimoMes={g.ultimo_mes} pesoMinimo={g.regras.peso_minimo_destaque} />
                  <NotaInflacao>
                    <p>
                      Um item que subiu muito pode pesar pouco na inflação, e um item com alta pequena pode pesar muito: a contribuição ao lado de cada item mostra isso. Os
                      alimentos item por item, com a cesta e a segurança alimentar, estão no painel{" "}
                      <Link href={ROTA_COMIDA} prefetch={prefetchDoLink(ROTA_COMIDA)} className={link}>
                        Comida no prato
                        <SeloComConta href={ROTA_COMIDA} />
                      </Link>
                      .
                    </p>
                  </NotaInflacao>
                  <FonteIpca g={g} extra="Contribuição: peso do subitem no primeiro mês da janela × variação em 12 meses ÷ 100." />
                </SecaoInflacao>
            </Recolhido>
            <Recolhido id="recolhido-proximas" titulo="Para continuar" resumo="A comida, a conta de luz e o tanque.">
                <SecaoInflacao id="proximas" titulo="Para continuar">
                  <ProximasInflacao itens={[
                    { href: ROTA_COMIDA, pergunta: "Por que a comida subiu?", motivo: "A inflação dos alimentos item por item, a cesta e a segurança alimentar dos domicílios, no painel principal da comida." },
                    { href: "/setor-eletrico/conta-de-luz", pergunta: "Quanto custa a minha conta de luz?", motivo: "A tarifa da sua distribuidora e do que ela é feita; a energia elétrica é um dos itens de maior peso no IPCA." },
                    { href: "/combustiveis", pergunta: "Quanto custa encher o tanque no meu estado?", motivo: "O preço médio do litro de gasolina, etanol e diesel por estado, pela pesquisa de preços da ANP." },
                  ]} />
                </SecaoInflacao>
            </Recolhido>
          </>
        }
        metodo={
          <div id="metodo" className="space-y-8">
            <p className="text-sm text-mineral">
              IPCA até {mes}, divulgado pelo IBGE em {dataBr(g.fonte.divulgado_em)}
              {proxima && <>; próxima divulgação em {dataBr(proxima.data)}, com {mesExtenso(proxima.referencia)}</>}. Captura em {dataBr(g.capturado_em)}.
            </p>
              <div className="max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao">
                <h3 className="font-serif text-xl">Como ler cada número</h3>
                <p><strong className="font-medium">IPCA:</strong> Índice Nacional de Preços ao Consumidor Amplo, a inflação oficial do país, calculada pelo IBGE. Mede a variação dos preços de uma cesta de produtos e serviços consumidos pelas famílias com renda de 1 a 40 salários mínimos que moram nas áreas urbanas pesquisadas.</p>
                <p><strong className="font-medium">Áreas:</strong> 16, sendo 10 regiões metropolitanas (Belém, Fortaleza, Recife, Salvador, Belo Horizonte, Grande Vitória, Rio de Janeiro, São Paulo, Curitiba e Porto Alegre) e 6 municípios (Rio Branco, São Luís, Aracaju, Campo Grande, Goiânia e Brasília). O índice do Brasil combina as 16, cada uma com um peso definido pelo IBGE.</p>
                <p><strong className="font-medium">Variação no mês, no ano e em 12 meses:</strong> quanto os preços mudaram, em %, de um mês para o seguinte; de dezembro do ano anterior até o mês; e nos 12 meses terminados no mês. Todas como o IBGE publica, com duas casas.</p>
                <p><strong className="font-medium">Peso:</strong> a parte do orçamento médio das famílias da pesquisa que vai para cada grupo ou subitem, em %, na área e no mês. Os pesos vêm da Pesquisa de Orçamentos Familiares e mudam de um mês para outro com os preços relativos; os nove grupos somam 100% em cada área e mês.</p>
                <p><strong className="font-medium">Variação percentual e pontos percentuais:</strong> a inflação é variação percentual (%). A diferença entre duas inflações, como a da área menos a do Brasil, e a contribuição de um grupo para o índice são pontos percentuais (p.p.): em {mes}, {pct(g.ultimo[maior.id].geral.doze)} em {maior.nome} menos {pct(br.geral.doze)} no Brasil são {pp(g.ultimo[maior.id].geral.dif_brasil_pp, 2, true)}, não um percentual.</p>
                <p><strong className="font-medium">Contribuição:</strong> peso do grupo (ou do subitem) no primeiro mês da janela de 12 meses, vezes a variação dele em 12 meses, dividido por 100. É cálculo da Scrutiniums com os números do IBGE. A soma das nove contribuições reproduz a inflação da área com a diferença do arredondamento dos números publicados, mostrada no artefato.</p>
                <p><strong className="font-medium">Produtos e serviços:</strong> os subitens do IPCA ({g.subitens[BRASIL].length} no Brasil). Subitem que o IBGE não pesquisa numa área (por exemplo, um alimento regional) fica fora da lista dela; não vira zero.</p>
                <p><strong className="font-medium">Quebra de série:</strong> a tabela 7060 começa em janeiro de 2020, com os pesos da Pesquisa de Orçamentos Familiares 2017-2018. A variação em 12 meses de janeiro a novembro de 2020 não está nela, porque a janela cairia em 2019, de outra estrutura de pesos (tabela 1419 do SIDRA). Por isso a série em 12 meses começa em dezembro de 2020, e as tabelas antigas não são emendadas a esta.</p>
                <p><strong className="font-medium">Ausência:</strong> número que a fonte não publica aparece como “sem dado” ou como lacuna, nunca como zero.</p>
              </div>
              <div className="max-w-prose2 space-y-2 text-sm leading-relaxed text-carvao">
                <h3 className="font-serif text-xl">O que estes números não dizem</h3>
                <ul className="list-disc space-y-2 pl-5 text-carvao-muted">
                  <li>O IPCA não é o custo de vida de uma família específica: é a inflação do orçamento médio das famílias da pesquisa. Quem gasta mais com aluguel, escola ou transporte sente uma inflação diferente.</li>
                  <li>Inflação é variação de preço, não nível de preço: uma área com inflação menor pode ter preços mais altos que outra, e a pesquisa não compara o preço de uma área com o de outra.</li>
                  <li>Para as famílias com renda de 1 a 5 salários mínimos, o IBGE publica o INPC, com a mesma coleta de preços e outros pesos. Esta página não mostra o INPC.</li>
                  <li>Cidades fora das 16 áreas não têm IPCA próprio.</li>
                </ul>
              </div>
              <div className="max-w-prose2 space-y-2 text-sm leading-relaxed text-carvao">
                <h3 className="font-serif text-xl">Atualização e conferências</h3>
                <p className="text-carvao-muted">
                  O IBGE divulga o IPCA do mês anterior entre os dias 8 e 12. A plataforma recoleta a tabela nos dias 10 e 14 e só publica se todos os testes passarem:
                  as 16 áreas e o Brasil presentes; nenhum mês faltando desde janeiro de 2020; pesos dos nove grupos somando 100 em cada área e mês (e os dos subitens
                  no último mês); variações dentro de uma faixa plausível; a variação em 12 meses publicada conferindo com o encadeamento das 12 variações mensais;
                  e as contribuições somando o índice. Se algum teste reprova, a publicação anterior continua no ar e a equipe é avisada.
                  {proxima && <> Próxima divulgação do IBGE: {dataBr(proxima.data)}, com o IPCA de {mesExtenso(proxima.referencia)}.</>}
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl text-carvao">Fontes</h3>
                <ul className="max-w-prose2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
                  <li>
                    <a href={g.fonte.url_tabela} className="underline underline-offset-2" rel="noopener noreferrer">IBGE, SIDRA, tabela {g.fonte.tabela}</a>: {g.fonte.nome_tabela}.
                    Período de {mesExtenso(g.primeiro_mes)} a {mesExtenso(g.ultimo_mes)}; último mês divulgado em {dataBr(g.fonte.divulgado_em)}; captura pela API do SIDRA em {dataBr(g.capturado_em)}.
                  </li>
                  <li>
                    <a href={g.fonte.url_metodo} className="underline underline-offset-2" rel="noopener noreferrer">IBGE, página do IPCA</a>, com a metodologia, as notas técnicas e
                    o calendário de divulgação.
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl text-carvao">Baixar os dados</h3>
                <DownloadsInflacao arquivos={[
                  { nome: "ipca-geral-e-grupos-mensal.csv", descricao: `índice geral e nove grupos nas 16 áreas e no Brasil, de ${mesAno(g.primeiro_mes)} a ${mesAno(g.ultimo_mes)}: variação no mês, no ano, em 12 meses e peso` },
                  { nome: "ipca-subitens-12-meses.csv", descricao: `subitens de cada área em ${mesAno(g.ultimo_mes)}: variação em 12 meses, peso no início da janela e no mês e contribuição` },
                ]} />
                <p className="max-w-prose2 text-xs leading-relaxed text-mineral">Separador ponto e vírgula, vírgula decimal, codificação UTF-8. Códigos de área e de categoria como no SIDRA.</p>
              </div>
            </div>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/custo-de-vida"]} variante="metodo" />}
      />
    </>
  );
}
