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

    // this.nsp = nsp;
    this.pg = new PG(uri);
    this.uid = uuid.v4();
    this.prefix = opts.prefix || 'socket-io';

    const init = async () => {
      await this.pg.addChannel(`${this.prefix}:${nsp.name}`, this.onmessage.bind(this));
    }
    init();
  }

  onmessage(msg) {
    console.log(`onmessage()`, msg);
    // ignore its own messages
    if (msg.uid === this.uid) return;

    const packet = msg.packet;
    const options = {
      rooms: new Set(msg.options.rooms),
      except: new Set(msg.options.except),
      flags: msg.options.flags,
    };

    // default namespace
    packet.nsp = packet.nsp || '/';

    // ignore message for different namespace
    if (packet.nsp !== this.nsp.name) return;

    super.broadcast(packet, options);
  };

  broadcast(packet, options, remote) {
    console.log('broadcast', packet, options);
    super.broadcast(packet, options);

    packet.nsp = packet.nsp || '/';

    if (!remote) {
      const msg = {
        uid: this.uid,
        packet,
        options: {
          rooms: Array.from(options.rooms),
          except: Array.from(options.except),
          flags: options.flags
        }
      };

      if (options.rooms.size > 0) {
        options.rooms.forEach((room) => {
          console.log(`broadcast to room: '${this.prefix}:${packet.nsp}:${room}'`, msg);
          this.pg.publish(`${this.prefix}:${packet.nsp}:${room}`, msg);
        });
      } else {
        this.pg.publish(`${this.prefix}:${packet.nsp}`, msg);
      }
    }
  };

  async add(id, room) {
    console.log(`add(${id}, ${room})`);
    // super.add(id, room);

    await this.pg.addChannel(`${this.prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
  };

  async addAll(id, rooms) {
    console.log(`addAll(${id}, ${rooms})`);

    if (!rooms) {
      console.log('no rooms');
      return;
    }

    super.addAll(id, rooms);

    let promises = [];
    rooms.forEach(room => promises.push(this.add(id, room)));
    await Promise.all(promises);
  };

  disconnectSockets() {
    console.log("CLOSIGN TIME");
  }

  async del(id, room) {
    console.log(`del(${id}, ${room})`);

    if (!this.rooms.has(room)) {
      console.log('didnt have room');
      return;
    }

    await this.pg.removeChannel(`${this.prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));

    super.del(id, room);
  };

  async delAll(id) {
    console.log(`delAll(${id})`);
    const rooms = this.sids.get(id);

    if (!rooms) {
      console.log('no rooms for sid', id);
      return;
    }

    let promises = [];
    rooms.forEach(room => promises.push(this.del(id, room)));
    await Promise.all(promises);

    // await super.delAll(id);
  };
}
