"""EPE, WebMap (serviço ArcGIS WMS_Webmap_EPE_Data): subsistema de cada UF e localidades
isoladas, para o índice territorial.

Por que existe: o mapa territorial precisa dizer a que subsistema do SIN pertence cada UF.
A EPE publica essa correspondência como camada oficial do seu WebMap ("Unidades da
federação e Subsistemas do Sistema Interligado Nacional", camada 24, direitos EPE, ONS e
IBGE, criada em 11/09/2020): 27 feições de polígono, uma por UF, com o campo `subsistee`
(SE-CO, S, NE, N). É a fonte oficial do mapeamento UF → subsistema; a soma da carga
verificada por área de carga do ONS (fontes/ons_territorio.py) é a reconciliação
independente, área por área.

A camada 27 ("Isolated Systems") traz as localidades atendidas por sistema isolado como
pontos (distribuidora, localidade, UF, município, coordenada, demanda e carga), sem a
população. Ela serve para conferir, por outro caminho, a lista do PASI que o módulo
Inclusão integra (com a população declarada pela EPE): mesmas localidades nos mesmos
municípios.

Duas peculiaridades da camada 24, como publicada em 01/10/2026: a Bahia vem com a sigla
"BH" (o nome é "BAHIA") e o Distrito Federal com o nome "DF". A ligação à UF do IBGE usa a
sigla quando ela é uma sigla do IBGE e, senão, o nome normalizado; nada é aproximado.
"""
import json

from pipeline.energia.fontes import ibge_territorio as it

SERVICO = "https://gisepeprd2.epe.gov.br/arcgis/rest/services/WMS_Webmap_EPE_Data/MapServer"
URL_WEBMAP = "https://gisepeprd2.epe.gov.br/WebMapEPE/"
CAMADA_SUBSISTEMAS = 24
CAMADA_ISOLADOS = 27
URL_SUBSISTEMAS = f"{SERVICO}/{CAMADA_SUBSISTEMAS}/query?where=1%3D1&outFields=*&returnGeometry=false&f=json"
URL_ISOLADOS = f"{SERVICO}/{CAMADA_ISOLADOS}/query?where=1%3D1&outFields=*&returnGeometry=false&f=json"
URL_META_SUBSISTEMAS = f"{SERVICO}/{CAMADA_SUBSISTEMAS}?f=json"
LICENCA_EPE = "Dados públicos da EPE (WebMap EPE), uso com citação da fonte; direitos da camada: EPE, ONS e IBGE"

# Código do subsistema na camada da EPE → código usado no observatório
SUBSISTEMA_EPE = {"SE-CO": "SE", "S": "S", "NE": "NE", "N": "N"}


def _feicoes(texto):
    dados = json.loads(texto)
    if not isinstance(dados, dict) or "features" not in dados:
        raise ValueError(f"resposta do ArcGIS sem feições: {str(dados)[:200]}")
    return [f.get("attributes") or {} for f in dados["features"]]


def subsistemas_por_uf(texto, nomes_uf):
    """{UF: subsistema} da camada 24. `nomes_uf` = {sigla IBGE: nome IBGE da UF}. Linha cuja
    sigla não é do IBGE é ligada pelo nome normalizado; a que não casar por nenhum dos dois
    volta em `sem_uf` (nunca por semelhança). Subsistema fora de SE-CO, S, NE e N também."""
    por_nome = {it.normaliza(n): uf for uf, n in nomes_uf.items() if n}
    out, sem_uf, ligacoes = {}, [], []
    for a in _feicoes(texto):
        sigla = (a.get("UF") or "").strip().upper()
        nome = (a.get("Nome") or "").strip()
        sub = SUBSISTEMA_EPE.get((a.get("subsistee") or "").strip())
        uf = sigla if sigla in nomes_uf else por_nome.get(it.normaliza(nome))
        if uf is None or sub is None:
            sem_uf.append({"UF": a.get("UF"), "Nome": nome, "subsistee": a.get("subsistee")})
            continue
        if uf != sigla:
            ligacoes.append({"UF_fonte": a.get("UF"), "Nome_fonte": nome, "uf": uf, "via": "nome"})
        if uf in out and out[uf] != sub:
            raise ValueError(f"UF {uf} com dois subsistemas na camada da EPE: {out[uf]} e {sub}")
        out[uf] = sub
    return {"mapeamento": out, "sem_uf": sem_uf, "ligacoes_pelo_nome": ligacoes}


def localidades_isoladas(texto):
    """[(uf, município, localidade)] da camada 27, como a EPE escreve."""
    out = []
    for a in _feicoes(texto):
        out.append(((a.get("uf") or "").strip().upper(), (a.get("municipio") or "").strip(),
                    (a.get("localidade") or "").strip()))
    return out
