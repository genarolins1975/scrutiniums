import { FocoHeader } from "@/components/layout/FocoHeader";

/**
 * Grupo de foco (Conta, Administração): cabeçalho mínimo, sem a navegação
 * de painéis, que é irrelevante nessas páginas. A autenticação é garantida
 * pelo layout pai de /app.
 */
export default function FocoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <FocoHeader />
      <main className="w-full flex-1">{children}</main>
      <footer className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-5">
          <p className="text-xs text-mineral">
            Sua conta é gratuita. Não existem planos, assinaturas ou cobranças.
          </p>
        </div>
      </footer>
    </div>
  );
}
