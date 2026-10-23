import type { Metadata } from "next";
import { PaginaPainel, type NumeroProps } from "@/components/painel";
import { dadosAlimentares } from "@/lib/eficiencia/alimentar/dados";
import { dadosComplementares, milhoes } from "@/lib/eficiencia/alimentar/complementos";
import { NecessidadesAlimentares } from "@/components/eficiencia/alimentar/NecessidadesAlimentares";
import { EbiaPorEstado } from "@/components/eficiencia/alimentar/EbiaPorEstado";
import { ConsultaMunicipalAlimentar } from "@/components/eficiencia/alimentar/ConsultaMunicipalAlimentar";
import { CadinsanEstados, EbiaUrbanoRural, FonteDaMedida, naturezaDaFicha, provenienciaAlimentar } from "@/components/eficiencia/alimentar/Complementos";
import { QuemPassaFome } from "@/components/eficiencia/alimentar/QuemPassaFome";
import { MetodoAlimentar, NavegacaoAlimentar, provenienciaPnadRegioes, siglasAlimentar } from "@/components/eficiencia/alimentar/PainelAlimentar";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Necessidades alimentares dos domicílios" };

const ROTA = "/eficiencia-estatal/seguranca-alimentar/necessidades";

/**
 * Necessidades alimentares no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, três números do Brasil em 2024
 * (insegurança total e grave, publicadas pelo IBGE, e os domicílios em insegurança grave), o índice da página, as figuras (a EBIA no
 * Brasil e nas regiões, quem passa fome, a EBIA por estado) e as tabelas à vista (urbano e rural, o CadINSAN por estado e a consulta por
 * município), na mesma ordem de antes. O layout da Segurança alimentar já abre o <main>: o molde entra como <div>.
 */
