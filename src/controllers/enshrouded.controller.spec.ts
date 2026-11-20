import { HttpException, HttpStatus } from '@nestjs/common';
import config from 'src/config';
import { EnshroudedController } from './enshrouded.controller';
import { EnshroudedService, WEBHOOK_EVENTS } from '../services/enshrouded.service';

/** Runs the call and returns the HttpException it throws. */
function catchHttp(call: () => void): HttpException {
  try {
    call();
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to throw an HttpException');
}

describe('EnshroudedController (webhook endpoints)', () => {
  const handleWebhookPayload = jest.fn();
  const enshroudedService = {
    handleWebhookPayload,
  } as unknown as EnshroudedService;

  let controller: EnshroudedController;

  const initialToken = config.enshrouded.webhook_token;

  const payload = {
    notification_type: WEBHOOK_EVENTS.PLAYER_JOINED,
    message: 'Player Obélix has joined the adventure!',
    data: null,
  };

  beforeEach(() => {
    handleWebhookPayload.mockReset().mockImplementation(() => undefined);

    config.enshrouded.webhook_token = '';
    controller = new EnshroudedController(enshroudedService);
  });

  afterAll(() => {
    config.enshrouded.webhook_token = initialToken;
  });

  describe('POST /enshrouded/webhook (tokenless route)', () => {
    it('accepts and forwards the payload when no token is configured', () => {
      expect(() => controller.handleWebhook(payload)).not.toThrow();
      expect(handleWebhookPayload).toHaveBeenCalledWith(payload);
    });

    it('answers 401 when a token is configured', () => {
      config.enshrouded.webhook_token = 'secret-token';

      expect(catchHttp(() => controller.handleWebhook(payload)).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(handleWebhookPayload).not.toHaveBeenCalled();
    });
  });

  describe('POST /enshrouded/webhook/:token (token route)', () => {
    it('answers 404 when no token is configured', () => {
      config.enshrouded.webhook_token = '';

      expect(catchHttp(() => controller.handleWebhookWithToken('anything', payload)).getStatus()).toBe(
        HttpStatus.NOT_FOUND,
      );
      expect(handleWebhookPayload).not.toHaveBeenCalled();
    });

    it('answers 401 when the token does not match', () => {
      config.enshrouded.webhook_token = 'secret-token';

      expect(catchHttp(() => controller.handleWebhookWithToken('wrong-token', payload)).getStatus()).toBe(
        HttpStatus.UNAUTHORIZED,
      );
      expect(handleWebhookPayload).not.toHaveBeenCalled();
    });

    it('accepts the payload when the token matches', () => {
      config.enshrouded.webhook_token = 'secret-token';

      expect(() => controller.handleWebhookWithToken('secret-token', payload)).not.toThrow();
      expect(handleWebhookPayload).toHaveBeenCalledWith(payload);
    });
  });

  describe('token comparison', () => {
    it('rejects a very long wrong token the same way (constant-time hashing)', () => {
      config.enshrouded.webhook_token = 'secret-token';

      expect(catchHttp(() => controller.handleWebhookWithToken('x'.repeat(4096), payload)).getStatus()).toBe(
        HttpStatus.UNAUTHORIZED,
      );
    });
  });
});
