module.exports = Encoder;

var Enum   = require("./enum"),
    Writer = require("./writer"),
    types  = require("./types"),
    util   = require("./util");

/**
 * Constructs a new encoder for the specified message type.
 * @classdesc Wire format encoder using code generation on top of reflection
 * @constructor
 * @param {Type} type Message type
 */
function Encoder(type) {

    /**
     * Message type.
     * @type {Type}
     */
    this.type = type;
}

/** @alias Encoder.prototype */
var EncoderPrototype = Encoder.prototype;

// This is here to mimic Type so that fallback functions work without having to bind()
Object.defineProperties(EncoderPrototype, {

    /**
     * Fields of this encoder's message type as an array for iteration.
     * @name Encoder#fieldsArray
     * @type {Field[]}
     * @readonly
     */
    fieldsArray: {
        get: function() {
            return this.type.fieldsArray;
        }
    }
});

/**
 * Encodes a message of this encoder's message type.
 * @param {Prototype|Object} message Runtime message or plain object to encode
 * @param {Writer} [writer] Writer to encode to
 * @returns {Writer} writer
 */
EncoderPrototype.encode = function encode_fallback(message, writer) { // codegen reference and fallback
    /* eslint-disable block-scoped-var, no-redeclare */
    if (!writer)
        writer = Writer();
    var fieldsArray = this.fieldsArray,
        fieldsCount = fieldsArray.length;

    for (var fi = 0; fi < fieldsCount; ++fi) {
        var field    = fieldsArray[fi].resolve(),
            type     = field.resolvedType instanceof Enum ? "uint32" : field.type,
            wireType = types.basic[type];

        // Map fields
        if (field.map) {
            var keyType     = field.resolvedKeyType /* only valid is enum */ ? "uint32" : field.keyType,
                keyWireType = types.mapKey[keyType];
            var value, keys;
            if ((value = message[field.name]) && (keys = Object.keys(value)).length) {
                writer.tag(field.id, 2).fork();
                for (var i = 0, k = keys.length, key; i < k; ++i) {
                    writer.tag(1, keyWireType)[keyType](key = keys[i]);
                    if (wireType !== undefined)
                        writer.tag(2, wireType)[type](value[key]);
                    else
                        field.resolvedType.encode(value[key], writer.tag(2, 2).fork()).ldelim();
                }
                writer.ldelim();
            }

        // Repeated fields
        } else if (field.repeated) {
            var values = message[field.name], i = 0, k = values.length;

            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) {
                if (k) {
                    writer.tag(field.id, 2).fork();
                    while (i < k)
                        writer[type](values[i++]);
                    writer.ldelim();
                }

            // Non-packed
            } else {
                while (i < k)
                    field.resolvedType.encode(values[i++], writer.tag(field.id, 2).fork()).ldelim();
            }

        // Non-repeated
        } else {
            var value = message[field.name],
                strict = typeof field.defaultValue === 'object' || field.long;
            if (field.required || strict && value !== field.defaultValue || !strict && value != field.defaultValue) { // eslint-disable-line eqeqeq
                if (wireType !== undefined)
                    writer.tag(field.id, wireType)[type](value);
                else
                    field.resolvedType.encode(value, writer.tag(field.id, 2).fork()).ldelim();
            }
        }
    }
    return writer;
    /* eslint-enable block-scoped-var, no-redeclare */
};

/**
 * Generates an encoder specific to this encoder's message type.
 * @returns {function} Encoder function with an identical signature to {@link Encoder#encode}
 */
EncoderPrototype.generate = function generate() {
    /* eslint-disable no-unexpected-multiline */
    var fieldsArray = this.type.fieldsArray,
        fieldsCount = fieldsArray.length;
    var gen = util.codegen("m", "w")
    ("w||(w=Writer())");

    for (var i = 0; i < fieldsCount; ++i) {
        var field = fieldsArray[i].resolve();
        var type = field.resolvedType instanceof Enum ? "uint32" : field.type,
            wireType = types.basic[type],
            prop = util.safeProp(field.name);
        
        // Map fields
        if (field.map) {
            var keyType = field.resolvedKeyType /* only valid is enum */ ? "uint32" : field.keyType,
                keyWireType = types.mapKey[keyType];
            gen

    ("var ks")
    ("if(m%s&&(ks=Object.keys(m%s)).length){", prop, prop)
        ("w.tag(%d,2).fork()", field.id)
        ("var i=0")
        ("while(i<ks.length){")
            ("w.tag(1,%d).%s(ks[i])", keyWireType, keyType);
            if (wireType !== undefined) gen
            ("w.tag(2,%d).%s(m%s[ks[i++]])", wireType, type, prop);
            else gen
            ("types[%d].encode(m%s[ks[i++]],w.tag(2,2).fork()).ldelim()", i, prop);
            gen
        ("}")
        ("w.ldelim()")
    ("}");

        // Repeated fields
        } else if (field.repeated) { gen

            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) { gen

    ("if(m%s.length){", prop)
        ("w.tag(%d,2).fork()", field.id)
        ("var i=0")
        ("while(i<m%s.length)", prop)
            ("w.%s(m%s[i++])", type, prop)
        ("w.ldelim()")
    ("}");

            // Non-packed
            } else { gen

    ("var i=0")
    ("while(i<m%s.length)", prop)
        ("types[%d].encode(m%s[i++],w.tag(%d,2).fork()).ldelim()", i, prop, field.id);

            }

        // Non-repeated
        } else {
            if (!field.required) gen
    ("if(m%s%s%j)", prop, typeof field.defaultValue === 'object' || field.long ? "!==" : "!=", field.defaultValue); 
            if (wireType !== undefined) gen
        ("w.tag(%d,%d).%s(m%s)", field.id, wireType, type, prop);
            else gen
        ("types[%d].encode(m%s,w.tag(%d,2).fork()).ldelim()", i, prop, field.id);
    
        }
    }
    return gen
    ("return w")
    .eof(this.type.fullName + "$encode", {
        Writer: Writer,
        types: fieldsArray.map(function(fld) { return fld.resolvedType; })
    });
    /* eslint-enable no-unexpected-multiline */
};
