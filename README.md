<span align="center">

# Docker Minecraft Rest API Interface

Provides Rest API to control a Minecraft server running on Docker

[![GitHub latest commit](https://badgen.net/github/last-commit/Ace-Nanter/Docker-Minecraft-RestAPI-Interface/main)](https://GitHub.com/Ace-Nanter/Docker-Minecraft-RestAPI-Interface/commits/main/)
[![version](https://badgen.net/github/tag/Ace-Nanter/Docker-Minecraft-RestAPI-Interface)](https://github.com/Ace-Nanter/Docker-Minecraft-RestAPI-Interface/tags)
[![license](https://badgen.net/github/license/Ace-Nanter/Docker-Minecraft-RestAPI-Interface)](https://github.com/Ace-Nanter/Docker-Minecraft-RestAPI-Interface/blob/master/LICENSE.md)

<br />

Docker Minecraft Rest API Interface is a simple service which can be used to manage a Docker hosted Minecraft server
with a REST API.

<br />

</span>

## Features

- Start: starts container to start Minecraft server
- Stop: stops container to stop Minecraft server
- List online players

## How to use

- Build Docker image
- Run Docker image with the following environment variables set:

  - **`PORT`** - Port on which should run your API
  - **`CONTAINER_NAME`** - ID or Name given to your Docker container serving your Minecraft server
  - **`RCON_HOST`** - IP address of your RCON server (normally the same IP than your Minecraft server)
  - **`RCON_PORT`** - Port used for you RCON server
  - **`RCON_PASSWORD`** - RCON server password (if one is needed)

## About

Feel free to ask through an issue if you need me to build images to DockerHub.

Built with [NestJS](https://nestjs.com)
