Append-only logs are a nifty way to share key-value data.
Unfortunately, append-only logs grow forever.  Compacting can be
tricky, especially at the same time you're trying to share.

_memento_ stores delta-encoded key-value data in an append-only log.
Rather than _replay_ entries from oldest to newest, clients _rewind_
entries from newest to oldest.  As the log rewinds, it keeps track of
the keys for which it has seen values and drops superseded entries,
so every rewind compacts the log.
