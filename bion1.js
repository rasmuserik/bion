var converter = new ArrayBuffer(8);
var converterFloat = new Float64Array(converter);
var converterBytes = new Uint8Array(converter);

// # bufferEncode
function bufferEncode(o, buf, start) {
  var pos = start;
  if(typeof o === 'string') { // ## 1
    buf[pos++] = 1;
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
  } else if(typeof(o) === 'number') { // ## 2 / 3
    if((o | 0) === o) {
      buf[pos++] = 2;
      do { 
        buf[pos++] = o & 0xff;
        o = o >>> 8;
      } while(o);
    } else {
      buf[pos++] = 3;
      converterFloat[0] = o;
      for(var i = 0; i < 8; ++i) {
        buf[pos + i] = converterBytes[i];
      }
      pos += 8;
    }
  } else if(o === null) { // ## 0
    buf[pos++] = 0;
  } else if(o === true) { // ## 6
    buf[pos++] = 6;
  } else if(o === false) { // ## 7
    buf[pos++] = 7;
  } else if(Array.isArray(o)) { // ## 5
    buf[pos++] = 5;
    for(var i = 0; i < o.length; ++i) {
      pos = bufferEncode(o[i], buf, pos);
    }
  } else { // ## Object 4
    buf[pos++] = 4;
    for(var key in o) {
      pos = bufferEncode(key, buf, pos);
      pos = bufferEncode(o[key], buf, pos);
    }
  } // ##
  var len = pos - start;
  var origLen = len;
  buf[pos++] = len & 127;
  while(len > 127) {
    len >>= 7;
    buf[pos++] = 128 | len & 127;
  }
  return pos;
}

// # encode
function encode(o) { // ##
  var buf = [];
  bufferEncode(o, buf, 0);
  return buf;
}

function beginning(buf, endpos) { //##
  var c = buf[--endpos];
  var len = c & 127;
  while(c & 128) {
    c = buf[--endpos];
    len = (len << 7) | (c & 127);
  }
  return endpos - len;
}

function decode(buf, endpos) { // ##
  if(!endpos) {
    endpos = buf.length;
  }
  var c = buf[--endpos];
  var len = c & 127;
  while(c & 128) {
    c = buf[--endpos];
    len = (len << 7) | (c & 127);
  }
  var pos = endpos - len;
  switch(buf[pos++]) {
    case 0: // ### null
      return null;
    case 1: // ### string
      var result = "";
      while(pos < endpos) {
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
    case 2: // ### integer
      var result = buf[--endpos];
      while(pos < endpos) {
        result = (result << 8) | buf[--endpos];
      }
      return (result | 0);
    case 3: // ### float
      for(var i = 0; i < 8; ++i) {
        converterBytes[i] = buf[pos + i];
      }
      return converterFloat[0];
    case 4: // ### object
      function decodeObject(o, buf, pos, endpos) {
        var val = decode(buf, endpos);
        endpos = beginning(buf, endpos);
        var key = decode(buf, endpos);
        endpos = beginning(buf, endpos);
        if(pos < endpos) {
          endpos = decodeObject(o, buf, pos, endpos);
        }
        o[key] = val;
        return endpos;
      }
      var result = {};
      if(pos < endpos) {
        decodeObject(result, buf, pos, endpos);
      }
      return result;
    case 5: // ### array
      var arr = [];
      while(pos < endpos) {
        arr.push(decode(buf, endpos));
        endpos = beginning(buf, endpos);
      }
      var i = 0, j = arr.length - 1;
      while(i < j) {
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        ++i; --j;
      }
      return arr;
    case 6: // ### true
      return true;
    case 7: // ### false
      return false;
  }
}
exports.bufferEncode = bufferEncode;
exports.encode = encode;
exports.decode = decode;
