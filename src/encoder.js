"use strict";
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
    var fieldsArray = this.fieldsArray;
    for (var fi = 0; fi < fieldsArray.length; ++fi) {
        var field    = fieldsArray[fi].resolve(),
            type     = field.resolvedType instanceof Enum ? "uint32" : field.type,
            wireType = types.basic[type];

        // Map fields
        if (field.map) {
            var keyType     = field.resolvedKeyType /* only valid is enum */ ? "uint32" : field.keyType,
                keyWireType = types.mapKey[keyType];
            var value, keys;
            if ((value = message[field.name]) && (keys = Object.keys(value)).length) {
                writer.fork(field.id);
                for (var i = 0; i < keys.length; ++i) {
                    writer.tag(1, keyWireType)[keyType](keys[i]);
                    if (wireType !== undefined)
                        writer.tag(2, wireType)[type](value[keys[i]]);
                    else
                        field.resolvedType.encode(value[keys[i]], writer.fork(2)).ldelim(true);
                }
                writer.ldelim(false);
            }

        // Repeated fields
        } else if (field.repeated) {
            var values = message[field.name];
            if (values && values.length) {

                // Packed repeated
                if (field.packed && types.packed[type] !== undefined) {
                    writer.fork(field.id);
                    var i = 0;
                    while (i < values.length)
                        writer[type](values[i++]);
                    writer.ldelim();

                // Non-packed
                } else {
                    var i = 0;
                    while (i < values.length)
                        field.resolvedType.encode(values[i++], writer.fork(field.id)).ldelim(true);
                }

            }

        // Non-repeated
        } else {
            var value    = message[field.name], 
                required = field.required;
            if (required || value !== undefined && value !== field.defaultValue) { // eslint-disable-line eqeqeq
                if (wireType !== undefined)
                    writer.tag(field.id, wireType)[type](value);
                else
                    field.resolvedType.encode(value, writer.fork(field.id)).ldelim(required);
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
    var fieldsArray = this.type.fieldsArray;
    var gen = util.codegen("m", "w")
    ("w||(w=Writer())");

    for (var i = 0; i < fieldsArray.length; ++i) {
        var field = fieldsArray[i].resolve();
        var type = field.resolvedType instanceof Enum ? "uint32" : field.type,
            wireType = types.basic[type],
            prop = util.safeProp(field.name);
        
        // Map fields
        if (field.map) {
            var keyType = field.resolvedKeyType /* only valid is enum */ ? "uint32" : field.keyType,
                keyWireType = types.mapKey[keyType];
            gen

    ("if(m%s){", prop)
        ("w.fork(%d)", field.id)
        ("var i=0,ks=Object.keys(m%s)", prop)
        ("while(i<ks.length){")
            ("w.tag(1,%d).%s(ks[i])", keyWireType, keyType);
            if (wireType !== undefined) gen
            ("w.tag(2,%d).%s(m%s[ks[i++]])", wireType, type, prop);
            else gen
            ("types[%d].encode(m%s[ks[i++]],w.fork(2)).ldelim(true)", i, prop);
            gen
        ("}")
        ("w.ldelim()")
    ("}");

        // Repeated fields
        } else if (field.repeated) {

            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) { gen

    ("if(m%s){", prop)
        ("w.fork(%d)", field.id)
        ("var i=0")
        ("while(i<m%s.length)", prop)
            ("w.%s(m%s[i++])", type, prop)
        ("w.ldelim()")
    ("}");

            // Non-packed
            } else { gen

    ("if(m%s){", prop)
        ("var i=0")
        ("while(i<m%s.length)", prop)
            ("types[%d].encode(m%s[i++],w.fork(%d)).ldelim(true)", i, prop, field.id)
    ("}");

            }

        // Non-repeated
        } else {
            if (!field.required) gen
    ("if(m%s!==undefined&&m%s!==%j)", prop, prop, field.defaultValue); 
            if (wireType !== undefined) gen
        ("w.tag(%d,%d).%s(m%s)", field.id, wireType, type, prop);
            else gen
        ("types[%d].encode(m%s,w.fork(%d)).ldelim(%j)", i, prop, field.id, field.required);
    
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
