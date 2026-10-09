"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { InclusaoOpcoes } from "@/components/energia/InclusaoOpcoes";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { URL_GEO } from "@/lib/energia/geo";
import {
  COLUNAS_UFS_TSEE,
  ESQUEMA_TSEE,
  MEDIDA_MAPA_TSEE,
  MEDIDA_TSEE,
  classificacaoMapaTsee,
  codigoUf,
  dadosHistoricoUf,
  dadosSerieTsee,
  linhasUfsTsee,
  mes,
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

const OPCOES_MEDIDA: readonly (readonly [MedidaTsee, string])[] = [
  ["uc", "UC com Tarifa Social"],
  ["part", "% das UC residenciais"],
  ["dmr", "DMR (R$ milhões)"],
];

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
  const [v, definir] = useEstadoUrl(ESQUEMA_TSEE);
  const m = MEDIDA_TSEE[v.medida];
  const dados = useMemo(() => dadosSerieTsee(serie, v.medida), [serie, v.medida]);
  const temIncompleto = dados.some((d) => d.incompleto !== null);
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;
  const series = [
    { id: "completo", rotulo: `${m.rotulo}, meses completos`, sigla: "Completo", cor: "var(--cor-energia)" },
    ...(temIncompleto ? [{ id: "incompleto", rotulo: "Mês incompleto (fora da comparação)", sigla: "Incompleto", cor: "var(--serie-referencia)", tracejada: true }] : []),
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {resposta}
        <InclusaoOpcoes rotulo="Medida" nome="inclusao-ts-medida" opcoes={OPCOES_MEDIDA} valor={v.medida} onMudar={(medida) => definir({ medida })} />
      </div>
      <GraficoLinhas
        titulo={`${m.titulo} (SCS, ${mes(serie[0]?.m)} a ${mes(serie.at(-1)?.m)})`}
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
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{textoMesesIncompletosScs(serie)}</p>
      {recorte}
      {notas}
    </div>
  );
}

const OPCOES_MAPA: readonly (readonly [MedidaMapaTsee, string])[] = [
  ["faturas", "Faturas com desconto"],
  ["medio", "Desconto médio por fatura"],
  ["desconto", "Desconto das faturas"],
];
const OPCOES_HIST: readonly (readonly [MedidaHistUf, string])[] = [
  ["faturas", "Faturas com desconto"],
  ["desconto", "Desconto das faturas (R$ milhões)"],
];
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
  const [v, definir] = useEstadoUrl(ESQUEMA_TSEE);
  const [aviso, setAviso] = useState("");
  const med = MEDIDA_MAPA_TSEE[v.mapa];
  const valores = useMemo(() => valoresMapaTsee(ufs, v.mapa), [ufs, v.mapa]);
  const classes = useMemo(() => classificacaoMapaTsee(valores, med.casas), [valores, med.casas]);
  const temNegativo = useMemo(() => valoresTemNegativo(valores), [valores]);
  const notaMapa = textoDescontoNegativoMapa(ufs, v.mapa);
  const notaTabela = textoDescontoNegativoUf(ufs);
  const linhas = useMemo(() => linhasUfsTsee(ufs), [ufs]);
  const escolhidas = v.ufs.filter((u) => ufs.some((x) => x.uf === u));
  const ultima = escolhidas.at(-1) ?? null;

  const alternar = (uf: string | null) => {
    if (!uf) {
      if (ultima) definir({ ufs: escolhidas.filter((x) => x !== ultima) });
      return;
    }
    const r = alternarSelecao(escolhidas, uf, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(`Limite de ${LIMITE_COMPARACAO} UF na comparação: remova uma para incluir ${uf}.`);
      return;
    }
    setAviso("");
    definir({ ufs: r.ids });
  };

  return (
    <div className="space-y-6">
      <InclusaoOpcoes rotulo="Mapa" nome="inclusao-ts-mapa" opcoes={OPCOES_MAPA} valor={v.mapa} onMudar={(mapa) => definir({ mapa })} />
      <MapaCoropletico
        titulo={`${med.rotulo} por UF, ${mes(mesMapa)} (Beneficiários da CDE)`}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={temNegativo ? [COR_NEGATIVA, ...CORES_MAPA] : CORES_MAPA}
        classificacao={classes}
        unidade={med.unidade}
        casas={med.casas}
        rotuloRegiao={{ singular: "UF", plural: "UF" }}
        selecionado={ultima ? codigoUf(ultima) : null}
        onSelecionar={(id) => alternar(siglaDoCodigo(id))}
        rotulos
        periodo={mes(mesMapa)}
        nota={`Faturas, não UC nem famílias. Clique numa UF para incluí-la no histórico (até quatro); clique de novo para retirar.${notaMapa ? ` ${notaMapa}` : ""}`}
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <TabelaInterativa
        titulo={`Tarifa Social por UF, ${mes(mesMapa)}: faturas e desconto`}
        colunas={COLUNAS_UFS_TSEE}
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
        dicaBusca="Nome ou sigla da UF"
        nota={
          <>
            Faturas de faturamento com desconto da Tarifa Social (subclasses 3.2 a 3.6). A soma das UF mais as faturas sem município válido é o total nacional.
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
    () => (serieUf ? textoDescontoNegativoHistorico(serieUf, escolhidas, nomeUf, atingidas) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
    [serieUf, escolhidas.join(","), atingidas, ufs],
  );

  return (
    <div className="space-y-4">
      <Comparador
        rotulo="UF no histórico (até 4)"
        entidades={entidades}
        selecionadas={escolhidas}
        onMudar={(ids) => definir({ ufs: ids })}
        dicaBusca="Nome ou sigla da UF"
        vazio="Nenhuma UF escolhida. Escolha aqui, no mapa ou na tabela acima."
      >
        {() => null}
      </Comparador>
      <InclusaoOpcoes rotulo="Histórico" nome="inclusao-ts-hist" opcoes={OPCOES_HIST} valor={v.hist} onMudar={(hist) => definir({ hist })} />
      {precisa && !serieUf && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          Carregando a série mensal por UF…
        </p>
      )}
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          Não foi possível carregar a série por UF ({erro}). O mesmo dado está em{" "}
          <a href="/energia/series/inclusao_cde_mensal_uf.csv" download className="text-energia-dark underline underline-offset-4">
            faturas com desconto por UF e mês (CSV)
          </a>
          .
        </p>
      )}
      {serieUf && escolhidas.length > 0 && (
        <>
          <GraficoLinhas
            titulo={`${v.hist === "faturas" ? "Faturas com desconto" : "Desconto das faturas"} por mês nas UF escolhidas`}
            dados={historico}
            chaveX="m"
            formatoX="mes"
            series={escolhidas.map((uf, i) => ({ id: uf, rotulo: nomeUf(uf), sigla: uf, cor: CORES_COMP[i % CORES_COMP.length] }))}
            unidade={v.hist === "faturas" ? "faturas" : "R$ milhões"}
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
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{textoLacunasHistorico(escolhidas, atingidas, serieUf.meses)}</p>
        </>
      )}
    </div>
  );
}
