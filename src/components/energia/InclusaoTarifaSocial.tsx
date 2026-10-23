"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { InclusaoOpcoes } from "@/components/energia/InclusaoOpcoes";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { URL_GEO } from "@/lib/energia/geo";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { txEm } from "@/lib/energia/i18n/conta-inclusao";
import {
  ESQUEMA_TSEE,
  classificacaoMapaTsee,
  codigoUf,
  colunasUfsTsee,
  dadosHistoricoUf,
  dadosSerieTsee,
  linhasUfsTsee,
  medidaMapaTsee,
  medidaTsee,
  mes as mesEm,
  siglaDoCodigo,
  textoDescontoNegativoHistorico,
  textoDescontoNegativoMapa,
  textoDescontoNegativoUf,
  textoLacunasHistorico,
  textoMesesIncompletosScs,
  valoresMapaTsee,
  valoresTemNegativo,
  type MedidaHistUf,
  type MedidaMapaTsee,
  type MedidaTsee,
} from "@/lib/energia/inclusao";
import { LIMITE_COMPARACAO, alternarSelecao } from "@/lib/energia/tabela";
import type { PontoSerieTsee, SerieCdeUf, UfTsee } from "@/lib/energia/tipos-inclusao";

/**
 * P059, Tarifa Social: a evolução nacional (SCS) com a medida e o intervalo na
 * URL, o mapa por UF das faturas com desconto (CDE) sincronizado com a tabela e
 * o histórico mensal de até quatro UF, que a página põe em seções com pergunta própria
 * (cada uma lê a UF escolhida da mesma URL). O histórico por UF (JSON de cerca de
 * 10 KB) só é baixado quando alguma UF é escolhida (contrato, seção 5.1).
 *
 * A figura principal recebe a resposta, o recorte e as notas já prontos, para vir primeiro e
 * ter a ressalva junto de si.
 *
 * Nenhum número é refeito aqui: as linhas vêm de src/lib/energia/inclusao.ts, que
 * só seleciona e converte unidade (UC para milhões de UC, R$ para R$ milhões).
 */

function opcoesMedida(idioma: Idioma): readonly (readonly [MedidaTsee, string])[] {
  const tx = txEm(idioma);
  return [
    ["uc", tx("UC com Tarifa Social", "Consumer units with Tarifa Social")],
    ["part", tx("% das UC residenciais", "% of residential consumer units")],
    ["dmr", tx("DMR (R$ milhões)", "DMR (R$ million)")],
  ];
}

