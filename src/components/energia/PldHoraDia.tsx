"use client";

import { useEffect, useRef, useState } from "react";
import { PldEscolha } from "@/components/energia/PldControles";
import { PldMapaHoras } from "@/components/energia/PldMapaHoras";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import { ESCALA_PLD, JANELAS_HORA_DIA, horaDiaRecorte, horasDoDia, nomeSm, notaSemNomeDeArquivo, type JanelaHoraDia } from "@/lib/energia/pld";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { NOTAS_PLD_EN, traducaoExata } from "@/lib/energia/i18n/mercado-preco";
import type { Submercado } from "@/lib/energia/tipos";
import type { PldHoraDiaArquivo } from "@/lib/energia/tipos-pld";

/**
 * Mapa hora × dia do PLD (P011), lido sob demanda: o arquivo dos últimos 90 dias
 * (pld_hora_dia.json, cerca de 95 KB) só é baixado quando o bloco entra na tela,
 * o que acontece ao abrir o modo Analisar (contrato, seção 5.1). A janela (?hd=30,
 * 60 ou 90 dias) fica na URL; o submercado é o do painel. Estados de carregamento e
 * de erro são escritos, com o link do arquivo para baixar direto.
 */
type Estado = { tipo: "espera" } | { tipo: "carregando" } | { tipo: "ok"; arq: PldHoraDiaArquivo } | { tipo: "erro"; motivo: string };

const ESQUEMA = { hd: campo(tiposUrl.opcao(JANELAS_HORA_DIA.map(String) as ("30" | "60" | "90")[]), "30") };

let promessa: Promise<PldHoraDiaArquivo> | null = null;
function carregar(url: string): Promise<PldHoraDiaArquivo> {
  if (!promessa)
    promessa = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<PldHoraDiaArquivo>;
    });
  promessa.catch(() => {
    promessa = null; // erro não fica em cache: a próxima tentativa baixa de novo
  });
  return promessa;
}

export function PldHoraDia({ url, sm, nota }: { url: string; sm: Submercado; nota: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "espera" });
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const raiz = useRef<HTMLDivElement>(null);
  const janela = Number(v.hd) as JanelaHoraDia;
  const idioma = useIdioma();
  const tx = useTx();

  useEffect(() => {
    const el = raiz.current;
    if (!el || estado.tipo !== "espera") return;
    const abrir = () => {
      setEstado({ tipo: "carregando" });
      carregar(url)
        .then((arq) => setEstado({ tipo: "ok", arq }))
        .catch((e: unknown) => setEstado({ tipo: "erro", motivo: e instanceof Error ? e.message : "falha na leitura" })); // i18n: dado
    };
    if (typeof IntersectionObserver === "undefined") {
      abrir();
      return;
    }
    const obs = new IntersectionObserver((ent) => {
      if (ent.some((x) => x.isIntersecting)) {
        obs.disconnect();
        abrir();
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [estado.tipo, url]);

  const recorte = estado.tipo === "ok" ? horaDiaRecorte(estado.arq, sm, janela, idioma) : null;
  return (
    <div ref={raiz} className="space-y-3">
      <PldEscolha
        legenda={tx("Janela do mapa", "Map window")}
        opcoes={JANELAS_HORA_DIA.map((n) => ({ id: String(n) as "30" | "60" | "90", rotulo: tx(`${n} dias`, `${n} days`) }))}
        valor={v.hd}
        onEscolher={(x) => definir({ hd: x })}
      />
      {estado.tipo === "ok" && recorte ? (
        <PldMapaHoras
          titulo={tx(`PLD por hora e dia, ${nomeSm(sm, idioma)}, últimos ${janela} dias`, `PLD by hour and day, ${nomeSm(sm, idioma)}, last ${janela} days`)}
          linhas={recorte.linhas}
          colunas={horasDoDia(idioma)}
          nomeLinhas={tx("Dia", "Day")}
          nomeColunas={tx("Hora", "Hour")}
          valores={recorte.valores}
          escala={ESCALA_PLD}
          unidade="R$/MWh"
          casas={2}
          passoRotuloColunas={3}
          periodo={
            recorte.linhas.length
              ? tx(`${dataBR(recorte.linhas[0].id, idioma)} a ${dataBR(recorte.linhas[recorte.linhas.length - 1].id, idioma)}`, `${dataBR(recorte.linhas[0].id, idioma)} to ${dataBR(recorte.linhas[recorte.linhas.length - 1].id, idioma)}`)
              : undefined
          }
          nota={traducaoExata(NOTAS_PLD_EN, nota, idioma) ?? notaSemNomeDeArquivo(nota)}
        />
      ) : estado.tipo === "erro" ? (
        <p role="alert" className="border-l-2 border-aviso pl-3 text-sm text-carvao">
          {tx(`Não foi possível ler o mapa hora × dia (${estado.motivo}).`, `Could not read the hour × day map (${estado.motivo}).`)}{" "}
          <button type="button" onClick={() => setEstado({ tipo: "espera" })} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("Tentar de novo", "Try again")}
          </button>{" "}
          {tx("ou", "or")}{" "}
          <a href={url} download className="text-energia-dark underline underline-offset-4">
            {tx("baixar o arquivo", "download the file")}
          </a>
          .
        </p>
      ) : (
        <p className="text-sm text-carvao-muted" aria-live="polite">
          {estado.tipo === "carregando"
            ? tx("Carregando o mapa hora × dia dos últimos 90 dias…", "Loading the hour × day map for the last 90 days…")
            : tx("O mapa hora × dia é carregado quando este bloco aparece na tela.", "The hour × day map loads when this block comes into view.")}
        </p>
      )}
    </div>
  );
}
