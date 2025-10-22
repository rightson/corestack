import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class AESCrypto {
  private static getKey(): Buffer {
    const key = process.env.SSH_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      throw new Error('SSH_ENCRYPTION_KEY must be a 64-character hex string');
    }
    return Buffer.from(key, 'hex');
  }

  static encrypt(text: string): string {
    if (!text) return '';

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.getKey();

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';

    const [ivHex, encryptedData] = encryptedText.split(':');
    if (!ivHex || !encryptedData) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const key = this.getKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
