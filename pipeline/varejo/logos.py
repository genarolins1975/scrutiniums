"""Símbolos (logotipos) das empresas da coleção Varejo, baixados do site da própria companhia.

Uso (manual, fora da execução diária; os arquivos mudam raramente):

    python3 -m pipeline.varejo.logos              # baixa, valida e reescreve o manifesto
    python3 -m pipeline.varejo.logos --conferir   # só confere o manifesto contra os arquivos, sem rede

Regras (skill observatorio-layout, anexo componentes-e-graficos, "Identidade de empresas"):
* só o arquivo publicado pela própria companhia, no site de relações com investidores ou no site
  institucional (inclusive o CDN do provedor do site de RI, quando é a página de RI da companhia
  que o publica). Nenhum logo é redesenhado, recortado, recolorido ou aproximado; nada de terceiros;
* o arquivo é servido localmente (public/varejo/logos/<slug>.<ext>), nunca por hotlink, e sem
  alteração: o sha256 do manifesto é o do arquivo baixado;
* vínculo entre o logo e a entidade só por prova escrita em `vinculo`: CNPJ ou razão social que a
  própria página de origem exibe, ou o endereço de e-mail de RI que o cadastro de companhias
  abertas da CVM registra para aquele CNPJ e que é do mesmo domínio do site. Sem prova, sem logo;
* `fundo` diz para que fundo a companhia desenhou o arquivo ("claro" ou "escuro"): a interface põe
  o logo sobre uma placa desse tom, em vez de alterar o arquivo;
* SVG com script, evento, conteúdo embutido (inclusive imagem em data:), entidade ou referência
  externa é recusado, não "limpo";
* quando nenhum arquivo oficial pôde ser obtido, o manifesto registra a ausência com o motivo e a
  interface mostra o nome em texto.

O manifesto (public/varejo/logos/manifesto.json) tem uma entrada por entidade da coleção: os grupos
do ranking e os líderes de segmento (pipeline/varejo/curadoria/ranking.json), as fichas
(pipeline/varejo/curadoria/fichas) e as companhias do comparador (public/varejo/gold/empresas.json).
Formato: {"versao", "gerado_em", "regras", "logos": [{slug, nome_exibicao, papel, cnpj, vinculo,
nota, arquivo, formato, fundo, largura, altura, url_origem, pagina_origem, capturado_em, sha256,
bytes, metodo, extraido_de, derivado_de, derivacao, vinculo_conferido_por, vinculo_reforco, ausencia}]}; `ausencia`
é null ou {"motivo": texto}; `derivado_de` é null quando o arquivo é o original (sha256 do original de um
raster reduzido). `metodo` diz como os bytes chegaram: "direto" (requisição deste script à URL
de origem), "navegador" (o site recusa a requisição direta; bytes originais da resposta salvos numa
visita com navegador) ou "dono" (arquivo baixado e anexado pelo dono da plataforma); os dois
últimos entram com `--importar <slug> <arquivo>` e, quando a requisição falha numa recaptura, o
arquivo anterior da mesma origem é mantido. `extraido_de` não nulo: a companhia publica o logo como
um PNG embutido em base64 (num SVG que só o envolve, ou num elemento da página); o SVG segue
recusado e os bytes exatos do PNG são publicados. `derivado_de` e `derivacao`: recorte ou redução
determinística de um arquivo oficial, com o sha256 dos bytes de partida, a caixa e a ferramenta.
`vinculo_conferido_por`: "dono" quando a prova foi lida ou aceita por ele, e não relida pelo
script. `vinculo_reforco`: segunda evidência, lida pelo dono, que não troca a prova principal.
"""
import base64
import glob
import hashlib
import json
import os
import re
import struct
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.logos_listadas import svg_com_conteudo_ativo  # noqa: E402

DESTINO = os.path.join(base.RAIZ, "public", "varejo", "logos")
MANIFESTO = os.path.join(DESTINO, "manifesto.json")
PREFIXO = "/varejo/logos/"
LIMITE_BYTES = 60_000

# Os sites de RI e institucionais do varejo recusam agentes não identificados como navegador; o pedido
# é um GET simples do mesmo arquivo que a página pública entrega a qualquer visitante.
AGENTE = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

MZ = "https://cdn-sites-assets.mziq.com/wp-content"
CVM = ("cadastro de companhias abertas da CVM (dados.cvm.gov.br, cad_cia_aberta.csv, lido em 24/11/2026)")

