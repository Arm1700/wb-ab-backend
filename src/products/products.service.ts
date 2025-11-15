import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { WbService } from '../wb/wb.service'
import { WbExportService } from '../wb/wb-export.service'

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private wb: WbService,
    private wbExportService: WbExportService,
  ) {}

  async list(userId: string, params: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(params?.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize || 20)))
    const where: any = { userId }
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
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          _count: { select: { skus: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ])

    const since = new Date()
    since.setDate(since.getDate() - 7)

    const safeItems = await Promise.all(items.map(async (p: any) => {
      // Aggregate last 7 days metrics
      const agg = await this.prisma.productMetric.aggregate({
        where: { productId: p.id, date: { gte: since } },
        _sum: { openCount: true, cartCount: true, orders: true, buyoutCount: true },
      })
      const stats = {
        openCount: agg._sum.openCount ?? 0,
        cartCount: agg._sum.cartCount ?? 0,
        orderCount: agg._sum.orders ?? 0,
        buyoutCount: agg._sum.buyoutCount ?? 0,
      }
      const preview = Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : undefined
      return {
        id: p.id,
        nmId: p?.nmId != null ? String(p.nmId) : p?.nmId,
        title: p?.name ?? undefined,
        name: p?.name ?? undefined,
        brand: p?.brand ?? undefined,
        vendorCode: p?.vendorCode ?? undefined,
        subjectName: p?.subjectName ?? undefined,
        updatedAt: p?.updatedAt,
        syncedAt: p?.syncedAt ?? undefined,
        syncStatus: p?.syncStatus ?? undefined,
        skuCount: p?._count?.skus ?? 0,
        // Frontend-friendly extras
        preview,
        stats,
      }
    }))

    return { items: safeItems, total, page, pageSize }
  }

  async syncWithWildberries(userId: string) {
    try {
      console.info('[Products][syncWithWildberries] start', { userId })
      // Fetch all cards using cursor-based pagination to mirror curl behavior
      const startedAt = Date.now()
      const cards: any[] = await this.wbExportService.fetchAllProducts(userId)
      console.info('[Products][syncWithWildberries] fetched cards', { count: cards.length })

      if (!cards.length) {
        console.warn('[Products][syncWithWildberries] no cards received')
        return { note: 'sandbox_404', items: [] }
      }

      let upserts = 0
      for (const card of cards) {
        const nm = card?.nmID ?? card?.nmId ?? card?.id
        if (!nm) continue
        const product = await this.prisma.product.upsert({
          where: { user_nm: { userId, nmId: BigInt(nm) } },
          update: {
            name: card.title,
            brand: card.brand,
            vendorCode: card?.vendorCode ?? undefined,
            subjectName: card?.subjectName ?? undefined,
            description: card?.description ?? undefined,
            video: card?.video ?? undefined,
            wbCreatedAt: card?.createdAt ? new Date(card.createdAt) : undefined,
            wbUpdatedAt: card?.updatedAt ? new Date(card.updatedAt) : undefined,
            // dimensions
            width: card?.dimensions?.width ?? undefined,
            height: card?.dimensions?.height ?? undefined,
            length: card?.dimensions?.length ?? undefined,
            weightBrutto: card?.dimensions?.weightBrutto ?? undefined,
            dimsIsValid: card?.dimensions?.isValid ?? undefined,
            // sync meta
            syncedAt: new Date(),
            syncStatus: 'synced',
            // raw
            rawCard: card,
            updatedAt: new Date(),
          },
          create: {
            nmId: BigInt(nm),
            name: card.title,
            brand: card.brand,
            vendorCode: card?.vendorCode ?? undefined,
            subjectName: card?.subjectName ?? undefined,
            description: card?.description ?? undefined,
            video: card?.video ?? undefined,
            wbCreatedAt: card?.createdAt ? new Date(card.createdAt) : undefined,
            wbUpdatedAt: card?.updatedAt ? new Date(card.updatedAt) : undefined,
            // dimensions
            width: card?.dimensions?.width ?? undefined,
            height: card?.dimensions?.height ?? undefined,
            length: card?.dimensions?.length ?? undefined,
            weightBrutto: card?.dimensions?.weightBrutto ?? undefined,
            dimsIsValid: card?.dimensions?.isValid ?? undefined,
            // sync meta
            syncedAt: new Date(),
            syncStatus: 'synced',
            // raw
            rawCard: card,
            userId,
          },
        })
        // Attach primary image if provided by WB payload
        const photoList: string[] = Array.isArray(card?.photos)
          ? card.photos
              .map((p: any) => p?.big || p?.c246x328 || p?.c516x688 || p?.url)
              .filter((u: any) => typeof u === 'string' && u.length > 0)
          : []
        if (photoList.length) {
          // Fetch current images once
          const existing = await this.prisma.productImage.findMany({ where: { productId: product.id } })
          const existingPrimary = existing.find(i => i.isPrimary)
          const newPrimaryUrl = photoList[0]
          if (!existingPrimary) {
            await this.prisma.productImage.create({ data: { productId: product.id, url: newPrimaryUrl, isPrimary: true } })
          } else if (existingPrimary.url !== newPrimaryUrl) {
            // Record history and update primary URL
            await this.prisma.productImageHistory.create({
              data: {
                productId: product.id,
                previousUrl: existingPrimary.url,
                newUrl: newPrimaryUrl,
                reason: 'sync',
              },
            })
            await this.prisma.productImage.update({ where: { id: existingPrimary.id }, data: { url: newPrimaryUrl } })
          }
          // Add extra images if missing
          const existingUrls = new Set(existing.map(i => i.url))
          const extras = photoList.slice(1).filter(u => !existingUrls.has(u))
          if (extras.length) {
            await this.prisma.productImage.createMany({ data: extras.map(url => ({ productId: product.id, url, isPrimary: false })) })
          }
        }
        // Upsert SKUs (sizes)
        const sizes = Array.isArray(card?.sizes) ? card.sizes : []
        if (sizes.length) {
          for (const s of sizes) {
            const chrtID = s?.chrtID != null ? BigInt(s.chrtID) : null
            const sku = Array.isArray(s?.skus) && s.skus.length ? String(s.skus[0]) : undefined
            if (chrtID != null) {
              // Upsert by (productId, chrtID) unique
              await this.prisma.productSku.upsert({
                where: { productId_chrtID: { productId: product.id, chrtID } },
                update: { techSize: s?.techSize ?? undefined, wbSize: s?.wbSize ?? undefined, sku },
                create: { productId: product.id, chrtID, techSize: s?.techSize ?? undefined, wbSize: s?.wbSize ?? undefined, sku },
              } as any)
            }
          }
        }
        // Replace characteristics with incoming
        const characteristics = Array.isArray(card?.characteristics) ? card.characteristics : []
        await this.prisma.productCharacteristic.deleteMany({ where: { productId: product.id } })
        if (characteristics.length) {
          await this.prisma.productCharacteristic.createMany({
            data: characteristics.map((c: any) => ({
              productId: product.id,
              charId: typeof c?.id === 'number' ? c.id : null,
              name: c?.name ?? null,
              value: c?.value ?? null,
            })),
          })
        }
        upserts++
      }
      const ms = Date.now() - startedAt
      console.info('[Products][syncWithWildberries] upserted products', { upserts, durationMs: ms })
      return { note: 'ok', count: cards.length }
    } catch (error: any) {
      const msg = error?.message || String(error)
      console.error('[Products][syncWithWildberries] WB sync error:', msg, { details: error?.response?.data })
      // Graceful fallback for any WB content error (missing/invalid token, network, etc.)
      return { note: 'sandbox_404', items: [] }
    }
  }

  async getOne(userId: string, nmIdParam: string) {
    const nmId = BigInt(nmIdParam)
    const p = await this.prisma.product.findFirst({
      where: { userId, nmId },
      include: {
        images: true,
        skus: true,
        characteristics: true,
      },
    })
    if (!p) return { notFound: true }
    const photos = (p.images || []).map((img: any) => ({ url: img.url }))
    const sizes = (p.skus || []).map((s: any) => ({ chrtID: s.chrtID != null ? String(s.chrtID) : undefined, techSize: s.techSize, wbSize: s.wbSize, skus: s.sku ? [s.sku] : [] }))
    const characteristics = (p.characteristics || []).map((c: any) => ({ id: c.charId, name: c.name, value: c.value }))
    return {
      id: p.id,
      nmID: p.nmId != null ? String(p.nmId) : undefined,
      title: p.name,
      brand: p.brand,
      vendorCode: p.vendorCode,
      subjectName: p.subjectName,
      description: p.description,
      video: p.video,
      needKiz: (p.rawCard as any)?.needKiz ?? undefined,
      dimensions: {
        width: p.width,
        height: p.height,
        length: p.length,
        weightBrutto: p.weightBrutto,
        isValid: p.dimsIsValid ?? undefined,
      },
      photos,
      sizes,
      characteristics,
      tags: (p.rawCard as any)?.tags ?? undefined,
      createdAt: p.wbCreatedAt ?? undefined,
      updatedAt: p.wbUpdatedAt ?? undefined,
      syncedAt: p.syncedAt ?? undefined,
      syncStatus: p.syncStatus ?? undefined,
      rawCard: p.rawCard ?? undefined,
    }
  }

  async syncFromWb(userId: string) {
    // Prefer WB cards/list (as user confirmed it works), fallback to goods/filter
    let res: any
    try {
      res = await this.wb.postContentCardsList(userId, { sort: { cursor: { limit: 100 } }, filter: {} })
    } catch (e) {
      // Try older endpoints if cards/list is unavailable in the environment
      res = await this.wb.postContentGoodsFilter(userId, {})
    }
    if ((res as any)?.note === 'sandbox_404') {
      const count = await this.prisma.product.count({ where: { userId } })
      if (count === 0) {
        // seed 2 demo products
        const p1 = await this.prisma.product.create({ data: { userId, nmId: BigInt(10000001), name: 'Demo Product A', brand: 'DemoBrand' } })
        const p2 = await this.prisma.product.create({ data: { userId, nmId: BigInt(10000002), name: 'Demo Product B', brand: 'DemoBrand' } })
        await this.prisma.productImage.createMany({ data: [
          { productId: p1.id, url: 'https://via.placeholder.com/300x300.png?text=Demo+A', isPrimary: true },
          { productId: p2.id, url: 'https://via.placeholder.com/300x300.png?text=Demo+B', isPrimary: true },
        ] })
        return { createdDemo: true, note: 'sandbox_demo_products_created' }
      }
      return { createdDemo: false, note: 'sandbox_404' }
    }

    // Normalize various possible response shapes
    const r: any = res
    const goods = (
      Array.isArray(r?.data) ? r.data :
      Array.isArray(r) ? r :
      Array.isArray(r?.items) ? r.items :
      Array.isArray(r?.cards) ? r.cards :
      Array.isArray(r?.data?.cards) ? r.data.cards :
      []
    )
    if (!Array.isArray(goods)) return { updated: 0 }

    let updated = 0
    for (const g of goods) {
      const nm = g?.nmID ?? g?.nmId ?? g?.id
      if (!nm) continue
      const nmId = BigInt(nm)
      const name: string | undefined = g?.name ?? g?.title
      const brand: string | undefined = g?.brand
      const product = await this.prisma.product.upsert({
        where: { user_nm: { userId, nmId } },
        create: { userId, nmId, name, brand },
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
