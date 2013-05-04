var debug = require('debug')('noble');

var events = require('events');
var os = require('os');
var util = require('util');

var Peripheral = require('./peripheral');
var Service = require('./service');
var Characteristic = require('./characteristic');
var Descriptor = require('./descriptor');

var bindings = null;

var platform = os.platform();

if (platform === 'darwin') {
  bindings = require('./mac/bindings');
} else if (platform === 'linux') {
  bindings = require('./linux/bindings');
} else {
  throw new Error('Unsupported platform');
}

function Noble() {
  this._bindings = bindings;
  this._peripherals = {};
  this._services = {};
  this._characteristics = {};
  this._descriptors = {};

  this._bindings.on('stateChange', this.onStateChange.bind(this));
  this._bindings.on('scanStart', this.onScanStart.bind(this));
  this._bindings.on('scanStop', this.onScanStop.bind(this));
  this._bindings.on('discover', this.onDiscover.bind(this));
  this._bindings.on('connect', this.onConnect.bind(this));
  this._bindings.on('disconnect', this.onDisconnect.bind(this));
  this._bindings.on('rssiUpdate', this.onRssiUpdate.bind(this));
  this._bindings.on('servicesDiscover', this.onServicesDiscover.bind(this));
  this._bindings.on('includedServicesDiscover', this.onIncludedServicesDiscover.bind(this));
  this._bindings.on('characteristicsDiscover', this.onCharacteristicsDiscover.bind(this));
  this._bindings.on('read', this.onRead.bind(this));
  this._bindings.on('write', this.onWrite.bind(this));
  this._bindings.on('broadcast', this.onBroadcast.bind(this));
  this._bindings.on('notify', this.onNotify.bind(this));
  this._bindings.on('descriptorsDiscover', this.onDescriptorsDiscover.bind(this));
  this._bindings.on('valueRead', this.onValueRead.bind(this));
  this._bindings.on('valueWrite', this.onValueWrite.bind(this));
}

util.inherits(Noble, events.EventEmitter);

Noble.prototype.onStateChange = function(state) {
  debug('stateChange ' + state);
  this.emit('stateChange', state);
};

Noble.prototype.startScanning = function(serviceUuids, allowDuplicates, callback) {
  if (callback) {
    this.once('scanStart', callback);
  }
  this._bindings.startScanning(serviceUuids, allowDuplicates);
};

Noble.prototype.onScanStart = function() {
  debug('scanStart');
  this.emit('scanStart');
};

Noble.prototype.stopScanning = function(callback) {
  if (callback) {
    this.once('scanStop', callback);
  }
  this._bindings.stopScanning();
};

Noble.prototype.onScanStop = function() {
  debug('scanStop');
  this.emit('scanStop');
};

Noble.prototype.onDiscover = function(uuid, advertisement, rssi) {
  var peripheral = new Peripheral(this, uuid, advertisement, rssi);

  this._peripherals[uuid] = peripheral;
  this._services[uuid] = {};
  this._characteristics[uuid] = {};
  this._descriptors[uuid] = {};

  this.emit('discover', peripheral);
};

Noble.prototype.connect = function(peripheralUuid) {
  this._bindings.connect(peripheralUuid);
};

Noble.prototype.onConnect = function(peripheralUuid) {
  var peripheral = this._peripherals[peripheralUuid];

  peripheral.emit('connect');
};

Noble.prototype.disconnect = function(peripheralUuid) {
  this._bindings.disconnect(peripheralUuid);
};

Noble.prototype.onDisconnect = function(peripheralUuid) {
  var peripheral = this._peripherals[peripheralUuid];

  peripheral.emit('disconnect');
};

Noble.prototype.updateRssi = function(peripheralUuid) {
  this._bindings.updateRssi(peripheralUuid);
};

Noble.prototype.onRssiUpdate = function(peripheralUuid, rssi) {
  var peripheral = this._peripherals[peripheralUuid];

  peripheral.rssi = rssi;

  peripheral.emit('rssiUpdate', rssi);
};

Noble.prototype.discoverServices = function(peripheralUuid, uuids) {
  this._bindings.discoverServices(peripheralUuid, uuids);
};

Noble.prototype.onServicesDiscover = function(peripheralUuid, serviceUuids) {
  var peripheral = this._peripherals[peripheralUuid];
  var services = [];

  for (var i = 0; i < serviceUuids.length; i++) {
    var serviceUuid = serviceUuids[i];
    var service = new Service(this, peripheralUuid, serviceUuid);

    this._services[peripheralUuid][serviceUuid] = service;
    this._characteristics[peripheralUuid][serviceUuid] = {};
    this._descriptors[peripheralUuid][serviceUuid] = {};

    services.push(service);
  }

  peripheral.services = services;

  peripheral.emit('servicesDiscover', services);
};