# slug, nome de exibição, CNPJ (da gold ou o que a página de origem exibe), arquivo oficial, página em que é
# publicado, fundo para o qual foi desenhado, prova do vínculo, nota (ou None). url None = ausência, com o motivo
# no lugar da prova.
CURADORIA = [
    ("carrefour-brasil", "Grupo Carrefour Brasil", "75.315.333/0001-09",
     "https://grupocarrefourbrasil.com.br/images/logo/logo_gcb_branca.svg", "https://grupocarrefourbrasil.com.br/", "escuro",
     "CNPJ 75.315.333/0001-09 (Atacadão S.A., gold de empresas do Varejo; registro na CVM cancelado depois da incorporação "
     "das ações pelo Carrefour S.A.). Fato relevante da companhia arquivado na CVM em 30/05/2025 (IPE, protocolo "
     "024171IPE300520250179350617-50, \"Fechamento da Reorganização Societária\", p. 2): \"A documentação aplicável à "
     "Transação está disponível aos acionistas [...] no website da Companhia (ri.grupocarrefourbrasil.com.br)\". O arquivo "
     "vem do site institucional do mesmo domínio (grupocarrefourbrasil.com.br).",
     "Versão em branco, para fundo escuro. A página responde 403 à requisição direta e foi aberta pelo dono da plataforma no "
     "navegador dele em 24/11/2026; o arquivo do logo responde à requisição direta."),
    ("assai", "Assaí", "06.057.223/0001-71", "https://www.assai.com.br/sites/all/themes/assai_2024/logo.svg",
     "https://www.assai.com.br/", "escuro",
     "CNPJ 06.057.223/0001-71 (Sendas Distribuidora S.A., gold de empresas do Varejo). O rodapé da página de origem exibe "
     "\"Assaí Atacadista. Todos os direitos reservados Sendas Distribuidora S/A. CNPJ 06.057.223/0001-71\".",
     "Marca da bandeira Assaí Atacadista, pela qual a companhia se apresenta; o nome vem em branco, para fundo escuro."),
    ("rd-saude", "RD Saúde", "61.585.865/0001-51", "https://ri.rdsaude.com.br/assets/images/logo.png",
     "https://ri.rdsaude.com.br/", "claro",
     f"CNPJ 61.585.865/0001-51 (Raia Drogasil S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de "
     "RI ri@rdsaude.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.rdsaude.com.br, \"RD Saúde - Relações "
     "com Investidores\"; o texto alternativo do logo na página é \"RD | RaiaDrogasil S.A. | Gente Saúde e Bem-estar | "
     "Investidores\").",
     "Marca do grupo com as bandeiras Drogasil e Raia na linha de baixo. A requisição direta ao site recebe 403; a captura foi feita com navegador em 24/11/2026, a pedido do dono da plataforma, e o arquivo são os bytes originais da resposta."),
    ("magazine-luiza", "Magazine Luiza", "47.960.950/0001-21", "https://ri.magazineluiza.com.br/images/magalu-logo.svg",
     "https://ri.magazineluiza.com.br/", "escuro",
     f"CNPJ 47.960.950/0001-21 (Magazine Luiza S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail "
     "de RI ri@magazineluiza.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.magazineluiza.com.br, \"Magazine "
     "Luiza | Relações com Investidores\").",
     "Nome \"Magazine Luiza\" em branco, desenhado para o cabeçalho azul do site; aqui vai sobre a placa escura. A requisição direta ao site recebe 403; a captura foi feita com navegador em 24/11/2026, a pedido do dono da plataforma, e o arquivo são os bytes originais da resposta."),
    ("grupo-boticario", "Grupo Boticário", "11.137.051/0001-86", "https://www.grupoboticario.com.br/",
     "https://www.grupoboticario.com.br/", "claro",
     "Grupo de capital fechado, sem registro na CVM. A política de privacidade do mesmo site "
     "(www.grupoboticario.com.br/privacidade/politica-de-privacidade/, lida por requisição direta em 24/11/2026 e com o "
     "mesmo logo no cabeçalho) identifica o titular: \"BOTICARIO PRODUTOS DE BELEZA LTDA., sociedade empresária com sede "
     "na Avenida Doutor Dario Lopes Dos Santos, nº 2197, 4º andar, conj. 401, Cidade de Curitiba, Estado do Paraná, "
     "inscrita no CNPJ sob o nº 11.137.051/0001-86\".",
     "O cabeçalho da página traz o logo como um PNG de 803 x 178 px embutido em base64 num SVG escrito dentro do HTML "
     "(elemento header-logo-desktop-2025); não há arquivo de logo. O arquivo publicado são os bytes exatos desse PNG, "
     "extraídos sem alteração. A página de privacidade foi indicada pelo dono da plataforma."),
    ("grupo-mateus", "Grupo Mateus", "24.990.777/0001-09", f"{MZ}/themes/mziq_grupo_mateus/img/logo.png",
     "https://ri.grupomateus.com.br/", "claro",
     f"CNPJ 24.990.777/0001-09 (Grupo Mateus S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail "
     "de RI ri@grupomateus.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.grupomateus.com.br, \"Home - "
     "Grupo Mateus\").", None),
    ("casas-bahia", "Grupo Casas Bahia", "33.041.260/0652-90", f"{MZ}/themes/mziq_via_redesign2021/img/logoTop.png",
     "https://ri.grupocasasbahia.com.br/", "claro",
     "CNPJ 33.041.260/0652-90 (Grupo Casas Bahia S.A. - Em Recuperação Judicial, gold de empresas do Varejo). Fato relevante "
     "da companhia arquivado na CVM em 11/11/2026 (IPE, protocolo 006505IPE111120260156061613-95, \"Divulgação de Informações "
     "Financeiras Gerenciais Mensais - Agosto de 2026\", p. 1): \"O RMA está disponível para acesso no site de relações com "
     "investidores da Companhia por meio do seguinte link: "
     "https://ri.grupocasasbahia.com.br/informacoes-financeiras/recuperacao-judicial/\".",
     "Marca com fundo próprio (pílula vermelha e branca), muito larga: 1549 x 166 px. A página de RI responde 403 à "
     "requisição direta e foi aberta pelo dono da plataforma no navegador dele em 24/11/2026; o arquivo do logo responde à "
     "requisição direta."),
    ("natura", "Natura", "71.673.990/0001-77", f"{MZ}/themes/mziq_natura_2025_ri/public/img/logo-natura.svg",
     "https://ri.natura.com.br/", "claro",
     f"CNPJ 71.673.990/0001-77 (Natura Cosméticos S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o "
     "e-mail de RI ri@natura.net; o site de RI que publica o arquivo exibe o mesmo endereço em "
     "ri.natura.com.br/informacoes-aos-investidores/fale-com-ri/ (\"transparência e proximidade no relacionamento com o "
     "mercado. ri@natura.net\").",
     "O cabeçalho do site de RI publica o logo como um SVG que apenas envolve um PNG de 4000 x 886 px embutido em base64. O "
     "SVG é recusado pela regra; o arquivo publicado aqui são os bytes exatos desse PNG, extraídos sem alteração."),
    ("supermercados-bh", "Supermercados BH", None, "https://www.supermercadosbh.com.br/logo-supermercadosbh-header.svg",
     "https://www.supermercadosbh.com.br/", "claro",
     "Companhia de capital fechado, sem registro na CVM. A política de privacidade do próprio site "
     "(www.supermercadosbh.com.br/politicas/politica-de-privacidade) cita \"Supermercados BH Comércio de Alimentos S/A.\"; "
     "trecho transcrito pelo dono da plataforma em 24/11/2026 a partir do navegador dele, porque o site encerra a conexão "
     "deste script.",
     "O arquivo oficial do cabeçalho é um SVG de 73 x 39 e 2.263.138 bytes que só envolve um PNG de 1500 x 1500 px em "
     "base64; o SVG é recusado pela regra. O arquivo foi baixado pelo dono da plataforma no navegador dele em 24/11/2026 e "
     "anexado. O publicado é o PNG extraído, recortado na janela que o próprio SVG mostra e reduzido a 240 px de largura "
     "para caber no limite da pasta; o sha256 do PNG extraído está em derivado_de e o do SVG em extraido_de."),
    ("gpa", "GPA", "47.508.411/0001-56", f"{MZ}/uploads/sites/108/2022/11/gpa-logo.png", "https://www.gpari.com.br/", "escuro",
     f"CNPJ 47.508.411/0001-56 (Companhia Brasileira de Distribuição, gold de empresas do Varejo). O {CVM} registra para "
     "esse CNPJ o e-mail de RI gpa.ri@gpabr.com; o site institucional desse domínio (www.gpabr.com) aponta no menu "
     "\"Investidores\" para www.gpari.com.br, o site de RI (\"Home - GPA RI\") que publica o arquivo.",
     "Arquivo publicado só em branco, para fundo escuro."),
    ("super-muffato", "Grupo Muffato", "76.430.438/0124-20", "https://www.grupomuffato.com.br/images/grupo_muffato.png",
     "https://www.grupomuffato.com.br/", "claro",
     "Grupo de capital fechado, sem registro na CVM. O rodapé da página de origem exibe \"Irmãos Muffato & Cia Ltda - CNPJ: "
     "76.430.438/0124-20 - Avenida Tiradentes, nº2667\"; o CNPJ registrado aqui é o que a página exibe (um "
     "estabelecimento da empresa, não a matriz).",
     "Marca do grupo (\"Grupo Muffato\"), não a da bandeira Super Muffato."),
    ("lojas-renner", "Lojas Renner S.A.", "92.754.738/0001-62",
     "https://www.lojasrennersa.com.br/wp-content/themes/temarenner2025/img/logo-lojas-renner-sa.svg",
     "https://www.lojasrennersa.com.br/", "claro",
     "CNPJ 92.754.738/0001-62 (Lojas Renner S.A., gold de empresas do Varejo). O rodapé da página de origem exibe "
     "\"Copyright Lojas Renner S.A. © - Av. Joaquim Porto Villanova, 401 - B. Jardim do Salso - Porto Alegre/RS CEP: "
     "91410-400 CNPJ: 92.754.738/0001-62\".",
     "Marca da companhia com as bandeiras (Renner, Camicado, Youcom, Realize, Ashua) na linha de baixo."),
    ("amazon-brasil", "Amazon", None, "https://assets.aboutamazon.com/6d/e4/a8a7371f474d8137487d49b51b39/logo-1.svg",
     "https://www.aboutamazon.com.br/", "claro",
     "Grupo estrangeiro, sem CNPJ na página. O rodapé da página de origem, o site institucional da Amazon no Brasil, exibe "
     "\"© 1996-2023 Amazon.com, Inc. ou suas afiliadas\"; o cabeçalho da mesma página publica o arquivo, servido de "
     "assets.aboutamazon.com.",
     "Marca do grupo Amazon; a página não cita a razão social nem o CNPJ da operação brasileira."),
    ("havan", "Havan", "79.379.491/0008-50",
     "https://www.havan.com.br/static/version1794937847/frontend/Havan/themeDefault/pt_BR/images/svg/logo-havan-slim-sidebar.svg",
     "https://www.havan.com.br/", "claro",
     "Companhia de capital fechado, sem registro na CVM. O rodapé da página de origem exibe \"Havan Labs © 1986 - 2026 HAVAN "
     "S.A. CNPJ: 79.379.491.0008-50 | Rod. Antônio Heil\"; o CNPJ registrado aqui é o que a página exibe (um "
     "estabelecimento da empresa, não a matriz).",
     "Versão em azul, publicada no menu lateral da loja; o cabeçalho usa a mesma marca em branco."),
    ("dpsp", "Grupo DPSP", None, "https://www.grupodpsp.com.br/wp-content/themes/DPSP-novo-painel/assets/img/rnk-logo-dpsp.png",
     "https://www.grupodpsp.com.br/", "claro",
     "Vínculo fraco, aceito por decisão do dono da plataforma em 24/11/2026: grupo de capital fechado, sem registro na CVM, "
     "e o site do grupo não exibe razão social nem CNPJ (rodapé, /privacidade/ e /quem-somos/ vistos pelo dono no navegador "
     "dele; o rodapé da página inicial, lido também por requisição direta, só tem links). A prova é o domínio oficial do "
     "grupo, cuja página de origem se apresenta como \"Drogaria São Paulo e Pacheco | Grupo DPSP\" e publica o arquivo com o "
     "texto alternativo \"Logo DPSP\".",
     "Marca do grupo (\"Grupo DPSP\"), dono das Drogarias Pacheco e da Drogaria São Paulo. Arquivo de baixa resolução: 80 x 36 "
     "px, o único publicado no cabeçalho (sem versão maior nem SVG). O endereço www.dpsp.com.br tem certificado que não "
     "corresponde ao nome do site."),
    ("grupo-pereira", "Grupo Pereira", None, None, "https://www.grupopereira.com.br/", None,
     "O site do grupo (www.grupopereira.com.br) encerrou a conexão por requisição direta e com navegador, e não abriu em "
     "três tentativas no Chrome do dono da plataforma (24/11/2026). O site da marca Comper abriu para o dono, mas logo de "
     "bandeira não representa o grupo, e o rodapé traz CNPJ sem razão social. Nenhum arquivo oficial foi obtido.", None),
    ("americanas", "Americanas", "00.776.574/0001-56", f"{MZ}/themes/mziq_americanas_ri/public/img/logo.png",
     "https://ri.americanas.io/", "claro",
     f"CNPJ 00.776.574/0001-56 (Americanas S.A. - Em Recuperação Judicial, gold de empresas do Varejo). O {CVM} registra "
     "para esse CNPJ o e-mail de RI ri@americanas.io, do mesmo domínio do site de RI que publica o arquivo "
     "(ri.americanas.io), cujo rodapé exibe \"© 2026 — Americanas SA\".", None),
    ("pague-menos", "Pague Menos", "06.626.253/0001-51", f"{MZ}/themes/mziq_pague_menos_ri/img/logo22-07.png",
     "https://ri.paguemenos.com.br/", "escuro",
     f"CNPJ 06.626.253/0001-51 (Empreendimentos Pague Menos S.A., gold de empresas do Varejo). O {CVM} registra para esse "
     "CNPJ o e-mail de RI ri@pmenos.com.br; o site de RI que publica o arquivo exibe o mesmo endereço em "
     "ri.paguemenos.com.br/servicos-aos-investidores/fale-com-o-ri/ (\"Diretor Financeiro e de RI E-mail: "
     "ri@pmenos.com.br\").",
     "Arquivo com o nome em branco, para fundo escuro."),
    ("gazin", "Gazin", None, None, "https://www.gazin.com.br/", None,
     "Logo localizado no cabeçalho de www.gazin.com.br como SVG escrito dentro da página (o site responde 403 à requisição "
     "direta; a página abriu com navegador em 24/11/2026); aguardando o arquivo do dono da plataforma.",
     "Para a entrada futura (--importar gazin <arquivo> --fundo gazin <claro|escuro>): sha256 esperado "
     "df41eb761108b6d13b9e47b0489fbc90a56895278c7324854e690bf3d1aa85a3, 5.610 bytes, informado pelo dono. Prova de vínculo já "
     "lida no rodapé da página: \"Gazin Indústria e Comércio De Móveis e Eletrodomésticos LTDA - CNPJ: 77.941.490/0294-80\" "
     "(um estabelecimento da empresa, não a matriz)."),
    ("arcos-dorados", "Arcos Dorados", None, "https://www.arcosdorados.com/wp-content/themes/oxpitan/images/logo-mobile.png",
     "https://www.arcosdorados.com/", "claro",
     "Grupo estrangeiro, sem CNPJ na página. O site de origem identifica o titular: rodapé \"Copyright © 2025 - Arcos Dorados "
     "- All rights reserved\" e, na política de privacidade do mesmo site (www.arcosdorados.com/privacy-policy/, que usa o "
     "mesmo arquivo), \"Arcos Dorados S.A. [...] Roque Saenz Peña 432 Olivos (1636) Provincia de Buenos Aires\".",
     "Marca do grupo Arcos Dorados, operador do McDonald's na América Latina; a página não cita a subsidiária brasileira "
     "nem o CNPJ dela."),
    ("mercado-livre", "Mercado Livre", "03.007.331/0001-41",
     "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/7.53.2/mercadolibre/pt_logo_large_plus@2x.webp",
     "https://www.mercadolivre.com.br/", "claro",
     "Sem registro na CVM (a controladora MercadoLibre, Inc. é listada nos Estados Unidos). O rodapé da página de origem "
     "exibe \"Copyright © 1999-2026. Mercado Livre Brasil Ltda.\" e \"CNPJ n.º 03.007.331/0001-41 / Av. das Nações Unidas, nº "
     "3.003, Bonfim, Osasco/SP\"; o cabeçalho da mesma página (.nav-logo) usa o arquivo, servido de http2.mlstatic.com.",
     "Marca em português do cabeçalho da loja brasileira; o CNPJ é o da empresa brasileira que a página exibe."),
    ("cea", "C&A", "45.242.914/0001-05", f"{MZ}/uploads/sites/329/2020/11/Logo-Maior.png", "https://ri.cea.com.br/", "claro",
     f"CNPJ 45.242.914/0001-05 (C&A Modas S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de RI "
     "ri@cea.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.cea.com.br, \"Investidores C&A\").", None),
    ("guararapes", "Guararapes (Riachuelo)", "08.402.943/0001-52", f"{MZ}/themes/mziq_Riachuelo_Guararapes/img/logo2026.png",
     "https://ri.riachuelo.com.br/", "claro",
     "CNPJ 08.402.943/0001-52 (Guararapes Confecções S.A., gold de empresas do Varejo). Press-release de resultados do 3T26 "
     "arquivado pela companhia na CVM em 09/11/2026 (IPE, protocolo 004669IPE300920260191722202-56, p. 25): \"Para mais "
     "informações, entre em contato com o Time de RI da Riachuelo: ri@riachuelo.com.br https://ri.riachuelo.com.br/\".",
     "O arquivo oficial do cabeçalho é uma faixa de 8472 x 487 px com cinco marcas (Riachuelo, Guararapes, Midway, Casa "
     "Riachuelo e Carter's), ilegível numa placa de logo. O arquivo publicado é o recorte da marca \"guararapes\" dessa "
     "faixa (colunas 2105 a 3218, linhas 118 a 420), sem outra alteração; o sha256 da faixa está em derivado_de. A página "
     "de RI responde 403 à requisição direta e foi aberta pelo dono da plataforma no navegador dele em 24/11/2026."),
    ("azzas", "Azzas 2154", "16.590.234/0001-76", f"{MZ}/uploads/sites/1381/2024/07/Camada_1-3.png",
     "https://ri.azzas2154.com.br/", "escuro",
     f"CNPJ 16.590.234/0001-76 (Azzas 2154 S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de "
     "RI ri@azzas2154.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.azzas2154.com.br, \"Home - Azzas "
     "2154 RI\").",
     "Arquivo publicado só em branco, para fundo escuro."),
    ("grupo-sbf", "Grupo SBF", "13.217.485/0001-11", f"{MZ}/themes/mziq_Grupo_SBF_ri/img/logo-v3.png",
     "https://ri.gruposbf.com.br/", "escuro",
     f"CNPJ 13.217.485/0001-11 (Grupo SBF S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de RI "
     "ri@gruposbf.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.gruposbf.com.br, \"Home - Grupo SBF RI\").",
     "Marca do grupo, dono da Centauro; o verde-claro do arquivo foi desenhado para fundo escuro."),
    ("panvel", "Grupo Panvel", "92.665.611/0001-77", f"{MZ}/uploads/sites/1414/2024/09/Vector-5.png",
     "https://ri.grupopanvel.com.br/", "escuro",
     f"CNPJ 92.665.611/0001-77 (Dimed S.A. Distribuidora de Medicamentos, gold de empresas do Varejo). O {CVM} registra "
     "para esse CNPJ o e-mail relinvest@grupopanvel.com.br, do mesmo domínio do site de RI que publica o arquivo "
     "(ri.grupopanvel.com.br, rodapé \"© 2026 Grupo Panvel\").",
     "Arquivo publicado só em branco, para fundo escuro."),
    ("vivara", "Vivara", "33.839.910/0001-11", f"{MZ}/uploads/sites/1102/2023/01/g10.png", "https://ri.vivara.com.br/", "escuro",
     f"CNPJ 33.839.910/0001-11 (Vivara Participações S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o "
     "e-mail de RI ri@vivara.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.vivara.com.br).",
     "Arquivo publicado só em branco, para fundo escuro. A conexão do script com ri.vivara.com.br falha (certificado); a "
     "página foi aberta pelo dono da plataforma no navegador dele em 24/11/2026, e o arquivo do logo responde à requisição "
     "direta."),
    ("zamp", "Zamp", "13.574.594/0001-96", "https://ri.zamp.com.br/img/logo-zamp.png", "https://ri.zamp.com.br/", "claro",
     f"CNPJ 13.574.594/0001-96 (Zamp S.A., gold de empresas do Varejo). O {CVM} registra para esse CNPJ o e-mail de RI "
     "ri@zamp.com.br, do mesmo domínio do site de RI que publica o arquivo (ri.zamp.com.br, \"ZAMP | Relações com "
     "Investidores\").",
     "Marca da companhia, operadora do Burger King e do Popeyes no Brasil. A requisição direta ao site recebe 403; a captura foi feita com navegador em 24/11/2026, a pedido do dono da plataforma, e o arquivo são os bytes originais da resposta."),
    ("leroy-merlin", "Leroy Merlin", None, None, None, None,
     "Líder de segmento citado no ranking, sem ficha nem linha no comparador. Logo localizado pelo dono da plataforma no "
     "cabeçalho do site como SVG escrito dentro da página (24/11/2026); aguardando o arquivo dele. O site não está entre os "
     "hosts liberados para a coleta.",
     "Para a entrada futura (--importar leroy-merlin <arquivo> --fundo leroy-merlin <claro|escuro>): sha256 esperado "
     "5d3a4c6601841ee9cb5637b580592117dcfdf6ff18b1d7e917a91c86b97cebc2, 1.435 bytes, informado pelo dono; o código vem sem o "
     "atributo xmlns, que o importador acrescenta. Prova de vínculo transcrita pelo dono, não conferida por este script: "
     "\"A Leroy Merlin Cia. Brasileira de Bricolagem, inscrita no CNPJ nº 01.438.784/0001-05\"."),
]

