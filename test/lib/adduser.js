const requireInject = require('require-inject')
const { test } = require('tap')
const getCredentialsByURI = require('../../lib/config/get-credentials-by-uri.js')
const setCredentialsByURI = require('../../lib/config/set-credentials-by-uri.js')

let result = ''

const _flatOptions = {
  authType: 'legacy',
  registry: 'https://registry.npmjs.org/',
  scope: ''
}

let failSave = false
let deletedConfig = {}
let setConfig = {}
const authDummy = () => Promise.resolve({
  message: 'success',
  newCreds: {
    username: 'u',
    password: 'p',
    email: 'u@npmjs.org',
    alwaysAuth: false
  }
})

const adduser = requireInject('../../lib/adduser.js', {
  npmlog: {
    disableProgress: () => null
  },
  '../../lib/npm.js': {
    flatOptions: _flatOptions,
    config: {
      del (key, where) {
        deletedConfig = {
          ...deletedConfig,
          [key]: where
        }
      },
      get (key, where) {
        if (!where || where === 'user') {
          return _flatOptions[key]
        }
      },
      getCredentialsByURI,
      save (_, cb) {
        if (failSave) {
          return cb(new Error('error saving user config'))
        }
        cb()
      },
      set (key, value, where) {
        setConfig = {
          ...setConfig,
          [key]: {
            value,
            where
          }
        }
      },
      setCredentialsByURI
    }
  },
  '../../lib/utils/output.js': msg => { result = msg },
  '../../lib/auth/legacy.js': authDummy
})

test('simple login', (t) => {
  adduser([], (err) => {
    t.ifError(err, 'npm adduser')

    t.deepEqual(
      deletedConfig,
      {
        _token: 'user',
        '//registry.npmjs.org/:_authToken': 'user'
      },
      'should delete token in user config'
    )

    t.deepEqual(
      setConfig,
      {
        '//registry.npmjs.org/:_password': { value: 'cA==', where: 'user' },
        '//registry.npmjs.org/:username': { value: 'u', where: 'user' },
        '//registry.npmjs.org/:email': { value: 'u@npmjs.org', where: 'user' },
        '//registry.npmjs.org/:always-auth': { value: false, where: 'user' }
      },
      'should set expected user configs'
    )

    t.equal(
      result,
      'success',
      'should output auth success msg'
    )

    deletedConfig = {}
    setConfig = {}
    result = ''
    t.end()
  })
})

test('bad auth type', (t) => {
  _flatOptions.authType = 'foo'

  adduser([], (err) => {
    t.match(
      err,
      /Error: no such auth module/,
      'should throw bad auth type error'
    )

    _flatOptions.authType = 'legacy'
    deletedConfig = {}
    setConfig = {}
    result = ''
    t.end()
  })
})

test('scoped login', (t) => {
  _flatOptions.scope = '@myscope'

  adduser([], (err) => {
    t.ifError(err, 'npm adduser')

    t.deepEqual(
      setConfig['@myscope:registry'],
      { value: 'https://registry.npmjs.org/', where: 'user' },
      'should set scoped registry config'
    )

    _flatOptions.scope = ''
    deletedConfig = {}
    setConfig = {}
    result = ''
    t.end()
  })
})

test('scoped login with valid scoped registry config', (t) => {
  _flatOptions['@myscope:registry'] = 'https://diff-registry.npmjs.com/'
  _flatOptions.scope = '@myscope'

  adduser([], (err) => {
    t.ifError(err, 'npm adduser')

    t.deepEqual(
      setConfig['@myscope:registry'],
      { value: 'https://diff-registry.npmjs.com/', where: 'user' },
      'should keep scoped registry config'
    )

    delete _flatOptions['@myscope:registry']
    _flatOptions.scope = ''
    deletedConfig = {}
    setConfig = {}
    result = ''
    t.end()
  })
})

test('save config failure', (t) => {
  failSave = true

  adduser([], (err) => {
    t.match(
      err,
      /error saving user config/,
      'should throw config.save error'
    )

    failSave = false
    deletedConfig = {}
    setConfig = {}
    result = ''
    t.end()
  })
})