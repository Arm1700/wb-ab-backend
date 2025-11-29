import { IsArray, IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator'

export class UpdateAbTestDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  viewsPerStep?: number

  @IsOptional()
  @IsBoolean()
  autoTopUp?: boolean

  @IsOptional()
  @IsInt()
  @IsPositive()
  topUpThreshold?: number

  @IsOptional()
  @IsInt()
  @IsPositive()
  topUpAmount?: number

  @IsOptional()
  @IsArray()
  @MaxLength(10, { each: false })
  @IsString({ each: true })
  photoUrls?: string[]
}
