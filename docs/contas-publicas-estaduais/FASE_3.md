# Cobertura nacional e comparação estadual — v0.3.0

A base primária passa de seis para 27 UFs. São 54 observações de dívida (2025 Q3 e 2026 Q1) e 108 de execução (quatro indicadores no encerramento de 2025), totalizando 162 observações conferidas. A conferência de fonte não constitui auditoria das contas, confronto com a LOA ou medida de eficiência.

## Origem e reprodução

- Captura usada nesta versão: [run 38233361017](https://github.com/genarolins1975/scrutiniums/actions/runs/38233361017), job 114758127706, commit `b108daed17917ef625a45a3b21fe037e792c0055`.
- As 81 respostas públicas e dois manifestos foram recuperados pelo conector do GitHub em pacotes textuais gzip/base64. Cada pacote foi decodificado e seu SHA-256 conferido antes de gravar os bytes originais. Nenhuma credencial ou configuração de acesso foi alterada. O mecanismo temporário de transporte foi retirado do workflow após a incorporação do acervo.
- Arquivos permanentes: `public/contas-estaduais/evidencias/20261012-nacional/`. A captura anterior das seis provas permanece em seu diretório original.
- Reprodução sem rede: `python3 -m pipeline.contas_estaduais.consolidar --check`.
- Todas as 27 UFs passaram nas verificações de identidade, período, esfera/anexo, paginação, contagem, hashes, unicidade dos campos, denominadores positivos e coerência dos estágios. As 54 razões de dívida reconciliam a duas casas decimais, sem ampliar a tolerância de 0,005 p.p.
- TO/2026: percentual declarado 14,55%; cálculo a partir dos valores monetários 14,5452902%. AM/2026: declarado 20,65%; cálculo 20,6531677%. A base herdada permanece intacta.

## Comparação

O novo painel compara CE-01, CE-04, CE-05, CE-06 e CE-11, usando apenas observações da fonte original conferida. Não usa percentuais herdados para completar a referência.

A mediana não ponderada é calculada com os entes do recorte, com o mesmo peso por ente. Não é uma meta, um limite legal, uma média ponderada pela despesa ou uma nota de desempenho. O filtro regional altera tanto a população quanto a referência. O DF é excluído por padrão e pode ser incluído explicitamente, com a ressalva das competências estaduais e municipais.

A apresentação oferece ordenação alfabética ou por valor, fonte comum, escala comum, zero marcado, preservação de negativos, valor exato por UF, seleção da ficha e distância da referência em pontos percentuais. A ordem por valor não recebe rótulo de melhor/pior.

O CSV usa exatamente o indicador, ano, região e opção de DF selecionados. Inclui todas as linhas do universo selecionado, inclusive as sem observação, além da mediana, diferença em p.p., URL da consulta, arquivo preservado e SHA-256. Filtros inválidos retornam HTTP 400.

O recorte de execução permanece restrito a 2025. Selecionar 2026 para execução apresenta ausência e acesso explícito ao encerramento de 2025; não reutiliza automaticamente o ano anterior.

## Downloads e interface

A abertura direta de um JSON havia sido bloqueada pelo Chrome. Nesta retomada, o arquivo original de Pernambuco foi obtido pela rotina de download, e seus 227.136 bytes reconciliaram com SHA-256 `ea531794d506cb2e9b3ea9ce2f289be9ea8bceacfae4de8d5148177333a09513`.

Links de respostas estáticas agora declaram a ação de download. Exportações JSON e o novo CSV usam Content-Disposition de arquivo. Rótulos da tabela monetária foram ajustados para linguagem de leitura (por exemplo, “Dotação atualizada”). Essas mudanças não reduzem as proteções do navegador.

## Verificação e limites

- 14 testes Python e 17 testes TypeScript aprovados localmente; reprodução integral, tipos e lint aprovados.
- Novos testes cobrem mediana par/ímpar, zero, negativos, exclusão/inclusão do DF, universo regional, ausência temporal, exportação do recorte e rejeição de parâmetros inválidos.
- CI completo e inspeção visual do commit final são registrados no PR #155.
- Os outros 43 contratos continuam sem observação publicada. A série anterior a 2025 permanece herdada e explicitamente identificada. Despesa, entrega e resultado ainda precisam ser ligados para avaliar eficiência e eficácia; não há ranking composto.

## Conclusão da retomada

O comparador restaura indicador, região, inclusão do DF e ordenação a partir do endereço, inclusive no primeiro carregamento e ao voltar/avançar no navegador. Mudanças de UF/ano conservam esses parâmetros. A tabela equivalente mantém o recorte, a ordem, os valores, as diferenças em pontos percentuais e os arquivos de origem. A exportação recusa valores ambíguos para a opção de DF.

Validação local desta retomada: 14 testes Python, 17 testes TypeScript, reprodução integral, TypeScript e lint aprovados. A restrição de abertura de porta local exige validar a interface na prévia remota. CI e inspeção visual são registrados na descrição do PR após a sincronização.
