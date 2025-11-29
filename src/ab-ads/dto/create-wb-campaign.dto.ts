import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateWbCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  nms!: number[]

  @IsIn(['manual', 'unified'])
  bidType!: 'manual' | 'unified'

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['search', 'recommendations'], { each: true })
  placementTypes!: ('search' | 'recommendations')[]
}
