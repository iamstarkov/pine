// @ts-ignore
import bach from 'bach';
import pify from 'pify';
import { isObject, merge } from '@pinefile/utils';
import { ArgumentsType } from './args';
import { PineFileType } from './file';
import { log, color, timeInSecs } from './logger';

/**
 * Converts 'b:c' keys to object { 'b': { c: '' } }
 *
 * @param {string} obj
 * @param {string} sep
 *
 * @return {object}
 */
const toObj = (obj: { [key: string]: any }, sep = ':') =>
  Object.keys(obj).reduce((prev: { [key: string]: any }, key: string) => {
    if (isObject(obj[key])) {
      prev[key] = toObj(obj[key]);
    } else if (key.indexOf(':') !== -1) {
      prev = merge(
        prev,
        key
          .split(':')
          .reverse()
          .reduce((prev2, cur2) => {
            return Object.keys(prev2).length
              ? { [cur2]: prev2 }
              : { [cur2]: obj[key] };
          }, {})
      );
    } else {
      prev[key] = obj[key];
    }
    return prev;
  }, {});

/**
 * Resolve task function by name.
 *
 * @param {string} key
 * @param {string} obj
 * @param {string} sep
 *
 * @return {function|boolean}
 */
export const resolveTask = (
  key: string,
  obj: { [key: string]: any },
  sep = ':'
): any => {
  if (obj[key]) {
    return obj[key];
  }

  const properties = (Array.isArray(key) ? key : key.split(sep)) as string[];
  const tasks = toObj(obj, sep);

  return properties.reduce((prev: any[], cur: string) => {
    return prev[cur] || false;
  }, tasks as any);
};

/**
 * Get task function name with prefix.
 *
 * @param {string} name
 * @param {string} prefix
 * @param {string} sep
 *
 * @return {string}
 */
const getFnName = (name: string, prefix = '', sep = ':'): string => {
  const names = name.split(sep);
  const lastName = names.pop();
  return names.concat(`${prefix}${lastName}`).join(sep);
};

const doneify = (fn: any, ...args: any[]) => async (done: any) => {
  try {
    await pify(fn, { excludeMain: true })(args);
    done();
  } catch (err) {
    done(err);
  }
};

/**
 * Run tasks that will be executed one after another, in sequential order.
 *
 * series('clean', 'build')
 *
 * @return {function|Promise}
 */
export const series = (...tasks: any[]): any => {
  if (typeof tasks[0] === 'function') {
    return new Promise((resolve, reject) => {
      bach.series(tasks)((err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  if (Array.isArray(tasks[0])) {
    return series(...tasks[0]);
  }

  return (pinefile: PineFileType, _: string, args: ArgumentsType) =>
    bach.series(
      ...tasks.map((task) => (cb: any) =>
        runTask(pinefile, task, args).then(cb)
      )
    );
};

/**
 * Run tasks that will be executed simultaneously.
 *
 * parallel('clean', 'build')
 *
 * @return {function|Promise}
 */
export const parallel = (...tasks: any[]): any => {
  if (typeof tasks[0] === 'function') {
    return new Promise((resolve, reject) => {
      bach.parallel(tasks)((err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  if (Array.isArray(tasks[0])) {
    return parallel(...tasks[0]);
  }

  return (pinefile: PineFileType, _: string, args: ArgumentsType) =>
    bach.parallel(
      ...tasks.map((task) => (cb: any) =>
        runTask(pinefile, task, args).then(cb)
      )
    );
};

/**
 * Execute task in pinefile object.
 *
 * @param {object} pinefile
 * @param {string} name
 * @param {array}  args
 *
 * @return {Promise}
 */
const execute = async (
  pinefile: PineFileType,
  name: string,
  args: ArgumentsType
): Promise<void> => {
  let fn = resolveTask(name, pinefile);
  let fnName = name;

  // use default function in objects.
  if (isObject(fn) && fn.default) {
    fn = fn.default;
    fnName = name !== 'default' ? `${name}:default` : 'default';
  }

  let runner: any;
  switch (fn.length) {
    case 3:
      // 3: plugin function.
      runner = fn(pinefile, name, args);
      break;
    default:
      // 1: task function.
      runner = async (done: any) => {
        try {
          await pify(fn, { excludeMain: true })(args);
          done();
        } catch (err) {
          done(err);
        }

        // execute post* function.
        const postName = getFnName(fnName, 'post');
        const postFunc = resolveTask(postName, pinefile);
        if (postFunc) {
          await execute(pinefile, postName, args);
        }
      };
      break;
  }

  // execute pre* function.
  const preName = getFnName(fnName, 'pre');
  const preFunc = resolveTask(preName, pinefile);
  if (preFunc) {
    await execute(pinefile, preName, args);
  }

  const startTime = Date.now();
  log.info(`Starting ${color.cyan(`'${name}'`)}`);

  // await for runner if Promise
  if (runner instanceof Promise) {
    runner = await runner;
  }

  // wrap runner with no arguments
  // with an callback function with
  // done function as a argument.
  if (!runner.length) {
    runner = doneify(runner);
  }

  return await runner((err: any) => {
    if (err) log.error(err);

    const time = Date.now() - startTime;

    log.info(
      `Finished ${color.cyan(`'${name}'`)} after ${color.magenta(
        timeInSecs(time)
      )}`
    );
  });
};

/**
 * Run task in pinefile.
 *
 * @param {object} pinefile
 * @param {string} name
 * @param {object} args
 *
 * @return {Promise}
 */
export const runTask = async (
  pinefile: PineFileType,
  name: string,
  args: ArgumentsType
) => {
  if (!resolveTask(name, pinefile)) {
    log.error(`Task ${color.cyan(`'${name}'`)} not found`);
    return;
  }

  return await execute(pinefile, name, args);
};
