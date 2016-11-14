var protobuf = require("../..");

var Namespace = protobuf.Namespace,
    Enum      = protobuf.Enum,
    Type      = protobuf.Type,
    Field     = protobuf.Field,
    OneOf     = protobuf.OneOf,
    Service   = protobuf.Service,
    Method    = protobuf.Method;

module.exports = proto_target;

var out = [];
var indent = 0;
var firstField = false;

/**
 * .proto target.
 * @param {!Object} options Target options
 * @param {function(?Error)} callback Callback
 */
function proto_target(root, options, callback) {
    process.nextTick(function() {
        try {
            root.resolveAll();
            root.nestedArray.forEach(build);
            out = ['syntax = "proto3";'].concat(out);
            callback(null, out.join('\n'));
        } catch (err) {
            callback(err);
        } finally {
            out = [];
            indent = 0;
            firstField = false;
        }
    });
}

function push(line) {
    if (line === "")
        return out.push("");
    var ind = "";
    for (var i = 0; i < indent; ++i)
        ind += "    ";
    out.push(ind + line);
}

function build(object) {
    if (!object.visible)
        return;
    if (object instanceof Enum)
        buildEnum(object);
    else if (object instanceof Type)
        buildType(object);
    else if (object instanceof Field)
        buildField(object);
    else if (object instanceof OneOf)
        buildOneOf(object);
    else if (object instanceof Service)
        buildService(object);
    else if (object instanceof Method)
        buildMethod(object);
    else
        buildNamespace(object);
}

function buildNamespace(namespace) { // just a namespace, not a type etc.
    push("");
    push("message " + namespace.name + "{");
    ++indent;
    if (namespace.nestedArray.length) {
        push("");
        namespace.nestedArray.forEach(build);
    }
    --indent;
    push("}");
}

function buildEnum(enm) {
    push("");
    push("enum " + enm.name + " {");
    ++indent;
    Object.keys(enm.values).forEach(function(name) {
        var val = enm.values[name];
        push(name + " = " + val + ";");
    });
    --indent;
    push("}");
}

function buildType(type) {
    push("");
    push("message " + type.name + " {");
    ++indent;
    type.oneofsArray.forEach(buildOneOf);
    firstField = true;
    type.fieldsArray.forEach(buildField);
    type.nestedArray.forEach(build);
    --indent;
    push("}");
}

function buildField(field) {
    if (field.partOf)
        return;
    if (firstField) {
        push("");
        firstField = false;
    }
    var sb = [];
    if (field.map)
        sb.push("map<" + field.keyType + "," + field.type + ">");
    else if (field.repeated)
        sb.push("repeated", field.type);
    else
        sb.push(field.type);
    sb.push(field.name, field.id);
    if (field.repeated && !field.packed)
        sb.push("[packed=false]");
    push(sb.join(" ") + ";");
}

function buildOneOf(oneof) {
    push("");
    push("oneof " + oneof.name + " {");
    ++indent;
    oneof.fields.forEach(buildField);
    --indent;
    push("}");
}

function buildService(service) {
    push("service " + service.name + " {");
    ++indent;
    service.methodsArray.forEach(buildMethod);
    service.nestedArray.forEach(build);
    --indent;
    push("}");
}

function buildMethod(method) {
    push(method.type + " " + method.name + " (" + (method.requestStream ? "stream " : "") + method.requestType + ") returns (" + (method.responseStream ? "stream " : "") + method.responseType + ");");
}
