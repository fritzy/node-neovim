var net = require('net');
var msgpack5 = require('msgpack5');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

function TypeBase(id) {
    this.id = id;
}

function VimPlugin(path, cb) {
    EventEmitter.call(this);
    if (typeof cb === 'function') {
        this.once('ready', cb);
    }
    this.id = 1;
    this.rpc = {};

    this.decoder = msgpack5();
    this.decode = this.decoder.decoder({header: false})
    this.decode.on('data', function (data) {
        if (data[0] == 1) {
            this.emit('reply:' + data[1], data[3]);
        } else if (data[0] == 2) {
            console.log(data[1].toString('utf8'), data[2]);
            this.emit(data[1].toString('utf8'), data[2]);
        }
    }.bind(this));

    this.conn = net.connect({path: path}, function () {
        this.conn.pipe(this.decode);
        this.getAPI(function (result) {
            var api = result[1];
            Object.keys(api.types).forEach(function (typen) {
                var name = typen.toString();
                var typeId = api.types[typen].id;
                this.rpc[name] = function (id) {
                    this.id = id;
                    this.typeId = typeId;
                }
                var ObjType = this.rpc[name];
                if (typeId !== 35) {
                    this.decoder.register(typeId, this.rpc[name], function (obj) {
                        return obj.id;
                    },
                    function (buff) {
                        return new ObjType(buff);
                    });
                }
            }.bind(this));
            api.functions.forEach(function (func) {
                var params = [];
                func.parameters.forEach(function (p) {
                    params.push(p[0].toString());
                });
                var fname = func.name.toString().split('_').slice(1).join('_');
                if (this.rpc.hasOwnProperty(params[0])) {
                    this.rpc[params[0]].prototype[fname] = this.generateMethod(func.name.toString());
                    console.log(util.format("registering %s.%s(%s) -> %s", params[0], fname, params.slice(1).join(', '), func.return_type.toString()));
                } else {
                    this.rpc[fname] = this.generateFunction(func.name.toString());
                    console.log(util.format("registering %s(%s) -> %s", fname, params.join(', '), func.return_type.toString()));
                }
            }.bind(this));
            this.emit('ready');
        }.bind(this));
    }.bind(this));
    
    this.getAPI = this.generateFunction('vim_get_api_info', 'get_api');
}

VimPlugin.prototype = Object.create(EventEmitter.prototype);

(function () {

    this.generateFunction = function (name) {
        var self = this;
        return function () {
            var args = Array.prototype.slice.call(arguments, 0);
            var cb = args[args.length - 1];
            var args = args.slice(0, args.length - 1);
            self.send(name, args, cb);
        };
    };
    
    this.generateMethod = function (name) {
        var self = this;
        return function () {
            var args = Array.prototype.slice.call(arguments, 0);
            var cb = args[args.length - 1];
            var args = args.slice(0, args.length - 1);
            args.unshift(this);
            self.send(name, args, cb);
        };
    };

    
    this.send = function (cmdid, args, cb) {
        this.once('reply:' + this.id, cb);
        var out = this.decoder.encode([0, this.id, cmdid, args]);
        var out2 = Buffer.concat(out._bufs);
        this.conn.write(out2);
        
        this.id++;
    };

}).apply(VimPlugin.prototype);

module.exports = VimPlugin;
