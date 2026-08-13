"""Mapa de linhagem gerado DO CÓDIGO — nunca mantido à mão (P1 da auditoria de 12/08).

A promessa de "linhagem" só vale se cobrir tudo: este módulo faz análise
estática do próprio repositório a cada execução e emite, para CADA objeto
gold publicado, quem o produz, de onde vêm os dados e quem o consome:

- produtor: o módulo que chama ``write_gold``/``write_gold_text`` com o nome;
- fontes: hosts de URLs literais no módulo produtor e nos coletores de bronze
  que ele lê (``save_bronze(<fonte>)`` casa leitura com coletor); mais o
  "armazém de séries" quando o módulo lê ``get_series`` e os arquivos de
  curadoria (``pipeline/curated/*``) que ele abre;
- dependências gold→gold: chamadas a ``ler_gold_opcional``;
- consumo: as vistas da SPA que pedem o arquivo (VIEW_DATA, OV_BLOCO_DATA,
  CORE_FILES e ``fetchGold`` literais em ``public/obs/app.js``).

Limite declarado: a análise cobre chamadas com nome literal (é o padrão do
repositório) e dois padrões dinâmicos resolvidos por regra, não por mapa
manual: templates f-string viram expressões casadas contra o inventário
publicado (``f"{nome}_mun.json"`` cobre ``penetracao_mun.json`` etc.;
``cmp/{cod}.json`` vira a família ``cmp/*``), e o módulo que republica a
pasta de curadoria integralmente (``os.listdir`` + ``write_gold(fname``)
herda cada ``pipeline/curated/*.json`` como objeto próprio. O que sobrar
cai no relatório de não mapeados — que o teste trava em zero.
"""
import os
import re

from pipeline import common


