import type { Metadata } from "next";
import { GRUPOS, ROTULO_CURTO, lerDesastres, serieReconhecida, type GoldDesastres } from "@/lib/territorio/desastres";
import { NOME_UF } from "@/lib/territorio/queimadas";
import { dataBr, n } from "@/components/territorio/Queimadas";
import { DoDesastreAoReconhecimento } from "@/components/territorio/Desastres";
import { FiguraAnalitica, GraficoBarras, LeituraGuiada, PaginaPainel, TabelaDados, type NumeroProps } from "@/components/painel";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao("Desastres reconhecidos", "/territorio/desastres"),
  description: "Registros municipais de desastre com reconhecimento federal, de 2003 a 2025, por tipo e por estado, e os danos humanos registrados desde 2013, a partir do Atlas Digital de Desastres no Brasil.",
};

const FONTE = "Sedec/MIDR, Atlas Digital de Desastres no Brasil (base extraída do S2iD)";
const FONTE_CURTA = "Sedec/MIDR, Atlas Digital de Desastres";

/** Cor de cada grupo no gráfico: tokens de série em ordem fixa, identidade estável sem juízo de gravidade; rótulos e tabela repetem a informação. */
const COR_GRUPO = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)"];

function origem(g: GoldDesastres, indicador: string, inicio: string, fim: string, extra: { natureza?: "OBSERVADO" | "CALCULADO"; unidade?: string } = {}) {
  return provenienciaMontada({
    indicador,
    natureza: extra.natureza ?? "OBSERVADO",
    orgao: "Sedec/MIDR",
    dataset: "Atlas Digital de Desastres no Brasil (base extraída do S2iD)",
    url: g.fonte.pagina,
    licenca: g.fonte.licenca,
    unidade: extra.unidade ?? "registros municipais",
    frequencia: "anual",
    inicio,
    fim,
    capturadoEm: g.capturadoEm,
    publicadoEm: g.fonte.ultimo_registro_na_base,
    limitacoes: g.ressalvas,
    notas: g.fonte.cadencia,
  });
}

/**
 * Painel de desastres do Observatório do Território e Clima: registros municipais com
 * reconhecimento federal de situação de emergência ou estado de calamidade, por tipo e
 * por estado, danos humanos desde 2013 com as ressalvas da própria base, o ano em curso
 * declarado como indisponível e o modelo didático do caminho até o reconhecimento.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os quatro números da abertura viram a faixa do kit, a série e
 * os estados viram figuras com gráfico do kit, tabela equivalente e proveniência, o modelo didático acompanha a série que ele
 * explica, os danos humanos ficam na tabela à vista e o método recolhido vai para o fim, com o conteúdo de antes.
 */
