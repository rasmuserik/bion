[![Build Status](https://travis-ci.org/solsort/bion.svg?branch=master)](https://travis-ci.org/solsort/bion)

# <img src="./icon.jpg" height=32> BInary Object Notation

BION is a data encoding, similar to JSON, BSON, MessagePack, etc. It has the following features:

- **Order preserving.** The lexicographical order is preserved, ie `encode([-10]) < encode([10, "hello"]) < encode([10, "world"])`, where `<` is the bytewise lexicographical of the encoded buffer. This is very useful in the case where the encoded data is used as key in an ordered collection.
- **Traversable.** The data structure can be traversed without unpacking/parsing the entire data structure.
- **Compact.** The encoded format is optimised for size.
- **Fast.** The encoding/decoding is very fast. Can also write into existing buffer, using zero heap-allocation on encoding.
- Later: **Rich.** - will support more data types than plain json, ie. binary buffers, keywords, sets, dates, symbols...

# API

- `bion.encode(object)` return a new array of byte values, encoding the `object`.
- `bion.bufferEncode(object, buffer, start)` encodes the `object` into an existing `buffer, with first byte written at `start` postition, and returns the end-position of the encoded object in the buffer.
- `bion.decode(buffer, endpos = buffer.length)` decodes and returns an object from a buffer.

## The format

Entities are encoded as: **type**, **data**, **length**. To traverse a Bion encoded datastructure, you only need to know the position in the buffer where it ends.

### Types

The supported types are:

- 0 null / nil
- 1 utf8-string
- 2 integer
- 3 Double
- 4 object (key/value)
- 5 array
- 6 true
- 7 false

Future types could include: binary data, keywords(cljs), Sets, Date/timestamp, symbol;
If we get to more than 128 types, then the type will take several bytes, and the most significant bit will indicate the length

### Length

This is a reverse variable byte coding of `len(type) + len(data)`. 

# Testing/benchmarking

`data/` contains the json files from https://github.com/miloyip/nativejson-benchmark/tree/master/data into `data/`, as well as a `sample.json`, - which are used for benchmarking/testing.

- `node bench.js` runs the benchmark
- `SIMPLEBENCH=true node bench` only runs the tests from sample.json
- `FASTBENCH=true node bench` runs fewer iterations, and does not benchmark against msgpack/bson.

