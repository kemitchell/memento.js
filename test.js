var Memento = require('./')
var levelup = require('levelup')
var memdown = require('memdown')
var tape = require('tape')

tape('set', function (test) {
  var log = testInstance()
  log.set('a', 'apple', function (error, index) {
    test.ifError(error, 'no error')
    test.equal(index, 1, 'index is 1')
    test.end()
  })
})

tape('read', function (test) {
  var log = testInstance()
  log.set('a', 'apple', function () {
    log.set('a', 'atom', function () {
      log.read('a', function (error, value) {
        test.ifError(error, 'no error')
        test.equal(value, 'atom', 'yields latest value')
        test.end()
      })
    })
  })
})

tape('read unseen key', function (test) {
  var log = testInstance()
  log.read('x', function (error, value) {
    test.ifError(error, 'no error')
    test.equal(value, undefined, 'yields undefined')
    test.end()
  })
})

tape('unset', function (test) {
  var log = testInstance()
  log.set('a', 'apple', function () {
    log.unset('a', function (error) {
      test.ifError(error, 'no error')
      log.read('a', function (error, value) {
        test.ifError(error, 'no error')
        test.equal(value, undefined, 'yields undefined')
        test.end()
      })
    })
  })
})

tape('head', function (test) {
  var log = testInstance()
  log.set('a', 'apple', function () {
    log.set('b', 'bicycle', function () {
      log.head(function (error, head) {
        test.ifError(error, 'no error')
        test.equal(head, 2, 'head is 2')
        test.end()
      })
    })
  })
})

tape('rewind', function (test) {
  var log = testInstance()
  log.set('a', 'apple', function () {
    log.set('a', 'atom', function () {
      log.set('b', 'bicycle', function () {
        log.set('b', 'ball', function () {
          log.set('c', 'cat', function () {
            log.unset('c', function () {
              var buffer = []
              log.rewind()
              .on('data', function (entry) { buffer.push(entry) })
              .once('error', function (error) { test.fail(error) })
              .once('end', function () {
                test.deepEqual(
                  buffer,
                  [
                    {index: 4, key: 'b', value: 'ball'},
                    {index: 2, key: 'a', value: 'atom'}
                  ],
                  'rewinds compacted log'
                )
                test.end()
              })
            })
          })
        })
      })
    })
  })
})

function testInstance () {
  memdown.clearGlobalStore()
  return new Memento(levelup('', {db: memdown, valueEncoding: 'json'}))
}
