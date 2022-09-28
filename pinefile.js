import { log, run, getConfig } from './packages/pine';
import { execRun } from './packages/monorepo';

export default {
  build: async () => {
    await run`npm run build`;
  },
  config: () => {
    const config = getConfig();
    log.info(config);
  },
  test: async (argv) => {
    await run`jest ${argv._.join(' ')}`;
  },
  tsc: async () => {
    await execRun`tsc`;
  },
};
