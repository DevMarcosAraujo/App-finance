import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWorkspaceDto } from './create-workspace.dto';

describe('CreateWorkspaceDto', () => {
  it('accepts INDIVIDUAL', async () => {
    const dto = plainToInstance(CreateWorkspaceDto, { tipo: 'INDIVIDUAL' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts FAMILIA', async () => {
    const dto = plainToInstance(CreateWorkspaceDto, { tipo: 'FAMILIA' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid tipo', async () => {
    const dto = plainToInstance(CreateWorkspaceDto, { tipo: 'ENTERPRISE' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tipo')).toBe(true);
  });
});
