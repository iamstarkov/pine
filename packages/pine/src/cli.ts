import { camelCaseToDash, isObject } from '@pinefile/utils';
import { parse, options, ArgumentsType } from './args';
import { runTask } from './task';
import { findFile, findDirname } from './file';
import * as logger from './logger';
import { configure, ConfigType } from './config';

/**
 * Print help text.
 */
const help = (): void => {
  const opts = options();
  const keys = Object.keys(opts).map((key) => ({
    key,
    flag: camelCaseToDash(key),
  }));

  const len =
    keys.reduce((c, v) => (c.flag.length > v.flag.length ? c : v)).flag.length +
    2;
  console.log(`Usage: pine <task> <options>

Options:`);
  keys.forEach((key) => {
    let space = '';

    for (let i = 0; i < len - key.flag.length; i++) {
      space += ' ';
    }

    console.log(`  --${key.flag}${space}${opts[key.key].desc}`);
  });
};

/**
 * Print tasks from Pinefile.
 *
 * @param {string} file
 */
const printTasks = (file: string) => {
  try {
    // eslint-disable-next-line
    const obj = require(file);
    const keys = Object.keys(obj);

    console.log('\nTasks:');

    keys.sort((a, b) => a.localeCompare(b));
    keys.forEach((key) => {
      console.log(`  ${key}`);
    });
  } catch (err) {
    // todo
  }
};

const requireFiles = (args: ArgumentsType) => {
  const req = ((Array.isArray(args.requires)
    ? args.requires
    : [args.requires]) as Array<string>).filter((r) => r);
  req.forEach(require);
};

const getDefaultEnvironment = (args: ArgumentsType): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};

  // turn on colors by default
  if (!args.noColor) {
    env.FORCE_COLOR = '1';
  }

  return env;
};

export const runCLI = async (argv: Array<any>): Promise<any> => {
  try {
    const args = parse(argv);
    const pineFile = findFile(args.file);

    configure((config: ConfigType) => ({
      ...config,
      dotenv: args.noDotenv ? [] : ['.env'],
      env: {
        ...getDefaultEnvironment(args),
        ...config.env,
      },
      path: findDirname(pineFile),
    }));

    requireFiles(args);

    // eslint-disable-next-line
    let pineModule = require(pineFile);
    pineModule = isObject(pineModule.default) ? pineModule.default : pineModule;

    const name = args._.shift() || 'default';

    if (args.help) {
      help();
      printTasks(pineFile);
      return;
    }

    return await runTask(pineModule, name, args);
  } catch (err) {
    logger.error(err);
    return;
  }
};