export default function Necessidades() {
  const g = dadosAlimentares();
  const c = dadosComplementares();
  const regiaoDe = Object.fromEntries(c.ufs.map((u) => [u.codigo, u.regiao]));
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const br = g.needs.find((r) => r.territory === "Brasil" && r.year === 2024)!;
  const grave = c.ebia.find((e) => e.nivel === "brasil" && e.ano === 2024 && e.situacao === "total")!.classes.grave;
  const fonteIbge = "IBGE, PNAD Contínua Segurança Alimentar";
  // percentuais publicados pelo IBGE (a gold declara "Observado: valor publicado pela fonte"), com o arredondamento original
  const numeros: NumeroProps[] = [
    { rotulo: "Domicílios com insegurança alimentar", valor: br.insecure, formato: "percentual", casas: 1, unidade: "%", periodo: "2024", recorte: "Brasil", fonte: fonteIbge, natureza: "OBSERVADO" },
    { rotulo: "Domicílios com insegurança alimentar grave", valor: br.severe, formato: "percentual", casas: 1, unidade: "%", periodo: "2024", recorte: "Brasil", fonte: fonteIbge, natureza: "OBSERVADO" },
    grave.mil_domicilios === null
      ? { rotulo: "Domicílios em insegurança alimentar grave", valor: null, motivoAusencia: "O IBGE não publicou o número de domicílios nesta tabela.", unidade: "domicílios", periodo: "2024", recorte: "Brasil", fonte: "IBGE, SIDRA, tabela 9552", natureza: "OBSERVADO" }
      : { rotulo: "Domicílios em insegurança alimentar grave", valor: grave.mil_domicilios * 1000, valorTexto: milhoes(grave.mil_domicilios * 1000), unidade: "de domicílios", periodo: "2024", recorte: "Brasil", fonte: "IBGE, SIDRA, tabela 9552", natureza: naturezaDaFicha(c, "san.ebia.uf.domicilios"), nota: "Publicado em mil domicílios." },
  ];
  return (
    <PaginaPainel
      rota={ROTA}
      principal={false}
      idioma="pt"
      abertura={{
        grupo: TEMAS_EFICIENCIA.alimentacao.nome,
        acento: "obee",
        titulo: "Quais famílias enfrentam restrição alimentar?",
        lead: "A Escala Brasileira de Insegurança Alimentar (EBIA) organiza as experiências dos domicílios em segurança alimentar ou insegurança leve, moderada e grave.",
        recorte: { periodo: "2023 e 2024; CadINSAN de janeiro de 2025", universo: "domicílios particulares, Brasil, regiões e estados; famílias do Cadastro Único por município", unidade: "% dos domicílios e famílias", fonte: "IBGE, PNAD Contínua; MDS, CadINSAN" },
        limite: "a qualidade do atendimento público. Esse retrato informa a necessidade social; não é uma nota de atendimento público.",
        fontesDatasSiglas: siglasAlimentar(c, [["EBIA", "Escala Brasileira de Insegurança Alimentar"], ["PNAD", "Pesquisa Nacional por Amostra de Domicílios"], ["CadINSAN", "estimativa de risco de insegurança alimentar grave no Cadastro Único, do MDS"], ["MDS", "Ministério do Desenvolvimento e Assistência Social"], ["CV", "coeficiente de variação"]]),
      }}
      numeros={numeros}
      notaNumeros="Percentuais e domicílios publicados pelo IBGE para o Brasil. Estimativa amostral: diferenças pequenas podem estar dentro do erro."
      navegacaoLocal={<NavegacaoAlimentar itens={[["#ebia-regioes", "Brasil e regiões"], ["#quem-passa-fome", "Quem passa fome"], ["#estados", "Por estado"], ["#urbano-rural", "Urbano e rural"], ["#cadinsan", "Risco no Cadastro Único, por município"]]} />}
      figuras={
        <>
          <NecessidadesAlimentares rows={g.needs} rota={ROTA} proveniencia={provenienciaPnadRegioes(g)} />
          <QuemPassaFome
            c={c}
            contexto={<p>O IBGE separa os domicílios brasileiros em insegurança alimentar por quem é a pessoa responsável (sexo, cor ou raça, escolaridade e trabalho), pelo número de moradores, pela renda por pessoa e pela presença de crianças, adolescentes ou pessoas idosas. São nove tabelas da PNAD Contínua, só para o Brasil, de 2023 e 2024.</p>}
          />
          <EbiaPorEstado
            linhas={c.ebia.filter((e) => e.situacao === "total" && e.nivel !== "regiao")}
            regiaoDe={regiaoDe}
            rota={ROTA}
            natureza={naturezaDaFicha(c, "san.ebia.uf.percentual")}
            proveniencia={provenienciaAlimentar(c, "san.ebia.uf.percentual", { inicio: "2023", fim: "2024" })}
            download={{ href: "/eficiencia/seguranca-alimentar/ebia-territorios.csv", rotulo: "Baixar dados · CSV" }}
            contexto={<p>Percentual de domicílios em cada classe da EBIA nos 27 estados, como publicado pelo IBGE, com o coeficiente de variação de cada estimativa. Estados menores têm amostras menores e estimativas menos precisas.</p>}
            complemento={
              <>
                <FonteDaMedida c={c} fonteId="sidra-9552-percentual" ficha="san.ebia.uf.percentual" periodo="2023 e 2024" unidade="% dos domicílios particulares permanentes" csv="ebia-territorios.csv"
                  ressalva="Percentual e coeficiente de variação publicados pelo IBGE, sem recálculo. A PNAD Contínua não produz EBIA por município. Nenhuma diferença entre estados ou anos é apresentada como estatisticamente significativa." />
              </>
            }
          />
        </>
      }
      tabelas={
        <>
          <EbiaUrbanoRural c={c} id="urbano-rural" titulo="A restrição é maior no campo ou na cidade?"
            lead={<p>Percentual de domicílios com insegurança alimentar entre os domicílios urbanos e entre os rurais, no Brasil e nas Grandes Regiões. Cada percentual tem como base os domicílios da própria situação.</p>} />
          <CadinsanEstados c={c} id="cadinsan" titulo="Quantas famílias do Cadastro Único estão em risco de insegurança alimentar grave?"
            lead={<>
              <p>O CadINSAN, do Ministério do Desenvolvimento e Assistência Social, aplica um modelo estatístico às famílias do Cadastro Único para estimar quais estão em risco de insegurança alimentar grave. É o único número desta área publicado para cada município.</p>
              <p className="mt-2">Não é a EBIA: mede risco estimado, e só entre famílias cadastradas com cadastro atualizado, não em toda a população.</p>
            </>} />
          <ConsultaMunicipalAlimentar tema="necessidades" ufs={ufs} id="cadinsan-municipio" />
        </>
      }
      metodo={<MetodoAlimentar c={c} g={g} fichas={["san.ebia.uf.percentual", "san.ebia.uf.domicilios", "san.ebia.social.composicao", "san.ebia.social.distribuicao", "san.ebia.social.no_grupo", "san.cadinsan.risco", "san.cadinsan.sem_pbf"]} pnad />}
    />
  );
}
