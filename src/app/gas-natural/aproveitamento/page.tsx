import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas, TabelaGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesAno, mesExtenso, num, periodoLegivel } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("aproveitamento");

export const metadata: Metadata = {
  title: "Aproveitamento do gás produzido",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const PARCELAS = [
  { id: "disponivel", rotulo: "Disponível", cor: COR.foco },
  { id: "reinjecao", rotulo: "Reinjeção", cor: COR.comp[0] },
  { id: "consumo_proprio", rotulo: "Consumo próprio", cor: COR.comp[2] },
  { id: "queima", rotulo: "Queima e perda", cor: COR.comp[1] },
] as const;

export default function AproveitamentoPage() {
  const g = goldGas.aproveitamento();
  const i = g.indicadores;
  const periodo = periodoLegivel(i.reinjecao.periodo);
  const serieAnual = g.anual.map((x) => ({ ano: x.ano, ...Object.fromEntries(PARCELAS.map((s) => [s.id, x[`${s.id}_pct`]])) }));
  return (
    <>
      <MarcaVisita secao="gas:aproveitamento" />
      <CabecalhoGas atual="aproveitamento" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina} dadosAte={<>Dados da ANP até {mesExtenso(g.ultimo_mes)}.</>}>
          <p>
            De {periodo}, {num(i.disponivel.valor as number, 1)}% do gás produzido no Brasil ficou disponível para seguir à cadeia, em média{" "}
            {num(i.disponivel_mmd_12m.valor as number, 1)} milhões de m³ por dia. A maior parte, {num(i.reinjecao.valor as number, 1)}%, foi reinjetada nos
            reservatórios; {num(i.consumo_proprio.valor as number, 1)}% foi consumida nas próprias instalações de produção e {num(i.queima.valor as number, 1)}%
            foi queimada ou perdida.
          </p>
          <p>
            Reinjetar gás é uma decisão de produção: pode manter a pressão do reservatório, aumentar a recuperação de petróleo ou guardar o gás quando não há
            infraestrutura para escoar o gás. A ANP publica o volume reinjetado, mas não o motivo de cada campo.
          </p>
        </AberturaGas>

        <section aria-label="Medidas principais" className="py-6">
          <FaixaMedidas>
            <MedidaGas ind={i.disponivel} />
            <MedidaGas ind={i.reinjecao} />
            <MedidaGas ind={i.consumo_proprio} />
            <MedidaGas ind={i.queima} />
          </FaixaMedidas>
        </section>

        <SecaoGas
          id="destino"
          titulo="Para onde foi cada m³ produzido, mês a mês"
          subtitulo="Milhões de m³ por dia, média de cada mês, desde janeiro de 2000. As quatro parcelas somam a produção, com a diferença descrita abaixo."
        >
          <GraficoLinhas
            titulo="Destino do gás natural produzido no Brasil"
            dados={g.serie}
            chaveX="mes"
            formatoX="mes"
            unidade="milhões de m³/dia"
            casas={1}
            zeroNoEixo
            zoom
            legendaInterativa
            chaveUrl="dest"
            series={[{ id: "producao", rotulo: "Produção", cor: COR.referencia, tracejada: true }, ...PARCELAS.map((s) => ({ ...s }))]}
          />
          <FonteFigura ids={g.fontes} />
        </SecaoGas>

        <SecaoGas id="anual" titulo="A divisão da produção em cada ano" subtitulo="Percentual da produção do ano. Só anos com os 12 meses publicados.">
          <GraficoBarras
            titulo="Destino da produção de gás natural por ano, % da produção"
            dados={serieAnual}
            chaveCategoria="ano"
            series={PARCELAS.map((s) => ({ id: s.id, rotulo: s.rotulo, cor: s.cor }))}
            unidade="% da produção"
            casas={1}
            empilhado
            altura={340}
          />
          <FonteFigura ids={g.fontes} />
        </SecaoGas>

        <SecaoGas
          id="estados"
          titulo="O aproveitamento em cada estado produtor"
          subtitulo={<>Percentual da produção de cada UF, soma de {periodo}. A ordem é a do volume produzido.</>}
        >
          <TabelaGas
            titulo={`Destino da produção por UF, ${periodo}`}
            colunas={[
              { id: "nome", rotulo: "UF" },
              { id: "producao_mmd_12m", rotulo: "Produção, milhões de m³/dia", numero: true, casas: 2 },
              { id: "disponivel_pct", rotulo: "Disponível", numero: true, casas: 1, sufixo: "%" },
              { id: "reinjecao_pct", rotulo: "Reinjeção", numero: true, casas: 1, sufixo: "%" },
              { id: "consumo_proprio_pct", rotulo: "Consumo próprio", numero: true, casas: 1, sufixo: "%" },
              { id: "queima_pct", rotulo: "Queima e perda", numero: true, casas: 1, sufixo: "%" },
            ]}
            linhas={g.por_uf}
            nota="Por UF a soma das quatro parcelas também pode diferir de 100% pela diferença entre conjuntos descrita abaixo."
          />
          <FonteFigura ids={g.fontes} />
        </SecaoGas>

        <SecaoGas id="conferencia" titulo="A conta fecha?">
          <NotaGas titulo="Conferência publicada">
            <p>
              A ANP publica produção, reinjeção, queima, consumo próprio e disponível em cinco conjuntos separados. A Scrutiniums soma as quatro parcelas e
              compara com a produção. De {periodo} a diferença foi de {num(i.diferenca_12m.valor as number, 2)}% da produção. {i.diferenca_12m.nota}
            </p>
            {g.meses_inconsistentes.length > 0 && (
              <p>
                {g.meses_inconsistentes.length === 1 ? "Um mês ficou" : `${g.meses_inconsistentes.length} meses ficaram`} sem as parcelas no gráfico, porque a
                diferença passou de 2% da produção: {g.meses_inconsistentes.map((m) => `${mesAno(m.mes)} (${num(m.diferenca_pct, 1)}%)`).join(", ")}. O dado não
                foi corrigido; a lacuna aparece como ausência.
              </p>
            )}
            <p>Produção média no mesmo período: {num(i.producao_mmd_12m.valor as number | null, 1)} milhões de m³ por dia.</p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="baixar" titulo="Baixar os dados desta página">
          <DownloadsGas series={[{ id: "destino-da-producao-mensal", descricao: "produção e as quatro parcelas, mês a mês, com a diferença" }]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/importacao", pergunta: "Quanto gás o Brasil importa?", motivo: "O gás disponível da produção e o importado formam a oferta." },
            { href: "/gas-natural/infraestrutura", pergunta: "Por onde o gás chega ao consumidor?", motivo: "Escoamento, processamento, terminais de GNL e transporte." },
            { href: "/gas-natural/producao", pergunta: "Quanto gás o Brasil produz e onde?", motivo: "A produção por estado e a série desde 1997." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
