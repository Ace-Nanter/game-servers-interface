import { Socket } from 'dgram';
import {
  A2SInfo,
  buildA2SInfoRequest,
  parseA2SInfoResponse,
  queryA2SInfo,
  UdpSocketFactory,
} from './steam-query.utils';

// Real A2S_INFO response captured live on the actual (empty) Enshrouded server:
// name "Le serveur d'Obélix", empty map, game "Enshrouded", 0/10 players,
// version 0.0.15.0.
const INFO_RESPONSE_HEX =
  'ffffffff49114c6520736572766575722064274f62c3a96c69780000456e7368726f7564656400456e7368726f75646564000000000a00646c0100302e302e31352e3000b1153d0c10d9505bcd4001343b313238373336393b313b303b313b313b313b303b3000a45d120000000000';

class FakeUdpSocket {
  sent: Buffer[] = [];
  closed = false;
  // `Function` keeps the fake free of typed callback signatures: this project's
  // eslint config runs the core no-unused-vars rule, which flags unused
  // parameters even inside type annotations.
  private messageListener?: Function;
  private errorListener?: Function;

  send(buffer: Buffer, port: number, address: string, callback?: Function): void {
    this.sent.push(Buffer.from(buffer));
    if (callback) {
      callback(null, buffer.length);
    }
  }

  on(event: string, listener: Function): this {
    if (event === 'message') {
      this.messageListener = listener;
    } else {
      this.errorListener = listener;
    }

    return this;
  }

  close(): void {
    this.closed = true;
  }

  emitMessage(payload: Buffer): void {
    if (this.messageListener) {
      this.messageListener(payload, { address: '10.0.0.2', family: 'IPv4', port: 15637 });
    }
  }

  emitError(error: Error): void {
    if (this.errorListener) {
      this.errorListener(error);
    }
  }
}

function makeSocketFactory(sockets: FakeUdpSocket[]): UdpSocketFactory {
  return () => {
    const socket = new FakeUdpSocket();
    sockets.push(socket);

    return socket as unknown as Socket;
  };
}

describe('steam-query.utils', () => {
  describe('buildA2SInfoRequest', () => {
    it('builds the plain A2S_INFO request', () => {
      expect(Buffer.from(buildA2SInfoRequest()).toString('hex')).toBe(
        'ffffffff54' + Buffer.from('Source Engine Query\0', 'ascii').toString('hex'),
      );
    });

    it('suffixes the request with the 4 challenge bytes when given', () => {
      const challenge = Buffer.from([0x11, 0x22, 0x33, 0x44]);
      const request = buildA2SInfoRequest(challenge);

      expect(request.length).toBe(buildA2SInfoRequest().length + 4);
      expect(request.subarray(-4).equals(challenge)).toBe(true);
    });
  });

  describe('parseA2SInfoResponse', () => {
    it('parses the real Enshrouded server response', () => {
      const info = parseA2SInfoResponse(Buffer.from(INFO_RESPONSE_HEX, 'hex'));

      const expected: A2SInfo = {
        protocol: 0x11,
        name: "Le serveur d'Obélix",
        map: '',
        folder: 'Enshrouded',
        game: 'Enshrouded',
        appId: 0,
        players: 0,
        maxPlayers: 10,
        bots: 0,
        serverType: 'd',
        environment: 'l',
        visibility: true,
        vac: false,
        version: '0.0.15.0',
      };
      expect(info).toEqual(expected);
    });

    it('rejects a response without the 0xffffffff header', () => {
      expect(() => parseA2SInfoResponse(Buffer.from('0000000049', 'hex'))).toThrow(
        'Malformed A2S response: missing 0xffffffff packet header',
      );
    });

    it('rejects a truncated response', () => {
      const full = Buffer.from(INFO_RESPONSE_HEX, 'hex');

      expect(() => parseA2SInfoResponse(full.subarray(0, 6))).toThrow('Malformed A2S response');
    });

    it('rejects an unexpected response type', () => {
      const payload = Buffer.from(INFO_RESPONSE_HEX, 'hex');
      payload[4] = 0x44; // 'D' (A2S_PLAYER response)

      expect(() => parseA2SInfoResponse(payload)).toThrow('unexpected response type 0x44');
    });
  });

  describe('queryA2SInfo', () => {
    it('performs the mandatory challenge round-trip then parses the info response', async () => {
      const sockets: FakeUdpSocket[] = [];
      const socketFactory = makeSocketFactory(sockets);

      const promise = queryA2SInfo('enshrouded-server', 15637, { socketFactory });
      const socket = sockets[0];
      const expectation = expect(promise).resolves.toMatchObject({
        name: "Le serveur d'Obélix",
        players: 0,
        maxPlayers: 10,
      });

      socket.emitMessage(Buffer.from('ffffffff4111223344', 'hex')); // challenge
      socket.emitMessage(Buffer.from(INFO_RESPONSE_HEX, 'hex')); // info
      await expectation;

      expect(socket.sent.length).toBe(2);
      expect(socket.sent[0].toString('hex')).toBe(buildA2SInfoRequest().toString('hex'));
      expect(socket.sent[1].toString('hex')).toBe(
        buildA2SInfoRequest(Buffer.from([0x11, 0x22, 0x33, 0x44])).toString('hex'),
      );
      expect(socket.closed).toBe(true);
    });

    it('retries once after a timeout and fails with an explicit error', async () => {
      const sockets: FakeUdpSocket[] = [];
      const socketFactory = makeSocketFactory(sockets); // sockets never answer

      await expect(queryA2SInfo('enshrouded-server', 15637, { timeoutMs: 10, socketFactory })).rejects.toThrow(
        'A2S query timed out after 10ms (host enshrouded-server:15637)',
      );
      expect(sockets.length).toBe(2); // two attempts
      expect(sockets.every((socket) => socket.closed)).toBe(true);
    });

    it('rejects when the response is malformed', async () => {
      const sockets: FakeUdpSocket[] = [];
      const socketFactory = makeSocketFactory(sockets);

      const promise = queryA2SInfo('enshrouded-server', 15637, { socketFactory });
      const socket = sockets[0];
      const expectation = expect(promise).rejects.toThrow('Malformed A2S response');

      socket.emitMessage(Buffer.from('garbage'));
      await expectation;

      expect(socket.closed).toBe(true);
    });

    it('rejects when the socket errors', async () => {
      const sockets: FakeUdpSocket[] = [];
      const socketFactory = makeSocketFactory(sockets);

      const promise = queryA2SInfo('enshrouded-server', 15637, { socketFactory });
      const expectation = expect(promise).rejects.toThrow('A2S query failed on enshrouded-server:15637: network down');

      sockets[0].emitError(new Error('network down'));
      await expectation;
    });
  });
});
