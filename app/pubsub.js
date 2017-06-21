const _ = require('underscore');
const REDIS_CHANNEL_NAME = 'plenario_observations';

exports.setUpRedis = setUpRedis;
exports.setUpSocketIo = setUpSocketIo;
exports.parseArgs = parseArgs;

function setUpRedis(redis, io) {
    redis.subscribe(REDIS_CHANNEL_NAME);
    redis.on('message', (channel, msg) => { 
        let observations;
        try {
            observations = JSON.parse(msg);
        }
        catch (e) {
            console.log('Could not parse observations: ' + e);
            return;
        }
        
        const sockets = _.values(io.sockets.connected);
        // io.sockets gives the default namespace.
        // namespace.connected gives hash of id to socket for all connected clients.
        for (let o of observations) {
            const eligibleSockets = sockets.filter(s => shouldSend(s.args, o))
            for (let s of eligibleSockets) {
                s.emit('data', o);
            }
        }
    });
}

class SensorTreeCache {
    constructor(pg) {
        this.pg = pg;
        setInterval(this._refreshSensorTree.bind(this), 1000*60*10);
    }
    // Returns promise to signal that cache has a tree
    seed() {
        return this._refreshSensorTree();
    }
    _refreshSensorTree() {
        return this.pg.query('SELECT sensor_tree();')
        .then(tree => {
            this.sensorTree = tree;
            return this;
        });
    }
}

function setUpSocketIo(pg, io) {
    const sensorTreeCache = new SensorTreeCache(pg);
    return sensorTreeCache.seed()
    .then(treeCache => _setUpSocketIo(io, treeCache));
}

function _setUpSocketIo(io, treeCache) {
     io.on('connection', function (socket) {
        const args = parseArgs(socket.handshake.query, treeCache.sensorTree);
        if (args.err) {
            socket.emit('internal_error', {error: args.err});
            socket.disconnect();
        }
        socket.args = args;
    });
}

function shouldSend(args, observation) {
    const {sensor, node, network, feature} = observation.attributes;
    const {sensors, nodes, networks, features} = args;
    const pairs = [[networks, network], [nodes, node], [sensors, sensor], [features, feature]];
    return pairs.every(([set, individual]) => set.has(individual));
}

/**
 * 
 * @param {*} rawArgs
 *  User provided query arguments 
 * @param {*} tree
 *  Sensor network metadata in format provided py postgres sensor_tree procedure
 */
function parseArgs(rawArgs, tree) {
    const args = {};
    const networkName = rawArgs.network;
    if (!networkName) {
        return {err: 'You must specify a sensor network'};
    }
    // For consistency, make networks a list of length one.
    args.networks = new Set([networkName]);

    const optionalFields = ['nodes', 'sensors', 'features'];
    for (let f of optionalFields) {
        if (rawArgs[f]) {
            try {
                args[f] = rawArgs[f].toString().toLowerCase().split(',');
            }
            catch (err) {
                return {err: `Could not parse argument ${f}=${rawArgs[f]}`};
            }
        }
    }

    const network = tree[networkName];
    if (!network) {
        return {err: `The network ${network} does not exist`};
    }
    if (args.nodes) {
        const invalidNodes = args.nodes.filter(n => !(n in network));
        if (invalidNodes.length > 0) {
            return {err: `Nodes ${formatSet(invalidNodes)} are not in network ${networkName}.`}
        }
    }
    else {
        args.nodes = _.keys(network);
    }
    args.nodes = new Set(args.nodes);
    
    const viableSensors = {};
    for (let nodeName of args.nodes) {
        const node = network[nodeName];
        Object.assign(viableSensors, node);
    }
    if (args.sensors) {
        const invalidSensors = args.sensors.filter(s => !(s in viableSensors));
        if (invalidSensors.length > 0) {
            return {err: `Sensors ${formatSet(invalidSensors)} are not in nodes ${formatSet(args.nodes)}.`}
        }
    }
    else {
        args.sensors = _.keys(viableSensors);
    }
    const trimmedSensors = _.pick(viableSensors, ...args.sensors);
    args.sensors = new Set(args.sensors);

    
    // BUG. I failed to trim the tree here.
    // {sensorName: {beehiveNickame: feature.property}}
    const observedProperties = _.flatten(_.values(trimmedSensors).map(_.values));
    const viableFeatures = [...new Set(observedProperties.map(op => op.split('.')[0]))];
    if (!args.features) {
        args.features = viableFeatures;
    }
    else {
        // console.log(args.features, viableFeatures);
        const invalidFeatures = args.features.filter(feat => !(viableFeatures.includes(feat)));
        if (invalidFeatures.length > 0) {
            return {err: `Features ${formatSet(invalidFeatures)} are not reported by sensors ${formatSet(args.sensors)}.`}
        }
    }
    args.features = new Set(args.features);
    return args;
}

function formatSet(setLike) {
    try {
        return [...setLike].join(', ');
    }
    catch (e) {
        return '[]';
    }
}