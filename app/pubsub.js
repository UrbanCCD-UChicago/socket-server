const _ = require('underscore');
const REDIS_CHANNEL_NAME = 'plenario_observations';
const clone = require('clone');

/* 
    listenForRecords and helpers:
    Sets up callback that parses records sent over redis
    and distributes them to the sockets that have subscribed to them.
*/

function listenForRecords(cache, io, redis) {
    redis.subscribe(REDIS_CHANNEL_NAME);
    redis.on('message', (channel, msg) => { 
        // Parse records
        let records;
        try {
            records = JSON.parse(msg);
        }
        catch (e) {
            console.log('Could not parse observations: ' + e);
            return;
        }

        // Convert to observations
        const tree = cache.recordTree;
        const observationArrays = records
                                    .map(r => splitRecordIntoObservations(tree, r))
                                    .filter(Boolean);
        const formattedObservations = _.flatten(observationArrays);
        if (formattedObservations.length === 0) return;

        // io.sockets.connected gives hash from id to socket for all connected sockets
        pushObservations(formattedObservations, _.values(io.sockets.connected));
    });
}

function pushObservations(observations, sockets) {
    for (let o of observations) {
        const eligibleSockets = sockets.filter(s => shouldSend(s.args, o))
        for (let s of eligibleSockets) {
            s.emit('data', o);
        }
    }
}

function splitRecordIntoObservations(tree, record) {
    // Does this combination of network, node and sensor exist in our metadata?
    const sensorMetadata = extractSensorMetadata(tree, record);
    if (!sensorMetadata) return null;
    /** 
     * We maintain a mapping from Beehive naming to Plenario naming in
     * the leaf nodes (sensor objects) of the tree.
     * 
     * {
     *      pressure: "atmospheric_pressure.pressure",
     *      temperature: "temperature.temperature",
     *      internal_temperature: "temperature.internal_temperature"
     * }
     * 
     * where the keys are "nicknames" that Beehive uses,
     * and the values are the features of interest maintained in Apiary.
     * (The part before the dot is the feature of interest name;
     *  the part after the dot is the specific property of the feature.)
     * 
     * The data documents in the record look like:
     * 
     * {
     *      pressure: 12,
     *      temperature: 58
     *      internal_temperature: 103
     * }
     * 
     * So the formatting task is to translate from Beehive nickname 
     * and create a separate observation for each where the metadata is the same,
     * but the observation object is distinct
     * {
     *   type: sensorObservations
     *   attributes: {
     *      node: foo,
     * 
     *      ...
     *      feature: temperature,
     *      properties: {temperature: 58, internal_temperature: 103 }
     *   }
     * },
     * { 
     *   type: sensorObservations
     *   attributes: {
     *      node: foo,
     *      ...
     *      feature: atmospheric_pressure,
     *      properties: {pressure: 12}
     *   }
     * }
     * 
     * **/
    
    const {sensor, node, network, datetime} = record;

    // Loop 1: Split up the observed properties by feature
    // by making a mapping from feature name to observation object
    const observations = {};
    for (var beehivePropertyName in record.data) {
        if (!(beehivePropertyName in sensorMetadata)) return null;
        const [feature, property] = sensorMetadata[beehivePropertyName].split('.');
        if (!observations[feature]) {
            observations[feature] = {
                feature,
                properties: {}
            };
        }
        observations[feature].properties[property] = record.data[beehivePropertyName];
    }

    // Loop 2: Turn each collection of observed properties into a JSONAPI-ish observation object
    // Return array with one JSONAPI observation object 
    // for each feature present in the record
    return _.values(observations).map(o => {
        const observationTemplate = {
            type: 'sensorObservations',
            attributes: {
                sensor, node, network, datetime,
                meta_id: record.meta_id
            }
        };
        Object.assign(observationTemplate.attributes, o)
        return observationTemplate;
    });
}

function extractSensorMetadata(tree, observation) {
    const {network, node, sensor} = observation;
    let sensorMetadata;
    try {
        sensorMetadata = tree[network][node][sensor];    
    }
    catch (e) {}
    // sensorMetadata will be undefined if an exception was thrown 
    // or if the sensor metadata just happened to be undefined
    if (sensorMetadata) {
        return sensorMetadata;
    }
    else {
        console.log(`could not validate ${JSON.stringify(observation)}`);
        return null;
    }
}

function shouldSend(args, observation) {
    const {sensor, node, network, feature} = observation.attributes;
    const {sensors, nodes, networks, features} = args;
    const pairs = [[networks, network], [nodes, node], [sensors, sensor], [features, feature]];
    return pairs.every(([set, individual]) => set.has(individual));
}

/* 
    listenForSubscribers and helpers:
    Sets up callback that takes in newly connected sockets,
    parses the query arguments submitted with them,
    and sticks the parsed arguments on to them for safe keeping.
*/

function listenForSubscribers(cache, io) {
    io.on('connection', function (socket) {
        const args = parseArgs(socket.handshake.query, cache.argsTree);
        if (args.err) {
            socket.emit('internal_error', {error: args.err});
            socket.disconnect();
        }
        socket.args = args;
    });
}

/**
 * 
 * @param {*} rawArgs
 *  User provided query arguments 
 * @param {*} tree
    formatted style, like formattedTree in tests/fixtures.js
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

exports.listenForRecords = listenForRecords;
exports.listenForSubscribers = listenForSubscribers;
exports.parseArgs = parseArgs;
exports.splitRecordIntoObservations = splitRecordIntoObservations;
exports.pushObservations = pushObservations;