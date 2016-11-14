module.exports = Verifier;

var Enum = require("./enum"),
    Type = require("./type"),
    util = require("./util");

/**
 * Constructs a new verifier for the specified message type.
 * @classdesc Runtime message verifier using code generation on top of reflection
 * @constructor
 * @param {Type} type Message type
 */
function Verifier(type) {

    /**
     * Message type.
     * @type {Type}
     */
    this.type = type;
}

/** @alias Verifier.prototype */
var VerifierPrototype = Verifier.prototype;

/**
 * Verifies a runtime message of this verifier's message type.
 * @param {Prototype|Object} message Runtime message or plain object to verify
 * @returns {boolean} `true` if valid, otherwise `false`
 */
VerifierPrototype.verify = function verify_fallback(message) {
    var fields = this.type.fieldsArray, i = 0, k = fields.length;
    while (i < k) {
        var field = fields[i++].resolve(),
            value = message[field.name];
        if (value === undefined || value === null) {
            if (field.required)
                return false;
        } else if (field.resolvedType instanceof Enum && field.resolvedType.valuesById[value] === undefined)
            return false;
        else if (field.resolvedType instanceof Type)
            if (!field.resolvedType.verify(value))
                return false;
    }
    return true;
};

/**
 * Generates a verifier specific to this verifier's message type.
 * @returns {function} Verifier function with an identical signature to {@link Verifier#verify}
 */
VerifierPrototype.generate = function generate() {
    /* eslint-disable no-unexpected-multiline */
    var fields = this.type.fieldsArray;
    var gen = util.codegen("m");
    for (var i = 0, k = fields.length; i < k; ++i) {
        var field = fields[i].resolve(),
            prop  = util.safeProp(field.name);
        if (field.required) { gen

            ("if(m%s===undefined||m%s===null)", prop, prop)
                ("return false");

        } else if (field.resolvedType instanceof Enum) {
            var values = util.toArray(field.resolvedType.values); gen

            ("switch(m%s){", prop)
                ("default:")
                    ("return false");

            for (var j = 0, l = values.length; j < l; ++j) gen
                ("case %d:", values[j]); gen
            ("}");

        } else if (field.resolvedType instanceof Type) { gen

            ("if(!$t[%d].verify(m%s))", i, prop)
                ("return false");

        }

    }
    return gen("return true").eof(this.type.fullName + "$verify", {
        $t: fields.map(function(fld) { return fld.resolvedType; })
    });
    /* eslint-enable no-unexpected-multiline */
};
