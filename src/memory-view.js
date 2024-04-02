
var BufferDataView = require('buffer-dataview');
var inherit = require('./util').inherit;

function MemoryView(memory, offset) {
	inherit.call(this);
	this.buffer = memory;
	this.view = MemoryView.DataView(this.buffer, typeof(offset) === "number" ? offset : 0);
	this.mask = memory.byteLength - 1;
	this.resetMask();
};

MemoryView.DataView = function (buffer, byteOffset, byteLength) {
	if (Buffer.isBuffer(buffer)) {
		return new BufferDataView(buffer, byteOffset, byteLength);
	} else {
		return new DataView(buffer, byteOffset, byteLength);
	}
};

MemoryView.prototype.resetMask = function() {
	this.mask8 = this.mask & 0xFFFFFFFF;
	this.mask16 = this.mask & 0xFFFFFFFE;
	this.mask32 = this.mask & 0xFFFFFFFC;
};

MemoryView.prototype.load8 = function(offset) {
	return this.view.getInt8(offset & this.mask8);
};

MemoryView.prototype.load16 = function(offset) {
	// Unaligned 16-bit loads are unpredictable...let's just pretend they work
	return this.view.getInt16(offset & this.mask, true);
};

MemoryView.prototype.loadU8 = function(offset) {
	return this.view.getUint8(offset & this.mask8);
};

MemoryView.prototype.loadU16 = function(offset) {
	// Unaligned 16-bit loads are unpredictable...let's just pretend they work
	return this.view.getUint16(offset & this.mask, true);
};

MemoryView.prototype.load32 = function(offset) {
	// Unaligned 32-bit loads are "rotated" so they make some semblance of sense
	var rotate = (offset & 3) << 3;
	var mem = this.view.getInt32(offset & this.mask32, true);
	return (mem >>> rotate) | (mem << (32 - rotate));
};

MemoryView.prototype.store8 = function(offset, value) {
	this.view.setInt8(offset & this.mask8, value);
};

MemoryView.prototype.store16 = function(offset, value) {
	this.view.setInt16(offset & this.mask16, value, true);
};

MemoryView.prototype.store32 = function(offset, value) {
	this.view.setInt32(offset & this.mask32, value, true);
};

MemoryView.prototype.invalidatePage = function(address) {};

MemoryView.prototype.replaceData = function(memory, offset) {
	this.buffer = memory;
	if (Buffer.isBuffer(this.buffer)) {
		this.view = new BufferDataView(this.buffer, typeof(offset) === "number" ? offset : 0);
	} else {
		this.view = new DataView(this.buffer, typeof(offset) === "number" ? offset : 0);
	}
	if (this.icache) {
		this.icache = new Array(this.icache.length);
	}
};

module.exports = MemoryView;
