import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { WbService } from '../wb/wb.service'

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService, private wb: WbService) {}

  async list(params: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(params?.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize || 20)))
    const where: any = {}
    if (params?.search) {
      const s = params.search.trim()
      const num = Number(s)
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { brand: { contains: s, mode: 'insensitive' } },
        ...(Number.isFinite(num) ? [{ nmId: BigInt(num) }] : []),
      ]
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ])
    const safeItems = items.map((p: any) => ({ ...p, nmId: p?.nmId != null ? String(p.nmId) : p?.nmId }))
    return { items: safeItems, total, page, pageSize }
  }

  async syncFromWb(userId: string) {
    // Try WB goods/filter; if sandbox_404, insert demo when DB empty
    const res = await this.wb.postContentGoodsFilter(userId, {})
    if ((res as any)?.note === 'sandbox_404') {
      const count = await this.prisma.product.count()
      if (count === 0) {
        // seed 2 demo products
        const p1 = await this.prisma.product.create({ data: { nmId: BigInt(10000001), name: 'Demo Product A', brand: 'DemoBrand' } })
        const p2 = await this.prisma.product.create({ data: { nmId: BigInt(10000002), name: 'Demo Product B', brand: 'DemoBrand' } })
        await this.prisma.productImage.createMany({ data: [
          { productId: p1.id, url: 'https://via.placeholder.com/300x300.png?text=Demo+A', isPrimary: true },
          { productId: p2.id, url: 'https://via.placeholder.com/300x300.png?text=Demo+B', isPrimary: true },
        ] })
        return { createdDemo: true, note: 'sandbox_demo_products_created' }
      }
      return { createdDemo: false, note: 'sandbox_404' }
    }

    const goods = Array.isArray((res as any)?.data) ? (res as any).data : (Array.isArray(res) ? res : ((res as any)?.items || []))
    if (!Array.isArray(goods)) return { updated: 0 }

    let updated = 0
    for (const g of goods) {
      const nm = g?.nmID ?? g?.nmId ?? g?.id
      if (!nm) continue
      const nmId = BigInt(nm)
      const name: string | undefined = g?.name ?? g?.title
      const brand: string | undefined = g?.brand
      const product = await this.prisma.product.upsert({
        where: { nmId },
        create: { nmId, name, brand },
        update: { name, brand },
      })
      // Optional: handle images if present in payload
      const pics: string[] = Array.isArray(g?.photos) ? g.photos.map((p: any) => p?.big ?? p?.url).filter(Boolean) : []
      if (pics.length) {
        // ensure at least the first image is primary
        const first = pics[0]
        const existingPrimary = await this.prisma.productImage.findFirst({ where: { productId: product.id, isPrimary: true } })
        if (!existingPrimary) {
          await this.prisma.productImage.create({ data: { productId: product.id, url: first, isPrimary: true } })
        }
      }
      updated++
    }

    return { updated }
  }
}