export default function PaginaDesastres() {
  const g = lerDesastres();
  const serie = serieReconhecida(g);
  const ultimo = serie[serie.length - 1];
  const corrente = g.por_uf.ano_corrente;
  const danos = g.danos_humanos.serie.find((d) => d.ano === ultimo.ano && d.publicavel);
  const grupoLider = [...GRUPOS].sort((a, b) => ultimo.por_grupo_reconhecidos[b] - ultimo.por_grupo_reconhecidos[a])[0];
  const ufs = Object.entries(g.por_uf.ultimo_ano_completo.ufs).sort((a, b) => b[1].registros_reconhecidos - a[1].registros_reconhecidos);
  const [ufLider, dadosUf] = ufs[0];
  const primeiro = serie[0];
  const anoUf = g.por_uf.ultimo_ano_completo.ano;
  const linhasDanos = g.danos_humanos.serie.filter((d) => d.publicavel);

  const numeros: NumeroProps[] = [
    {
      rotulo: `Registros municipais com reconhecimento federal em ${ultimo.ano}`,
      valor: ultimo.registros_reconhecidos,
      formato: "inteiro",
      unidade: "registros",
      periodo: `ocorrências de ${ultimo.ano}`,
      fonte: FONTE_CURTA,
      natureza: "OBSERVADO",
      nota: "Um registro é um município atingido por um desastre reconhecido pela União; não é o número de desastres.",
    },
    {
      rotulo: `Municípios com ao menos um reconhecimento em ${ultimo.ano}`,
      valor: ultimo.municipios_distintos_com_reconhecimento,
      formato: "inteiro",
      unidade: "municípios",
      periodo: String(ultimo.ano),
      fonte: FONTE_CURTA,
      natureza: "CALCULADO",
      nota: `${n((100 * ultimo.municipios_distintos_com_reconhecimento) / 5570, 0)}% dos 5.570 municípios. Cada município conta uma vez, mesmo com vários reconhecimentos no ano.`,
    },
    {
      rotulo: `Tipo mais frequente em ${ultimo.ano}`,
      valorTexto: ROTULO_CURTO[grupoLider],
      formato: "texto",
      unidade: "",
      periodo: String(ultimo.ano),
      fonte: FONTE_CURTA,
      natureza: "CALCULADO",
      nota: `${n(ultimo.por_grupo_reconhecidos[grupoLider])} registros, ${n((100 * ultimo.por_grupo_reconhecidos[grupoLider]) / ultimo.registros_reconhecidos, 0)}% do ano. Tipologia oficial da Defesa Civil (COBRADE), agrupada pela plataforma.`,
      tamanho: "m",
    },
    ...(danos
      ? [
          {
            rotulo: `Desalojados registrados em ${ultimo.ano}`,
            valor: danos.desalojados,
            formato: "inteiro" as const,
            unidade: "pessoas",
            periodo: String(ultimo.ano),
            fonte: FONTE_CURTA,
            natureza: "CALCULADO" as const,
            nota: `E ${n(danos.desabrigados)} desabrigados. Soma dos formulários dos municípios; zero na base também pode ser campo não preenchido.`,
          },
        ]
      : []),
  ];

  return (
    <main className="bg-papel">
      {/* o layout do Território abre o destino do "Pular para o conteúdo" (#conteudo); o molde fica dentro deste <main> */}
      <PaginaPainel
        rota="/territorio/desastres"
        principal={false}
        abertura={{
          acento: "obee",
          titulo: "Onde os desastres atingem os municípios?",
          lead: (
            <>
              Secas, chuvas, deslizamentos e outros desastres que a União reconheceu em cada município, de {primeiro.ano} a {ultimo.ano}, por tipo e por estado, e os danos
              humanos que os municípios registraram.
            </>
          ),
          recorte: {
            periodo: `${primeiro.ano} a ${ultimo.ano}`,
            universo: "Brasil, 5.570 municípios",
            unidade: "registros municipais com reconhecimento federal",
            fonte: FONTE_CURTA,
          },
          limite: "o número de desastres, porque uma mesma chuva em vários municípios gera vários registros e um município que não pediu reconhecimento fica de fora mesmo tendo sofrido um desastre.",
        }}
        rotuloNumeros={`Desastres reconhecidos em ${ultimo.ano}`}
        numeros={numeros}
        notaNumeros={
          <>
            <p className="text-carvao">
              A contagem é de registros municipais que obtiveram reconhecimento federal. Uma mesma chuva em vários municípios gera vários
              registros, e um município que não pediu reconhecimento fica de fora mesmo tendo sofrido um desastre.
            </p>
            {!corrente.disponivel && (
              <p className="mt-2">
                {corrente.ano} ainda não está disponível: a base consolidada vai até {dataBr(g.fonte.cobertura_eventos.fim)}. Os reconhecimentos de {corrente.ano} estão no S2iD,
                que não aceita consultas de fora do Brasil; não são zero.
              </p>
            )}
          </>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="serie-reconhecidos"
              pergunta={`Os reconhecimentos de cada ano, de ${primeiro.ano} a ${ultimo.ano}`}
              subtitulo="Registros municipais com reconhecimento federal · Brasil · por ano da ocorrência e tipo de desastre"
              natureza="OBSERVADO"
              proveniencia={origem(g, "Registros municipais com reconhecimento federal, por ano e grupo de tipologia", String(primeiro.ano), String(ultimo.ano))}
              extraFonte={<>Versão capturada em {dataBr(g.capturadoEm)}.</>}
              ressalva="As regras de reconhecimento mudaram em 2012, 2016, 2020 e 2022: anos distantes medem também mudança de regra."
              naoConcluir="que houve mais desastres num ano do que em outro: a contagem é de registros municipais que obtiveram reconhecimento federal, e as regras de reconhecimento mudaram ao longo da série."
              tabela={{
                titulo: `Registros municipais com reconhecimento federal por ano, ${primeiro.ano} a ${ultimo.ano}`,
                colunas: ["Ano", "Reconhecidos", ...GRUPOS.map((gr) => ROTULO_CURTO[gr]), "Municípios distintos"],
                linhas: serie.map((a) => [String(a.ano), a.registros_reconhecidos, ...GRUPOS.map((gr) => a.por_grupo_reconhecidos[gr]), a.municipios_distintos_com_reconhecimento]),
                casas: [null, 0, ...GRUPOS.map(() => 0), 0],
                limite: serie.length,
              }}
              depois={<DoDesastreAoReconhecimento />}
            >
              <GraficoBarras
                semTabela
                titulo={`Registros municipais com reconhecimento federal por ano, ${primeiro.ano} a ${ultimo.ano}, por grupo de tipologia`}
                dados={serie.map((a) => ({ ano: String(a.ano), ...Object.fromEntries(GRUPOS.map((gr) => [gr, a.por_grupo_reconhecidos[gr]])) }))}
                chaveCategoria="ano"
                series={GRUPOS.map((gr, i) => ({ id: gr, rotulo: ROTULO_CURTO[gr], cor: COR_GRUPO[i] }))}
                unidade="registros"
                casas={0}
                empilhado
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="ufs-desastres"
              pergunta={`Os estados em ${anoUf}`}
              subtitulo={`Registros com reconhecimento federal por estado · ${anoUf} · contagem sem divisão pelo número de municípios`}
              natureza="OBSERVADO"
              proveniencia={origem(g, "Registros com reconhecimento federal e municípios distintos por estado", String(anoUf), String(anoUf))}
              leitura={
                <LeituraGuiada>
                  {NOME_UF[ufLider] ?? ufLider} teve mais registros reconhecidos ({n(dadosUf.registros_reconhecidos)}, em {n(dadosUf.municipios_distintos)} municípios). Estados com
                  mais municípios tendem a somar mais registros: a contagem não está dividida pelo número de municípios.
                </LeituraGuiada>
              }
              naoConcluir="que um estado é mais atingido ou mais vulnerável que outro: estados com mais municípios somam mais registros, e só entra quem pediu e obteve o reconhecimento."
              tabela={{
                titulo: `Registros com reconhecimento federal e municípios distintos por estado, ${anoUf}`,
                colunas: ["Unidade da Federação", "Reconhecidos", "Municípios distintos", ...GRUPOS.map((gr) => ROTULO_CURTO[gr])],
                linhas: ufs.map(([uf, u]) => [NOME_UF[uf] ?? uf, u.registros_reconhecidos, u.municipios_distintos, ...GRUPOS.map((gr) => u.por_grupo[gr])]),
                casas: [null, 0, 0, ...GRUPOS.map(() => 0)],
                limite: ufs.length,
              }}
            >
              <GraficoBarras
                semTabela
                titulo={`Registros com reconhecimento federal por estado, ${anoUf}`}
                dados={ufs.map(([uf, u]) => ({ uf, nome: NOME_UF[uf] ?? uf, registros: u.registros_reconhecidos }))}
                chaveCategoria="uf"
                chaveRotulo="nome"
                series={[{ id: "registros", rotulo: "Registros reconhecidos", cor: "var(--cor-obee)" }]}
                unidade="registros"
                casas={0}
                orientacao="horizontal"
                limiteInicial={10}
                rotulosValor
                rotulosSaoNomes
              />
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <TabelaDados
            id="danos-desastres"
            recolhida={false}
            tituloVisivel="As pessoas atingidas, desde 2013"
            lead={
              <>
                Óbitos, desabrigados (sem abrigo próprio, em abrigo público) e desalojados (fora de casa, em casa de parentes ou amigos), somados de todos os registros do ano,
                reconhecidos ou não. Começa em 2013, primeiro ano inteiro com o formulário eletrônico do S2iD; antes disso a série não é comparável.
              </>
            }
            titulo="Danos humanos registrados por ano, desde 2013"
            colunas={["Ano", "Óbitos", "Desabrigados", "Desalojados", "Registros sem nenhum dano humano informado"]}
            linhas={linhasDanos.map((d) => [String(d.ano), d.obitos, d.desabrigados, d.desalojados, `${n(d.registros_sem_nenhum_dano_humano_informado)} de ${n(d.registros)}`])}
            casas={[null, 0, 0, 0, null]}
            limite={linhasDanos.length}
            nota={
              <>
                Na base, campo não preenchido aparece como zero: a última coluna mostra quantos registros não têm nenhum dano humano informado. Os danos são os do momento do
                registro e não são atualizados depois: um desaparecido que morre não vira óbito na base. &ldquo;Afetados&rdquo; não é publicado: o total da base não fecha com a
                soma das categorias em cerca de um quarto dos registros.
              </>
            }
          />
        }
        metodo={
          <>
            <p>
              Fonte: {g.fonte.nome} (<a href={g.fonte.pagina} className="underline decoration-linha underline-offset-4">página de downloads</a>,{" "}
              <a href={g.fonte.manual} className="underline decoration-linha underline-offset-4">manual</a>). {g.fonte.licenca} {g.fonte.cadencia}
            </p>
            <p>Unidade: {g.unidade} {g.ano_de_referencia}</p>
            <p>Grupos de tipologia: {GRUPOS.map((gr) => g.grupos[gr]).join("; ")}.</p>
            <ul className="list-disc space-y-2 pl-5">{g.ressalvas.map((r) => <li key={r}>{r}</li>)}</ul>
            {g.bloqueios.length > 0 && (
              <p>
                Fonte primária dos reconhecimentos, não acessada nesta captura: {g.bloqueios.map((b) => b.url).join(", ")} (bloqueio de acesso por localização).
                Por isso não há ano corrente, número de portaria nem separação entre situação de emergência e estado de calamidade.
              </p>
            )}
            <p>
              Captura em {dataBr(g.capturadoEm)}; último registro na base em {dataBr(g.fonte.ultimo_registro_na_base)}. Cada arquivo original tem sha256 e tamanho
              registrados. Conferência em 18/10/2026: registros por grupo, óbitos e desabrigados mais desalojados por ano batem com o painel oficial do Atlas.
            </p>
            <p>
              {FONTE}. Registros com reconhecimento federal e municípios distintos por estado.
            </p>
            <p>
              <a href="/territorio/gold/desastres.json" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Baixar os dados deste painel (JSON)</a>
            </p>
          </>
        }
      />
    </main>
  );
}