Noble.prototype.discoverIncludedServices = function(peripheralUuid, serviceUuid, serviceUuids) {
  this._bindings.discoverIncludedServices(peripheralUuid, serviceUuid, serviceUuids);
};

Noble.prototype.onIncludedServicesDiscover = function(peripheralUuid, serviceUuid, includedServiceUuids) {
  var service = this._services[peripheralUuid][serviceUuid];

  service.includedServiceUuids = includedServiceUuids;

  service.emit('includedServicesDiscover', includedServiceUuids);
};

Noble.prototype.discoverCharacteristics = function(peripheralUuid, serviceUuid, characteristicUuids) {
  this._bindings.discoverCharacteristics(peripheralUuid, serviceUuid, characteristicUuids);
};

Noble.prototype.onCharacteristicsDiscover = function(peripheralUuid, serviceUuid, characteristics) {
  var service = this._services[peripheralUuid][serviceUuid];

  var characteristics_ = [];
  for (var i = 0; i < characteristics.length; i++) {
    var characteristicUuid = characteristics[i].uuid;

    var characteristic = new Characteristic(
                              this,
                              peripheralUuid,
                              serviceUuid,
                              characteristicUuid,
                              characteristics[i].properties
                          );

    this._characteristics[peripheralUuid][serviceUuid][characteristicUuid] = characteristic;
    this._descriptors[peripheralUuid][serviceUuid][characteristicUuid] = {};

    characteristics_.push(characteristic);
  }

  service.characteristics = characteristics_;

  service.emit('characteristicsDiscover', characteristics_);
};

Noble.prototype.read = function(peripheralUuid, serviceUuid, characteristicUuid) {
   this._bindings.read(peripheralUuid, serviceUuid, characteristicUuid);
};

Noble.prototype.onRead = function(peripheralUuid, serviceUuid, characteristicUuid, data, isNotification) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  characteristic.emit('read', data, isNotification);
};

Noble.prototype.write = function(peripheralUuid, serviceUuid, characteristicUuid, data, notify) {
   this._bindings.write(peripheralUuid, serviceUuid, characteristicUuid, data, notify);
};

Noble.prototype.onWrite = function(peripheralUuid, serviceUuid, characteristicUuid) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  characteristic.emit('write');
};

Noble.prototype.broadcast = function(peripheralUuid, serviceUuid, characteristicUuid, broadcast) {
   this._bindings.broadcast(peripheralUuid, serviceUuid, characteristicUuid, broadcast);
};

Noble.prototype.onBroadcast = function(peripheralUuid, serviceUuid, characteristicUuid, state) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  characteristic.emit('broadcast', state);
};

Noble.prototype.notify = function(peripheralUuid, serviceUuid, characteristicUuid, notify) {
   this._bindings.notify(peripheralUuid, serviceUuid, characteristicUuid, notify);
};

Noble.prototype.onNotify = function(peripheralUuid, serviceUuid, characteristicUuid, state) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  characteristic.emit('notify', state);
};

Noble.prototype.discoverDescriptors = function(peripheralUuid, serviceUuid, characteristicUuid) {
  this._bindings.discoverDescriptors(peripheralUuid, serviceUuid, characteristicUuid);
};

Noble.prototype.onDescriptorsDiscover = function(peripheralUuid, serviceUuid, characteristicUuid, descriptors) {
  var characteristic = this._characteristics[peripheralUuid][serviceUuid][characteristicUuid];

  var descriptors_ = [];

  for (var i = 0; i < descriptors.length; i++) {
    var descriptorUuid = descriptors[i];

    var descriptor = new Descriptor(
                          this,
                          peripheralUuid,
                          serviceUuid,
                          characteristicUuid,
                          descriptorUuid
                      );

    this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid] = descriptor;

    descriptors_.push(descriptor);
  }

  characteristic.descriptors = descriptors_;

  characteristic.emit('descriptorsDiscover', descriptors_);
};

Noble.prototype.readValue = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  this._bindings.readValue(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid);
};

Noble.prototype.onValueRead = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  var descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

  descriptor.emit('valueRead', data);
};

Noble.prototype.writeValue = function(uuid, serviceUuid, characteristicUuid, descriptorUuid, data) {
  this._bindings.writeValue(uuid, serviceUuid, characteristicUuid, descriptorUuid, data);
};

Noble.prototype.onValueWrite = function(peripheralUuid, serviceUuid, characteristicUuid, descriptorUuid) {
  var descriptor = this._descriptors[peripheralUuid][serviceUuid][characteristicUuid][descriptorUuid];

  descriptor.emit('valueWrite');
};

module.exports = Noble;