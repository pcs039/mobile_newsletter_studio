import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const HASH_ALGORITHM = "sha256";
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;
const HASH_PREFIX = "pbkdf2_sha256";

export function hashProjectPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM).toString("base64url");

  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyProjectPasswordHash(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) {
    return false;
  }

  const [prefix, iterationValue, salt, storedHash] = passwordHash.split("$");
  const iterations = Number(iterationValue);

  if (prefix !== HASH_PREFIX || !Number.isInteger(iterations) || !salt || !storedHash) {
    return false;
  }

  const inputHash = pbkdf2Sync(password, salt, iterations, HASH_KEY_LENGTH, HASH_ALGORITHM).toString("base64url");
  const storedBuffer = Buffer.from(storedHash);
  const inputBuffer = Buffer.from(inputHash);

  if (storedBuffer.length !== inputBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, inputBuffer);
}
