import { isValidCpf } from './is-cpf.validator';

describe('isValidCpf', () => {
  it('accepts a valid CPF with formatting', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('accepts a valid CPF without formatting', () => {
    expect(isValidCpf('11144477735')).toBe(true);
  });

  it('rejects a CPF with a wrong check digit', () => {
    expect(isValidCpf('111.444.777-34')).toBe(false);
  });

  it('rejects a CPF with all repeated digits', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('rejects a CPF with the wrong length', () => {
    expect(isValidCpf('123')).toBe(false);
  });
});
