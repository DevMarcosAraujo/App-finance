import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authResult = {
    usuario: { id: '1', nome: 'Marcos', email: 'a@a.com', cpf: '11144477735' },
    accessToken: 'access',
    refreshToken: 'refresh',
  };

  const buildController = () => {
    const authService = {
      register: jest.fn().mockResolvedValue(authResult),
      login: jest.fn().mockResolvedValue(authResult),
      refresh: jest.fn().mockResolvedValue({
        accessToken: 'access2',
        refreshToken: 'refresh2',
      }),
      logout: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;

    return { controller: new AuthController(authService), authService };
  };

  it('delegates register to AuthService', async () => {
    const { controller, authService } = buildController();
    const dto = {
      nome: 'Marcos',
      email: 'a@a.com',
      cpf: '11144477735',
      senha: 'password123',
    };

    const result = await controller.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(authResult);
  });

  it('delegates login to AuthService', async () => {
    const { controller, authService } = buildController();
    const dto = { email: 'a@a.com', senha: 'password123' };

    const result = await controller.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(authResult);
  });

  it('delegates refresh to AuthService with the raw token', async () => {
    const { controller, authService } = buildController();

    const result = await controller.refresh({ refreshToken: 'refresh' });

    expect(authService.refresh).toHaveBeenCalledWith('refresh');
    expect(result).toEqual({
      accessToken: 'access2',
      refreshToken: 'refresh2',
    });
  });

  it('delegates logout to AuthService with the raw token', async () => {
    const { controller, authService } = buildController();

    await controller.logout({ refreshToken: 'refresh' });

    expect(authService.logout).toHaveBeenCalledWith('refresh');
  });

  it('returns the current user for me', () => {
    const { controller } = buildController();
    const user = {
      id: '1',
      nome: 'Marcos',
      email: 'a@a.com',
      cpf: '11144477735',
      criadoEm: new Date(),
    };

    expect(controller.me(user)).toBe(user);
  });
});
