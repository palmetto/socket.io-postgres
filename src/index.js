const PG = require('pg-pubsub');
const uuid = require('node-uuid');
const Adapter = require('socket.io-adapter');
const async = require('async');
// const Emitter = require('events').EventEmitter;

module.exports = adapter;

function adapter(uri, opt) {
  const config = opt || {};
  config.prefix = config.prefix || 'socket-io';

  const pg = new PG(uri);

  // this server's key
  const uid = uuid.v4();
  const prefix = config.prefix;

  /*
	 * Adapter constructor
   */
  function PostgreSQL(nsp) {
    Adapter.call(this, nsp);

    this.uid = uid;
    this.prefix = prefix;

    pg.addChannel(`${prefix}:${nsp.name}`, this.onmessage.bind(this));

    // pg.on('message', )
  }

  /*
	 * PostgreSQL inherits Adapter
   */
  PostgreSQL.prototype.__proto__ = Adapter.prototype; // eslint-disable-line no-proto
  // Object.setPrototypeOf(PostgreSQL, Adapter);


  /*
	 * PostgreSQL inherits Adapter
   */
  PostgreSQL.prototype.onmessage = function _onmessage(msg) {
    // ignore its own messages
    if (msg.uid === uid) return;

    const packet = msg.packet;
    const options = msg.options;

    // default namespace
    packet.nsp = packet.nsp || '/';

    // ignore message for different namespace
    if (packet.nsp !== this.nsp.name) return;

    this.broadcast.apply(this, [packet, options, true]);
  };

  /*
	 * PostgreSQL inherits Adapter
   */
  PostgreSQL.prototype.broadcast = function _broadcast(packet, options, remote) {
    Adapter.prototype.broadcast.call(this, packet, options);

    if (!remote) {
      const msg = {
        uid,
        packet,
        options
      };

      if (options.rooms) {
        options.rooms.forEach((room) => {
          pg.publish(`${prefix}:${packet.nsp}:${room}`, msg);
        });
      } else {
        pg.publish(`${prefix}:${packet.nsp}`, msg);
      }
    }
  };

  /*
	 * Subscribe the client to room messages
   */
  PostgreSQL.prototype.add = function _add(id, room, fn) {
    Adapter.prototype.add.call(this, id, room);

    pg.addChannel(`${prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  /*
	 * Unsubscribe the client to room messages
   */
  PostgreSQL.prototype.del = function _del(id, room, fn) {
    Adapter.prototype.del.call(this, id, room);


    if (!this.rooms.hasOwnProperty(room)) {
      return process.nextTick(fn.bind(null, null));
    }

    return pg.addChannel(`${prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  /*
	 * Unsubscribe the client completely
   */
  PostgreSQL.prototype.delAll = function _delAll(id, fn) {
    const rooms = this.sids[id];
    const self = this;

    if (!rooms) {
      return process.nextTick(fn.bind(null, null));
    }

    return async.forEach(Object.keys(rooms), (room, next) => {
      self.del(id, room, next);
    }, err => {
      if (err) {
        self.emit('error', err);
        return fn ? fn(err) : null;
      }

      delete self.sids[id];
      return fn ? fn(null) : null;
    });
  };

  PostgreSQL.uid = uid;
  PostgreSQL.prefix = prefix;

  return PostgreSQL;
}
