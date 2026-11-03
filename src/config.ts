/**
 * Docker lets a container run its shutdown sequence for this many seconds
 * before sending SIGKILL (equivalent to `docker stop --timeout <seconds>`).
 * It must be at least as long as the game server's `stop_grace_period`
 * (120s for the Enshrouded stack), otherwise a server saving its world on
 * shutdown can be killed mid-backup.
 */
function getDockerStopTimeout(): number {
  const timeout = parseInt(process.env.DOCKER_STOP_TIMEOUT_SECONDS || '', 10);

  return Number.isFinite(timeout) && timeout >= 0 ? timeout : 120;
}

export const config = {
  PORT: process.env.PORT || 3000,
  ENABLE_DOCKER_CLIENT: process.env.ENABLE_DOCKER_CLIENT == 'true' || false,
  DOCKER_STOP_TIMEOUT_SECONDS: getDockerStopTimeout(),

  minecraft: {
    container_name: process.env.MINECRAFT_CONTAINER_NAME || '',
    rcon_host: process.env.MINECRAFT_RCON_HOST || '',
    rcon_port: process.env.MINECRAFT_RCON_PORT ? parseInt(process.env.MINECRAFT_RCON_PORT) : 0,
    rcon_password: process.env.MINECRAFT_RCON_PASSWORD || '',
  },
  ark: {
    container_name: process.env.ARK_CONTAINER_NAME || '',
    rcon_host: process.env.ARK_RCON_HOST || '',
    rcon_port: process.env.ARK_RCON_PORT ? parseInt(process.env.ARK_RCON_PORT) : 0,
    rcon_password: process.env.ARK_RCON_PASSWORD || '',
  },
  palworld: {
    container_name: process.env.PALWORLD_CONTAINER_NAME || '',
    rcon_host: process.env.PALWORLD_RCON_HOST || '',
    rcon_port: process.env.PALWORLD_RCON_PORT ? parseInt(process.env.PALWORLD_RCON_PORT) : 0,
    rcon_password: process.env.PALWORLD_RCON_PASSWORD || '',
  },
  // Enshrouded exposes no RCON at all: status/start/stop go through the Docker socket only.
  enshrouded: {
    container_name: process.env.ENSHROUDED_CONTAINER_NAME || '',
  },
};

export default config;
