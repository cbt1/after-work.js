module.exports = {
  config: {
    description: 'Path to config file',
    type: 'string',
    default: null,
    alias: 'c',
  },
  glob: {
    description: 'Glob pattern',
    default: ['test/**/*.spec.js'],
    type: 'array',
  },
  src: {
    description: 'Glob pattern for all source files',
    default: ['src/**/*.js'],
    type: 'array',
  },
  require: {
    description: 'Require path',
    default: [],
    type: 'array',
  },
  watch: {
    description: 'Watch changes',
    default: false,
    type: 'boolean',
    alias: 'w',
  },
  watchGlob: {
    description: 'Watch glob',
    default: ['src/**/*.js', 'test/**/*.spec.js'],
    type: 'array',
    alias: 'wg',
  },
  'mocha.enableTimeouts': {
    description: 'Enable timeouts',
    default: false,
    type: 'boolean',
  },
  'chrome.headless': {
    description: 'Run chrome headless',
    default: true,
    type: 'boolean',
  },
  'chrome.args': {
    description: 'Chrome flags',
    default: [],
    type: 'array',
  },
};
