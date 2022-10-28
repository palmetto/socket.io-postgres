## ⚠️ **Warning**
**This is using socket.io v2, newer versions of socket.io have their own library: https://github.com/socketio/socket.io-postgres-adapter. That should be used when socket.io is upgraded.**

# socket.io-postgres

socket.io-postgres allows you to communicate with socket.io servers easily from non-socket.io processes.

## How to use

```js
var io = require('socket.io')(3000);
var pgAdapter = require('socket.io-postgres');
io.adapter(pgAdapter('postgresql://'));
```

By running socket.io with the `socket.io-postgres` adapter you can run
multiple socket.io instances in different processes or servers that can
all broadcast and emit events to and from each other.

## Tests

These are "integration" tests. You will need a real PG database.

Then, run `yarn test`.


## Publishing

`yarn compile`
`yarn publish`

## API

### adapter(connection[, opts])

1. `connection` - a URI string, i.e., `postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]`, or an object. See https://node-postgres.com/features/connecting for more information.
1. `opts` - the following options are allowed:
    - `prefix`: the name of the prefix to pub/sub events on as prefix (`socket.io`)

### PostgreSQLAdapter

The PostgreSQLAdapter instances expose the following properties
that a regular `Adapter` does not

- `uid`
- `prefix`

## Client error handling

Subscribe to its `error` event:

```js
var pgAdapter = require('socket.io-postgres');
var adapter = pgAdapter('postgresql://');
adapter.on('error', function(){});
```

## Protocol

The `socket.io-postgres` adapter broadcasts and receives messages on particularly named channels. For global broadcasts the channel name is:
```
prefix + ':' + namespace
```

In broadcasting to a single room the channel name is:
```
prefix + ':' + namespace + ':' + room + '#'
```

- `prefix`: The base channel name. Default value is `socket.io`. Changed by setting `opts.prefix` in `adapter(opts)` constructor
- `namespace`: See https://github.com/socketio/socket.io#namespace.
- `room` : Used if targeting a specific room.

A number of other libraries adopt this protocol including:

- [socket.io-redis-emitter](https://github.com/socketio/socket.io-redis-emitter)
- [socket.io-python-emitter](https://github.com/ziyasal/socket.io-python-emitter)


## License

MIT
