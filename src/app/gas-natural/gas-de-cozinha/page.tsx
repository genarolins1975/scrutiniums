import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas, TabelaGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MapaUf } from "@/components/gas/MapaUf";
import { SeriePorUf } from "@/components/gas/SeriePorUf";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesAno, mesExtenso, num, periodoLegivel, sinal } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("gas-de-cozinha");

export const metadata: Metadata = {
  title: "Preço do gás de cozinha (GLP) por estado",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

export default function GasDeCozinhaPage() {
  const g = goldGas.glp();
  const i = g.indicadores;
  const ip = g.ipca.indicadores;
  const v = g.vendas!;
  const maior = g.por_uf[0];
  const menor = g.por_uf[g.por_uf.length - 1];
  const valoresMapa = Object.fromEntries(g.por_uf.map((x) => [x.codigo, x.medio]));
  const ufs = [...g.por_uf].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((x) => ({ uf: x.uf, nome: x.nome }));
  const variacao = i.variacao_12m.valor as number | null;
  return (
    <>
      <MarcaVisita secao="gas:gas-de-cozinha" />
      <CabecalhoGas atual="gas-de-cozinha" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina} dadosAte={<>Preços da ANP até {mesExtenso(g.ultimo_mes)}; IPCA do IBGE até {mesExtenso(g.ipca.ultimo_mes)}.</>}>
          <p>
            Em {mesExtenso(g.ultimo_mes)}, o botijão de 13 kg de gás de cozinha custou em média R$ {num(i.medio_mes.valor as number, 2)} nas{" "}
            {num(i.postos_mes.valor as number, 0)} revendas pesquisadas pela ANP{variacao === null ? "" : `, ${sinal(variacao, 1, "%")} em 12 meses`}. A média
            estadual foi de R$ {num(menor.medio, 2)} ({menor.nome}) a R$ {num(maior.medio, 2)} ({maior.nome}).
          </p>
          <p>
            No IPCA, o gás de botijão variou {sinal(ip.botijao.valor as number, 2, "%")} em 12 meses até {mesExtenso(g.ipca.ultimo_mes)}, ante{" "}
            {sinal(ip.geral.valor as number, 2, "%")} do índice geral.
          </p>
        </AberturaGas>

        <NotaGas titulo="Gás de cozinha não é gás natural">
          <p>
            O botijão leva gás liquefeito de petróleo (GLP), uma mistura de propano e butano obtida no refino do petróleo e no processamento do gás natural. O gás
            natural é sobretudo metano e chega às casas por tubulação, como gás encanado. As duas cadeias têm distribuidoras, preços e regras diferentes; esta é a
            única página do observatório sobre GLP.
          </p>
        </NotaGas>

        <section aria-label="Medidas principais" className="py-6">
          <FaixaMedidas>
            <MedidaGas ind={i.medio_mes} casas={2} />
            <MedidaGas ind={i.variacao_12m} variacao />
            <MedidaGas ind={ip.botijao} casas={2} variacao />
            <MedidaGas ind={i.postos_mes} casas={0} />
          </FaixaMedidas>
        </section>

        <SecaoGas id="estados" titulo="O preço médio do botijão em cada estado" subtitulo={<>R$ por botijão de 13 kg, média da pesquisa de {mesExtenso(g.ultimo_mes)}.</>}>
          <MapaUf
            titulo={`Preço médio do GLP em botijão de 13 kg por UF, ${mesAno(g.ultimo_mes)}`}
            valores={valoresMapa}
            unidade="R$/13 kg"
            periodo={mesAno(g.ultimo_mes)}
            nota="Classes por quantis. A cor indica a posição entre as UFs, não se o preço é alto ou baixo para quem compra."
          />
          <TabelaGas
            titulo={`Preço do botijão por UF, ${mesAno(g.ultimo_mes)}, do maior para o menor preço médio`}
            colunas={[
              { id: "nome", rotulo: "UF" },
              { id: "medio", rotulo: "Médio, R$", numero: true, casas: 2 },
              { id: "minimo", rotulo: "Mínimo, R$", numero: true, casas: 2 },
              { id: "maximo", rotulo: "Máximo, R$", numero: true, casas: 2 },
              { id: "medio_ano_anterior", rotulo: "Médio 12 meses antes, R$", numero: true, casas: 2 },
              { id: "variacao_12m_pct", rotulo: "Variação em 12 meses", numero: true, casas: 1, sufixo: "%" },
              { id: "postos", rotulo: "Revendas pesquisadas", numero: true, casas: 0 },
            ]}
            linhas={g.por_uf}
            nota="Mínimo e máximo são os extremos encontrados na amostra do mês, não limites de preço. A pesquisa não cobre todos os municípios."
          />
          <FonteFigura ids={["anp_precos_estados"]} />
        </SecaoGas>

        <SecaoGas id="sua-uf" titulo="O preço no seu estado ao longo do tempo" subtitulo="R$ por botijão de 13 kg, média mensal desde janeiro de 2019, comparada com a média Brasil.">
          <SeriePorUf
            titulo="Preço médio do botijão de 13 kg"
            serieUf={g.serie_uf}
            serieBrasil={g.serie}
            ufs={ufs}
            inicial={maior.uf}
            unidade="R$/13 kg"
            corUf={COR.foco}
            corBrasil={COR.referencia}
          />
          <FonteFigura ids={["anp_precos_estados", "anp_precos_brasil"]} />
        </SecaoGas>

        <SecaoGas
          id="historico"
          titulo="O botijão desde 2013, em valores da época e corrigidos pela inflação"
          subtitulo={<>R$ por botijão de 13 kg, média Brasil. A linha corrigida expressa cada mês em reais de {mesExtenso(g.mes_base_real)}, pelo IPCA índice geral. A faixa mostra o menor e o maior preço da pesquisa.</>}
        >
          <GraficoLinhas
            titulo="Preço médio do GLP em botijão de 13 kg no Brasil"
            dados={g.serie}
            chaveX="mes"
            formatoX="mes"
            unidade="R$/13 kg"
            casas={2}
            zeroNoEixo
            zoom
            legendaInterativa
            chaveUrl="glp"
            banda={{ inferior: "minimo", superior: "maximo", rotulo: "Menor e maior preço da pesquisa" }}
            series={[
              { id: "medio", rotulo: "Preço médio, valores da época", sigla: "Nominal", cor: COR.foco, espessura: 2.5 },
              { id: "medio_real", rotulo: `Preço médio em reais de ${mesAno(g.mes_base_real)}`, sigla: "Corrigido", cor: COR.comp[1], tracejada: true },
            ]}
          />
          <FonteFigura ids={["anp_precos_brasil", "ibge_ipca"]} extra="Correção: preço do mês × (IPCA acumulado até o mês-base ÷ IPCA acumulado até o mês)." />
          <NotaGas>
            <p>Não houve pesquisa de preços entre 18/8/2020 e 17/10/2020; os meses sem pesquisa aparecem como lacuna. A abrangência da pesquisa mudou em 2017 e em 2018, conforme notas da própria planilha da ANP.</p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="inflacao" titulo="A inflação do gás de botijão" subtitulo="IPCA, variação em 12 meses, %. Gás de botijão e índice geral, desde janeiro de 2012.">
          <GraficoLinhas
            titulo="IPCA em 12 meses: gás de botijão e índice geral"
            dados={g.ipca.doze_meses}
            chaveX="mes"
            formatoX="mes"
            unidade="% em 12 meses"
            casas={2}
            zeroNoEixo
            series={[
              { id: "botijao", rotulo: "Gás de botijão", cor: COR.foco, espessura: 2.5 },
              { id: "geral", rotulo: "IPCA, índice geral", cor: COR.referencia, tracejada: true },
            ]}
          />
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            De janeiro de 2012 a {mesExtenso(g.ipca.ultimo_mes)}, o gás de botijão acumulou alta de {num(ip.botijao_acumulado.valor as number, 1)}% no IPCA, e o
            índice geral, de {num(ip.geral_acumulado.valor as number, 1)}%.
          </p>
          <FonteFigura ids={["ibge_ipca"]} />
        </SecaoGas>

        <SecaoGas id="vendas" titulo="Quanto GLP é vendido em botijões" subtitulo="Vendas das distribuidoras de GLP, milhares de m³ por mês, por tipo de vasilhame.">
          <GraficoLinhas
            titulo="Vendas de GLP por tipo de vasilhame"
            dados={v.serie}
            chaveX="mes"
            formatoX="mes"
            unidade="mil m³"
            casas={1}
            zeroNoEixo
            zoom
            chaveUrl="vend"
            series={[
              { id: "ate_p13", rotulo: "Vasilhames de até 13 kg", sigla: "Até P13", cor: COR.foco, espessura: 2.5 },
              { id: "outros", rotulo: "Demais vasilhames (categoria Outros da ANP)", sigla: "Outros", cor: COR.comp[0] },
            ]}
          />
          <GraficoBarras
            titulo={`Vendas em vasilhames de até 13 kg por UF, ${periodoLegivel(v.indicadores.p13_12m.periodo)}`}
            dados={v.por_uf.map((x) => ({ uf: x.uf, nome: x.nome, total: x.ate_p13_mil_m3_12m }))}
            chaveCategoria="uf"
            chaveRotulo="nome"
            orientacao="horizontal"
            series={[{ id: "total", rotulo: "Vendas em até P13", cor: COR.foco }]}
            unidade="mil m³"
            casas={1}
            limiteInicial={12}
          />
          <FonteFigura ids={["anp_glp_vasilhame"]} extra={<>Nos 12 meses, os vasilhames de até 13 kg responderam por {num(v.indicadores.p13_pct_12m.valor as number, 1)}% do volume de GLP vendido.</>} />
        </SecaoGas>

        <SecaoGas id="baixar" titulo="Baixar os dados desta página">
          <DownloadsGas series={[
            { id: "preco-glp-brasil-mensal", descricao: "preço do botijão no Brasil, médio, mínimo, máximo e corrigido" },
            { id: "preco-glp-por-uf", descricao: "preço do botijão por UF no último mês" },
            { id: "ipca-gas-12-meses", descricao: "IPCA em 12 meses do gás de botijão, encanado, veicular e índice geral" },
          ]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/gnv-e-gas-encanado", pergunta: "Quanto custam o GNV e o gás encanado?", motivo: "O gás natural que chega ao consumidor por posto e por tubulação." },
            { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "O preço do gás natural nas vendas entre empresas." },
            { href: "/gas-natural/metodologia", pergunta: "Como ler estes números?", motivo: "Amostra da pesquisa de preços, correção pela inflação e glossário." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
