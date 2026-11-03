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

| Game       | Status / Start / Stop        | List online players |
| ---------- | ---------------------------- | ------------------- |
| Minecraft  | Docker socket or RCON        | RCON                |
| Palworld   | Docker socket or RCON        | RCON                |
| Ark        | Docker socket or RCON        | RCON                |
| Enshrouded | Docker socket only (no RCON) | Not supported       |

The Enshrouded dedicated server exposes no RCON channel at all: status, start and
stop are driven through the Docker socket, and there is no way to list the online
players. `GET /enshrouded/players` therefore answers `501 Not Implemented` with an
explicit message instead of a misleading empty list.

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

  Enshrouded only needs `ENSHROUDED_CONTAINER_NAME` (plus `ENABLE_DOCKER_CLIENT`).

## About

Feel free to ask through an issue if you need me to build images to DockerHub.

Built with [NestJS](https://nestjs.com)
