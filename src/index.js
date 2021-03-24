import PG from 'pg-pubsub';
import uuid from 'node-uuid';
import { Adapter } from 'socket.io-adapter';
import async from 'async';

export default function createAdapter(uri, opts) {
  if (typeof uri === 'object') {
    opts = uri;
    uri = null;
  }

  return function (nsp) {
    return new PostgreSQLAdapter(nsp, uri, opts);
  };
}

export class PostgreSQLAdapter extends Adapter {
  constructor(nsp, uri, opts = {}) {
    super(nsp);

    const pg = new PG(uri);
    
    this.uid = uuid.v4();
    this.prefix = opts.prefix || 'socket-io';

    pg.addChannel(`${prefix}:${nsp.name}`, this.onmessage.bind(this));
  }

  onmessage(pattern, channel, msg) {
    // ignore its own messages
    if (msg.uid === uid) return;

    const packet = msg.packet;
    const options = msg.options;

    // default namespace
    packet.nsp = packet.nsp || '/';

    // ignore message for different namespace
    if (packet.nsp !== this.nsp.name) return;

    super.broadcast(packet, options);
  };

  broadcast(packet, options, remote) {
    super.broadcast(packet, options);

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

  add(id, room, fn) {
    super.add(id, room);

    pg.addChannel(`${prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  del(id, room, fn) {
    super.del(id, room);

    if (!this.rooms.hasOwnProperty(room)) {
      return process.nextTick(fn.bind(null, null));
    }

    return pg.addChannel(`${prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  delAll(id, fn) {
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
}
