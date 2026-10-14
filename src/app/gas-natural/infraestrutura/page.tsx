import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas, TabelaGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { dataBR, mesAno, mesExtenso } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("infraestrutura");

export const metadata: Metadata = {
  title: "Infraestrutura e transporte de gás natural",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const ELOS: { titulo: string; texto: string }[] = [
  { titulo: "Escoamento", texto: "Gasodutos levam o gás dos campos, quase todos no mar, às unidades de processamento em terra." },
  { titulo: "Processamento", texto: "As unidades de processamento (UPGN) retiram impurezas e separam líquidos, como o GLP; sai o gás seco, pronto para a malha." },
  { titulo: "Importação", texto: "O gás importado entra pelo gasoduto Bolívia-Brasil ou chega em navios como GNL, regaseificado em terminais no litoral." },
  { titulo: "Transporte", texto: "Transportadoras operam a malha de alta pressão e entregam o gás às distribuidoras estaduais, a térmicas e a grandes consumidores." },
  { titulo: "Distribuição", texto: "Cada estado concede a distribuição de gás canalizado; a distribuidora leva o gás a indústrias, comércio, residências e postos de GNV." },
];

export default function InfraestruturaPage() {
  const g = goldGas.infraestrutura();
  const i = g.indicadores;
  const quebrasRelevantes = g.quebras.filter((q) => ["NTS", "TAG", "TBG"].includes(q.transportadora));
  return (
    <>
      <MarcaVisita secao="gas:infraestrutura" />
      <CabecalhoGas atual="infraestrutura" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina} dadosAte={<>Movimentação nos gasodutos até {mesExtenso(g.ultimo_mes)}; registro de autorizações até {dataBR(i.atos_ultimo.valor as string)}.</>}>
          <p>
            Do poço à casa, o gás natural passa por cinco elos físicos. Esta página mostra o que os dados abertos registram sobre o transporte e as instalações
            autorizadas pela ANP; a distribuição, regulada pelos estados, não tem base nacional estruturada de rede ou de clientes.
          </p>
        </AberturaGas>

        <section aria-label="Os elos da cadeia" className="py-6">
          <ol className="grid gap-x-6 gap-y-5 md:grid-cols-5">
            {ELOS.map((e, k) => (
              <li key={e.titulo} className="border-t-2 border-gas pt-3">
                <p className="rotulo text-gas-dark">{k + 1}. {e.titulo}</p>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{e.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <SecaoGas
          id="transporte"
          titulo="Quanto gás cada transportadora informa ter entregue"
          subtitulo="Milhões de m³ por dia, média mensal do volume realizado nos pontos de entrega, como informado pelas transportadoras à ANP, desde janeiro de 2021."
        >
          <GraficoLinhas
            titulo="Volume entregue por transportadora"
            dados={g.entregas}
            chaveX="mes"
            formatoX="mes"
            unidade="milhões de m³/dia"
            casas={1}
            zeroNoEixo
            legendaInterativa
            series={g.transportadoras.map((t, k) => ({ id: t, rotulo: g.transportadoras_nome[t] ?? t, sigla: t, cor: k === 1 ? COR.foco : COR.comp[k % COR.comp.length], tracejada: k > 2 }))}
          />
          <FonteFigura ids={["anp_movimentacao"]} />
          <NotaGas titulo="Esta série tem quebras não explicadas pela fonte">
            <p>
              Ficam sem valor os meses em que uma transportadora aparece sem volume ou com volume acima de dez vezes a mediana da própria série:{" "}
              {g.meses_incompletos.map((m) => `${mesAno(m.mes)} (${m.motivo.map((x) => x.split(":")[0].split(" - ").pop()).join(", ")})`).join("; ")}.
            </p>
            {quebrasRelevantes.length > 0 && (
              <p>
                Em outros meses o volume muda de patamar, para menos da metade ou mais do dobro da mediana dos 12 meses anteriores, sem nota nos metadados:{" "}
                {quebrasRelevantes.map((q) => `${q.transportadora} em ${mesAno(q.mes)}`).join(", ")}. Por isso a série não é usada aqui para medir consumo
                nem somada num total nacional.
              </p>
            )}
          </NotaGas>
        </SecaoGas>

        <SecaoGas
          id="autorizacoes"
          titulo="Atos de autorização de instalações de gás natural por ano"
          subtitulo="Atos de construção, operação, renovação e transferência registrados pela ANP, por tipo de instalação e ano de outorga."
        >
          <section aria-label="Medidas do registro">
            <FaixaMedidas>
              <MedidaGas ind={i.atos_total} casas={0} />
            </FaixaMedidas>
          </section>
          <GraficoBarras
            titulo="Atos de autorização da ANP por tipo de instalação"
            dados={g.autorizacoes_por_ano}
            chaveCategoria="ano"
            empilhado
            series={g.grupos_autorizacao.map((gr, k) => ({ id: gr, rotulo: gr, cor: k === 0 ? COR.foco : k === 4 ? COR.referencia : COR.comp[(k - 1) % COR.comp.length] }))}
            unidade="atos"
            casas={0}
            altura={340}
          />
          <FonteFigura ids={["anp_autorizacoes"]} extra="Agrupamento por tipo feito pela Scrutiniums a partir do campo TipoDeInstalacao; o registro mistura categorias e cada ativo pode ter vários atos." />
        </SecaoGas>

        <SecaoGas
          id="gnl"
          titulo="Terminais de GNL com autorização de operação"
          subtitulo="Ato de operação mais recente de cada terminal no registro da ANP. A capacidade aparece como gravada no ato; o conjunto não informa a unidade."
        >
          <TabelaGas
            titulo="Terminais de regaseificação de GNL no registro de autorizações"
            colunas={[
              { id: "instalacao", rotulo: "Instalação" },
              { id: "empresa", rotulo: "Empresa autorizada" },
              { id: "tipo", rotulo: "Tipo do ato" },
              { id: "ato", rotulo: "Ato" },
              { id: "data_br", rotulo: "Data" },
              { id: "capacidade_informada", rotulo: "Capacidade no ato" },
            ]}
            linhas={g.terminais_gnl.map((t) => ({ ...t, data_br: dataBR(t.data) }))}
            nota={<>O ato mais recente do registro é de {dataBR(i.atos_ultimo.valor as string)}; atos posteriores ainda não aparecem no arquivo da ANP. Um mesmo terminal pode ter mudado de titular, por isso a empresa é a do último ato.</>}
          />
          <FonteFigura ids={["anp_autorizacoes"]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/mercado", pergunta: "Mais empresas estão comprando e vendendo gás?", motivo: "Carregadores com movimentação na malha." },
            { href: "/gas-natural/importacao", pergunta: "De onde vem o gás importado?", motivo: "Gasoduto e GNL por país de origem." },
            { href: "/gas-natural/regulacao", pergunta: "Quem define as regras do gás?", motivo: "Autorização federal do transporte e concessão estadual da distribuição." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
