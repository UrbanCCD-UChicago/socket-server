// const assert = require('assert');
const _ = require('underscore');
const {parseArgs} = require('../app/pubsub');

const chai = require('chai');
// chai.use(require('chai-as-promised'));
const {assert, expect} = chai;

const tree = {
    network1: {
        node1: {
            sensor1: {
                nickname1: 'temperature.temperature',
                nickname2: 'relative_humidity.humidity'
            },
            sensor2: {
                nickname1: 'magnetic_field.y',
                nickname2: 'magnetic_field.x',
                nickname3: 'magnetic_field.z'
            }
        },
        node2: {
            // Deliberately duplicating
            sensor2: {
                nickname1: 'magnetic_field.y',
                nickname2: 'magnetic_field.x',
                nickname3: 'magnetic_field.z'
            },
            sensor3: {
                nickname1: "atmospheric_pressure.pressure",
                nickname2: "temperature.temperature"
            }
        }
    }
};

const settify = o => _.mapObject(o, arr => new Set(arr));

describe('parseArgs', function() {
    it('picks the right defaults when only a network is supplied', function() {
        const expected = settify({
            networks: ['network1'],
            nodes: ['node1', 'node2'],
            sensors: ['sensor1', 'sensor2', 'sensor3'],
            features: ['temperature', 'relative_humidity', 'magnetic_field', 'atmospheric_pressure']
        });
        expect(parseArgs({network: 'network1'}, tree)).to.deep.equal(expected);
    });
});