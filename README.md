[![website](https://img.shields.io/badge/website-bion.solsort.com-blue.svg)](https://bion.solsort.com/)
[![github](https://img.shields.io/badge/github-solsort/bion-blue.svg)](https://github.com/solsort/bion)
[![travis](https://img.shields.io/travis/solsort/bion.svg)](https://travis-ci.org/solsort/bion)
[![npm](https://img.shields.io/npm/v/bion.svg)](https://www.npmjs.com/package/bion)

# Binary Immutable Object Notation <img src="https://bion.solsort.com/icon.png" height=32>

BION is compact traversable serialisation of JSON to binary data. Similar to BSON, MessagePack, etc.

It is designed to be

There are several versions:

- version 0.2 Support for **Uint8Array** in addition to standard JSON types. Returns Uint8Array instead of 8-bit string. Format is designed to be able to support fast traversal of large data later on (B+-tree-like index for objects, and direct lookup of index for arrays).
- version 0.1 **Order preserving**. Returns 8-bit string.

# Performance measurements

Initial version, numbers are relative.

Notice that only bion and bson are traversable, which cost performance/size.

## Microbenchmarks

```
         Encoding time       Decoding time         Size(bytes)
       json bn1 bn2 msgp | json bn1 bn2 msgp | json bn1 bn2 msgp
null     19   7  52   46 |    5  11   4    3 |    4   2   1    1
string   25  13  72  117 |   11  32  28   35 |   13  13  12   12
natural  20   7  53   63 |    6   9   4    4 |    4   4   3    3
float    32  10  60   64 |   13  12   9   12 |    7  10   9    9
neg      20   7  53   61 |    6  10   4    4 |    5   6   3    3
true     19   6  51   42 |    5   9   4    3 |    4   2   1    1
false    19   6  53   42 |    5   9   3    3 |    5   2   1    1
utf8     30  21  77  121 |   16  40  32   38 |   15  18  17   17
array    41  12  60  139 |   29  41  63    8 |    7  11   4    4
obj1     71  47 110 1504 |   80 148 161  165 |   41  32  21   18
obj2     50  34  89  810 |   53 136 136  180 |   26  21  16   15
obj3     90  44 107 1224 |   68 173 178  181 |   29  26  19   17
```

## Benchmarks

```
            Encoding time          Decoding time               Size(KB)
        json bn1 bn2 msg bsn | json bn1 bn2 msg bsn | json bon1 bon2 msgp bson
twitter    2  14   9  38  12 |    5  36  44  17  12 |  403  428  402  403  444
citm       6  18   9  99  39 |   10  26  40  27  23 |  500  408  346  342  479
canada    30  41  17  57 104 |   31  59  82  23 115 | 2090 1223 1056 2056 1794
```

# Bion 0.2

## API

- `bion.encode(object)` returns new `Uint8Array`
- `bion.decode(Uint8Array)` returns object.

## The format

The first byte of every value contains a 3-bit type and a 5-bit number. 

If the number is less than 30, - it is just a number.
If the number is 30, the number continues in the next bytes using variable byte encoding (add 30 to the result).
If the number is 31, then this is a special object (constant or similar)

Types based on first byte:

- Numbers + null
    - 0x00-0x1E The number is parsed as a negative integer
    - 0x1f The next 8 bytes contains a double precision floating point.
    - 0x20-0x3E The number is parsed as a positive integer
    - 0x3F null
- Strings/data + Booleans
    - 0x40-0x5E UTF-8 encoded string. The number is the length in bytes.
    - 0x5F true
    - 0x60-0x7E Binary Data. The number is the length in bytes.
    - 0x7F false
- Unindexed Arrays/Objects
    - 0x80-0x9E Array-stream. Number is entry-count + 1 (or 0, if terminated by End-of-stream (not implemented yet))
    - 0x9F End-of-stream
    - 0xA0-0xBE Obj-stream. Number is entry-count + 1 (or 0, if terminated by End-of-stream (not implemented yet)).
    - 0xBF unassigned
- Indexed data (not implemented yet)
    - 0xC0-0xDE Array (number is number of entries/indices + bytes per index). Then there is a list of entries, and finally the actual data.
    - 0xDF unassigned
    - 0xE0-0xFE Object (number is number of entries/indices + bytes per index). Then there is a list of entries, and finally the actual data.
    - 0xDF unassigned

# Bion 0.1 (deprecated)

BION is a data encoding, similar to JSON, BSON, MessagePack, etc. It has the following features:

- **Order preserving.** The lexicographical order is preserved, ie `encode([-10]) < encode([10, "hello"]) < encode([10, "world"])`, where `<` is the bytewise lexicographical of the encoded buffer. This is very useful in the case where the encoded data is used as key in an ordered collection.
- **Traversable.** The data structure can be traversed without unpacking/parsing the entire data structure.
- **Compact.** The encoded format is optimised for size.
- **Fast.** The encoding/decoding is very fast. Can also write into existing buffer, using zero heap-allocation on encoding.

## API

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

