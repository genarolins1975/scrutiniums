"""Cópia durável do bronze vigente, fora do cache, em assets menores que 2 GB.

Guarda um superset dos recursos usados pelas golds: a última vintage disponível de
cada (dataset, recurso) em cada silver. Não modifica bancos nem aumenta data/energia.
Um manifesto referencia exatamente as partes desta geração (partes antigas da release
não são restauradas). As partes são verificadas antes de extrair qualquer arquivo.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tarfile

from pipeline.energia import base

LIMITE_ASSET = 1_900_000_000  # bytes; limite GitHub: 2 GiB por asset
MANIFESTO = "energia-bronze-manifesto.json"


def _sha(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


class _Partes:
    def __init__(self, destino, limite):
        self.destino, self.limite = Path(destino), limite
        self.arquivo, self.tamanho = None, 0
        self.nomes = []

    def write(self, bloco):
        total = len(bloco)
        while bloco:
            if self.arquivo is None or self.tamanho == self.limite:
                self.close()
                nome = f"energia-bronze.parte-{len(self.nomes):04d}"
                self.nomes.append(nome)
                self.arquivo = open(self.destino / nome, "wb")
                self.tamanho = 0
            n = min(len(bloco), self.limite - self.tamanho)
            self.arquivo.write(bloco[:n])
            self.tamanho += n
            bloco = bloco[n:]
        return total

    def close(self):
        if self.arquivo:
            self.arquivo.close()
            self.arquivo = None


class _LePartes(io.RawIOBase):
    def __init__(self, caminhos):
        self.caminhos = iter(caminhos)
        self.atual = None

    def read(self, n=-1):
        blocos = []
        while n != 0:
            if self.atual is None:
                caminho = next(self.caminhos, None)
                if caminho is None:
                    break
                self.atual = open(caminho, "rb")
            b = self.atual.read(n)
            if not b:
                self.atual.close()
                self.atual = None
                continue
            blocos.append(b)
            if n > 0:
                n -= len(b)
        return b"".join(blocos)

    def close(self):
        if self.atual:
            self.atual.close()
        super().close()


def guardar(destino, limite=LIMITE_ASSET):
    if not 0 < limite <= LIMITE_ASSET:
        raise ValueError("limite de asset inválido")
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    recursos, ausentes, externos, caminhos = [], [], [], set()
    for db in sorted(Path(base.SILVER).glob("*.db")):
        with sqlite3.connect(f"file:{db}?mode=ro", uri=True) as con:
            datasets = [r[0] for r in con.execute("SELECT DISTINCT dataset FROM vintages")]
            for ds in datasets:
                disponiveis = base.vintages_com_bronze(con, ds)
                ultimas = {v["recurso"]: v for v in base.vintages_do_dataset(con, ds)}
                for rec, ultima in ultimas.items():
                    v = disponiveis.get(rec)
                    item = {"silver": db.name, "dataset": ds, "recurso": rec,
                            "vintage_id": ultima["vintage_id"], "capturado_em": ultima["capturado_em"]}
                    if not v:
                        ausentes.append(item)
                        continue
                    arquivo = Path(base.caminho_bronze(v["arquivo"])).resolve()
                    # Só bronze local; fixtures e referências externas não entram no pacote.
                    try:
                        arquivo.relative_to(Path(base.BRONZE).resolve())
                    except ValueError:
                        externos.append({**item, "motivo": "referência fora do bronze; não incluída no pacote"})
                        continue
                    rel = arquivo.relative_to(Path(base.RAIZ).resolve()).as_posix()
                    recursos.append({**item, "vintage_id": v["vintage_id"], "arquivo": rel,
                                     "capturado_em": v["capturado_em"], "sha256": v["sha256"],
                                     "bytes": arquivo.stat().st_size})
                    caminhos.add(rel)
    partes = _Partes(destino, limite)
    try:
        with tarfile.open(fileobj=partes, mode="w|") as tar:
            for rel in sorted(caminhos):
                tar.add(Path(base.RAIZ) / rel, arcname=rel, recursive=False)
    finally:
        partes.close()
    assets = []
    for n in partes.nomes:
        sha = _sha(destino / n)
        nome = f"{n}-{sha}"
        (destino / n).rename(destino / nome)
        assets.append({"nome": nome, "bytes": (destino / nome).stat().st_size, "sha256": sha})
    # Nomes imutáveis: o manifesto anterior continua utilizável durante o upload.
    manifesto = {"versao": 1, "gerado_em": base.agora_utc(), "recursos": recursos, "ausentes": ausentes, "externos": externos,
                 "partes": assets}
    (destino / MANIFESTO).write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")
    print(f"Bronze durável: {len(caminhos)} arquivos; {len(ausentes)} recursos sem bronze; {len(partes.nomes)} assets")
    return manifesto


def restaurar(origem):
    origem = Path(origem)
    manifesto = json.loads((origem / MANIFESTO).read_text())
    if manifesto["versao"] != 1:
        raise ValueError("versão do manifesto de bronze desconhecida")
    caminhos = []
    for parte in manifesto["partes"]:
        nome = parte["nome"]
        if Path(nome).name != nome or not nome.startswith("energia-bronze.parte-"):
            raise ValueError(f"nome de parte inválido: {nome}")
        caminho = origem / nome
        if caminho.stat().st_size != parte["bytes"] or _sha(caminho) != parte["sha256"]:
            raise ValueError(f"parte de bronze inválida: {nome}")
        caminhos.append(caminho)
    extraidos = preservados = 0
    with _LePartes(caminhos) as leitor, tarfile.open(fileobj=leitor, mode="r|") as tar:
        for membro in tar:
            p = Path(membro.name)
            if (not membro.isfile() or p.is_absolute() or ".." in p.parts
                    or p.parts[:3] != ("data", "energia", "bronze")):
                raise ValueError(f"arquivo fora do bronze: {membro.name}")
            destino = Path(base.RAIZ) / p
            # O bronze é imutável: arquivo do cache com o tamanho do pacote fica como está
            # (mesmo inode). Os demais são gravados ao lado e trocados por rename atômico,
            # depois de conferido o tamanho; uma interrupção nunca deixa arquivo truncado
            # com o nome que bronze_disponivel procura.
            if destino.is_file() and destino.stat().st_size == membro.size:
                preservados += 1
                continue
            destino.parent.mkdir(parents=True, exist_ok=True)
            temporario = destino.with_name(f".{destino.name}.restaurando")
            try:
                with tar.extractfile(membro) as origem_f, open(temporario, "wb") as f:
                    shutil.copyfileobj(origem_f, f)
                if temporario.stat().st_size != membro.size:
                    raise ValueError(f"extração incompleta: {membro.name}")
                os.utime(temporario, (membro.mtime, membro.mtime))
                os.replace(temporario, destino)
            finally:
                temporario.unlink(missing_ok=True)
            extraidos += 1
    print(f"Bronze restaurado: {extraidos} arquivos extraídos; {preservados} já presentes preservados")
    return manifesto


def familias_ausentes(familias=None):
    """Cache da previsão pode conter só energia.db; preserva bancos já presentes."""
    if familias is None:
        from pipeline.energia import modulos
        familias = {m.REGISTRO["familia"] for m in modulos.descobrir()}
    return sorted(f for f in familias if not (Path(base.SILVER) / f"{f}.db").is_file())


def necessita_restaurar(origem):
    """Manifesto é pequeno: baixar as partes só se algum bronze dele estiver ausente.

    A decisão depende dos arquivos, não da chave do cache: uma chave encontrada
    pode ter vindo de previsao-pld.yml após restauração de apenas silver.
    """
    manifesto = json.loads((Path(origem) / MANIFESTO).read_text())
    if manifesto["versao"] != 1:
        raise ValueError("versão do manifesto de bronze desconhecida")
    return any(not _bronze_integro(r) for r in manifesto["recursos"])


def _bronze_integro(recurso):
    """Arquivo presente e, quando o manifesto registra o tamanho, com o tamanho empacotado:
    um bronze truncado no cache também pede a restauração (review #278)."""
    if not base.bronze_disponivel(recurso):
        return False
    return recurso.get("bytes") is None or os.path.getsize(base.caminho_bronze(recurso["arquivo"])) == recurso["bytes"]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("acao", choices=("guardar", "restaurar", "necessario"))
    p.add_argument("pasta")
    args = p.parse_args()
    if args.acao == "necessario":
        print("sim" if necessita_restaurar(args.pasta) else "nao")
    else:
        (guardar if args.acao == "guardar" else restaurar)(args.pasta)


if __name__ == "__main__":
    main()
