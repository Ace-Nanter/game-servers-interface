export const config = {
  PORT: process.env.PORT || 3000,
  ENABLE_DOCKER_CLIENT: process.env.ENABLE_DOCKER_CLIENT == 'true' || false,

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
};

export default config;
