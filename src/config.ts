export const config = {
  PORT: process.env.PORT || 3000,
  ENABLE_DOCKER_CLIENT: process.env.ENABLE_DOCKER_CLIENT || false,
  CONTAINER_NAME: process.env.CONTAINER_NAME || 'minecraft',
};

export default config;
