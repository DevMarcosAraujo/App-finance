import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsCpf } from '../validators/is-cpf.validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEmail()
  email: string;

  @IsCpf()
  cpf: string;

  @IsString()
  @MinLength(8)
  senha: string;
}
