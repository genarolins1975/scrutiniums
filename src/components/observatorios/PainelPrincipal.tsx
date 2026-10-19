import Link from "next/link";
import { copiaDe } from "@/lib/observatorios/copias";

/**
 * Aviso único das cópias de um tema (src/lib/observatorios/copias.ts): diz qual
 * é o painel principal, com link, e o que ele tem a mais. A página continua
 * publicada, sem perder conteúdo. O mesmo componente em todas as cópias; a
 * rota sem registro em COPIAS é erro de programação, e o teste reprova.
 */
export function PainelPrincipal({ rota }: Readonly<{ rota: string }>) {
  const c = copiaDe(rota);
  if (!c) throw new Error(`cópia sem painel principal registrado: ${rota}`);
  const rotulo = c.tema ? `Painel principal sobre ${c.tema}` : "Painel principal deste tema";
  return (
    <aside
      aria-label={rotulo}
      data-painel-principal={c.principal}
      className="my-6 max-w-prose2 border-l-4 border-carvao bg-papel p-4 text-sm leading-relaxed text-carvao"
    >
      <p>
        <span className="font-semibold">{rotulo}:</span>{" "}
        <Link href={c.principal} prefetch={false} className="underline underline-offset-4">{c.titulo}</Link>, {c.onde}. {c.texto}
      </p>
    </aside>
  );
}
