import { Socket, createSocket } from 'dgram';

/**
 * Minimal client for Valve's A2S ("Source Engine Query") UDP protocol, built on
 * the native `dgram` module (no extra dependency).
 *
 * Used for Enshrouded servers, which expose no RCON: A2S_INFO gives the live
 * player count (`players` / `maxPlayers`), while the player names are recovered
 * from the server log file (see EnshroudedService).
 */

export interface A2SInfo {
  protocol: number;
  name: string;
  map: string;
  folder: string;
  game: string;
  appId: number;
  players: number;
  maxPlayers: number;
  bots: number;
  serverType: string;
  environment: string;
  visibility: boolean;
  vac: boolean;
  version: string;
}

export type UdpSocketFactory = () => Socket;

const defaultUdpSocketFactory: UdpSocketFactory = () => createSocket('udp4');

const A2S_HEADER = 0xffffffff;
const A2S_INFO_REQUEST = 0x54; // 'T'
const A2S_INFO_RESPONSE = 0x49; // 'I'
const A2S_CHALLENGE_RESPONSE = 0x41; // 'A'
const SOURCE_ENGINE_QUERY = 'Source Engine Query\0';

// Note on A2S_PLAYER (0x55 'U' request, 0x44 'D' response): the Enshrouded
// server does answer it with the expected number of entries, but EVERY returned
// player name is empty (verified live on the real server). It is therefore
// useless for a player list and is deliberately not implemented here; the names
// are recovered from the server log instead (see EnshroudedService).

export function buildA2SInfoRequest(challenge?: Buffer): Buffer {
  const request = Buffer.concat([
    Buffer.from([0xff, 0xff, 0xff, 0xff, A2S_INFO_REQUEST]),
    Buffer.from(SOURCE_ENGINE_QUERY, 'ascii'),
  ]);

  return challenge ? Buffer.concat([request, challenge]) : request;
}

/**
 * Reads the fixed-size and null-terminated string fields of an A2S packet,
 * failing with an explicit "malformed response" error when truncated.
 */
class BufferReader {
  private readonly buffer: Buffer;
  private offset: number;

  constructor(buffer: Buffer, offset = 0) {
    this.buffer = buffer;
    this.offset = offset;
  }

  readByte(field: string): number {
    this.assertAvailable(1, field);

    return this.buffer[this.offset++];
  }

  readUInt16LE(field: string): number {
    this.assertAvailable(2, field);
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;

    return value;
  }

  readString(field: string): string {
    const end = this.buffer.indexOf(0, this.offset);
    if (end === -1) {
      throw new Error(`Malformed A2S response: unterminated string (${field})`);
    }

    const value = this.buffer.subarray(this.offset, end).toString('utf8');
    this.offset = end + 1;

    return value;
  }

  private assertAvailable(bytes: number, field: string): void {
    if (this.offset + bytes > this.buffer.length) {
      throw new Error(`Malformed A2S response: truncated ${field}`);
    }
  }
}

/**
 * Parses a full A2S_INFO response packet (`ffffffff 49 ...`).
 *
 * Layout: header(4) + type `I`(1) + protocol(1) + name(str0) + map(str0) +
 * folder(str0) + game(str0) + app id(2 LE) + players(1) + maxPlayers(1) +
 * bots(1) + serverType(1) + environment(1) + visibility(1) + vac(1) +
 * version(str0) + EDF(1) + optional extra data.
 */
export function parseA2SInfoResponse(payload: Buffer): A2SInfo {
  if (payload.length < 5 || payload.readUInt32BE(0) !== A2S_HEADER) {
    throw new Error('Malformed A2S response: missing 0xffffffff packet header');
  }

  if (payload[4] !== A2S_INFO_RESPONSE) {
    throw new Error(`Malformed A2S response: unexpected response type 0x${payload[4].toString(16)}`);
  }

  const reader = new BufferReader(payload, 5);

  return {
    protocol: reader.readByte('protocol'),
    name: reader.readString('name'),
    map: reader.readString('map'),
    folder: reader.readString('folder'),
    game: reader.readString('game'),
    appId: reader.readUInt16LE('app id'),
    players: reader.readByte('players'),
    maxPlayers: reader.readByte('max players'),
    bots: reader.readByte('bots'),
    serverType: String.fromCharCode(reader.readByte('server type')),
    environment: String.fromCharCode(reader.readByte('environment')),
    visibility: reader.readByte('visibility') !== 0,
    vac: reader.readByte('VAC') !== 0,
    version: reader.readString('version'),
  };
}

/**
 * Sends an A2S_INFO query and resolves with the parsed server info.
 *
 * The server first answers with a 4-byte challenge (`ffffffff 41 <challenge>`):
 * the same request suffixed with those 4 bytes must be re-sent before the real
 * `ffffffff 49` info response arrives. This challenge round-trip is mandatory
 * (observed live on the Enshrouded server).
 *
 * `timeoutMs` applies to each attempt; a total of 2 attempts are made before
 * the timeout error is thrown. A malformed response is NOT retried: it fails
 * immediately with its explicit error.
 */
export async function queryA2SInfo(
  host: string,
  port: number,
  options?: { timeoutMs?: number; socketFactory?: UdpSocketFactory },
): Promise<A2SInfo> {
  const timeoutMs = options?.timeoutMs ?? 3000;
  const socketFactory = options?.socketFactory ?? defaultUdpSocketFactory;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await attemptA2SInfo(host, port, timeoutMs, socketFactory);
    } catch (error) {
      lastError = error;
      // UDP packets can be lost: only the timeout is worth a second attempt.
      if (!(error instanceof Error) || !error.message.startsWith('A2S query timed out')) {
        break;
      }
    }
  }

  throw lastError;
}

async function attemptA2SInfo(
  host: string,
  port: number,
  timeoutMs: number,
  socketFactory: UdpSocketFactory,
): Promise<A2SInfo> {
  return new Promise<A2SInfo>((resolve, reject) => {
    const socket = socketFactory();
    let timer: ReturnType<typeof setTimeout>;
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.close();
      reject(error);
    };

    const succeed = (info: A2SInfo): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(info);
    };

    timer = setTimeout(
      () => fail(new Error(`A2S query timed out after ${timeoutMs}ms (host ${host}:${port})`)),
      timeoutMs,
    );

    socket.on('error', (error) => fail(new Error(`A2S query failed on ${host}:${port}: ${error.message}`)));

    socket.on('message', (message: Buffer) => {
      try {
        if (isChallengeResponse(message)) {
          socket.send(buildA2SInfoRequest(extractChallenge(message)), port, host);
          return;
        }
        succeed(parseA2SInfoResponse(message));
      } catch (error) {
        fail(error as Error);
      }
    });

    socket.send(buildA2SInfoRequest(), port, host, (error) => {
      if (error) {
        fail(new Error(`A2S query could not be sent to ${host}:${port}: ${error.message}`));
      }
    });
  });
}

function isChallengeResponse(payload: Buffer): boolean {
  return payload.length >= 9 && payload.readUInt32BE(0) === A2S_HEADER && payload[4] === A2S_CHALLENGE_RESPONSE;
}

function extractChallenge(payload: Buffer): Buffer {
  return Buffer.from(payload.subarray(5, 9));
}
