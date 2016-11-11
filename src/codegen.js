module.exports = codegen;

/**
 * Whether code generation is supported by the environment.
 * @memberof util
 * @type {boolean}
 */
codegen.supported = false;
try { codegen.supported = codegen("a","b")("return a-b").eof()(2,1) === 1; } catch (e) {} // eslint-disable-line no-empty

/**
 * When set to true, codegen will log generated code to console. Useful for debugging.
 * @memberof util
 * @type {boolean}
 */
codegen.verbose = false;

/**
 * Appends a printf-like formatted line to the generated source. Returned when calling {@link util.codegen}.
 * @typedef util.CodegenAppender
 * @type {function}
 * @param {string} format A printf-like format string
 * @param {...*} params Format replacements
 * @returns {util.CodegenAppender} Itself
 * @see {@link https://nodejs.org/docs/latest/api/util.html#util_util_format_format_args}
 */

/**
 * Programmatically generates a function.
 * @memberof util
 * @param {...string} params Function parameter names
 * @returns {util.CodegenAppender} Printf-like appender function
 */
function codegen(/* varargs */) {
    var args   = Array.prototype.slice.call(arguments),
        src    = [],
        indent = 1;

    /**
     * Appends a printf-like formatted line to the generated source. This function is returned when calling {@link util.codegen}.
     * @param {string} format A printf-like format string
     * @param {...*} params Format replacements
     * @returns {util.CodegenAppender} Itself
     * @inner
     */
    function gen(format/*, varargs */) {
        var params = Array.prototype.slice.call(arguments, 1),
            index  = 0;
        var line = format.replace(/%([djs])/g, function($0, $1) {
            var param = params[index++];
            return $1 === "j"
                ? JSON.stringify(param)
                : String(param);
        });
        var level = indent;
        if (src.length) {
            var prev = src[src.length - 1];
            if (/[\{\[\:]$/.test(prev)) // block open before (increment and keep)
                level = ++indent;
            else if (/^\s*(?:if|else if|while|for)\b|\b(?:else)\s*$/.test(prev)) // branch without block before (increment once)
                ++level;
            else if (/\b(?:break|continue);?$/.test(prev)) // control flow before (decrement and keep)
                level = --indent;
            
            if (/^[\}\]]/.test(line)) // block close on line (decrement and keep)
                level = --indent;
        }
        for (index = 0; index < level; ++index)
            line = "\t" + line;
        src.push(line);
        return gen;
    }

    /**
     * Converts the so far generated source to a string.
     * @param {string} [name] Function name, defaults to generate an anonymous function
     * @returns {string} Function source
     */
    gen.toString = function toString(name) {
        return "function " + (name ? name.replace(/[^\w_$]/g, "_") : "") + "(" + args.join(",") + ") {\n" + src.join("\n") + "\n}";
    };

    /**
     * Ends generation and builds the function.
     * @param {string} [name] Function name, defaults to generate an anonymous function
     * @param {Object|Array} [scope] Function scope
     * @returns {function} A function to apply the scope manually when `scope` is an array, otherwise the generated function with scope applied
     */
    gen.eof = function eof(name, scope) {
        if (name && typeof name === 'object') {
            scope = name;
            name = undefined;
        }
        var code = gen.toString(name);
        if (codegen.verbose)
            console.log("--- codegen ---\n" + code.replace(/^/mg, "> ").replace(/\t/g, "  ")); // eslint-disable-line no-console
        code = "return " + code;
        var params, values = [];
        if (Array.isArray(scope)) {
            params = scope.slice();
        } else if (scope) {
            params = Object.keys(scope);
            values = params.map(function(key) { return scope[key]; });
        } else
            params = [];
        var fn = Function.apply(null, params.concat(code)); // eslint-disable-line no-new-func
        return values ? fn.apply(null, values) : fn();
    };

    return gen;
}
