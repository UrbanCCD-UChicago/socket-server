#### Socket Server

For an overview of how this fits into Plenario's streaming pipeline, check out [this overview](https://github.com/UrbanCCD-UChicago/socket-server/wiki/Streaming-System-Design-Doc).

#### Overview

This is a Node.js Socket.io server. It receives sensor data over Redis pub/sub, formats the data, and transmits it to subscribers over Websockets.

#### Terminology: Records and Observations

The code to actually emit data to consumers is pretty small. The bulk of the logic in this repo is data munging: transforming "records" to "observations".

I define a record as a batch of readings taken from one sensor at the same time and place, formatted in a way decided by the [Beehive](https://github.com/waggle-sensor/beehive-server). Here is an example of a record:

```
{
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
  }
```

 I define an observation as a batch of readings _under a single feature of interest_ formatted per the Plenario API spec. So a record may combine temperature and humidity, but an observation can only be either temperature or humidity. Here is an example of the observations the example record would yield:

 ```
   [
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
    ]
 ```

#### Step 1: Connecting Clients

pubsub.js#listenForSubscribers is where we manage incoming client connections. A client must provide a query argument to specify which sensor network they would like to receive data from and may provide query arguments to specify a subset of that network (some subset of nodes, sensors, and features of interest). `listenForSubscribers` parses those arguments and validates them against sensor metadata from Postgres. It creates an `args` object that maps `networks`, `nodes`, `sensors`, and `features` to the set of those entities that the client has subscribed to. It attaches the args object directly to the socket.

#### Step 2: Dispatching Observations

pubsub.js#listenForRecords sets up a Redis subscription callback that responds to new batches of records. It first splits up the records into observations as described in the Terminology section. Then it loops through all connected clients and uses their `args` to determine if it should emit a given observation to a client.

#### On Socket.io

In an earlier version of this server, we relied on some distincitive Socket.io features (especially room management). For performance's sake, we also enforce that the only allowable transport is Websockets (no long polling). Given that we're not using the high-level features of Socket.io, we should consider moving down to a lower level library like node-ws. It's not a slam dunk though, because some of the Socket.io niceties (like automatically pinging clients to maintain an up-to-date list of which clients are connected, and automatic reconnection attempts on the client side) do make our lives easier.
