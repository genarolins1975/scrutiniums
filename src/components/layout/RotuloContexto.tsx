import type { ReactNode } from "react";
import { Nome } from "@/components/i18n/Nome";
import { caminhoAtual, contextoDaRota } from "@/lib/observatorios/contexto";

/**
 * Rótulo acima do H1 de toda entrada e painel (Iniciativa 1 do parecer de UX, 21/10/2026): "Observatório X · Coleção Y" e,
 * fora da entrada da coleção, "· Página Z", lidos do registro (contextoDaRota). Diz o mesmo que o seletor da barra e a
 * trilha. Nomes de observatório e coleção são nomes de produto e ficam em português nas duas línguas, marcados com <Nome>.
 *
 * `rota`: o endereço da página (sem ela, o da renderização). `pagina`: troca o título da página que o registro daria
 * (null tira a página; útil quando o painel é a porta da coleção mas tem nome próprio, como "Inflação por cidade").
 * `marca`: elemento decorativo antes do texto, quando a coleção já tem um (o filete do Território e Clima).
 * Sem contexto no registro, não desenha nada: nunca inventa um observatório.
 */
export function RotuloContexto({
  rota,
  pagina,
  className,
  marca,
}: {
  rota?: string;
  pagina?: ReactNode | null;
  className?: string;
  marca?: ReactNode;
}) {
  const caminho = rota ?? caminhoAtual();
  const ctx = caminho ? contextoDaRota(caminho) : null;
  if (!ctx) return null;
  const nomePagina = pagina !== undefined ? pagina : ctx.pagina?.titulo ?? null;
  return (
    <p className={className ? `rotulo ${className}` : "rotulo"} data-rotulo-contexto="">
      {marca}
      {/* o texto num só elemento: com marca, o rótulo é flex e cada nome viraria um item separado */}
      <span>
        <Nome>{ctx.observatorio.nome}</Nome>
        {ctx.colecao && (
          <>
            {" · "}
            <Nome>{ctx.colecao.nome}</Nome>
          </>
        )}
        {nomePagina && (
          <>
            {" · "}
            {nomePagina}
          </>
        )}
      </span>
    </p>
  );
}
