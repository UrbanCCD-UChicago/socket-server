const _ = require("underscore");
const fixtures = require("../fixtures.js");
const chai = require("chai");
const { expect } = chai;

const { splitRecordIntoObservations } = require("../../app/pubsub.js");

const recordTree = {
  array_of_things_chicago: {
    "0000001e0610b9e7": {
      chemsense: {
        co: "gas_concentration.co",
        reducing_gases: "gas_concentration.reducing_gases",
        h2s: "gas_concentration.h2s",
        so2: "gas_concentration.so2",
        oxidizing_gases: "gas_concentration.oxidizing_gases",
        o3: "gas_concentration.o3",
        no2: "gas_concentration.no2"
      },
      bmi160: {
        accel_z: "acceleration.z",
        accel_x: "acceleration.x",
        accel_y: "acceleration.y",
        orient_z: "orientation.z",
        orient_x: "orientation.x",
        orient_y: "orientation.y"
      },
      tmp421: { temperature: "temperature.internal_temperature" },
      tmp112: { temperature: "temperature.temperature" }
    }
  }
};

describe("splitRecordIntoObservations", function() {
  it("can split a record into multiple observations", function() {
    const record = {
      datetime: "2017-04-07T17:50:51",
      network: "array_of_things_chicago",
      meta_id: 1,
      data: {
        orient_y: 1,
        orient_z: -1,
        accel_z: 30,
        orient_x: 3,
        accel_y: 981,
        accel_x: -10
      },
      sensor: "bmi160",
      node: "0000001e0610b9e7"
    };
    let expectedObservations = [
      {
        type: "sensorObservations",
        attributes: {
          sensor: "bmi160",
          node: "0000001e0610b9e7",
          meta_id: 1,
          network: "array_of_things_chicago",
          datetime: "2017-04-07T17:50:51",
          feature: "orientation",
          properties: { x: 3, y: 1, z: -1 }
        }
      },
      {
        type: "sensorObservations",
        attributes: {
          sensor: "bmi160",
          node: "0000001e0610b9e7",
          meta_id: 1,
          network: "array_of_things_chicago",
          datetime: "2017-04-07T17:50:51",
          feature: "acceleration",
          properties: { x: -10, y: 981, z: 30 }
        }
      }
    ];
    let observedObservations = splitRecordIntoObservations(recordTree, record);
    // Make sure orientation is first.
    // We don't care what order the split observations come back in.
    if (observedObservations[0].attributes.feature !== "orientation") {
      expectedObservations = expectedObservations.reverse();
    }
    expect(observedObservations).to.deep.equal(expectedObservations);
  });

  it("does not split when it does not need to", function() {
    const records = [
      {
        datetime: "2017-04-07T17:50:51",
        network: "array_of_things_chicago",
        meta_id: 2,
        data: { temperature: 23.93 },
        sensor: "tmp112",
        node: "0000001e0610b9e7"
      },
      {
        datetime: "2017-04-07T17:50:51",
        network: "array_of_things_chicago",
        meta_id: 3,
        data: { temperature: 38.43 },
        sensor: "tmp421",
        node: "0000001e0610b9e7"
      },
      // Will be one big observation
      {
        datetime: "2017-04-07T17:50:51",
        network: "array_of_things_chicago",
        meta_id: 4,
        data: {
          o3: 367816,
          co: 4410,
          reducing_gases: 77,
          h2s: 24829,
          no2: 2239,
          so2: -362051,
          oxidizing_gases: 34538
        },
        sensor: "chemsense",
        node: "0000001e0610b9e7"
      }
    ];
    const expectedObservations = [
      {
        type: "sensorObservations",
        attributes: {
          sensor: "tmp112",
          node: "0000001e0610b9e7",
          meta_id: 2,
          network: "array_of_things_chicago",
          datetime: "2017-04-07T17:50:51",
          feature: "temperature",
          properties: {
            temperature: 23.93
          }
        }
      },
      {
        type: "sensorObservations",
        attributes: {
          sensor: "tmp421",
          node: "0000001e0610b9e7",
          meta_id: 3,
          network: "array_of_things_chicago",
          datetime: "2017-04-07T17:50:51",
          feature: "temperature",
          properties: {
            internal_temperature: 38.43
          }
        }
      },
      {
        type: "sensorObservations",
        attributes: {
          sensor: "chemsense",
          node: "0000001e0610b9e7",
          meta_id: 4,
          network: "array_of_things_chicago",
          datetime: "2017-04-07T17:50:51",
          feature: "gas_concentration",
          properties: {
            o3: 367816,
            co: 4410,
            reducing_gases: 77,
            h2s: 24829,
            no2: 2239,
            so2: -362051,
            oxidizing_gases: 34538
          }
        }
      }
    ];
    const observedObservations = _.flatten(
      records.map(r => splitRecordIntoObservations(recordTree, r))
    );
    expect(observedObservations).to.deep.equal(expectedObservations);
  });

  it("rejects invalid records", function() {
    const records = [
      // Invalid observation: nonexistent beehive nickname
      {
        datetime: "2017-04-07T17:50:53",
        network: "array_of_things_chicago",
        meta_id: 5,
        data: { foo: 38.43 },
        sensor: "tmp421",
        node: "0000001e0610b9e7"
      },
      // Invalid observation: nonexistent network
      {
        datetime: "2017-04-07T17:50:53",
        network: "array_of_things_pittsburgh",
        meta_id: 6,
        data: { temperature: 38.43 },
        sensor: "tmp421",
        node: "0000001e0610b9e7"
      },
      // Invalid observation: nonexistent node
      {
        datetime: "2017-04-07T17:50:53",
        network: "array_of_things_chicago",
        meta_id: 7,
        data: { temperature: 38.43 },
        sensor: "tmp421",
        node: "foo"
      },
      // Invalid observation: nonexistent sensor
      {
        datetime: "2017-04-07T17:50:53",
        network: "array_of_things_chicago",
        meta_id: 8,
        data: { temperature: 38.43 },
        sensor: "foo",
        node: "0000001e0610b9e7"
      }
    ];
    const observedObservations = records.map(r => splitRecordIntoObservations(recordTree, r));
    const expectedObservations = [null, null, null, null];
    expect(observedObservations).to.deep.equal(expectedObservations);
  });
});