import * as CryptoJS from 'crypto-js';

export class EncryptionUtil {
  private static readonly key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

  static encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.key).toString();
  }

  static decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
