"""Métricas do módulo Empresas (P036 a P039). As fórmulas rodam em
pipeline/energia/modulos/empresas.py (com as leituras de pipeline/energia/fontes/aneel_empresas.py
e cvm_empresas.py); a interface lê o valor calculado e esta definição, nunca refaz a conta."""

_GOLD = "empresas.json"
_PAG = ["/setor-eletrico/empresas"]
_PAG_ENT = ["/setor-eletrico/empresas", "/setor-eletrico/empresas/[entidade]"]
_SIGA = ["aneel_siga"]
_POL = ["aneel_siga", "aneel_polimero"]
_CVM = ["cvm_cad_cia_aberta", "cvm_dfp", "cvm_itr"]
_FRONTEIRA = ("Fronteira: potência fiscalizada das usinas em fase Operação no SIGA cujas participações publicadas somam "
              "100% (tolerância de 0,005 p.p. por parcela), Brasil, na data do SIGA; exclui micro e minigeração distribuída.")
_AUSENCIA_SIGA = ("Usina sem proprietário informado ou com participações que não somam 100% fica fora das medidas de "
                  "capacidade por proprietário e por grupo e é listada pelo motivo; potência fiscalizada vazia é ausência, "
                  "nunca zero.")
_VINCULO = "Vínculo usina × proprietário só pelo CNPJ publicado no próprio SIGA; nenhum vínculo por nome."
_CONFERENCIA = ("Conferência usina a usina com o conjunto Agentes de Geração da ANEEL (arquivo mensal independente): "
                "24.902 de 24.905 usinas comparáveis com a mesma lista de CNPJ e os mesmos percentuais em 30/09/2026.")
_GRUPO = ("Grupo = topo da cadeia de controladores únicos declarada à ANEEL na Composição Societária (Polímero): a cadeia "
          "para em controle compartilhado, controlador pessoa física, controlador sem CNPJ, declarações que discordam "
          "sobre o controlador (menos de 90% de concordância) ou agente sem declaração nos quatro trimestres até o de "
          "referência.")
_AUSENCIA_CVM = ("Conta não publicada no documento fica ausente (nunca zero). Coluna de demonstração com ativo total igual a "
                 "zero (escopo que a companhia não apresentou e a CVM preenche com zero, como o consolidado de quem deixou de "
                 "ter controladas) é ausência, nunca zero. Exercício curto de fato (constituição) fica fora da série anual e "
                 "vai para o CSV com recorte exercicio_irregular; data de início mal preenchida pela companhia num exercício "
                 "inteiro (balanço positivo no fim do ano anterior no mesmo documento) fica na série com nota.")
_ESCOPO = ("Consolidado e individual são séries separadas do mesmo CNPJ; nenhum valor é somado entre companhias (a "
           "controladora já consolida as controladas).")
_COBERTURA_CVM = ("Companhias abertas com setor de energia elétrica declarado à CVM (ou distribuidoras do índice com "
                  "registro): não representa o setor inteiro.")


