import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateWbTokenDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  token: string;
}
