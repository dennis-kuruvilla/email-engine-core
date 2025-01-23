import defaultEncryptTransformer, {
  EncryptTransformer,
} from './encrypt.transformer';

describe('Encrypt transformer', () => {
  it('should encrypt strings to byte array', () => {
    expect(defaultEncryptTransformer.to('test')).toBeInstanceOf(Buffer);
  });

  it('should transform byte array to string', async () => {
    expect(
      defaultEncryptTransformer.from(defaultEncryptTransformer.to('test')),
    ).toEqual('test');
  });

  it('should encrypt the data', async () => {
    expect(defaultEncryptTransformer.to('test')).not.toEqual(
      Buffer.from('test'),
    );
  });

  it('should encrypt and decrypt consistently', async () => {
    expect(
      defaultEncryptTransformer.from(defaultEncryptTransformer.to('test')),
    ).toEqual('test');
  });

  it('should use the provided key', async () => {
    expect(defaultEncryptTransformer.to('test')).not.toEqual(
      new EncryptTransformer({ key: '9cf3da12429513e50ffcf01d7ed977a1' }).to(
        'test',
      ),
    );
  });

  it('should not be able to decrypt with wrong key', async () => {
    expect(() => {
      defaultEncryptTransformer.from(
        new EncryptTransformer({ key: '9cf3da12429513e50ffcf01d7ed977a1' }).to(
          'test',
        ),
      );
    }).toThrow();
  });
});
