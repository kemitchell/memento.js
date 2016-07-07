Append-only logs are a nifty way to share key-value data.
Unfortunately, append-only logs grow forever.  Compacting can be
tricky, especially at the same time you're trying to share.

_memento_ stores delta-encoded key-value data in an append-only log.
Rather than _replay_ entries from oldest to newest, clients _rewind_
entries from newest to oldest.  As the log rewinds, it keeps track of
the keys for which it has seen values and drops superseded entries,
so every rewind compacts the log.

Memento supports five abstract operations:

1. Set a key to a value on the log. Very quick.
2. Unset the value of a key on the log.  Very quick.
3. Find the index number of the latest log entry.  Very quick.
4. Stream key-value entries, with index numbers, in reverse.
   A streaming operation, but builds a [trie] of key names in memory
   to facilitate compaction in passing.
5. Read the value at a specific key, if any.  Relatively slow.

[trie]: https://npmjs.com/packages/trie-hard

## API Examples

The following examples are also the package's test suite, using
Node.js' built-in `assert` module.

```javascript
var assert = require('assert')
```

### Initialization

_memento_ stores log data in a [LevelUP].  The LevelUP must be able
to encode string keys and nested `Object` values.

[LevelUP]: https://npmjs.com/packages/levelup

The examples in this file use a LevelUP with JSON-encoded values
backed by [memdown], an in-memory storage back-end.  You could
also use [LevelDOWN], [LevelUP]'s default, disk-persisted,
log-structured-merge-tree-based store.

[memdown]: https://npmjs.com/packages/memdown

[LevelDOWN]: https://npmjs.com/packages/leveldown

```javascript
var Memento = require('memento')
var levelup = require('levelup')
var memdown = require('memdown')

function testInstance () {
  memdown.clearGlobalStore()
  return new Memento(levelup('', {db: memdown, valueEncoding: 'json'}))
}
```

### Setting Values
```javascript
;(function set () {
  var log = testInstance()
  log.set('a', 'apple', function (error, index) {
    assert.ifError(error, 'no error')
    assert.equal(index, 1, 'index is 1')
  })
})()
```

### Reading Values
```javascript
var runSeries = require('run-series')

;(function read () {
  var log = testInstance()
  runSeries([
    log.set.bind(log, 'a', 'apple'),
    log.set.bind(log, 'a', 'atom'),
    function (done) {
      log.read('a', function (error, value) {
        assert.ifError(error, 'no error')
        assert.equal(value, 'atom', 'yields latest value')
        done()
      })
    }
  ])
})()

;(function readNonExistent () {
  var log = testInstance()
  log.read('x', function (error, value) {
    assert.ifError(error, 'no error')
    assert.equal(value, undefined, 'yields undefined')
  })
})()
```

### Unset
```javascript
;(function unset () {
  var log = testInstance()
  runSeries([
    log.set.bind(log, 'a', 'apple'),
    log.unset.bind(log, 'a'),
    function (done) {
      log.read('a', function (error, value) {
        assert.ifError(error, 'no error')
        assert.equal(value, undefined, 'yields undefined')
        done()
      })
    }
  ])
})()
```

### Head
```javascript
;(function () {
  var log = testInstance()
  runSeries([
    log.set.bind(log, 'a', 'apple'),
    log.set.bind(log, 'b', 'bicycle'),
    function (done) {
      log.head(function (error, head) {
        assert.ifError(error, 'no error')
        assert.equal(head, 2, 'head is 2')
        done()
      })
    }
  ])
})()
```

### Rewind
```javascript
;(function () {
  var log = testInstance()
  runSeries([
    log.set.bind(log, 'a', 'apple'),
    log.set.bind(log, 'a', 'atom'),
    log.set.bind(log, 'b', 'bicycle'),
    log.set.bind(log, 'b', 'ball'),
    log.set.bind(log, 'c', 'cat'),
    log.unset.bind(log, 'c'),
    function (done) {
      var buffer = []
      log.createRewindStream()
      .on('data', function (entry) { buffer.push(entry) })
      .once('error', function (error) { assert.fail(error) })
      .once('end', function () {
        assert.deepEqual(
          buffer,
          [
            {index: 4, key: 'b', value: 'ball'},
            {index: 2, key: 'a', value: 'atom'}
          ],
          'rewinds compacted log'
        )
        done()
      })
    }
  ])
})()
```