export function InclusaoSerieTsee({
  serie,
  marcos,
  resposta,
  recorte,
  notas,
}: {
  serie: PontoSerieTsee[];
  marcos: { x: string; rotulo: string }[];
  resposta?: ReactNode;
  recorte?: ReactNode;
  notas?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const mes = (x: string | null | undefined) => mesEm(x, idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_TSEE);
  const m = medidaTsee(idioma)[v.medida];
  const dados = useMemo(() => dadosSerieTsee(serie, v.medida), [serie, v.medida]);
  const temIncompleto = dados.some((d) => d.incompleto !== null);
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;
  const series = [
    { id: "completo", rotulo: tx(`${m.rotulo}, meses completos`, `${m.rotulo}, complete months`), sigla: tx("Completo", "Complete"), cor: "var(--cor-energia)" }, // i18n: dado
    ...(temIncompleto
      ? [
          {
            id: "incompleto",
            rotulo: tx("Mês incompleto (fora da comparação)", "Incomplete month (outside the comparison)"),
            sigla: tx("Incompleto", "Incomplete"),
            cor: "var(--serie-referencia)",
            tracejada: true,
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {resposta}
        <InclusaoOpcoes rotulo={tx("Medida", "Measure")} nome="inclusao-ts-medida" opcoes={opcoesMedida(idioma)} valor={v.medida} onMudar={(medida) => definir({ medida })} />
      </div>
      <GraficoLinhas
        titulo={tx(`${m.titulo} (SCS, ${mes(serie[0]?.m)} a ${mes(serie.at(-1)?.m)})`, `${m.titulo} (SCS, ${mes(serie[0]?.m)} to ${mes(serie.at(-1)?.m)})`)}
        dados={dados}
        chaveX="m"
        formatoX="mes"
        series={series}
        unidade={m.unidade}
        casas={m.casas}
        zeroNoEixo={v.medida !== "part"}
        marcos={marcos}
        zoom
        intervalo={intervalo}
        onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        altura={320}
      />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{textoMesesIncompletosScs(serie, idioma)}</p>
      {recorte}
      {notas}
    </div>
  );
}

function opcoesMapa(idioma: Idioma): readonly (readonly [MedidaMapaTsee, string])[] {
  const tx = txEm(idioma);
  return [
    ["faturas", tx("Faturas com desconto", "Bills with a discount")],
    ["medio", tx("Desconto médio por fatura", "Average discount per bill")],
    ["desconto", tx("Desconto das faturas", "Discount on the bills")],
  ];
}
function opcoesHist(idioma: Idioma): readonly (readonly [MedidaHistUf, string])[] {
  const tx = txEm(idioma);
  return [
    ["faturas", tx("Faturas com desconto", "Bills with a discount")],
    ["desconto", tx("Desconto das faturas (R$ milhões)", "Discount on the bills (R$ million)")],
  ];
}
const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
/** Classe própria do valor negativo na fonte: cor fora da escala do desconto positivo. */
const COR_NEGATIVA = "var(--escala-div-neg-1)";
const CORES_COMP = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];

// uma só requisição por visita, compartilhada pelas instâncias; falha não fica em cache
let promessaUf: Promise<SerieCdeUf> | null = null;
function carregarSerieUf(url: string): Promise<SerieCdeUf> {
  if (!promessaUf) {
    promessaUf = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<SerieCdeUf>;
    });
    promessaUf.catch(() => {
      promessaUf = null;
    });
  }
  return promessaUf;
}

export type InclusaoMapaTseeProps = {
  ufs: UfTsee[];
  mesMapa: string;
  fonte: string;
};

/** Mapa e tabela das faturas com desconto por UF no mês do mapa; as UF escolhidas (até quatro) vão para a URL e alimentam o histórico. */
export function InclusaoMapaTsee({ ufs, mesMapa, fonte }: InclusaoMapaTseeProps) {
  const idioma = useIdioma();
  const tx = useTx();
  const mes = (x: string | null | undefined) => mesEm(x, idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_TSEE);
  const [aviso, setAviso] = useState("");
  const med = medidaMapaTsee(idioma)[v.mapa];
  const valores = useMemo(() => valoresMapaTsee(ufs, v.mapa), [ufs, v.mapa]);
  const classes = useMemo(() => classificacaoMapaTsee(valores, med.casas), [valores, med.casas]);
  const temNegativo = useMemo(() => valoresTemNegativo(valores), [valores]);
  const notaMapa = textoDescontoNegativoMapa(ufs, v.mapa, idioma);
  const notaTabela = textoDescontoNegativoUf(ufs, idioma);
  const linhas = useMemo(() => linhasUfsTsee(ufs, idioma), [ufs, idioma]);
  const escolhidas = v.ufs.filter((u) => ufs.some((x) => x.uf === u));
  const ultima = escolhidas.at(-1) ?? null;

  const alternar = (uf: string | null) => {
    if (!uf) {
      if (ultima) definir({ ufs: escolhidas.filter((x) => x !== ultima) });
      return;
    }
    const r = alternarSelecao(escolhidas, uf, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(tx(`Limite de ${LIMITE_COMPARACAO} UF na comparação: remova uma para incluir ${uf}.`, `Limit of ${LIMITE_COMPARACAO} states in the comparison: remove one to include ${uf}.`));
      return;
    }
    setAviso("");
    definir({ ufs: r.ids });
  };

  return (
    <div className="space-y-6">
      <InclusaoOpcoes rotulo={tx("Mapa", "Map")} nome="inclusao-ts-mapa" opcoes={opcoesMapa(idioma)} valor={v.mapa} onMudar={(mapa) => definir({ mapa })} />
      {/* a TabelaInterativa por UF, logo abaixo e sincronizada com o mapa, é a tabela dele: o mapa não repete a sua (molde de painel) */}
      <MapaCoropletico
        semTabela
        titulo={tx(`${med.rotulo} por UF, ${mes(mesMapa)} (Beneficiários da CDE)`, `${med.rotulo} by state, ${mes(mesMapa)} (CDE Beneficiaries)`)}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={temNegativo ? [COR_NEGATIVA, ...CORES_MAPA] : CORES_MAPA}
        classificacao={classes}
        unidade={med.unidade}
        casas={med.casas}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={ultima ? codigoUf(ultima) : null}
        onSelecionar={(id) => alternar(siglaDoCodigo(id))}
        rotulos
        periodo={mes(mesMapa)}
        nota={tx(
          `Faturas, não UC nem famílias. Clique numa UF para incluí-la no histórico (até quatro); clique de novo para retirar.${notaMapa ? ` ${notaMapa}` : ""}`,
          `Bills, not consumer units or families. Click a state to include it in the history (up to four); click again to remove it.${notaMapa ? ` ${notaMapa}` : ""}`,
        )}
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <TabelaInterativa
        titulo={tx(`Tarifa Social por UF, ${mes(mesMapa)}: faturas e desconto`, `Tarifa Social by state, ${mes(mesMapa)}: bills and discount`)}
        colunas={colunasUfsTsee(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={mesMapa}
        nomeArquivo="inclusao-tarifa-social-uf"
        chaveUrl="ts.tab"
        ordemInicial={{ coluna: "faturas", direcao: "desc" }}
        selecionado={ultima}
        onSelecionar={(id) => alternar(id)}
        dicaBusca={tx("Nome ou sigla da UF", "State name or abbreviation")}
        nota={
          <>
            {tx(
              "Faturas de faturamento com desconto da Tarifa Social (subclasses 3.2 a 3.6). A soma das UF mais as faturas sem município válido é o total nacional.",
              "Billing invoices with the Tarifa Social discount (subclasses 3.2 to 3.6). The sum of the states plus the bills without a valid municipality is the national total.",
            )}
            {notaTabela && <span data-nota-desconto-negativo=""> {notaTabela}</span>}
          </>
        }
      />
    </div>
  );
}

export type InclusaoHistoricoUfTseeProps = {
  ufs: UfTsee[];
  serieUfUrl: string;
  /** Mês → UF → siglas das distribuidoras ausentes do arquivo (calculado no servidor a partir da gold). */
  atingidas: Record<string, Record<string, string[]>>;
  /** Eventos da gold no período da série da CDE (marcos do histórico). */
  marcos: { x: string; rotulo: string }[];
};

/** Histórico mensal das UF escolhidas (até quatro): o JSON só é baixado quando alguma UF é escolhida, aqui, no mapa ou na tabela. */
export function InclusaoHistoricoUfTsee({ ufs, serieUfUrl, atingidas, marcos }: InclusaoHistoricoUfTseeProps) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_TSEE);
  const [serieUf, setSerieUf] = useState<SerieCdeUf | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const entidades = useMemo(() => ufs.map((u) => ({ id: u.uf, rotulo: u.nome, sinonimos: [u.uf] })), [ufs]);
  const escolhidas = v.ufs.filter((u) => ufs.some((x) => x.uf === u));

  const precisa = escolhidas.length > 0;
  useEffect(() => {
    if (!precisa || serieUf) return;
    let vivo = true;
    setErro(null);
    carregarSerieUf(serieUfUrl)
      .then((j) => vivo && setSerieUf(j))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [precisa, serieUf, serieUfUrl]);

  const historico = useMemo(
    () => (serieUf ? dadosHistoricoUf(serieUf, escolhidas, v.hist, atingidas) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
    [serieUf, escolhidas.join(","), v.hist, atingidas],
  );
  const nomeUf = (uf: string) => ufs.find((x) => x.uf === uf)?.nome ?? uf;
  const notaNegativa = useMemo(
    () => (serieUf ? textoDescontoNegativoHistorico(serieUf, escolhidas, nomeUf, atingidas, idioma) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
    [serieUf, escolhidas.join(","), atingidas, ufs, idioma],
  );

  return (
    <div className="space-y-4">
      <Comparador
        rotulo={tx("UF no histórico (até 4)", "States in the history (up to 4)")}
        entidades={entidades}
        selecionadas={escolhidas}
        onMudar={(ids) => definir({ ufs: ids })}
        dicaBusca={tx("Nome ou sigla da UF", "State name or abbreviation")}
        vazio={tx("Nenhuma UF escolhida. Escolha aqui, no mapa ou na tabela acima.", "No state chosen. Choose here, on the map or in the table above.")}
      >
        {() => null}
      </Comparador>
      <InclusaoOpcoes rotulo={tx("Histórico", "History")} nome="inclusao-ts-hist" opcoes={opcoesHist(idioma)} valor={v.hist} onMudar={(hist) => definir({ hist })} />
      {precisa && !serieUf && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          {tx("Carregando a série mensal por UF…", "Loading the monthly series by state…")}
        </p>
      )}
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          {tx(`Não foi possível carregar a série por UF (${erro}). O mesmo dado está em`, `The series by state could not be loaded (${erro}). The same data is in`)}{" "}
          <a href="/energia/series/inclusao_cde_mensal_uf.csv" download className="text-energia-dark underline underline-offset-4">
            {tx("faturas com desconto por UF e mês (CSV)", "bills with a discount by state and month (CSV)")}
          </a>
          .
        </p>
      )}
      {serieUf && escolhidas.length > 0 && (
        <>
          <GraficoLinhas
            titulo={
              v.hist === "faturas"
                ? tx("Faturas com desconto por mês nas UF escolhidas", "Bills with a discount by month in the chosen states")
                : tx("Desconto das faturas por mês nas UF escolhidas", "Discount on the bills by month in the chosen states")
            }
            dados={historico}
            chaveX="m"
            formatoX="mes"
            series={escolhidas.map((uf, i) => ({ id: uf, rotulo: nomeUf(uf), sigla: uf, cor: CORES_COMP[i % CORES_COMP.length] }))}
            unidade={v.hist === "faturas" ? tx("faturas", "bills") : tx("R$ milhões", "R$ million")}
            casas={v.hist === "faturas" ? 0 : 1}
            zeroNoEixo
            marcos={marcos}
            altura={300}
          />
          {v.hist === "desconto" && notaNegativa && (
            <p role="note" data-nota-desconto-negativo="" className="max-w-prose2 text-sm leading-relaxed text-carvao">
              {notaNegativa}
            </p>
          )}
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{textoLacunasHistorico(escolhidas, atingidas, serieUf.meses, idioma)}</p>
        </>
      )}
    </div>
  );
}
