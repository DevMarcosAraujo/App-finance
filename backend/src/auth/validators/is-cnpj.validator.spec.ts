import { isValidCnpj } from './is-cnpj.validator';

describe('isValidCnpj', () => {
  it('accepts a valid CNPJ with formatting', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('accepts a valid CNPJ without formatting', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejects a CNPJ with a wrong check digit', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
  });

  it('rejects a CNPJ with all repeated digits', () => {
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
  });

  it('rejects a CNPJ with the wrong length', () => {
    expect(isValidCnpj('123')).toBe(false);
  });
});
