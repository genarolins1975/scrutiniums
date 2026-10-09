"""Métricas do módulo Território (P002, mapa geográfico transversal). As fórmulas rodam em
pipeline/energia/modulos/territorio.py; a interface lê o valor calculado e esta definição.

O módulo reapresenta no território números que outros módulos definem (perdas, DEC e
FEC, tarifa, MMGD, Tarifa Social, PLD, EAR): a definição deles continua no arquivo de
métricas do módulo de origem, e o catálogo da gold (campo `metrica` de cada indicador)
aponta para ela. Aqui ficam só as medidas que o próprio índice territorial calcula:
vínculos, pertença ao submercado, somas de usinas por município, conferências."""

_GOLD = "territorio.json"
_PAG = ["/setor-eletrico/territorio"]
_REL = ["aneel_indqual_municipio", "aneel_continuidade_limites", "aneel_mmgd_municipio"]
_ONS = ["territorio_ons_areas_carga"]
_EPE = ["territorio_epe_webmap"]
_SIGA = ["aneel_siga"]
_GRAO = ("Nenhum valor desce de grão: o município guarda a referência à distribuidora, ao conjunto e ao submercado, "
         "nunca o valor deles.")

METRICAS = [
    {
        "id": "territorio_vinculo_municipio_distribuidora",
        "titulo": "Distribuidoras que atendem o município",
        "pergunta": "Que distribuidora atende o meu município?",
        "definicao": ("Distribuidoras (CNPJ) ligadas ao município IBGE pela relação oficial conjunto elétrico × município da "
                      "ANEEL (IndQual Município e limites de continuidade do ano), com o estado do vínculo publicado pelo "
                      "módulo Perdas: 1 = confirmado por empreendimento de MMGD da distribuidora no município; 0 = relação "
                      "sem confirmação; 2 = só pelo cadastro de MMGD: município que a relação não cobre, ligado à "
                      "distribuidora que tem nele ao menos 10 empreendimentos de MMGD e ao menos 5% dos empreendimentos do "
                      "município (regra do módulo Perdas, aneel_perdas.vinculos_so_mmgd). Município fora da relação sem "
                      "distribuidora acima dos dois limiares fica sem vínculo (ex.: Porto Rico do Maranhão, com 5 "
                      "empreendimentos da Equatorial Maranhão e cujo conjunto no IndQual não tem limite de 2026)."),
        "unidade": "referências (índice da distribuidora e estado do vínculo)",
        "grao_geografico": "município (código IBGE) × distribuidora (CNPJ)",
        "grao_temporal": "relação vigente do ano (2026)",
        "fontes": _REL,
        "regra_agregacao": "Não se agrega: é uma lista de vínculos por município.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "OBSERVADO",
        "dimensoes": ["município", "distribuidora", "estado do vínculo"],
        "regras_comparabilidade": [_GRAO, "Município com mais de uma distribuidora não tem divisão interna conhecida: nenhuma é escolhida por conta própria."],
        "regra_cobertura": "Os 5.571 municípios da malha do IBGE (revisão 2025); código da relação fora da malha listado à parte.",
        "politica_ausencia": "Município sem vínculo fica com lista vazia e é listado; nunca recebe a distribuidora de um vizinho nem a de um cadastro de MMGD abaixo dos limiares.",
        "validacoes": ["Contagens de municípios compartilhados, vínculos e vínculos sem confirmação iguais às publicadas pelo módulo Perdas.",
                       "Municípios por distribuidora (confirmados e só MMGD) iguais aos da base de Perdas.",
                       "Distribuidoras por município comparadas com os conjuntos do módulo Qualidade (diferenças listadas)."],
        "limitacoes": ["Sem polígono oficial de concessão acessível: a área é a união de municípios inteiros.",
                       "A relação de 2026 não descreve anos anteriores (absorções e trocas de concessão)."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_municipios_compartilhados",
        "titulo": "Municípios atendidos por mais de uma distribuidora",
        "pergunta": "Em quantos municípios mais de uma distribuidora atende?",
        "definicao": "Contagem de municípios com duas ou mais distribuidoras de vínculo 1 (confirmado) ou 2 (só pelo cadastro de MMGD).",
        "unidade": "municípios",
        "grao_geografico": "Brasil",
        "grao_temporal": "relação vigente do ano",
        "fontes": _REL,
        "numerador": "municípios com 2 ou mais distribuidoras de vínculo 1 ou 2",
        "regra_agregacao": "Contagem simples de municípios.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": "#{m : |{d : vínculo(m, d) ∈ {1, 2}}| ≥ 2}",
        "dimensoes": ["UF"],
        "regras_comparabilidade": ["Vínculo 0 (sem confirmação) não conta: a relação oficial tem códigos de município evidentemente errados."],
        "regra_cobertura": "Municípios da malha do IBGE.",
        "politica_ausencia": "Município sem vínculo válido fora da contagem.",
        "validacoes": ["Igual à contagem publicada na base de Perdas (mapa.municipios_compartilhados)."],
        "limitacoes": ["Compartilhar o município não diz que parte de cada distribuidora atende."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_submercado_municipio",
        "titulo": "Submercado do município (pela UF, pela camada oficial da EPE e pelas áreas de carga do ONS)",
        "pergunta": "A que submercado pertence o meu município?",
        "definicao": ("Subsistema da UF do município na camada oficial da EPE (WebMap, Unidades da federação e Subsistemas do "
                      "SIN). A pertença de cada área de carga do ONS ao submercado é provada pelo fechamento da carga "
                      "verificada meia hora a meia hora em dois dias (soma das áreas geoelétricas mais a área de perdas igual à "
                      "carga do submercado, e nenhuma alternativa, mover a área ou trocá-la com outra, fecha). Uma área vale "
                      "como provada quando é provada em todo dia em que teve carga; com carga zero num dos dias, vale a prova do "
                      "outro; com carga zero nos dois, fica indeterminada. Estados: provado; provado_com_area_sem_carga (UF com "
                      "área sem carga nos dois dias, cuja pertença a soma não prova: TOCO, no Tocantins); fora_do_sin (a sede do "
                      "município é localidade isolada do PASI da EPE, isto é, há localidade isolada com o nome do município, ou "
                      "as localidades isoladas somam ao menos 50% da população estimada pelo IBGE: o submercado não se aplica e "
                      "fica nulo); com_localidade_isolada (localidades isoladas menores num município cuja sede e maior parte "
                      "da população estão no SIN: submercado da UF com aviso); nao_provado."),
        "unidade": "submercado (SE, S, NE, N), nulo quando não se aplica, e estado",
        "grao_geografico": "município, pela UF",
        "grao_temporal": "conferência a cada 30 dias (dois dias por conferência); ciclo anual do PASI",
        "fontes": _EPE + _ONS + ["epe_pasi_localidades"],
        "regra_agregacao": "Não se agrega.",
        "versao_formula": "2",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": ("submercado(m) = nulo se sede(m) ∈ localidades isoladas ou Σ pop_isolada(m) ÷ pop(m) ≥ 0,5; senão, sm tal que "
                    "todas as áreas de carga da UF de m são provadas em sm em todo dia conferido em que tiveram carga"),
        "dimensoes": ["UF", "município"],
        "regras_comparabilidade": [_GRAO, "PLD e EAR do submercado são do submercado inteiro; o município só aponta para ele.",
                                   "Município fora do SIN não recebe PLD, EAR nem MMGD estimada do submercado: o estado 'não se aplica' nunca vira valor."],
        "regra_cobertura": "27 UFs; 34 áreas de carga do dicionário do ONS por dia conferido; 160 localidades isoladas do PASI.",
        "politica_ausencia": "Dia com área sem resposta não conta; sem conferência, o estado é nao_provado (nunca se adota o mapeamento sem prova).",
        "validacoes": ["Mediana do resíduo absoluto por meia hora de cada submercado até 15 MWmed, e nenhuma alternativa (mover uma área ou trocar duas de submercados diferentes) dentro da mesma tolerância.",
                       "Subsistema provado pela soma igual ao da camada oficial da EPE e aos mapeamentos publicados pelos módulos Água e Carga.",
                       "Localidades do PASI (módulo Inclusão) iguais às da camada 27 do WebMap da EPE."],
        "limitacoes": ["Não há tabela oficial município → submercado: a divisa no mapa é a da UF.",
                       "A população do PASI e a estimativa do IBGE têm bases diferentes (a do PASI passa a do IBGE em Uiramutã): a razão separa os municípios de sede isolada dos demais (84% ou mais contra 9% ou menos no ciclo 2025), não mede a parte exata fora do SIN."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_residuo_area_carga",
        "titulo": "Resíduo do fechamento das áreas de carga",
        "pergunta": "As áreas de carga somam a carga do submercado?",
        "definicao": "Em cada meia hora, soma da carga das áreas geoelétricas atribuídas ao submercado mais a área de perdas do mesmo submercado, menos a carga do submercado; resumida pela mediana do valor absoluto no dia (e também pela média e pelo máximo).",
        "unidade": "MWmed",
        "grao_geografico": "submercado",
        "grao_temporal": "meia hora, resumida por dia",
        "fontes": _ONS,
        "numerador": "Σ carga das áreas do submercado + carga da área de perdas − carga do submercado (por meia hora)",
        "regra_agregacao": "Mediana do resíduo absoluto nas meias horas comuns a todas as áreas do submercado.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": "resíduo(sm, h) = Σ_a∈sm carga(a, h) + carga(perdas_sm, h) − carga(sm, h); resumo(sm, dia) = mediana_h |resíduo(sm, h)|",
        "dimensoes": ["submercado", "dia"],
        "regras_comparabilidade": ["Tolerância de 15 MWmed na mediana por meia hora, fixada pelos dados: ruído da hipótese até 7,9 MWmed e menor alternativa com 28,8 MWmed (13 e 16/09/2026); cada dia publica o seu ruído e a sua menor alternativa.",
                                   "O resíduo das médias do dia é publicado ao lado, para cada alternativa, mas não decide: ele deixa passar trocas de áreas de carga média quase igual no dia (Rondônia e Tocantins Norte em 16/09/2026: 7,9 MWmed) e é deslocado por uma única meia hora em consistência."],
        "regra_cobertura": "Dia com as 34 áreas e ao menos 40 meias horas comuns por submercado.",
        "politica_ausencia": "Área sem resposta: dia incompleto, sem resíduo.",
        "validacoes": ["Dois dias (útil e domingo) fecham dentro da tolerância e nenhuma alternativa fecha."],
        "limitacoes": ["A carga é consistida depois pelo ONS; resíduos de alguns MWmed (e meias horas isoladas maiores) são esperados e não alteram a pertença."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_usinas_municipio",
        "titulo": "Usinas declaradas só no município (contagem e potência)",
        "pergunta": "Quantas usinas o SIGA registra no meu município?",
        "definicao": ("Usinas do SIGA cujo único município declarado é o município (nome oficial do IBGE na UF, ou grafia "
                      "antiga documentada na DTB do IBGE): contagem e potência fiscalizada das em operação, sem os registros "
                      "de até 10 kW (medida própria); contagem e potência outorgada das em construção ou com construção não "
                      "iniciada. Usina declarada em vários municípios é listada em cada um, sem potência somada."),
        "unidade": "usinas; MW",
        "grao_geografico": "município (soma de usinas)",
        "grao_temporal": "cadastro do dia do SIGA",
        "fontes": _SIGA,
        "numerador": "Σ potência das usinas declaradas só no município",
        "regra_agregacao": "Soma de potências de usinas inteiras (mesma grandeza, kW ÷ 1.000); nunca repartição de usina entre municípios.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": "MW(m) = Σ potência fiscalizada (operação, exceto outorga Registro com até 10 kW) das usinas com municípios_declarados = {m} ÷ 1.000",
        "dimensoes": ["município", "estágio"],
        "regras_comparabilidade": ["MW é potência, não energia.", "Operação (fiscalizada) e carteira (outorgada) não se somam."],
        "regra_cobertura": "Todas as usinas do CSV do SIGA publicado pelo módulo Expansão; nomes não reconhecidos listados.",
        "politica_ausencia": "Município sem usina declarada = zero (o SIGA é o cadastro completo das outorgas); usina sem potência fiscalizada conta e não soma.",
        "validacoes": ["Soma por UF principal das usinas em operação (com os registros) igual à da gold de Expansão (0,05 MW).",
                       "Contagens e potências de municípios conferidas contra o CSV original do SIGA por outro código."],
        "limitacoes": ["A potência de usina em vários municípios (grandes hidrelétricas, por exemplo) não aparece em nenhuma soma municipal.",
                       "Micro e minigeração distribuída não está no SIGA: aparece na métrica de MMGD."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_registros_10kw_municipio",
        "titulo": "Registros do SIGA de até 10 kW em operação declarados só no município",
        "pergunta": "Quantos sistemas de geração de pequeno porte o SIGA registra no meu município?",
        "definicao": ("Empreendimentos do SIGA com tipo de outorga 'Registro', em operação, potência fiscalizada de até 10 kW e "
                      "um único município declarado: contagem e kW. Em 30/09/2026 são 16.035, quase todos UFV de 1 a 3 kW de "
                      "propriedade da Equatorial Pará (13.100) e da Energisa MS (2.864), em nome de moradores, escolas e "
                      "igrejas de Portel, Corumbá, Porto de Moz, Curralinho, Tucuruí, Melgaço e Prainha: sistemas "
                      "individuais. Somados às usinas, dominariam a contagem municipal."),
        "unidade": "registros; kW",
        "grao_geografico": "município (soma de registros)",
        "grao_temporal": "cadastro do dia do SIGA",
        "fontes": _SIGA,
        "numerador": "Σ potência fiscalizada dos registros de até 10 kW declarados só no município",
        "regra_agregacao": "Contagem e soma de potências da mesma grandeza (kW).",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": "kW(m) = Σ potência fiscalizada dos empreendimentos com outorga = Registro, estágio = operação, potência ≤ 10 kW e municípios_declarados = {m}",
        "dimensoes": ["município"],
        "regras_comparabilidade": ["Não se soma à contagem de usinas do município: um sistema individual de 1 kW não é comparável a uma usina.",
                                   "kW, não MW: a ordem de grandeza é a de uma residência."],
        "regra_cobertura": "Todos os registros do CSV do SIGA publicado pelo módulo Expansão.",
        "politica_ausencia": "Município sem registro = zero (o SIGA é o cadastro completo); registro sem potência fiscalizada fica fora desta medida e conta como usina.",
        "validacoes": ["Contagem e kW de Portel (PA) conferidos contra o CSV original do SIGA por outro código."],
        "limitacoes": ["O limite de 10 kW separa o grupo de sistemas individuais do SIGA (16.008 registros até 5 kW e 27 entre 5 e 10 kW, contra 262 entre 10 e 75 kW); não é uma categoria da fonte."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_ear_subsistema_pct",
        "titulo": "Energia armazenada do subsistema (% da EAR máxima), último dia",
        "pergunta": "Quanto os reservatórios do submercado da minha região guardam hoje?",
        "definicao": ("EAR verificada do subsistema em % da EAR máxima e em MWmês, como o ONS publica no conjunto EAR Diário por "
                      "Subsistema (ear_verif_subsistema_percentual, ear_verif_subsistema_mwmes, ear_max_subsistema), no último dia "
                      "integrado pelo módulo Água e clima. Reapresentada no território no grão do submercado."),
        "unidade": "% da EAR máxima; MWmês",
        "grao_geografico": "subsistema (SE, S, NE, N)",
        "grao_temporal": "dia",
        "fontes": ["ear_subsistema_di"],
        "regra_agregacao": "Não se agrega: o SIN tem métrica própria (agua_ear_sin_pct), ponderada pela EAR máxima.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "OBSERVADO",
        "dimensoes": ["subsistema"],
        "regras_comparabilidade": [_GRAO, "Percentual do subsistema inteiro: não é um valor do município, e percentuais de subsistemas diferentes não se somam nem se tira média simples."],
        "regra_cobertura": "Quatro subsistemas no último dia publicado.",
        "politica_ausencia": "Sem o dia na gold de Água e clima, o bloco sai indisponível com o motivo.",
        "validacoes": ["Valor igual ao de agua_detalhe.json (armazenamento.subsistemas)."],
        "limitacoes": ["O ONS consiste e revisa a EAR; o valor é o da última captura do módulo Água e clima."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_usinas_coordenada_concordancia",
        "titulo": "Coordenada da usina dentro do município declarado",
        "pergunta": "A coordenada do SIGA cai no município que ele declara?",
        "definicao": "Ponto em polígono da coordenada do SIGA (graus) contra os municípios declarados da usina, na malha municipal do IBGE em qualidade máxima (API de malhas v4, sem simplificação). Sem a malha máxima de alguma UF, a conferência usa a malha simplificada do mapa e o resultado é marcado como aproximado.",
        "unidade": "usinas",
        "grao_geografico": "usina",
        "grao_temporal": "cadastro do dia do SIGA",
        "fontes": _SIGA + ["territorio_ibge_malha_maxima"],
        "numerador": "usinas com a coordenada dentro de um município declarado",
        "denominador": "usinas com coordenada e município reconhecido",
        "regra_agregacao": "Contagem simples.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": "concordância = #{u : coordenada(u) ∈ ∪ polígonos(municípios_declarados(u))}",
        "dimensoes": ["tipo de usina"],
        "regras_comparabilidade": ["Conferência, não correção: o município declarado prevalece."],
        "regra_cobertura": "Usinas com coordenada (zero na fonte = sem coordenada).",
        "politica_ausencia": "Sem coordenada ou sem município reconhecido: fora da conferência (nulo).",
        "validacoes": ["Ao menos 90% dentro (abaixo disso, ressalva).",
                       "Comparação com a malha simplificada do mapa publicada: quantas usinas ela daria como fora estando dentro (falsos positivos da simplificação)."],
        "limitacoes": ["A coordenada do SIGA é aproximada (centróide do empreendimento): mesmo na malha máxima, ponto perto da divisa pode cair no vizinho.",
                       "A malha do mapa (qualidade mínima do IBGE, simplificada a 400 m) não serve para esta conferência: numa amostra de 25 usinas que ela dava como fora, 7 estavam dentro na malha máxima."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_lpt_municipio",
        "titulo": "Domicílios atendidos pelo Luz para Todos no município (período inteiro)",
        "pergunta": "Quantas ligações o Luz para Todos registrou no meu município?",
        "definicao": ("Soma, por município, dos domicílios atendidos em todos os anos e programas do arquivo do MME integrado "
                      "pelo módulo Inclusão; linhas sem código IBGE ligadas pelo nome oficial do IBGE na UF ou por grafia "
                      "antiga documentada na DTB."),
        "unidade": "domicílios",
        "grao_geografico": "município",
        "grao_temporal": "acumulado de 2004 até o último mês do arquivo",
        "fontes": ["mme_luz_para_todos"],
        "numerador": "Σ domicílios atendidos (ano × programa)",
        "regra_agregacao": "Soma de contagens da mesma grandeza.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": "LPT(m) = Σ_ano Σ_programa domicílios(m, ano, programa)",
        "dimensoes": ["município"],
        "regras_comparabilidade": ["Ligação registrada no período, não situação atual de acesso; o ano corrente é parcial."],
        "regra_cobertura": "Municípios com alguma linha no arquivo.",
        "politica_ausencia": "Município sem linha no arquivo = nulo (ausência de registro), não zero.",
        "validacoes": ["Nenhuma linha do arquivo fica sem município depois da ligação pelo nome (as restantes seriam listadas)."],
        "limitacoes": ["Domicílio atendido é ligação nova; não é pessoa nem unidade consumidora com benefício."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "territorio_localidades_isoladas_municipio",
        "titulo": "Localidades do município atendidas por sistema isolado",
        "pergunta": "Há parte do meu município fora do Sistema Interligado Nacional?",
        "definicao": "Localidades da lista de sistemas isolados do PASI (EPE, ciclo mais recente integrado pelo módulo Inclusão) cujo município, pelo nome oficial do IBGE na UF, é o município; população declarada pela fonte.",
        "unidade": "localidades; habitantes",
        "grao_geografico": "município (soma de localidades)",
        "grao_temporal": "ciclo anual do PASI",
        "fontes": ["epe_pasi_localidades"],
        "numerador": "Σ população das localidades do município",
        "regra_agregacao": "Contagem e soma da população declarada.",
        "versao_formula": "1",
        "natureza_fonte": "OBSERVADO",
        "natureza_transformacao": "CALCULADO",
        "formula": "isol_pop(m) = Σ população(l), l ∈ localidades isoladas com município(l) = m",
        "dimensoes": ["município", "UF"],
        "regras_comparabilidade": ["A lista indica localidades fora do SIN e a população declarada de cada uma; a população do PASI e a estimada pelo IBGE têm bases diferentes, então a razão entre elas classifica o município (fora do SIN ou com localidade isolada), mas não mede a parte exata fora do SIN."],
        "regra_cobertura": "160 localidades no ciclo 2025, todas ligadas a um município.",
        "politica_ausencia": "Município sem localidade na lista = zero localidades; população não informada pela fonte fica nula.",
        "validacoes": ["Todas as localidades ligadas a um município pela igualdade do nome na UF."],
        "limitacoes": ["A interligação prevista muda a lista de um ciclo para outro."],
        "gold": _GOLD, "paginas": _PAG,
    },
]
