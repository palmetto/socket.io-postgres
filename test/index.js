var http = require('http').Server;
var io = require('socket.io');
var ioc = require('socket.io-client');
var expect = require('expect.js');
const pgAdapter = require('../index').default;

//TODO Mock pg-pubsub

describe('socket.io-postgres', function () {

  it('broadcasts', function (done) {
    create(function (server1, client1) {
      create(function (server2, client2) {
        client1.on('woot', function (a, b) {
          expect(a).to.eql([]);
          expect(b).to.eql({ a: 'b' });
          client1.disconnect();
          client2.disconnect();
          done();
        });
        server2.on('connection', function (c2) {
          c2.broadcast.emit('woot', [], { a: 'b' });
        });
      });
    });
  });

  it('broadcasts to rooms', function (done) {
    // this.timeout(5000);
    create(function (server1, client1) {
      create(function (server2, client2) {
          server1.on('connection', function (c1) {
            c1.join('woot');
          });

          server2.on('connection', function (c2) {
            // does not join, performs broadcast
            c2.broadcast.to('woot').emit('broadcast', 'message');
          });

          client1.on('broadcast', function () {
            client1.disconnect();
            client2.disconnect();
            done(); // This gets called as far as I can tell but the test still fails.

          // setTimeout(function () {
          // }, 100);
          });

          client2.on('broadcast', function () {
            throw new Error('Not in room');
          });
      });
    });
  });

  it('doesn\'t broadcast to left rooms', function (done) {
    create(function (server1, client1) {
      create(function (server2, client2) {
        create(function (server3, client3) {
          server1.on('connection', function (c1) {
            c1.join('woot');
            c1.leave('woot');
          });

          server2.on('connection', function (c2) {
            c2.on('do broadcast', function () {
              c2.broadcast.to('woot').emit('broadcast');

              setTimeout(function () {
                client1.disconnect();
                client2.disconnect();
                client3.disconnect();
                done();
              }, 100);
            });
          });

          server3.on('connection', function (c3) {
            client2.emit('do broadcast');
          });

          client1.on('broadcast', function () {
            throw new Error('Should not be in room: ' + client1.id);
          });
        });
      });
    });
  });

  it('deletes rooms upon disconnection', function (done) {
    create(function (server, client) {
      server.on('connection', function (c) {
        c.join('woot');
        c.on('disconnect', async function () {
          await new Promise(r => setTimeout(r, 500));
          expect(c.adapter.sids.size).to.be(1);
          expect(c.adapter.rooms.size).to.be(0);
          client.disconnect();
          done();
        });
        c.disconnect();
      });
    });
  });

  /** create a socket.io server+client pair*/
  function create(nsp, fn) {
    var srv = http();
    var sio = io(srv);

    // TODO Pull these from an ignored .env or something
    sio.adapter(pgAdapter({
      host: '',
      user: '',
      password: '',
      database: '',
    }));

    srv.listen(function (err) {
      if (err) throw err; // abort tests
      if ('function' == typeof nsp) {
        fn = nsp;
        nsp = '';
      }
      nsp = nsp || '/';
      var addr = srv.address();
      var url = 'http://localhost:' + addr.port + nsp;
      fn(sio.of(nsp), ioc(url));
    });
  }

});
