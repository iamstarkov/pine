import stream from 'stream';
import execa, { Options } from 'execa';

const toError = (obj: any) => {
  const err = obj instanceof Error ? obj : new Error(obj);

  if (obj.shortMessage !== undefined) {
    obj.message = obj.shortMessage;
    delete obj.shortMessage;
  }

  return err;
};

export const shouldForceColor = (env: NodeJS.ProcessEnv = {}): boolean => {
  if (!Object.keys(env).length) {
    env = process.env;
  }

  if (!env.FORCE_COLOR) {
    return false;
  }

  if (env.FORCE_COLOR === 'true') {
    return true;
  }

  if (env.FORCE_COLOR === 'false') {
    return false;
  }

  return !!Math.min(parseInt(env.FORCE_COLOR, 10), 3);
};

export type ShellOptions = Options;

/**
 * Run shell command.
 *
 * @param {string} cmd
 * @param {object} opts
 *
 * @returns {Promise}
 */
export const shell = (
  cmd: string | string[] | TemplateStringsArray,
  opts: Partial<ShellOptions> = {}
): Promise<any> => {
  const s = (cmd instanceof Array ? cmd.join(' ') : cmd).split(/\s/);

  return new Promise((resolve, reject) => {
    const sp = execa(s[0], s.slice(1), {
      shell: true,
      ...opts,
      env: {
        // @ts-ignore
        FORCE_COLOR: shouldForceColor(),
        ...opts?.env,
      },
    });

    if (opts?.stdout && opts.stdout instanceof stream.Stream) {
      sp?.stdout?.pipe(opts.stdout as any);
      sp?.stderr?.pipe((opts.stderr || opts.stdout) as any);
    } else {
      sp.then((res) => resolve(res.stdout)).catch((err) =>
        reject(toError(err))
      );
    }

    sp.on('close', (code: number) => {
      if (code !== 0) {
        process.exitCode = code;
      }

      if (opts?.stdout) {
        resolve(null);
      }
    });
  });
};

/**
 * Run shell command.
 *
 * @param {string} cmd
 * @param {object} opts
 *
 * @returns {Promise}
 */
export const run = (cmd: string, opts: Partial<ShellOptions> = {}) =>
  shell(cmd, {
    ...opts,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
