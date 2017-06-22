const fixtures = require('./fixtures');
const unformatted = fixtures.smallTree;
const formatted = fixtures.formattedTree;
const unformatted2 = fixtures.smallTree2;
const formatted2 = fixtures.formattedTree2;

const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect, assert} = chai;

const sinon = require('sinon');

const {SensorTreeCache} = require('../app/pubsub.js');

function expectError(fakePgClient, done) {
    const cache = new SensorTreeCache(fakePgClient);
    cache.seed()
    .then(() => {
        // Should not successfully resolve.
        assert(false, 'Unexpected');  
    })
    .catch(err => {
        if (err.message === 'Unexpected') {
            done(err);
        }
        expect(err).to.be.an('error');
        done();
    })
}

describe('SensorTreeCache', function() {
    it('generates sensor trees correctly', function(done) {
        const clock = sinon.useFakeTimers();
        const fakeClient = {
            called: false,
            query(statement) {
                if (!this.called) {
                    this.called = true;
                    return Promise.resolve(unformatted);    
                }
                else {
                    return Promise.resolve(unformatted2);
                }
            }
        }
        // const fakeClient = makeFakePgClient(unformatted, unformatted2);
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
    it('fails if postgres acts up', function(done) {
        const fakeClient = {
            query() {
                return Promise.reject(new Error('test error'));
            }
        }
        expectError(fakeClient, done);
    });
    it('fails if postgres sends it a malformed response', function(done) {
        const fakeClient = {
            query() {
                return Promise.resolve({
                    foo: {bar: 3}
                });
            }
        }
        expectError(fakeClient, done);
    });
    // it('throws an error if seeding fails');
    // it('fails gracefully if refresh fails')
});