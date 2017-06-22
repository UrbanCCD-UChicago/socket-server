const clone = require('clone');

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

const packageResult = sensor_tree => ({rows: [{sensor_tree}]});

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

function expectSuccess(in1, in2, out1, out2, done) {
    const clock = sinon.useFakeTimers();
        const fakeClient = {
            called: false,
            query(statement) {
                if (!this.called) {
                    this.called = true;
                    return Promise.resolve(packageResult(clone(in1)));    
                }
                else {
                    return Promise.resolve(packageResult(clone(in2)));
                }
            }
        }
        const cache = new SensorTreeCache(fakeClient);
        
        cache.seed().then(treeCache => {
            expect(treeCache.sensorTree).to.deep.equal(out1);
            // 10 minutes and one second later...
            clock.tick(1000*60*10 + 1000);
            return treeCache;
        }) // Let tree fetch promise resolve.
        .then(treeCache => {
            expect(treeCache.sensorTree).to.deep.equal(out2);
            done();
        })
        .catch(e => {
            console.log(e);
            done(e);
        })
        .then(clock.restore);
}

describe('SensorTreeCache', function() {
    it('generates sensor trees correctly', function(done) {
        expectSuccess(
            unformatted, 
            unformatted2, 
            formatted, 
            formatted2, 
            done
        );
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
    it('fails gracefully if refresh fails', function(done) {
        expectSuccess(
            unformatted, 
            {foo: {bar: 'gorp'}}, 
            formatted, 
            formatted, 
            done
        );
    })
});