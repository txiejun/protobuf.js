module.exports = Writer;

Writer.BufferWriter = BufferWriter;

var LongBits = require("./longbits"),
    util     = require("./util"),
    ieee754  = require("../lib/ieee754");

function Op(fn, len, val) {
    this.fn = fn;
    this.len = len;
    this.val = val;
    this.next = null;
}

function noop() {} // eslint-disable-line no-empty-function

function State(writer) {
    this._head = writer._head;
    this._tail = writer._tail;
    this.len   = writer.len;
}

/**
 * Constructs a new writer.
 * When called as a function, returns an appropriate writer for the current environment.
 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
 * @exports Writer
 * @constructor
 */
function Writer() {
    if (!(this instanceof Writer))
        return util.Buffer
            ? new BufferWriter()
            : new Writer();

    /**
     * Current length.
     * @type {number}
     */
    this.len = 0;

    /**
     * Operations head.
     * @type {Op}
     * @private
     */
    this._head = new Op(noop, 0, 0);

    /**
     * Operations tail
     * @type {Op}
     * @private
     */
    this._tail = this._head;

    /**
     * State stack.
     * @type {State[]}
     * @private
     */
    this._stack = [];

    // When a value is written, the writer calculates its byte length and puts it into a linked
    // list of operations to perform when finish() is called. This both allows us to allocate
    // buffers of the exact required size and reduces the amount of work we have to do compared
    // to first calculating over objects and then encoding over objects. In our case, the encoding
    // part is just a linked list walk calling linked operations with already prepared values.
}

/** @alias Writer.prototype */
var WriterPrototype = Writer.prototype;

/**
 * Pushes a new operation to the queue.
 * @param {function} fn Function to apply
 * @param {number} len Value length
 * @param {number} val Value
 * @returns {Writer} `this`
 * @private
 */
WriterPrototype._push = function push(fn, len, val) {
    var op = new Op(fn, len, val);
    this._tail.next = op;
    this._tail = op;
    this.len += len;
    return this;
};

function writeByte(buf, pos, val) {
    buf[pos] = val;
}

/**
 * Writes a tag.
 * @param {number} id Field id
 * @param {number} wireType Wire type
 * @returns {Writer} `this`
 */
WriterPrototype.tag = function write_tag(id, wireType) {
    return this._push(writeByte, 1, (id << 3 | wireType & 7) & 255);
};

function writeVarint32(buf, pos, val) {
    while (val > 127) {
        buf[pos++] = val & 127 | 128;
        val >>>= 7;
    }
    buf[pos] = val;
}

