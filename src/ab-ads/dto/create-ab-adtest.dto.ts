import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class AbAdVariantInputDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsArray()
  @Type(() => Number)
  nmIds!: number[]

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyBudget?: number

  @IsOptional()
  @IsIn(['manual', 'unified'])
  bidType?: 'manual' | 'unified'

  @IsOptional()
  @IsArray()
  @IsIn(['search', 'recommendations'], { each: true })
  placementTypes?: ('search' | 'recommendations')[]
}

export class CreateAbAdTestDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  productId?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  budget?: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbAdVariantInputDto)
  variants!: AbAdVariantInputDto[]
}
