"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";
import { Controles, FaixaNumeros, FiguraAnalitica, GraficoBarras, NumeroIndicador, TabelaDados, type NumeroProps } from "@/components/painel";
import { provenienciaObee } from "@/lib/eficiencia/proveniencia";
import { BASE, formato } from "./modelo";

export type Dados = {
  capturadoEm: string;
  universo: string;
  estagio: string;
  baseReal: string;
  periodos: string[];
  territorios: { id: string; nome: string }[];
  observacoes: {
    territorioId: string;
    periodo: string;
    valor: number | null;
    real2025: number | null;
    status: string;
    conferencia: string;
    rreoValor: number | null;
    diferencaRreo: number | null;
    composicaoReconcilia: boolean;
    residuoComposicao: number | null;
    nota: string;
    notaMaterial?: boolean;
    elegivelComparacao: boolean;
  }[];
  subfuncoes: { territorioId: string; periodo: string; codigo: string; nome: string; valor: number | null; reconcilia: boolean }[];
  proveniencia: { territorioId: string; periodo: string; dca: { url: string; recorte?: string; sha256?: string }; rreo?: { url: string } }[];
  fontes?: { id: string; nome: string; url: string; limitacoes: string }[];
};

/**
 * Recursos públicos para o trabalho no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A página do servidor monta a
 * abertura; aqui ficam as ilhas que seguem o recorte da URL (capital, ano, valores nominais ou reais e escala): a faixa de números, os
 * controles logo antes da distribuição das capitais, as tabelas da evolução e da composição (à vista, como antes) e o método com as
 * consultas da capital e do ano. A base vai ao navegador uma vez só, pelo ProvedorRecursos, que as quatro ilhas leem.
 *
 * Escala: na linear, as barras do kit desde zero; na logarítmica, que o kit não tem, os pontos do desenho próprio, marcados
 * data-figura-legado, com a mesma frase de antes (distâncias representam razões, zero fica só na tabela).
 */
const Contexto = createContext<Dados | null>(null);

export function ProvedorRecursos({ dados, children }: { dados: Dados; children: ReactNode }) {
  return <Contexto.Provider value={dados}>{children}</Contexto.Provider>;
}

function useRecorteRecursos() {
  const dados = useContext(Contexto);
  if (!dados) throw new Error("Base de recursos ausente: use ProvedorRecursos.");
  const esquema = useMemo(
    () => ({
      ter: campo(tiposUrl.opcao(dados.territorios.map((t) => t.id)), dados.territorios[0].id),
      ano: campo(tiposUrl.opcao(dados.periodos), dados.periodos.at(-1)!),
      moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as const),
      esc: campo(tiposUrl.opcao(["linear", "log"] as const), "linear" as const),
    }),
    [dados],
  );
  const [estado, definir] = useEstadoUrl(esquema);
  const nomeDe = (id: string) => dados.territorios.find((t) => t.id === id)?.nome ?? id;
  const ter = dados.territorios.find((t) => t.id === estado.ter)!;
  const o = dados.observacoes.find((x) => x.territorioId === estado.ter && x.periodo === estado.ano);
  const linhas = dados.observacoes.filter((x) => x.periodo === estado.ano).sort((a, b) => nomeDe(a.territorioId).localeCompare(nomeDe(b.territorioId), "pt-BR"));
  const serie = dados.observacoes.filter((x) => x.territorioId === estado.ter).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const subs = dados.subfuncoes.filter((x) => x.territorioId === estado.ter && x.periodo === estado.ano);
  const prov = dados.proveniencia.find((p) => p.territorioId === estado.ter && p.periodo === estado.ano);
  const valor = (v: Dados["observacoes"][number]) => (estado.moeda === "real" ? v.real2025 : v.valor);
  const rotuloMoeda = estado.moeda === "real" ? "reais de 2025" : "valores nominais";
  const padrao = estado.ter === dados.territorios[0].id && estado.ano === dados.periodos.at(-1) && estado.moeda === "nominal" && estado.esc === "linear";
  return { dados, estado, definir, nomeDe, ter, o, linhas, serie, subs, prov, valor, rotuloMoeda, padrao };
}

const fonteCurta = "Tesouro Nacional, Siconfi";
const natureza = (moeda: string) => (moeda === "real" ? "CALCULADO" : "OBSERVADO");

