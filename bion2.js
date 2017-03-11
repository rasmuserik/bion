//
// Data types:
//
// - blob 0b....0000
//     - 0x10 null
//     - 0x20 true
//     - 0x30 false
//     - 0x40 double
//     - 0x50 strings
//     - 0x60 binary
// - uint
//     - 0b.....010 ref
//     - 0b.....100 negative
//     - 0b.....110 positive
// - collection
//     - 0b......01 array
//     - 0b......11 object

// # State
var cache = new Map();
var buf = new Uint8Array(10000); // TODO autoscale buf
var converter = new ArrayBuffer(8);
var converterFloat = new Float64Array(converter);
var converterBytes = new Uint8Array(converter);

// # encode
var caching = false;
function encode(o, pos) {
  function writeNum(type, num) {
    var bytes = num >>> 5;
    while(bytes) {
      buf[pos++] = bytes & 255;
      bytes >>= 8;
    }
    buf[pos++] = (num << 3) | type;
  }
  // ## Dispatch on objectType
  if(o === null) { // ###
    buf[pos++ ] = 0x10;

  } else if(o === true) { // ###
    buf[pos++ ] = 0x20;

  } else if(o === false) { // ###
    buf[pos++ ] = 0x30;

  } else if(caching && cache.get(o)) { // ###
    writeNum(2, pos - cache.get(o));

  } else if(typeof o === 'number') { // ###
    if(o !== (o | 0)) {
      converterFloat[0] = o;
      buf.set(converterBytes, pos);
      pos += 8;
      buf[pos++] = 0x40;
    } else {
      if(o < 0) {
        writeNum(4, ~o);
      } else {
        writeNum(6, o);
      }
    }

  } else if(typeof o === 'string') { // ###
    for(var i = 0; i < o.length; ++i) {
      var c = o.charCodeAt(i);
      if(c < 128) {
        buf[pos++] = c;
      } else { // utf-8 encoding of UCS-2
        if(c <= 0x7FF) {
          buf[pos++] = (0x80 | 0x40) | (c >> 6);
          buf[pos++] = (0x80) | (c & 0x3f);
        } else {
          buf[pos++] = (0x80 | 0x40 | 0x20 ) | (c >> 12);
          buf[pos++] = (0x80) | ((c >> 6) & 0x3f);
          buf[pos++] = (0x80) | (c & 0x3f);
        }
      }
    }
    buf[pos++] = 0x50;

  } else if(o.constructor === Uint8Array) { // ###
    buf.set(pos, o);
    pos += o.byteLength;
    buf[pos++] = 0x60;

  // ## Object / Array
  } else {
    var pos0 = pos;
    var type;
    // ### Optionally convert object to array;
    if(Array.isArray(o)) {
      type = 1;
    } else {
      type = 3;

      var obj = o;
      var keys = Object.keys(o);
      var len = keys.length;
      var o = new Array(len * 2);

      keys.sort();
      for(var i = 0; i < len; ++i) {
        o[i] = obj[keys[i]];
        o[i + len] = keys[i];
      }
    }

    // ### Encode entries
    var len = o.length;
    var positions = new Array(len);
    for(var i = 0; i < len; ++i) {
      pos = encode(o[i], pos);
      positions[i] = pos;
    }

    // ### Encode indexes
    var bytesPerIndex;
    var dpos = pos - pos0;
    if(pos-pos0 + len <= 0x100) {
      bytesPerIndex = 1;
    } else if(pos-pos0 + len * 2 < 0x10000) {
      bytesPerIndex = 2;
    } else if(pos-pos0 + len * 3 < 0x1000000) {
      bytesPerIndex = 3;
    } else {
      bytesPerIndex = 3;
    }

    for(var i = 0; i < positions.length - 1; ++i) {
      var index = positions[i] - pos0;
      for(j = bytesPerIndex - 1; j >= 0; --j) {
        buf[pos + j] = index & 255;
        index >>= 8;
      }
      pos += bytesPerIndex;
    }

    // ### Encode length + type
    var lentype = (len << 2) | type;
    if(lentype < 128) {
      buf[pos++] = lentype;
    } else if(lentype < 128*128) {
      buf[pos++] = lentype >>> 7;
      buf[pos++] = lentype | 128;
    } else if(lentype < 128*128*128) {
      buf[pos++] = lentype >>> 14;
      buf[pos++] = (lentype >>> 7) | 128;
      buf[pos++] = lentype | 128;
    } else if(lentype < 128*128*128*128) {
      buf[pos++] = lentype >>> 21;
      buf[pos++] = (lentype >>> 14) | 128;
      buf[pos++] = (lentype >>> 7) | 128;
      buf[pos++] = lentype | 128;
    } else {
      buf[pos++] = lentype >>> 28;
      buf[pos++] = (lentype >>> 21) | 128;
      buf[pos++] = (lentype >>> 14) | 128;
      buf[pos++] = (lentype >>> 7) | 128;
      buf[pos++] = lentype | 128;
    }
  }

  return pos;
}

