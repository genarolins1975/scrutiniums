import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { maskEmail, maskPhone } from "@/lib/crypto";
import { maskCpf } from "@/lib/cpf";
import { PageTitle, SectionHeading } from "@/components/ui/SectionHeading";
import { PerfilForm } from "@/components/conta/PerfilForm";
import { AlterarSenha } from "@/components/conta/AlterarSenha";
import { AlterarTelefone } from "@/components/conta/AlterarTelefone";
import { EncerrarSessoes } from "@/components/conta/EncerrarSessoes";
import { BoletimPreferencia } from "@/components/conta/BoletimPreferencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const metadata: Metadata = {
  title: "Conta",
};

/** Selo textual de confirmação (nunca "identidade verificada"). */
function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="rotulo inline-flex items-center border border-sucesso px-2 py-1 text-sucesso">
      {children}
    </span>
  );
}

export default async function ContaPage() {
  const user = await getSessionUser();
  // O layout de /app já protege a rota; isto é apenas defesa em profundidade.
  if (!user) redirect("/entrar");

  return (
    <div className="mx-auto w-full max-w-page px-6 py-12">
      <MarcaVisita secao="app:conta" />
      <PageTitle
        label="Sua conta"
        title="Conta"
        description="Dados de acesso, perfil e segurança da sua conta."
      />

      <div className="mt-12 space-y-14">
        <section aria-label="Perfil" className="border border-linha bg-papel p-8">
          <SectionHeading number="01" label="Dados da conta" title="Perfil" />
          <dl className="mb-8 grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="rotulo mb-2 text-mineral">E-mail</dt>
              <dd className="flex flex-wrap items-center gap-3">
                <span className="text-carvao">{maskEmail(user.email)}</span>
              </dd>
            </div>
            <div>
              <dt className="rotulo mb-2 text-mineral">Telefone</dt>
              <dd className="flex flex-wrap items-center gap-3">
                <span className="text-carvao">
                  {user.phoneE164 ? maskPhone(user.phoneE164) : "Não cadastrado"}
                </span>
                {user.phoneE164 && user.phoneVerifiedAt && <Selo>Telefone confirmado</Selo>}
              </dd>
            </div>
            <div>
              <dt className="rotulo mb-2 text-mineral">CPF</dt>
              <dd className="flex flex-wrap items-center gap-3">
                <span className="text-carvao">{user.cpf ? maskCpf(user.cpf) : "Não informado"}</span>
                {user.cpf && <Selo>Registrado</Selo>}
              </dd>
            </div>
          </dl>
          <PerfilForm
            orgTypeInicial={user.orgType ?? ""}
            orgAreaInicial={user.orgArea ?? ""}
            orgRoleInicial={user.orgRole ?? ""}
            ufInicial={user.uf ?? ""}
            temCpf={Boolean(user.cpf)}
          />
        </section>

        <section aria-label="Senha" className="border border-linha bg-papel p-8">
          <SectionHeading number="02" label="Segurança do acesso" title="Senha" />
          <AlterarSenha temSenha={Boolean(user.passwordHash)} />
        </section>

        <section aria-label="Alterar telefone" className="border border-linha bg-papel p-8">
          <SectionHeading number="03" label="Segurança do acesso" title="Alterar telefone" />
          <AlterarTelefone />
        </section>

        <section aria-label="Sessões e segurança" className="border border-linha bg-papel p-8">
          <SectionHeading number="04" label="Dispositivos" title="Sessões e segurança" />
          <EncerrarSessoes />
        </section>

        <section aria-label="Boletim mensal" className="border border-linha bg-papel p-8">
          <SectionHeading number="05" label="Comunicações" title="Boletim mensal" />
          <BoletimPreferencia optInInicial={user.marketingOptIn} />
        </section>

        <section aria-label="Privacidade e dados" className="border border-linha bg-papel p-8">
          <SectionHeading number="06" label="Seus dados" title="Privacidade e dados" />
          <div className="max-w-prose2 space-y-4 text-sm text-carvao-muted">
            <p>
              Pedimos apenas o necessário: o e-mail é seu dado de contato; o telefone valida, dá
              acesso e protege a conta; o CPF garante uma conta por pessoa e nunca é exibido
              integralmente; o perfil (instituição, área, cargo e UF) contextualiza o uso. Nada
              disso é exibido publicamente, e CPF, telefone, e-mail e códigos nunca são enviados a
              ferramentas de analytics. Os detalhes estão na{" "}
              <Link
                href="/privacidade"
                className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
              >
                política de privacidade
              </Link>
              .
            </p>
            <p>
              Para corrigir o CPF ou excluir sua conta e dados, solicite pelo e-mail{" "}
              <a
                href="mailto:privacidade@scrutiniums.com"
                className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
              >
                privacidade@scrutiniums.com
              </a>
              . A exclusão remove seus dados pessoais, preservando apenas registros exigidos por
              obrigação legal.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
