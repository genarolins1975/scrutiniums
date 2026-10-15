# Cadastro internacional: telefone verificado e CPF

Esta entrega antecede novos recortes do Setor Elétrico. Implementa a parte de
cadastro internacional da fase 2. A tradução das áreas de conta/administração,
a preferência de idioma persistente e as comunicações continuam como entregas
da fase 2; não são declaradas concluídas por esta mudança.

## Regra de cadastro

A etapa de perfil consulta exclusivamente o telefone E.164 e a confirmação de
posse armazenados no servidor. Telefone verificado com DDI +55 exige CPF válido
e único. Telefone estrangeiro verificado conclui sem campo CPF, armazenando
`NULL`. Idioma, país selecionado e telefone enviados junto do perfil não alteram
essa decisão. Sem telefone válido e verificado, o perfil não pode ser concluído.

O schema existente já admite CPF nulo, com índice único parcial; o telefone tem
unicidade própria. Testes com o PGlite real exercitam dois CPFs nulos, conflitos
de CPF e telefone entre requisições concorrentes e a gravação condicional do
perfil. A confirmação de SMS só avança uma vez a etapa `PHONE_PENDING`; uma
requisição antiga não substitui um telefone posteriormente confirmado.

A troca de telefone só está disponível após concluir o cadastro. Para trocar
um telefone estrangeiro por brasileiro, quem ainda não tem CPF precisa
cadastrá-lo em Conta antes de solicitar o SMS. A conferência também ocorre no
endpoint que valida o código. CPFs já registrados são preservados ao trocar de
telefone; não há exclusão de dados automática.

## Países e limites de envio

`SMS_PAISES_PERMITIDOS` é uma lista de códigos ISO separados por vírgula, por
exemplo `BR,PT,US`. Ausência ou valor vazio mantém somente `BR`. Código inválido
fecha a lista inteira, sem liberar destinos por aproximação. A interface recebe
somente as opções habilitadas pelo servidor; o catálogo contempla todos os
países reconhecidos por libphonenumber. O país real do telefone normalizado
decide a autorização, inclusive entre territórios que compartilham o DDI +1.

A política é conferida antes do envio e da validação no adaptador Twilio, comum
a cadastro, login e alteração de telefone. Limites agregados de 100 envios por
país/hora e 20 por prefixo/hora complementam os limites existentes por IP,
telefone e intervalo de reenvio. O prefixo agrupa DDI e os três primeiros dígitos
do número nacional. Como os limites atuais, os novos contadores são locais ao
processo; instalações com múltiplas instâncias precisam de armazenamento
compartilhado e dos limites do provedor. Sem credenciais Twilio em produção, o
adaptador falha fechado e não gera OTP de desenvolvimento.

## Ativação externa

A entrega não habilita países em produção nem envia SMS reais. Antes de liberar
outro país, o mantenedor precisa habilitá-lo nas Geo Permissions do Twilio Verify,
definir a lista permitida e validar a política de privacidade para titulares fora
do Brasil e transferências internacionais. O texto jurídico vigente não é
substituído por este documento técnico. A configuração padrão continua Brasil.

## Verificação

- `cadastro-internacional.test.ts`: rotas reais, formulário e banco isolado;
  aprovação de SMS, CPF condicional, unicidade e concorrência.
- `politica-sms.test.ts`: país efetivo, DDI compartilhado e configuração fechada.
- `sms-limites.test.ts`: bloqueio de destino, prefixo e país, sem provedor externo.
- Provas de DOM e navegador: países efetivamente oferecidos no login SMS, ausência
  de seletor inglês no fallback e preservação dos formulários nos dois idiomas.
