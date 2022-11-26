export const config = {
  PORT: process.env.PORT || 3000,
  CONTAINER_NAME: process.env.CONTAINER_NAME || 'minecraft',

  // RCON config
  RCON_HOST: process.env.RCON_HOST || 'localhost',
  RCON_PORT: process.env.RCON_PORT || '25575',
  RCON_PASSWORD: process.env.RCON_PASSWORD || '',
};

export default config;
