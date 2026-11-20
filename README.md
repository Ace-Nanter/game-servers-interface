<span align="center">

# Game servers Interface

Provides Rest API to control different game servers running on Docker

[![GitHub latest commit](https://badgen.net/github/last-commit/Ace-Nanter/game-servers-interface/main)](https://GitHub.com/Ace-Nanter/game-servers-interface/commits/main/)
[![version](https://badgen.net/github/tag/Ace-Nanter/game-servers-interface)](https://github.com/Ace-Nanter/game-servers-interface/tags)
[![license](https://badgen.net/github/license/Ace-Nanter/game-servers-interface)](https://github.com/Ace-Nanter/game-servers-interface/blob/master/LICENSE.md)

<br />

Game servers Interface is a simple service which can be used to manage a Docker hosted game server with a REST API.

<br />

</span>

## Features

- Start: starts container to start server
- Stop: stops container to stop server
- List online players

## Compatible games

| Game       | Status / Start / Stop        | List online players    |
| ---------- | ---------------------------- | ---------------------- |
| Minecraft  | Docker socket or RCON        | RCON                   |
| Palworld   | Docker socket or RCON        | RCON                   |
| Ark        | Docker socket or RCON        | RCON                   |
| Enshrouded | Docker socket only (no RCON) | A2S query + server log |

The Enshrouded dedicated server exposes no RCON channel at all: status, start and
stop are driven through the Docker socket. Player data comes from two other
channels:

- `GET /enshrouded/players/count` answers `{ "online": <n>, "max": <n> }` by
  querying the server with the A2S ("Source Engine Query") UDP protocol on its
  game port (default `15637`);
- `GET /enshrouded/players` answers with the names of the currently connected
  players, rebuilt from the server log file (the server answers the A2S_PLAYER
  query with empty player names, so the log is the only source for the names).

Without `ENSHROUDED_LOG_PATH`, `GET /enshrouded/players` answers
`501 Not Implemented` with an explicit message pointing to
`GET /enshrouded/players/count`.

## How to use

- Build Docker image
- Run Docker image with the following environment variables set. `[GAME]` can be `MINECRAFT`, `PALWORLD`, `ARK` or `ENSHROUDED`:

  - **`PORT`** - Port on which should run your API
  - **`ENABLE_DOCKER_CLIENT`** - Enable access to Docker socket to check container status
  - **`DOCKER_STOP_TIMEOUT_SECONDS`** - Time (in seconds) Docker lets a container stop gracefully before sending SIGKILL
    (default `120`). Keep it at least as long as the game server's `stop_grace_period`, so a server saving its world or
    running its backup on shutdown is not killed mid-way
  - **`[GAME]_CONTAINER_NAME`** - ID or Name given to your game server Docker container
  - **`[GAME]_RCON_HOST`** - IP address of your RCON server (Minecraft, Palworld and Ark only, Enshrouded has no RCON)
  - **`[GAME]_RCON_PORT`** - Port used for you RCON server (Minecraft, Palworld and Ark only)
  - **`[GAME]_RCON_PASSWORD`** - RCON server password (if one is needed; Minecraft, Palworld and Ark only)

  Enshrouded only needs `ENSHROUDED_CONTAINER_NAME` (plus `ENABLE_DOCKER_CLIENT`). Player data uses:

  - **`ENSHROUDED_QUERY_HOST`** - Host (IP or Docker network DNS name) of the Enshrouded server to query with
    the A2S UDP protocol (defaults to `ENSHROUDED_CONTAINER_NAME`)
  - **`ENSHROUDED_QUERY_PORT`** - UDP game port used by the A2S query (default `15637`)
  - **`ENSHROUDED_QUERY_TIMEOUT_MS`** - Timeout of each A2S attempt in milliseconds (default `3000`)
  - **`ENSHROUDED_LOG_PATH`** - Path of `enshrouded_server.log` inside this container, to enable
    `GET /enshrouded/players`. Mount the game server's log file **read-only** (`:ro`), e.g.
    `- /path/to/enshrouded/logs/enshrouded_server.log:/logs/enshrouded_server.log:ro` then set
    `ENSHROUDED_LOG_PATH=/logs/enshrouded_server.log`. Without it the player count still works.

## About

Feel free to ask through an issue if you need me to build images to DockerHub.

Built with [NestJS](https://nestjs.com)
