import type { Metadata } from "next";
import { ExploradorTema } from "@/components/eficiencia/ExploradorTema";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Gastos em Educação nas capitais",
  description: "Despesa liquidada em Educação nas capitais: total, por habitante e por matrícula da rede municipal, com referências do grupo, nacionais e internacionais.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/gastos" },
};

export default function PaginaGastos() {
  const g = goldEducacao();
  if (!g) {
    return (
      <Indisponivel
        titulo="Painel indisponível"
        motivo="A base do painel não foi encontrada nesta publicação. Nenhum número é exibido no lugar."
        faltante={["public/eficiencia/gold/educacao_capitais.json"]}
      />
    );
  }
  return <ExploradorTema tema="gastos" dados={dadosPainelTema(g, "gastos")} contextos={contextos(g)} />;
}
