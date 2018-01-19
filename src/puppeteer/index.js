/* eslint no-console: 0, max-len: 0, import/no-unresolved: 0, global-require: 0, import/no-dynamic-require: 0, import/no-extraneous-dependencies: 0, object-curly-newline: 0, class-methods-use-this: 0 */
const readline = require('readline');
const globby = require('globby');
const Mocha = require('mocha');
const chokidar = require('chokidar');
const importCwd = require('import-cwd');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const chromeFinder = require('chrome-launcher/chrome-finder');
const options = require('./options');
const utils = require('../terminal-utils');

process.on('unhandledRejection', (err) => {
  console.error(`Promise Rejection:${err}`);
});

class Runner extends EventEmitter {
  constructor(argv, libs) {
    super();
    this.argv = argv;
    this.testFiles = [];
    this.onlyTestFiles = [];
    this.srcFiles = [];
    this.onlySrcFiles = [];
    this.mochaRunner = undefined;
    this.mocha = undefined;
    this.isWrapped = false;
    this.isRunning = false;
    this.all = true;
    this.libs = libs;
    this.debugging = false;
  }
  log(mode, testFiles, srcFiles) {
    if (this.debugging) {
      return this;
    }
    console.log(`${mode}`);
    console.log('  test');
    testFiles.forEach((f) => {
      console.log(`    \u001b[90m${f}\u001b[0m`);
    });
    console.log('  src');
    srcFiles.forEach((f) => {
      console.log(`    \u001b[90m${f}\u001b[0m`);
    });
    console.log('\nSave\u001b[90m a test file or source file to run only affected tests\u001b[0m');
    console.log('\u001b[90mPress\u001b[0m a \u001b[90mto run all tests\u001b[0m');
    return this;
  }
  logLine(msg) {
    if (this.argv.outputReporterOnly) {
      return;
    }
    utils.writeLine(msg);
  }
  logClearLine() {
    if (this.argv.outputReporterOnly) {
      return;
    }
    utils.clearLine();
  }
  matchDependency(found, testName) {
    let use = found;
    if (found.length > 1) {
      const matchName = found.filter(id => path.basename(id).split('.').shift() === testName);
      if (matchName.length === 1) {
        use = matchName;
      } else {
        use = found.splice(0, 1);
      }
    }
    return use;
  }
  safeDeleteCache(f) {
    if (require.cache[f]) {
      delete require.cache[f];
    }
  }
  safeRequireCache(f) {
    try {
      require(`${f}`);
      return require.cache[f];
    } catch (_) { } //eslint-disable-line
    return { children: [] };
  }
  setOnlyFilesFromTestFile(testFile) {
    const testName = path.basename(testFile).split('.').shift();
    this.safeDeleteCache(testFile);
    const mod = this.safeRequireCache(testFile);
    const found = mod
      .children
      .filter(m => this.srcFiles.indexOf(m.id) !== -1)
      .map(m => m.id);
    const use = this.matchDependency(found, testName);
    this.onlyTestFiles = [testFile];
    this.onlySrcFiles = [...new Set([...use])];
  }
  setOnlyFilesFromSrcFile(srcFile) {
    const srcName = path.basename(srcFile).split('.').shift();
    const found = this.testFiles.filter((f) => {
      const mod = this.safeRequireCache(f);
      return mod
        .children
        .filter(m => m.id === srcFile).length !== 0;
    });
    const use = this.matchDependency(found, srcName);
    this.onlyTestFiles = [...new Set([...use])];
    this.onlySrcFiles = [srcFile];
  }
  setTestFiles() {
    this.testFiles = globby.sync(this.argv.glob).map(f => path.resolve(f));
    if (!this.testFiles.length) {
      console.log('No files found for:', this.argv.glob);
      this.exit(true, 1);
    }
    return this;
  }
  setSrcFiles() {
    this.srcFiles = globby.sync(this.argv.src).map(f => path.resolve(f));
    return this;
  }
  require() {
    this.argv.require.forEach(m => this.libs.importCwd(m));
    return this;
  }
  onFinished(failures) {
    this.isRunning = false;
    this.exit(false, failures);
  }
  onEnd() {
    if (this.argv.watch) {
      const mode = this.all ? 'All' : 'Only';
      const testFiles = this.all ? [`${this.argv.glob}`] : this.onlyTestFiles;
      const srcFiles = this.all ? [`${this.argv.src}`] : this.onlySrcFiles;
      this.log(mode, testFiles, srcFiles);
    }
  }
  runTests() {
    this.isRunning = true;
    this.mochaRunner = this.mocha.run(failures => this.onFinished(failures));
    this.mochaRunner.on('start', () => this.logClearLine());
    this.mochaRunner.on('end', () => this.onEnd());
  }
  setupKeyPress() {
    if (!this.argv.watch) {
      return this;
    }
    if (typeof process.stdin.setRawMode !== 'function') {
      return this;
    }
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.on('keypress', (str) => {
      if (str === '\u0003') {
        this.exit(true, 0);
      }
      if (this.isRunning) {
        return;
      }
      switch (str) {
        case 'a':
          this.all = true;
          this.setupAndRunTests(this.testFiles, this.srcFiles);
          break;
        default: break;
      }
    });
    return this;
  }
  setup(testFiles, srcFiles) {
    srcFiles.forEach(f => this.safeDeleteCache(f));
    testFiles.forEach((f) => {
      this.safeDeleteCache(f);
      this.mocha.addFile(f);
    });
    return this;
  }
  async close() {
    await global.browser.close();
  }
  async setupAndRunTests(testFiles, srcFiles) {
    const pages = await browser.pages();
    for (let i = 0; i < pages.length; i += 1) {
      await pages[i].close(); //eslint-disable-line
    }
    global.page = await browser.newPage();
    process.removeAllListeners();
    if (this.mochaRunner) {
      this.mochaRunner.removeAllListeners();
    }
    this.mocha = new this.libs.Mocha(this.argv.mocha);
    this.mocha.suite.on('pre-require', (_, file) => {
      this.logLine(`Loading ${file}`);
    });
    try {
      this
        .setup(testFiles, srcFiles)
        .runTests();
    } catch (err) {
      this.isRunning = false;
      console.log(err);
      if (this.argv.watch) {
        return;
      }
      this.exit(false, 1);
    }
  }
  onWatchAdd(f) {
    const base = path.basename(f);
    const parts = base.split('.');
    if (parts.length > 1) {
      this.testFiles.push(f);
    } else {
      this.srcFiles.push(f);
    }
  }
  onWatchUnlink(f) {
    const tIx = this.testFiles.indexOf(f);
    const sIx = this.srcFiles.indexOf(f);
    if (tIx !== -1) {
      this.testFiles.splice(tIx, 1);
    }
    if (sIx !== -1) {
      this.srcFiles.splice(sIx, 1);
    }
    this.safeDeleteCache(f);
  }
  onWatch(f) {
    if (this.isRunning) {
      return;
    }
    const isTestFile = this.testFiles.indexOf(f) !== -1;
    const isSrcFile = this.srcFiles.indexOf(f) !== -1;
    if (!isTestFile && !isSrcFile) {
      return;
    }
    this.all = false;
    if (isTestFile) {
      this.setOnlyFilesFromTestFile(f);
    } else {
      this.setOnlyFilesFromSrcFile(f);
    }
    this.setupAndRunTests(this.onlyTestFiles, this.onlySrcFiles);
  }
  getChromePath() {
    return chromeFinder[process.platform]();
  }
  async run() {
    const chromePath = await this.getChromePath().pop();
    this.argv.chrome.executablePath = chromePath;
    global.browser = await this.libs.puppeteer.launch(this.argv.chrome);
    this.setupAndRunTests(this.testFiles, this.srcFiles);
    if (this.argv.watch) {
      this.libs.chokidar.watch(this.argv.watchGlob, { ignoreInitial: true })
        .on('change', f => this.onWatch(path.resolve(f)))
        .on('add', f => this.onWatchAdd(path.resolve(f)))
        .on('unlink', f => this.onWatchUnlink(path.resolve(f)));
    }
  }
  autoDetectDebug() {
    const exv = process.execArgv.join();
    const debug = exv.includes('inspect') || exv.includes('debug');
    if (debug) {
      this.argv.mocha.enableTimeouts = false;
      this.debugging = true;
    }
    return this;
  }
  async exit(force, code) {
    if (!force && this.argv.watch) {
      return;
    }
    await global.browser.close();
    this.emit('exit', code);
  }
}

