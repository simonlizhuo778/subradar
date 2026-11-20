import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * 用户 AI API Key 的静态加密:AES-256-GCM。
 * 主密钥来自环境变量 MASTER_KEY(64 位 hex = 32 字节),与数据库分离存储。
 * 密文格式:base64(iv) : base64(authTag) : base64(ciphertext)
 */

function masterKey(): Buffer {
  const hex = process.env.MASTER_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('MASTER_KEY 未配置或格式不正确(需要 64 位 hex 字符,32 字节)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('密文格式不正确');
  }
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/** 掩码展示:sk-abcd****wxyz */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return '****';
  return `${plain.slice(0, 6)}****${plain.slice(-4)}`;
}
