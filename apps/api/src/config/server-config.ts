export type ServerEnvironment = {
  PORT?: string;
  API_PORT?: string;
  API_HOST?: string;
};

const configuredValue = (...values: Array<string | undefined>) =>
  values.find((value) => value?.trim())?.trim();

export const resolveServerAddress = (
  environment: ServerEnvironment = process.env,
) => {
  const rawPort =
    configuredValue(environment.PORT, environment.API_PORT) ?? '4000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `Server port must be an integer between 1 and 65535; received ${rawPort}`,
    );
  }

  return {
    port,
    host: configuredValue(environment.API_HOST) ?? '0.0.0.0',
  };
};
