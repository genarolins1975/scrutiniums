# Mobilidade e transporte — Chegar aonde precisa

Implementação em branch, PR 136. Não implica merge nem publicação em produção.

## Experiência implementada

Oito rotas sob `/eficiencia-estatal/mobilidade-transporte`: panorama, tempo, transporte, acesso, seguranca, recursos, comparar e metodos. Renderização no servidor, filtros GET compartilháveis, ordem explícita, paginação de 24 registros com download integral, barras com escala desde zero, referência declarada e tabela equivalente. O snapshot completo permanece no servidor. Não há dependência nova de aplicação.

Acessibilidade nesta edição se refere a atributos físicos. Acesso espacial a oportunidades (Ipea), mortes/lesões (SIM) e despesas/entregas reconciliadas continuam fora dos indicadores integrados. As páginas de segurança e recursos descrevem estritamente estrutura e declarações da Pemob. A página de tempo só apresenta números quando presentes no snapshot verificado, sem substituí-los por dados demonstrativos.

## Contrato dos dados

`data/eficiencia_mobilidade/gold.json`, validado por SHA-256 antes de servir. Campos comuns: território, período, unidade, universo, ressalva, estado, fonte, célula/consulta, original e componentes das razões. Ausência não é zero. A seleção no gráfico e na tabela é a mesma; CSV não é truncado pela paginação. Arquivos originais e manifesto preservados no pacote de reprodução da branch.

Censo: tabela 10330, variável 13376, pessoas ocupadas de 10 anos ou mais que trabalham fora do domicílio e retornam três ou mais dias por semana. Meio principal significa aquele em que se passa mais tempo. '-' é zero absoluto, 'X' é suprimido, '..' não aplicável e '...' não disponível. Não inferir média das faixas nem tempo de ida/volta. Reconciliação de categorias é requisito para promoção, não normalização artificial a 100%.

Pemob Municipal 2025: indicadores de estoque mantêm data-base não explicitada; perguntas que mencionam 2024 mantêm 2024. Mediana: municípios elegíveis no recorte, sem ponderação populacional. Censo: Brasil agregado da própria fonte, não média simples dos municípios. Não há nota de eficiência nem alteração de escores.

## Verificações

- `python3 -m unittest pipeline.tests.test_eficiencia_mobilidade`
- `npx vitest run src/tests/obee-mobilidade.test.ts`
- `npm run lint`, `npx tsc --noEmit`, `npm run build`
- Auditoria HTTP/responsiva a ser registrada com versão exata; não tratar a existência dos testes como sua aprovação.

## Estado de aceite

Construção em andamento. Evidências de CI, auditoria HTTP, responsividade e lacunas serão registradas no PR. Não há revisão independente, teste com usuários ou leitor de tela atestados.
