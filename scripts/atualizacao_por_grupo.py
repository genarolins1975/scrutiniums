"""Atualização agendada com decisão de publicação por grupo de fontes.

Usado pelos workflows agendados de Saneamento, Contas Públicas Federais e Eficiência
Estatal (.github/workflows/atualizar-*.yml). A configuração de cada domínio fica em
config/atualizacao/<dominio>.json e declara, por grupo de fontes, o comando de coleta e os
caminhos que ele grava; e, para o domínio, a reconstrução, as saídas publicadas, o sinal de
mudança e os testes que bloqueiam a publicação.

    python3 scripts/atualizacao_por_grupo.py ciclo config/atualizacao/saneamento.json [--sem-coleta] [--grupos a,b]
    python3 scripts/atualizacao_por_grupo.py publicar config/atualizacao/saneamento.json [--ramo main]

O ciclo:
1. coleta cada grupo em separado; falha de coleta ou coleta degradada (guarda) devolve os
   caminhos do grupo ao estado do commit e não impede os outros grupos;
2. reconstrói as saídas a partir do seed do commit; se a publicação não se reproduz com o
   código atual, a reprodução é testada como um grupo próprio ("reconstrucao");
3. aplica os grupos coletados um a um, sobre os já aprovados: reconstrói, compara o sinal de
   mudança (dado igual não publica nada, só a data de captura não conta) e roda os testes.
   Aprovado, o grupo entra; reprovado, volta ao estado anterior e o próximo grupo é avaliado
   sobre a composição aprovada. Os testes do último grupo aprovado rodaram sobre a composição
   final exata, então nada é publicado sem testes verdes.
4. grava .atualizacao/<dominio>/resultado.json e relatorio.md (corpo da issue) e, no Actions,
   publicavel=1 em GITHUB_OUTPUT quando há grupo aprovado.

Saída do ciclo: 0 sem retenção nem falha; 1 algum grupo retido ou com coleta falha (os
aprovados podem ser publicados); 2 erro de infraestrutura (nada é publicado).

`publicar` faz o commit só dos caminhos dos grupos aprovados e das saídas, traz o ramo remoto
com rebase e empurra, com quatro tentativas. Se os dados do domínio mudaram no ramo durante a
execução, não publica (a composição foi testada sobre outra base). Se o código do domínio
mudou, reconstrói e testa de novo antes de empurrar: nunca se publica saída gerada por código
antigo sem os testes do código novo.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import fnmatch
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

RAIZ_PADRAO = Path(__file__).resolve().parents[1]
LINHAS_LOG = 80
LIMITE_RELATORIO = 55000

# Situações de cada grupo. As de RETENCAO deixam a execução vermelha e viram issue.
PUBLICADO = "publicado"
SEM_MUDANCA_FONTE = "fonte_sem_mudanca"
SEM_MUDANCA_DADO = "sem_mudanca_no_dado"
NAO_COLETADO = "nao_coletado"
COLETA_FALHOU = "coleta_falhou"
COLETA_DEGRADADA = "coleta_degradada"
RECONSTRUCAO_FALHOU = "retido_reconstrucao"
RETIDO_TESTES = "retido_testes"
RETIDO_BASE = "retido_base"
RETENCAO = {COLETA_FALHOU, COLETA_DEGRADADA, RECONSTRUCAO_FALHOU, RETIDO_TESTES, RETIDO_BASE}

DESCRICAO = {
    PUBLICADO: "publicado (testes verdes)",
    SEM_MUDANCA_FONTE: "fonte sem mudança: os arquivos coletados são idênticos aos publicados",
    SEM_MUDANCA_DADO: "nenhum número publicado mudou (só metadados de captura); o seed anterior foi mantido",
    NAO_COLETADO: "não coletado nesta execução",
    COLETA_FALHOU: "coleta falhou; o seed anterior foi mantido",
    COLETA_DEGRADADA: "coleta degradada (guarda reprovou); o seed anterior foi mantido",
    RECONSTRUCAO_FALHOU: "a reconstrução falhou com os dados novos; publicação do grupo retida",
    RETIDO_TESTES: "testes reprovaram os dados novos; publicação do grupo retida",
    RETIDO_BASE: "não avaliado: a publicação atual não passa nos testes com o código atual",
}


class ErroConfiguracao(Exception):
    pass


# --------------------------------------------------------------------------- configuração

def carregar_config(caminho: Path) -> dict:
    return carregar_config_dict(json.loads(Path(caminho).read_text(encoding="utf-8")))


def carregar_config_dict(cfg: dict) -> dict:
    for chave in ("dominio", "titulo", "grupos", "testes", "saidas"):
        if chave not in cfg:
            raise ErroConfiguracao(f"configuração sem '{chave}'")
    cfg.setdefault("reconstruir", [])
    cfg.setdefault("codigo", [])
    cfg.setdefault("sinal_de_mudanca", [{"caminho": s} for s in cfg["saidas"]])
    ids = [g["id"] for g in cfg["grupos"]]
    if len(ids) != len(set(ids)):
        raise ErroConfiguracao("id de grupo repetido")
    if "reconstrucao" in ids:
        raise ErroConfiguracao("'reconstrucao' é reservado")
    vistos: dict[str, str] = {}
    for g in cfg["grupos"]:
        g.setdefault("coleta", [])
        g.setdefault("guardas", [])
        g.setdefault("timeout_min", 30)
        if not g.get("caminhos") and g["coleta"]:
            raise ErroConfiguracao(f"grupo {g['id']} coleta sem declarar caminhos")
        for c in g.get("caminhos", []):
            for outro, dono in vistos.items():
                if _sobrepoe(c, outro):
                    raise ErroConfiguracao(f"caminho {c} do grupo {g['id']} sobrepõe {outro} do grupo {dono}")
            for s in cfg["saidas"]:
                if _sobrepoe(c, s):
                    raise ErroConfiguracao(f"caminho {c} do grupo {g['id']} sobrepõe a saída {s}")
            vistos[c] = g["id"]
    for t in cfg["testes"]:
        if not t.get("nome") or not t.get("comando"):
            raise ErroConfiguracao("teste sem nome ou comando")
    return cfg


def _base_glob(c: str) -> str:
    partes = []
    for p in c.split("/"):
        if any(x in p for x in "*?["):
            break
        partes.append(p)
    return "/".join(partes)


def _eh_glob(c: str) -> bool:
    return any(x in c for x in "*?[")


def _sobrepoe(a: str, b: str) -> bool:
    """Dois caminhos (diretório, arquivo ou glob) podem designar o mesmo arquivo."""
    a, b = a.rstrip("/"), b.rstrip("/")
    if _eh_glob(a) and _eh_glob(b):
        return a == b or _base_glob(a) == _base_glob(b) and (fnmatch.fnmatch(a, b) or fnmatch.fnmatch(b, a))
    if _eh_glob(a) or _eh_glob(b):
        glob, fixo = (a, b) if _eh_glob(a) else (b, a)
        base = _base_glob(glob)
        # o arquivo casa com o glob; o diretório contém a base do glob; ou um arquivo dentro do
        # diretório poderia casar com o glob
        return (fnmatch.fnmatch(fixo, glob) or fixo == base or base.startswith(fixo + "/")
                or (fixo.startswith(base + "/") and fnmatch.fnmatch(fixo + "/x", glob)))
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")


def caminhos_dominio(cfg: dict) -> list[str]:
    return [c for g in cfg["grupos"] for c in g.get("caminhos", [])] + list(cfg["saidas"])


# --------------------------------------------------------------------------- git e arquivos

class Repo:
    def __init__(self, raiz: Path):
        self.raiz = Path(raiz)

    def git(self, *args, check=True, capturar=True):
        r = subprocess.run(["git", *args], cwd=self.raiz, text=True,
                           stdout=subprocess.PIPE if capturar else None,
                           stderr=subprocess.PIPE if capturar else None)
        if check and r.returncode != 0:
            raise RuntimeError(f"git {' '.join(args)}: {(r.stderr or '').strip()}")
        return r

    @staticmethod
    def specs(caminhos):
        return [(":(glob)" + c) if any(x in c for x in "*?[") else c for c in caminhos]

    # Comparação por CONTEÚDO, nunca pelo cache de stat do índice: o ciclo regrava arquivos várias
    # vezes no mesmo segundo (coleta, reversão, candidato), com o mesmo tamanho, e o Git então dá o
    # arquivo por inalterado: `git status` deixa de listar a mudança, `git checkout` deixa de
    # restaurar e `git add` deixa de incluir. Medido no teste deste motor antes da correção.

    def rastreados(self, caminhos) -> dict[str, str]:
        """Arquivos do índice (igual ao HEAD durante o ciclo) sob os caminhos, com o blob de cada um."""
        if not caminhos:
            return {}
        r = self.git("ls-files", "-s", "-z", "--", *self.specs(caminhos))
        saida = {}
        for item in r.stdout.split("\0"):
            if item:
                meta, nome = item.split("\t", 1)
                saida[nome] = meta.split()[1]
        return saida

    def _hashes(self, nomes: list[str]) -> dict[str, str]:
        if not nomes:
            return {}
        r = subprocess.run(["git", "hash-object", "--stdin-paths"], cwd=self.raiz, text=True,
                           input="\n".join(nomes) + "\n", capture_output=True, check=True)
        return dict(zip(nomes, r.stdout.split()))

    def alterados(self, caminhos) -> list[str]:
        """Arquivos modificados, novos ou apagados sob os caminhos, em relação ao índice (= HEAD)."""
        if not caminhos:
            return []
        indice = self.rastreados(caminhos)
        presentes = sorted({n for c in caminhos for n in _arquivos_sob(self.raiz, c)})
        hashes = self._hashes(presentes)
        mudados = [n for n in presentes if indice.get(n) != hashes.get(n)]
        apagados = [n for n in indice if not (self.raiz / n).is_file()]
        return sorted(set(mudados + apagados))

    def alterados_status(self, caminhos) -> list[str]:
        """Lista aproximada (cache de stat do Git), só para avisos sobre o resto da árvore."""
        r = self.git("status", "--porcelain", "-z", "--untracked-files=all", "--", *self.specs(caminhos), check=False)
        itens = [x for x in r.stdout.split("\0") if x]
        return sorted({x[3:] for x in itens if len(x) > 3})

    def reverter(self, caminhos):
        """Devolve os caminhos ao conteúdo do HEAD: regrava os rastreados que mudaram e apaga os novos."""
        if not caminhos:
            return
        indice = self.rastreados(caminhos)
        for nome in self.alterados(caminhos):
            p = self.raiz / nome
            if nome in indice:
                conteudo = subprocess.run(["git", "cat-file", "blob", indice[nome]], cwd=self.raiz,
                                          capture_output=True, check=True).stdout
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(conteudo)
            elif p.exists():
                p.unlink()

    def preparar(self, caminhos):
        """Põe no índice exatamente o conteúdo da árvore sob os caminhos (sem confiar no cache de stat)."""
        specs = self.specs(caminhos)
        self.git("rm", "-r", "-q", "--cached", "--ignore-unmatch", "--", *specs)
        self.git("add", "-A", "-f", "--", *specs)

    def head(self) -> str:
        return self.git("rev-parse", "HEAD").stdout.strip()


def _arquivos_sob(raiz: Path, caminho: str) -> list[str]:
    alvo = raiz / caminho
    if any(x in caminho for x in "*?["):
        return sorted(str(p.relative_to(raiz)) for p in raiz.glob(caminho) if p.is_file())
    if alvo.is_file():
        return [caminho]
    if alvo.is_dir():
        return sorted(str(p.relative_to(raiz)) for p in alvo.rglob("*") if p.is_file())
    return []


def sha256_arquivo(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def _valor_pontilhado(obj, caminho: str):
    for parte in caminho.split("."):
        if not isinstance(obj, dict) or parte not in obj:
            return None
        obj = obj[parte]
    return obj


def _sem_chaves(obj, chaves: set):
    """Remove as chaves de carimbo: nome simples em qualquer nível ("capturado_em") ou caminho a
    partir da raiz com curinga por nível ("cadunico.meses.*.sha256")."""
    simples = {c for c in chaves if "." not in c}
    caminhos = [c.split(".") for c in chaves if "." in c]

    def limpar(o, nivel):
        if isinstance(o, dict):
            saida = {}
            for k, v in o.items():
                if k in simples:
                    continue
                prox = [c for c in nivel if c and fnmatch.fnmatchcase(k, c[0])]
                if any(len(c) == 1 for c in prox):
                    continue
                saida[k] = limpar(v, [c[1:] for c in prox])
            return saida
        if isinstance(o, list):
            return [limpar(v, nivel) for v in o]
        return o

    return limpar(obj, caminhos)


def sinal(raiz: Path, regras: list[dict]) -> dict:
    """Impressão digital do que o leitor vê. Duas impressões iguais = nenhum número mudou."""
    d = {}
    for regra in regras:
        if "caminho" in regra:
            exceto = regra.get("exceto", [])
            for nome in _arquivos_sob(raiz, regra["caminho"]):
                if any(fnmatch.fnmatch(nome, e) for e in exceto):
                    continue
                d[nome] = sha256_arquivo(raiz / nome)
        elif "json_chave" in regra:
            p = raiz / regra["arquivo"]
            v = _valor_pontilhado(json.loads(p.read_text(encoding="utf-8")), regra["json_chave"]) if p.exists() else None
            d[f"{regra['arquivo']}#{regra['json_chave']}"] = v
        elif "json_sem" in regra:
            # chaves de carimbo (data de captura) não contam como mudança, em qualquer nível do JSON
            p = raiz / regra["arquivo"]
            if p.exists():
                obj = _sem_chaves(json.loads(p.read_text(encoding="utf-8")), set(regra["json_sem"]))
                d[regra["arquivo"]] = hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            else:
                d[regra["arquivo"]] = None
        else:
            raise ErroConfiguracao(f"regra de sinal desconhecida: {regra}")
    return d


def diferencas(a: dict, b: dict) -> list[str]:
    return sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k))


class Instantaneo:
    """Cópia das saídas, para voltar à composição aprovada quando um grupo é retido."""

    def __init__(self, raiz: Path, saidas: list[str], pasta: Path):
        self.raiz, self.saidas, self.pasta = raiz, saidas, pasta
        if pasta.exists():
            shutil.rmtree(pasta)
        pasta.mkdir(parents=True)
        self.existentes = []
        for s in saidas:
            for nome in _arquivos_sob(raiz, s):
                destino = pasta / nome
                destino.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(raiz / nome, destino)
                self.existentes.append(nome)

    def restaurar(self):
        for s in self.saidas:
            for nome in _arquivos_sob(self.raiz, s):
                if nome not in self.existentes:
                    (self.raiz / nome).unlink()
        for nome in self.existentes:
            destino = self.raiz / nome
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(self.pasta / nome, destino)


# --------------------------------------------------------------------------- execução de comandos

def rodar(cmd: list[str], raiz: Path, timeout_min: float, log: Path) -> tuple[int, str]:
    """Roda o comando mostrando a saída ao vivo no log do Actions; devolve código e as últimas linhas."""
    print(f"::group::{' '.join(cmd)}", flush=True)
    cauda: collections.deque[str] = collections.deque(maxlen=LINHAS_LOG)
    env = dict(os.environ, PYTHONUNBUFFERED="1")
    log.parent.mkdir(parents=True, exist_ok=True)
    inicio = time.monotonic()
    with open(log, "a", encoding="utf-8") as arq:
        arq.write(f"$ {' '.join(cmd)}\n")
        try:
            # grupo de processos próprio: no tempo esgotado, os filhos (ex.: Python chamado por bash -c) também
            # morrem e liberam o pipe de saída, em vez de prender a leitura até o teto do workflow
            proc = subprocess.Popen(cmd, cwd=raiz, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, errors="replace", start_new_session=True)
        except OSError as e:
            print(f"não foi possível iniciar: {e}", flush=True)
            print("::endgroup::", flush=True)
            return 127, f"não foi possível iniciar: {e}"
        estourou = threading.Event()

        def vigiar():
            try:
                proc.wait(timeout=timeout_min * 60)
            except subprocess.TimeoutExpired:
                estourou.set()
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass

        t = threading.Thread(target=vigiar, daemon=True)
        t.start()
        assert proc.stdout is not None
        with proc.stdout:
            for linha in proc.stdout:
                sys.stdout.write(linha)
                arq.write(linha)
                cauda.append(linha.rstrip("\n"))
        proc.wait()
        t.join(timeout=5)
        rc = 124 if estourou.is_set() else proc.returncode
        if estourou.is_set():
            msg = f"tempo esgotado: {timeout_min:g} min"
            cauda.append(msg)
            arq.write(msg + "\n")
        arq.write(f"[código {rc}; {time.monotonic() - inicio:.0f} s]\n")
    sys.stdout.flush()
    print(f"[código {rc}; {time.monotonic() - inicio:.0f} s]", flush=True)
    print("::endgroup::", flush=True)
    return rc, "\n".join(cauda)


# --------------------------------------------------------------------------- guardas pós-coleta

def guarda_manifesto_sem_erro_novo(repo: Repo, arquivo: str) -> list[str]:
    """Manifesto de capturas (pipeline.eficiencia*): nenhuma entrada que estava íntegra no commit pode
    sumir ou virar {"erro": ...}. Fonte em pane não substitui dado publicado por ausência."""
    r = repo.git("show", f"HEAD:{arquivo}", check=False)
    if r.returncode != 0:
        return []
    antes = json.loads(r.stdout).get("capturas", {})
    p = repo.raiz / arquivo
    if not p.exists():
        return [f"{arquivo}: manifesto apagado pela coleta"]
    depois = json.loads(p.read_text(encoding="utf-8")).get("capturas", {})
    problemas = []
    for chave, registro in antes.items():
        if chave not in depois:
            problemas.append(f"{chave}: captura sumiu do manifesto")
            continue
        a_arq, d_arq = registro.get("arquivos"), depois[chave].get("arquivos")
        if not isinstance(a_arq, dict):
            continue
        if not isinstance(d_arq, dict):
            problemas.append(f"{chave}: lista de arquivos sumiu")
            continue
        for item, v in a_arq.items():
            if isinstance(v, dict) and "erro" in v:
                continue
            novo = d_arq.get(item)
            if novo is None:
                problemas.append(f"{chave}/{item}: entrada sumiu")
            elif isinstance(novo, dict) and "erro" in novo:
                problemas.append(f"{chave}/{item}: {str(novo['erro'])[:160]}")
    return problemas


GUARDAS = {"manifesto_sem_erro_novo": guarda_manifesto_sem_erro_novo}


# --------------------------------------------------------------------------- ciclo

def _registrar(resultado: dict, gid: str, nome: str, situacao: str, **extra):
    resultado["grupos"].append({"id": gid, "nome": nome, "situacao": situacao, **extra})


def _rodar_lista(cmds, raiz, timeout_min, log):
    for cmd in cmds:
        rc, cauda = rodar(cmd, raiz, timeout_min, log)
        if rc != 0:
            return rc, cauda, cmd
    return 0, "", None


def _testar(cfg, raiz, log) -> list[dict]:
    """Roda todos os testes (sem parar no primeiro) e devolve os reprovados."""
    reprovados = []
    for t in cfg["testes"]:
        rc, cauda = rodar(t["comando"], raiz, t.get("timeout_min", 30), log)
        if rc != 0:
            reprovados.append({"teste": t["nome"], "codigo": rc, "saida": cauda})
    return reprovados


def ciclo(cfg: dict, raiz: Path, sem_coleta=False, so_grupos=None, trabalho: Path | None = None) -> int:
    repo = Repo(raiz)
    trabalho = trabalho or raiz / ".atualizacao" / cfg["dominio"]
    if trabalho.exists():
        shutil.rmtree(trabalho)
    trabalho.mkdir(parents=True)
    log = trabalho / "execucao.log"
    resultado = {
        "dominio": cfg["dominio"], "titulo": cfg["titulo"],
        "inicio": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "base": repo.head(), "sem_coleta": sem_coleta, "grupos": [], "avisos": [],
        "publicavel": False, "codigo_saida": 0,
    }

    def encerrar(codigo: int) -> int:
        resultado["fim"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
        resultado["codigo_saida"] = codigo
        resultado["publicavel"] = codigo != 2 and any(g["situacao"] == PUBLICADO for g in resultado["grupos"])
        (trabalho / "resultado.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n")
        (trabalho / "relatorio.md").write_text(relatorio(resultado))
        saida_gh = os.environ.get("GITHUB_OUTPUT")
        if saida_gh:
            with open(saida_gh, "a") as f:
                f.write(f"publicavel={'1' if resultado['publicavel'] else '0'}\n")
                f.write(f"retido={'1' if codigo != 0 else '0'}\n")
        print(relatorio(resultado))
        return codigo

    sujos = repo.alterados(caminhos_dominio(cfg))
    if sujos:
        resultado["erro"] = "a árvore já tinha mudanças nos caminhos do domínio antes do ciclo: " + ", ".join(sujos[:10])
        return encerrar(2)

    regras = cfg["sinal_de_mudanca"]
    try:
        sinal_head = sinal(raiz, regras)
    except Exception as e:  # noqa: BLE001
        resultado["erro"] = f"sinal da publicação atual ilegível: {e}"
        return encerrar(2)

    # 1. coleta, grupo a grupo
    candidatos = trabalho / "candidatos"
    coletados = []
    for g in cfg["grupos"]:
        nome = g.get("nome", g["id"])
        if sem_coleta or (so_grupos and g["id"] not in so_grupos) or not g["coleta"]:
            _registrar(resultado, g["id"], nome, NAO_COLETADO)
            continue
        rc, cauda, cmd = _rodar_lista(g["coleta"], raiz, g["timeout_min"], log)
        if rc != 0:
            repo.reverter(g["caminhos"])
            _registrar(resultado, g["id"], nome, COLETA_FALHOU, codigo=rc, comando=" ".join(cmd), saida=cauda)
            continue
        problemas = []
        for guarda in g["guardas"]:
            problemas += GUARDAS[guarda["tipo"]](repo, guarda["arquivo"])
        if problemas:
            repo.reverter(g["caminhos"])
            _registrar(resultado, g["id"], nome, COLETA_DEGRADADA, saida="\n".join(problemas[:LINHAS_LOG]))
            continue
        arquivos = repo.alterados(g["caminhos"])
        if not arquivos:
            _registrar(resultado, g["id"], nome, SEM_MUDANCA_FONTE)
            continue
        apagados = []
        for a in arquivos:
            origem = raiz / a
            if origem.exists():
                destino = candidatos / g["id"] / a
                destino.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(origem, destino)
            else:
                apagados.append(a)
        coletados.append((g, arquivos, apagados))
        repo.reverter(g["caminhos"])

    fora = [a for a in repo.alterados_status(["."]) if not a.startswith(".atualizacao/")
            and not any(_sobrepoe(a, c) for c in caminhos_dominio(cfg))]
    if fora:
        resultado["avisos"].append("arquivos fora do perímetro alterados durante a coleta (não publicados): "
                                   + ", ".join(fora[:20]))
    repo.reverter(cfg["saidas"])

    # 2. a publicação atual se reproduz com o código atual?
    rc, cauda, cmd = _rodar_lista(cfg["reconstruir"], raiz, cfg.get("timeout_reconstruir_min", 30), log)
    if rc != 0:
        repo.reverter(cfg["saidas"])
        resultado["erro"] = f"a reconstrução a partir do seed publicado falhou ({' '.join(cmd)}, código {rc})"
        resultado["saida_erro"] = cauda
        for g, _, _ in coletados:
            _registrar(resultado, g["id"], g.get("nome", g["id"]), RETIDO_BASE)
        return encerrar(2)
    sinal_base = sinal(raiz, regras)
    if sinal_base != sinal_head:
        mudou = diferencas(sinal_head, sinal_base)
        reprovados = _testar(cfg, raiz, log)
        if reprovados:
            repo.reverter(cfg["saidas"])
            _registrar(resultado, "reconstrucao", "Reprodução da publicação com o código atual", RETIDO_TESTES,
                       mudou=mudou[:50], reprovados=reprovados)
            for g, _, _ in coletados:
                _registrar(resultado, g["id"], g.get("nome", g["id"]), RETIDO_BASE)
            return encerrar(1)
        _registrar(resultado, "reconstrucao", "Reprodução da publicação com o código atual", PUBLICADO, mudou=mudou[:50])
    else:
        repo.reverter(cfg["saidas"])  # nada mudou para o leitor: não publicar carimbos de geração

    # 3. grupos coletados, um a um, sobre a composição aprovada
    for g, arquivos, apagados in coletados:
        nome = g.get("nome", g["id"])
        inst = Instantaneo(raiz, cfg["saidas"], trabalho / "instantaneo")
        for a in arquivos:
            if a in apagados:
                (raiz / a).unlink(missing_ok=True)
            else:
                destino = raiz / a
                destino.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(candidatos / g["id"] / a, destino)
        rc, cauda, cmd = _rodar_lista(cfg["reconstruir"], raiz, cfg.get("timeout_reconstruir_min", 30), log)
        if rc != 0:
            repo.reverter(g["caminhos"])
            inst.restaurar()
            _registrar(resultado, g["id"], nome, RECONSTRUCAO_FALHOU, codigo=rc, comando=" ".join(cmd), saida=cauda,
                       arquivos=arquivos[:50])
            continue
        novo = sinal(raiz, regras)
        mudou = diferencas(sinal_base, novo)
        if not mudou:
            repo.reverter(g["caminhos"])
            inst.restaurar()
            _registrar(resultado, g["id"], nome, SEM_MUDANCA_DADO, arquivos=arquivos[:50])
            continue
        reprovados = _testar(cfg, raiz, log)
        if reprovados:
            repo.reverter(g["caminhos"])
            inst.restaurar()
            _registrar(resultado, g["id"], nome, RETIDO_TESTES, arquivos=arquivos[:50], mudou=mudou[:50],
                       reprovados=reprovados)
            continue
        sinal_base = novo
        _registrar(resultado, g["id"], nome, PUBLICADO, arquivos=arquivos[:50], mudou=mudou[:50])

    if not any(x["situacao"] == PUBLICADO for x in resultado["grupos"]):
        repo.reverter(cfg["saidas"])
    retido = any(x["situacao"] in RETENCAO for x in resultado["grupos"])
    return encerrar(1 if retido else 0)


# --------------------------------------------------------------------------- relatório

def relatorio(r: dict) -> str:
    linhas = [f"## Atualização agendada: {r['titulo']}", ""]
    url = os.environ.get("RUN_URL")
    if url:
        linhas += [f"Execução: {url}", ""]
    linhas.append(f"Base: `{r['base'][:12]}`. Início {r['inicio']} UTC.")
    if r.get("sem_coleta"):
        linhas.append("Execução sem coleta: só a reprodução da publicação com o código atual.")
    if r.get("erro"):
        linhas += ["", f"**Erro de infraestrutura, nada foi publicado:** {r['erro']}"]
        if r.get("saida_erro"):
            linhas += ["", "```", r["saida_erro"], "```"]
    linhas += ["", "| Grupo | Situação |", "|---|---|"]
    for g in r["grupos"]:
        linhas.append(f"| {g['nome']} (`{g['id']}`) | {DESCRICAO.get(g['situacao'], g['situacao'])} |")
    for g in r["grupos"]:
        if g["situacao"] not in RETENCAO or g["situacao"] == RETIDO_BASE:
            continue
        linhas += ["", f"### {g['nome']}: {DESCRICAO[g['situacao']]}"]
        if g.get("mudou"):
            linhas.append("Mudou para o leitor: " + ", ".join(f"`{m}`" for m in g["mudou"][:15])
                          + (" e outros" if len(g["mudou"]) > 15 else ""))
        if g.get("comando"):
            linhas.append(f"Comando: `{g['comando']}` (código {g.get('codigo')})")
        if g.get("saida"):
            linhas += ["", "```", g["saida"], "```"]
        for t in g.get("reprovados", []):
            linhas += ["", f"Teste reprovado: **{t['teste']}** (código {t['codigo']})", "", "```", t["saida"], "```"]
    for a in r.get("avisos", []):
        linhas += ["", f"Aviso: {a}"]
    publicados = [g["nome"] for g in r["grupos"] if g["situacao"] == PUBLICADO]
    linhas += ["", ("Publicados nesta execução: " + "; ".join(publicados) + ".") if publicados
               else "Nada publicado nesta execução: o site segue com a publicação anterior."]
    linhas += ["", "Grupo retido mantém no ar a publicação anterior. Enquanto esta issue estiver aberta, "
                   "novas ocorrências viram comentários aqui."]
    texto = "\n".join(linhas) + "\n"
    if len(texto) > LIMITE_RELATORIO:
        texto = texto[:LIMITE_RELATORIO] + "\n\n(relatório cortado; íntegra no artefato da execução)\n"
    return texto


# --------------------------------------------------------------------------- publicação

def publicar(cfg: dict, raiz: Path, ramo: str, trabalho: Path | None = None, tentativas=4, espera=5) -> int:
    repo = Repo(raiz)
    trabalho = trabalho or raiz / ".atualizacao" / cfg["dominio"]
    r = json.loads((trabalho / "resultado.json").read_text())
    if not r.get("publicavel"):
        print("Nenhum grupo aprovado: nada a publicar.")
        return 0
    aprovados = [g for g in r["grupos"] if g["situacao"] == PUBLICADO]
    ids = {g["id"] for g in aprovados}
    caminhos = [c for g in cfg["grupos"] if g["id"] in ids for c in g.get("caminhos", [])] + list(cfg["saidas"])
    existentes = [c for c in caminhos if any(x in c for x in "*?[") or (raiz / c).exists() or repo.rastreados([c])]
    repo.preparar(existentes)
    if repo.git("diff", "--cached", "--quiet", check=False).returncode == 0:
        print("Sem mudanças a publicar.")
        return 0
    retidos = [g["nome"] for g in r["grupos"] if g["situacao"] in RETENCAO]
    msg = (f"Atualiza dados de {cfg['titulo']} (pipeline automático)\n\n"
           f"Publicados: {'; '.join(g['nome'] for g in aprovados)}.\n"
           + (f"Retidos: {'; '.join(retidos)}.\n" if retidos else ""))
    repo.git("commit", "-q", "-m", msg)
    base = r["base"]
    dados = caminhos_dominio(cfg)
    log = trabalho / "publicacao.log"
    for tentativa in range(1, tentativas + 1):
        if repo.git("fetch", "-q", "origin", ramo, check=False).returncode != 0:
            print(f"fetch falhou (tentativa {tentativa})")
            time.sleep(espera * tentativa)
            continue
        remoto = repo.git("rev-parse", "FETCH_HEAD").stdout.strip()
        if repo.git("diff", "--quiet", base, remoto, "--", *repo.specs(dados), check=False).returncode != 0:
            print("::error::os dados do domínio mudaram no ramo durante a execução; a composição foi testada "
                  "sobre outra base. Publicação retida: repetir o ciclo.")
            return 1
        if repo.git("-c", "rebase.autoStash=true", "rebase", "-q", remoto, check=False).returncode != 0:
            repo.git("rebase", "--abort", check=False)
            print("::error::conflito ao trazer o ramo remoto; publicação retida")
            return 1
        if cfg["codigo"] and repo.git("diff", "--quiet", base, remoto, "--", *repo.specs(cfg["codigo"]),
                                      check=False).returncode != 0:
            print("O código do domínio mudou no ramo: reconstruindo e testando com o código novo.")
            rc, _, cmd = _rodar_lista(cfg["reconstruir"], raiz, cfg.get("timeout_reconstruir_min", 30), log)
            if rc != 0:
                print(f"::error::reconstrução com o código novo falhou ({' '.join(cmd)}); publicação retida")
                return 1
            reprovados = _testar(cfg, raiz, log)
            if reprovados:
                print("::error::testes reprovaram a composição com o código novo: "
                      + ", ".join(t["teste"] for t in reprovados) + "; publicação retida")
                return 1
            repo.preparar(existentes)
            if repo.git("diff", "--cached", "--quiet", check=False).returncode != 0:
                repo.git("commit", "-q", "--amend", "--no-edit")
            base = remoto
        if repo.git("push", "-q", "origin", f"HEAD:{ramo}", check=False).returncode == 0:
            print(f"Publicado em {ramo}: {repo.head()[:12]}")
            return 0
        print(f"push falhou (tentativa {tentativa}); nova tentativa em {espera * tentativa}s")
        time.sleep(espera * tentativa)
    print(f"::error::não foi possível publicar após {tentativas} tentativas")
    return 1


# --------------------------------------------------------------------------- linha de comando

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="acao", required=True)
    c = sub.add_parser("ciclo")
    c.add_argument("config", type=Path)
    c.add_argument("--sem-coleta", action="store_true")
    c.add_argument("--grupos", help="ids separados por vírgula; os demais não são coletados")
    p = sub.add_parser("publicar")
    p.add_argument("config", type=Path)
    p.add_argument("--ramo", default=os.environ.get("GITHUB_REF_NAME") or "main")
    v = sub.add_parser("validar")
    v.add_argument("config", type=Path, nargs="+")
    a = ap.parse_args(argv)
    raiz = Path(os.environ.get("ATUALIZACAO_RAIZ") or RAIZ_PADRAO)
    if a.acao == "validar":
        for arq in a.config:
            carregar_config(arq)
            print(f"{arq}: válida")
        return 0
    cfg = carregar_config(a.config)
    if a.acao == "ciclo":
        try:
            return ciclo(cfg, raiz, a.sem_coleta, set(a.grupos.split(",")) if a.grupos else None)
        except Exception as e:  # noqa: BLE001 - qualquer exceção é falha de infraestrutura, nada publicado
            print(f"::error::falha de infraestrutura no ciclo: {e}")
            raise
    return publicar(cfg, raiz, a.ramo)


if __name__ == "__main__":
    sys.exit(main())
