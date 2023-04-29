const semver = require('semver')
const { merge } = require('webpack-merge')

const { fatal } = require('../helpers/logger')
const getPackageJson = require('../helpers/get-package-json')
const getCallerPath = require('../helpers/get-caller-path')
const extensionJson = require('./extension-json')
const BaseAPI = require('./BaseAPI')

// for backward compatibility
function getPackageName (packageName) {
  return packageName === '@quasar/app'
    ? '@quasar/app-webpack'
    : packageName
}

/**
 * API for extension's /index.js script
 */
module.exports = class IndexAPI extends BaseAPI {
  ctx

  __hooks = {
    extendQuasarConf: [],

    extendWebpack: [],
    chainWebpackMainElectronProcess: [],
    extendWebpackMainElectronProcess: [],
    chainWebpackWebserver: [],
    extendWebpackWebserver: [],

    chainWebpack: [],
    beforeDev: [],
    afterDev: [],
    beforeBuild: [],
    afterBuild: [],
    onPublish: [],
    commands: {},
    describeApi: {}
  }

  constructor ({ ctx, ...opts }) {
    super(opts)
    this.ctx = ctx
  }

  /**
   * Get the internal persistent config of this extension.
   * Returns empty object if it has none.
   *
   * @return {object} cfg
   */
  getPersistentConf () {
    return extensionJson.getInternal(this.extId)
  }

  /**
   * Set the internal persistent config of this extension.
   * If it already exists, it is overwritten.
   *
   * @param {object} cfg
   */
  setPersistentConf (cfg) {
    extensionJson.setInternal(this.extId, cfg || {})
  }

  /**
   * Deep merge into the internal persistent config of this extension.
   * If extension does not have any config already set, this is
   * essentially equivalent to setting it for the first time.
   *
   * @param {object} cfg
   */
  mergePersistentConf (cfg = {}) {
    const currentCfg = this.getPersistentConf()
    this.setPersistentConf(merge({}, currentCfg, cfg))
  }

  /**
   * Ensure the App Extension is compatible with
   * host app package through a
   * semver condition.
   *
   * If the semver condition is not met, then
   * @quasar/app-webpack errors out and halts execution
   *
   * Example of semver condition:
   *   '1.x || >=2.5.0 || 5.0.0 - 7.2.3'
   *
   * @param {string} packageName
   * @param {string} semverCondition
   */
  compatibleWith (packageName, semverCondition) {
    const name = getPackageName(packageName)
    const json = getPackageJson(name)

    if (json === void 0) {
      fatal(`Extension(${ this.extId }): Dependency not found - ${ name }. Please install it.`)
    }

    if (!semver.satisfies(json.version, semverCondition)) {
      fatal(`Extension(${ this.extId }): is not compatible with ${ name } v${ json.version }. Required version: ${ semverCondition }`)
    }
  }

  /**
   * Check if a host app package is installed. Can also
   * check its version against specific semver condition.
   *
   * Example of semver condition:
   *   '1.x || >=2.5.0 || 5.0.0 - 7.2.3'
   *
   * @param {string} packageName
   * @param {string} [semverCondition]
   * @return {boolean} package is installed and meets optional semver condition
   */
  hasPackage (packageName, semverCondition) {
    const name = getPackageName(packageName)
    const json = getPackageJson(name)

    if (json === void 0) {
      return false
    }

    return semverCondition !== void 0
      ? semver.satisfies(json.version, semverCondition)
      : true
  }

  /**
   * Check if another app extension is installed
   * (app extension npm package is installed and it was invoked)
   *
   * @param {string} extId
   * @return {boolean} has the extension installed & invoked
   */
  hasExtension (extId) {
    return extensionJson.has(extId)
  }

  /**
   * Get the version of a host app package.
   *
   * @param {string} packageName
   * @return {string|undefined} version of app's package
   */
  getPackageVersion (packageName) {
    const name = getPackageName(packageName)
    const json = getPackageJson(name)

    return json !== void 0
      ? json.version
      : void 0
  }

  /**
   * Extend quasar.config.js
   *
   * @param {function} fn
   *   (cfg: Object, ctx: Object) => undefined
   */
  extendQuasarConf (fn) {
    this.__addHook('extendQuasarConf', fn)
  }

  /**
   * Chain webpack config
   *
   * @param {function} fn
   *   (cfg: ChainObject, invoke: Object {isClient, isServer}) => undefined
   */
  chainWebpack (fn) {
    this.__addHook('chainWebpack', fn)
  }

  /**
   * Extend webpack config
   *
   * @param {function} fn
   *   (cfg: Object, invoke: Object {isClient, isServer}) => undefined
   */
  extendWebpack (fn) {
    this.__addHook('extendWebpack', fn)
  }

  /**
   * Chain webpack config of main electron process
   *
   * @param {function} fn
   *   (cfg: ChainObject) => undefined
   */
  chainWebpackMainElectronProcess (fn) {
    this.__addHook('chainWebpackMainElectronProcess', fn)
  }

  /**
   * Extend webpack config of main electron process
   *
   * @param {function} fn
   *   (cfg: Object) => undefined
   */
  extendWebpackMainElectronProcess (fn) {
    this.__addHook('extendWebpackMainElectronProcess', fn)
  }

  /**
   * Chain webpack config of SSR webserver
   *
   * @param {function} fn
   *   (cfg: ChainObject) => undefined
   */
  chainWebpackWebserver (fn) {
    this.__addHook('chainWebpackWebserver', fn)
  }

  /**
   * Extend webpack config of SSR webserver
   *
   * @param {function} fn
   *   (cfg: Object) => undefined
   */
  extendWebpackWebserver (fn) {
    this.__addHook('extendWebpackWebserver', fn)
  }

  /**
   * Register a command that will become available as
   * `quasar run <ext-id> <cmd> [args]` and `quasar <ext-id> <cmd> [args]`
   *
   * @param {string} commandName
   * @param {function} fn
   *   ({ args: [ string, ... ], params: {object} }) => ?Promise
   */
  registerCommand (commandName, fn) {
    this.__hooks.commands[ commandName ] = fn
  }

  /**
   * Register an API file for "quasar describe" command
   *
   * @param {string} name
   * @param {string} relativePath (or node_modules reference if it starts with "~")
   *   (relative path to Api file)
   */
  registerDescribeApi (name, relativePath) {
    const callerPath = getCallerPath()

    this.__hooks.describeApi[ name ] = {
      callerPath,
      relativePath
    }
  }

  /**
   * Prepare external services before dev command runs.
   *
   * @param {function} fn
   *   (api, { quasarConf }) => ?Promise
   */
  beforeDev (fn) {
    this.__addHook('beforeDev', fn)
  }

  /**
   * Run hook after Quasar dev server is started ($ quasar dev).
   * At this point, the dev server has been started and is available
   * should you wish to do something with it.
   *
   * @param {function} fn
   *   (api, { quasarConf }) => ?Promise
   */
  afterDev(fn) {
    this.__addHook('afterDev', fn)
  }

  /**
   * Run hook before Quasar builds app for production ($ quasar build).
   * At this point, the distributables folder hasn't been created yet.
   *
   * @param {function} fn
   *   (api, { quasarConf }) => ?Promise
   */
  beforeBuild (fn) {
    this.__addHook('beforeBuild', fn)
  }

  /**
   * Run hook after Quasar built app for production ($ quasar build).
   * At this point, the distributables folder has been created and is available
   * should you wish to do something with it.
   *
   * @param {function} fn
   *   (api, { quasarConf }) => ?Promise
   */
  afterBuild (fn) {
    this.__addHook('afterBuild', fn)
  }

  /**
   * Run hook if publishing was requested ("$ quasar build -P"),
   * after Quasar built app for production and the afterBuild
   * hook (if specified) was executed.
   *
   * @param {function} fn
   *   ({ arg, ...}) => ?Promise
   *      * arg - argument supplied to "--publish"/"-P" parameter
   *      * quasarConf - quasar.config.js config object
   *      * distDir - folder where distributables were built
   */
  onPublish (fn) {
    this.__addHook('onPublish', fn)
  }
}
