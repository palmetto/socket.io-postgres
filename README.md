# socket.io-postgres
socket.io-postgres allows you to communicate with socket.io servers easily from non-socket.io processes.

## How to use

```js
var io = require('socket.io')(3000);
var pg = require('socket.io-postgres');
io.adapter(pg('postgresql://'));
```

By running socket.io with the `socket.io-postgres` adapter you can run
multiple socket.io instances in different processes or servers that can
all broadcast and emit events to and from each other.

If you need to emit events to socket.io instances from a non-socket.io
process, you should use [socket.io-emitter](https://github.com/socketio/socket.io-emitter).

## API

### adapter(uri[, opts])

`uri` is a string, i.e., `postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]` where your postgres server
is located. For a list of options see below.

### adapter(opts)

The following options are allowed:

- `prefix`: the name of the prefix to pub/sub events on as prefix (`socket.io`)

### RedisAdapter

The redis adapter instances expose the following properties
that a regular `Adapter` does not

- `uid`
- `prefix`

## Client error handling

Subscribe to its `error` event:

```js
var redis = require('socket.io-postgres');
var adapter = redis('postgresql://');
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

- [socket.io-emitter](https://github.com/socketio/socket.io-emitter)
- [socket.io-python-emitter](https://github.com/socketio/socket.io-redis)


## License

MIT
