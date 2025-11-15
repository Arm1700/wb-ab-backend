import { Body, Controller, Get, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateWbTokenDto } from './dto/update-wb-token.dto';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';

@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Partner token endpoints (currently reuse same storage; split later if needed)
  @Put('wb-partner-token')
  async updateWbPartnerToken(
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdateWbTokenDto,
  ) {
    await this.usersService.setWbPartnerToken(userId, dto.token);
    return { success: true };
  }

  @Get('wb-partner-token')
  async getWbPartnerTokenInfo(@GetCurrentUserId() userId: string) {
    const token = await this.usersService.getWbPartnerToken(userId);
    return {
      hasToken: Boolean(token),
      preview: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : null,
    };
  }
}
