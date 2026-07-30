import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Condições de uso da plataforma Scrutiniums: acesso gratuito mediante cadastro.",
};

const TERMOS: { numero: string; titulo: string; paragrafos: string[] }[] = [
  {
    numero: "01",
    titulo: "Objeto e acesso",
    paragrafos: [
      "A Scrutiniums é uma plataforma de informação e análise de acesso gratuito. A única exigência para usar os painéis é o cadastro, com e-mail e telefone confirmados. Não existem planos, assinaturas ou cobranças.",
      "A conta é pessoal e intransferível. Você é responsável por manter seus dados de acesso em sigilo e por atualizá-los quando mudarem.",
    ],
  },
  {
    numero: "02",
    titulo: "Uso adequado",
    paragrafos: [
      "Você concorda em usar a plataforma de forma lícita: sem tentar burlar controles de acesso, sem coleta automatizada massiva de conteúdo, sem sobrecarregar deliberadamente a infraestrutura e sem revender o acesso ou os dados como se fossem seus.",
      "Contas usadas em desacordo com estes termos podem ser suspensas, com aviso prévio sempre que possível.",
    ],
  },
  {
    numero: "03",
    titulo: "Propriedade intelectual",
    paragrafos: [
      "A marca, os textos, os índices próprios e a metodologia da Scrutiniums pertencem à Scrutiniums. Os dados de fontes públicas pertencem às respectivas fontes, sempre identificadas na plataforma.",
      "Você pode citar resultados da plataforma em trabalhos, relatórios e publicações, desde que com atribuição à Scrutiniums e à fonte primária indicada.",
    ],
  },
  {
    numero: "04",
    titulo: "Disponibilidade e garantias",
    paragrafos: [
      "A plataforma é fornecida no estado em que se encontra. Trabalhamos por alta disponibilidade e por dados corretos, mas não garantimos operação ininterrupta nem ausência de erros — fontes primárias revisam dados, e as nossas séries são revisadas junto.",
      "O conteúdo tem caráter informativo e não constitui recomendação de investimento, aconselhamento jurídico ou promessa de resultado. Decisões tomadas com base na plataforma são de responsabilidade de quem as toma.",
    ],
  },
  {
    numero: "05",
    titulo: "Alterações",
    paragrafos: [
      "Estes termos podem ser alterados para refletir mudanças na plataforma ou na legislação. Alterações relevantes serão comunicadas por e-mail ou aviso na plataforma, e a versão vigente estará sempre publicada nesta página.",
    ],
  },
  {
    numero: "06",
    titulo: "Foro",
    paragrafos: [
      "Estes termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de São Paulo, SP, para resolver controvérsias, sem prejuízo das proteções legais do seu domicílio quando aplicáveis.",
    ],
  },
];

export default function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Institucional"
          title="Termos de uso"
          description="Condições objetivas para o uso da plataforma. Versão vigente desde julho de 2026."
        />
        <div className="mt-10 max-w-prose2 space-y-10">
          {TERMOS.map((secao) => (
            <section key={secao.numero} aria-labelledby={`termos-${secao.numero}`}>
              <div className="mb-3 flex items-baseline gap-4">
                <span className="font-serif text-xl text-bronze" aria-hidden="true">
                  {secao.numero}
                </span>
                <h2 id={`termos-${secao.numero}`} className="font-serif text-2xl text-carvao">
                  {secao.titulo}
                </h2>
              </div>
              <div className="space-y-3 text-carvao-muted">
                {secao.paragrafos.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="border-t border-linha pt-6 text-sm text-mineral">
            O tratamento dos seus dados pessoais está descrito na{" "}
            <Link
              href="/privacidade"
              className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
            >
              política de privacidade
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
