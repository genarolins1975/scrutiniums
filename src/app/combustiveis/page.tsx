import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { PrecoNoEstado } from "@/components/combustiveis/PrecoNoEstado";
import { ComparacaoUfs, HistoricoBrasil, SerieDoEstado } from "@/components/combustiveis/Graficos";
import { ComoAnpMede } from "@/components/combustiveis/ComoAnpMede";
import { DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas, TabelaGas, valorComUnidade } from "@/components/gas/Blocos";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { COR } from "@/lib/gas/cores";
import { carimbo, mesAno, mesExtenso, num, periodoLegivel, reais, sinal } from "@/lib/gas/formato";
import { brasilNoUltimoMes, dadosDoEstado, dataNota, goldCombustiveis, marcosDaPesquisa, mediasPorUf, serieCom, serieUfDuasCasas } from "@/lib/combustiveis/dados";
import { paginaCombustiveis } from "@/lib/combustiveis/paginas";
import type { IdCombustivel } from "@/lib/gas/gold";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { destinosDaColecao } from "@/components/observatorios/DestinosDaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { fontesPorId, type Indicador } from "@/lib/gas/gold";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

const pagina = paginaCombustiveis("painel");

export const metadata: Metadata = {
  title: tituloNaColecao("Preço da gasolina, do etanol e do diesel por estado", "/combustiveis"),
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

/** Um indicador da gold como número da entrada (escala ou caminho): valor, unidade, período e fonte, lidos da mesma gold do painel. */
function numeroDoIndicador(ind: Indicador | undefined, rotulo: string, href: string, casas = 2): NumeroPorta {
  const v = ind && typeof ind.valor === "number" ? valorComUnidade(ind.valor, ind.unidade, casas) : null;
  const fontes = ind ? fontesPorId(ind.fontes) : [];
  return {
    rotulo,
    valor: v?.valor ?? null,
    unidade: v?.unidade ?? "",
    periodo: periodoLegivel(ind?.periodo),
    fonte: fontes.length ? fontes.map((f) => `${f.orgao}, ${f.conjunto}`).join("; ") : "ANP",
    href,
  };
}

/**
 * Painel "Combustíveis nos postos" (coleção Combustíveis, Observatório de Energia e Infraestrutura), com conta. Arquétipo
 * panorama com consulta: a pergunta e o preço no estado do leitor na primeira tela; como a ANP mede; a série desde 2013
 * (nominal e corrigida pelo IPCA, lacuna de 2020 como lacuna); as UFs comparadas no último mês; o etanol em porcentagem da
 * gasolina; método, notas da planilha e downloads recolhidos no fim. Todos os números saem de public/gas/gold/combustiveis.json.
 */
export default function CombustiveisPage() {
  const g = goldCombustiveis();
  const i = g.indicadores;
  const br = brasilNoUltimoMes(g);
  const medio = Object.fromEntries(g.produtos.map((p) => [p.id, br[p.id].medio])) as Record<IdCombustivel, number>;
  const mes = mesExtenso(g.ultimo_mes);
  const fontesEstado = ["anp_precos_estados", "anp_precos_brasil"];
  const ufs = g.por_uf.map((u) => ({ uf: u.uf, nome: u.nome }));
  const razao = [...g.por_uf]
    .map((u) => ({ uf: u.uf, nome: u.nome, razao: u.etanol_gasolina_pct }))
    .sort((a, b) => (a.razao === null ? 1 : b.razao === null ? -1 : b.razao - a.razao));
  const comRazao = razao.filter((r) => r.razao !== null);
  const celula = (u: (typeof g.por_uf)[number], id: IdCombustivel) => {
    const x = u[id];
    return x ? `${reais(x.medio, 2)} (${sinal(x.dif_brasil_pct, 1, "%")})` : null;
  };
  const semDado = g.por_uf.flatMap((u) => g.produtos.filter((p) => !u[p.id]).map((p) => `${p.nome.toLowerCase()} em ${u.nome}`));
  const lacuna = g.pesquisa.eventos.find((e) => e.tipo === "sem_pesquisa");
  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <header>
        {/* a gold é do pipeline do Gás: as fontes do "Citar" e do "Avisar" são as dele */}
        <CabecalhoPlataforma observatorio="energia-e-infraestrutura" destinoConta="/combustiveis" fontes={["gas"]} />
        <NavegacaoColecao colecao="combustiveis" />
      </header>
      <EntradaColecao
        tipo="colecao"
        rota={pagina.href}
        acento="gas"
        titulo={pagina.pergunta}
        frase="O preço médio do litro de gasolina comum, etanol hidratado e óleo diesel em cada estado e no Brasil, pela pesquisa de preços da ANP nos postos, mês a mês desde janeiro de 2013."
        frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/combustiveis"]} conteiner="mx-auto max-w-page px-6" />}
        escala={g.produtos.map((p) => numeroDoIndicador(i[`${p.id}_medio_mes`], `Preço médio do litro: ${p.nome.toLowerCase()}`, "#historico"))}
        notaEscala="Médias nacionais de uma amostra de postos no mês: não são o preço de um posto."
        paraVoce={
          <ParaVoce entrada="/combustiveis">
            <section aria-label="Preço no seu estado">
                <PrecoNoEstado dados={dadosDoEstado(g)} />
                <div className="mt-4">
                  <FonteFigura ids={fontesEstado} extra="Distância para o Brasil: preço médio da UF menos a média nacional da ANP do mesmo mês, em reais e em percentual." />
                </div>
            </section>
          </ParaVoce>
        }
        destinos={destinosDaColecao("combustiveis")}
        artefato={
          <ModeloDidatico
            id="como-mede"
            titulo="Como a ANP mede o preço nos postos"
            descricao="O que a pesquisa publica, quantos postos entram nela a cada mês e onde ela tem lacunas."
            deixaDeFora={[
              "O preço de um posto específico: a ANP publica médias, mínimos e máximos da amostra",
              "Os municípios e os postos fora da amostra do mês",
              "Quanto cada combustível rende no motor, que depende do veículo e do uso",
            ]}
          >
            <ComoAnpMede g={g} />
            <FonteFigura ids={fontesEstado} />
          </ModeloDidatico>
        }
        caminhos={[
          {
            pergunta: "Como o preço do litro mudou desde 2013?",
            resumo: "A média Brasil mês a mês, em valores da época ou corrigidos pelo IPCA, e a série do seu estado.",
            href: "#historico",
            numero: numeroDoIndicador(i.gasolina_variacao_12m, "Variação do preço médio da gasolina comum em 12 meses", "#historico", 1),
          },
          { pergunta: "Como os estados se comparam?", resumo: `O preço médio de ${mes} em cada UF, com a distância para a média do Brasil.`, href: "#estados" },
          {
            pergunta: "Quanto o etanol custa em relação à gasolina?",
            resumo: "O preço do litro de etanol em % do de gasolina, por UF.",
            href: "#etanol-gasolina",
            numero: numeroDoIndicador(i.etanol_gasolina_brasil, "Etanol em % da gasolina, média Brasil", "#etanol-gasolina", 1),
          },
          { pergunta: "Quanto custa o GNV no meu estado?", resumo: "O gás natural veicular, pela mesma pesquisa da ANP, no painel do Gás Natural.", href: "/gas-natural/gnv-e-gas-encanado" },
        ]}
        recolhidos={
          <>
            <Recolhido id="recolhido-historico" titulo="O preço do litro desde 2013" resumo="A média Brasil, corrigida ou não, e a série do seu estado.">
                <SecaoGas
                  id="historico"
                  titulo="O preço do litro desde 2013"
                  subtitulo={<>R$ por litro, média Brasil. A opção corrigida expressa cada mês em reais de {mesExtenso(g.mes_base_real)}, pelo IPCA índice geral. O mês sem pesquisa é lacuna na linha.</>}
                >
                  <HistoricoBrasil serie={serieCom(g, ["", "_real"])} produtos={g.produtos} mesBase={g.mes_base_real} marcos={marcosDaPesquisa(g)} />
                  <FonteFigura ids={["anp_precos_brasil", "ibge_ipca"]} extra="Correção: preço do mês × (IPCA acumulado até o mês da base ÷ IPCA acumulado até o mês)." />
                  <FaixaMedidas>
                    {g.produtos.map((p) => <MedidaGas key={p.id} ind={i[`${p.id}_variacao_12m`]} rotulo={`${p.nome}: variação do preço médio em 12 meses`} variacao />)}
                  </FaixaMedidas>
                  {lacuna && (
                    <NotaGas>
                      <p>
                        Não houve pesquisa de preços de {dataNota(lacuna.inicio)} a {dataNota(lacuna.fim)}: {g.pesquisa.meses_sem_pesquisa.map(mesExtenso).join(", ")} aparece
                        como lacuna, e {g.pesquisa.meses_parciais.map(mesExtenso).join(" e ")} trazem só a parte do mês pesquisada. A abrangência da pesquisa foi reduzida
                        no segundo semestre de 2017, e a greve dos caminhoneiros reduziu a amostra no fim de maio de 2018, conforme as notas da própria planilha.
                      </p>
                    </NotaGas>
                  )}
                  <div className="border-t border-linha pt-6">
                    <h3 className="font-serif text-xl text-carvao">O preço no seu estado ao longo do tempo</h3>
                    <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">R$ por litro, valores da época, média mensal da UF ao lado da média Brasil.</p>
                    <div className="mt-4">
                      <SerieDoEstado meses={g.serie_uf.meses} valores={serieUfDuasCasas(g)} brasil={serieCom(g, [""])} produtos={g.produtos} ufs={ufs} />
                    </div>
                    <div className="mt-3">
                      <FonteFigura ids={fontesEstado} />
                    </div>
                  </div>
                </SecaoGas>
            </Recolhido>
            <Recolhido id="recolhido-estados" titulo="Como os estados se comparam" resumo="O gráfico e a tabela das UFs no último mês.">
                <SecaoGas
                  id="estados"
                  titulo="Como os estados se comparam"
                  subtitulo={<>R$ por litro, preço médio de {mes} em cada UF, da maior para a menor média, com a média do Brasil como referência. A ordem não indica se um preço é alto ou baixo para quem compra.</>}
                >
                  <ComparacaoUfs ufs={mediasPorUf(g)} produtos={g.produtos} brasil={medio} ultimoMes={g.ultimo_mes} />
                  <TabelaGas
                    titulo={`Preço médio do litro por UF, ${mesAno(g.ultimo_mes)}, e a distância para a média do Brasil (%)`}
                    colunas={[
                      { id: "nome", rotulo: "UF" },
                      ...g.produtos.map((p) => ({ id: p.id, rotulo: p.nome, numero: true })),
                      { id: "postos", rotulo: "Postos pesquisados, gasolina", numero: true, casas: 0 },
                    ]}
                    linhas={g.por_uf.map((u) => ({ nome: u.nome, ...Object.fromEntries(g.produtos.map((p) => [p.id, celula(u, p.id)])), postos: u.gasolina?.postos ?? null }))}
                    nota={
                      <>
                        Média Brasil em {mes}: {g.produtos.map((p) => `${p.nome.toLowerCase()} ${reais(medio[p.id], 2)}`).join("; ")}.
                        {semDado.length > 0 && <> Sem preço publicado pela ANP no mês: {semDado.join("; ")}.</>}
                      </>
                    }
                  />
                  <FonteFigura ids={fontesEstado} />
                </SecaoGas>
            </Recolhido>
            <Recolhido id="recolhido-etanol-gasolina" titulo="Quanto o litro de etanol custa em relação ao de gasolina" resumo="A razão entre os preços, por UF.">
                <SecaoGas
                  id="etanol-gasolina"
                  titulo="Quanto o litro de etanol custa em relação ao de gasolina"
                  subtitulo={<>Preço médio do etanol hidratado dividido pelo da gasolina comum, em %, por UF, {mes}. Medida calculada pela Scrutiniums com os preços da ANP.</>}
                >
                  <GraficoBarras
                    titulo={`Preço do litro de etanol em % do preço do litro de gasolina, por UF, ${mesAno(g.ultimo_mes)}`}
                    dados={razao}
                    chaveCategoria="uf"
                    chaveRotulo="nome"
                    orientacao="horizontal"
                    series={[{ id: "razao", rotulo: "Etanol em % da gasolina", cor: COR.foco }]}
                    unidade="%"
                    casas={1}
                    rotulosValor
                    referencias={[{ valor: i.etanol_gasolina_brasil.valor as number, rotulo: "Média Brasil" }]}
                    rotulosSaoNomes
                  />
                  <NotaGas titulo="O que esta medida não diz">
                    <p>
                      É uma razão entre preços por litro. Não considera quanto cada combustível rende no motor, que depende do veículo e do uso, e por isso
                      não indica qual compensa abastecer. Em {mes}, a razão foi de {num(comRazao[comRazao.length - 1]?.razao ?? null, 1)}% ({comRazao[comRazao.length - 1]?.nome}) a{" "}
                      {num(comRazao[0]?.razao ?? null, 1)}% ({comRazao[0]?.nome}).
                    </p>
                  </NotaGas>
                  <FonteFigura ids={fontesEstado} extra="Cálculo: preço médio do etanol hidratado ÷ preço médio da gasolina comum × 100, na mesma UF e no mesmo mês." />
                </SecaoGas>
            </Recolhido>
            <Recolhido id="recolhido-proximas" titulo="Para continuar" resumo="O GNV, o botijão e a conta de luz.">
                <SecaoGas id="proximas" titulo="Para continuar">
                  <ProximasPerguntas itens={[
                    { href: "/gas-natural/gnv-e-gas-encanado", pergunta: "Quanto custa o GNV no meu estado?", motivo: "O gás natural veicular, pela mesma pesquisa da ANP, fica no painel do Gás Natural." },
                    { href: "/gas-natural/gas-de-cozinha", pergunta: "Quanto custa o botijão de gás no meu estado?", motivo: "O GLP em botijão de 13 kg, pela mesma pesquisa de preços." },
                    { href: "/setor-eletrico/conta-de-luz", pergunta: "Quanto custa a minha conta de luz?", motivo: "A tarifa da sua distribuidora e do que ela é feita." },
                  ]} />
                </SecaoGas>
            </Recolhido>
          </>
        }
        metodo={
          <div id="metodo" className="space-y-8">
            <p className="text-sm text-mineral">
              Preços da ANP até {mes}; captura em {carimbo(g.dados_capturados_em)}. Médias de uma amostra de postos: não são o preço de um posto.
            </p>
              <div className="max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao">
                <h3 className="font-serif text-xl">Como ler cada número</h3>
                <p><strong className="font-medium">Preço médio de revenda:</strong> média da ANP sobre os preços cobrados do consumidor nos postos pesquisados no mês, em reais por litro. Não é o preço de um posto.</p>
                <p><strong className="font-medium">Menor e maior preço:</strong> os extremos encontrados na amostra do mês, não limites de preço do mercado.</p>
                <p><strong className="font-medium">Postos pesquisados:</strong> quantidade que a ANP informa na série mensal. A planilha não diz se um posto pesquisado em mais de uma semana do mês conta uma vez ou mais; por isso o número é lido como tamanho da amostra.</p>
                <p><strong className="font-medium">Distância para o Brasil:</strong> preço médio da UF menos a média nacional da ANP do mesmo mês, em reais, e a mesma diferença em percentual da média nacional.</p>
                <p><strong className="font-medium">Variação em 12 meses:</strong> preço médio do mês dividido pelo preço médio do mesmo mês do ano anterior, menos um, em percentual.</p>
                <p><strong className="font-medium">Valores corrigidos:</strong> cada mês multiplicado pela variação do IPCA índice geral (IBGE) até {mesExtenso(g.mes_base_real)}. Corrige pela inflação média, não pela inflação de combustíveis.</p>
                <p><strong className="font-medium">Óleo diesel e óleo diesel S10:</strong> os dois produtos como a ANP os separa. Segundo a nota da planilha, o produto “óleo diesel” hoje é o óleo diesel B S500 comum.</p>
                <p><strong className="font-medium">Ausência:</strong> UF ou mês sem preço publicado aparece como “sem dado” ou como lacuna no gráfico, nunca como zero.</p>
              </div>
              <div className="max-w-prose2 space-y-2 text-sm leading-relaxed text-carvao">
                <h3 className="font-serif text-xl">Notas da própria planilha da ANP</h3>
                <ul className="list-disc space-y-2 pl-5 text-carvao-muted">
                  {g.pesquisa.notas.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="font-serif text-xl text-carvao">Indicadores do último mês</h3>
                <FaixaMedidas>
                  {g.produtos.map((p) => <MedidaGas key={p.id} ind={i[`${p.id}_medio_mes`]} casas={2} />)}
                </FaixaMedidas>
                <FaixaMedidas>
                  {g.produtos.map((p) => <MedidaGas key={p.id} ind={i[`${p.id}_postos_mes`]} casas={0} />)}
                </FaixaMedidas>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl text-carvao">Fontes</h3>
                <FonteFigura ids={["anp_precos_estados", "anp_precos_brasil", "ibge_ipca"]} extra="O sha256 de cada planilha original e a data de cada captura estão em Dados e downloads do Gás Natural, que mantém o pipeline." />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl text-carvao">Baixar os dados</h3>
                <DownloadsGas series={[
                  { id: "preco-combustiveis-brasil-mensal", descricao: "Brasil, mês a mês desde 2013: médio, mínimo, máximo, postos e corrigido pelo IPCA" },
                  { id: "preco-combustiveis-por-uf", descricao: `por UF em ${mes}, com a distância para o Brasil e o etanol em % da gasolina` },
                  { id: "preco-combustiveis-uf-mensal", descricao: "por UF e mês desde 2013: médio, mínimo, máximo e postos" },
                ]} />
              </div>
            </div>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/combustiveis"]} variante="metodo" />}
      />
    </>
  );
}
