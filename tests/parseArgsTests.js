const _ = require('underscore');
const {parseArgs} = require('../app/pubsub');

const chai = require('chai');
const {expect} = chai;
    
const tree = {
    network1: {
        node1: {
            sensor1: {
                temperature: null,
                relative_humidity: null
            },
            sensor2: {
                magnetic_field: null
            }
        },
        node2: {
            // Deliberately duplicating
            sensor2: {
                magnetic_field: null
            },
            sensor3: {
                temperature: null,
                atmospheric_pressure: null
            }
        }
    }
};

const settify = o => _.mapObject(o, arr => new Set(arr));

/**
 * The network argument is mandatory. The rest are optional.
   That means we have 2^3 = 8 combinations of params being
   supplied or not supplied.
   xxx means a test where nodes, sensors, features all are specified.
   xox means nodes are specifies, sensors aren't, features are.
   You see the pattern. One test for each happy path.
 */
describe('parseArgs', function() {
    // ooo
    it('picks the right defaults when only a network is supplied', function() {
        const args = {network: 'network1'};
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1', 'node2'],
            sensors: ['sensor1', 'sensor2', 'sensor3'],
            features: ['temperature', 'relative_humidity', 'magnetic_field', 'atmospheric_pressure']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });
    // xoo
    it('narrows down sensors and features when a node is specified', function() {
        const args = {network: 'network1', nodes: 'node1'};
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1'],
            sensors: ['sensor1', 'sensor2'],
            features: ['temperature', 'relative_humidity', 'magnetic_field']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });
    // xxo
    it('narrows down features when everything else is specified', function() {
        const args = {
            network: 'network1', 
            nodes: 'node1',
            sensors: 'sensor1'    
        };
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1'],
            sensors: ['sensor1',],
            features: ['temperature', 'relative_humidity']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });
    // oox
    it('allows the user to skip nodes and sensors', function() {
        const args = {
            network: 'network1',
            features: 'relative_humidity,magnetic_field'
        }
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1', 'node2'],
            sensors: ['sensor1', 'sensor2', 'sensor3'],
            features: ['relative_humidity', 'magnetic_field']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });
    // oxx
    it('allows the user to skip nodes', function(){
        const args = {
            network: 'network1',
            sensors: 'sensor1,sensor3',
            features: 'temperature'
        };
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1', 'node2'],
            sensors: ['sensor1', 'sensor3'],
            features: ['temperature']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });
    // oxo
    it('allows the user to only include sensors', function(){
        const args = {
            network: 'network1',
            sensors: 'sensor1,sensor3'
        };
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1', 'node2'],
            sensors: ['sensor1', 'sensor3'],
            features: ['temperature', 'relative_humidity', 'atmospheric_pressure']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });
    // xox
    it('allows the user to skip sensors', function(){
        const args = {
            network: 'network1',
            nodes: 'node1',
            features: 'magnetic_field'
        };
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1'],
            sensors: ['sensor1', 'sensor2'],
            features: ['magnetic_field']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });
    // xxx
    it('allows the user to select everything', function(){
        const args = {
            network: 'network1',
            nodes: 'node1',
            sensors: 'sensor1',
            features: 'temperature'
        };
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1'],
            sensors: ['sensor1'],
            features: ['temperature']
        });
        expect(parseArgs(args, tree)).to.deep.equal(expected);
    });

    /**
     * Tests for unhappy paths.
     * Lots of ways for a user to make an invalid query.
     */
    it('disallows sensors from nodes the user did not select', function(){
        const args = {
            network: 'network1', 
            nodes: 'node2', 
            sensors: 'sensor1,sensor2,sensor3'
        };
        expect(parseArgs(args, tree).err).to.be.a('string');
    });
    
    it('disallows features from nodes the user did not select', function(){
        const args = {
            network: 'network1', 
            nodes: 'node1', 
            features: 'magnetic_field,atmospheric_pressure'
        };
        expect(parseArgs(args, tree).err).to.be.a('string');
    });
    it("gives up if the user doesn't supply a network", function(){
        const args = {
            features: 'atmospheric_pressure'
        };
        expect(parseArgs(args, tree).err).to.be.a('string');
    });
    it('fails gracefully if the user specifies a nonexistent network', function() {
        const args = {
            network: 'networkFoo'
        };
        expect(parseArgs(args, tree).err).to.be.a('string');
    });
    it('fails gracefully if the user asks for nonexistent features', function() {
        const args = {
            network: 'network1',
            features: 'bird_hatchings,frog_croaks'
        };
        expect(parseArgs(args, tree).err).to.be.a('string');
    });
    
});