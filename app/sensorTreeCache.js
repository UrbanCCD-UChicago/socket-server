const _ = require('underscore');
const clone = require('clone');

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
                // Tree used in parseArgs
                this.argsTree = SensorTreeCache._prepTree(tree);
                // Tree used in parseRecord
                this.recordTree = tree;
            }
            catch (e) {
                console.log('Could not traverse tree from postgres: ' + e);
                throw e;
            }
        });
    }
    /**
     * Returns tree with consistent structure.
     * // TODO: Make clear what that structure is
     * Throws error if tree is invalid.
     */
    static _prepTree(tree) {
        // Reformat each leaf node of the tree
        tree = clone(tree);
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

exports.SensorTreeCache = SensorTreeCache;