/** A faixa: a despesa da capital no ano, a conferência entre as declarações e quantas capitais entram na comparação. */
export function FaixaRecursos() {
  const { dados, estado, ter, o, linhas, valor, rotuloMoeda } = useRecorteRecursos();
  const v = o ? valor(o) : null;
  const numeros: NumeroProps[] = [
    v === null
      ? { rotulo: `Despesa liquidada · ${ter.nome}`, valor: null, motivoAusencia: o ? "A capital não declarou valor na função Trabalho neste ano." : "Sem declaração da capital para este ano na base.", unidade: rotuloMoeda, periodo: estado.ano, fonte: fonteCurta, natureza: natureza(estado.moeda) }
      : { rotulo: `Despesa liquidada · ${ter.nome}`, valor: v, valorTexto: formato(v, "R$"), formato: "texto", unidade: "", periodo: estado.ano, recorte: rotuloMoeda, fonte: fonteCurta, natureza: natureza(estado.moeda) },
    { rotulo: "Conferência DCA × RREO", valorTexto: o?.conferencia ?? "Ausente", formato: "texto", unidade: "", periodo: estado.ano, recorte: "mesmo ano, função e estágio contábil", fonte: fonteCurta, natureza: "CALCULADO", tamanho: "p" },
    { rotulo: "Elegíveis para comparação", valor: linhas.filter((x) => x.elegivelComparacao).length, valorTexto: `${linhas.filter((x) => x.elegivelComparacao).length} / ${dados.territorios.length}`, formato: "texto", unidade: "capitais", periodo: estado.ano, recorte: "capitais com valores conferidos no ano", fonte: fonteCurta, natureza: "CALCULADO" },
  ];
  return (
    <FaixaNumeros
      idioma="pt"
      nota={
        <>
          <strong className="font-medium text-carvao">Perímetro:</strong> {dados.universo} Estágio: {dados.estagio}. Não é custo por atendimento ou por colocação no emprego. {estado.moeda === "real" ? dados.baseReal + "." : ""} Os números seguem o recorte escolhido logo abaixo.
        </>
      }
    >
      {numeros.map((n, i) => (
        <NumeroIndicador key={n.rotulo} {...n} tamanho={n.tamanho ?? (i === 0 ? "g" : "m")} idioma="pt" />
      ))}
    </FaixaNumeros>
  );
}

const campoSelect = "mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm text-carvao";
const rotuloCampo = "flex min-w-[12rem] flex-1 flex-col text-sm text-carvao";
const botao = "inline-flex min-h-[44px] items-center border px-3 text-sm";

