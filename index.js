var SimpleLog = require('level-simple-log')
var Trie = require('trie-hard')
var dezalgo = require('dezalgo')
var pump = require('pump')
var through = require('through2')

module.exports = Memento

function Memento (levelup) {
  if (!(this instanceof Memento)) return new Memento(levelup)
  this._log = new SimpleLog(levelup)
  this._lastCompaction = null
  this._knownDirtyKeyCount = 0
  this._haveCompactedToOrigin = false
}

Memento.prototype.createRewindStream = function (to) {
  to = to || 0
  var self = this
  var keysSeen = new Trie()
  var thisCompaction = {keysSeen: keysSeen, head: null, to: to}
  var first = true
  var shouldCompact = (
    self._lastCompaction === null ||
    self._knownDirtyKeyCount > 0 ||
    !self._haveCompactedToOrigin
  )
  var returned = pump(
    self._log.createReverseStream(to),
    through.obj(
      shouldCompact ? compact : passThrough,
      shouldCompact ? recordCompaction : undefined
    )
  )
  return returned

  function recordCompaction (done) {
    returned.emit('compacted')
    self._lastCompaction = thisCompaction
    self._knownDirtyKeyCount = 0
    if (to === 0) self._haveCompactedToOrigin = true
    done()
  }

  function compact (data, _, done) {
    var index = data.index
    if (first) {
      thisCompaction.head = index
      first = false
    }
    var entry = data.entry
    var key = entry.key
    if (keysSeen.isMatch(key)) {
      self._log.drop(index)
      done()
    } else passThrough(data, _, done)
  }

  function passThrough (data, _, done) {
    var entry = data.entry
    var key = entry.key
    keysSeen.add(key)
    if (entry.type === 'unset') done()
    else {
      done(null, {
        index: data.index,
        key: entry.key,
        value: entry.value
      })
    }
  }
}

Memento.prototype.set = function (key, value, callback) {
  callback = dezalgo(callback)
  if (!validKey(key)) callback(new Error('invalid key'))
  else {
    var self = this
    var entry = {type: 'set', key: key, value: value}
    this._log.append(entry, function (error, index) {
      self._markDirty(key)
      callback(error, index)
    })
  }
}

Memento.prototype.unset = function (key, callback) {
  callback = dezalgo(callback)
  if (!validKey(key)) callback(new Error('invalid key'))
  else {
    var self = this
    var entry = {type: 'unset', key: key}
    self._log.append(entry, function (error, index) {
      self._markDirty(key)
      callback(error, index)
    })
  }
}

Memento.prototype._markDirty = function (key) {
  if (this._lastCompaction && this._lastCompaction.keysSeen.isMatch(key)) {
    this._knownDirtyKeyCount++
  }
}

Memento.prototype.read = function (key, callback) {
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

Memento.prototype.head = function (callback) {
  this._log.head(callback)
}

function validKey (key) {
  return typeof key === 'string'
}
