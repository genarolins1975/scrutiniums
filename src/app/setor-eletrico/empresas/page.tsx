import type { Metadata } from "next";
import { ModuloEmIntegracao } from "@/components/energia/ModuloEmIntegracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Empresas e ativos do setor elétrico (em integração)",
  description: "Grupos econômicos, companhias, usinas, linhas, concessões e distribuidoras ligados por identificadores oficiais: escopo e fontes catalogadas. Dados ainda não integrados.",
  alternates: { canonical: "/setor-eletrico/empresas" },
};

export default function EmpresasPage() {
  return (
    <ModuloEmIntegracao
      icone="empresas"
      atual="empresas"
      secao="energia:empresas"
      rotulo="Empresas e ativos"
      titulo="Quem é dono de quê no setor elétrico?"
      escopo="Ligação entre grupo econômico, companhias, ativos, usinas, linhas, concessões, distribuidoras e dados financeiros públicos, com um cadastro mestre de entidades baseado em identificadores oficiais (CNPJ, código de empreendimento da ANEEL, código CVM). Associações manuais ou probabilísticas serão marcadas como tais; nenhuma ligação por semelhança de nome."
      perguntas={[
        "Quais usinas, linhas e concessões pertencem a cada grupo econômico?",
        "Quanto da capacidade instalada está com cada grupo e em cada fonte?",
        "Como estão os indicadores coletivos de continuidade, DEC (Duração Equivalente de Interrupção por Unidade Consumidora) e FEC (Frequência Equivalente de Interrupção por Unidade Consumidora), além de perdas e tarifas, de cada distribuidora?",
        "Quais companhias listadas têm quais ativos, e o que dizem suas demonstrações?",
      ]}
      temas={["empresas", "distribuicao", "geracao"]}
      orgaos={["ANEEL", "CVM", "B3"]}
      pendencias={[
        "Cadastro mestre de entidades com regras documentadas de ligação (CNPJ, CEG, que é o Código Único de Empreendimentos de Geração, código ANEEL, código CVM).",
        "Integração dos conjuntos da ANEEL (SIGA, o Sistema de Informações de Geração da ANEEL; agentes; composição societária; DEC e FEC; tarifas) e das demonstrações da CVM. Nomes das siglas conforme as descrições dos conjuntos no portal de dados abertos da ANEEL.",
      ]}
      esquema={{
        titulo: "Do grupo econômico ao ativo físico",
        linhas: [
          { nos: [{ rotulo: "Grupo econômico", icone: "empresas", estado: "leitura", descricao: "Controlador; identificado por CNPJ e, quando listado, por código CVM." }] },
          { setaAntes: "controla", nos: [{ rotulo: "Empresas", icone: "empresas", estado: "leitura", descricao: "Companhias e concessionárias, cada uma com CNPJ e outorgas." }] },
          {
            setaAntes: "atuam em",
            separador: "|",
            nos: [
              { rotulo: "Geração", icone: "geracao", estado: "leitura", descricao: "Usinas, identificadas pelo CEG (código de empreendimento) da ANEEL." },
              { rotulo: "Transmissão", icone: "rede", estado: "leitura", descricao: "Linhas e subestações sob concessão." },
              { rotulo: "Distribuição", icone: "carga", estado: "leitura", descricao: "Áreas de concessão, com DEC, FEC e tarifas publicados pela ANEEL." },
              { rotulo: "Comercialização", icone: "mercado", estado: "leitura", descricao: "Agentes registrados na CCEE." },
            ],
          },
          { setaAntes: "possuem", nos: [{ rotulo: "Ativos no mapa", icone: "sistema", estado: "leitura", descricao: "Usinas, linhas e concessões localizadas; entram no mapa-base do observatório quando o cadastro mestre existir." }] },
        ],
        nota: "Árvore corporativa esquemática, na leitura usual do setor. Nenhuma ligação entre grupo, empresa e ativo será feita por semelhança de nome: só por identificadores oficiais (CNPJ, CEG, código CVM), com o cadastro mestre documentado. Nenhuma empresa é nomeada antes disso.",
      }}
    />
  );
}
