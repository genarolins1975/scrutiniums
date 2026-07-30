import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { AcessoForm } from "@/components/onboarding/AcessoForm";

export const metadata: Metadata = { title: "Código de acesso" };
export const dynamic = "force-dynamic";

/**
 * Etapa final: código de acesso (acesso antecipado controlado).
 * Sem sessão → /entrar; COMPLETE → /app; qualquer outra etapa →
 * rota da máquina de estados. A mesma página atende ACCESS_PENDING
 * (pedir o código) e WAITLIST (cadastro concluído, aguardando produção,
 * mas ainda aceita código).
 */
export default async function AcessoPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/entrar");
  }
  const status = user.onboardingStatus as OnboardingStatus;
  if (status === "COMPLETE") {
    redirect("/app");
  }
  if (status !== "ACCESS_PENDING" && status !== "WAITLIST") {
    redirect(nextStepPath(status));
  }

  const waitlist = status === "WAITLIST";

  return (
    <section className="border border-linha bg-papel p-8 md:p-10">
      {waitlist ? (
        <>
          <h1 className="font-serif text-3xl text-carvao">Cadastro concluído</h1>
          <p className="mt-3 text-sm text-carvao-muted">
            Obrigado pelo seu interesse na Scrutiniums. Seu cadastro está completo e guardado
            com segurança. Estamos na fase final de preparação da plataforma e entraremos em
            contato com você imediatamente quando o produto entrar em produção, pelo telefone
            e e-mail informados. Se você receber um código de acesso, é só informá-lo abaixo
            para entrar agora.
          </p>
          <p className="rotulo mt-4 text-bronze">100% gratuito · sem assinatura · sem cobrança</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4" aria-label="Etapa final">
            <span className="font-serif text-2xl text-bronze" aria-hidden="true">
              04
            </span>
            <span className="rotulo text-mineral">Etapa final</span>
          </div>
          <h1 className="mt-6 font-serif text-3xl text-carvao">Código de acesso</h1>
          <p className="mt-3 text-sm text-carvao-muted">
            A Scrutiniums está em fase de acesso antecipado. Se você recebeu um código de
            acesso, informe abaixo para entrar agora.
          </p>
        </>
      )}
      <div className="mt-8">
        <AcessoForm waitlist={waitlist} />
      </div>
    </section>
  );
}