const puppet = {
  Runner,
  command: ['puppeteer', 'puppet'],
  desc: 'Run tests with puppeteer',
  builder(yargs) {
    return yargs
      .options(options)
      .config('config', (configPath) => {
        if (configPath === null) {
          return {};
        }
        if (!fs.existsSync(configPath)) {
          throw new Error(`Config ${configPath} not found`);
        }
        let config = {};
        const foundConfig = require(configPath);
        if (typeof foundConfig === 'function') {
          config = Object.assign({}, foundConfig());
        } else {
          config = Object.assign({}, foundConfig);
        }
        return config;
      });
  },
  handler(argv) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (_) {
      console.log('Could not load puppeteer');
      const p = `${path.resolve(process.cwd())}/node_modules/puppeteer`;
      console.log(`Trying: ${p}`);
      try {
        puppeteer = require(p);
      } catch (__) {
        console.log('Puppeteer could not be found by after-work.js! Please verify that it has been added as a devDependencies in your package.json');
        process.exit(false, 1);
      }
    }
    const runner = new puppet.Runner(argv, { puppeteer, Mocha, importCwd, chokidar });
    runner.on('exit', code => process.exit(code));
    runner
      .autoDetectDebug()
      .setupKeyPress()
      .setTestFiles()
      .setSrcFiles()
      .require()
      .run();
  },
};

module.exports = puppet;
