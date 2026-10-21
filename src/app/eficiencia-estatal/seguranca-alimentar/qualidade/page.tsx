import type { Metadata } from "next";
import { dadosComplementares } from "@/lib/eficiencia/alimentar/complementos";
import { SecaoComplementar, SisvanFases } from "@/components/eficiencia/alimentar/Complementos";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Qualidade e continuidade da entrega alimentar" };

const CRITERIOS: [string, string, string][] = [
  ["Oferta cumprida", "Dias com oferta efetiva", "Dias previstos de oferta"],
  ["Atendimento no prazo", "Demandas elegíveis atendidas no prazo", "Demandas elegíveis recebidas"],
  ["Entregas conformes", "Entregas verificadas conformes", "Entregas verificadas pelo protocolo"],
];

export default function Qualidade() {
  const c = dadosComplementares();
  return (
    <>
      <p className="rotulo text-obee">Qualidade e continuidade</p>
      <h1 className="mt-3 font-serif text-4xl">A entrega cumpre o compromisso?</h1>
      <p className="mt-5 max-w-prose2 text-base leading-relaxed">Tempo de resposta, regularidade e conformidade precisam de evidências da operação. Nenhuma dessas taxas é inferida da quantidade de equipamentos, do orçamento ou da EBIA.</p>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="pb-3 text-left text-xs">Critérios propostos; bases de atendimento ainda não integradas</caption>
          <thead>
            <tr>{["Medida", "Numerador", "Denominador"].map((t) => <th key={t} scope="col" className="border-b border-linha px-3 py-3">{t}</th>)}</tr>
          </thead>
          <tbody>
            {CRITERIOS.map(([t, n, d]) => (
              <tr key={t} className="border-b border-linha">
                <th scope="row" className="px-3 py-4 font-medium">{t}</th>
                <td className="px-3 py-4">{n}</td>
                <td className="px-3 py-4">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 max-w-prose2 text-sm leading-relaxed">As taxas deverão ser apresentadas por modalidade, com padrão nutricional e sanitário, regras de auditoria, cobertura das verificações e prazo aplicável documentados. Uma seleção restrita de inspeções não descreve toda a rede.</p>
      <p className="mt-4 text-sm">Situação: dados e referências pendentes; escore não calculável.</p>

      <SecaoComplementar
        id="acompanhamento-nutricional"
        pergunta="A saúde pública acompanha o estado nutricional da população?"
        contexto={
          <>
            <p>Na atenção primária, o SUS pesa e mede as pessoas atendidas e registra o resultado no Sistema de Vigilância Alimentar e Nutricional (SISVAN). Esse registro permite à rede identificar desnutrição, sobrepeso e obesidade.</p>
            <p className="mt-2">Aqui está quanto desse acompanhamento foi feito em 2025, por fase da vida. O resultado nutricional, isto é, quantas pessoas estão abaixo ou acima do peso, não está integrado.</p>
          </>
        }
      >
        <SisvanFases c={c} />
      </SecaoComplementar>
    </>
  );
}
