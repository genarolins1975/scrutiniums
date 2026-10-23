import type { Metadata } from "next";
import { PaginaPainel, TabelaDados, type NumeroProps } from "@/components/painel";
import { dadosComplementares } from "@/lib/eficiencia/alimentar/complementos";
import { FiguraSisvan, naturezaDaFicha } from "@/components/eficiencia/alimentar/Complementos";
import { MetodoAlimentar, siglasAlimentar } from "@/components/eficiencia/alimentar/PainelAlimentar";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Qualidade e continuidade da entrega alimentar" };

const ROTA = "/eficiencia-estatal/seguranca-alimentar/qualidade";

const CRITERIOS: [string, string, string][] = [
  ["Oferta cumprida", "Dias com oferta efetiva", "Dias previstos de oferta"],
  ["Atendimento no prazo", "Demandas elegíveis atendidas no prazo", "Demandas elegíveis recebidas"],
  ["Entregas conformes", "Entregas verificadas conformes", "Entregas verificadas pelo protocolo"],
];

/**
 * Qualidade e continuidade no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os dois maiores registros do
 * acompanhamento nutricional do SISVAN em 2025 (os mesmos valores da figura), a figura do acompanhamento por fase da vida e, à vista, a
 * tabela dos critérios propostos para as taxas de entrega, que antes era uma tabela escrita à mão e passa a ser a TabelaDados do kit. A
 * figura vem antes dos critérios, porque o molde põe as figuras antes das tabelas.
 */
export default function Qualidade() {
  const c = dadosComplementares();
  const nat = naturezaDaFicha(c, "san.sisvan.acompanhamento");
  const fonte = "Ministério da Saúde, Relatório de Gestão Integrado 2025";
  // as duas fases com o maior número de pessoas avaliadas; valores publicados, preliminares
  const numeros: NumeroProps[] = [...c.sisvan]
    .sort((a, b) => b.avaliados - a.avaliados)
    .slice(0, 2)
    .map((s) => ({ rotulo: `${s.fase} com peso e altura avaliados na atenção primária`, valor: s.avaliados, formato: "inteiro", unidade: "pessoas", periodo: "2025, preliminar", recorte: "Brasil", fonte, natureza: nat, nota: `Cobertura do acompanhamento: ${s.cobertura.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%.` }));
  return (
    <PaginaPainel
      rota={ROTA}
      principal={false}
      idioma="pt"
      abertura={{
        grupo: TEMAS_EFICIENCIA.alimentacao.nome,
        acento: "obee",
        titulo: "A entrega cumpre o compromisso?",
        lead: "Tempo de resposta, regularidade e conformidade precisam de evidências da operação.",
        recorte: { periodo: "2025, dados preliminares", universo: "Brasil, atenção primária do SUS", unidade: "pessoas avaliadas e % de cobertura", fonte: "Ministério da Saúde, SISVAN" },
        limite: "a qualidade da entrega alimentar. Nenhuma dessas taxas é inferida da quantidade de equipamentos, do orçamento ou da EBIA.",
        fontesDatasSiglas: siglasAlimentar(c, [["SISVAN", "Sistema de Vigilância Alimentar e Nutricional"], ["SUS", "Sistema Único de Saúde"], ["EBIA", "Escala Brasileira de Insegurança Alimentar"]]),
      }}
      numeros={numeros}
      notaNumeros="Mede quantas pessoas tiveram peso e altura avaliados, não quantas têm desnutrição ou obesidade. Gestantes não estão contabilizadas."
      figuras={
        <FiguraSisvan
          c={c}
          contexto={
            <>
              <p>Na atenção primária, o SUS pesa e mede as pessoas atendidas e registra o resultado no Sistema de Vigilância Alimentar e Nutricional (SISVAN). Esse registro permite à rede identificar desnutrição, sobrepeso e obesidade.</p>
              <p>Aqui está quanto desse acompanhamento foi feito em 2025, por fase da vida. O resultado nutricional, isto é, quantas pessoas estão abaixo ou acima do peso, não está integrado.</p>
            </>
          }
        />
      }
      tabelas={
        <TabelaDados
          idioma="pt"
          recolhida={false}
          id="criterios"
          tituloVisivel="Como medir a entrega?"
          lead="Critérios propostos; bases de atendimento ainda não integradas."
          titulo="Critérios propostos; bases de atendimento ainda não integradas"
          colunas={["Medida", "Numerador", "Denominador"]}
          linhas={CRITERIOS}
          nota="As taxas deverão ser apresentadas por modalidade, com padrão nutricional e sanitário, regras de auditoria, cobertura das verificações e prazo aplicável documentados. Uma seleção restrita de inspeções não descreve toda a rede. Situação: dados e referências pendentes; escore não calculável."
        />
      }
      metodo={<MetodoAlimentar c={c} fichas={["san.sisvan.acompanhamento"]} />}
    />
  );
}