def _ler(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _modulos_pipeline():
    saida = []
    pdir = os.path.join(common.ROOT, "pipeline")
    for base, dirs, files in os.walk(pdir):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in sorted(files):
            if f.endswith(".py"):
                path = os.path.join(base, f)
                saida.append((os.path.relpath(path, common.ROOT), _ler(path)))
    return saida


def _template_para_regex(tpl):
    """f-string de write_gold -> regex do nome publicado: {x} vira [a-z0-9_]+."""
    partes = re.split(r"\{[^}]+\}", tpl)
    return re.compile("^" + "[a-zA-Z0-9_]+".join(re.escape(p) for p in partes) + "$")


_RE_WRITE_LIT = re.compile(r'write_gold(?:_text)?\(\s*"([^"{}]+)"')
_RE_WRITE_TPL = re.compile(r'write_gold(?:_text)?\(\s*f"([^"]*\{[^"]*)"')
_RE_HOST = re.compile(r'https?://([a-zA-Z0-9.\-]+)')
_RE_DEP = re.compile(r'ler_gold_opcional\(\s*f?"([^"]+)"')
_RE_CUR = re.compile(r'curated[/\\"\', ]+([a-z0-9_]+\.(?:json|csv))')
_RE_BRONZE = re.compile(r'(?:latest_bronze|bronze_dir|BRONZE\s*,)\s*\(?\s*"([a-z0-9_]+)"')
_RE_SAVE_BRONZE = re.compile(r'save_bronze\(\s*"([a-z0-9_]+)"')
# republicação integral da curadoria: listdir sobre curated + write com variável
_RE_REPUBLICA_CUR = re.compile(r'listdir\(curated_dir\)')


def _consumo_spa(app_js):
    """view -> [gold] a partir dos blocos declarativos da SPA."""
    consumo = {}

    def registra(gold, view):
        consumo.setdefault(gold, set()).add(view)

    m = re.search(r'const VIEW_DATA = \{(.*?)\n\};', app_js, re.S)
    if m:
        for view, lista in re.findall(r'(\w+):\s*\[([^\]]*)\]', m.group(1)):
            for g in re.findall(r'"([^"]+)"', lista):
                registra(g + ".json", view)
    m = re.search(r'const OV_BLOCO_DATA = \{(.*?)\n\};', app_js, re.S)
    if m:
        for _, lista in re.findall(r'(\w+):\s*\[([^\]]*)\]', m.group(1)):
            for g in re.findall(r'"([^"]+)"', lista):
                registra(g + ".json", "overview")
    m = re.search(r'const CORE_FILES = \[([^\]]*)\]', app_js)
    if m:
        for g in re.findall(r'"([^"]+)"', m.group(1)):
            registra(g + ".json", "núcleo (todas as páginas)")
    for g in re.findall(r'fetchGold\("([^"]+)"\)', app_js):
        consumo.setdefault(g + ".json", set()).add("carga direta")
    # fetches diretos fora do fetchGold: nomes fixos e famílias por URL construída
    for g in re.findall(r'DATA_BASE\}([a-z0-9_]+\.json)', app_js):
        consumo.setdefault(g, set()).add("carga direta")
    for fam in re.findall(r'DATA_BASE\}([a-z0-9_]+)/\$\{', app_js):
        consumo.setdefault(f"{fam}/*", set()).add("carga por item")
    # publicações para fora da SPA (feeds e kit de imprensa) — consumo declarado
    consumo.setdefault("alerts.xml", set()).add("feed RSS (leitores externos)")
    consumo.setdefault("alertas.xml", set()).add("feed RSS (leitores externos)")
    consumo.setdefault("report.html", set()).add("kit de imprensa (página estática)")
    return consumo


def build():
    modulos = _modulos_pipeline()
    hosts_por_fonte_bronze = {}
    for mod, src in modulos:
        for fonte in _RE_SAVE_BRONZE.findall(src):
            hosts_por_fonte_bronze.setdefault(fonte, set()).update(_RE_HOST.findall(src))

    # inventário real primeiro: os templates dinâmicos resolvem contra ele
    gold_dir = common.GOLD
    publicados = []
    if os.path.isdir(gold_dir):
        for f in sorted(os.listdir(gold_dir)):
            path = os.path.join(gold_dir, f)
            if os.path.isfile(path) and not f.endswith((".meta.json",)):
                publicados.append(f)
            elif os.path.isdir(path):
                publicados.append(f + "/*")
    curated_dir = os.path.join(common.ROOT, "pipeline", "curated")
    curated_publicaveis = sorted(f for f in os.listdir(curated_dir)
                                 if f.endswith(".json")) if os.path.isdir(curated_dir) else []

    objetos = {}
    usos_curadoria = []  # (curado.json, golds do módulo que o lê) p/ inverter em consumo

    def registra_gold(g, mod, fontes, deps, nota=None):
        o = objetos.setdefault(g, {"gold": g, "produtores": set(), "fontes": set(),
                                   "depende_de": set(), "consumido_em": set(), "notas": set()})
        o["produtores"].add(mod)
        o["fontes"].update(fontes)
        o["depende_de"].update(d for d in deps if d != g)
        if nota:
            o["notas"].add(nota)

    for mod, src in modulos:
        if mod.endswith("lineage_map.py"):
            continue  # o analisador não é produtor — os padrões vivem no próprio texto dele
        literais = set(_RE_WRITE_LIT.findall(src))
        templates = set(_RE_WRITE_TPL.findall(src))
        republica_curadoria = bool(_RE_REPUBLICA_CUR.search(src)) and "write_gold(fname" in src
        if not literais and not templates and not republica_curadoria:
            continue
        hosts = set(_RE_HOST.findall(src))
        deps = set(_RE_DEP.findall(src))
        curados = set(_RE_CUR.findall(src))
        fontes_bronze = set(_RE_BRONZE.findall(src))
        for fb in fontes_bronze:
            hosts.update(hosts_por_fonte_bronze.get(fb, set()))
        fontes = sorted(hosts)
        if "get_series(" in src:
            fontes.append("armazém de séries (SGS e coletores da Fase 1)")
        elif "con.execute(" in src or "get_db()" in src:
            fontes.append("armazém estruturado (silver/SQLite das coletas)")
        fontes += [f"bronze:{fb}" for fb in sorted(fontes_bronze)]
        fontes += [f"curadoria:{c}" for c in sorted(curados)]
        if curados and literais:
            usos_curadoria.extend((c, sorted(literais)) for c in curados)
        for g in literais:
            registra_gold(g, mod, fontes, deps)
        for tpl in templates:
            if "/" in tpl:  # subdiretório -> família (cmp/{cod}.json -> cmp/*)
                registra_gold(tpl.split("/")[0] + "/*", mod, fontes, deps,
                              nota=f"família gerada pelo template {tpl}")
                continue
            # template sem âncora literal além da extensão ({nome}.json) casaria
            # com o inventário inteiro — exige pelo menos um trecho distintivo
            ancoras = [p for p in re.split(r"\{[^}]+\}", tpl) if p and p != ".json"]
            if not ancoras:
                continue
            rx = _template_para_regex(tpl)
            casados = [p for p in publicados if rx.match(p)]
            for g in casados:
                registra_gold(g, mod, fontes, deps, nota=f"resolvido do template {tpl}")
        if republica_curadoria:
            for fname in curated_publicaveis:
                registra_gold(fname, mod, [f"curadoria:{fname} (republicado integralmente)"], set(),
                              nota="cópia verbatim de pipeline/curated/ — a curadoria é a fonte de verdade")

    app_js = _ler(os.path.join(common.ROOT, "public", "obs", "app.js"))
    for g, views in _consumo_spa(app_js).items():
        if g in objetos:
            objetos[g]["consumido_em"].update(views)
        else:
            # SPA pede algo que nenhum módulo escreve — aparece para o teste travar
            objetos[g] = {"gold": g, "produtores": set(), "fontes": set(),
                          "depende_de": set(), "consumido_em": set(views), "notas": set()}

    # consumo interno: quem depende de um gold é consumidor dele (inversão),
    # e curadoria lida por um módulo é insumo dos golds daquele módulo
    for g, o in list(objetos.items()):
        for dep in o["depende_de"]:
            if dep in objetos:
                objetos[dep]["consumido_em"].add(f"pipeline (insumo de {g})")
    for curado, golds_leitores in usos_curadoria:
        if curado in objetos:
            for g in golds_leitores:
                if g != curado:
                    objetos[curado]["consumido_em"].add(f"pipeline (insumo de {g})")
    # curado republicado sem outro leitor: o consumo é a própria auditoria pública
    for o in objetos.values():
        if not o["consumido_em"] and any("cópia verbatim" in n for n in o["notas"]):
            o["consumido_em"].add("publicação de auditoria (cópia da curadoria)")

    sem_produtor = [g for g in publicados
                    if g not in objetos or not objetos[g]["produtores"]]

    # produtor sem fonte detectável recebe dados prontos do orquestrador
    # (ex.: report.py monta o HTML a partir do ctx de golds injetado por gold.py)
    for o in objetos.values():
        if o["produtores"] and not o["fontes"]:
            o["fontes"].add("composição de golds da mesma execução (injetados pelo orquestrador)")

    linhas = []
    for g in sorted(objetos):
        o = objetos[g]
        linhas.append({
            "gold": g,
            "produtores": sorted(o["produtores"]),
            "fontes": sorted(o["fontes"]),
            "depende_de": sorted(o["depende_de"]),
            "consumido_em": sorted(o["consumido_em"]),
            "notas": sorted(o["notas"]),
        })
    return {
        "gerado_de": "análise estática do repositório a cada execução (pipeline/lineage_map.py) — nunca mantido à mão",
        "metodo": ("produtor = quem chama write_gold com o nome; fontes = hosts literais do módulo e dos coletores "
                   "de bronze que ele lê, mais armazém de séries e curadoria; dependências = ler_gold_opcional; "
                   "consumo = VIEW_DATA/OV_BLOCO_DATA/CORE_FILES/fetchGold da SPA. Nomes dinâmicos viram famílias (*)."),
        "resumo": {
            "objetos_mapeados": len(linhas),
            "publicados_no_gold": len(publicados),
            "publicados_sem_produtor_mapeado": sem_produtor,
        },
        "objetos": linhas,
    }
