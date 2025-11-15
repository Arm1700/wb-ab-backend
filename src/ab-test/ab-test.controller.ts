import { Body, Controller, Get, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common'
import { Public } from '../common/decorators/public.decorator'
import { FilesInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import * as path from 'path'
import * as fs from 'fs'
import { Response } from 'express'
import { ABTestService } from './ab-test.service'

@Controller('ab-test')
export class ABTestController {
  constructor(private readonly service: ABTestService) {}

  // Ensure photos dir exists at startup; use project-relative path to avoid writing to '/'
  private static readonly PHOTOS_DIR = (() => {
    const dir = path.resolve(process.cwd(), 'photos')
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    } catch (e) {
      // If creation fails, keep the previous behavior but will error on upload
      console.error('[ABTestController] Failed to ensure photos dir', { dir, error: (e as any)?.message })
    }
    return dir
  })()

  @Public()
  @Post('start')
  @UseInterceptors(FilesInterceptor('photos', 5, {
    storage: diskStorage({
      destination: ABTestController.PHOTOS_DIR,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
        const raw = (path.parse(file.originalname || '').name || 'photo').toLowerCase()
        // basic ru->en transliteration map
        const map: Record<string, string> = {
          а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
        }
        const translit = raw.split('').map(ch => map[ch] ?? ch).join('')
        const ascii = translit
          .normalize('NFD').replace(/\p{Diacritic}+/gu, '')
          .replace(/[^a-z0-9._-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          || 'photo'
        const safe = `${ascii}-${Date.now()}${ext}`
        cb(null, safe)
      },
    }),
    limits: { files: 5 }
  }))
  start(
    @UploadedFiles() files: Array<{ filename: string }>,
    @Query('nmId') nmIdQ?: string,
    @Body('nmId') nmIdB?: string,
    @Body('threshold') thresholdB?: number,
  ) {
    const nmRaw = nmIdQ ?? nmIdB
    const nm = nmRaw ? Number(nmRaw) : undefined
    const thr = typeof thresholdB === 'string' ? Number(thresholdB) : thresholdB
    return this.service.start(files, nm, thr)
  }

  @Public()
  @Get('status')
  status(@Query('nmId') nmIdQ?: string) {
    const nm = nmIdQ ? Number(nmIdQ) : undefined
    return this.service.getStatus(nm)
  }

  @Public()
  @Post('stop')
  stop() {
    return this.service.stop()
  }

  @Public()
  @Post('next')
  next() {
    return this.service.next()
  }

  @Public()
  @Post('threshold')
  threshold(@Body('threshold') val: number) {
    return this.service.setThreshold(Number(val))
  }

  @Public()
  @Post('check-now')
  async checkNow() {
    await this.service.checkAndSwitch()
    return this.service.getStatus()
  }

  @Public()
  @Get('photo/:name')
  photo(@Param('name') name: string, @Res() res: Response) {
    const dir = ABTestController.PHOTOS_DIR
    const clean = decodeURIComponent((name || '').split('?')[0])
    if (!/^[A-Za-z0-9._-]+$/.test(clean)) return res.status(400).send('Invalid name')
    if (!fs.existsSync(path.join(dir, clean))) return res.status(404).send('Not found')
    res.sendFile(clean, { root: dir })
  }
}
