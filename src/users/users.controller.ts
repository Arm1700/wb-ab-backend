import { Body, Controller, Get, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateWbTokenDto } from './dto/update-wb-token.dto';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';

@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put('wb-token')
  async updateWbToken(
    @GetCurrentUserId() userId: string,
    @Body() dto: UpdateWbTokenDto,
  ) {
    await this.usersService.setWbApiToken(userId, dto.token);
    return { success: true };
  }

  @Get('wb-token')
  async getWbTokenInfo(@GetCurrentUserId() userId: string) {
    const token = await this.usersService.getWbApiToken(userId);
    return {
      hasToken: Boolean(token),
      // do not expose full token; provide masked preview if present
      preview: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : null,
    };
  }
}
