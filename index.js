var SimpleLog = require('level-simple-log')
var Trie = require('trie-hard')
var dezalgo = require('dezalgo')
var pump = require('pump')
var through = require('through2')

module.exports = RevLog

function RevLog (levelup) {
  if (!(this instanceof RevLog)) return new RevLog(levelup)
  this._log = new SimpleLog(levelup)
}

RevLog.prototype.createRewindStream = function (to) {
  var self = this
  var seen = new Trie()
  return pump(
    self._log.createReverseStream(to),
    through.obj(function (data, _, done) {
      var index = data.index
      var entry = data.entry
      var key = entry.key
      if (seen.isMatch(key)) {
        self._log.drop(index)
        done()
      } else {
        seen.add(key)
        if (entry.type === 'unset') done()
        else {
          done(null, {
            index: data.index,
            key: entry.key,
            value: entry.value
          })
        }
      }
    })
  )
}

RevLog.prototype.set = function (key, value, callback) {
  callback = dezalgo(callback)
  if (!validKey(key)) callback(new Error('invalid key'))
  else this._log.append({type: 'set', key: key, value: value}, callback)
}

RevLog.prototype.unset = function (key, callback) {
  callback = dezalgo(callback)
  if (!validKey(key)) callback(new Error('invalid key'))
  else this._log.append({type: 'unset', key: key}, callback)
}

RevLog.prototype.read = function (key, callback) {
  this._log.createReverseStream()
  .on('data', function (data) {
    var entry = data.entry
    if (entry.key === key) {
      this.destroy()
      callback(null, 'value' in entry ? entry.value : undefined)
    }
  })
  .once('error', function (error) { callback(error) })
  .once('end', function () { callback(null, undefined) })
}

RevLog.prototype.head = function (callback) {
  this._log.head(callback)
}

function validKey (key) {
  return typeof key === 'string'
}
