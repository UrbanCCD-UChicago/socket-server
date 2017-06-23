const _ = require('underscore');
const REDIS_CHANNEL_NAME = 'plenario_observations';

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
        
        // io.sockets.connected gives array of all connected sockets
        const sockets = _.values(io.sockets.connected);
        for (let o of observations) {
            const eligibleSockets = sockets.filter(s => shouldSend(s.args, o))
            for (let s of eligibleSockets) {
                s.emit('data', o);
            }
        }
    });
}

function shouldSend(args, observation) {
    const {sensor, node, network, feature} = observation.attributes;
    const {sensors, nodes, networks, features} = args;
    const pairs = [[networks, network], [nodes, node], [sensors, sensor], [features, feature]];
    return pairs.every(([set, individual]) => set.has(individual));
}

class SensorTreeCache {
    constructor(pg) {
        this.pg = pg;
        setInterval(() => {
            this._fetchSensorTree()
            .catch(err => {
                // Just log the error on a refresh.
                // Client can still use the cached vesion.
                // Consider troubleshooting steps here, 
                // like attempting to reconnect to postgres.
                console.log(`Error: could not refresh sensor metadata: ${err}`);
            });
        }, 1000*60*10);
    }
    // Returns promise to signal that cache has a tree
    seed() {
        return this._fetchSensorTree().then(() => this);
    }
    _fetchSensorTree() {
        return this.pg.query('SELECT sensor_tree();')
        .then(result => {
            try {
                const tree = result.rows[0].sensor_tree;
                this.sensorTree = SensorTreeCache._prepTree(tree);
            }
            catch (e) {
                console.log('Could not traverse tree from postgres: ' + e);
                throw e;
            }
        });
    }
    /**
     * Mutates and returns tree with consistent structure.
     * Throws error if tree is invalid.
     */
    static _prepTree(tree) {
        // Reformat each leaf node of the tree
        const networks = _.values(tree);
        const nodes = _.flatten(networks.map(_.values));
        if (nodes.length === 0) throw new Error('Network has no nodes');
        for (let node of nodes) {
            const sensorPairs = _.pairs(node);
            if (sensorPairs.length === 0) throw new Error('Node has no sensors');
            for (let [sensorName, sensor] of _.pairs(node)) {
                node[sensorName] = SensorTreeCache._mungeFeatureObject(sensor);
            }
        }
        return tree;
    }
    /*
        Turns 
    {
        nickname1: 'feature1.property1', 
        nickname2: 'feature1.property2',
        nickname3: 'feature2.property1'
    }
        into 
    {
        feature1: null,
        feature2: null
    }
    */
    static _mungeFeatureObject(featureObject) {
        // Extract feature string from each observed property,
        let features = _.values(featureObject).map(op => op.split('.')[0]);
        // and dedupe.
        features = [...new Set(features)];
        // Make object mapping each feature to null. Looks silly, 
        // but we're just going for consistent structure in the tree.
        const munged = {};
        for (let f of features) {
            munged[f] = null;
        }
        return munged;
    }
}

function setUpSocketIo(pg, io) {
    const sensorTreeCache = new SensorTreeCache(pg);
    return sensorTreeCache.seed()
    .then(treeCache => {
        io.on('connection', function (socket) {
            const args = parseArgs(socket.handshake.query, treeCache.sensorTree);
            if (args.err) {
                socket.emit('internal_error', {error: args.err});
                socket.disconnect();
            }
            socket.args = args;
        });
    })
    .catch(err => {
        // Abort on error if we fail the first time.
        console.log(`Fatal error: could not initialize sensor metadata: ${err}`);
        // You should let caller decide to do this to keep testing reasonable
        process.exit(1);
    });
}

/**
 * 
 * @param {*} rawArgs
 *  User provided query arguments 
 * @param {*} tree
 *  Sensor network metadata in format provided py postgres sensor_tree procedure.
 *  See parseArgsTests.js for example of how it's formatted
 * 
 * Returns an object with keys "networks", "nodes", "sensors", and "features"
 * where each value is an ES6 Set of strings representing the subset the user has selected.
 */
function parseArgs(rawArgs, tree) {
    const networkName = rawArgs.network;
    if (!networkName) return {err: 'You must specify a sensor network'};
    tree = tree[networkName] // Trim tree to part under the network
    if (!tree) return {err: `The network ${networkName} does not exist`};
    
    // For consistency, make networks a set of one.
    const validatedArgs = {
        networks: new Set([networkName])
    };

    // Each optional field provided is expected to be a comma separated list.
    // Store them in parsedArgs as an array of strings.
    // Then, "lock them in" to validatedArgs as Sets as we move down the tree.
    const optionalFields = ['nodes', 'sensors', 'features'];
    const parsedArgs = {}
    for (let f of optionalFields) {
        if (rawArgs[f]) {
            try {
                parsedArgs[f] = rawArgs[f].toLowerCase().split(',');
            }
            catch (err) {
                return {err: `Could not parse argument ${f}=${rawArgs[f]}`};
            }
        }
    }
    for (let f of optionalFields) {
        let keys = parsedArgs[f] || _.keys(tree);
        const invalidKeys = keys.filter(k => !(k in tree));
        if (invalidKeys.length > 0) {
            return {err: `Could not find selected ${f}: ${invalidKeys.join(',')}`};
        }
        // Trim the tree. 
        // If keys is ['a', 'c'] and tree is {a: {b: 1}, c: {d: 2}, e: {f: 3}}
        // Chop down to  {b: 1, d: 2}
        tree = _.values(_.pick(tree, ...keys))
                .reduce((chopped, branch) => Object.assign(chopped, branch), {});
        validatedArgs[f] = new Set(keys); 
    }
    return validatedArgs;
}

exports.setUpRedis = setUpRedis;
exports.setUpSocketIo = setUpSocketIo;
exports.parseArgs = parseArgs;
exports.SensorTreeCache = SensorTreeCache;