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

    this.nsp = nsp;
    this.pg = new PG(uri, {log: console.log});
    this.uid = uuid.v4();
    this.prefix = opts.prefix || 'socket-io';

    const init = async () => {
      await this.pg.addChannel(`${this.prefix}:${nsp.name}`, this.onmessage.bind(this));
    }
    init();
  }

  onmessage(pattern, channel, msg) {
    console.log('onmessage!', {pattern, channel, msg});
    // ignore its own messages
    if (msg.uid === this.uid) return;

    const packet = msg.packet;
    const options = msg.options;

    // default namespace
    packet.nsp = packet.nsp || '/';

    // ignore message for different namespace
    if (packet.nsp !== this.nsp.name) return;

    super.broadcast(packet, options);
  };

  broadcast(packet, options, remote) {
    console.log('broadcast', packet);
    super.broadcast(packet, options);

    packet.nsp = packet.nsp || '/';

    if (!remote) {
      const msg = {
        uid: this.uid,
        packet,
        options
      };

      if (options.rooms.size > 0) {
        options.rooms.forEach((room) => {
          this.pg.publish(`${this.prefix}:${packet.nsp}:${room}`, msg);
        });
      } else {
        console.log(`broadcast '${this.prefix}:${packet.nsp}': ${msg}`);
        this.pg.publish(`${this.prefix}:${packet.nsp}`, msg);
      }
    }
  };

  add(id, room, fn) {
    super.add(id, room);

    this.pg.addChannel(`${this.prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  del(id, room, fn) {
    super.del(id, room);

    if (!this.rooms.hasOwnProperty(room)) {
      return process.nextTick(fn.bind(null, null));
    }

    return this.pg.addChannel(`${this.prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
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
