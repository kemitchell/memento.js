Append-only logs are a nifty way to store and share information.
Unfortunately, append-only logs grow forever.  _Compacting_ can be
tricky, especially at the same time you're trying to share.

_memento_ stores key-value data, delta-encoded, as an append-only log.
Rather than _replay_ entries from start to finish, clients _rewind_
reading entries from latest to earliest.  As a _memento_ log rewinds,
it keeps track of the keys for which it has seen values and drops
superseded entries, compacting as it goes.
