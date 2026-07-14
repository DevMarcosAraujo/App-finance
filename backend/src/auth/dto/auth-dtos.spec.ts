import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { RefreshDto } from './refresh.dto';

describe('RegisterDto', () => {
  const valid = {
    nome: 'Marcos',
    email: 'marcos@example.com',
    cpf: '111.444.777-35',
    senha: 'password123',
  };

  it('accepts a valid payload', async () => {
    const dto = plainToInstance(RegisterDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(RegisterDto, { ...valid, email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects an invalid cpf', async () => {
    const dto = plainToInstance(RegisterDto, { ...valid, cpf: '111.444.777-34' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'cpf')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const dto = plainToInstance(RegisterDto, { ...valid, senha: '1234567' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'senha')).toBe(true);
  });
});

describe('LoginDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'marcos@example.com',
      senha: 'password123',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty senha', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'marcos@example.com',
      senha: '',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'senha')).toBe(true);
  });
});

describe('RefreshDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(RefreshDto, { refreshToken: 'some-token' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty refreshToken', async () => {
    const dto = plainToInstance(RefreshDto, { refreshToken: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
  });
});
