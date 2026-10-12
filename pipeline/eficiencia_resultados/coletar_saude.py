"""Replay the two recorded public TabNet read-only queries into a separate cache."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request
from .saude_municipal import ROOT, SEED, parse_table


def acquire(cache):
    cache = Path(cache); cache.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((SEED/'manifest.json').read_bytes())
    cities = json.loads((ROOT/'src/lib/eficiencia/panorama-atlas.json').read_bytes())['cities']
    results = []
    for source in manifest['sources']:
        query = source['query']
        body = urllib.parse.urlencode([tuple(pair) for pair in query['params']], encoding='latin1').encode('ascii')
        request = urllib.request.Request(query['url'], data=body, headers={'Accept-Encoding': 'identity'})
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000: raise ValueError('Tabulation exceeds expected response size')
        if raw[:2] == b'\x1f\x8b': raw = gzip.decompress(raw)
        html = raw.decode('latin1')
        rows = parse_table(html, cities, source['system'])
        target = cache/source['versioned_file']
        target.write_bytes(html.encode('utf-8'))
        results.append({'system': source['system'], 'capitals': len(rows), 'file': str(target),
                        'raw_sha256': hashlib.sha256(raw).hexdigest(),
                        'snapshot_sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    # New acquisitions do not overwrite the frozen seed, reference or scores.
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--cache', required=True)
    args = parser.parse_args(); print(json.dumps(acquire(args.cache), ensure_ascii=False, indent=2))
