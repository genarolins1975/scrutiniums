import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { AcaoAssinatura } from "@/components/resumo/AcaoAssinatura";

export const metadata: Metadata = { title: "Confirmar assinatura", robots: { index: false } };

/** Alcançada pelo link do e-mail; a mudança só acontece no clique do botão (POST). */
export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle label="Resumo do crédito" title="Confirmar a assinatura do resumo" description="Clique abaixo para começar a receber o resumo do crédito por e-mail, na periodicidade que você escolheu." />
        <div className="mt-10 max-w-prose2">
          {token ? (
            <AcaoAssinatura token={token} acao="confirmar" />
          ) : (
            <p className="text-sm text-carvao-muted">
              Link incompleto. Use o link que chegou no e-mail ou volte ao{" "}
              <Link href="/resumo" className="underline decoration-linha underline-offset-4 hover:text-bronze">resumo</Link>.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
