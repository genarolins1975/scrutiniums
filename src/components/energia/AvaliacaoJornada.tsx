"use client";

import { useEffect, useState, type ReactNode } from "react";
import { carregaJson } from "@/lib/energia/carregaJson";
import { URL_AVALIACAO, textoCitado } from "@/lib/energia/avaliacao";
import type { AvaliacaoGold, PassoJornada } from "@/lib/energia/tipos-avaliacao";

/**
 * Uma jornada da avaliação (P071). O resumo, o título, os atritos e o limite vêm prontos do servidor;
 * a lista dos passos, que é a parte longa, é lida de avaliacao.json só quando o leitor abre a jornada,
 * para o HTML da página ficar abaixo da meta de peso.
 */
export function JornadaDetalhe({ id, resumo, children }: { id: string; resumo: ReactNode; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [passos, setPassos] = useState<PassoJornada[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!aberto || passos) return;
    let vivo = true;
    carregaJson<AvaliacaoGold>(URL_AVALIACAO)
      .then((a) => {
        if (vivo) setPassos(a.jornadas.find((j) => j.id === id)?.passos ?? []);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [aberto, passos, id]);

  return (
    <details onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm text-carvao">{resumo}</summary>
      {children}
      {aberto && (
        <div className="mt-2" data-passos={id}>
          {falhou ? (
            <p className="text-xs text-carvao-muted">Os passos não puderam ser lidos agora. Estão em avaliacao.json, campo jornadas.</p>
          ) : !passos ? (
            <p className="text-xs text-carvao-muted" role="status">
              Lendo os passos da jornada.
            </p>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
              {passos.map((s, i) => (
                <li key={`${i}-${s.descricao}`}>
                  {s.resultado === "ok" ? "" : s.resultado === "falhou" ? "Falhou: " : "Não executado: "}
                  {textoCitado(s.descricao)}
                  {s.observado ? ` (${textoCitado(s.observado)})` : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </details>
  );
}
