const {createServer} = require('../app/createServer.js');
const {localTestTree} = require('./fixtures.js');

const pgClient = {
  query(statement) {
    return Promise.resolve({rows: [{sensor_tree: localTestTree}]});
  }
};

createServer(pgClient);