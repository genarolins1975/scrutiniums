import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "Quais dados a Scrutiniums coleta, por que coleta, por quanto tempo guarda e como você exerce seus direitos.",
};

/** Mantida em sincronia com PRIVACY_VERSION em @/lib/onboarding. */
const VERSAO_POLITICA = "2026-07";

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Institucional"
          title="Política de privacidade"
          description={`Curta e concreta: o que coletamos, por quê, e como você exerce seus direitos. Versão ${VERSAO_POLITICA}.`}
        />

        <div className="mt-10 max-w-prose2 space-y-10">
          <section aria-labelledby="priv-dados">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">
                01
              </span>
              <h2 id="priv-dados" className="font-serif text-2xl text-carvao">
                Dados coletados e por quê
              </h2>
            </div>
            <p className="mb-4 text-carvao-muted">
              Coletamos apenas o necessário para o cadastro e a proteção da conta:
            </p>
            <dl className="space-y-4 border border-linha bg-papel p-6">
              <div>
                <dt className="rotulo mb-1 text-mineral">E-mail</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">
                  Usado para acesso à conta, recuperação de acesso e comunicações essenciais sobre
                  o serviço.
                </dd>
              </div>
              <div>
                <dt className="rotulo mb-1 text-mineral">Telefone</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">
                  Usado para validação por SMS e proteção da conta contra acesso indevido.
                </dd>
              </div>
              <div>
                <dt className="rotulo mb-1 text-mineral">Empresa e cargo</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">
                  Usados para contextualizar o perfil de uso da plataforma. Não são exibidos
                  publicamente.
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="priv-base">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">
                02
              </span>
              <h2 id="priv-base" className="font-serif text-2xl text-carvao">
                Base de tratamento
              </h2>
            </div>
            <p className="text-carvao-muted">
              E-mail e telefone são tratados para execução do serviço que você solicitou ao criar a
              conta e para o legítimo interesse de protegê-la. Empresa e cargo são tratados com base
              no fornecimento voluntário durante o cadastro, para contextualização do uso.
            </p>
          </section>

          <section aria-labelledby="priv-marketing">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">
                03
              </span>
              <h2 id="priv-marketing" className="font-serif text-2xl text-carvao">
                Consentimento de marketing
              </h2>
            </div>
            <p className="text-carvao-muted">
              Comunicações de marketing dependem de consentimento separado e opcional, dado no
              cadastro. Recusar não limita nenhuma funcionalidade, e o consentimento pode ser
              retirado a qualquer momento. Comunicações essenciais do serviço — como confirmações de
              segurança — não dependem desse consentimento.
            </p>
          </section>

          <section aria-labelledby="priv-direitos">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">
                04
              </span>
              <h2 id="priv-direitos" className="font-serif text-2xl text-carvao">
                Direitos do titular
              </h2>
            </div>
            <p className="text-carvao-muted">
              Você pode consultar, corrigir e excluir seus dados. Consulta e correção estão
              disponíveis diretamente na{" "}
              <Link
                href="/app/conta"
                className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
              >
                página de conta
              </Link>
              . A exclusão da conta e dos dados pode ser solicitada pelo e-mail{" "}
              <a
                href="mailto:privacidade@scrutiniums.com"
                className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
              >
                privacidade@scrutiniums.com
              </a>
              , que também atende qualquer outra solicitação sobre dados pessoais.
            </p>
          </section>

          <section aria-labelledby="priv-retencao">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">
                05
              </span>
              <h2 id="priv-retencao" className="font-serif text-2xl text-carvao">
                Retenção
              </h2>
            </div>
            <p className="text-carvao-muted">
              Os dados da conta são mantidos enquanto a conta existir. Após a exclusão, dados
              pessoais são removidos, preservando-se apenas registros exigidos por obrigação legal
              pelo prazo correspondente. Códigos de verificação nunca são armazenados em claro e
              expiram em minutos.
            </p>
          </section>

          <section aria-labelledby="priv-analytics">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">
                06
              </span>
              <h2 id="priv-analytics" className="font-serif text-2xl text-carvao">
                Analytics
              </h2>
            </div>
            <p className="text-carvao-muted">
              Medimos o uso da plataforma com eventos de produto que não contêm dados pessoais.
              Telefone, e-mail e códigos de verificação nunca são enviados a ferramentas de
              analytics. Registros internos de auditoria guardam apenas versões mascaradas desses
              dados.
            </p>
          </section>

          <p className="border-t border-linha pt-6 text-sm text-mineral">
            Versão da política: {VERSAO_POLITICA}. Alterações relevantes serão comunicadas por
            e-mail ou aviso na plataforma. Veja também os{" "}
            <Link
              href="/termos"
              className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
            >
              termos de uso
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
