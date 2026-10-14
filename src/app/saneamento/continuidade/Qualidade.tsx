import { Fonte, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { agregados, meta, municipiosComQualidade, URL_QUALIDADE_MUNICIPIOS } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { ANOS_SISAGUA, MEDIDAS_QUALIDADE, agregarMedida, medida } from "@/lib/saneamento/medidas";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero } from "@/lib/saneamento/formato";
import type { Municipio } from "@/lib/saneamento/tipos";

const ANO = 2024;
const ULTIMO = ANOS_SISAGUA[ANOS_SISAGUA.length - 1];

const ROTULO_PARAMETRO: Record<string, string> = {
  ecoli: "E. coli (presença)",
  coliformes: "Coliformes totais (presença)",
  cloro: "Cloro residual livre abaixo de 0,2 mg/L",
  turbidez: "Turbidez acima de 5,0 uT",
};

const ROTULO_PROCEDENCIA: Record<string, string> = {
  "SAA|SISTEMA DE DISTRIBUIÇÃO": "Sistema (SAA): rede de distribuição",
  "SAC|SOLUÇÃO ALTERNATIVA": "Solução coletiva (SAC): ponto de consumo",
  "SAI|SOLUÇÃO ALTERNATIVA": "Solução individual (SAI): poço, cisterna ou fonte",
  "SAA|INTRA-DOMICILIAR / INTRA-PREDIAL": "Sistema (SAA): dentro do domicílio ou prédio",
  "SAC|INTRA-DOMICILIAR / INTRA-PREDIAL": "Solução coletiva (SAC): dentro do domicílio ou prédio",
  "SAI|INTRA-DOMICILIAR / INTRA-PREDIAL": "Solução individual (SAI): dentro do domicílio",
  "SAA|ESTAÇÃO DE TRATAMENTO DE ÁGUA": "Sistema (SAA): estação de tratamento",
  "SAA|PONTO DE CAPTAÇÃO(ÁGUA SUPERFICIAL OU SUBTERRÂNEA)": "Sistema (SAA): ponto de captação (água bruta)",
  "CARRO-PIPA|CARRO-PIPA": "Carro-pipa",
};

const EXCLUSAO: Record<string, string> = {
  linhas_ra_df: "Linhas das Regiões Administrativas do DF, agregadas em Brasília",
  valor_nao_inteiro: "Contagem de análises não inteira (grupo excluído)",
  grupo_incompleto: "Grupo sem total de análises ou sem resultado (excluído)",
  grupo_inconsistente: "Resultados que não fecham com o total de análises (excluído)",
  motivo_denuncia: "Amostras de denúncia (fora da medida de rotina)",
  motivo_surto: "Amostras de surto (fora da medida de rotina)",
  motivo_desastre: "Amostras de desastre (fora da medida de rotina)",
  duplicata: "Amostra repetida (mesmo número, parâmetro e data)",
  limite: "Abaixo de limite de detecção ou quantificação sem conclusão (excluída)",
  invalido: "Resultado ilegível (excluído)",
  forma_com_valor_conflitante_ou_invalido: "Sistema com exigência conflitante no plano (excluído)",
  forma_sem_exigencia: "Sistema com exigência zero no plano",
  formas_com_controle_sem_plano: "Sistemas com controle de coliformes na rede e sem plano no ano",
  analises_de_formas_sem_plano: "Análises desses sistemas sem plano (fora da medida)",
  formas_com_controle_em_outro_municipio: "Sistemas sem controle no município do plano, mas com controle em outro município",
};

function rotuloExclusao(chave: string): string {
  for (const [k, v] of Object.entries(EXCLUSAO)) {
    if (chave === k) return v;
    if (chave.startsWith(`${k}_`)) {
      const par = chave.slice(k.length + 1);
      return `${v}: ${ROTULO_PARAMETRO[par] ?? par}`;
    }
  }
  return chave;
}

