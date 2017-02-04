// jshint esversion: 6, -W083
const fs = require('fs');
const spawn = require('child_process').spawn;
const R = require('ramda');
const shoe = require('shoe');
const http = require('http');
const split = require('split');

const parseConfig = require('./parse-config');

const logFilePath = '/var/log/remote-spawn.log';
 
const console = require('tracer').console({
    transport: (data) => {
        fs.appendFile(logFilePath, data.output + '\n', (err) => {
            if (err) throw err;
        });
    }
});

module.exports = function create(server, cb) {
    console.log('Parsing config');
    parseConfig( (err, config) => {
        if (err) {
            console.error(err);
            return cb(err);
        }

        const createSocket = (mappings)=> {
            let url = `/${mappings[0].endpoint}`;
            console.log(`Installing socket server at ${url}`);
            let sock = shoe(function (stream) {
                console.log(`New connection to ${url}`);
                stream.pipe(split()).on('data', (line)=>{
                    console.log('received',line);    
                    for(let {re, cli} of mappings) {
                        let m = line.match(re);
                        if (m) {
                            console.log(`Matching ${re}`);
                            console.log(m);
                            console.log(`Running ${cli}`);
                            let command = spawn(cli, {
                                cwd: process.env.HOME,
                                env: process.env,
                                uid: 1000,  // TODO
                                gid: 1000,
                                shell: true
                            });
                            command.stdout.pipe(split()).on('data', (line)=>{
                                console.log('stdout', line);
                                stream.write(line + '\n');
                            });
                            command.on('close', (code)=>{
                                console.log(`${cli} ended with code ${code}`);
                            });
                        }
                    }
                });
            });
            sock.install(server, url);
        };

        let createSockets = R.forEach(createSocket);
        createSockets(R.values(config));
        cb(null);
    });
};
