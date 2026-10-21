import 'server-only';
import snapshot from '../../../public/agro/gold/snapshot.json';
import geometria from '../../../public/energia/geo/uf.json';
import type { SnapshotAgro } from './tipos';
export const dadosAgro = snapshot as unknown as SnapshotAgro;
export const malhaAgro = geometria;