CAMPOS = ("slug", "nome_exibicao", "papel", "cnpj", "vinculo", "vinculo_conferido_por", "nota", "arquivo", "formato", "fundo",
          "largura", "altura", "url_origem", "pagina_origem", "capturado_em", "sha256", "bytes", "metodo", "extraido_de",
          "derivado_de", "derivacao", "vinculo_reforco", "ausencia")
METODOS = ("direto", "navegador", "dono")

# Como os bytes chegaram, quando não foi pela requisição direta deste script. "navegador": o site recusa a requisição
# direta (403) e os bytes originais da resposta foram salvos numa visita com navegador. "dono": o dono da plataforma
# baixou o arquivo no navegador dele e o anexou (o site encerra a conexão do script). Nos dois casos o arquivo entra
# com --importar e, nas recapturas, a requisição direta falha e o arquivo publicado é mantido.
METODO = {"rd-saude": "navegador", "magazine-luiza": "navegador", "zamp": "navegador", "supermercados-bh": "dono",
          "gazin": "dono", "leroy-merlin": "dono"}

# Entidades cujo logo oficial é um PNG embutido em base64: publica-se o PNG extraído, nunca o SVG. None = o arquivo
# oficial é um SVG que só envolve o PNG; bytes = a origem é a página, e o PNG é o do elemento com essa marca.
EXTRAIDOS = {"natura": None, "supermercados-bh": None, "grupo-boticario": b'id="header-logo-desktop-2025"'}
PNG_EMBUTIDO = re.compile(rb"data:image/png;base64,([A-Za-z0-9+/=\s]+)")

