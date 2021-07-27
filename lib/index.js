"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createAdapter;
exports.PostgreSQLAdapter = void 0;

var _pgPubsub = _interopRequireDefault(require("pg-pubsub"));

var _uuid = require("uuid");

var _socket = require("socket.io-adapter");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createAdapter(connection, opts) {
  return function (nsp) {
    return new PostgreSQLAdapter(nsp, connection, opts);
  };
}

class PostgreSQLAdapter extends _socket.Adapter {
  constructor(nsp, connection, opts = {}) {
    super(nsp);
    this.pg = new _pgPubsub.default(connection);
    this.uid = (0, _uuid.v4)();
    this.prefix = opts.prefix || 'socket-io';

    const init = async () => {
      const channel = `${this.prefix}:${nsp.name}`;

      try {
        await this.pg.addChannel(channel, this.onmessage.bind(this));
      } catch (err) {
        console.error(`Error adding channel listener for "${channel}"`, err);
      }
    };

    init();
  }

  onmessage(msg) {
    // console.log(`onmessage()`, msg);
    // ignore its own messages
    if (msg.uid === this.uid) return;
    const packet = msg.packet;
    const options = {
      rooms: new Set(msg.options.rooms),
      except: new Set(msg.options.except),
      flags: msg.options.flags
    }; // default namespace

    packet.nsp = packet.nsp || '/'; // ignore message for different namespace

    if (packet.nsp !== this.nsp.name) return;
    super.broadcast(packet, options);
  }

  broadcast(packet, options, remote) {
    // console.log('broadcast()', packet, options);
    super.broadcast(packet, options);
    packet.nsp = packet.nsp || '/';

    if (!remote) {
      const msg = {
        uid: this.uid,
        packet,
        options: {
          rooms: Array.from(options.rooms || []),
          except: Array.from(options.except || []),
          flags: options.flags
        }
      };

      if (options.rooms.size > 0) {
        options.rooms.forEach(room => {
          // console.log(`broadcast to room: '${this.prefix}:${packet.nsp}:${room}'`, msg);
          this.pg.publish(`${this.prefix}:${packet.nsp}:${room}`, msg);
        });
      } else {
        this.pg.publish(`${this.prefix}:${packet.nsp}`, msg);
      }
    }
  }

  async add(id, room) {
    const channel = `${this.prefix}:${this.nsp.name}:${room}`;

    try {
      await this.pg.addChannel(channel, this.onmessage.bind(this));
    } catch (err) {
      console.error(`Error adding channel listener for "${channel}"`, err);
    }
  }

  async addAll(id, rooms) {
    // console.log(`addAll(${id}, ${rooms})`);
    if (!rooms) {
      // console.log('no rooms');
      return;
    }

    super.addAll(id, rooms);
    let promises = [];
    rooms.forEach(room => promises.push(this.add(id, room)));
    await Promise.all(promises).catch(err => {
      console.error(`Error adding channel listener for "${channel}"`, err);
    });
  }

  async del(id, room) {
    // console.log(`del(${id}, ${room})`);
    if (!this.rooms.has(room)) {
      // console.log('didnt have room');
      return;
    }

    await this.pg.removeChannel(`${this.prefix}:${this.nsp.name}:${room}`, this.onmessage.bind(this));
    super.del(id, room);
  }

  async delAll(id) {
    // console.log(`delAll(${id})`);
    const rooms = this.sids.get(id);

    if (!rooms) {
      // console.log('no rooms for sid', id);
      return;
    }

    let promises = [];
    rooms.forEach(room => promises.push(this.del(id, room)));
    await Promise.all(promises).catch(err => {
      console.error('Error removing multiple channel listeners', err);
    });
    ; // await super.delAll(id);
  }

  async close() {
    try {
      await this.pg.close();
    } catch (err) {}
  }

}

exports.PostgreSQLAdapter = PostgreSQLAdapter;