// # decode
function decode(buf, pos, end) {
  var type = buf[--end];
  if(type & 7) {
    if(type & 1) { // object/array
      var pos0 = pos;
      var c = type;
      len = (c & 127) >> 2;
      var shift = 5;
      while(pos < end && (c & 128)) {
        c = buf[--end];
        len += (c & 127) << shift;
        shift += 7;
      }

      var bytesPerIndex;
      if(end - pos <= 0x100) {
        bytesPerIndex = 1;
      } else if(end - pos < 0x10000) {
        bytesPerIndex = 2;
      } else if(end - pos < 0x1000000) {
        bytesPerIndex = 3;
      } else {
        bytesPerIndex = 3;
      }

      var pIndex = end - bytesPerIndex * (len - 1);
      var pIndex0 = pIndex;
      var arr = new Array(len);
      for(var i = 0; i < len - 1; ++i) {
        var index = 0;
        for(var j = 0; j < bytesPerIndex; ++j) {
          index <<= 8;
          index += buf[pIndex++];
        }
        arr[i] = decode(buf, pos, pos0 + index);
        pos = pos0 + index;
      }
      arr[i] = decode(buf, pos, pIndex0);

      if(type & 2) {
        var o = {};
        for(var i = 0; i < (arr.length >> 1); ++i) {
          o[arr[i + (arr.length >> 1)]] = arr[i];
        }
        return o;
      } 

      return arr;
    } else { // uint
      var i = 0;
      while(pos < end) {
        i = buf[--end] + (i << 8);
      }
      i = (i << 5) | (type >> 3);
      i = (type & 2) ? i : ~i;
      if(type & 4) {
        return i;
      }
      return "TODO: caching";
    }
  } else {
    switch (type >> 4) {
      case 1: 
        return null;
      case 2:
        return true;
      case 3:
        return false;
      case 4: // float
        for(var i = 0; i < 8; ++i) {
          converterBytes[i] = buf[pos++];
        }
        return converterFloat[0];
      case 5: // string
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
        return result;
      case 6:
        return buf.slice(pos, end);
    }
  }


}
//# old
/*
// ## readLength
function readLength() {
return len;
}
// ## varBytes
function varBytes() {
var result = 0;
do {
var c = buf[--end];
result += c & 127;
} while(pos < end && !(c & 128));
return result;
}

if((type & 0x7) === 0) {
// ## constants
if(type === 0x10) {
result = null;

} else if(type === 0x20) {
result = true;

} else if(type === 0x30) {
result = false;

// ## string
} else if(type === 0x40) {

// ## buffer
} else if(type === 0x50) {
// TODO buffer
} else if(type === 0x60) {
for(var i = 0; i < 8; ++i) {
converterBytes[i] = buf[pos++];
}
result = converterFloat[0];
}
// ##
} else {
switch(type & 0x7) {
// ## Objects
case 1: 
break;
// ## arrays
case 2: 
var result = [];
var len = readLength();
for(var j = 1; j < len; ++j) {
var delta = varBytes();
var pos2 = end - delta;
result.push(decode(buf, pos, pos2));
pos = pos2;
}
result.push(decode(buf, pos, end));
break;
// ## refs+numbers
case 3: // backrefs
var i = 0;
while(end > pos) {
i = buf[--end] | (i << 8);
}
i = (i << 5) | (type >> 3)
break;
case 4: // negative numbers
var i = 0;
while(end > pos) {
i = buf[--end] | (i << 8);
}
i = (i << 5) | (type >> 3)
result = ~i;
break;
case 5: // positive numbers
var i = 0;
while(end > pos) {
  i = buf[--end] | (i << 8);
}
i = (i << 5) | (type >> 3)
  result = i;
  break;
  }
}
return result;
*/
// # exports
exports.encode = (o) => {
  cache.clear();
  return buf.slice(0, encode(o, 0));
}
exports.decode = (o) => decode(o, 0, o.byteLength);
