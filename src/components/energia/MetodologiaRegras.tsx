"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { COLUNAS_METRICAS, URL_GOLD, moduloDaGold, rotuloNatureza, urlCodigoMetrica, type MetricaPublicada } from "@/lib/energia/dados";
import type { LinhaTabela } from "@/lib/energia/tabela";

/**
 * P070, regras por indicador: a tabela dos indicadores publicados (módulo, natureza, unidade,
 * recortes) e, para a linha escolhida (?m=), a regra inteira: definição, fórmula, numerador e
 * denominador, agregação, cobertura, ausência, validações e limitações. A regra é lida de
 * metricas.json só ao escolher a linha (a mesma lista que o pipeline usa para calcular), para o
 * HTML não carregar as 276 regras.
 */

const ESQUEMA = { m: campo(tiposUrl.texto({ max: 200 }), "") };

type Carga = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; m: MetricaPublicada };

function useMetrica(id: string, n: number): Carga {
  const [c, setC] = useState<Carga>({ estado: "carregando" });
  useEffect(() => {
    let vivo = true;
    setC({ estado: "carregando" });
    carregaJson<unknown>(URL_GOLD.metricas)
      .then((g) => {
        const m = lerCaminho(g, `metricas[${n}]`) as MetricaPublicada | undefined;
        if (!vivo) return;
        if (!m || m.id !== id) setC({ estado: "erro", motivo: "A regra não foi encontrada no catálogo publicado: a gold foi atualizada depois desta página." });
        else setC({ estado: "ok", m });
      })
      .catch((e: Error) => vivo && setC({ estado: "erro", motivo: e.message }));
    return () => {
      vivo = false;
    };
  }, [id, n]);
  return c;
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Lista({ itens }: { itens: string[] }) {
  if (!itens.length) return <>nenhuma</>;
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {itens.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function Ficha({ id, n }: { id: string; n: number }) {
  const c = useMetrica(id, n);
  if (c.estado === "carregando")
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Lendo a regra no catálogo de métricas publicado…
      </p>
    );
  if (c.estado === "erro")
    return (
      <p role="alert" className="text-sm text-erro">
        Não foi possível ler a regra: {c.motivo}
      </p>
    );
  const m = c.m;
  return (
    <div className="space-y-4" data-regra={m.id}>
      <header>
        <p className="rotulo text-mineral">
          {moduloDaGold(m.gold)} · fórmula versão {m.versao_formula}
        </p>
        <h3 className="mt-1 font-serif text-xl text-carvao">{m.titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-carvao">{m.pergunta}</p>
      </header>
      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Campo rotulo="Definição">{m.definicao}</Campo>
        </div>
        <Campo rotulo="Unidade">{m.unidade}</Campo>
        <Campo rotulo="Recorte geográfico e temporal">
          {m.grao_geografico}; {m.grao_temporal}
        </Campo>
        <Campo rotulo="Natureza do dado de origem">{rotuloNatureza(m.natureza_fonte)}</Campo>
        <Campo rotulo="Natureza do resultado">{rotuloNatureza(m.natureza_transformacao)}</Campo>
        {m.formula && (
          <div className="md:col-span-2">
            <Campo rotulo="Fórmula">
              <span className="font-mono text-xs">{m.formula}</span>
            </Campo>
          </div>
        )}
        {m.numerador && <Campo rotulo="Numerador">{m.numerador}</Campo>}
        {m.denominador && <Campo rotulo="Denominador">{m.denominador}</Campo>}
        <Campo rotulo="Regra de agregação">{m.regra_agregacao}</Campo>
        <Campo rotulo="Dimensões">{m.dimensoes.length ? m.dimensoes.join(", ") : "nenhuma"}</Campo>
        <Campo rotulo="Regra de cobertura">{m.regra_cobertura}</Campo>
        <Campo rotulo="Política de ausência">{m.politica_ausencia}</Campo>
        <Campo rotulo="Regras de comparabilidade">
          <Lista itens={m.regras_comparabilidade} />
        </Campo>
        <Campo rotulo="Validações">
          <Lista itens={m.validacoes} />
        </Campo>
        <div className="md:col-span-2">
          <Campo rotulo="O que não se pode concluir (limitações)">
            <Lista itens={m.limitacoes} />
          </Campo>
        </div>
        <Campo rotulo="Fontes de dados (identificadores)">{m.fontes.join(", ")}</Campo>
        <Campo rotulo="Onde aparece">
          {m.paginas.map((p, i) => (
            <span key={p}>
              {i > 0 ? " · " : ""}
              <Link href={p} className="text-energia-dark underline underline-offset-4">
                {p.replace("/setor-eletrico", "") || "/"}
              </Link>
            </span>
          ))}
        </Campo>
        <div className="md:col-span-2">
          <Campo rotulo="Código que aplica a regra">
            <a href={urlCodigoMetrica(m.arquivo)} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
              {m.arquivo} ↗
            </a>
          </Campo>
        </div>
      </dl>
    </div>
  );
}

export function MetodologiaRegras({ linhas, versao }: { linhas: LinhaTabela[]; versao: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const escolhida = v.m ? linhas.find((l) => l.id === v.m) : undefined;
  return (
    <div className="space-y-5">
      <TabelaInterativa
        titulo="Regras por indicador: natureza, unidade e recortes de cada número publicado"
        colunas={COLUNAS_METRICAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="titulo"
        fonte="Scrutiniums, catálogo de indicadores dos módulos (o mesmo que o observatório usa para calcular)"
        versao={versao}
        nomeArquivo="metodologia-regras-por-indicador"
        chaveUrl="reg"
        ordemInicial={{ coluna: "modulo", direcao: "asc" }}
        tamanhoPagina={25}
        dicaBusca="Indicador, módulo ou unidade"
        selecionado={escolhida ? String(escolhida.id) : null}
        onSelecionar={(id) => definir({ m: id ?? "" })}
        nota="Natureza mista quer dizer que o resultado combina dados de naturezas diferentes; o texto completo está na ficha. A coluna Páginas conta onde o indicador aparece. Escolha uma linha para ver a regra inteira."
      />
      <section aria-labelledby="regra-h" aria-live="polite" className="border border-linha bg-papel p-4 md:p-5">
        <h3 id="regra-h" className="rotulo text-mineral">
          Regra do indicador
        </h3>
        {escolhida ? (
          <div className="mt-3">
            <Ficha id={String(escolhida.id)} n={Number(escolhida.n)} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-carvao-muted">Escolha um indicador da tabela para ver a definição, a fórmula, a regra de agregação, a política de ausência e o que ele não permite concluir.</p>
        )}
      </section>
    </div>
  );
}