# Derivações determinísticas com Pillow, registradas em `derivado_de` (sha256 dos bytes de partida) e `derivacao`.
# guararapes: o arquivo oficial é uma faixa de cinco marcas (Riachuelo, Guararapes, Midway, Casa Riachuelo, Carter's);
# a caixa é a da marca "guararapes", delimitada pelas colunas e linhas transparentes em volta dela.
# supermercados-bh: o PNG embutido tem 1500 x 1500 px e 1,7 MB; a caixa é a janela que o próprio SVG oficial mostra
# (transformação matrix(0.000666667 0 0 0.00123434 -0.00709566 -0.425758) sobre 73 x 39), reduzida a 240 px de largura (a 480 px o PNG passa de 60 KB).
DERIVADOS = {
    "guararapes": {"caixa": (2105, 118, 3218, 420), "largura_max": None},
    "supermercados-bh": {"caixa": (11, 345, 1500, 1155), "largura_max": 240},
}

# Prova de vínculo que o script não pôde reler porque o site não responde a ele: quem a conferiu.
CONFERIDO_POR = {"supermercados-bh": "dono", "dpsp": "dono", "leroy-merlin": "dono"}

# Segunda evidência de vínculo, sem trocar a prova principal: trechos lidos pelo dono da plataforma no navegador dele
# em 24/11/2026 (os sites respondem 403 à requisição direta ou não estão entre os hosts liberados).
REFORCO = {
    "carrefour-brasil": ("Lido pelo dono da plataforma no navegador dele em 24/11/2026: a política de privacidade linkada a partir "
                         "de grupocarrefourbrasil.com.br (www.carrefour.com.br/institucional/politicas-carrefour/"
                         "politica-de-privacidade-carrefour) cita \"CARREFOUR COMÉRCIO E INDÚSTRIA LTDA [...] inscrita no CNPJ sob "
                         "o nº. 45.543.915/0001-81\"."),
    "casas-bahia": ("Lido pelo dono da plataforma no navegador dele em 24/11/2026: a política de privacidade da loja "
                    "(www.casasbahia.com.br/l/politica-privacidade.aspx) cita \"o GRUPO CASAS BAHIA S.A., CNPJ/MF n.º "
                    "33.041.260/0652-90\"."),
    "guararapes": ("Lido pelo dono da plataforma no navegador dele em 24/11/2026: a política de privacidade do grupo "
                   "(privacidade.grupoguararapes.com.br/politicas-de-privacidade/) cita \"O Grupo Guararapes Confecções S.A, "
                   "composto pelas empresas Lojas Riachuelo S.A.\"."),
}

