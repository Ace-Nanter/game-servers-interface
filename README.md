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

- Minecraft
- Palworld
- Ark (Coming soon, I hope)

## How to use

- Build Docker image
- Run Docker image with the following environment variables set. `[GAME]` can be either `MINECRAFT`, `PALWORD`, or `ARK`:

  - **`PORT`** - Port on which should run your API
  - **`ENABLE_DOCKER_CLIENT`** - Enable access to Docker socket to check container status
  - **`[GAME]_CONTAINER_NAME`** - ID or Name given to your game server Docker container
  - **`[GAME]_RCON_HOST`** - IP address of your RCON server
  - **`[GAME]_RCON_PORT`** - Port used for you RCON server
  - **`[GAME]_RCON_PASSWORD`** - RCON server password (if one is needed)

## About

Feel free to ask through an issue if you need me to build images to DockerHub.

Built with [NestJS](https://nestjs.com)
