import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAbTestDto } from './dto/create-abtest.dto'
import { WbService } from '../wb/wb.service'

@Injectable()
export class AbTestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wbService: WbService,
  ) {}

  async create(dto: CreateAbTestDto) {
    if (!dto.variants || dto.variants.length < 2) {
      throw new BadRequestException('At least two variants are required')
    }
    // Ensure product exists
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } })
    if (!product) throw new NotFoundException('Product not found')

    const ab = await this.prisma.abTest.create({
      data: {
        productId: dto.productId,
        name: dto.name,
        threshold: dto.threshold ?? 1500,
        status: 'running',
        variants: {
          create: dto.variants.map(v => ({ variantKey: v.variantKey, imageUrl: v.imageUrl })),
        },
      },
      include: { variants: true },
    })
    return ab
  }

  async start(id: string) {
    return this.prisma.abTest.update({ where: { id }, data: { status: 'running' } })
  }

  async pause(id: string) {
    return this.prisma.abTest.update({ where: { id }, data: { status: 'paused' } })
  }

  async stop(id: string) {
    return this.prisma.abTest.update({ where: { id }, data: { status: 'finished' } })
  }

  // Rotate primary image to next variant and write ProductImageHistory
  async rotate(abTestId: string, userId: string) {
    const ab = await this.prisma.abTest.findUnique({
      where: { id: abTestId },
      include: { product: true, variants: { orderBy: { variantKey: 'asc' } } },
    })
    if (!ab) throw new NotFoundException('A/B test not found')
    if (ab.status !== 'running') throw new BadRequestException('Test is not running')

    // Determine current primary and next variant
    const currentPrimary = await this.prisma.productImage.findFirst({
      where: { productId: ab.productId, isPrimary: true },
    })

    // Simple rotation strategy: pick next variant not equal to currentPrimary.url
    const currentUrl = currentPrimary?.url || null
    const variants = ab.variants
    if (variants.length < 2) throw new BadRequestException('Not enough variants to rotate')
    const idx = variants.findIndex(v => v.imageUrl === currentUrl)
    const nextVariant = idx >= 0 ? variants[(idx + 1) % variants.length] : variants[0]

    const previousUrl = currentUrl || ''
    const newUrl = nextVariant.imageUrl

    // Upsert ProductImage records and switch primary
    // 1) mark all as not primary
    await this.prisma.productImage.updateMany({ where: { productId: ab.productId, isPrimary: true }, data: { isPrimary: false } })
    // 2) ensure image record exists for newUrl
    let target = await this.prisma.productImage.findFirst({ where: { productId: ab.productId, url: newUrl } })
    if (!target) {
      target = await this.prisma.productImage.create({ data: { productId: ab.productId, url: newUrl, isPrimary: true } })
    } else {
      await this.prisma.productImage.update({ where: { id: target.id }, data: { isPrimary: true } })
    }

    // 3) write history
    await this.prisma.productImageHistory.create({
      data: {
        productId: ab.productId,
        previousUrl: previousUrl,
        newUrl: newUrl,
        changedByUserId: userId,
        reason: 'ab-test',
      },
    })

    // 4) Try to update WB primary image via Content API (placeholder)
    try {
      await this.wbService.setPrimaryImage(userId, { nmId: String(ab.product.nmId), imageUrl: newUrl })
    } catch (e) {
      // Log but don't fail rotation persistence
    }

    return { success: true, previousUrl, newUrl }
  }
}