/**
 * Writes an unsigned 32 bit value as a varint.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.uint32 = function write_uint32(value) {
    value >>>= 0;
    return this._push(writeVarint32,
          value < 128       ? 1
        : value < 16384     ? 2
        : value < 2097152   ? 3
        : value < 268435456 ? 4
        :                     5
    , value);
};

/**
 * Writes a signed 32 bit value as a varint.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.int32 = WriterPrototype.uint32;

/**
 * Writes a 32 bit value as a varint, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.sint32 = function write_sint32(value) {
    return this.uint32(value << 1 ^ value >> 31);
};

function writeVarint64(buf, pos, bits) {
    // tends to deoptimize. stays optimized when using bits directly.
    while (bits.hi || bits.lo > 127) {
        buf[pos++] = bits.lo & 127 | 128;
        bits.lo = (bits.lo >>> 7 | bits.hi << 25) >>> 0;
        bits.hi >>>= 7;
    }
    buf[pos++] = bits.lo;
}

/**
 * Writes an unsigned 64 bit value as a varint.
 * @param {Long|number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.uint64 = function write_uint64(value) {
    var bits;
    if (typeof value === 'number')
        bits = value ? LongBits.fromNumber(value) : LongBits.zero;
    else
        bits = new LongBits(value.low >>> 0, value.high >>> 0);
    return this._push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a signed 64 bit value as a varint.
 * @function
 * @param {Long|number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.int64 = WriterPrototype.uint64;

/**
 * Writes a signed 64 bit value as a varint, zig-zag encoded.
 * @param {Long|number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.sint64 = function sint64(value) {
    var bits = LongBits.from(value).zzEncode();
    return this._push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a boolish value as a varint.
 * @param {boolean} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.bool = function write_bool(value) {
    return this._push(writeByte, 1, value ? 1 : 0);
};

function writeFixed32(buf, pos, val) {
    buf[pos++] =  val         & 255;
    buf[pos++] =  val >>> 8   & 255;
    buf[pos++] =  val >>> 16  & 255;
    buf[pos  ] =  val >>> 24  & 255;
}

/**
 * Writes a 32 bit value as fixed 32 bits.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.fixed32 = function write_fixed32(value) {
    return this._push(writeFixed32, 4, value >>> 0);
};

/**
 * Writes a 32 bit value as fixed 32 bits, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.sfixed32 = function write_sfixed32(value) {
    return this._push(writeFixed32, 4, value << 1 ^ value >> 31);
};

function writeFixed64(buf, pos, bits) {
    var lo = bits.lo,
        hi = bits.hi;
    buf[pos++] = lo        & 255;
    buf[pos++] = lo >>> 8  & 255;
    buf[pos++] = lo >>> 16 & 255;
    buf[pos++] = lo >>> 24      ;
    buf[pos++] = hi        & 255;
    buf[pos++] = hi >>> 8  & 255;
    buf[pos++] = hi >>> 16 & 255;
    buf[pos  ] = hi >>> 24      ;
}

/**
 * Writes a 64 bit value as fixed 64 bits.
 * @param {Long|number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.fixed64 = function write_fixed64(value) {
    return this._push(writeFixed64, 8, LongBits.from(value));
};

/**
 * Writes a 64 bit value as fixed 64 bits, zig-zag encoded.
 * @param {Long|number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.sfixed64 = function write_sfixed64(value) {
    return this._push(writeFixed64, 8, LongBits.from(value).zzEncode());
};

function writeFloat(buf, pos, val) {
    ieee754.write(buf, val, pos, false, 23, 4);
}

/**
 * Writes a float (32 bit).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.float = function write_float(value) {
    return this._push(writeFloat, 4, value);
};

function writeDouble(buf, pos, val) {
    ieee754.write(buf, val, pos, false, 52, 8);
}

/**
 * Writes a double (64 bit float).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.double = function write_double(value) {
    return this._push(writeDouble, 8, value);
};

function writeBytes(buf, pos, val) {
    for (var i = 0, k = val.length; i < k; ++i)
        buf[pos + i] = val[i];
}

/**
 * Writes a sequence of bytes.
 * @param {number[]} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.bytes = function write_bytes(value) {
    var len = value.length >>> 0;
    return len
        ? this.uint32(len)._push(writeBytes, len, value)
        : this._push(writeByte, 1, 0);
};

function writeString(buf, pos, val) {
    for (var i = 0, len = val.length, c1, c2; i < len; ++i) {
        c1 = val.charCodeAt(i);
        if (c1 < 128) {
            buf[pos++] = c1;
        } else if (c1 < 2048) {
            buf[pos++] = c1 >> 6 | 192;
            buf[pos++] = c1 & 63 | 128;
        } else if ((c1 & 0xFC00) === 0xD800 && i + 1 < len && ((c2 = val.charCodeAt(i + 1)) & 0xFC00) === 0xDC00) {
            c1 = 0x10000 + ((c1 & 0x03FF) << 10) + (c2 & 0x03FF);
            ++i;
            buf[pos++] = c1 >> 18      | 240;
            buf[pos++] = c1 >> 12 & 63 | 128;
            buf[pos++] = c1 >> 6  & 63 | 128;
            buf[pos++] = c1       & 63 | 128;
        } else {
            buf[pos++] = c1 >> 12      | 224;
            buf[pos++] = c1 >> 6  & 63 | 128;
            buf[pos++] = c1       & 63 | 128;
        }
    }
}

function byteLength(value) {
    var strlen = value.length >>> 0;
    if (strlen) {
        var len = 0;
        for (var i = 0, c1; i < strlen; ++i) {
            c1 = value.charCodeAt(i);
            if (c1 < 128)
                len += 1;
            else if (c1 < 2048)
                len += 2;
            else if ((c1 & 0xFC00) === 0xD800 && i + 1 < strlen && (value.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
                ++i;
                len += 4;
            } else
                len += 3;
        }
        return len;
    }
    return 0;
}

/**
 * Writes a string.
 * @param {string} value Value to write
 * @returns {Writer} `this`
 */
WriterPrototype.string = function write_string(value) {
    var len = byteLength(value);
    return len
        ? this.uint32(len)._push(writeString, len, value)
        : this._push(writeByte, 1, 0);
};

