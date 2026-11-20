import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import config from 'src/config';
import { EnshroudedService } from '../services/enshrouded.service';

@Controller('enshrouded')
export class EnshroudedController {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly enshroudedService: EnshroudedService) {}

  @Get('status')
  async getServerStatus(): Promise<string> {
    return await this.enshroudedService.getServerStatus();
  }

  @Get('players')
  async getPlayersOnline(): Promise<string[]> {
    return await this.enshroudedService.getPlayersOnline();
  }

  @Get('players/count')
  async getPlayerCount(): Promise<{ online: number; source: 'webhook'; lastEventAt: string | null }> {
    return await this.enshroudedService.getPlayerCount();
  }

  @Post('start')
  @HttpCode(204)
  async startContainer(): Promise<void> {
    return this.enshroudedService.startServer();
  }

  @Post('stop')
  @HttpCode(204)
  async stopContainer(): Promise<void> {
    return this.enshroudedService.stopServer();
  }

  /** Webhook endpoint posted by the game image when no token is configured. */
  @Post('webhook')
  @HttpCode(202)
  handleWebhook(@Body() payload: unknown): void {
    if (this.webhookToken() !== '') {
      throw new HttpException(
        'Enshrouded webhook requires a token: POST /enshrouded/webhook/<token>',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.enshroudedService.handleWebhookPayload(payload);
  }

  /** Webhook endpoint posted by the game image when a token is configured. */
  @Post('webhook/:token')
  @HttpCode(202)
  handleWebhookWithToken(@Param('token') token: string, @Body() payload: unknown): void {
    const expected = this.webhookToken();
    if (expected === '') {
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }

    if (!this.tokensMatch(token, expected)) {
      throw new HttpException('Invalid Enshrouded webhook token', HttpStatus.UNAUTHORIZED);
    }

    this.enshroudedService.handleWebhookPayload(payload);
  }

  private webhookToken(): string {
    return config.enshrouded.webhook_token;
  }

  /** Constant-time comparison: both tokens are hashed so lengths never leak. */
  private tokensMatch(provided: string, expected: string): boolean {
    const providedDigest = createHash('sha256').update(provided).digest();
    const expectedDigest = createHash('sha256').update(expected).digest();

    return timingSafeEqual(providedDigest, expectedDigest);
  }
}
