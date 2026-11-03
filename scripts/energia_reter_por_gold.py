"""Publicação por gold do Setor Elétrico depois dos testes de conteúdo (decisão do dono de 03/11/2026).

Até 03/11/2026 qualquer teste reprovado retinha as 26 golds: a publicação ficou retida 34 dias seguidos (issue
297). Agora cada arquivo de teste tem uma classe em pipeline/energia/testes_golds.json:

- "dado": reprovado, retém só as golds que lê (mais as dependentes e as derivadas delas); a asserção que cita
  uma rota ou uma gold no nome restringe a retenção a elas;
- "interface": reprovado, não retém nada; a lista vai para a issue, para corrigir o código;
- "tudo": reprovado, retém a publicação inteira (envelope, manifesto, retenção).

Arquivo de teste que leia a gold de energia e não esteja no mapa retém tudo. Falha de build, da suíte Python ou
processo do vitest abortado também retêm tudo, como antes.

Uso (na raiz do repositório, depois do vitest):
    python3 scripts/energia_reter_por_gold.py vitest-resultado.json testes-codigos.txt [--log-python pipeline-testes.log] [--aplicar] [--saida pasta]

Sem --aplicar, só decide e escreve o relatório. Com --aplicar, devolve as golds retidas à versão publicada
(HEAD do git): a gold, os arquivos que ela publica, as séries da operação, a entrada dela em meta.golds e em
arquivos.json; depois reconstrói a síntese e a publicação (módulos visao e dados) sobre a publicação recomposta.
--rodada 1: a publicação recomposta reprovou de novo; a retenção cresce para todas as golds dos testes de dado
reprovados e a recomposição se repete. Saída 0: publicação (inteira ou parcial); 2: tudo retido.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

MAPA = RAIZ / "pipeline/energia/testes_golds.json"
GOLD = "public/energia/gold"
CONTROLE = {"meta.json", "manifesto.json", "arquivos.json", "metricas.json", "catalogo.json", "avaliacao.json"}
# Gold reconstruída sobre a publicação recomposta (recompor), nunca retida: a síntese (Visão geral e inicial). Golds
# derivadas que também leem o silver (Listadas, Leilões) ficam com a origem (DEPENDENCIAS).
RECONSTRUIDAS = {"sintese.json"}
# Teste que lê a gold de energia (mesma regra do mapa): cita a pasta da gold, a biblioteca ou as páginas do módulo.
LE_ENERGIA = re.compile(r"energia/gold|lib/energia|/setor-eletrico")


def arquivos_de_teste_energia(raiz=RAIZ):
    """Arquivos de src/tests que leem a gold de energia (nome do arquivo, sem pasta)."""
    pasta = Path(raiz) / "src/tests"
    saida = []
    for p in sorted(pasta.glob("*.test.ts")):
        if p.name.startswith("energia") or LE_ENERGIA.search(p.read_text(encoding="utf-8")):
            saida.append(p.name)
    return saida


def carregar_mapa(caminho=MAPA):
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


REPROVOU_PY = re.compile(r"^(?:FAIL|ERROR): (\w+) \(pipeline\.tests\.(\w+)\.(\w+)\.\w+\)", re.M)


def reprovacoes_python(log):
    """(módulo, classe, teste) de cada FAIL/ERROR do unittest no log."""
    return [(m.group(2), m.group(3), m.group(1)) for m in REPROVOU_PY.finditer(log or "")]


def decidir_python(reprovacoes, mapa_python):
    """Golds retidas pela suíte Python (gold → motivos) ou None quando alguma reprovação retém tudo."""
    golds = defaultdict(list)
    for modulo, classe, teste in reprovacoes:
        alvo = mapa_python.get(modulo)
        if "Gold" not in classe or alvo is None or alvo == "tudo":
            return None, f"{modulo}.{classe}.{teste}"
        for g in alvo:
            golds[g].append(f"{modulo}: {classe}.{teste}")
    return dict(golds), ""


def _dependencias():
    from pipeline.energia.run import ARQUIVOS_OPERACAO, DEPENDENCIAS
    return ARQUIVOS_OPERACAO, DEPENDENCIAS


def _paginas_da_gold(raiz=RAIZ):
    """PAGINAS_DA_GOLD de src/lib/energia/retencao.ts: rota (sem /setor-eletrico) → golds."""
    t = (Path(raiz) / "src/lib/energia/retencao.ts").read_text(encoding="utf-8")
    saida = defaultdict(set)
    for gold, rotas in re.findall(r'"([a-z_]+\.json)": \[([^\]]*)\]', t):
        for rota in re.findall(r'"(/[^"]*)"', rotas):
            saida[rota].add(gold)
    return saida


def golds_citadas(nome, golds_do_arquivo, paginas):
    """Golds que a descrição da asserção cita (gold pelo nome ou rota do módulo); sem citação, as do arquivo."""
    citadas = {g for g in re.findall(r"\b([a-z_]+\.json)\b", nome) if g not in CONTROLE}
    for rota in re.findall(r"/setor-eletrico(/[a-z0-9/-]+)|\((/[a-z0-9/-]+)\)", nome):
        r = (rota[0] or rota[1]).rstrip("/")
        for pagina, golds in paginas.items():
            if r == pagina or r.startswith(pagina + "/"):
                citadas |= golds
    return sorted(citadas) if citadas else sorted(golds_do_arquivo)


def codigos(texto):
    """"vitest=1 pipeline=0 build=0" → {'vitest': 1, ...}; chave ausente vale None."""
    saida = {}
    for k, v in re.findall(r"(\w+)=(-?\d+)", texto or ""):
        saida[k] = int(v)
    return saida


def decidir(resultado, codigos_suites, mapa_completo, paginas, dependencias, log_python="", raiz=RAIZ):
    """Decide o que fica retido. Devolve dict com modo ('tudo', 'parcial' ou 'nada'), golds (gold → motivos),
    interface (arquivos reprovados que não retêm), desconhecidos e motivo do modo tudo."""
    mapa = mapa_completo["arquivos"]
    c = codigos_suites
    if c.get("build") not in (0, None) or c.get("pipeline") not in (0, 1, None) or c.get("vitest") not in (0, 1):
        return {"modo": "tudo", "motivo": f"suítes: {c}", "golds": {}, "interface": [], "desconhecidos": []}
    golds = defaultdict(list)
    if c.get("pipeline") == 1:
        reprovadas = reprovacoes_python(log_python)
        if not reprovadas:
            return {"modo": "tudo", "motivo": "suíte Python reprovou sem FAIL/ERROR legível no log", "golds": {}, "interface": [], "desconhecidos": []}
        por_python, bloqueio = decidir_python(reprovadas, mapa_completo.get("python", {}))
        if por_python is None:
            return {"modo": "tudo", "motivo": f"suíte Python: {bloqueio}", "golds": {}, "interface": [], "desconhecidos": []}
        for g, m in por_python.items():
            golds[g].extend(m)
    if c.get("vitest") == 0 and not golds and not any(t.get("status") == "failed" for t in resultado.get("testResults", [])):
        return {"modo": "nada", "motivo": "", "golds": {}, "interface": [], "desconhecidos": []}
    interface, desconhecidos, tudo = [], [], []
    for t in resultado.get("testResults", []):
        if t.get("status") == "passed":
            continue
        nome = os.path.basename(t["name"])
        reprovadas = [a for a in t.get("assertionResults", []) if a.get("status") == "failed"]
        if not reprovadas and t.get("status") != "failed":
            continue
        classe = mapa.get(nome)
        if classe is None:
            # fora do mapa: não lê a gold de energia (a cobertura do mapa é exigida por pipeline/tests); a falha é de
            # outro domínio ou de código e vai para a lista, sem decidir a retenção
            desconhecidos.append(nome)
            continue
        if classe["classe"] == "interface":
            interface.append(f"{nome} ({len(reprovadas)} teste{'s' if len(reprovadas) != 1 else ''})")
            continue
        if classe["classe"] == "tudo" or not reprovadas:
            tudo.append(nome)
            continue
        for a in reprovadas:
            for g in golds_citadas(a.get("fullName", ""), classe["golds"], paginas):
                golds[g].append(f"{nome}: {a.get('fullName', '')[:120]}")
    if tudo:
        return {"modo": "tudo", "motivo": f"classe tudo: {', '.join(tudo)}", "golds": {}, "interface": interface, "desconhecidos": desconhecidos}
    fechadas = fechar(dict(golds), dependencias)
    return {"modo": "parcial" if fechadas else "nada", "motivo": "", "golds": fechadas, "interface": interface,
            "desconhecidos": desconhecidos}


def expandir(resultado, codigos_suites, mapa_completo, dependencias, retidas, log_python=""):
    """Rodada 1 reprovada: a retenção cresce para todas as golds de cada teste de dado reprovado (sem a restrição
    pela rota citada na asserção), mais o fechamento. Devolve a decisão nova ou modo tudo."""
    paginas = {}  # sem restrição por rota: a asserção já falhou sobre a publicação recomposta
    d = decidir(resultado, codigos_suites, mapa_completo, paginas, dependencias, log_python)
    if d["modo"] == "tudo":
        return d
    golds = {g: list(m) for g, m in retidas.items()}
    for g, m in d["golds"].items():
        golds.setdefault(g, []).extend(m)
    novas = set(golds) - set(retidas)
    if not novas:
        return {"modo": "tudo", "motivo": "a publicação recomposta reprovou sem gold nova a reter", "golds": {}, "interface": d["interface"], "desconhecidos": []}
    return {"modo": "parcial", "motivo": "", "golds": fechar(golds, dependencias), "interface": d["interface"], "desconhecidos": []}


def fechar(golds, dependencias):
    """Dependentes (Listadas e Leilões com Empresas) e derivadas (síntese com a operação) entram com a gold."""
    golds = {g: list(m) for g, m in golds.items()}
    mudou = True
    while mudou:
        mudou = False
        for modulo, lidas in dependencias.items():
            nome = f"{modulo}.json"
            for lida in lidas:
                if lida in golds and nome not in golds:
                    golds[nome] = [f"dependência retida: {lida}"]
                    mudou = True
    for g in RECONSTRUIDAS:
        golds.pop(g, None)
    return golds


def publicada_git(raiz=RAIZ):
    """Leitor da versão publicada: bytes de um caminho relativo em HEAD, ou None se não existia."""
    existentes = set(subprocess.check_output(["git", "ls-files", "public/energia"], cwd=raiz, text=True).split("\n"))

    def ler(rel):
        if rel not in existentes:
            return None
        return subprocess.check_output(["git", "show", f"HEAD:{rel}"], cwd=raiz)
    ler.existentes = existentes
    return ler


def motivo_curto(gold, motivos):
    testes = sorted({m.split(":")[0] for m in motivos})
    if all(m.startswith(("dependência", "derivada")) for m in motivos):
        return motivos[0]
    return "conferência da publicação reprovada: " + ", ".join(testes)


def reter(golds, raiz, publicada):
    """Devolve as golds retidas à versão publicada. `golds`: gold → motivos. Devolve os caminhos refeitos."""
    from pipeline.energia.fontes import publicacao_dados as pub
    raiz = Path(raiz)
    arquivos_operacao, _ = _dependencias()
    arq_novo = json.loads((raiz / GOLD / "arquivos.json").read_text(encoding="utf-8"))
    arq_pub_bytes = publicada(f"{GOLD}/arquivos.json")
    arq_pub = json.loads(arq_pub_bytes) if arq_pub_bytes else {"arquivos": {}}
    meta = json.loads((raiz / GOLD / "meta.json").read_text(encoding="utf-8"))
    manifesto = json.loads((raiz / GOLD / "manifesto.json").read_text(encoding="utf-8"))
    refeitos, removidos = [], []
    for gold, motivos in golds.items():
        caminhos = {f"{GOLD}/{gold}"}
        caminhos |= {"public" + p for p, v in arq_pub["arquivos"].items() if v.get("gold") == gold}
        caminhos |= {f"public/energia/series/{s}" for s in arquivos_operacao.get(gold, ())}
        novos = {"public" + p for p, v in arq_novo["arquivos"].items() if v.get("gold") == gold}
        gemeos = {rel[:-4] + ".parquet" for rel in caminhos | novos if rel.endswith(".csv")}
        for rel in sorted(caminhos | novos | gemeos):
            conteudo = publicada(rel)
            destino = raiz / rel
            if conteudo is None:
                if destino.exists():
                    destino.unlink()
                    removidos.append(rel)
                continue
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(conteudo)
            refeitos.append(rel)
        # arquivos.json: as entradas desta gold voltam a ser as publicadas
        arq_novo["arquivos"] = {p: v for p, v in arq_novo["arquivos"].items() if v.get("gold") != gold}
        arq_novo["arquivos"].update({p: v for p, v in arq_pub["arquivos"].items() if v.get("gold") == gold})
        g = json.loads((raiz / GOLD / gold).read_text(encoding="utf-8"))
        meta.setdefault("golds", {})[gold] = {"disponivel": g.get("disponivel"), "gerado_em": g.get("gerado_em")}
        if not any(r.get("gold") == gold for r in meta.setdefault("regressoes", [])):
            meta["regressoes"].append({"gold": gold, "motivo": motivo_curto(gold, motivos)})
    (raiz / GOLD / "arquivos.json").write_text(json.dumps(arq_novo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (raiz / GOLD / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return refeitos, removidos


def manifesto(raiz=RAIZ):
    """Manifesto recalculado do disco: todo arquivo publicado com bytes e sha256 atuais, o que saiu sai, o que entrou
    entra, e o id da publicação refeito. Chamado depois de reter() e recompor()."""
    from pipeline.energia.fontes import publicacao_dados as pub
    raiz = Path(raiz)
    m = json.loads((raiz / GOLD / "manifesto.json").read_text(encoding="utf-8"))
    por_caminho = {i["caminho"]: i for i in m["arquivos"]}
    itens = []
    for rel in pub.lista_publicados(excluir={f"/energia/gold/manifesto.json"}):
        novo = pub.item_manifesto(rel)
        antigo = por_caminho.get(novo["caminho"])
        if antigo:
            antigo.update({k: novo[k] for k in ("bytes", "sha256", "gerado_em", "disponivel", "colunas", "linhas") if k in novo})
            itens.append(antigo)
        else:
            itens.append(novo)
    itens.sort(key=lambda i: i["caminho"])
    tipos = {}
    for i in itens:
        tipos[f"{i['tipo']}s"] = tipos.get(f"{i['tipo']}s", 0) + 1
    m["arquivos"] = itens
    m["id_publicacao"] = pub.id_publicacao(itens)
    m["totais"] = {"arquivos": len(itens), "bytes": sum(i["bytes"] for i in itens), **tipos}
    (raiz / GOLD / "manifesto.json").write_text(json.dumps(m, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(itens)


def recompor(raiz=RAIZ):
    """Golds derivadas só das golds publicadas, reconstruídas sobre a publicação recomposta: a síntese (módulo visao,
    Visão geral e inicial). Sem a reconstrução a Visão geral citaria números de duas edições. O módulo dados não é
    reconstruído (exige os catálogos do silver); o manifesto é recalculado por manifesto(). Falha aqui é erro (o
    workflow retém tudo)."""
    from pipeline.energia.fontes import publicacao_dados as pub
    feitos = []
    for modulo in ("visao",):
        subprocess.run([sys.executable, "pipeline/energia/executar_modulo.py", modulo, "--sem-coleta"], cwd=raiz, check=True)
        feitos.append(modulo)
    # o Parquet de cada CSV restaurado volta a corresponder a ele; o de CSV que saiu é removido
    pub.exporta_parquet()
    return feitos


def arquivos_json(golds, raiz, publicada):
    """Depois do módulo visao, que reescreve arquivos.json pelo registro dos módulos (os arquivos da gold candidata),
    as entradas das golds retidas voltam às publicadas: a lista cita só arquivos que existem."""
    raiz = Path(raiz)
    arq = json.loads((raiz / GOLD / "arquivos.json").read_text(encoding="utf-8"))
    pub_bytes = publicada(f"{GOLD}/arquivos.json")
    pub = json.loads(pub_bytes) if pub_bytes else {"arquivos": {}}
    arq["arquivos"] = {p: v for p, v in arq["arquivos"].items() if v.get("gold") not in golds}
    arq["arquivos"].update({p: v for p, v in pub["arquivos"].items() if v.get("gold") in golds})
    (raiz / GOLD / "arquivos.json").write_text(json.dumps(arq, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(arq["arquivos"])


def relatorio(decisao):
    linhas = []
    if decisao["modo"] == "tudo":
        linhas.append(f"Publicação inteira retida ({decisao['motivo']}).")
    elif decisao["modo"] == "parcial":
        linhas.append("Publicação por gold: golds retidas na versão publicada, as demais atualizadas.")
        linhas.append("")
        for g, motivos in sorted(decisao["golds"].items()):
            linhas.append(f"- `{g}`: {motivo_curto(g, motivos)}")
            for m in motivos[:5]:
                linhas.append(f"  - {m}")
    else:
        linhas.append("Nenhuma gold retida pelos testes de conteúdo.")
    if decisao["interface"]:
        linhas += ["", "Testes de interface reprovados (não retêm a publicação; corrigir o código):"]
        linhas += [f"- {x}" for x in decisao["interface"]]
    if decisao.get("desconhecidos"):
        linhas += ["", "Testes de outros domínios reprovados (não leem a gold de energia; não decidem a retenção):"]
        linhas += [f"- {x}" for x in decisao["desconhecidos"]]
    return "\n".join(linhas) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("resultado")
    ap.add_argument("codigos")
    ap.add_argument("--log-python", default="pipeline-testes.log")
    ap.add_argument("--aplicar", action="store_true")
    ap.add_argument("--rodada", type=int, default=0, help="1: amplia a retenção da rodada anterior (energia-retencao.json em --saida)")
    ap.add_argument("--saida", default=".")
    ap.add_argument("--raiz", default=str(RAIZ))
    args = ap.parse_args(argv)
    try:
        resultado = json.loads(Path(args.resultado).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        resultado, erro = {"testResults": []}, str(e)
    else:
        erro = None
    c = codigos(Path(args.codigos).read_text(encoding="utf-8") if Path(args.codigos).exists() else "")
    if erro:
        decisao = {"modo": "tudo", "motivo": f"resultado do vitest ilegível ({erro[:80]})", "golds": {}, "interface": [], "desconhecidos": []}
    else:
        _, dependencias = _dependencias()
        log_py = Path(args.log_python).read_text(encoding="utf-8", errors="replace") if Path(args.log_python).exists() else ""
        saida = Path(args.saida)
        if args.rodada >= 1:
            anterior = json.loads((saida / "energia-retencao.json").read_text(encoding="utf-8"))
            decisao = expandir(resultado, c, carregar_mapa(), dependencias, anterior.get("golds", {}), log_py)
        else:
            decisao = decidir(resultado, c, carregar_mapa(), _paginas_da_gold(args.raiz), dependencias, log_py, args.raiz)
    texto = relatorio(decisao)
    saida = Path(args.saida)
    saida.mkdir(parents=True, exist_ok=True)
    (saida / "energia-retencao.md").write_text(texto, encoding="utf-8")
    (saida / "energia-retencao.json").write_text(json.dumps(decisao, ensure_ascii=False, indent=1), encoding="utf-8")
    print(texto)
    if decisao["modo"] == "parcial" and args.aplicar:
        refeitos, removidos = reter(decisao["golds"], args.raiz, publicada_git(args.raiz))
        print(f"{len(refeitos)} arquivos devolvidos à versão publicada, {len(removidos)} removidos.")
        print("reconstruídos sobre a publicação recomposta:", ", ".join(recompor(args.raiz)))
        print("arquivos.json:", arquivos_json(decisao["golds"], args.raiz, publicada_git(args.raiz)), "entradas")
        print("manifesto recalculado:", manifesto(args.raiz), "arquivos")
    return 2 if decisao["modo"] == "tudo" else 0


if __name__ == "__main__":
    sys.exit(main())
