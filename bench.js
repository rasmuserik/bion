var fast = process.env.FASTBENCH;
var k = fast ? 1 : 10;
var data, n;
var simple = process.env.SIMPLEBENCH;

var bion = require('./bion');
var bion2 = require('./bion2');

implementations = {
  bion: {
    encode: function(o) { return bion.encode(o); },
    decode: function(o) { return bion.decode(o); }
  },
  bion2: {
    encode: function(o) { return bion2.encode(o); },
    decode: function(o) { return bion2.decode(o); }
  },
  json: {
    encode: function(o) { return JSON.stringify(o); },
    decode: function(o) { return JSON.parse(o); }
  }, 
}
if(!fast) {
  var msgpack = require('msgpack-js');
  implementations.msgpack = {
    encode: function(o) { return msgpack.encode(o); },
    decode: function(o) { return msgpack.decode(o); }
  };
}

var results = {};
function bench(implementation, dataname) {
  var dataset = data[dataname];
  var encoded;
  var impl = implementations[implementation];
  var t0 = Date.now();
  for(var i = 0; i < n; ++i) {
    encoded = impl.encode(dataset);
  }
  var encodeTime = Date.now() - t0;
  var t0 = Date.now();
  for(var i = 0; i < n; ++i) {
    decoded = impl.decode(encoded);
  }
  var decodeTime = Date.now() - t0;
  var ok = (JSON.stringify(dataset) === JSON.stringify(decoded));
  if(!ok) {
    console.log(JSON.stringify(dataset).slice(0, 1000));
    console.log(String(JSON.stringify(decoded)).slice(0, 1000));
    console.log(encoded instanceof Uint8Array ? Array.prototype.slice.call(encoded, 0, 20) : JSON.stringify(encoded));
    throw JSON.stringify({error: 'not-equal', data: dataname, impl: implementation});
  }
  var result = [encodeTime, decodeTime, encoded.length];
  console.log(implementation, dataname, result);
  results[implementation + ' ' + dataset] = result
}

data = require('./data/sample.json');
n = k === 1 ? k : 100000 * k;

for(var implementation in implementations) {
  for(var dataname in data) {
    bench(implementation, dataname);
  }
}

if(!simple) {
  data = [];
  function loadData(name) {
    data[name] = require('./data/' + name + '.json');
  }
  (['twitter', 'citm_catalog', 'canada']).map(loadData);
  n = k;
  if(!fast) {
    var BSON = new (require('bson').BSONPure).BSON();
    implementations.bson = {
      encode: function(o) { return BSON.serialize(o); },
      decode: function(o) { return BSON.deserialize(o); }
    };
  };

  for(var implementation in implementations) {
    for(var dataname in data) {
      bench(implementation, dataname);
    }
  }
}
