import Link from "next/link";
import { DOMINIOS } from "@/lib/dominios";
import { PERGUNTAS_CREDITO, PERGUNTAS_ENERGIA, miniaturaCredito, miniaturaEnergia } from "@/lib/amostras";
import { PainelObservatorio } from "@/components/home/PainelObservatorio";
import { MiniaturaCredito } from "@/components/home/MiniaturaCredito";
import { MiniaturaEnergia } from "@/components/home/MiniaturaEnergia";

/**
 * Os dois observatórios como dois grandes painéis vivos, na mesma dobra do
 * título: cada um com uma miniatura feita dos próprios dados (a curva da
 * inadimplência e os estados, no Crédito; o caminho da água ao preço, no Setor
 * Elétrico), a pergunta que responde e, ao passar o ponteiro, as perguntas
 * que o portal responde. Nenhum catálogo de funcionalidades.
 */
export function SecaoObservatorios() {
  const [credito, energia] = DOMINIOS;
  const dadosEnergia = miniaturaEnergia();
  const dadosCredito = miniaturaCredito();
  const link = (href: string, rotulo: string) => (
    <Link href={href} className="rotulo inline-flex min-h-[44px] items-center gap-2 border border-carvao px-5 text-carvao transition-colors hover:bg-carvao hover:text-marfim">
      {rotulo} <span aria-hidden="true">→</span>
    </Link>
  );
  return (
    <section id="observatorios" aria-labelledby="observatorios-titulo" className="border-b border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 pb-20 md:pb-24">
        <ul className="grid gap-6 lg:grid-cols-2">
          <li>
            <PainelObservatorio
              dominio={energia}
              numero="01"
              miniatura={<MiniaturaEnergia dados={dadosEnergia} />}
              perguntas={PERGUNTAS_ENERGIA}
              acao={
                <>
                  {link(energia.rotaRaiz, energia.cta)}
                  <span className="text-xs text-mineral">Miniatura com dados reais do ONS e da CCEE, na data de referência de cada fonte.</span>
                </>
              }
            />
          </li>
          <li>
            <PainelObservatorio
              dominio={credito}
              numero="02"
              miniatura={<MiniaturaCredito dados={dadosCredito} />}
              perguntas={PERGUNTAS_CREDITO}
              acao={
                <>
                  {link(credito.rotaRaiz, credito.cta)}
                  <span className="text-xs text-mineral">Miniatura com dados reais do SCR (Banco Central), na data-base publicada.</span>
                </>
              }
            />
          </li>
        </ul>
        <p className="rotulo mt-8 text-mineral">Mesma conta · mesmo método · mesma estrutura de fontes e evidências · 100% gratuito</p>
      </div>
    </section>
  );
}
