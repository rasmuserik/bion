//
//
// - num
//     - 0x00- negative int
//     - 0x1f double
//     - 0x20- positive int
//     - 0x3f null
// - varstr
//     - 0x40- string
//     - 0x5f true
//     - 0x60- binary
//     - 0x7f false
// - stream
//     - 0x80- array-stream
//     - 0x9f end-of-stream
//     - 0xa0- obj-stream
// - indexed Not implemented yet
//     - 0xc0- array
//     - 0xe0- object
//


// # State

var buf = new Uint8Array(1024); 
var converter = new ArrayBuffer(8);
var converterFloat = new Float64Array(converter);
var converterBytes = new Uint8Array(converter);
var pos;
var END = {};

// # Utility
function addByte(b) { // ##
  if(pos >= buf.length) {
    var t = new Uint8Array(pos * 2 | 0);
    t.set(buf);
    buf = t;
  }
  buf[pos++] = b;
}

function writeFloat(d) { // ##
  converterFloat[0] = d;
  for(var i = 0; i < 8; ++i) {
    addByte(converterBytes[i]);
  }
}

function writeHeader(type, i) { // ##
  if(i < 30) {
    addByte(type | i);
  } else {
    addByte(type | 30);
    vbenc(i - 30);
  }
}

function vbenc(i) { // ##
  if(i >= 128) {
    if(i >= 128*128) {
      if(i >= 128*128*128) {
        if(i >= 128*128*128*128) {
          addByte((i >> 28) | 128);
        }
        addByte((i >> 21) | 128);
      }
      addByte((i >> 14) | 128);
    }
    addByte((i >> 7) | 128);
  }
  addByte(i & 127);
}
function utf8length(str) { // ##
  var len = 0;
  for(var i = 0; i < str.length; ++i) {
    var c = str.charCodeAt(i);
    ++len;
    if(c > 127) ++len;
    if(c > 0x7FF) ++len;
  }
  return len;
}
function writeUtf8(str) { // ##
  for(var i = 0; i < str.length; ++i) {
    var c = str.charCodeAt(i);
    if(c < 128) {
      addByte(c);
    } else { // utf-8 encoding of UCS-2
      if(c <= 0x7FF) {
        addByte((0x80 | 0x40) | (c >> 6));
        addByte((0x80) | (c & 0x3f));
      } else {
        addByte((0x80 | 0x40 | 0x20 ) | (c >> 12));
        addByte((0x80) | ((c >> 6) & 0x3f));
        addByte((0x80) | (c & 0x3f));
      }
    }
  }
}

function readFloat(buf, pos) { // ##
  for(var i = 0; i < 8; ++i) {
    converterBytes[i] = buf[pos+i];
  }
  return [converterFloat[0], pos + 8];
}

function readStr(buf, pos, end) { // ##
  var result = '';
  while(pos < end) {
    var c = buf[pos++];
    if(c & 128) { // utf-8 decoding into UCS-2
      var b = c;
      c = ((c & 0x1f) << 6) | (buf[pos++] & 0x3f);
      if((b & 0xe0) === 0xe0) { // three
        c = (c << 6) | (buf[pos++] & 0x3f);
      }
    }
    result += String.fromCharCode(c);
  }
  return [result, pos];
}

// # encode
function encode(o) {
  if(o === null) return addByte(0x3f);
  if(o === true) return addByte(0x5f);
  if(o === false) return addByte(0x7f);
  if(o === END) return addByte(0x9f);
  if(typeof o === 'number') {
    if(o === (o|0)) {
      if(o < 0) {
        return writeHeader(0x00, ~o);
      } else {
        return writeHeader(0x20, o);
      }
    }
    addByte(0x1f);
    return writeFloat(o);
  }
  if(typeof o === 'string') {
    writeHeader(0x40, utf8length(o));
    return writeUtf8(o);
  }
  if(Array.isArray(o) || o.constructor === Object) {
    var type;
    var len;
    if(Array.isArray(o)) {
        type = 0x80;
        len= o.length;
    } else {
        type = 0xa0;
        var arr = [];
        for(var k in o) {
          arr.push(k, o[k]);
        }
        len  = (arr.length / 2);
        o = arr;
    }
    writeHeader(type, len + 1);
    for(var i = 0; i < o.length; ++i) {
      encode(o[i]);
    }
    return;
  }
  if(o.constructor === Uint8Array) {
    writeHeader(0x60, o.length);
    for(var i = 0; i < o.length; ++i) {
      addByte(o[i]);
    }
    return;
  }
}
// # decode
function decode(buf, pos) {
  var type = buf[pos++];
  var num;
  if((type & 31) < 30) {
    num = type & 31;
  } else if((type & 31) === 30) {
    num = 0;
    do {
      var c = buf[pos++];
      num = (num << 7)+ (c & 127);
    } while(c & 128);
    num += 30;
  } else {
    if(type === 0x1f) return readFloat(buf, pos);
    if(type === 0x3f) return [null, pos];
    if(type === 0x5f) return [true, pos];
    if(type === 0x7f) return [false, pos];
    if(type === 0x9f) return [END, pos];
  }
  switch(type >>> 5) {
    case 0: // ## Negative Number
      return [~num, pos];
    case 1: // ## Positive Number
      return [num, pos];
    case 2: // ## String
        return readStr(buf, pos, pos+num);
    case 3: // ## Binary
      return [buf.slice(pos, pos + num), pos];
    case 4: case 5: // ## Streamable collections
      if(num === 0) {
        throw 'Streamed collections not implemented yet.';
      }
      --num;
      if(type >>> 5 === 5) { // Object
        num = 2*num;
      }
      var arr = new Array(num);
      for(var i = 0; i < num; ++i) {
        [arr[i], pos] = decode(buf, pos)
      }
      if(type >>> 5 === 5) { // Object
        var result = {};
        for(var i = 0; i < arr.length; i += 2) {
          result[arr[i]] = arr[i + 1];
        }
        return [result, pos];
      }
      return [arr, pos];

    case 6: case 7: // ## Indexed collections
      throw 'indexed collections not implemented yet.';
  }
}
// # exports
var bion;
if(typeof exports === 'object') {
  bion = exports;
} else {
  bion = self.Bion = {};
}
bion.encode = (o) => {
  pos = 0;
  encode(o);
  return buf.slice(0, pos);
}
bion.decode = (o) => decode(o, 0)[0];
