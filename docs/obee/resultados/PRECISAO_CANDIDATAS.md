# Precisão e divulgação municipal das candidatas

12/10/2026 · Protocolo v1 · Habitação e Conectividade · 26 capitais estaduais, sem DF, 2022.

## Decisão

O protocolo descritivo está definido; **a precisão municipal continua não quantificada**. As razões adquiridas podem fundamentar análise descritiva com ressalva obrigatória, mas não autorizam afirmar significância das diferenças, confiança de posições ou publicar um novo escore. Esta é uma recomendação metodológica para revisão editorial, não uma aprovação de produção. Nenhuma alteração no gate da interface, na v2 ou nos pesos.

A implementação gera 52 registros: duas definições principais por capital. Habitação: proporção de domicílios com mais de dois moradores por dormitório. Conectividade: proporção de domicílios com Internet. As demais definições de adensamento permanecem apenas no estudo de sensibilidade; não recebem precisão por extensão deste protocolo. Os dados expressam condições dos moradores, não efeitos causais do Estado.

## Evidência examinada

1. [Nota metodológica 07/2024](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102149.pdf), páginas impressas 22–24: FGV para CV aproximados de **totais** de pessoas e domicílios, nos níveis Brasil, regiões e UFs, considerando pesos calibrados.
2. [Anexo oficial](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102149_tabela.zip): 33 abas, sendo Brasil, cinco regiões e 27 UFs. Foram lidos os títulos, tipos, parâmetros A/B e tabelas de CV. Não contém abas municipais nem covariâncias para nossas razões. São Paulo e Rio de Janeiro nomeiam UFs nesse arquivo, não capitais. O [inventário reproduzível](precisao-anexo-inventario.json) registra todas as abas e parâmetros, com hashes do ZIP e XLSX. Não utilizamos esses parâmetros para calcular erros de capitais.
3. [Divulgação dos microdados em 31/08/2026](https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/47888-ibge-disponibiliza-microdados-da-amostra-do-censo-demografico-2022-com-novo-modelo-de-acesso-e-reforco-a-confidencialidade), atualizada em 01/09: acesso público com geografia até UF; acesso controlado até APOND mediante identificação e termos; base completa sem subamostragem na sala de acesso restrito, sujeita a projeto e análise. Não solicitamos acesso nem obtivemos microdados controlados. O anúncio não comprova, por si, viabilidade de estimar os erros das razões municipais da edição preliminar.

O [dossiê](precisao-candidatas-evidencia.json) delimita as conclusões às fontes efetivamente examinadas; não afirma que nenhuma outra fonte adequada exista.

## Contrato de apresentação

| Uso | Regra nesta edição |
|---|---|
| Valores originais e diferença em pontos percentuais | Análise descritiva, mesma definição, universo e ano; citar tabela e ressalva |
| Casas decimais | Apresentar uma casa no produto; manter valores completos no arquivo auditável. Arredondamento não mede erro amostral |
| Ordenação e percentis condicionais | Somente diagnóstico experimental; explicitar coorte fixa e ausência de inferência |
| Melhor/pior com certeza; diferença significativa | Não autorizado pelas evidências atuais |
| Erro-padrão e intervalo de confiança | `null`, nunca zero; não construir intervalo binomial com totais expandidos |
| Faixa entre cenários | Sensibilidade a definições/pesos, nunca intervalo de confiança |
| Novo agregado em produção | Bloqueado; depende de revisão de conteúdo, pesos, divulgação e edição |

Ressalva obrigatória: **“Estimativa preliminar da amostra do Censo 2022. Precisão municipal não quantificada neste estudo; diferenças observadas não demonstram diferenças estatisticamente significativas.”** A ressalva deve acompanhar os valores, inclusive em exportações; não ficar apenas numa página metodológica remota. Evitar medalhas, pódios e linguagem de superioridade comprovada. O protocolo não cria um limite arbitrário de CV nem suprime estimativas por limiar sem fundamento.

O contrato computacional verifica valores finitos, denominador positivo, numerador entre zero e denominador, referência 2022, identidade municipal e coorte completa sem duplicações. Reutiliza as auditorias de fontes e hashes. `descriptive_use` expressa adequação ao protocolo condicionado; `publication_ready=false` permanece explícito. Este módulo é uma auditoria offline e não substitui o gate de produção.

## Como resolver a dependência de precisão

Há duas rotas admissíveis: obter do produtor erros apropriados às razões municipais exatas; ou estimá-los com dados e desenho acessíveis sob autorização válida. Em ambas, exigir:

- Mesma geografia, universo, definição, referência e versão dos resultados; reconciliar os totais com SIDRA 9934/9936 e explicar diferenças entre edições preliminares e microdados posteriores.
- Documentação do estimador e desenho, pesos, calibração e eventual subamostragem; pesos finais isolados não demonstram que a variância seja reproduzível.
- Variância direta da razão ou informação conjunta adequada sobre numerador e denominador. Somar categorias de adensamento também exige tratar a dependência entre elas. Nunca assumir covariância zero por ausência de informação.
- Para diferenças entre municípios, justificar o tratamento da dependência. Para percentis/escore/ranks, propagar conjuntamente a incerteza dos componentes e da normalização; erros marginais dos indicadores não bastam.
- Revisão independente, critérios explícitos de divulgação e decisão de edição. Uma nova fonte de precisão não aprova pesos nem validade de conteúdo automaticamente.

Se a aquisição exigir termos pessoais ou institucionais, o responsável autorizado deverá avaliar e formalizar o acesso. Não é necessário resolver esse acesso para avançar agora no parecer de conteúdo e pesos. Nenhum microdado controlado deve entrar no repositório público.

## Reprodução e continuidade

```sh
python3.12 -m pipeline.eficiencia_resultados.precisao_candidatas
python3.12 -m unittest pipeline.eficiencia_resultados.test_precisao_candidatas
```

Para reexaminar o anexo, baixar o ZIP oficial e chamar `inspect_annex(caminho)` do módulo. A função confere hashes de ambos os arquivos antes de ler XML, sem executar fórmulas. O resultado deve coincidir com `precisao-anexo-inventario.json`.

Próxima etapa: parecer de conteúdo e pesos da [cesta candidata v3](CESTA_CONJUNTA_V3.md), defendendo ou rejeitando o agrupamento material de 40% sem escolher pesos por conveniência de posições. A obtenção de precisão segue como dependência aberta; o protocolo não a declara resolvida.
