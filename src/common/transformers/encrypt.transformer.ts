import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ValueTransformer } from 'typeorm';
import { getEnvOrThrow } from '../utils/env';
export interface EncryptTransformerOptions {
  algorithm?: string;
  ivLength?: number;
  key: string;
}

export class EncryptTransformer implements ValueTransformer {
  constructor(private options: EncryptTransformerOptions) {
    this.options = { algorithm: 'aes-256-cbc', ivLength: 16, ...options };
  }

  public from(value?: Buffer | null): string | undefined {
    if (!value) {
      return;
    }
    const { algorithm, key, ivLength } = this
      .options as Required<EncryptTransformerOptions>;
    const data = value;
    const iv = data.subarray(0, ivLength);
    const decipher = createDecipheriv(algorithm, key, iv);
    const start = decipher.update(data.subarray(ivLength));
    const final = decipher.final();
    return Buffer.concat([start, final]).toString('utf8');
  }

  public to(value?: string | null): Buffer | undefined {
    if (!value) {
      return;
    }

    const { algorithm, key, ivLength } = this
      .options as Required<EncryptTransformerOptions>;
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, key, iv);
    const start = cipher.update(value);
    const end = cipher.final();
    return Buffer.concat([iv, start, end]);
  }
}

const defaultEncryptTransformer = new EncryptTransformer({
  key: getEnvOrThrow('DB_ENCRYPTION_KEY'),
});
export default defaultEncryptTransformer;
