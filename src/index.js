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
    this.pg = new PG(uri);
    this.uid = uuid.v4();
    this.prefix = opts.prefix || 'socket-io';

    const init = async () => {
      await this.pg.addChannel(`${this.prefix}:${nsp.name}`, this.onmessage.bind(this));
    }
    init();
  }

  onmessage(msg) {
    console.log(`onmessage()`, {msg});
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
          console.log(`broadcast to room: '${this.prefix}:${packet.nsp}:${room}': ${msg}`);
          this.pg.publish(`${this.prefix}:${packet.nsp}:${room}`, msg);
        });
      } else {
        this.pg.publish(`${this.prefix}:${packet.nsp}`, msg);
      }
    }
  };

  async add(id, room) {
    console.log(`add(${id}, ${room})`);
    //super.add(id, room);

    await this.pg.addChannel(`${this.prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  async addAll(id, rooms) {
    console.log(`addAll(${id}, ${rooms})`);
    const self = this;
    super.addAll(id, rooms);

    if (!rooms) {
      console.log('no rooms');
      return;
    }

    // rooms.forEach(room => console.log(room));
    let promises = [];
    rooms.forEach(room => promises.push(this.add(id, room)));
    await Promise.all(promises);
    // return async.forEach(Object.keys(rooms), async (room, next) => {
    //   console.log('foreach');
    //   await self.add(id, room);
    //   next();
    // }, err => {
    //   if (err) {
    //     self.emit('error', err);
    //     return;
    //   }

    //   delete self.sids[id];
    // });
  };

  del(id, room) {
    console.log(`del(${id}, ${room})`);
    super.del(id, room);

    if (!this.rooms.hasOwnProperty(room)) {
      return;
    }

    return this.pg.removeChannel(`${this.prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  delAll(id) {
    console.log(`delAll(${id})`);
    const rooms = this.sids[id];
    const self = this;

    if (!rooms) {
      console.log('no rooms');
      return;
    }

    return async.forEach(Object.keys(rooms), async (room, next) => {
      await self.del(id, room);
      next();
    }, err => {
      if (err) {
        self.emit('error', err);
        return;
      }

      delete self.sids[id];
      return;
    });
  };
}
