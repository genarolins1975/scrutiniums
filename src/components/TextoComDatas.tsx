import { segmentosComDatas } from "@/lib/texto-datas";

/** Texto de pipeline com datas ISO legíveis; o valor original fica em <time dateTime>. */
export function TextoComDatas({ texto }: { texto: string }) {
  return (
    <>
      {segmentosComDatas(texto).map((s, i) =>
        typeof s === "string" ? (
          s
        ) : (
          <time key={i} dateTime={s.iso}>
            {s.texto}
          </time>
        ),
      )}
    </>
  );
}
