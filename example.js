var VimPlugin = require('./index');
var util = require('util');
var async = require('async');

var UNIX = '/tmp/neovim1'

var vim = new VimPlugin(UNIX, function () {
    async.series([
        function (scb) {
            vim.rpc.command('au VimResized <buffer> call rpcnotify(0, "resized")', scb);
        },
        function (scb) {
            vim.rpc.subscribe("resized", scb);
        },
        function (scb) {
            vim.on('resized', function () {
                vim.rpc.get_current_window(function (window) {
                    window.get_height(function (height) {
                        window.get_width(function (width) {
                            console.log(util.format("size changed to: %dx%d", height, width));
                        });
                    });
                });
            });
            scb();
        }],
        function () {
            console.log("go ahead and resize the neovim window");
        }
    );
});
