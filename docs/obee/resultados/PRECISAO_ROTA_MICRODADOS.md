# Rota proposta para quantificar a precisão municipal

Proposta técnica, 13/10/2026. Nenhum acesso foi solicitado, nenhum termo foi aceito e nenhum microdado restrito foi obtido. A decisão, a identificação do pesquisador e a assinatura cabem ao responsável institucional. Este documento não altera o pacote congelado nem remove o bloqueador B1.

## Canal e condições a confirmar

O [comunicado oficial do IBGE de 31/08/2026, atualizado em 01/09/2026](https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/47888-ibge-disponibiliza-microdados-da-amostra-do-censo-demografico-2022-com-novo-modelo-de-acesso-e-reforco-a-confidencialidade), consultado em 13/10/2026, distingue acesso público por UF, acesso controlado por Áreas de Ponderação (APOND) e acesso restrito na Sala de Acesso a Dados Restritos (SAR). O nível APOND exige autenticação gov.br, formulário e termos; a SAR depende de projeto e autorização e permite trabalhar com a amostra completa, sem subamostragem. Não se presume que o arquivo controlado contenha todos os insumos necessários à variância municipal.

Antes de qualquer solicitação, o responsável deve conferir a [documentação e o dicionário oficiais](https://www.ibge.gov.br/estatisticas/downloads-estatisticas.html?caminho=Censos/Censo_Demografico_2022/Microdados_e_Areas_de_Ponderacao/Documentacao), a edição dos pesos e as regras de saída. Os códigos individuais das variáveis e os identificadores de desenho ainda não foram obtidos: a especificação abaixo identifica conceitos, não inventa códigos.

## Escopo a incluir no projeto

Objetivo: estimar erros-padrão, covariâncias e intervalos municipais das medidas amostrais da candidata OBEE, referência 2022, nas mesmas 26 capitais estaduais, sem Distrito Federal. Solicitar confirmação da compatibilidade com os resultados preliminares do SIDRA, estimados com áreas de ponderação preliminares. Diferenças de edição territorial, calibração, imputação ou subamostragem devem ser documentadas; não serão absorvidas silenciosamente.

| Medida / tabela | Variáveis conceituais necessárias | Estimando e universo a reconciliar |
|---|---|---|
| Educação / 10056 | Idade, frequência escolar, condições de elegibilidade, peso da pessoa | Razão de crianças de 4–5 anos que frequentam escola pelo total elegível, redes pública e privada |
| Renda / 10295 | Renda domiciliar per capita nominal de julho de 2022, componentes e imputações, relação com responsável, peso da pessoa | Mediana ponderada entre moradores elegíveis; excluir pensionistas, empregados domésticos e seus parentes conforme nota. Média 13431 apenas como sensibilidade separada |
| Mobilidade / 10330 | Ocupação, deslocamento habitual, tempo até o trabalho, município/país de trabalho, categorias ignoradas, peso da pessoa | Razão acima de uma hora no universo exato publicado; reproduzir exclusões e tratamento dos ignorados |
| Habitação / 9934 e 9940 | Moradores, dormitórios, espécie/ocupação do domicílio, peso domiciliar e peso de pessoa | Quatro razões: domicílios ou moradores em domicílios acima de 2 ou de 3 moradores/dormitório, com denominador próprio |
| Conectividade / 9936 | Acesso à Internet, espécie/ocupação, peso domiciliar | Razão de domicílios particulares permanentes ocupados com acesso pelo total elegível |

Solicitar município e APOND e sua correspondência territorial, identificador de domicílio para vincular pessoas sem identificadores diretos, estratos, unidades de seleção e todas as etapas relevantes, probabilidades/frações de amostragem, pesos finais e de replicação se disponíveis, calibração e ajustes de não resposta. **APOND não será presumida como estrato ou conglomerado**: requerer a especificação oficial do desenho. Pedir orientação sobre unidades de seleção únicas, subamostragem para divulgação e efeito da imputação. A estimação de domínios deve preservar o desenho, em vez de descartar previamente observações fora da capital.

## Estimação proposta, condicionada à documentação do desenho

Para uma razão municipal, definir indicadores de domínio/elegibilidade em cada unidade: `y_i = 1(domínio e condição)` e `x_i = 1(domínio e elegível)`; para moradores em domicílios adensados, usar a unidade pessoa ou totais domiciliares de moradores com os pesos adequados, sem misturar denominadores. Estimar `Ŷ = Σ w_i y_i`, `X̂ = Σ w_i x_i` e `R̂ = Ŷ/X̂`.

A linearização de Taylor requer

`Var(R̂) ≈ [Var(Ŷ) + R̂² Var(X̂) − 2 R̂ Cov(Ŷ,X̂)] / X̂²`.

A covariância não pode ser ignorada: numerador e denominador provêm das mesmas unidades. Estimar os totais e sua matriz de covariância pelo desenho oficial, ou aplicar replicação oficial recalculando a razão e os pesos em cada réplica. Para porcentagens, multiplicar o estimador por 100 e a variância por 10.000. Não substituir esse cálculo por fórmula de amostra aleatória simples, erro binomial ou bootstrap independente de indivíduos. Correção de população finita somente quando indicada pelo desenho.

A mediana exige estimação do quantil da distribuição ponderada, por inversão da função de distribuição com variância de desenho ou replicação validada pelo IBGE. A fórmula de razão não é uma fórmula de variância da mediana. A média per capita pode ser estimada como razão entre total ponderado de renda e total ponderado de pessoas elegíveis. Solicitar orientação para empates e massas de probabilidade em valores redondos.

Definir previamente o nível dos intervalos (proposta: 95%), o método adequado a proporções/quantis, graus de liberdade, supressões e critérios de publicação; essa proposta não cria intervalos no artefato atual. Se o acesso APOND não permitir identificar desenho e variância, submeter ao responsável a alternativa SAR ou pedido de tabulação oficial. Não reconstruir identificadores protegidos nem liberar resultados individuais.

## Reconciliação e critérios de aceite

1. Registrar versão, data de referência, data de obtenção, hashes dos insumos permitidos e dicionário, pesos e desenho utilizados. Manter arquivos restritos exclusivamente no ambiente autorizado; o repositório receberia apenas saídas agregadas liberadas.
2. Reproduzir primeiro os totais, denominadores, médias/medianas e percentuais de cada tabela, filtros e capital. Comparar com as respostas SIDRA preservadas, respeitando a precisão decimal publicada; divergências maiores que o arredondamento exigem investigação e explicação.
3. Separar efeitos de nova edição dos microdados/pesos, subamostragem, universo e estimador. Não recalibrar informalmente os microdados para forçar igualdade com a cesta.
4. Somente após reconciliação e revisão humana, propor erros e intervalos com desenho e método explícitos. A atualização de qualquer arquivo congelado exige nova versão e novo `freeze()` aprovado; esta rota não executa essa transição.

Saneamento (6805) é dado de universo e homicídios combinam registros e modelo: esta rota amostral não fornece sua incerteza. Erros não amostrais e incerteza municipal dos homicídios ocultos requerem investigações próprias. Até obter estimativas adequadas, as sete medidas conservam `precisao_municipal: nao_quantificada`, `standard_error: null` e `confidence_interval: null`.
