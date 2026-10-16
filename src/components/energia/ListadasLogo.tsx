import type { LogoListada } from "@/lib/energia/tipos-listadas";

/**
 * Símbolo de uma companhia listada: o arquivo oficial baixado do site da própria companhia, sem alteração, num tamanho fixo e
 * discreto. A placa tem o tom do fundo para o qual a companhia desenhou o arquivo (`fundo` no manifesto): papel para os logos de
 * fundo claro, carvão para os que a companhia publica só em branco. Sem logo oficial obtido, mostra o nome em texto; o motivo
 * fica no manifesto e na nota da página. A imagem é decorativa quando o nome já aparece ao lado (`decorativo`).
 */
export function ListadasLogo({
  logo,
  nome,
  tamanho = "md",
  decorativo = false,
}: {
  logo: LogoListada | null | undefined;
  nome: string;
  tamanho?: "sm" | "md" | "lg";
  decorativo?: boolean;
}) {
  const alt = tamanho === "sm" ? "h-7 w-[84px]" : tamanho === "lg" ? "h-14 w-[168px]" : "h-10 w-[120px]";
  if (!logo || !logo.arquivo) {
    if (decorativo) return <span aria-hidden="true" className={`inline-block shrink-0 ${alt}`} />;
    return (
      <span className={`inline-flex shrink-0 items-center justify-center border border-linha px-2 text-center text-xs font-medium leading-tight text-carvao ${alt}`}>
        {nome}
      </span>
    );
  }
  const escuro = logo.fundo === "escuro";
  return (
    <span
      data-logo={logo.papel}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm px-2 py-1 ${alt} ${escuro ? "bg-carvao" : "border border-linha bg-superficie"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.arquivo}
        alt={decorativo ? "" : `Símbolo de ${nome}`}
        className="max-h-full max-w-full object-contain"
        decoding="async"
        width={logo.largura ?? undefined}
        height={logo.altura ?? undefined}
        style={{ width: "auto", height: "auto" }}
      />
    </span>
  );
}