/** Os controles do recorte e a distribuição das capitais no ano, com a tabela completa (inclusive ausências) como tabela equivalente. */
export function FiguraRecursos({ rota }: { rota: string }) {
  const { dados, estado, definir, nomeDe, ter, o, linhas, prov, valor, rotuloMoeda, padrao } = useRecorteRecursos();
  const elegiveis = linhas.filter((x) => x.elegivelComparacao);
  const positivos = elegiveis.filter((x) => valor(x)! > 0).map((x) => valor(x)!);
  const minimo = Math.min(...positivos);
  const max = Math.max(...elegiveis.map((x) => valor(x) ?? 0), 1);
  const fonte = dados.fontes?.[0];
  function exportar() {
    const campos = ["territorio", "periodo", "despesa_nominal", "despesa_real_2025", "estado", "conferencia", "elegivel_comparacao", "nota"];
    const conteudo =
      "﻿" +
      [campos.join(";"), ...linhas.map((x) => [nomeDe(x.territorioId), x.periodo, x.valor, x.real2025, x.status, x.conferencia, x.elegivelComparacao, x.nota].map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"').join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trabalho-recursos-${estado.ano}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const proveniencia = provenienciaObee({
    indicador: "Despesa liquidada na função 11 Trabalho",
    natureza: natureza(estado.moeda),
    orgao: "Tesouro Nacional",
    dataset: "Siconfi, DCA Anexo I-E",
    recurso: prov?.dca.url,
    url: fonte?.url ?? prov?.dca.url ?? "",
    urlPrimaria: prov?.dca.url,
    unidade: estado.moeda === "real" ? `R$ de 2025 (${dados.baseReal})` : "R$ nominais",
    frequencia: "anual",
    inicio: estado.ano,
    fim: estado.ano,
    cobertura: { inicio: dados.periodos[0], fim: dados.periodos.at(-1)! },
    capturadoEm: dados.capturadoEm,
    transformacoes: [`Estágio: ${dados.estagio}.`, "Conferência com o RREO, Anexo 02, sexto bimestre, no mesmo ano, função e estágio.", ...(estado.moeda === "real" ? [`${dados.baseReal}.`] : [])],
    limitacoes: [dados.universo, ...(fonte ? [fonte.limitacoes] : [])],
    snapshot: prov?.dca.recorte ? { id: prov.dca.recorte, sha256: prov.dca.sha256 ?? null } : undefined,
  });
  return (
    <>
      <Controles rotulo="Recorte da análise" resumo={`${ter.nome} · ${estado.ano} · ${rotuloMoeda} · escala ${estado.esc === "log" ? "logarítmica" : "linear"}`} limpar={padrao ? undefined : { href: rota }} idioma="pt">
        <label className={rotuloCampo}>
          Capital
          <select className={campoSelect} value={estado.ter} onChange={(e) => definir({ ter: e.target.value })}>
            {dados.territorios.map((t) => (
              <option value={t.id} key={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <label className={rotuloCampo}>
          Ano
          <select className={campoSelect} value={estado.ano} onChange={(e) => definir({ ano: e.target.value })}>
            {dados.periodos.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className={rotuloCampo}>
          Valores
          <select className={campoSelect} value={estado.moeda} onChange={(e) => definir({ moeda: e.target.value as typeof estado.moeda })}>
            <option value="nominal">Nominais do ano</option>
            <option value="real">Reais de 2025 · IPCA</option>
          </select>
        </label>
        <div role="group" aria-label="Escala da distribuição" className="flex flex-wrap items-end gap-2">
          {(["linear", "log"] as const).map((e) => (
            <button key={e} type="button" aria-pressed={estado.esc === e} onClick={() => definir({ esc: e })} className={`${botao} ${estado.esc === e ? "border-carvao bg-carvao text-marfim" : "border-linha bg-superficie text-carvao"}`}>
              {e === "linear" ? "Barras · escala linear" : "Pontos · escala logarítmica"}
            </button>
          ))}
        </div>
      </Controles>
      <FiguraAnalitica
        id="distribuicao"
        idioma="pt"
        pergunta="Como se distribuem as declarações conferidas?"
        subtitulo={`Função 11 Trabalho · despesa liquidada · ${estado.moeda === "real" ? "reais de 2025" : "R$ nominais"} · capitais elegíveis · ${estado.ano}`}
        natureza={natureza(estado.moeda)}
        proveniencia={proveniencia}
        comoInterpretar={
          estado.esc === "log"
            ? `Escala logarítmica: distâncias representam razões, não diferenças em reais. Valores positivos vão de ${formato(minimo, "R$")} a ${formato(max, "R$")}; valores zero continuam na tabela e não recebem um ponto nessa escala.`
            : "Ordem alfabética, barras a partir de zero. Apenas observações elegíveis entram no gráfico. Ausências e divergências continuam na tabela."
        }
        ressalva={
          o && !o.elegivelComparacao ? (
            <>
              <strong className="font-medium">Valor fora da comparação.</strong> {o.nota} A declaração permanece visível para consulta; não participa da referência comparativa.
            </>
          ) : undefined
        }
        naoConcluir="Se o recurso foi bem ou mal aplicado: a classificação funcional não cobre todas as ações de emprego e renda, e divergências entre declarações não mostram a qualidade do gasto. Não é custo por atendimento."
        tabela={{
          titulo: `Função 11 Trabalho · ${estado.ano} · ${estado.moeda === "real" ? "reais de 2025" : "nominal"} · 26 capitais, inclusive ausências`,
          colunas: ["Capital", "Conferência", "Nota material", "Despesa"],
          linhas: linhas.map((x) => [nomeDe(x.territorioId), x.conferencia, x.nota, formato(valor(x), "R$")]),
          limite: 30,
        }}
        complemento={
          <ExportacaoComConta rotulo="Baixar comparação completa CSV">
            <button type="button" onClick={exportar} className={`${botao} border-linha bg-superficie text-obee-dark`}>
              Baixar comparação completa CSV
            </button>
          </ExportacaoComConta>
        }
      >
        {estado.esc === "linear" ? (
          <GraficoBarras
            titulo={`Despesa liquidada na função Trabalho, capitais elegíveis, ${estado.ano}, ${rotuloMoeda}`}
            series={[{ id: "despesa", nome: "Despesa liquidada", pontos: elegiveis.map((x) => ({ x: x.territorioId, rotulo: nomeDe(x.territorioId), y: valor(x) })) }]}
            eixoY={{ unidade: "R$", zero: true, casas: 2 }}
            orientacao="horizontal"
            alturaCategoria={32}
            rotulosValor
            rotulosSaoNomes
            selecionado={ter.id}
          />
        ) : (
          <ul className="tr-barlist" data-figura-legado="escala-logaritmica" aria-label={`Despesa liquidada na função Trabalho em escala logarítmica, capitais elegíveis, ${estado.ano}; valores na tabela equivalente`}>
            {elegiveis.map((x) => (
              <li key={x.territorioId} data-foco={x.territorioId === ter.id}>
                <span>{nomeDe(x.territorioId)}</span>
                <div aria-hidden="true" className="tr-bartrack">
                  {(valor(x) ?? 0) > 0 ? <span className="tr-dot" style={{ left: `${max === minimo ? 50 : ((Math.log(valor(x)!) - Math.log(minimo)) / (Math.log(max) - Math.log(minimo))) * 100}%` }} /> : null}
                </div>
                <strong className="text-xs">{formato(valor(x), "R$")}</strong>
              </li>
            ))}
          </ul>
        )}
      </FiguraAnalitica>
    </>
  );
}

/** A evolução da capital e a composição por subfunção no ano: tabelas à vista, como antes, na fatia `tabelas`. */
export function TabelasRecursos() {
  const { estado, ter, o, serie, subs, valor } = useRecorteRecursos();
  return (
    <>
      <TabelaDados
        idioma="pt"
        recolhida={false}
        id="evolucao"
        tituloVisivel="A evolução da capital"
        titulo={`${ter.nome} · função Trabalho`}
        colunas={["Ano", "Conferência", "Nota material", `Despesa · ${estado.moeda === "real" ? "reais de 2025" : "nominal"}`]}
        linhas={serie.map((x) => [x.periodo, x.conferencia, x.nota, formato(valor(x), "R$")])}
        nota="Valores ausentes não representam ausência de política pública. A função contábil não cobre despesas classificadas em outras funções."
      />
      <TabelaDados
        idioma="pt"
        recolhida={false}
        id="composicao"
        tituloVisivel="Do que se compõe o valor declarado?"
        lead={`Subfunções declaradas pela prefeitura em ${estado.ano}, em valores nominais. A soma é conferida contra o total da função; não indica financiamento federal ou estadual no território.${subs.length ? "" : " Composição indisponível para esta capital e ano."}`}
        titulo={`${ter.nome} · composição nominal · ${estado.ano}`}
        colunas={["Código", "Subfunção", "Despesa nominal"]}
        linhas={subs.map((x) => [x.codigo, x.nome, formato(x.valor, "R$")])}
        nota={o?.composicaoReconcilia ? "A composição reconcilia com o total declarado." : `A composição não está reconciliada com o total. Resíduo declarado: ${formato(o?.residuoComposicao ?? null, "R$")}.`}
      />
    </>
  );
}

/** O método: a fonte, a captura, o ano de referência e as consultas DCA e RREO da capital e do ano escolhidos, e a base completa. */
export function MetodoRecursos() {
  const { dados, estado, prov } = useRecorteRecursos();
  const link = "inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4";
  return (
    <>
      <p>
        Tesouro Nacional · Siconfi. DCA, Anexo I-E; RREO, Anexo 02, sexto bimestre. Captura do conjunto: {new Date(dados.capturadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília). Ano de referência é {estado.ano}.
      </p>
      {dados.fontes?.[0] && <p>{dados.fontes[0].limitacoes}</p>}
      <p className="flex flex-wrap gap-x-6">
        {prov?.dca && (
          <a className={link} href={prov.dca.url}>
            Consulta DCA
          </a>
        )}
        {prov?.rreo && (
          <a className={link} href={prov.rreo.url}>
            Consulta RREO
          </a>
        )}
        <a className={link} href="/eficiencia/trabalho-renda/recursos.json" download>
          Baixar base e proveniência JSON
        </a>
      </p>
      <p className="flex flex-wrap gap-x-6">
        <Link href={`${BASE}/metodos`} className={link}>
          Método e limites do núcleo →
        </Link>
        <Link href={BASE} className={link}>
          Voltar ao panorama →
        </Link>
      </p>
    </>
  );
}