# Logos que são SVG escrito dentro da página (não há URL de arquivo): entram quando o dono anexar o código, com
# --importar <slug> <arquivo> --fundo <slug> <claro|escuro>. O sha256 esperado é o que ele informou; o tom do fundo só
# se decide abrindo a imagem, por isso é pedido na importação. Enquanto o arquivo não chega, vale a ausência da CURADORIA.
XMLNS = b' xmlns="http://www.w3.org/2000/svg"'
PENDENTES = {
    "gazin": {
        "sha256": "df41eb761108b6d13b9e47b0489fbc90a56895278c7324854e690bf3d1aa85a3", "bytes": 5610,
        "cnpj": "77.941.490/0294-80", "url": "https://www.gazin.com.br/", "pagina": "https://www.gazin.com.br/",
        "prova": ("Grupo de capital fechado, sem registro na CVM. O rodapé da página de origem, lido na visita com navegador de "
                  "24/11/2026, exibe \"Gazin Indústria e Comércio De Móveis e Eletrodomésticos LTDA - CNPJ: 77.941.490/0294-80\"; o "
                  "CNPJ registrado aqui é o que a página exibe (um estabelecimento da empresa, não a matriz)."),
        "nota": ("O logo do cabeçalho é um SVG escrito dentro da página, sem URL de arquivo; o código foi copiado pelo dono da "
                 "plataforma no navegador dele e anexado em 24/11/2026. O site responde 403 à requisição direta. É a versão da "
                 "loja virtual, com \"gazin.com.br\" e um cursor no desenho, sobre fundo próprio azul arroxeado; o cursor é "
                 "branco e some no claro, por isso a placa escura, como no cabeçalho do site."),
    },
    "leroy-merlin": {
        "sha256": "5d3a4c6601841ee9cb5637b580592117dcfdf6ff18b1d7e917a91c86b97cebc2", "bytes": 1435,
        "cnpj": "01.438.784/0001-05", "url": "https://www.leroymerlin.com.br/", "pagina": "https://www.leroymerlin.com.br/",
        "prova": ("Sem registro na CVM. Trecho transcrito pelo dono da plataforma a partir do navegador dele, porque o site não "
                  "está entre os hosts liberados para este script: \"A Leroy Merlin Cia. Brasileira de Bricolagem, inscrita no "
                  "CNPJ nº 01.438.784/0001-05\"."),
        "nota": ("O logo do cabeçalho é um SVG escrito dentro da página, sem URL de arquivo; o código foi copiado pelo dono da "
                 "plataforma no navegador dele e anexado. O código original não traz o atributo xmlns, sem o qual o arquivo "
                 "não abre como imagem; o importador acrescentou só esse atributo, e o sha256 do código original está em "
                 "derivado_de. As letras são brancas e ficam fora do triângulo verde, por isso a placa escura."),
    },
}


