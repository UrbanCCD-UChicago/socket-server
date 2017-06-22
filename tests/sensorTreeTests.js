const fixtures = require('./fixtures');
const unformatted = fixtures.smallTree;
const formatted = fixtures.formattedTree;
const unformatted2 = fixtures.smallTree2;
const formatted2 = fixtures.formattedTree2;

const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;

const sinon = require('sinon');

const {SensorTreeCache} = require('../app/pubsub.js');

function makeFakePgClient(firstTree, secondTree) {
    return {
        called: false,
        query(statement) {
            if (!this.called) {
                this.called = true;
                return Promise.resolve(firstTree);    
            }
            else {
                return Promise.resolve(secondTree);
            }
        }
    };
}

describe('SensorTreeCache', function() {
    it('generates sensor trees correctly', function(done) {
        const clock = sinon.useFakeTimers();
        const fakeClient = makeFakePgClient(unformatted, unformatted2);
        const cache = new SensorTreeCache(fakeClient);
        
        cache.seed().then(treeCache => {
            expect(treeCache.sensorTree).to.deep.equal(formatted);
            // 10 minutes and one second later...
            clock.tick(1000*60*10 + 1000);
            return treeCache;
        }) // Let tree fetch promise resolve.
        .then(treeCache => {
            expect(treeCache.sensorTree).to.deep.equal(formatted2);
            done();
        })
        .catch(e => {
            console.log(e);
            done(e);
        })
        .then(clock.restore);
    });
    // it('fails if postgres acts up');
    // it('fails if postgres sends it a malformed response');
    // it('throws an error if seeding fails');
    // it('fails gracefully if refresh fails')
});