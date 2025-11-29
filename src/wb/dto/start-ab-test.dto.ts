import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsPositive, IsString } from 'class-validator'

export class StartAbTestDto {
  @IsInt()
  @IsPositive()
  campaignId!: number

  @IsInt()
  @IsPositive()
  nmId!: number

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  photoUrls!: string[]

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
}
