import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class AbVariantInput {
  @IsString()
  @IsNotEmpty()
  variantKey!: string // 'A' | 'B'

  @IsString()
  @IsNotEmpty()
  imageUrl!: string
}

export class CreateAbTestDto {
  @IsString()
  @IsNotEmpty()
  productId!: string

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsInt()
  @Min(1)
  threshold: number = 1500

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbVariantInput)
  variants!: AbVariantInput[]
}
