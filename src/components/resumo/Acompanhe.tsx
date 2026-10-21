import { URL_FEED_ALERTAS, URL_FEED_RESUMO } from "@/lib/feedResumo";
import { AssinaturaResumoForm } from "@/components/resumo/AssinaturaResumoForm";

/** Canais de acompanhamento do resumo: e-mail sem conta e dois feeds RSS. */
export function Acompanhe({ comFormulario = true }: { comFormulario?: boolean }) {
  return (
    <section aria-labelledby="acompanhe" className="mt-6 border border-linha bg-papel p-8">
      <h2 id="acompanhe" className="font-serif text-2xl text-carvao">Acompanhe sem voltar aqui</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-carvao-muted">
        Receba o resumo por e-mail, sem criar conta, ou assine os feeds no seu leitor de RSS.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          <a href={URL_FEED_RESUMO} className="text-bronze underline underline-offset-4 hover:text-carvao">RSS do resumo do crédito</a>
          <span className="text-mineral"> · uma entrada por publicação</span>
        </li>
        <li>
          <a href={URL_FEED_ALERTAS} className="text-bronze underline underline-offset-4 hover:text-carvao">RSS da central de alertas</a>
          <span className="text-mineral"> · sinais com regra publicada, gerados pelo pipeline</span>
        </li>
      </ul>
      {comFormulario && (
        <div className="mt-8 max-w-xl">
          <h3 className="rotulo text-mineral">Resumo por e-mail</h3>
          <div className="mt-3">
            <AssinaturaResumoForm />
          </div>
        </div>
      )}
    </section>
  );
}
