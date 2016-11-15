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
var first = false;

/**
 * .proto target.
 * @param {!Object} options Target options
 * @param {function(?Error)} callback Callback
 */
function proto_target(root, options, callback) {
    process.nextTick(function() {
        try {
            buildRoot(root);
            callback(null, out.join('\n'));
        } catch (err) {
            callback(err);
        } finally {
            out = [];
            indent = 0;
            first = false;
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

function buildRoot(root) {
    root.resolveAll();
    var pkg = [];
    var ptr = root;
    do {
        var nested = ptr.nestedArray.filter(isBuilt);
        if (nested.length === 1 && nested[0] instanceof Namespace && nested[0].plain) {
            ptr = nested[0];
            if (ptr !== root)
                pkg.push(ptr.name);
        } else
            break;
    } while (true);
    if (pkg.length)
        out.push("package " + pkg.join(".") + ";", "");
    out.push('syntax = "proto3";');
    ptr.nestedArray.forEach(build);
}

function isBuilt(object) {
    if (!object.visible)
        return false;
    return true;    
}

function build(object) {
    if (!isBuilt(object))
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
    push("message " + namespace.name + " {");
    ++indent;
    consolidateExtends(namespace.nestedArray).remaining.forEach(build);
    --indent;
    push("}");
}

function buildEnum(enm) {
    push("");
    push("enum " + enm.name + " {");
    ++indent; first = true;
    Object.keys(enm.values).forEach(function(name) {
        var val = enm.values[name];
        if (first) {
            push("");
            first = false;
        }
        push(name + " = " + val + ";");
    });
    --indent; first = false;
    push("}");
}

function buildType(type) {
    push("");
    push("message " + type.name + " {");
    ++indent;
    type.oneofsArray.forEach(build);
    first = true;
    type.fieldsArray.forEach(build);
    consolidateExtends(type.nestedArray).remaining.forEach(build);
    --indent;
    push("}");
}

function buildField(field) {
    if (field.partOf || field.declaringType || field.extend !== undefined)
        return;
    if (first)
        first = false, push("");
    var sb = [];
    if (field.map)
        sb.push("map<" + field.keyType + ", " + field.type + ">");
    else if (field.repeated)
        sb.push("repeated", field.type);
    else
        sb.push(field.type);
    sb.push(field.name, field.id);
    if (field.repeated && !field.packed)
        sb.push("[packed=false]");
    push(sb.join(" ") + ";");
}

function consolidateExtends(nested) {
    var ext = {};
    nested = nested.filter(function(obj) {
        if (!(obj instanceof Field) || obj.extend === undefined)
            return true;
        (ext[obj.extend] || (ext[obj.extend] = [])).push(obj);
        return false;
    });
    Object.keys(ext).forEach(function(extend) {
        push("");
        push("extend " + extend + " {");
        ++indent; first = true;
        ext[extend].forEach(buildField);
        --indent;
        push("}");
    });
    return {
        remaining: nested
    };
}

function buildOneOf(oneof) {
    push("");
    push("oneof " + oneof.name + " {");
    ++indent; first = true;
    oneof.oneof.forEach(function(fieldName) {
        var field = oneof.parent.get(fieldName);
        if (first)
            push(""), first = false;
        push(field.type + " " + field.name + " = " + field.id + ";");
    });
    --indent;
    push("}");
}

function buildService(service) {
    push("service " + service.name + " {");
    ++indent;
    service.methodsArray.forEach(build);
    consolidateExtends(service.nestedArray).remaining.forEach(build);
    --indent;
    push("}");
}

function buildMethod(method) {
    push(method.type + " " + method.name + " (" + (method.requestStream ? "stream " : "") + method.requestType + ") returns (" + (method.responseStream ? "stream " : "") + method.responseType + ");");
}