function data(iso: string | null | undefined): string {
  if (!iso) return "sem data";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function Qualidade() {
  const auditoria = meta()?.sisagua;
  const lista = municipiosComQualidade();
  const ags = agregados();
  const ids = MEDIDAS_QUALIDADE.map((m) => m.id);
  const refs = referencias(ags, lista, ids);
  const a = auditoria?.por_ano[String(ANO)];
  const u = auditoria?.por_ano[String(ULTIMO)];
  const br = (id: string) => agregarMedida(medida(id), lista);

  const linhasBrasil = ANOS_SISAGUA.flatMap((ano) =>
    MEDIDAS_QUALIDADE.filter((m) => m.periodo === String(ano)).map((m) => {
      const r = agregarMedida(m, lista);
      const [registro, resto] = m.titulo.split(`${ano}: `);
      return {
        registro: registro.trim(),
        medida: resto,
        ano: String(ano),
        com_resultado: r.contagem,
        validas: r.universo,
        pct: r.pct,
        municipios: r.municipios,
      };
    }),
  );

  const porUf = new Map<string, Municipio[]>();
  for (const m of lista) porUf.set(m.uf, [...(porUf.get(m.uf) ?? []), m]);
  const nomeUf = Object.fromEntries(ags.filter((x) => x.tipo === "UF").map((x) => [x.id, x.nome]));
  const linhasUf = ANOS_SISAGUA.flatMap((ano) =>
    [...porUf.entries()].map(([uf, ms]) => {
      const p = (id: string) => agregarMedida(medida(`${id}-${ano}`), ms).pct;
      const ctrl = ms.filter((m) => m[`qa_reg_ctrl_${ano}`] === 1).length;
      const vig = ms.filter((m) => m[`qa_reg_vig_${ano}`] === 1).length;
      const nenhum = ms.filter((m) => m[`qa_reg_ctrl_${ano}`] !== 1 && m[`qa_reg_vig_${ano}`] !== 1).length;
      return {
        uf: nomeUf[uf] ?? uf,
        ano: String(ano),
        municipios: ms.length,
        controle: ctrl,
        vigilancia: vig,
        nenhum,
        ctrl_ecoli: p("qa-ctrl-ecoli"),
        vig_ecoli: p("qa-vig-ecoli"),
        ctrl_cloro: p("qa-ctrl-cloro"),
        vig_cloro: p("qa-vig-cloro"),
        plano: p("qa-plano"),
      };
    }),
  );

  const nacional = a?.vigilancia_nacional ?? {};
  const barrasProcedencia = Object.keys(ROTULO_PROCEDENCIA)
    .map((k) => {
      const [f, n] = nacional[`${k}|ecoli`] ?? [0, 0];
      return { id: k, rotulo: ROTULO_PROCEDENCIA[k], v: razaoPct(f, n), n };
    })
    .filter((x) => x.n > 0);

  const exclusoes = ANOS_SISAGUA.flatMap((ano) => {
    const e = auditoria?.por_ano[String(ano)]?.exclusoes;
    if (!e) return [];
    return (["controle", "plano", "vigilancia"] as const).flatMap((conjunto) =>
      Object.entries(e[conjunto]).map(([chave, n]) => ({
        ano: String(ano),
        conjunto: conjunto === "vigilancia" ? "Vigilância" : conjunto === "plano" ? "Plano de amostragem" : "Controle mensal",
        motivo: rotuloExclusao(chave),
        linhas: n,
      })),
    );
  });

  const conferencia = ANOS_SISAGUA.flatMap((ano) =>
    (auditoria?.por_ano[String(ano)]?.conferencia_fora_padrao ?? []).map((c) => ({
      ano: String(ano),
      parametro: ROTULO_PARAMETRO[c.parametro] ?? c.parametro,
      controle: c.controle_mensal,
      arquivo: c.arquivo_fora_do_padrao,
      diferenca: c.diferenca,
      pct: razaoPct(c.arquivo_fora_do_padrao, c.controle_mensal),
    })),
  );

  const captura = data(auditoria?.proveniencia.capturado_em);
  const atualizacao = (conjunto: string, ano: number) =>
    data(auditoria?.proveniencia.arquivos.find((x) => x.conjunto === conjunto && x.ano === ano)?.last_modified);

  const ctrlEcoli = br(`qa-ctrl-ecoli-${ANO}`);
  const vigEcoli = br(`qa-vig-ecoli-${ANO}`);
  const plano = br(`qa-plano-${ANO}`);

  if (!auditoria || !a) {
    return (
      <Secao id="qualidade" titulo="A água distribuída é monitorada?">
        <Nota titulo="Dados do SISAGUA indisponíveis nesta edição">O arquivo da qualidade da água não foi encontrado na gold.</Nota>
      </Secao>
    );
  }

  return (
    <>
      <Secao
        id="qualidade"
        titulo="A água distribuída é monitorada?"
        texto={`O SISAGUA, do Ministério da Saúde, reúne dois registros independentes: o controle, que o prestador informa todo mês, e a vigilância, coletada pela secretaria de saúde. O Observatório mede cada um em separado, em ${ANO} (o ano do SINISA) e em ${ULTIMO} (o ano completo mais recente).`}
      >
        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: `Municípios com registro de controle em ${ANO}`,
              valor: inteiro(a.municipios.controle),
              contexto: <>de {inteiro(a.municipios.universo)} municípios do IBGE. Em {ULTIMO}: {inteiro(u?.municipios.controle)}.</>,
            },
            {
              rotulo: `Municípios com registro de vigilância em ${ANO}`,
              valor: inteiro(a.municipios.vigilancia),
              contexto: <>Em {ULTIMO}: {inteiro(u?.municipios.vigilancia)}.</>,
            },
            {
              rotulo: "Com os dois registros",
              valor: inteiro(a.municipios.ambos),
              contexto: <>{numero(razaoPct(a.municipios.ambos, a.municipios.universo), 1)}% dos municípios, {ANO}.</>,
            },
            {
              rotulo: "Sem nenhum registro",
              valor: inteiro(a.municipios.nenhum),
              contexto: <>Em {ULTIMO}: {inteiro(u?.municipios.nenhum)}. Sem registro não quer dizer água boa nem ruim.</>,
            },
          ]}
        />
        <Nota titulo="Ausência de registro não é água de boa qualidade">
          Município sem registro fica sem dado no atlas e nas tabelas, nunca com zero. O SISAGUA registra o que prestadores e secretarias de saúde
          informam; a falta de informação é uma lacuna de monitoramento, não um resultado.
        </Nota>
        <Fonte>
          Ministério da Saúde, SISAGUA, dados abertos: controle mensal (parâmetros básicos e plano de amostragem) e vigilância (parâmetros básicos),
          {" "}{ANO} e {ULTIMO}. Arquivos atualizados pelo Ministério em {atualizacao("controle", ANO)} (controle {ANO}) e{" "}
          {atualizacao("vigilancia", ULTIMO)} (vigilância {ULTIMO}); extração do Observatório em {captura}.
        </Fonte>
      </Secao>

      <Secao
        id="qualidade-resultados"
        titulo="O que os registros mostram?"
        texto="Cada linha divide as análises com o resultado medido pelas análises com resultado válido, somadas no Brasil. Análise é o exame de um parâmetro, não a coleta física: uma coleta gera várias análises."
      >
        <Numeros
          colunas={3}
          itens={[
            {
              rotulo: `Controle ${ANO}: análises com presença de E. coli`,
              valor: `${numero(ctrlEcoli.pct, 2)}%`,
              contexto: <>{inteiro(ctrlEcoli.contagem)} de {inteiro(ctrlEcoli.universo)} análises do prestador na rede e no consumo.</>,
            },
            {
              rotulo: `Vigilância ${ANO}: análises com presença de E. coli`,
              valor: `${numero(vigEcoli.pct, 1)}%`,
              contexto: <>{inteiro(vigEcoli.contagem)} de {inteiro(vigEcoli.universo)} análises de rotina na rede de SAA e no consumo de SAC.</>,
            },
            {
              rotulo: `Plano de amostragem ${ANO}: análises exigidas cobertas`,
              valor: `${numero(plano.pct, 1)}%`,
              contexto: <>{inteiro(plano.contagem)} de {inteiro(plano.universo)} análises de coliformes totais exigidas na rede de SAA.</>,
            },
          ]}
        />
        <div className="mt-8">
          <TabelaDados
            titulo="Brasil: medidas de qualidade da água por ano"
            arquivo="saneamento-qualidade-agua-brasil.csv"
            colunas={[
              { id: "registro", rotulo: "Registro" },
              { id: "medida", rotulo: "Medida" },
              { id: "ano", rotulo: "Ano" },
              { id: "com_resultado", rotulo: "Análises com o resultado", tipo: "inteiro" },
              { id: "validas", rotulo: "Análises válidas (ou exigidas, no plano)", tipo: "inteiro" },
              { id: "pct", rotulo: "Proporção", tipo: "pct", casas: 2 },
              { id: "municipios", rotulo: "Municípios com dado", tipo: "inteiro" },
            ]}
            linhas={linhasBrasil}
            limite={14}
            busca={false}
            rotuloLinhas={{ singular: "medida", plural: "medidas" }}
          />
        </div>
        <Ressalva
          permite="Ver, para cada registro, quantas análises tiveram o resultado medido e em quantos municípios há dado, sempre pela soma de análises."
          naoPermite="Comparar controle e vigilância como se fossem a mesma medida: quem coleta, onde, com que frequência e em que laboratório são diferentes. A diferença entre os dois não identifica sua causa."
        />
      </Secao>

      <Secao
        id="qualidade-procedencia"
        titulo="Onde a vigilância encontra E. coli?"
        texto={`Análises de rotina da vigilância em ${ANO}, por forma de abastecimento e ponto de coleta. Soluções individuais (SAI) são poços, cisternas e fontes de uso de uma família e não entram na medida municipal.`}
      >
        <GraficoBarras
          titulo={`Vigilância ${ANO}: análises de rotina com presença de E. coli (% das análises com resultado)`}
          dados={barrasProcedencia.map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[{ id: "v", rotulo: "%", cor: "var(--escala-seq-4)" }]}
          unidade="%"
          casas={1}
          orientacao="horizontal"
        />
        <Ressalva
          permite="Comparar a frequência de contaminação fecal entre formas de abastecimento nas coletas da autoridade de saúde."
          naoPermite="Estimar quantas pessoas beberam água contaminada: os pontos de coleta não são amostra estatística da população, e coletas dirigidas a problemas (denúncia, surto e desastre) ficam fora."
        />
        <Fonte>
          Ministério da Saúde, SISAGUA, vigilância de parâmetros básicos {ANO}. Número de análises por categoria na tabela de exportação da
          vigilância; a medida municipal usa só as duas primeiras categorias.
        </Fonte>
      </Secao>

      <Secao
        id="qualidade-atlas"
        titulo="Atlas municipal da qualidade da água"
        texto="Escolha o registro, a medida e o ano. O mapa mostra a proporção; a contagem mostra quantas análises tiveram o resultado. Municípios sem registro aparecem sem dado."
      >
        <AtlasMunicipal
          ids={ids}
          referencias={refs}
          nomesUf={nomeUf}
          titulo="Atlas municipal da qualidade da água"
          complemento={URL_QUALIDADE_MUNICIPIOS}
        />
        <Ressalva
          permite="Localizar municípios com resultado acima da referência da UF e do Brasil, sempre com o número de análises ao lado."
          naoPermite="Ordenar municípios por qualidade da água: com poucas análises, uma única amostra muda muito a proporção, e o atlas não pondera pelo número de análises."
        />
        <Fonte>
          Ministério da Saúde, SISAGUA, {ANO} e {ULTIMO}. Referências de UF e Brasil: soma de numeradores e denominadores municipais. Limites da
          Portaria GM/MS 888/2021 (Anexo XX da Portaria de Consolidação GM/MS 5/2017): Anexo 1, Art. 28, § 2º, e Art. 32.
        </Fonte>
      </Secao>

      <Secao
        id="qualidade-plano"
        titulo="O prestador informa as análises que a norma exige?"
        texto="O plano de amostragem do SISAGUA calcula, para cada sistema e município, o número mínimo de análises exigido pela norma. Aqui, coliformes totais na rede de distribuição dos sistemas (SAA), Anexo 14 da Portaria 888."
      >
        <Numeros
          colunas={3}
          itens={[
            {
              rotulo: `Análises exigidas em ${ANO}`,
              valor: inteiro(a.plano.exigidas),
              contexto: <>Em {inteiro(a.plano.formas)} sistemas por município com plano.</>,
            },
            {
              rotulo: "Cobertas pelo controle informado",
              valor: `${numero(razaoPct(a.plano.cobertas, a.plano.exigidas), 1)}%`,
              contexto: <>{inteiro(a.plano.cobertas)} análises, limitadas ao exigido em cada sistema. Informadas: {inteiro(a.plano.realizadas)}.</>,
            },
            {
              rotulo: "Sistemas com plano e sem controle informado",
              valor: inteiro(a.plano.formas_sem_controle),
              contexto: <>{numero(razaoPct(a.plano.formas_sem_controle, a.plano.formas), 1)}% dos sistemas com plano, {ANO}.</>,
            },
          ]}
        />
        <Nota titulo="Por que a cobertura é limitada a 100% por sistema">
          Se um sistema informa mais análises que o exigido e outro informa menos, somar tudo esconderia a falta. Por isso cada sistema conta, no
          máximo, as análises exigidas. Em {ANO}, {inteiro(a.exclusoes.plano.formas_com_controle_em_outro_municipio ?? 0)} sistemas sem controle no
          município do plano tinham controle registrado em outro município que também atendem; eles aparecem como não cobertos no município do
          plano.
        </Nota>
        <Ressalva
          permite="Ver quanto do mínimo exigido de análises bacteriológicas na rede aparece no controle informado ao SISAGUA."
          naoPermite="Afirmar que as análises não foram feitas: o dado mede o que foi informado. Recoletas entram nas realizadas, e soluções coletivas (SAC) não entram nesta medida."
        />
      </Secao>

      <Secao
        id="qualidade-uf"
        titulo="Como cada UF aparece no SISAGUA?"
        texto="Registro, resultados e cobertura do plano por UF, em cada ano. Proporções pela soma das análises dos municípios da UF."
      >
        <TabelaDados
          titulo="Qualidade da água por UF e ano"
          arquivo="saneamento-qualidade-agua-uf.csv"
          colunas={[
            { id: "uf", rotulo: "UF" },
            { id: "ano", rotulo: "Ano" },
            { id: "municipios", rotulo: "Municípios", tipo: "inteiro" },
            { id: "controle", rotulo: "Com controle", tipo: "inteiro" },
            { id: "vigilancia", rotulo: "Com vigilância", tipo: "inteiro" },
            { id: "nenhum", rotulo: "Sem registro", tipo: "inteiro" },
            { id: "ctrl_ecoli", rotulo: "Controle: E. coli", tipo: "pct", casas: 2 },
            { id: "vig_ecoli", rotulo: "Vigilância: E. coli", tipo: "pct" },
            { id: "ctrl_cloro", rotulo: "Controle: cloro baixo", tipo: "pct" },
            { id: "vig_cloro", rotulo: "Vigilância: cloro baixo", tipo: "pct" },
            { id: "plano", rotulo: "Plano coberto", tipo: "pct" },
          ]}
          linhas={linhasUf}
          limite={27}
          ordemInicial={{ coluna: "uf", direcao: "asc" }}
          rotuloLinhas={{ singular: "linha", plural: "linhas" }}
        />
        <Ressalva
          permite="Comparar o grau de registro entre UFs e ver, ao lado, os resultados de controle e vigilância."
          naoPermite="Ordenar UFs por qualidade da água: onde o registro é menor, os resultados descrevem menos municípios e menos sistemas."
        />
      </Secao>

      <Secao
        id="qualidade-conferencia"
        titulo="Conferências e exclusões"
        texto="O que ficou fora de cada medida, e por quê. Nada foi imputado: cada exclusão é contada e publicada em meta.json."
      >
        <TabelaDados
          titulo="Controle mensal × arquivo de amostras fora do padrão"
          arquivo="saneamento-qualidade-conferencia-fora-padrao.csv"
          colunas={[
            { id: "ano", rotulo: "Ano" },
            { id: "parametro", rotulo: "Parâmetro" },
            { id: "controle", rotulo: "Contadores do controle mensal", tipo: "inteiro" },
            { id: "arquivo", rotulo: "Linhas no arquivo fora do padrão", tipo: "inteiro" },
            { id: "diferenca", rotulo: "Diferença", tipo: "inteiro" },
            { id: "pct", rotulo: "Arquivo ÷ controle", tipo: "pct" },
          ]}
          linhas={conferencia}
          limite={8}
          busca={false}
          rotuloLinhas={{ singular: "linha", plural: "linhas" }}
        />
        <Nota titulo="Por que os dois números não batem">
          O dicionário do Ministério diz que o registro de cada resultado fora do padrão não é obrigatório: os totais estão nos contadores do
          controle mensal. O arquivo de amostras fora do padrão fica, por isso, abaixo dos contadores. O Observatório usa os contadores e publica a
          diferença, sem ajustar nenhum dos lados.
        </Nota>
        <div className="mt-8">
          <TabelaDados
            titulo="Exclusões e agregações por ano"
            arquivo="saneamento-qualidade-exclusoes.csv"
            colunas={[
              { id: "ano", rotulo: "Ano" },
              { id: "conjunto", rotulo: "Conjunto" },
              { id: "motivo", rotulo: "Motivo" },
              { id: "linhas", rotulo: "Quantidade", tipo: "inteiro" },
            ]}
            linhas={exclusoes}
            limite={12}
            rotuloLinhas={{ singular: "motivo", plural: "motivos" }}
          />
        </div>
        <Fonte>
          Ministério da Saúde, SISAGUA: controle mensal, plano de amostragem, vigilância e amostras fora do padrão. Arquivos, sha256 e datas de
          atualização em meta.json; extração em {captura}.
          {auditoria.proveniencia.erros_catalogo.length > 0 && <> Erro no catálogo do Ministério: {auditoria.proveniencia.erros_catalogo.join(" ")}</>}
        </Fonte>
      </Secao>
    </>
  );
}
