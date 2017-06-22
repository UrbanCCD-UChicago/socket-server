const fixtures = require('./fixtures');
const unformatted = fixtures.smallTree;
const formatted = fixtures.formattedTree;

const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;

const {SensorTreeCache} = require('../app/pubsub.js');

function makeFakePgClient(tree) {
    return {
        query(statement) {
            return Promise.resolve(tree);
        }
    };
}

describe('SensorTreeCache', function() {
    it('generates a sensor tree correctly', function() {
        const fakeClient = makeFakePgClient(unformatted);
        const cache = new SensorTreeCache(fakeClient);
        return expect(cache.seed()).to.eventually.deep.include({sensorTree:formatted});
    });
    // it('replaces the sensor tree after 10 minutes');
    // it('fails if postgres acts up');
    // it('fails if postgres sends it a malformed response');
    // it('throws an error if seeding fails');
    // it('fails gracefully if refresh fails')
});