def derivar(corpo, caixa, largura_max):
    """PNG recortado na caixa e reduzido à largura máxima, com Pillow; devolve (bytes, descrição da derivação)."""
    import io

    import PIL
    from PIL import Image

    im = Image.open(io.BytesIO(corpo))
    if caixa:
        im = im.crop(caixa)
    if largura_max and im.width > largura_max:
        im = im.resize((largura_max, round(im.height * largura_max / im.width)), Image.LANCZOS)
    saida = io.BytesIO()
    im.save(saida, "PNG", optimize=True)
    return saida.getvalue(), {"operacao": "recorte" + (" e redução" if largura_max else ""), "caixa": list(caixa) if caixa else None,
                              "largura_max": largura_max, "ferramenta": f"Pillow {PIL.__version__}"}


def png_da_pagina(corpo, marca):
    """Os bytes do PNG em base64 do elemento da página que traz a marca; None quando a marca ou a imagem não estão lá."""
    i = corpo.find(marca)
    if i < 0 or corpo.count(marca) != 1:
        return None
    m = PNG_EMBUTIDO.search(corpo, i)
    if not m or m.start() - i > 400:
        return None
    png = base64.b64decode(m.group(1))
    return png if formato_de(png) == "png" else None


def baixar(url):
    """(bytes, None) quando a requisição direta responde; (None, motivo) quando falha."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
        with urllib.request.urlopen(req, timeout=60) as r:
            corpo = r.read()
    except Exception as e:
        return None, str(e)
    return corpo, None


def png_embutido(corpo):
    """Os bytes do único PNG em base64 de um SVG que só o envolve; None quando o SVG tem outra coisa além dele."""
    achados = PNG_EMBUTIDO.findall(corpo)
    if len(achados) != 1:
        return None
    sem_imagem = PNG_EMBUTIDO.sub(b"", corpo)
    if svg_com_conteudo_ativo(sem_imagem) or len(sem_imagem) > 2000:
        return None
    png = base64.b64decode(achados[0])
    return png if formato_de(png) == "png" else None

# Conteúdo embutido que a expressão do Setor Elétrico não cobre: imagem raster dentro do SVG e qualquer data:.
SVG_EMBUTIDO = re.compile(rb"<\s*image\b|data\s*:", re.I)


def svg_recusado(corpo):
    """True quando o SVG traz script, evento, conteúdo embutido, entidade ou referência externa."""
    return svg_com_conteudo_ativo(corpo) or bool(SVG_EMBUTIDO.search(corpo))


def formato_de(corpo):
    if corpo[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if corpo[:4] == b"RIFF" and corpo[8:12] == b"WEBP":
        return "webp"
    if b"<svg" in corpo[:2000]:
        return "svg"
    return None


def _dimensoes_webp(corpo):
    """Largura e altura lidas do cabeçalho WebP (formatos com perda, sem perda e estendido)."""
    bloco = corpo[12:16]
    if bloco == b"VP8X":
        return int.from_bytes(corpo[24:27], "little") + 1, int.from_bytes(corpo[27:30], "little") + 1
    if bloco == b"VP8L":
        bits = int.from_bytes(corpo[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if bloco == b"VP8 ":
        w, h = struct.unpack("<HH", corpo[26:30])
        return w & 0x3FFF, h & 0x3FFF
    return None, None


def dimensoes(corpo, formato):
    if formato == "png":
        return struct.unpack(">II", corpo[16:24])
    if formato == "webp":
        return _dimensoes_webp(corpo)
    m = re.search(rb'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', corpo[:2000])
    if m:
        return float(m.group(1)), float(m.group(2))
    w = re.search(rb'<svg[^>]*\swidth="([\d.]+)', corpo[:2000])
    h = re.search(rb'<svg[^>]*\sheight="([\d.]+)', corpo[:2000])
    return (float(w.group(1)) if w else None, float(h.group(1)) if h else None)


def slugs_da_colecao():
    """Slug -> papéis na coleção, lidos das três fontes que as páginas usam."""
    papeis = {}

    def soma(slug, papel):
        if slug:
            papeis.setdefault(slug, [])
            if papel not in papeis[slug]:
                papeis[slug].append(papel)

    curadoria = os.path.join(base.RAIZ, "pipeline", "varejo", "curadoria")
    with open(os.path.join(curadoria, "ranking.json"), encoding="utf-8") as f:
        ranking = json.load(f)
    for g in ranking.get("grupos", []):
        soma(g.get("slug"), "grupo do ranking")
    for g in ranking.get("lideres_por_segmento", []):
        soma(g.get("slug"), "líder de segmento")
    for caminho in sorted(glob.glob(os.path.join(curadoria, "fichas", "*.json"))):
        soma(os.path.basename(caminho)[:-5], "ficha")
    with open(os.path.join(base.RAIZ, "public", "varejo", "gold", "empresas.json"), encoding="utf-8") as f:
        for slug in json.load(f)["empresas"]:
            soma(slug, "companhia do comparador")
    return papeis


def conferir(manifesto=None):
    """Erros do manifesto contra os arquivos publicados e contra a coleção; lista vazia quando tudo confere."""
    if manifesto is None:
        with open(MANIFESTO, encoding="utf-8") as f:
            manifesto = json.load(f)
    erros = []
    logos = manifesto.get("logos", [])
    vistos = [x.get("slug") for x in logos]
    for slug in slugs_da_colecao():
        if slug not in vistos:
            erros.append(f"{slug}: entidade da coleção sem entrada no manifesto")
    for slug in set(vistos):
        if vistos.count(slug) > 1:
            erros.append(f"{slug}: entrada repetida")
    usados = set()
    for x in logos:
        s = x.get("slug")
        faltam = [c for c in CAMPOS if c not in x]
        if faltam:
            erros.append(f"{s}: campos ausentes {faltam}")
            continue
        if not x["arquivo"]:
            if not (x["ausencia"] and len(x["ausencia"].get("motivo", "")) > 20):
                erros.append(f"{s}: sem arquivo e sem motivo de ausência")
            if any(x[c] is not None for c in ("formato", "fundo", "largura", "altura", "sha256", "bytes", "metodo", "extraido_de",
                                              "derivado_de", "derivacao", "vinculo_conferido_por", "vinculo_reforco")):
                erros.append(f"{s}: ausência com dados de arquivo")
            continue
        if x["ausencia"] is not None:
            erros.append(f"{s}: arquivo e ausência ao mesmo tempo")
        if x["arquivo"] != f"{PREFIXO}{s}.{x['formato']}":
            erros.append(f"{s}: caminho fora do padrão ({x['arquivo']})")
            continue
        usados.add(os.path.basename(x["arquivo"]))
        caminho = os.path.join(DESTINO, os.path.basename(x["arquivo"]))
        if not os.path.exists(caminho):
            erros.append(f"{s}: arquivo não publicado")
            continue
        with open(caminho, "rb") as f:
            corpo = f.read()
        if hashlib.sha256(corpo).hexdigest() != x["sha256"]:
            erros.append(f"{s}: sha256 não confere")
        if len(corpo) != x["bytes"]:
            erros.append(f"{s}: tamanho não confere")
        if len(corpo) > LIMITE_BYTES:
            erros.append(f"{s}: arquivo acima de {LIMITE_BYTES} bytes")
        fmt = formato_de(corpo)
        if fmt != x["formato"]:
            erros.append(f"{s}: formato declarado {x['formato']}, conteúdo {fmt}")
            continue
        if fmt == "svg" and svg_recusado(corpo):
            erros.append(f"{s}: SVG com conteúdo ativo, embutido ou externo")
        w, h = dimensoes(corpo, fmt)
        if (w, h) != (x["largura"], x["altura"]) or not w or not h:
            erros.append(f"{s}: dimensões não conferem ({w} x {h})")
        if x["metodo"] not in METODOS:
            erros.append(f"{s}: método de captura inválido")
        ext = x["extraido_de"]
        if ext and not (str(ext.get("url", "")).startswith("https://") and x["formato"] == "png"
                        and (re.fullmatch(r"[0-9a-f]{64}", str(ext.get("sha256", ""))) or ext.get("elemento"))):
            erros.append(f"{s}: extração sem a origem e o sha256 (ou o elemento) de onde a imagem saiu")
        if bool(x["derivado_de"]) != bool(x["derivacao"]) or (x["derivado_de"] and not re.fullmatch(r"[0-9a-f]{64}", x["derivado_de"])):
            erros.append(f"{s}: derivação sem o sha256 do original ou sem a descrição do recorte")
        if x["derivado_de"] == x["sha256"]:
            erros.append(f"{s}: derivado igual ao original")
        if x["derivacao"] and not x["derivacao"].get("operacao"):
            erros.append(f"{s}: derivação sem dizer a operação")
        if x["vinculo_conferido_por"] not in (None, "dono"):
            erros.append(f"{s}: conferência de vínculo inválida")
        if x["fundo"] not in ("claro", "escuro"):
            erros.append(f"{s}: fundo inválido")
        if len(x["vinculo"] or "") < 40:
            erros.append(f"{s}: logo sem prova de vínculo")
        if not str(x["url_origem"] or "").startswith("https://") or not str(x["pagina_origem"] or "").startswith("https://"):
            erros.append(f"{s}: origem sem https")
        if not x["capturado_em"]:
            erros.append(f"{s}: sem data de captura")
    for nome in sorted(os.listdir(DESTINO)):
        if nome != "manifesto.json" and nome not in usados:
            erros.append(f"{nome}: arquivo na pasta sem entrada no manifesto")
    return erros


def main(importados=None, fundos=None):
    """Recaptura tudo. `importados` = {slug: bytes} de arquivos trazidos por navegador ou pelo dono (--importar);
    `fundos` = {slug: "claro" | "escuro"} para os pendentes, decidido abrindo a imagem (--fundo)."""
    importados, fundos = importados or {}, fundos or {}
    for slug, corpo in importados.items():  # arquivo anexado tem de ser o que o dono descreveu
        esperado = PENDENTES.get(slug)
        if esperado and (hashlib.sha256(corpo).hexdigest() != esperado["sha256"] or len(corpo) != esperado["bytes"]):
            raise SystemExit(f"{slug}: o arquivo importado não confere com o sha256 e o tamanho esperados; nada foi alterado")
        if esperado and fundos.get(slug) not in ("claro", "escuro"):
            raise SystemExit(f"{slug}: abra a imagem e informe o tom com --fundo {slug} claro|escuro; nada foi alterado")
    os.makedirs(DESTINO, exist_ok=True)
    papeis = slugs_da_colecao()
    anterior = {}
    if os.path.exists(MANIFESTO):
        with open(MANIFESTO, encoding="utf-8") as f:
            anterior = {x.get("slug"): x for x in json.load(f).get("logos", [])}
    logos = []
    for slug, nome, cnpj, url, pagina, fundo, prova, nota in CURADORIA:
        item = dict.fromkeys(CAMPOS)
        item.update({"slug": slug, "nome_exibicao": nome, "papel": ", ".join(papeis.get(slug, ["fora da coleção"])), "cnpj": cnpj,
                     "nota": nota, "pagina_origem": pagina})
        ant = anterior.get(slug) or {}
        pend = PENDENTES.get(slug)
        if pend and (slug in importados or ant.get("sha256")):  # o arquivo chegou (agora ou numa rodada anterior)
            cnpj, url, pagina, prova, nota = pend["cnpj"], pend["url"], pend["pagina"], pend["prova"], pend["nota"]
            fundo = fundos.get(slug) or ant.get("fundo")
            item.update({"cnpj": cnpj, "nota": nota, "pagina_origem": pagina})
        item["vinculo_reforco"] = REFORCO.get(slug)
        tem_anterior = bool(ant.get("sha256")) and ant.get("url_origem") == url

        def ausente(motivo):
            item.update({"vinculo": None, "ausencia": {"motivo": motivo}})
            logos.append(item)

        if url is None:
            ausente(prova)
            continue
        item.update({"vinculo": prova, "url_origem": url})
        item["metodo"] = METODO.get(slug, "direto")
        item["vinculo_conferido_por"] = CONFERIDO_POR.get(slug)
        corpo, falha = (importados[slug], None) if slug in importados else baixar(url)
        marca = EXTRAIDOS.get(slug)
        if corpo is not None and formato_de(corpo) is None and not marca:
            corpo, falha = None, "a resposta não é PNG, WebP nem SVG"
        if corpo is None and tem_anterior:
            # mantém o arquivo anterior da mesma origem; os campos de curadoria (nome, vínculo, nota, fundo, método) seguem os atuais
            mantido = {c: ant.get(c) for c in CAMPOS}
            mantido.update({c: item[c] for c in ("slug", "nome_exibicao", "papel", "cnpj", "vinculo", "vinculo_conferido_por", "nota",
                                                 "pagina_origem", "metodo", "vinculo_reforco")})
            mantido["fundo"] = fundo
            if mantido.get("derivacao") and not mantido["derivacao"].get("operacao") and slug in DERIVADOS:
                mantido["derivacao"] = {"operacao": "recorte" + (" e redução" if DERIVADOS[slug]["largura_max"] else ""), **mantido["derivacao"]}
            logos.append(mantido)
            continue

        def recusado(motivo):
            item.update({"metodo": None, "extraido_de": None, "derivado_de": None, "derivacao": None, "vinculo_conferido_por": None,
                         "vinculo_reforco": None})
            ausente(motivo)

        if corpo is None:
            recusado(f"Falha ao baixar o arquivo oficial de {url}: {falha}"[:300])
            continue
        fmt = formato_de(corpo)
        if slug in EXTRAIDOS:
            png = png_da_pagina(corpo, marca) if marca else (png_embutido(corpo) if fmt == "svg" else None)
            if png is None:
                recusado(f"A origem oficial ({url}) deixou de trazer o PNG embutido que era extraído; a extração não se aplica.")
                continue
            item["extraido_de"] = ({"url": url, "elemento": marca.decode()} if marca
                                   else {"url": url, "sha256": hashlib.sha256(corpo).hexdigest(), "bytes": len(corpo)})
            corpo, fmt = png, "png"
        if fmt == "svg" and pend and b"xmlns=" not in corpo[:corpo.find(b">")]:
            # SVG copiado de dentro da página: sem xmlns não abre como imagem; só esse atributo é acrescentado
            item["derivado_de"] = hashlib.sha256(corpo).hexdigest()
            k = corpo.find(b"<svg") + 4
            corpo = corpo[:k] + XMLNS + corpo[k:]
            item["derivacao"] = {"operacao": "atributo xmlns acrescentado à tag svg", "caixa": None, "largura_max": None,
                                 "ferramenta": "pipeline/varejo/logos.py"}
        if fmt == "svg" and svg_recusado(corpo):
            recusado(f"O SVG oficial ({url}) traz script, evento, conteúdo embutido ou referência externa e não é publicado.")
            continue
        if slug in DERIVADOS:
            if fmt != "png":
                recusado(f"O arquivo oficial ({url}) deixou de ser PNG; a derivação registrada não se aplica.")
                continue
            item["derivado_de"] = hashlib.sha256(corpo).hexdigest()
            corpo, item["derivacao"] = derivar(corpo, **DERIVADOS[slug])
        if len(corpo) > LIMITE_BYTES:
            recusado(f"O arquivo oficial ({url}) tem {len(corpo)} bytes, acima do limite de {LIMITE_BYTES} da pasta de logos.")
            continue
        sha = hashlib.sha256(corpo).hexdigest()
        nome_arq = f"{slug}.{fmt}"
        with open(os.path.join(DESTINO, nome_arq), "wb") as f:
            f.write(corpo)
        w, h = dimensoes(corpo, fmt)
        item.update({"arquivo": PREFIXO + nome_arq, "formato": fmt, "fundo": fundo, "largura": w, "altura": h,
                     "capturado_em": ant["capturado_em"] if ant.get("sha256") == sha else base.agora_utc(),
                     "sha256": sha, "bytes": len(corpo)})
        logos.append(item)
    for slug in papeis:  # entidade nova na coleção nunca fica sem entrada
        if slug not in {x["slug"] for x in logos}:
            item = dict.fromkeys(CAMPOS)
            item.update({"slug": slug, "nome_exibicao": slug, "papel": ", ".join(papeis[slug]),
                         "ausencia": {"motivo": "Entidade ainda sem curadoria de logo (pipeline/varejo/logos.py)."}})
            logos.append(item)
    logos.sort(key=lambda x: x["slug"])
    publicados = {os.path.basename(x["arquivo"]) for x in logos if x["arquivo"]}
    for nome in os.listdir(DESTINO):  # arquivo de uma captura anterior que deixou de ter entrada
        if nome != "manifesto.json" and nome not in publicados:
            os.remove(os.path.join(DESTINO, nome))
    man = {
        "versao": 5,
        "gerado_em": base.agora_utc(),
        "regras": ("Arquivo oficial publicado pela própria companhia (site de RI ou institucional), baixado e servido localmente, sem "
                   "alteração. 'vinculo' é a prova de que o site de origem é o da entidade: CNPJ ou razão social exibidos na própria "
                   "página, ou o e-mail de RI que o cadastro de companhias abertas da CVM registra para o CNPJ, do mesmo domínio do "
                   "site; nunca semelhança de nome. 'fundo' indica o fundo para o qual o arquivo foi desenhado; a interface usa uma "
                   "placa desse tom. SVG com script, evento, conteúdo embutido, entidade ou referência externa é recusado; "
                   "'extraido_de' marca o PNG que a companhia publica embutido num SVG ou na página e que foi extraído sem "
                   "alteração; 'derivado_de' e 'derivacao' marcam o recorte ou a redução de um arquivo oficial; 'metodo' diz como os "
                   "bytes chegaram (requisição direta, navegador ou arquivo anexado pelo dono da plataforma). Ausência "
                   "registrada com motivo; nesse caso a interface mostra o nome em texto."),
        "logos": logos,
    }
    with open(MANIFESTO, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write("\n")
    for x in logos:
        print(x["slug"], x["arquivo"] or "AUSENTE", x["fundo"] or "", (x["ausencia"] or {}).get("motivo", "")[:70])
    erros = conferir(man)
    for e in erros:
        print("ERRO", e, file=sys.stderr)
    return 1 if erros else 0


if __name__ == "__main__":
    if "--conferir" in sys.argv[1:]:
        problemas = conferir()
        for p in problemas:
            print("ERRO", p, file=sys.stderr)
        print("manifesto de logos do Varejo:", "confere" if not problemas else f"{len(problemas)} problema(s)")
        sys.exit(1 if problemas else 0)
    trazidos, tons = {}, {}
    args = sys.argv[1:]
    while "--fundo" in args:  # --fundo <slug> <claro|escuro>: tom decidido abrindo a imagem de um pendente
        k = args.index("--fundo")
        tons[args[k + 1]] = args[k + 2]
        del args[k:k + 3]
    while "--importar" in args:  # --importar <slug> <arquivo>: bytes trazidos por navegador ou pelo dono
        k = args.index("--importar")
        with open(args[k + 2], "rb") as f:
            trazidos[args[k + 1]] = f.read()
        del args[k:k + 3]
    sys.exit(main(trazidos, tons))
