const _ = require('underscore');
const chai = require('chai');
const {expect} = chai;

const {pushObservations} = require('../../app/pubsub.js');

const sinon = require('sinon');

const settify = o => _.mapObject(o, arr => new Set(arr));

function makeObservation(node, sensor, feature, id) {
    return {
        type: 'sensorObservations',
        attributes: {
            network: 'network1', 
            node, sensor, feature,
            meta_id: id,
            // Properties won't matter for filtering
            properties: {
                foo: 'bar'
            }
        }
    }
}

const observations = [
    makeObservation('node1', 'sensor1', 'rainfall', 1),
    makeObservation('node2', 'sensor2', 'rainfall', 2),
    makeObservation('node1', 'sensor2', 'dogs', 3),
    makeObservation('node2', 'sensor2', 'cats', 4),
    makeObservation('node3', 'sensor2', 'cats', 5)
]

const allInNetwork = {
    args: settify({
        networks: ['network1'],
        nodes: ['node1', 'node2'],
        sensors: ['sensor1', 'sensor2'],
        features: ['rainfall', 'cats', 'dogs']
    }),
    emit: sinon.spy()
};
const someInNetwork = {
    args: settify({
        networks: ['network1'],
        nodes: ['node1', 'node2'],
        sensors: ['sensor2'],
        features: ['rainfall', 'dogs']
    }),
    emit: sinon.spy()
}
const otherNetwork = {
    args: settify({
        networks: ['network2'],
        nodes: ['node1', 'node2'],
        sensors: ['sensor1', 'sensor2'],
        features: ['rainfall', 'cats', 'dogs']
    }),
    emit: sinon.spy()
}

const sockets = [allInNetwork, someInNetwork, otherNetwork];

describe('pushObservations', function() {
    it("emits according to each socket's arguments", function() {
        pushObservations(observations, sockets);
        
        expect(allInNetwork.emit.callCount).to.equal(4);
        expect(someInNetwork.emit.callCount).to.equal(2);
        expect(otherNetwork.emit.callCount).to.equal(0);
    });
})