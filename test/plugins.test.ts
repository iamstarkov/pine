import fs from 'fs';

describe('plugins', () => {
  const log = console.log;
  let run;

  beforeEach(() => {
    jest.resetModules();
    console.log = jest.fn();
    run = require('../src').run;
  });

  afterEach(() => {
    console.log = log;
  });

  it('should run pinefile with built in plugins', () => {
    const file = `--file=${__dirname}/fixtures/pinefile.plugins.builtin.js`;
    const tests = [
      {
        task: 'pkg',
        test: () => {
          expect(console.log).toHaveBeenCalledWith('pkg: 1.0.0');
        },
      },
      {
        task: 'readJSON',
        test: () => {
          expect(console.log).toHaveBeenCalledWith('readJSON: 1.0.0');
        },
      },
      {
        task: 'writeJSON',
        after: () => {
          fs.unlinkSync(`${__dirname}/fixtures/write.json`);
        },
        test: () => {
          expect(fs.existsSync(`${__dirname}/fixtures/write.json`));
        },
      },
    ];

    tests.forEach(async (test) => {
      await run([test.task, file]);
      test.before && test.before();
      test.test();
      test.after && test.after();
    });
  });

  it('should run pinefile with with custom plugins', () => {
    const tests = [
      {
        task: 'echo',
        file: 'custom',
        test: () => {
          expect(console.log).toHaveBeenCalledWith('Echo...');
        },
      },
      {
        task: 'test',
        file: 'custom',
        test: () => {
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Testing...')
          );
        },
      },
    ];

    tests.forEach((test) => {
      run([
        test.task,
        `--file=${__dirname}/fixtures/pinefile.plugins.${test.file}.js`,
      ]);
      test.test();
    });
  });

  it('should require files before run using package.json config', () => {
    jest.mock('../package.json', () => {
      return {
        pine: {
          require: ['./test/fixtures/require.js'],
        },
      };
    });
    run([`--file=${__dirname}/fixtures/pinefile.basic.js`, 'build']);
    expect(console.log).toHaveBeenCalledWith('Required...');
    expect(console.log).toHaveBeenCalledWith('Building...');
    jest.unmock('../package.json');
  });

});
