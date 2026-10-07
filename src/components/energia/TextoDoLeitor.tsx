import { partirBastidor } from "@/lib/energia/bastidor";

/**
 * Texto da gold com as frases de bastidor (HTTP, Cloudflare, curl, sha256) fora de Entender: elas aparecem em
 * Analisar e Auditar. Quando nada resta para o leitor, mostra `padrao`, a frase que diz o que importa.
 */
export function TextoDoLeitor({ texto, padrao }: { texto: string; padrao?: string }) {
  const { leitor, tecnico } = partirBastidor(texto);
  const frente = leitor || padrao || "";
  return (
    <>
      {frente}
      {tecnico && (
        <span data-nivel="analisar">
          {frente ? " " : ""}
          {tecnico}
        </span>
      )}
    </>
  );
}
