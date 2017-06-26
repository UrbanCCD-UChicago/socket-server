exports.smallTree = {
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

exports.formattedTree = {
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

exports.smallTree2 = {
    network1: {
        node1: {
            sensor1: {
                nickname1: 'temperature.temperature',
                nickname2: 'relative_humidity.humidity'
            },
            sensor2: {
                nickname1: 'foo.bar'
            }
        },
        node2: {
            sensor2: {
                nickname1: 'foo.bar'
            },
            sensor3: {
                nickname1: "atmospheric_pressure.pressure",
                nickname2: "temperature.temperature"
            }
        }
    }
};

exports.formattedTree2 = {
    network1: {
        node1: {
            sensor1: {
                temperature: null,
                relative_humidity: null
            },
            sensor2: {
                foo: null
            }
        },
        node2: {
            sensor2: {
                foo: null
            },
            sensor3: {
                temperature: null,
                atmospheric_pressure: null
            }
        }
    }
};