def _conta_cvm(mid, titulo, pergunta, definicao, codigo, tipo, lim):
    return {
        "id": mid, "titulo": titulo, "pergunta": pergunta, "definicao": definicao,
        "unidade": "R$ nominais",
        "grao_geografico": "companhia aberta (CNPJ), consolidado ou individual",
        "grao_temporal": "exercício social (DFP) e trimestre (ITR)" if tipo == "fluxo" else "fim do exercício (DFP) e fim do trimestre (ITR)",
        "fontes": _CVM,
        "formula": f"VL_CONTA da conta {codigo} × escala (MIL = 1.000; UNIDADE = 1), maior versão do documento",
        "regra_agregacao": "Nenhuma agregação entre companhias. " + ("Fluxo: valor do período publicado (exercício, trimestre ou acumulado no ano); o 4º trimestre não é deduzido por diferença." if tipo == "fluxo" else "Saldo no fim do período; não se soma no tempo."),
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "OBSERVADO",
        "dimensoes": ["companhia", "escopo", "periodo", "documento"],
        "regras_comparabilidade": [_ESCOPO, "Reapresentação: o comparativo da DFP seguinte pode trazer outro valor para o mesmo exercício; o CSV publica os dois quando diferem em mais de R$ 1 mil."],
        "regra_cobertura": _COBERTURA_CVM,
        "politica_ausencia": _AUSENCIA_CVM,
        "validacoes": ["Só contas fixas (ST_CONTA_FIXA = S) e rótulo da 3.01 iniciado por 'Receita' (plano de empresas comerciais e industriais).",
                       "Escala e moeda conferidas linha a linha (REAL; MIL ou UNIDADE); outra escala é descartada e contada.",
                       "Domínio: ativo total publicado sempre maior que zero (coluna com ativo zero é tratada como não apresentada; violação restante vira stub).",
                       "Receita consolidada da CEMIG em 2024 relida do CSV original por código independente: R$ 39.819.620 mil."],
        "limitacoes": lim + ["Demonstrações societárias (CVM), não regulatórias (ANEEL)."],
        "gold": _GOLD, "paginas": _PAG_ENT,
    }


