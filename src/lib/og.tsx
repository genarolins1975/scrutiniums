import { ImageResponse } from "next/og";
import { TOKENS } from "./tokens.gerado";

/**
 * Imagem social (Open Graph e summary_large_image) das páginas públicas do
 * crédito. Cores lidas dos tokens da plataforma (src/app/globals.css, derivados em tokens.gerado.ts): nenhum hexadecimal solto.
 * Todo cartão leva fonte e data, como qualquer número da plataforma.
 */
export const OG_TAMANHO = { width: 1200, height: 630 };
export const OG_TIPO = "image/png";

const C = {
  fundo: TOKENS["cor-marfim"],
  texto: TOKENS["cor-carvao"],
  suave: TOKENS["cor-carvao-muted"],
  bronze: TOKENS["cor-bronze"],
  mineral: TOKENS["cor-mineral"],
  linha: TOKENS["cor-linha"],
};

export function cartaoSocial({
  rotulo,
  titulo,
  valor,
  detalhe,
  rodape,
}: {
  rotulo: string;
  titulo: string;
  valor?: string;
  detalhe?: string;
  rodape: string;
}): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: C.fundo,
          color: C.texto,
          padding: "64px 72px",
          borderTop: `12px solid ${C.bronze}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: C.bronze }}>{rotulo}</div>
          <div style={{ fontSize: 58, lineHeight: 1.1, marginTop: 20, maxWidth: 1050 }}>{titulo}</div>
        </div>
        {valor ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
            <div style={{ fontSize: 120, lineHeight: 1 }}>{valor}</div>
            {detalhe ? <div style={{ fontSize: 30, color: C.suave, maxWidth: 520 }}>{detalhe}</div> : null}
          </div>
        ) : detalhe ? (
          <div style={{ fontSize: 34, color: C.suave, maxWidth: 1050 }}>{detalhe}</div>
        ) : null}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `2px solid ${C.linha}`,
            paddingTop: 22,
            fontSize: 24,
            color: C.mineral,
          }}
        >
          <div>{rodape}</div>
          <div style={{ color: C.texto }}>scrutiniums.com</div>
        </div>
      </div>
    ),
    OG_TAMANHO,
  );
}
