var Memento = require('./')
var levelup = require('levelup')
var memdown = require('memdown')
var runSeries = require('run-series')
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
  runSeries([
    log.set.bind(log, 'a', 'apple'),
    log.set.bind(log, 'a', 'atom'),
    function (done) {
      log.read('a', function (error, value) {
        test.ifError(error, 'no error')
        test.equal(value, 'atom', 'yields latest value')
        done()
      })
    }
  ], test.end)
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
  runSeries([
    log.set.bind(log, 'a', 'apple'),
    log.unset.bind(log, 'a'),
    function (done) {
      log.read('a', function (error, value) {
        test.ifError(error, 'no error')
        test.equal(value, undefined, 'yields undefined')
        done()
      })
    }
  ], test.end)
})

tape('head', function (test) {
  var log = testInstance()
  runSeries([
    log.set.bind(log, 'a', 'apple'),
    log.set.bind(log, 'b', 'bicycle'),
    function (done) {
      log.head(function (error, head) {
        test.ifError(error, 'no error')
        test.equal(head, 2, 'head is 2')
        done()
      })
    }
  ], test.end)
})

tape('rewind', function (test) {
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
        done()
      })
    }
  ], test.end)
})

function testInstance () {
  memdown.clearGlobalStore()
  return new Memento(levelup('', {db: memdown, valueEncoding: 'json'}))
}
