import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Senhas com scrypt do node:crypto — sem dependência externa.
 * Formato armazenado: "scrypt:N:r:p:saltHex:hashHex" (autodescritivo,
 * permitindo endurecer parâmetros no futuro sem invalidar hashes antigos).
 * A senha em claro NUNCA é logada nem persistida.
 */

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
// maxmem precisa comportar 128 * N * r bytes (padrão do Node é 32 MiB).
const MAX_MEM = 128 * SCRYPT_N * SCRYPT_R * 2;

async function derive(plain: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return scrypt(plain, salt, KEY_BYTES, { N, r, p, maxmem: 128 * N * r * 2 });
}

/** Gera "scrypt:N:r:p:saltHex:hashHex" com salt aleatório de 16 bytes. */
export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < PASSWORD_MIN_LENGTH || plain.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Senha fora dos limites (${PASSWORD_MIN_LENGTH}..${PASSWORD_MAX_LENGTH} caracteres).`,
    );
  }
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(plain, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("hex"), hash.toString("hex")].join(":");
}

/**
 * Verifica a senha contra o valor armazenado com timingSafeEqual.
 * Retorna false para stored null/undefined/malformado — nunca lança
 * (falha de autenticação, não erro de servidor).
 */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || typeof plain !== "string" || plain.length === 0) return false;
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || (N & (N - 1)) !== 0 || r < 1 || p < 1 || 128 * N * r > MAX_MEM) return false;
  if (!/^[0-9a-f]+$/i.test(parts[4]) || !/^[0-9a-f]+$/i.test(parts[5])) return false;
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  try {
    const actual = await scrypt(plain, salt, expected.length, { N, r, p, maxmem: MAX_MEM });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
