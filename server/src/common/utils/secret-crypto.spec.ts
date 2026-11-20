import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, maskSecret } from './secret-crypto';

// vitest 不加载 .env;测试没有真实主密钥时用占位值(仅测试进程内生效)
process.env.MASTER_KEY ??= 'a'.repeat(64);

describe('secret-crypto(AES-256-GCM)', () => {
  it('加解密回路:密文可还原,且不等于明文', () => {
    const plain = 'sk-test-1234567890abcdef';
    const cipher = encryptSecret(plain);
    expect(cipher).not.toContain(plain);
    expect(cipher.split(':')).toHaveLength(3);
    expect(decryptSecret(cipher)).toBe(plain);
  });

  it('每次加密产生不同 IV(密文不同)', () => {
    expect(encryptSecret('same-input')).not.toBe(encryptSecret('same-input'));
  });

  it('密文被篡改时解密失败(GCM 认证)', () => {
    const cipher = encryptSecret('sk-abc');
    const parts = cipher.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from('tampered!').toString('base64')}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('掩码:保留头尾,中间打码', () => {
    expect(maskSecret('sk-abcdwxyz1234')).toBe('sk-ab****1234');
    expect(maskSecret('short')).toBe('****');
  });

  it('中文 Key 也能正确处理', () => {
    const plain = '密钥-包含中文-123';
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it('MASTER_KEY 长度不合法时给出明确错误', () => {
    const original = process.env.MASTER_KEY;
    process.env.MASTER_KEY = 'too-short';
    try {
      expect(() => encryptSecret('x')).toThrow(/MASTER_KEY/);
    } finally {
      process.env.MASTER_KEY = original;
    }
  });
});