/**
 * Forks this writer's state by pushing it to a stack and reusing the remaining buffer
 * for a new set of write operations. A call to {@link Writer#reset} or {@link Writer#finish}
 * resets the writer to the previous state.
 * @returns {Writer} `this`
 */
WriterPrototype.fork = function fork() {
    this._stack.push(new State(this));
    this._head = this._tail = new Op(noop, 0, 0);
    this.len = 0;
    return this;
};

/**
 * Resets this instance to the last state. If there is no last state, all references
 * to previous buffers will be cleared.
 * @returns {Writer} `this`
 */
WriterPrototype.reset = function reset() {
    if (this._stack.length) {
        var state = this._stack.pop();
        this._head = state._head;
        this._tail = state._tail;
        this.len   = state.len;
    } else {
        this._head = this._tail = new Op(noop, 0, 0);
        this.len = 0;
    }
    return this;
};

/**
 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
 * @returns {Writer} `this` 
 */
WriterPrototype.ldelim = function ldelim() {
    var head = this._head,
        tail = this._tail,
        len  = this.len;
    this.reset();
    this.uint32(len);
    this._tail.next = head.next; // skip noop
    this._tail = tail;
    this.len += len;
    return this;
};

var ArrayImpl =  typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

/**
 * Finishes the current sequence of write operations and frees all resources.
 * @returns {number[]} Finished buffer
 */
WriterPrototype.finish = function finish() {
    var head = this._head.next, // skip noop
        buf  = new ArrayImpl(this.len),
        pos  = 0;
    this.reset();
    while (head) {
        head.fn(buf, pos, head.val, head.len);
        pos += head.len;
        head = head.next;
    }
    return buf;
};

/**
 * Constructs a new buffer writer.
 * @classdesc Wire format writer using node buffers.
 * @exports BufferWriter
 * @extends Writer
 * @constructor
 */
function BufferWriter() {
    Writer.call(this);
}

/** @alias BufferWriter.prototype */
var BufferWriterPrototype = BufferWriter.prototype = Object.create(Writer.prototype);
BufferWriterPrototype.constructor = BufferWriter;

function writeFloatBuffer(buf, pos, val) {
    buf.writeFloatLE(val, pos, true);
}

/**
 * Writes a float (32 bit) using node buffers.
 * @param {number} value Value to write
 * @returns {BufferWriter} `this`
 */
BufferWriterPrototype.float = function write_float_buffer(value) {
    return this._push(writeFloatBuffer, 4, value);
};

function writeDoubleBuffer(buf, pos, val) {
    buf.writeDoubleLE(val, pos, true);
}

/**
 * Writes a double (64 bit float) using node buffers.
 * @param {number} value Value to write
 * @returns {BufferWriter} `this`
 */
BufferWriterPrototype.double = function write_double_buffer(value) {
    return this._push(writeDoubleBuffer, 8, value);
};

function writeBytesBuffer(buf, pos, val) {
    val.copy(buf, pos, 0, val.length);
}

/**
 * Writes a sequence of bytes using node buffers.
 * @param {Buffer} value Value to write
 * @returns {BufferWriter} `this`
 */
BufferWriterPrototype.bytes = function write_bytes_buffer(value) {
    var len = value.length >>> 0;
    return len
        ? this.uint32(len)._push(writeBytesBuffer, len, value)
        : this._push(writeByte, 1, 0);
};

function writeStringBuffer(buf, pos, val, len) {
    buf.write(val, pos, len);
}

/**
 * Writes a string using node buffers.
 * @param {string} value Value to write
 * @returns {BufferWriter} `this`
 */
BufferWriterPrototype.string = function write_string_buffer(value) {
    var len = byteLength(value);
    return len
        ? this.uint32(len)._push(writeStringBuffer, len, value)
        : this._push(writeByte, 1, 0);
};

/**
 * Finishes the current sequence of write operations using node buffers and frees all resources.
 * @returns {Buffer} Finished buffer
 */
BufferWriterPrototype.finish = function finish_buffer() {
    var head = this._head.next, // skip noop
        buf  = new util.Buffer(this.len),
        pos  = 0;
    this.reset();
    while (head) {
        head.fn(buf, pos, head.val, head.len);
        pos += head.len;
        head = head.next;
    }
    return buf;
};
