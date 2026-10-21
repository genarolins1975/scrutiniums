import { Fragment } from "react";

/**
 * Texto de um item do README do Território (docs/territorio/README.md) com a marcação
 * em linha que ele usa: `código` e **negrito**. Nada além disso é interpretado.
 */
export function TextoReadme({ texto }: Readonly<{ texto: string }>) {
  const partes = texto.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("`") ? (
          <code key={i} className="break-all bg-marfim px-1 font-mono text-[0.85em] text-carvao">{p.slice(1, -1)}</code>
        ) : p.startsWith("**") ? (
          <strong key={i} className="font-medium text-carvao">{p.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