METRICAS = [
    {
        "id": "empresas_cobertura_vinculos",
        "titulo": "Cobertura dos vínculos de propriedade dos ativos de geração",
        "pergunta": "Que parte da potência em operação tem todos os proprietários identificados por CNPJ?",
        "definicao": "Potência fiscalizada das usinas em operação cujos proprietários publicados no SIGA têm todos CNPJ e participações somando 100%, dividida pela potência fiscalizada de todas as usinas em operação.",
        "unidade": "% da potência fiscalizada em operação",
        "grao_geografico": "Brasil",
        "grao_temporal": "fotografia diária do SIGA",
        "fontes": _SIGA,
        "numerador": "Σ potência fiscalizada das usinas em operação no estado 'vinculado' (kW)",
        "denominador": "Σ potência fiscalizada das usinas em operação (kW)",
        "formula": "100 × Σ kW(vinculado) ÷ Σ kW(operação)",
        "regra_agregacao": "Razão de somas de potência; a contagem de usinas é publicada ao lado, com o mesmo critério.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "dimensoes": ["estado do vínculo", "fase", "tipo de usina"],
        "regras_comparabilidade": ["Comparar só fotografias do SIGA (datas diferentes mudam o parque)."],
        "regra_cobertura": "Todas as usinas do SIGA diário (todas as fases nas contagens; só operação na razão de potência).",
        "politica_ausencia": _AUSENCIA_SIGA,
        "validacoes": [_VINCULO, "Campo de proprietários lido por inteiro por expressão ancorada: sobra de texto invalida a usina inteira (nenhuma em 30/09/2026).", _CONFERENCIA],
        "limitacoes": ["Proprietário pessoa física aparece no SIGA sem CPF: a usina fica no estado 'inclui_sem_documento' e o nome não é republicado.",
                       "Matriz e filial do mesmo CNPJ raiz publicadas com 100% cada somam 200%: a usina fica fora das medidas de capacidade (sem consolidação por inferência)."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "empresas_capacidade_proporcional",
        "titulo": "Capacidade proporcional à participação (proprietário direto)",
        "pergunta": "Quanta potência em operação corresponde às participações de cada empresa nos ativos?",
        "definicao": "Soma, sobre as usinas em operação com participações válidas, da potência fiscalizada multiplicada pela participação do CNPJ publicada no SIGA e dividida pela soma das participações da usina (100% dentro da tolerância de arredondamento; a divisão corrige resíduos como os 100,0001% de Machadinho e fecha a partição).",
        "unidade": "MW",
        "grao_geografico": "proprietário direto (CNPJ)",
        "grao_temporal": "fotografia diária do SIGA",
        "fontes": _SIGA,
        "formula": "cap_prop(e) = Σ_u kW_fiscalizado(u) × pct(e, u) ÷ Σ_e' pct(e', u) ÷ 1.000",
        "regra_agregacao": "Partição exata: a soma sobre todos os CNPJ mais a parcela sem CNPJ é igual à potência da fronteira (identidade verificada a cada geração com tolerância de ponto flutuante de 10⁻⁹).",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "dimensoes": ["proprietário", "tipo de usina", "regime de exploração"],
        "regras_comparabilidade": ["Capacidade não é energia gerada: não misturar com participação na geração verificada.", _FRONTEIRA],
        "regra_cobertura": "Usinas em operação no SIGA com participações válidas.",
        "politica_ausencia": _AUSENCIA_SIGA,
        "validacoes": [_VINCULO, _CONFERENCIA, "Identidade de partição: Σ proprietários + parcela sem CNPJ = fronteira (diferença relativa menor que 10⁻⁹)."],
        "limitacoes": ["O proprietário direto costuma ser uma sociedade de propósito específico; para o conglomerado ver a capacidade do grupo."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "empresas_capacidade_controle_direto",
        "titulo": "Capacidade sob controle direto",
        "pergunta": "Quanta potência em operação está em usinas em que a empresa detém a maioria?",
        "definicao": "Soma da potência fiscalizada inteira das usinas em operação em que o CNPJ detém mais de 50% da propriedade publicada no SIGA.",
        "unidade": "MW",
        "grao_geografico": "proprietário direto (CNPJ)",
        "grao_temporal": "fotografia diária do SIGA",
        "fontes": _SIGA,
        "formula": "cap_ctrl(e) = Σ_u kW_fiscalizado(u) × [pct(e, u) > 50] ÷ 1.000",
        "regra_agregacao": "Cada usina tem no máximo um controlador majoritário; usinas sem maioria (ex.: 50% e 50%) não são atribuídas e a potência delas é publicada à parte.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "dimensoes": ["proprietário", "tipo de usina"],
        "regras_comparabilidade": ["Métrica distinta da capacidade proporcional: não somar as duas nem trocar uma pela outra.", _FRONTEIRA],
        "regra_cobertura": "Usinas em operação no SIGA com participações válidas.",
        "politica_ausencia": _AUSENCIA_SIGA,
        "validacoes": [_VINCULO],
        "limitacoes": ["Critério de maioria da propriedade do ativo; acordos de acionistas que dão controle a minoritários não estão na fonte."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "empresas_capacidade_controle_grupo",
        "titulo": "Capacidade sob controle do grupo",
        "pergunta": "Quanta potência em operação está sob controle de cada grupo econômico com vínculo declarado?",
        "definicao": "Soma da potência fiscalizada das usinas em operação cujo proprietário majoritário (> 50%) tem o grupo como topo da cadeia de controladores únicos declarada à ANEEL.",
        "unidade": "MW",
        "grao_geografico": "grupo (CNPJ do topo da cadeia de controle)",
        "grao_temporal": "SIGA diário × trimestre de referência do Polímero",
        "fontes": _POL,
        "formula": "cap_ctrl_grupo(g) = Σ_u kW(u) × [topo(majoritário(u)) = g] ÷ 1.000",
        "regra_agregacao": "Partição das usinas com controlador majoritário: cada usina pertence a no máximo um grupo (sem dupla contagem de controladora e controlada).",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "dimensoes": ["grupo", "tipo de usina"],
        "regras_comparabilidade": [_GRUPO, _FRONTEIRA],
        "regra_cobertura": "Proprietários sem declaração no Polímero são o próprio topo (grupo de uma empresa); o motivo de parada de cada cadeia é publicado.",
        "politica_ausencia": _AUSENCIA_SIGA + " Cadeia sem controlador único termina no último CNPJ provado; nada é atribuído por semelhança de nome.",
        "validacoes": ["Percentual do Polímero confirmado como relativo ao agente declarante (967 de 968 casos do 1º trimestre de 2026).", "Ciclos na cadeia são detectados e encerram a subida."],
        "limitacoes": ["Depende da cobertura e da qualidade das declarações ao Polímero; declarações de terceiros discordantes deixam o nó ambíguo."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "empresas_capacidade_proporcional_grupo",
        "titulo": "Capacidade proporcional das empresas do grupo",
        "pergunta": "Quanta potência corresponde às participações diretas detidas pelas empresas sob controle de cada grupo?",
        "definicao": "Soma, sobre as usinas em operação com participações válidas, da potência × participação de cada proprietário direto cujo topo de cadeia de controle é o grupo. Não multiplica pela fração do grupo no proprietário (não é participação econômica indireta).",
        "unidade": "MW",
        "grao_geografico": "grupo (CNPJ do topo da cadeia de controle)",
        "grao_temporal": "SIGA diário × trimestre de referência do Polímero",
        "fontes": _POL,
        "formula": "cap_prop_grupo(g) = Σ_e [topo(e) = g] × cap_prop(e)",
        "regra_agregacao": "Partição da capacidade proporcional: Σ grupos = Σ proprietários diretos (identidade verificada).",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "dimensoes": ["grupo", "tipo de usina"],
        "regras_comparabilidade": [_GRUPO, _FRONTEIRA],
        "regra_cobertura": "Mesma da capacidade proporcional.",
        "politica_ausencia": _AUSENCIA_SIGA,
        "validacoes": ["Identidade: Σ grupos = Σ proprietários diretos (diferença relativa menor que 10⁻⁹)."],
        "limitacoes": ["Participação econômica indireta (look-through) não calculada: exige todos os caminhos societários com percentuais diretos."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "empresas_hhi_capacidade",
        "titulo": "Concentração da potência em operação (HHI)",
        "pergunta": "Quão concentrada está a propriedade da potência em operação?",
        "definicao": "Índice Herfindahl-Hirschman: soma dos quadrados das cotas (em %) de cada participante na potência da fronteira. Publicado por proprietário direto (capacidade proporcional), por grupo (capacidade proporcional das empresas do grupo) e por grupo de controle (capacidade sob controle), e por tipo de usina.",
        "unidade": "pontos (0 a 10.000)",
        "grao_geografico": "Brasil (fronteira explícita)",
        "grao_temporal": "fotografia diária do SIGA",
        "fontes": _POL,
        "formula": "HHI = Σ_i (100 × P_i ÷ T)²; CR4 e CR10 = Σ das 4 e 10 maiores cotas",
        "regra_agregacao": "Cotas sobre o total T da fronteira; a parcela sem participante identificável (pessoas físicas; no controle, usinas sem maioria) fica no denominador e fora do numerador.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "dimensoes": ["nível (proprietário, grupo, controle)", "tipo de usina"],
        "regras_comparabilidade": [_FRONTEIRA, "Não é o mercado relevante de uma análise concorrencial (energia vendida, submercado, contratos). Faixas descritivas do Guia para Análise de Atos de Concentração Horizontal do CADE (2016): abaixo de 1.500 não concentrado, de 1.500 a 2.500 moderadamente concentrado, acima de 2.500 altamente concentrado. As diretrizes americanas de 2010, com os mesmos limiares, foram substituídas em 2023 por outras com limiares diferentes."],
        "regra_cobertura": "Potência da fronteira; a parcela fora é publicada.",
        "politica_ausencia": "Participante sem CNPJ não entra no numerador: o HHI é limite inferior.",
        "validacoes": ["Soma das cotas ≤ 100%; HHI entre 0 e 10.000.",
                       "Recalculado nos testes por caminho independente: o SIGA original relido por outro parser (recorte de 14 usinas com valores escritos no teste e, quando o bronze existe, o arquivo inteiro: HHI 135,3 e CR4 18,21% por proprietário direto; HHI 392,1 por grupo com o mapa proprietário → grupo publicado)."],
        "limitacoes": ["Por proprietário direto subestima a concentração (sociedades de propósito específico contam separadas)."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "empresas_distribuidora_referencias",
        "titulo": "Ficha da distribuidora (referências cruzadas)",
        "pergunta": "Como a distribuidora aparece nos módulos de perdas, qualidade e tarifa?",
        "definicao": "Para cada CNPJ do índice de distribuidoras, os valores de referência publicados pelas golds perdas.json (taxa de perdas totais, não técnicas sobre a baixa tensão), qualidade.json (DEC, FEC e limites) e conta.json (tarifa B1 vigente), copiados sem recálculo, com o controlador declarado ao Polímero e o registro na CVM.",
        "unidade": "as de cada módulo de origem (%, horas, interrupções, R$/MWh)",
        "grao_geografico": "distribuidora (CNPJ)",
        "grao_temporal": "ano de referência de cada módulo; tarifa vigente na data da gold de conta",
        "fontes": ["aneel_samp_balanco", "aneel_continuidade", "aneel_tarifas_aplicacao", "aneel_polimero", "cvm_cad_cia_aberta"],
        "formula": "cópia pelo CNPJ canônico (14 dígitos) do valor publicado na gold de origem; a fórmula de cada número é a do módulo de origem (proveniências distribuidoras_perdas, distribuidoras_pnt, distribuidoras_qualidade e distribuidoras_tarifa na gold)",
        "regra_agregacao": "Nenhuma: um valor por distribuidora, o mesmo da página de origem.",
        "versao_formula": "1",
        # natureza herdada das golds de origem: taxa de perdas, DEC, FEC, limites e tarifa são
        # CALCULADOS pelos módulos de origem; as perdas não técnicas são ESTIMADAS pela fonte
        "natureza_fonte": "CALCULADO",
        "natureza_transformacao": "CALCULADO",
        "naturezas_por_campo": {"perdas.taxa_total_pct": "CALCULADO", "perdas.pnt_bt_pct": "ESTIMADO",
                                "qualidade.dec": "CALCULADO", "qualidade.fec": "CALCULADO",
                                "qualidade.dec_limite": "CALCULADO", "qualidade.fec_limite": "CALCULADO",
                                "tarifa.total": "CALCULADO"},
        "dimensoes": ["distribuidora", "módulo de origem"],
        "regras_comparabilidade": ["Pares: mesma classificação (concessionária ou permissionária) e mesmo porte do ranking de continuidade.", "Anos de referência podem diferir entre módulos; cada bloco traz o seu."],
        "regra_cobertura": "CNPJ presente no SAMP, na continuidade ou nas tarifas; índice com os campos ausentes onde a gold de origem não tem o dado.",
        "politica_ausencia": "Módulo sem dado para a distribuidora = bloco nulo (nunca zero).",
        "validacoes": ["Slug único por distribuidora; aliases só sem colisão.", "Valores iguais aos da gold de origem (teste por CNPJ)."],
        "limitacoes": ["Distribuidora encerrada (fim de série no SAMP) aparece como inativa com os dados históricos disponíveis.",
                       "O índice traz um ano de referência por módulo; a evolução própria vem das séries das golds de origem (perdas_anual.json, qualidade_distribuidoras_serie.json, conta_historico_b1.json) pelo mesmo CNPJ, indicadas em distribuidoras.series_evolucao e indice[].evolucao."],
        "gold": _GOLD, "paginas": _PAG_ENT,
    },
    _conta_cvm("empresas_receita", "Receita líquida (companhia aberta)", "Quanto a companhia faturou no período?",
               "Conta 3.01 (Receita de venda de bens e/ou serviços) da DRE padronizada da CVM.", "3.01", "fluxo",
               ["Nas distribuidoras inclui receita de construção da infraestrutura da concessão, com custo equivalente."]),
    _conta_cvm("empresas_ebit", "Resultado antes do resultado financeiro e dos tributos", "Qual o resultado operacional contábil?",
               "Conta 3.05 da DRE padronizada da CVM. Não é EBITDA (depreciação e amortização não somadas de volta).", "3.05", "fluxo",
               ["EBITDA não é conta padronizada e não é publicado pelo observatório."]),
    _conta_cvm("empresas_lucro_liquido", "Lucro ou prejuízo do período", "Quanto a companhia lucrou?",
               "Conta 3.11 da DRE padronizada da CVM; no consolidado inclui a parcela dos não controladores (3.11.02).", "3.11", "fluxo", []),
    _conta_cvm("empresas_lucro_controladores", "Lucro atribuído aos sócios da controladora", "Quanto do lucro consolidado pertence aos acionistas da companhia?",
               "Conta 3.11.01 da DRE consolidada padronizada da CVM (o lucro sem a parcela dos sócios não controladores).", "3.11.01", "fluxo",
               ["Só existe no consolidado; no individual o lucro inteiro (3.11) é da companhia."]),
    _conta_cvm("empresas_caixa", "Caixa e equivalentes de caixa", "Quanto a companhia tinha em caixa e equivalentes no fim do período?",
               "Conta 1.01.01 do balanço patrimonial ativo.", "1.01.01", "saldo",
               ["Aplicações financeiras fora de equivalentes de caixa ficam em outras contas do ativo."]),
    _conta_cvm("empresas_emprestimos_cp", "Empréstimos e financiamentos no passivo circulante", "Quanto vence em até 12 meses em empréstimos, financiamentos e debêntures?",
               "Conta 2.01.04 do balanço patrimonial passivo (inclui debêntures).", "2.01.04", "saldo",
               ["Arrendamentos entram só quando a companhia os classifica nessa conta."]),
    _conta_cvm("empresas_emprestimos_lp", "Empréstimos e financiamentos no passivo não circulante", "Quanto vence depois de 12 meses em empréstimos, financiamentos e debêntures?",
               "Conta 2.02.01 do balanço patrimonial passivo (inclui debêntures).", "2.02.01", "saldo",
               ["Arrendamentos entram só quando a companhia os classifica nessa conta."]),
    _conta_cvm("empresas_caixa_operacional", "Caixa líquido das atividades operacionais", "Quanto caixa as operações geraram (ou consumiram) no período?",
               "Conta 6.01 da demonstração dos fluxos de caixa (método direto ou indireto). No ITR, acumulada desde janeiro.", "6.01", "fluxo",
               ["Método direto e indireto chegam ao mesmo total, mas as linhas internas diferem e não são publicadas aqui."]),
    _conta_cvm("empresas_patrimonio_liquido", "Patrimônio líquido", "Qual o patrimônio líquido no fim do período?",
               "Conta 2.03 do balanço patrimonial passivo.", "2.03", "saldo", []),
    _conta_cvm("empresas_ativo_total", "Ativo total", "Qual o ativo total no fim do período?", "Conta 1 do balanço patrimonial ativo.", "1", "saldo", []),
    _conta_cvm("empresas_caixa_investimento", "Caixa líquido das atividades de investimento",
               "Quanto caixa foi aplicado (ou gerado) em atividades de investimento?",
               "Conta 6.02 da demonstração dos fluxos de caixa (método direto ou indireto).", "6.02", "fluxo",
               ["Inclui aquisições, aplicações financeiras e resgates; não é o investimento em ativos da concessão, que não tem conta fixa."]),
    {**_conta_cvm("empresas_divida_bruta", "Empréstimos, financiamentos e debêntures", "Quanto a companhia deve em empréstimos, financiamentos e debêntures?",
                  "Soma das contas 2.01.04 (circulante) e 2.02.01 (não circulante) do mesmo escopo e da mesma data.", "2.01.04 + 2.02.01", "saldo",
                  ["Não desconta caixa (não é dívida líquida); arrendamentos entram só quando a companhia os classifica nessas contas."]),
     "natureza_transformacao": "CALCULADO", "numerador": None,
     "formula": "divida_bruta = VL(2.01.04) + VL(2.02.01), mesmo escopo e mesma data; ausente se uma das duas faltar"},
]
# numerador None não é campo de razão: remove para o validador não ver denominador órfão
for _m in METRICAS:
    if _m.get("numerador") is None:
        _m.pop("numerador", None)
