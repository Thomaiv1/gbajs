var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = (id) => {
  return import.meta.require(id);
};

// node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = __commonJS((exports, module) => {
  var util = __require("util");
  var Stream = __require("stream");
  var ChunkStream = module.exports = function() {
    Stream.call(this);
    this._buffers = [];
    this._buffered = 0;
    this._reads = [];
    this._paused = false;
    this._encoding = "utf8";
    this.writable = true;
  };
  util.inherits(ChunkStream, Stream);
  ChunkStream.prototype.read = function(length, callback) {
    this._reads.push({
      length: Math.abs(length),
      allowLess: length < 0,
      func: callback
    });
    process.nextTick(function() {
      this._process();
      if (this._paused && this._reads.length > 0) {
        this._paused = false;
        this.emit("drain");
      }
    }.bind(this));
  };
  ChunkStream.prototype.write = function(data, encoding) {
    if (!this.writable) {
      this.emit("error", new Error("Stream not writable"));
      return false;
    }
    var dataBuffer;
    if (Buffer.isBuffer(data)) {
      dataBuffer = data;
    } else {
      dataBuffer = new Buffer(data, encoding || this._encoding);
    }
    this._buffers.push(dataBuffer);
    this._buffered += dataBuffer.length;
    this._process();
    if (this._reads && this._reads.length === 0) {
      this._paused = true;
    }
    return this.writable && !this._paused;
  };
  ChunkStream.prototype.end = function(data, encoding) {
    if (data) {
      this.write(data, encoding);
    }
    this.writable = false;
    if (!this._buffers) {
      return;
    }
    if (this._buffers.length === 0) {
      this._end();
    } else {
      this._buffers.push(null);
      this._process();
    }
  };
  ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
  ChunkStream.prototype._end = function() {
    if (this._reads.length > 0) {
      this.emit("error", new Error("Unexpected end of input"));
    }
    this.destroy();
  };
  ChunkStream.prototype.destroy = function() {
    if (!this._buffers) {
      return;
    }
    this.writable = false;
    this._reads = null;
    this._buffers = null;
    this.emit("close");
  };
  ChunkStream.prototype._processReadAllowingLess = function(read) {
    this._reads.shift();
    var smallerBuf = this._buffers[0];
    if (smallerBuf.length > read.length) {
      this._buffered -= read.length;
      this._buffers[0] = smallerBuf.slice(read.length);
      read.func.call(this, smallerBuf.slice(0, read.length));
    } else {
      this._buffered -= smallerBuf.length;
      this._buffers.shift();
      read.func.call(this, smallerBuf);
    }
  };
  ChunkStream.prototype._processRead = function(read) {
    this._reads.shift();
    var pos = 0;
    var count = 0;
    var data = new Buffer(read.length);
    while (pos < read.length) {
      var buf = this._buffers[count++];
      var len = Math.min(buf.length, read.length - pos);
      buf.copy(data, pos, 0, len);
      pos += len;
      if (len !== buf.length) {
        this._buffers[--count] = buf.slice(len);
      }
    }
    if (count > 0) {
      this._buffers.splice(0, count);
    }
    this._buffered -= read.length;
    read.func.call(this, data);
  };
  ChunkStream.prototype._process = function() {
    try {
      while (this._buffered > 0 && this._reads && this._reads.length > 0) {
        var read = this._reads[0];
        if (read.allowLess) {
          this._processReadAllowingLess(read);
        } else if (this._buffered >= read.length) {
          this._processRead(read);
        } else {
          break;
        }
      }
      if (this._buffers && !this.writable) {
        this._end();
      }
    } catch (ex) {
      this.emit("error", ex);
    }
  };
});

// node_modules/pngjs/lib/interlace.js
var require_interlace = __commonJS((exports) => {
  var imagePasses = [
    {
      x: [0],
      y: [0]
    },
    {
      x: [4],
      y: [0]
    },
    {
      x: [0, 4],
      y: [4]
    },
    {
      x: [2, 6],
      y: [0, 4]
    },
    {
      x: [0, 2, 4, 6],
      y: [2, 6]
    },
    {
      x: [1, 3, 5, 7],
      y: [0, 2, 4, 6]
    },
    {
      x: [0, 1, 2, 3, 4, 5, 6, 7],
      y: [1, 3, 5, 7]
    }
  ];
  exports.getImagePasses = function(width, height) {
    var images = [];
    var xLeftOver = width % 8;
    var yLeftOver = height % 8;
    var xRepeats = (width - xLeftOver) / 8;
    var yRepeats = (height - yLeftOver) / 8;
    for (var i2 = 0;i2 < imagePasses.length; i2++) {
      var pass = imagePasses[i2];
      var passWidth = xRepeats * pass.x.length;
      var passHeight = yRepeats * pass.y.length;
      for (var j = 0;j < pass.x.length; j++) {
        if (pass.x[j] < xLeftOver) {
          passWidth++;
        } else {
          break;
        }
      }
      for (j = 0;j < pass.y.length; j++) {
        if (pass.y[j] < yLeftOver) {
          passHeight++;
        } else {
          break;
        }
      }
      if (passWidth > 0 && passHeight > 0) {
        images.push({ width: passWidth, height: passHeight, index: i2 });
      }
    }
    return images;
  };
  exports.getInterlaceIterator = function(width) {
    return function(x, y, pass) {
      var outerXLeftOver = x % imagePasses[pass].x.length;
      var outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
      var outerYLeftOver = y % imagePasses[pass].y.length;
      var outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
      return outerX * 4 + outerY * width * 4;
    };
  };
});

// node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = __commonJS((exports, module) => {
  module.exports = function paethPredictor(left, above, upLeft) {
    var paeth = left + above - upLeft;
    var pLeft = Math.abs(paeth - left);
    var pAbove = Math.abs(paeth - above);
    var pUpLeft = Math.abs(paeth - upLeft);
    if (pLeft <= pAbove && pLeft <= pUpLeft) {
      return left;
    }
    if (pAbove <= pUpLeft) {
      return above;
    }
    return upLeft;
  };
});

// node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = __commonJS((exports, module) => {
  var getByteWidth = function(width, bpp, depth) {
    var byteWidth = width * bpp;
    if (depth !== 8) {
      byteWidth = Math.ceil(byteWidth / (8 / depth));
    }
    return byteWidth;
  };
  var interlaceUtils = require_interlace();
  var paethPredictor = require_paeth_predictor();
  var Filter = module.exports = function(bitmapInfo, dependencies) {
    var width = bitmapInfo.width;
    var height = bitmapInfo.height;
    var interlace = bitmapInfo.interlace;
    var bpp = bitmapInfo.bpp;
    var depth = bitmapInfo.depth;
    this.read = dependencies.read;
    this.write = dependencies.write;
    this.complete = dependencies.complete;
    this._imageIndex = 0;
    this._images = [];
    if (interlace) {
      var passes = interlaceUtils.getImagePasses(width, height);
      for (var i2 = 0;i2 < passes.length; i2++) {
        this._images.push({
          byteWidth: getByteWidth(passes[i2].width, bpp, depth),
          height: passes[i2].height,
          lineIndex: 0
        });
      }
    } else {
      this._images.push({
        byteWidth: getByteWidth(width, bpp, depth),
        height,
        lineIndex: 0
      });
    }
    if (depth === 8) {
      this._xComparison = bpp;
    } else if (depth === 16) {
      this._xComparison = bpp * 2;
    } else {
      this._xComparison = 1;
    }
  };
  Filter.prototype.start = function() {
    this.read(this._images[this._imageIndex].byteWidth + 1, this._reverseFilterLine.bind(this));
  };
  Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
    var xComparison = this._xComparison;
    var xBiggerThan = xComparison - 1;
    for (var x = 0;x < byteWidth; x++) {
      var rawByte = rawData[1 + x];
      var f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
      unfilteredLine[x] = rawByte + f1Left;
    }
  };
  Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
    var lastLine = this._lastLine;
    for (var x = 0;x < byteWidth; x++) {
      var rawByte = rawData[1 + x];
      var f2Up = lastLine ? lastLine[x] : 0;
      unfilteredLine[x] = rawByte + f2Up;
    }
  };
  Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
    var xComparison = this._xComparison;
    var xBiggerThan = xComparison - 1;
    var lastLine = this._lastLine;
    for (var x = 0;x < byteWidth; x++) {
      var rawByte = rawData[1 + x];
      var f3Up = lastLine ? lastLine[x] : 0;
      var f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
      var f3Add = Math.floor((f3Left + f3Up) / 2);
      unfilteredLine[x] = rawByte + f3Add;
    }
  };
  Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
    var xComparison = this._xComparison;
    var xBiggerThan = xComparison - 1;
    var lastLine = this._lastLine;
    for (var x = 0;x < byteWidth; x++) {
      var rawByte = rawData[1 + x];
      var f4Up = lastLine ? lastLine[x] : 0;
      var f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
      var f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
      var f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
      unfilteredLine[x] = rawByte + f4Add;
    }
  };
  Filter.prototype._reverseFilterLine = function(rawData) {
    var filter = rawData[0];
    var unfilteredLine;
    var currentImage = this._images[this._imageIndex];
    var byteWidth = currentImage.byteWidth;
    if (filter === 0) {
      unfilteredLine = rawData.slice(1, byteWidth + 1);
    } else {
      unfilteredLine = new Buffer(byteWidth);
      switch (filter) {
        case 1:
          this._unFilterType1(rawData, unfilteredLine, byteWidth);
          break;
        case 2:
          this._unFilterType2(rawData, unfilteredLine, byteWidth);
          break;
        case 3:
          this._unFilterType3(rawData, unfilteredLine, byteWidth);
          break;
        case 4:
          this._unFilterType4(rawData, unfilteredLine, byteWidth);
          break;
        default:
          throw new Error("Unrecognised filter type - " + filter);
      }
    }
    this.write(unfilteredLine);
    currentImage.lineIndex++;
    if (currentImage.lineIndex >= currentImage.height) {
      this._lastLine = null;
      this._imageIndex++;
      currentImage = this._images[this._imageIndex];
    } else {
      this._lastLine = unfilteredLine;
    }
    if (currentImage) {
      this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
    } else {
      this._lastLine = null;
      this.complete();
    }
  };
});

// node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = __commonJS((exports, module) => {
  var util = __require("util");
  var ChunkStream = require_chunkstream();
  var Filter = require_filter_parse();
  var FilterAsync = module.exports = function(bitmapInfo) {
    ChunkStream.call(this);
    var buffers = [];
    var that = this;
    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: function(buffer) {
        buffers.push(buffer);
      },
      complete: function() {
        that.emit("complete", Buffer.concat(buffers));
      }
    });
    this._filter.start();
  };
  util.inherits(FilterAsync, ChunkStream);
});

// node_modules/pngjs/lib/constants.js
var require_constants = __commonJS((exports, module) => {
  module.exports = {
    PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
    TYPE_IHDR: 1229472850,
    TYPE_IEND: 1229278788,
    TYPE_IDAT: 1229209940,
    TYPE_PLTE: 1347179589,
    TYPE_tRNS: 1951551059,
    TYPE_gAMA: 1732332865,
    COLORTYPE_GRAYSCALE: 0,
    COLORTYPE_PALETTE: 1,
    COLORTYPE_COLOR: 2,
    COLORTYPE_ALPHA: 4,
    COLORTYPE_PALETTE_COLOR: 3,
    COLORTYPE_COLOR_ALPHA: 6,
    COLORTYPE_TO_BPP_MAP: {
      0: 1,
      2: 3,
      3: 1,
      4: 2,
      6: 4
    },
    GAMMA_DIVISION: 1e5
  };
});

// node_modules/pngjs/lib/crc.js
var require_crc = __commonJS((exports, module) => {
  var crcTable = [];
  (function() {
    for (var i2 = 0;i2 < 256; i2++) {
      var currentCrc = i2;
      for (var j = 0;j < 8; j++) {
        if (currentCrc & 1) {
          currentCrc = 3988292384 ^ currentCrc >>> 1;
        } else {
          currentCrc = currentCrc >>> 1;
        }
      }
      crcTable[i2] = currentCrc;
    }
  })();
  var CrcCalculator = module.exports = function() {
    this._crc = -1;
  };
  CrcCalculator.prototype.write = function(data) {
    for (var i2 = 0;i2 < data.length; i2++) {
      this._crc = crcTable[(this._crc ^ data[i2]) & 255] ^ this._crc >>> 8;
    }
    return true;
  };
  CrcCalculator.prototype.crc32 = function() {
    return this._crc ^ -1;
  };
  CrcCalculator.crc32 = function(buf) {
    var crc = -1;
    for (var i2 = 0;i2 < buf.length; i2++) {
      crc = crcTable[(crc ^ buf[i2]) & 255] ^ crc >>> 8;
    }
    return crc ^ -1;
  };
});

// node_modules/pngjs/lib/parser.js
var require_parser = __commonJS((exports, module) => {
  var constants = require_constants();
  var CrcCalculator = require_crc();
  var Parser = module.exports = function(options, dependencies) {
    this._options = options;
    options.checkCRC = options.checkCRC !== false;
    this._hasIHDR = false;
    this._hasIEND = false;
    this._emittedHeadersFinished = false;
    this._palette = [];
    this._colorType = 0;
    this._chunks = {};
    this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
    this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
    this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
    this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
    this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
    this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);
    this.read = dependencies.read;
    this.error = dependencies.error;
    this.metadata = dependencies.metadata;
    this.gamma = dependencies.gamma;
    this.transColor = dependencies.transColor;
    this.palette = dependencies.palette;
    this.parsed = dependencies.parsed;
    this.inflateData = dependencies.inflateData;
    this.finished = dependencies.finished;
    this.simpleTransparency = dependencies.simpleTransparency;
    this.headersFinished = dependencies.headersFinished || function() {
    };
  };
  Parser.prototype.start = function() {
    this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
  };
  Parser.prototype._parseSignature = function(data) {
    var signature = constants.PNG_SIGNATURE;
    for (var i2 = 0;i2 < signature.length; i2++) {
      if (data[i2] !== signature[i2]) {
        this.error(new Error("Invalid file signature"));
        return;
      }
    }
    this.read(8, this._parseChunkBegin.bind(this));
  };
  Parser.prototype._parseChunkBegin = function(data) {
    var length = data.readUInt32BE(0);
    var type = data.readUInt32BE(4);
    var name = "";
    for (var i2 = 4;i2 < 8; i2++) {
      name += String.fromCharCode(data[i2]);
    }
    var ancillary = Boolean(data[4] & 32);
    if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
      this.error(new Error("Expected IHDR on beggining"));
      return;
    }
    this._crc = new CrcCalculator;
    this._crc.write(new Buffer(name));
    if (this._chunks[type]) {
      return this._chunks[type](length);
    }
    if (!ancillary) {
      this.error(new Error("Unsupported critical chunk type " + name));
      return;
    }
    this.read(length + 4, this._skipChunk.bind(this));
  };
  Parser.prototype._skipChunk = function() {
    this.read(8, this._parseChunkBegin.bind(this));
  };
  Parser.prototype._handleChunkEnd = function() {
    this.read(4, this._parseChunkEnd.bind(this));
  };
  Parser.prototype._parseChunkEnd = function(data) {
    var fileCrc = data.readInt32BE(0);
    var calcCrc = this._crc.crc32();
    if (this._options.checkCRC && calcCrc !== fileCrc) {
      this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
      return;
    }
    if (!this._hasIEND) {
      this.read(8, this._parseChunkBegin.bind(this));
    }
  };
  Parser.prototype._handleIHDR = function(length) {
    this.read(length, this._parseIHDR.bind(this));
  };
  Parser.prototype._parseIHDR = function(data) {
    this._crc.write(data);
    var width = data.readUInt32BE(0);
    var height = data.readUInt32BE(4);
    var depth = data[8];
    var colorType = data[9];
    var compr = data[10];
    var filter = data[11];
    var interlace = data[12];
    if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
      this.error(new Error("Unsupported bit depth " + depth));
      return;
    }
    if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
      this.error(new Error("Unsupported color type"));
      return;
    }
    if (compr !== 0) {
      this.error(new Error("Unsupported compression method"));
      return;
    }
    if (filter !== 0) {
      this.error(new Error("Unsupported filter method"));
      return;
    }
    if (interlace !== 0 && interlace !== 1) {
      this.error(new Error("Unsupported interlace method"));
      return;
    }
    this._colorType = colorType;
    var bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];
    this._hasIHDR = true;
    this.metadata({
      width,
      height,
      depth,
      interlace: Boolean(interlace),
      palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
      color: Boolean(colorType & constants.COLORTYPE_COLOR),
      alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
      bpp,
      colorType
    });
    this._handleChunkEnd();
  };
  Parser.prototype._handlePLTE = function(length) {
    this.read(length, this._parsePLTE.bind(this));
  };
  Parser.prototype._parsePLTE = function(data) {
    this._crc.write(data);
    var entries = Math.floor(data.length / 3);
    for (var i2 = 0;i2 < entries; i2++) {
      this._palette.push([
        data[i2 * 3],
        data[i2 * 3 + 1],
        data[i2 * 3 + 2],
        255
      ]);
    }
    this.palette(this._palette);
    this._handleChunkEnd();
  };
  Parser.prototype._handleTRNS = function(length) {
    this.simpleTransparency();
    this.read(length, this._parseTRNS.bind(this));
  };
  Parser.prototype._parseTRNS = function(data) {
    this._crc.write(data);
    if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
      if (this._palette.length === 0) {
        this.error(new Error("Transparency chunk must be after palette"));
        return;
      }
      if (data.length > this._palette.length) {
        this.error(new Error("More transparent colors than palette size"));
        return;
      }
      for (var i2 = 0;i2 < data.length; i2++) {
        this._palette[i2][3] = data[i2];
      }
      this.palette(this._palette);
    }
    if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
      this.transColor([data.readUInt16BE(0)]);
    }
    if (this._colorType === constants.COLORTYPE_COLOR) {
      this.transColor([data.readUInt16BE(0), data.readUInt16BE(2), data.readUInt16BE(4)]);
    }
    this._handleChunkEnd();
  };
  Parser.prototype._handleGAMA = function(length) {
    this.read(length, this._parseGAMA.bind(this));
  };
  Parser.prototype._parseGAMA = function(data) {
    this._crc.write(data);
    this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);
    this._handleChunkEnd();
  };
  Parser.prototype._handleIDAT = function(length) {
    if (!this._emittedHeadersFinished) {
      this._emittedHeadersFinished = true;
      this.headersFinished();
    }
    this.read(-length, this._parseIDAT.bind(this, length));
  };
  Parser.prototype._parseIDAT = function(length, data) {
    this._crc.write(data);
    if (this._colorType === constants.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
      throw new Error("Expected palette not found");
    }
    this.inflateData(data);
    var leftOverLength = length - data.length;
    if (leftOverLength > 0) {
      this._handleIDAT(leftOverLength);
    } else {
      this._handleChunkEnd();
    }
  };
  Parser.prototype._handleIEND = function(length) {
    this.read(length, this._parseIEND.bind(this));
  };
  Parser.prototype._parseIEND = function(data) {
    this._crc.write(data);
    this._hasIEND = true;
    this._handleChunkEnd();
    if (this.finished) {
      this.finished();
    }
  };
});

// node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = __commonJS((exports) => {
  var bitRetriever = function(data, depth) {
    var leftOver = [];
    var i2 = 0;
    function split() {
      if (i2 === data.length) {
        throw new Error("Ran out of data");
      }
      var byte = data[i2];
      i2++;
      var byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
      switch (depth) {
        default:
          throw new Error("unrecognised depth");
        case 16:
          byte2 = data[i2];
          i2++;
          leftOver.push((byte << 8) + byte2);
          break;
        case 4:
          byte2 = byte & 15;
          byte1 = byte >> 4;
          leftOver.push(byte1, byte2);
          break;
        case 2:
          byte4 = byte & 3;
          byte3 = byte >> 2 & 3;
          byte2 = byte >> 4 & 3;
          byte1 = byte >> 6 & 3;
          leftOver.push(byte1, byte2, byte3, byte4);
          break;
        case 1:
          byte8 = byte & 1;
          byte7 = byte >> 1 & 1;
          byte6 = byte >> 2 & 1;
          byte5 = byte >> 3 & 1;
          byte4 = byte >> 4 & 1;
          byte3 = byte >> 5 & 1;
          byte2 = byte >> 6 & 1;
          byte1 = byte >> 7 & 1;
          leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
          break;
      }
    }
    return {
      get: function(count) {
        while (leftOver.length < count) {
          split();
        }
        var returner = leftOver.slice(0, count);
        leftOver = leftOver.slice(count);
        return returner;
      },
      resetAfterLine: function() {
        leftOver.length = 0;
      },
      end: function() {
        if (i2 !== data.length) {
          throw new Error("extra data found");
        }
      }
    };
  };
  var mapImage8Bit = function(image, pxData, getPxPos, bpp, data, rawPos) {
    var imageWidth = image.width;
    var imageHeight = image.height;
    var imagePass = image.index;
    for (var y = 0;y < imageHeight; y++) {
      for (var x = 0;x < imageWidth; x++) {
        var pxPos = getPxPos(x, y, imagePass);
        pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
        rawPos += bpp;
      }
    }
    return rawPos;
  };
  var mapImageCustomBit = function(image, pxData, getPxPos, bpp, bits, maxBit) {
    var imageWidth = image.width;
    var imageHeight = image.height;
    var imagePass = image.index;
    for (var y = 0;y < imageHeight; y++) {
      for (var x = 0;x < imageWidth; x++) {
        var pixelData = bits.get(bpp);
        var pxPos = getPxPos(x, y, imagePass);
        pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
      }
      bits.resetAfterLine();
    }
  };
  var interlaceUtils = require_interlace();
  var pixelBppMapper = [
    function() {
    },
    function(pxData, data, pxPos, rawPos) {
      if (rawPos === data.length) {
        throw new Error("Ran out of data");
      }
      var pixel = data[rawPos];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = 255;
    },
    function(pxData, data, pxPos, rawPos) {
      if (rawPos + 1 >= data.length) {
        throw new Error("Ran out of data");
      }
      var pixel = data[rawPos];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = data[rawPos + 1];
    },
    function(pxData, data, pxPos, rawPos) {
      if (rawPos + 2 >= data.length) {
        throw new Error("Ran out of data");
      }
      pxData[pxPos] = data[rawPos];
      pxData[pxPos + 1] = data[rawPos + 1];
      pxData[pxPos + 2] = data[rawPos + 2];
      pxData[pxPos + 3] = 255;
    },
    function(pxData, data, pxPos, rawPos) {
      if (rawPos + 3 >= data.length) {
        throw new Error("Ran out of data");
      }
      pxData[pxPos] = data[rawPos];
      pxData[pxPos + 1] = data[rawPos + 1];
      pxData[pxPos + 2] = data[rawPos + 2];
      pxData[pxPos + 3] = data[rawPos + 3];
    }
  ];
  var pixelBppCustomMapper = [
    function() {
    },
    function(pxData, pixelData, pxPos, maxBit) {
      var pixel = pixelData[0];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = maxBit;
    },
    function(pxData, pixelData, pxPos) {
      var pixel = pixelData[0];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = pixelData[1];
    },
    function(pxData, pixelData, pxPos, maxBit) {
      pxData[pxPos] = pixelData[0];
      pxData[pxPos + 1] = pixelData[1];
      pxData[pxPos + 2] = pixelData[2];
      pxData[pxPos + 3] = maxBit;
    },
    function(pxData, pixelData, pxPos) {
      pxData[pxPos] = pixelData[0];
      pxData[pxPos + 1] = pixelData[1];
      pxData[pxPos + 2] = pixelData[2];
      pxData[pxPos + 3] = pixelData[3];
    }
  ];
  exports.dataToBitMap = function(data, bitmapInfo) {
    var width = bitmapInfo.width;
    var height = bitmapInfo.height;
    var depth = bitmapInfo.depth;
    var bpp = bitmapInfo.bpp;
    var interlace = bitmapInfo.interlace;
    if (depth !== 8) {
      var bits = bitRetriever(data, depth);
    }
    var pxData;
    if (depth <= 8) {
      pxData = new Buffer(width * height * 4);
    } else {
      pxData = new Uint16Array(width * height * 4);
    }
    var maxBit = Math.pow(2, depth) - 1;
    var rawPos = 0;
    var images;
    var getPxPos;
    if (interlace) {
      images = interlaceUtils.getImagePasses(width, height);
      getPxPos = interlaceUtils.getInterlaceIterator(width, height);
    } else {
      var nonInterlacedPxPos = 0;
      getPxPos = function() {
        var returner = nonInterlacedPxPos;
        nonInterlacedPxPos += 4;
        return returner;
      };
      images = [{ width, height }];
    }
    for (var imageIndex = 0;imageIndex < images.length; imageIndex++) {
      if (depth === 8) {
        rawPos = mapImage8Bit(images[imageIndex], pxData, getPxPos, bpp, data, rawPos);
      } else {
        mapImageCustomBit(images[imageIndex], pxData, getPxPos, bpp, bits, maxBit);
      }
    }
    if (depth === 8) {
      if (rawPos !== data.length) {
        throw new Error("extra data found");
      }
    } else {
      bits.end();
    }
    return pxData;
  };
});

// node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = __commonJS((exports, module) => {
  var dePalette = function(indata, outdata, width, height, palette) {
    var pxPos = 0;
    for (var y = 0;y < height; y++) {
      for (var x = 0;x < width; x++) {
        var color = palette[indata[pxPos]];
        if (!color) {
          throw new Error("index " + indata[pxPos] + " not in palette");
        }
        for (var i2 = 0;i2 < 4; i2++) {
          outdata[pxPos + i2] = color[i2];
        }
        pxPos += 4;
      }
    }
  };
  var replaceTransparentColor = function(indata, outdata, width, height, transColor) {
    var pxPos = 0;
    for (var y = 0;y < height; y++) {
      for (var x = 0;x < width; x++) {
        var makeTrans = false;
        if (transColor.length === 1) {
          if (transColor[0] === indata[pxPos]) {
            makeTrans = true;
          }
        } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
          makeTrans = true;
        }
        if (makeTrans) {
          for (var i2 = 0;i2 < 4; i2++) {
            outdata[pxPos + i2] = 0;
          }
        }
        pxPos += 4;
      }
    }
  };
  var scaleDepth = function(indata, outdata, width, height, depth) {
    var maxOutSample = 255;
    var maxInSample = Math.pow(2, depth) - 1;
    var pxPos = 0;
    for (var y = 0;y < height; y++) {
      for (var x = 0;x < width; x++) {
        for (var i2 = 0;i2 < 4; i2++) {
          outdata[pxPos + i2] = Math.floor(indata[pxPos + i2] * maxOutSample / maxInSample + 0.5);
        }
        pxPos += 4;
      }
    }
  };
  module.exports = function(indata, imageData) {
    var depth = imageData.depth;
    var width = imageData.width;
    var height = imageData.height;
    var colorType = imageData.colorType;
    var transColor = imageData.transColor;
    var palette = imageData.palette;
    var outdata = indata;
    if (colorType === 3) {
      dePalette(indata, outdata, width, height, palette);
    } else {
      if (transColor) {
        replaceTransparentColor(indata, outdata, width, height, transColor);
      }
      if (depth !== 8) {
        if (depth === 16) {
          outdata = new Buffer(width * height * 4);
        }
        scaleDepth(indata, outdata, width, height, depth);
      }
    }
    return outdata;
  };
});

// node_modules/pngjs/lib/parser-async.js
var require_parser_async = __commonJS((exports, module) => {
  var util = __require("util");
  var zlib = __require("zlib");
  var ChunkStream = require_chunkstream();
  var FilterAsync = require_filter_parse_async();
  var Parser = require_parser();
  var bitmapper = require_bitmapper();
  var formatNormaliser = require_format_normaliser();
  var ParserAsync = module.exports = function(options) {
    ChunkStream.call(this);
    this._parser = new Parser(options, {
      read: this.read.bind(this),
      error: this._handleError.bind(this),
      metadata: this._handleMetaData.bind(this),
      gamma: this.emit.bind(this, "gamma"),
      palette: this._handlePalette.bind(this),
      transColor: this._handleTransColor.bind(this),
      finished: this._finished.bind(this),
      inflateData: this._inflateData.bind(this),
      simpleTransparency: this._simpleTransparency.bind(this),
      headersFinished: this._headersFinished.bind(this)
    });
    this._options = options;
    this.writable = true;
    this._parser.start();
  };
  util.inherits(ParserAsync, ChunkStream);
  ParserAsync.prototype._handleError = function(err) {
    this.emit("error", err);
    this.writable = false;
    this.destroy();
    if (this._inflate && this._inflate.destroy) {
      this._inflate.destroy();
    }
    if (this._filter) {
      this._filter.destroy();
      this._filter.on("error", function() {
      });
    }
    this.errord = true;
  };
  ParserAsync.prototype._inflateData = function(data) {
    if (!this._inflate) {
      if (this._bitmapInfo.interlace) {
        this._inflate = zlib.createInflate();
        this._inflate.on("error", this.emit.bind(this, "error"));
        this._filter.on("complete", this._complete.bind(this));
        this._inflate.pipe(this._filter);
      } else {
        var rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
        var imageSize = rowSize * this._bitmapInfo.height;
        var chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);
        this._inflate = zlib.createInflate({ chunkSize });
        var leftToInflate = imageSize;
        var emitError = this.emit.bind(this, "error");
        this._inflate.on("error", function(err) {
          if (!leftToInflate) {
            return;
          }
          emitError(err);
        });
        this._filter.on("complete", this._complete.bind(this));
        var filterWrite = this._filter.write.bind(this._filter);
        this._inflate.on("data", function(chunk) {
          if (!leftToInflate) {
            return;
          }
          if (chunk.length > leftToInflate) {
            chunk = chunk.slice(0, leftToInflate);
          }
          leftToInflate -= chunk.length;
          filterWrite(chunk);
        });
        this._inflate.on("end", this._filter.end.bind(this._filter));
      }
    }
    this._inflate.write(data);
  };
  ParserAsync.prototype._handleMetaData = function(metaData) {
    this._metaData = metaData;
    this._bitmapInfo = Object.create(metaData);
    this._filter = new FilterAsync(this._bitmapInfo);
  };
  ParserAsync.prototype._handleTransColor = function(transColor) {
    this._bitmapInfo.transColor = transColor;
  };
  ParserAsync.prototype._handlePalette = function(palette) {
    this._bitmapInfo.palette = palette;
  };
  ParserAsync.prototype._simpleTransparency = function() {
    this._metaData.alpha = true;
  };
  ParserAsync.prototype._headersFinished = function() {
    this.emit("metadata", this._metaData);
  };
  ParserAsync.prototype._finished = function() {
    if (this.errord) {
      return;
    }
    if (!this._inflate) {
      this.emit("error", "No Inflate block");
    } else {
      this._inflate.end();
    }
    this.destroySoon();
  };
  ParserAsync.prototype._complete = function(filteredData) {
    if (this.errord) {
      return;
    }
    try {
      var bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
      var normalisedBitmapData = formatNormaliser(bitmapData, this._bitmapInfo);
      bitmapData = null;
    } catch (ex) {
      this._handleError(ex);
      return;
    }
    this.emit("parsed", normalisedBitmapData);
  };
});

// node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = __commonJS((exports, module) => {
  var constants = require_constants();
  module.exports = function(dataIn, width, height, options) {
    var outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(options.colorType) !== -1;
    if (options.colorType === options.inputColorType) {
      var bigEndian = function() {
        var buffer = new ArrayBuffer(2);
        new DataView(buffer).setInt16(0, 256, true);
        return new Int16Array(buffer)[0] !== 256;
      }();
      if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
        return dataIn;
      }
    }
    var data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
    var maxValue = 255;
    var inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
    if (inBpp === 4 && !options.inputHasAlpha) {
      inBpp = 3;
    }
    var outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
    if (options.bitDepth === 16) {
      maxValue = 65535;
      outBpp *= 2;
    }
    var outData = new Buffer(width * height * outBpp);
    var inIndex = 0;
    var outIndex = 0;
    var bgColor = options.bgColor || {};
    if (bgColor.red === undefined) {
      bgColor.red = maxValue;
    }
    if (bgColor.green === undefined) {
      bgColor.green = maxValue;
    }
    if (bgColor.blue === undefined) {
      bgColor.blue = maxValue;
    }
    function getRGBA() {
      var red;
      var green;
      var blue;
      var alpha = maxValue;
      switch (options.inputColorType) {
        case constants.COLORTYPE_COLOR_ALPHA:
          alpha = data[inIndex + 3];
          red = data[inIndex];
          green = data[inIndex + 1];
          blue = data[inIndex + 2];
          break;
        case constants.COLORTYPE_COLOR:
          red = data[inIndex];
          green = data[inIndex + 1];
          blue = data[inIndex + 2];
          break;
        case constants.COLORTYPE_ALPHA:
          alpha = data[inIndex + 1];
          red = data[inIndex];
          green = red;
          blue = red;
          break;
        case constants.COLORTYPE_GRAYSCALE:
          red = data[inIndex];
          green = red;
          blue = red;
          break;
        default:
          throw new Error("input color type:" + options.inputColorType + " is not supported at present");
      }
      if (options.inputHasAlpha) {
        if (!outHasAlpha) {
          alpha /= maxValue;
          red = Math.min(Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0), maxValue);
          green = Math.min(Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0), maxValue);
          blue = Math.min(Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0), maxValue);
        }
      }
      return { red, green, blue, alpha };
    }
    for (var y = 0;y < height; y++) {
      for (var x = 0;x < width; x++) {
        var rgba = getRGBA(data, inIndex);
        switch (options.colorType) {
          case constants.COLORTYPE_COLOR_ALPHA:
          case constants.COLORTYPE_COLOR:
            if (options.bitDepth === 8) {
              outData[outIndex] = rgba.red;
              outData[outIndex + 1] = rgba.green;
              outData[outIndex + 2] = rgba.blue;
              if (outHasAlpha) {
                outData[outIndex + 3] = rgba.alpha;
              }
            } else {
              outData.writeUInt16BE(rgba.red, outIndex);
              outData.writeUInt16BE(rgba.green, outIndex + 2);
              outData.writeUInt16BE(rgba.blue, outIndex + 4);
              if (outHasAlpha) {
                outData.writeUInt16BE(rgba.alpha, outIndex + 6);
              }
            }
            break;
          case constants.COLORTYPE_ALPHA:
          case constants.COLORTYPE_GRAYSCALE:
            var grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
            if (options.bitDepth === 8) {
              outData[outIndex] = grayscale;
              if (outHasAlpha) {
                outData[outIndex + 1] = rgba.alpha;
              }
            } else {
              outData.writeUInt16BE(grayscale, outIndex);
              if (outHasAlpha) {
                outData.writeUInt16BE(rgba.alpha, outIndex + 2);
              }
            }
            break;
          default:
            throw new Error("unrecognised color Type " + options.colorType);
        }
        inIndex += inBpp;
        outIndex += outBpp;
      }
    }
    return outData;
  };
});

// node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = __commonJS((exports, module) => {
  var filterNone = function(pxData, pxPos, byteWidth, rawData, rawPos) {
    for (var x = 0;x < byteWidth; x++) {
      rawData[rawPos + x] = pxData[pxPos + x];
    }
  };
  var filterSumNone = function(pxData, pxPos, byteWidth) {
    var sum = 0;
    var length = pxPos + byteWidth;
    for (var i2 = pxPos;i2 < length; i2++) {
      sum += Math.abs(pxData[i2]);
    }
    return sum;
  };
  var filterSub = function(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
    for (var x = 0;x < byteWidth; x++) {
      var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      var val = pxData[pxPos + x] - left;
      rawData[rawPos + x] = val;
    }
  };
  var filterSumSub = function(pxData, pxPos, byteWidth, bpp) {
    var sum = 0;
    for (var x = 0;x < byteWidth; x++) {
      var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      var val = pxData[pxPos + x] - left;
      sum += Math.abs(val);
    }
    return sum;
  };
  var filterUp = function(pxData, pxPos, byteWidth, rawData, rawPos) {
    for (var x = 0;x < byteWidth; x++) {
      var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      var val = pxData[pxPos + x] - up;
      rawData[rawPos + x] = val;
    }
  };
  var filterSumUp = function(pxData, pxPos, byteWidth) {
    var sum = 0;
    var length = pxPos + byteWidth;
    for (var x = pxPos;x < length; x++) {
      var up = pxPos > 0 ? pxData[x - byteWidth] : 0;
      var val = pxData[x] - up;
      sum += Math.abs(val);
    }
    return sum;
  };
  var filterAvg = function(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
    for (var x = 0;x < byteWidth; x++) {
      var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      var val = pxData[pxPos + x] - (left + up >> 1);
      rawData[rawPos + x] = val;
    }
  };
  var filterSumAvg = function(pxData, pxPos, byteWidth, bpp) {
    var sum = 0;
    for (var x = 0;x < byteWidth; x++) {
      var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      var val = pxData[pxPos + x] - (left + up >> 1);
      sum += Math.abs(val);
    }
    return sum;
  };
  var filterPaeth = function(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
    for (var x = 0;x < byteWidth; x++) {
      var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      var upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
      var val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
      rawData[rawPos + x] = val;
    }
  };
  var filterSumPaeth = function(pxData, pxPos, byteWidth, bpp) {
    var sum = 0;
    for (var x = 0;x < byteWidth; x++) {
      var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      var upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
      var val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
      sum += Math.abs(val);
    }
    return sum;
  };
  var paethPredictor = require_paeth_predictor();
  var filters = {
    0: filterNone,
    1: filterSub,
    2: filterUp,
    3: filterAvg,
    4: filterPaeth
  };
  var filterSums = {
    0: filterSumNone,
    1: filterSumSub,
    2: filterSumUp,
    3: filterSumAvg,
    4: filterSumPaeth
  };
  module.exports = function(pxData, width, height, options, bpp) {
    var filterTypes;
    if (!("filterType" in options) || options.filterType === -1) {
      filterTypes = [0, 1, 2, 3, 4];
    } else if (typeof options.filterType === "number") {
      filterTypes = [options.filterType];
    } else {
      throw new Error("unrecognised filter types");
    }
    if (options.bitDepth === 16) {
      bpp *= 2;
    }
    var byteWidth = width * bpp;
    var rawPos = 0;
    var pxPos = 0;
    var rawData = new Buffer((byteWidth + 1) * height);
    var sel = filterTypes[0];
    for (var y = 0;y < height; y++) {
      if (filterTypes.length > 1) {
        var min = Infinity;
        for (var i2 = 0;i2 < filterTypes.length; i2++) {
          var sum = filterSums[filterTypes[i2]](pxData, pxPos, byteWidth, bpp);
          if (sum < min) {
            sel = filterTypes[i2];
            min = sum;
          }
        }
      }
      rawData[rawPos] = sel;
      rawPos++;
      filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
      rawPos += byteWidth;
      pxPos += byteWidth;
    }
    return rawData;
  };
});

// node_modules/pngjs/lib/packer.js
var require_packer = __commonJS((exports, module) => {
  var constants = require_constants();
  var CrcStream = require_crc();
  var bitPacker = require_bitpacker();
  var filter = require_filter_pack();
  var zlib = __require("zlib");
  var Packer = module.exports = function(options) {
    this._options = options;
    options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
    options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
    options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
    options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
    options.deflateFactory = options.deflateFactory || zlib.createDeflate;
    options.bitDepth = options.bitDepth || 8;
    options.colorType = typeof options.colorType === "number" ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
    options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;
    if ([
      constants.COLORTYPE_GRAYSCALE,
      constants.COLORTYPE_COLOR,
      constants.COLORTYPE_COLOR_ALPHA,
      constants.COLORTYPE_ALPHA
    ].indexOf(options.colorType) === -1) {
      throw new Error("option color type:" + options.colorType + " is not supported at present");
    }
    if ([
      constants.COLORTYPE_GRAYSCALE,
      constants.COLORTYPE_COLOR,
      constants.COLORTYPE_COLOR_ALPHA,
      constants.COLORTYPE_ALPHA
    ].indexOf(options.inputColorType) === -1) {
      throw new Error("option input color type:" + options.inputColorType + " is not supported at present");
    }
    if (options.bitDepth !== 8 && options.bitDepth !== 16) {
      throw new Error("option bit depth:" + options.bitDepth + " is not supported at present");
    }
  };
  Packer.prototype.getDeflateOptions = function() {
    return {
      chunkSize: this._options.deflateChunkSize,
      level: this._options.deflateLevel,
      strategy: this._options.deflateStrategy
    };
  };
  Packer.prototype.createDeflate = function() {
    return this._options.deflateFactory(this.getDeflateOptions());
  };
  Packer.prototype.filterData = function(data, width, height) {
    var packedData = bitPacker(data, width, height, this._options);
    var bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
    var filteredData = filter(packedData, width, height, this._options, bpp);
    return filteredData;
  };
  Packer.prototype._packChunk = function(type, data) {
    var len = data ? data.length : 0;
    var buf = new Buffer(len + 12);
    buf.writeUInt32BE(len, 0);
    buf.writeUInt32BE(type, 4);
    if (data) {
      data.copy(buf, 8);
    }
    buf.writeInt32BE(CrcStream.crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
    return buf;
  };
  Packer.prototype.packGAMA = function(gamma) {
    var buf = new Buffer(4);
    buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
    return this._packChunk(constants.TYPE_gAMA, buf);
  };
  Packer.prototype.packIHDR = function(width, height) {
    var buf = new Buffer(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = this._options.bitDepth;
    buf[9] = this._options.colorType;
    buf[10] = 0;
    buf[11] = 0;
    buf[12] = 0;
    return this._packChunk(constants.TYPE_IHDR, buf);
  };
  Packer.prototype.packIDAT = function(data) {
    return this._packChunk(constants.TYPE_IDAT, data);
  };
  Packer.prototype.packIEND = function() {
    return this._packChunk(constants.TYPE_IEND, null);
  };
});

// node_modules/pngjs/lib/packer-async.js
var require_packer_async = __commonJS((exports, module) => {
  var util = __require("util");
  var Stream = __require("stream");
  var constants = require_constants();
  var Packer = require_packer();
  var PackerAsync = module.exports = function(opt) {
    Stream.call(this);
    var options = opt || {};
    this._packer = new Packer(options);
    this._deflate = this._packer.createDeflate();
    this.readable = true;
  };
  util.inherits(PackerAsync, Stream);
  PackerAsync.prototype.pack = function(data, width, height, gamma) {
    this.emit("data", new Buffer(constants.PNG_SIGNATURE));
    this.emit("data", this._packer.packIHDR(width, height));
    if (gamma) {
      this.emit("data", this._packer.packGAMA(gamma));
    }
    var filteredData = this._packer.filterData(data, width, height);
    this._deflate.on("error", this.emit.bind(this, "error"));
    this._deflate.on("data", function(compressedData) {
      this.emit("data", this._packer.packIDAT(compressedData));
    }.bind(this));
    this._deflate.on("end", function() {
      this.emit("data", this._packer.packIEND());
      this.emit("end");
    }.bind(this));
    this._deflate.end(filteredData);
  };
});

// node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = __commonJS((exports, module) => {
  var Inflate = function(opts) {
    if (!(this instanceof Inflate)) {
      return new Inflate(opts);
    }
    if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
      opts.chunkSize = zlib.Z_MIN_CHUNK;
    }
    zlib.Inflate.call(this, opts);
    this._offset = this._offset === undefined ? this._outOffset : this._offset;
    this._buffer = this._buffer || this._outBuffer;
    if (opts && opts.maxLength != null) {
      this._maxLength = opts.maxLength;
    }
  };
  var createInflate = function(opts) {
    return new Inflate(opts);
  };
  var _close = function(engine, callback) {
    if (callback) {
      process.nextTick(callback);
    }
    if (!engine._handle) {
      return;
    }
    engine._handle.close();
    engine._handle = null;
  };
  var zlibBufferSync = function(engine, buffer) {
    if (typeof buffer === "string") {
      buffer = Buffer.from(buffer);
    }
    if (!(buffer instanceof Buffer)) {
      throw new TypeError("Not a string or buffer");
    }
    var flushFlag = engine._finishFlushFlag;
    if (flushFlag == null) {
      flushFlag = zlib.Z_FINISH;
    }
    return engine._processChunk(buffer, flushFlag);
  };
  var inflateSync = function(buffer, opts) {
    return zlibBufferSync(new Inflate(opts), buffer);
  };
  var assert = __require("assert").ok;
  var zlib = __require("zlib");
  var util = __require("util");
  var kMaxLength = __require("buffer").kMaxLength;
  Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
    if (typeof asyncCb === "function") {
      return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
    }
    var self2 = this;
    var availInBefore = chunk && chunk.length;
    var availOutBefore = this._chunkSize - this._offset;
    var leftToInflate = this._maxLength;
    var inOff = 0;
    var buffers = [];
    var nread = 0;
    var error;
    this.on("error", function(err) {
      error = err;
    });
    function handleChunk(availInAfter, availOutAfter) {
      if (self2._hadError) {
        return;
      }
      var have = availOutBefore - availOutAfter;
      assert(have >= 0, "have should not go down");
      if (have > 0) {
        var out = self2._buffer.slice(self2._offset, self2._offset + have);
        self2._offset += have;
        if (out.length > leftToInflate) {
          out = out.slice(0, leftToInflate);
        }
        buffers.push(out);
        nread += out.length;
        leftToInflate -= out.length;
        if (leftToInflate === 0) {
          return false;
        }
      }
      if (availOutAfter === 0 || self2._offset >= self2._chunkSize) {
        availOutBefore = self2._chunkSize;
        self2._offset = 0;
        self2._buffer = Buffer.allocUnsafe(self2._chunkSize);
      }
      if (availOutAfter === 0) {
        inOff += availInBefore - availInAfter;
        availInBefore = availInAfter;
        return true;
      }
      return false;
    }
    assert(this._handle, "zlib binding closed");
    do {
      var res = this._handle.writeSync(flushFlag, chunk, inOff, availInBefore, this._buffer, this._offset, availOutBefore);
      res = res || this._writeState;
    } while (!this._hadError && handleChunk(res[0], res[1]));
    if (this._hadError) {
      throw error;
    }
    if (nread >= kMaxLength) {
      _close(this);
      throw new RangeError("Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes");
    }
    var buf = Buffer.concat(buffers, nread);
    _close(this);
    return buf;
  };
  util.inherits(Inflate, zlib.Inflate);
  module.exports = exports = inflateSync;
  exports.Inflate = Inflate;
  exports.createInflate = createInflate;
  exports.inflateSync = inflateSync;
});

// node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = __commonJS((exports, module) => {
  var SyncReader = module.exports = function(buffer) {
    this._buffer = buffer;
    this._reads = [];
  };
  SyncReader.prototype.read = function(length, callback) {
    this._reads.push({
      length: Math.abs(length),
      allowLess: length < 0,
      func: callback
    });
  };
  SyncReader.prototype.process = function() {
    while (this._reads.length > 0 && this._buffer.length) {
      var read = this._reads[0];
      if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
        this._reads.shift();
        var buf = this._buffer;
        this._buffer = buf.slice(read.length);
        read.func.call(this, buf.slice(0, read.length));
      } else {
        break;
      }
    }
    if (this._reads.length > 0) {
      return new Error("There are some read requests waitng on finished stream");
    }
    if (this._buffer.length > 0) {
      return new Error("unrecognised content at end of stream");
    }
  };
});

// node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = __commonJS((exports) => {
  var SyncReader = require_sync_reader();
  var Filter = require_filter_parse();
  exports.process = function(inBuffer, bitmapInfo) {
    var outBuffers = [];
    var reader = new SyncReader(inBuffer);
    var filter = new Filter(bitmapInfo, {
      read: reader.read.bind(reader),
      write: function(bufferPart) {
        outBuffers.push(bufferPart);
      },
      complete: function() {
      }
    });
    filter.start();
    reader.process();
    return Buffer.concat(outBuffers);
  };
});

// node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = __commonJS((exports, module) => {
  var hasSyncZlib = true;
  var zlib = __require("zlib");
  var inflateSync = require_sync_inflate();
  if (!zlib.deflateSync) {
    hasSyncZlib = false;
  }
  var SyncReader = require_sync_reader();
  var FilterSync = require_filter_parse_sync();
  var Parser = require_parser();
  var bitmapper = require_bitmapper();
  var formatNormaliser = require_format_normaliser();
  module.exports = function(buffer, options) {
    if (!hasSyncZlib) {
      throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
    }
    var err;
    function handleError(_err_) {
      err = _err_;
    }
    var metaData;
    function handleMetaData(_metaData_) {
      metaData = _metaData_;
    }
    function handleTransColor(transColor) {
      metaData.transColor = transColor;
    }
    function handlePalette(palette) {
      metaData.palette = palette;
    }
    function handleSimpleTransparency() {
      metaData.alpha = true;
    }
    var gamma;
    function handleGamma(_gamma_) {
      gamma = _gamma_;
    }
    var inflateDataList = [];
    function handleInflateData(inflatedData2) {
      inflateDataList.push(inflatedData2);
    }
    var reader = new SyncReader(buffer);
    var parser = new Parser(options, {
      read: reader.read.bind(reader),
      error: handleError,
      metadata: handleMetaData,
      gamma: handleGamma,
      palette: handlePalette,
      transColor: handleTransColor,
      inflateData: handleInflateData,
      simpleTransparency: handleSimpleTransparency
    });
    parser.start();
    reader.process();
    if (err) {
      throw err;
    }
    var inflateData = Buffer.concat(inflateDataList);
    inflateDataList.length = 0;
    var inflatedData;
    if (metaData.interlace) {
      inflatedData = zlib.inflateSync(inflateData);
    } else {
      var rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
      var imageSize = rowSize * metaData.height;
      inflatedData = inflateSync(inflateData, { chunkSize: imageSize, maxLength: imageSize });
    }
    inflateData = null;
    if (!inflatedData || !inflatedData.length) {
      throw new Error("bad png - invalid inflate data response");
    }
    var unfilteredData = FilterSync.process(inflatedData, metaData);
    inflateData = null;
    var bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
    unfilteredData = null;
    var normalisedBitmapData = formatNormaliser(bitmapData, metaData);
    metaData.data = normalisedBitmapData;
    metaData.gamma = gamma || 0;
    return metaData;
  };
});

// node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = __commonJS((exports, module) => {
  var hasSyncZlib = true;
  var zlib = __require("zlib");
  if (!zlib.deflateSync) {
    hasSyncZlib = false;
  }
  var constants = require_constants();
  var Packer = require_packer();
  module.exports = function(metaData, opt) {
    if (!hasSyncZlib) {
      throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
    }
    var options = opt || {};
    var packer = new Packer(options);
    var chunks = [];
    chunks.push(new Buffer(constants.PNG_SIGNATURE));
    chunks.push(packer.packIHDR(metaData.width, metaData.height));
    if (metaData.gamma) {
      chunks.push(packer.packGAMA(metaData.gamma));
    }
    var filteredData = packer.filterData(metaData.data, metaData.width, metaData.height);
    var compressedData = zlib.deflateSync(filteredData, packer.getDeflateOptions());
    filteredData = null;
    if (!compressedData || !compressedData.length) {
      throw new Error("bad png - invalid compressed data response");
    }
    chunks.push(packer.packIDAT(compressedData));
    chunks.push(packer.packIEND());
    return Buffer.concat(chunks);
  };
});

// node_modules/pngjs/lib/png-sync.js
var require_png_sync = __commonJS((exports) => {
  var parse = require_parser_sync();
  var pack = require_packer_sync();
  exports.read = function(buffer, options) {
    return parse(buffer, options || {});
  };
  exports.write = function(png, options) {
    return pack(png, options);
  };
});

// node_modules/pngjs/lib/png.js
var require_png = __commonJS((exports) => {
  var util = __require("util");
  var Stream = __require("stream");
  var Parser = require_parser_async();
  var Packer = require_packer_async();
  var PNGSync = require_png_sync();
  var PNG = exports.PNG = function(options) {
    Stream.call(this);
    options = options || {};
    this.width = options.width | 0;
    this.height = options.height | 0;
    this.data = this.width > 0 && this.height > 0 ? new Buffer(4 * this.width * this.height) : null;
    if (options.fill && this.data) {
      this.data.fill(0);
    }
    this.gamma = 0;
    this.readable = this.writable = true;
    this._parser = new Parser(options);
    this._parser.on("error", this.emit.bind(this, "error"));
    this._parser.on("close", this._handleClose.bind(this));
    this._parser.on("metadata", this._metadata.bind(this));
    this._parser.on("gamma", this._gamma.bind(this));
    this._parser.on("parsed", function(data) {
      this.data = data;
      this.emit("parsed", data);
    }.bind(this));
    this._packer = new Packer(options);
    this._packer.on("data", this.emit.bind(this, "data"));
    this._packer.on("end", this.emit.bind(this, "end"));
    this._parser.on("close", this._handleClose.bind(this));
    this._packer.on("error", this.emit.bind(this, "error"));
  };
  util.inherits(PNG, Stream);
  PNG.sync = PNGSync;
  PNG.prototype.pack = function() {
    if (!this.data || !this.data.length) {
      this.emit("error", "No data provided");
      return this;
    }
    process.nextTick(function() {
      this._packer.pack(this.data, this.width, this.height, this.gamma);
    }.bind(this));
    return this;
  };
  PNG.prototype.parse = function(data, callback) {
    if (callback) {
      var onParsed, onError;
      onParsed = function(parsedData) {
        this.removeListener("error", onError);
        this.data = parsedData;
        callback(null, this);
      }.bind(this);
      onError = function(err) {
        this.removeListener("parsed", onParsed);
        callback(err, null);
      }.bind(this);
      this.once("parsed", onParsed);
      this.once("error", onError);
    }
    this.end(data);
    return this;
  };
  PNG.prototype.write = function(data) {
    this._parser.write(data);
    return true;
  };
  PNG.prototype.end = function(data) {
    this._parser.end(data);
  };
  PNG.prototype._metadata = function(metadata) {
    this.width = metadata.width;
    this.height = metadata.height;
    this.emit("metadata", metadata);
  };
  PNG.prototype._gamma = function(gamma) {
    this.gamma = gamma;
  };
  PNG.prototype._handleClose = function() {
    if (!this._parser.writable && !this._packer.readable) {
      this.emit("close");
    }
  };
  PNG.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
    srcX |= 0;
    srcY |= 0;
    width |= 0;
    height |= 0;
    deltaX |= 0;
    deltaY |= 0;
    if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
      throw new Error("bitblt reading outside image");
    }
    if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
      throw new Error("bitblt writing outside image");
    }
    for (var y = 0;y < height; y++) {
      src.data.copy(dst.data, (deltaY + y) * dst.width + deltaX << 2, (srcY + y) * src.width + srcX << 2, (srcY + y) * src.width + srcX + width << 2);
    }
  };
  PNG.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
    PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
    return this;
  };
  PNG.adjustGamma = function(src) {
    if (src.gamma) {
      for (var y = 0;y < src.height; y++) {
        for (var x = 0;x < src.width; x++) {
          var idx = src.width * y + x << 2;
          for (var i2 = 0;i2 < 3; i2++) {
            var sample = src.data[idx + i2] / 255;
            sample = Math.pow(sample, 1 / 2.2 / src.gamma);
            src.data[idx + i2] = Math.round(sample * 255);
          }
        }
      }
      src.gamma = 0;
    }
  };
  PNG.prototype.adjustGamma = function() {
    PNG.adjustGamma(this);
  };
});

// js/util.js
var require_util = __commonJS((exports) => {
  var inherit = function() {
    for (var v in this) {
      this[v] = this[v];
    }
  };
  var hex = function(number, leading, usePrefix) {
    if (typeof usePrefix === "undefined") {
      usePrefix = true;
    }
    if (typeof leading === "undefined") {
      leading = 8;
    }
    var string = (number >>> 0).toString(16).toUpperCase();
    leading -= string.length;
    if (leading < 0)
      return string;
    return (usePrefix ? "0x" : "") + new Array(leading + 1).join("0") + string;
  };
  var Serializer = {
    TAG_INT: 1,
    TAG_STRING: 2,
    TAG_STRUCT: 3,
    TAG_BLOB: 4,
    TAG_BOOLEAN: 5,
    TYPE: "application/octet-stream",
    pointer: function() {
      this.index = 0;
      this.top = 0;
      this.stack = [];
    },
    pack: function(value) {
      var object = new DataView(new ArrayBuffer(4));
      object.setUint32(0, value, true);
      return object.buffer;
    },
    pack8: function(value) {
      var object = new DataView(new ArrayBuffer(1));
      object.setUint8(0, value, true);
      return object.buffer;
    },
    prefix: function(value) {
      return new Blob([Serializer.pack(value.size || value.length || value.byteLength), value], { type: Serializer.TYPE });
    },
    serialize: function(stream) {
      var parts = [];
      var size = 4;
      for (i in stream) {
        if (stream.hasOwnProperty(i)) {
          var tag;
          var head = Serializer.prefix(i);
          var body;
          switch (typeof stream[i]) {
            case "number":
              tag = Serializer.TAG_INT;
              body = Serializer.pack(stream[i]);
              break;
            case "string":
              tag = Serializer.TAG_STRING;
              body = Serializer.prefix(stream[i]);
              break;
            case "object":
              if (stream[i].type == Serializer.TYPE) {
                tag = Serializer.TAG_BLOB;
                body = stream[i];
              } else {
                tag = Serializer.TAG_STRUCT;
                body = Serializer.serialize(stream[i]);
              }
              break;
            case "boolean":
              tag = Serializer.TAG_BOOLEAN;
              body = Serializer.pack8(stream[i]);
              break;
            default:
              console.log(stream[i]);
              break;
          }
          size += 1 + head.size + (body.size || body.byteLength || body.length);
          parts.push(Serializer.pack8(tag));
          parts.push(head);
          parts.push(body);
        }
      }
      parts.unshift(Serializer.pack(size));
      return new Blob(parts);
    },
    deserialize: function(blob, callback) {
      var reader = new FileReader;
      reader.onload = function(data) {
        callback(Serializer.deserealizeStream(new DataView(data.target.result), new Serializer.pointer));
      };
      reader.readAsArrayBuffer(blob);
    },
    deserealizeStream: function(view, pointer) {
      pointer.push();
      var object = {};
      var remaining = view.getUint32(pointer.advance(4), true);
      while (pointer.mark() < remaining) {
        var tag = view.getUint8(pointer.advance(1));
        var head = pointer.readString(view);
        var body;
        switch (tag) {
          case Serializer.TAG_INT:
            body = view.getUint32(pointer.advance(4), true);
            break;
          case Serializer.TAG_STRING:
            body = pointer.readString(view);
            break;
          case Serializer.TAG_STRUCT:
            body = Serializer.deserealizeStream(view, pointer);
            break;
          case Serializer.TAG_BLOB:
            var size = view.getUint32(pointer.advance(4), true);
            body = view.buffer.slice(pointer.advance(size), pointer.advance(0));
            break;
          case Serializer.TAG_BOOLEAN:
            body = !!view.getUint8(pointer.advance(1));
            break;
        }
        object[head] = body;
      }
      if (pointer.mark() > remaining) {
        throw "Size of serialized data exceeded";
      }
      pointer.pop();
      return object;
    },
    serializePNG: function(blob, base, callback) {
      var canvas = document.createElement("canvas");
      var context = canvas.getContext("2d");
      var pixels = base.getContext("2d").getImageData(0, 0, base.width, base.height);
      var transparent = 0;
      for (var y = 0;y < base.height; ++y) {
        for (var x = 0;x < base.width; ++x) {
          if (!pixels.data[(x + y * base.width) * 4 + 3]) {
            ++transparent;
          }
        }
      }
      var bytesInCanvas = transparent * 3 + (base.width * base.height - transparent);
      for (var multiplier = 1;bytesInCanvas * multiplier * multiplier < blob.size; ++multiplier)
        ;
      var edges = bytesInCanvas * multiplier * multiplier - blob.size;
      var padding = Math.ceil(edges / (base.width * multiplier));
      canvas.setAttribute("width", base.width * multiplier);
      canvas.setAttribute("height", base.height * multiplier + padding);
      var reader = new FileReader;
      reader.onload = function(data) {
        var view = new Uint8Array(data.target.result);
        var pointer = 0;
        var pixelPointer = 0;
        var newPixels = context.createImageData(canvas.width, canvas.height + padding);
        for (var y2 = 0;y2 < canvas.height; ++y2) {
          for (var x2 = 0;x2 < canvas.width; ++x2) {
            var oldY = y2 / multiplier | 0;
            var oldX = x2 / multiplier | 0;
            if (oldY > base.height || !pixels.data[(oldX + oldY * base.width) * 4 + 3]) {
              newPixels.data[pixelPointer++] = view[pointer++];
              newPixels.data[pixelPointer++] = view[pointer++];
              newPixels.data[pixelPointer++] = view[pointer++];
              newPixels.data[pixelPointer++] = 0;
            } else {
              var byte = view[pointer++];
              newPixels.data[pixelPointer++] = pixels.data[(oldX + oldY * base.width) * 4 + 0] | byte & 7;
              newPixels.data[pixelPointer++] = pixels.data[(oldX + oldY * base.width) * 4 + 1] | byte >> 3 & 7;
              newPixels.data[pixelPointer++] = pixels.data[(oldX + oldY * base.width) * 4 + 2] | byte >> 6 & 7;
              newPixels.data[pixelPointer++] = pixels.data[(oldX + oldY * base.width) * 4 + 3];
            }
          }
        }
        context.putImageData(newPixels, 0, 0);
        callback(canvas.toDataURL("image/png"));
      };
      reader.readAsArrayBuffer(blob);
      return canvas;
    },
    deserializePNG: function(blob, callback) {
      var reader = new FileReader;
      reader.onload = function(data) {
        var image = document.createElement("img");
        image.setAttribute("src", data.target.result);
        var canvas = document.createElement("canvas");
        canvas.setAttribute("height", image.height);
        canvas.setAttribute("width", image.width);
        var context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        var data = [];
        for (var y = 0;y < canvas.height; ++y) {
          for (var x = 0;x < canvas.width; ++x) {
            if (!pixels.data[(x + y * canvas.width) * 4 + 3]) {
              data.push(pixels.data[(x + y * canvas.width) * 4 + 0]);
              data.push(pixels.data[(x + y * canvas.width) * 4 + 1]);
              data.push(pixels.data[(x + y * canvas.width) * 4 + 2]);
            } else {
              var byte = 0;
              byte |= pixels.data[(x + y * canvas.width) * 4 + 0] & 7;
              byte |= (pixels.data[(x + y * canvas.width) * 4 + 1] & 7) << 3;
              byte |= (pixels.data[(x + y * canvas.width) * 4 + 2] & 7) << 6;
              data.push(byte);
            }
          }
        }
        newBlob = new Blob(data.map(function(byte2) {
          var array = new Uint8Array(1);
          array[0] = byte2;
          return array;
        }), { type: Serializer.TYPE });
        Serializer.deserialize(newBlob, callback);
      };
      reader.readAsDataURL(blob);
    }
  };
  Serializer.pointer.prototype.advance = function(amount) {
    var index = this.index;
    this.index += amount;
    return index;
  };
  Serializer.pointer.prototype.mark = function() {
    return this.index - this.top;
  };
  Serializer.pointer.prototype.push = function() {
    this.stack.push(this.top);
    this.top = this.index;
  };
  Serializer.pointer.prototype.pop = function() {
    this.top = this.stack.pop();
  };
  Serializer.pointer.prototype.readString = function(view) {
    var length = view.getUint32(this.advance(4), true);
    var bytes = [];
    for (var i2 = 0;i2 < length; ++i2) {
      bytes.push(String.fromCharCode(view.getUint8(this.advance(1))));
    }
    return bytes.join("");
  };
  exports.inherit = inherit;
  exports.hex = hex;
  exports.Serializer = Serializer;
});

// js/arm.js
var require_arm = __commonJS((exports, module) => {
  var ARMCoreArm = function(cpu) {
    this.cpu = cpu;
    this.addressingMode23Immediate = [
      function(rn, offset, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn];
          if (!condOp || condOp()) {
            gprs[rn] -= offset;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      null,
      function(rn, offset, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn];
          if (!condOp || condOp()) {
            gprs[rn] += offset;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      null,
      function(rn, offset, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          return addr = gprs[rn] - offset;
        };
        address.writesPC = false;
        return address;
      },
      function(rn, offset, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn] - offset;
          if (!condOp || condOp()) {
            gprs[rn] = addr2;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      function(rn, offset, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          return addr = gprs[rn] + offset;
        };
        address.writesPC = false;
        return address;
      },
      function(rn, offset, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn] + offset;
          if (!condOp || condOp()) {
            gprs[rn] = addr2;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null
    ];
    this.addressingMode23Register = [
      function(rn, rm, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn];
          if (!condOp || condOp()) {
            gprs[rn] -= gprs[rm];
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      null,
      function(rn, rm, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn];
          if (!condOp || condOp()) {
            gprs[rn] += gprs[rm];
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      null,
      function(rn, rm, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          return gprs[rn] - gprs[rm];
        };
        address.writesPC = false;
        return address;
      },
      function(rn, rm, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn] - gprs[rm];
          if (!condOp || condOp()) {
            gprs[rn] = addr2;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      function(rn, rm, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn] + gprs[rm];
          return addr2;
        };
        address.writesPC = false;
        return address;
      },
      function(rn, rm, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn] + gprs[rm];
          if (!condOp || condOp()) {
            gprs[rn] = addr2;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null
    ];
    this.addressingMode2RegisterShifted = [
      function(rn, shiftOp, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn];
          if (!condOp || condOp()) {
            shiftOp();
            gprs[rn] -= cpu.shifterOperand;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      null,
      function(rn, shiftOp, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          var addr2 = gprs[rn];
          if (!condOp || condOp()) {
            shiftOp();
            gprs[rn] += cpu.shifterOperand;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      null,
      function(rn, shiftOp, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          shiftOp();
          return gprs[rn] - cpu.shifterOperand;
        };
        address.writesPC = false;
        return address;
      },
      function(rn, shiftOp, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          shiftOp();
          var addr2 = gprs[rn] - cpu.shifterOperand;
          if (!condOp || condOp()) {
            gprs[rn] = addr2;
          }
          return addr2;
        };
        address.writesPC = rn == cpu.PC;
        return address;
      },
      null,
      null,
      function(rn, shiftOp, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          shiftOp();
          return gprs[rn] + cpu.shifterOperand;
        };
        address.writesPC = false;
        return address;
      },
      function(rn, shiftOp, condOp) {
        var gprs = cpu.gprs;
        var address = function() {
          shiftOp();
          var addr2 = gprs[rn] + cpu.shifterOperand;
          if (!condOp || condOp()) {
            gprs[rn] = addr2;
          }
          return addr2;
        };
        address.writePC = rn == cpu.PC;
        return address;
      },
      null,
      null
    ];
  };
  ARMCoreArm.prototype.constructAddressingMode1ASR = function(rs, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      ++cpu.cycles;
      var shift = gprs[rs];
      if (rs == cpu.PC) {
        shift += 4;
      }
      shift &= 255;
      var shiftVal = gprs[rm];
      if (rm == cpu.PC) {
        shiftVal += 4;
      }
      if (shift == 0) {
        cpu.shifterOperand = shiftVal;
        cpu.shifterCarryOut = cpu.cpsrC;
      } else if (shift < 32) {
        cpu.shifterOperand = shiftVal >> shift;
        cpu.shifterCarryOut = shiftVal & 1 << shift - 1;
      } else if (gprs[rm] >> 31) {
        cpu.shifterOperand = 4294967295;
        cpu.shifterCarryOut = 2147483648;
      } else {
        cpu.shifterOperand = 0;
        cpu.shifterCarryOut = 0;
      }
    };
  };
  ARMCoreArm.prototype.constructAddressingMode1Immediate = function(immediate) {
    var cpu = this.cpu;
    return function() {
      cpu.shifterOperand = immediate;
      cpu.shifterCarryOut = cpu.cpsrC;
    };
  };
  ARMCoreArm.prototype.constructAddressingMode1ImmediateRotate = function(immediate, rotate) {
    var cpu = this.cpu;
    return function() {
      cpu.shifterOperand = immediate >>> rotate | immediate << 32 - rotate;
      cpu.shifterCarryOut = cpu.shifterOperand >> 31;
    };
  };
  ARMCoreArm.prototype.constructAddressingMode1LSL = function(rs, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      ++cpu.cycles;
      var shift = gprs[rs];
      if (rs == cpu.PC) {
        shift += 4;
      }
      shift &= 255;
      var shiftVal = gprs[rm];
      if (rm == cpu.PC) {
        shiftVal += 4;
      }
      if (shift == 0) {
        cpu.shifterOperand = shiftVal;
        cpu.shifterCarryOut = cpu.cpsrC;
      } else if (shift < 32) {
        cpu.shifterOperand = shiftVal << shift;
        cpu.shifterCarryOut = shiftVal & 1 << 32 - shift;
      } else if (shift == 32) {
        cpu.shifterOperand = 0;
        cpu.shifterCarryOut = shiftVal & 1;
      } else {
        cpu.shifterOperand = 0;
        cpu.shifterCarryOut = 0;
      }
    };
  };
  ARMCoreArm.prototype.constructAddressingMode1LSR = function(rs, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      ++cpu.cycles;
      var shift = gprs[rs];
      if (rs == cpu.PC) {
        shift += 4;
      }
      shift &= 255;
      var shiftVal = gprs[rm];
      if (rm == cpu.PC) {
        shiftVal += 4;
      }
      if (shift == 0) {
        cpu.shifterOperand = shiftVal;
        cpu.shifterCarryOut = cpu.cpsrC;
      } else if (shift < 32) {
        cpu.shifterOperand = shiftVal >>> shift;
        cpu.shifterCarryOut = shiftVal & 1 << shift - 1;
      } else if (shift == 32) {
        cpu.shifterOperand = 0;
        cpu.shifterCarryOut = shiftVal >> 31;
      } else {
        cpu.shifterOperand = 0;
        cpu.shifterCarryOut = 0;
      }
    };
  };
  ARMCoreArm.prototype.constructAddressingMode1ROR = function(rs, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      ++cpu.cycles;
      var shift = gprs[rs];
      if (rs == cpu.PC) {
        shift += 4;
      }
      shift &= 255;
      var shiftVal = gprs[rm];
      if (rm == cpu.PC) {
        shiftVal += 4;
      }
      var rotate = shift & 31;
      if (shift == 0) {
        cpu.shifterOperand = shiftVal;
        cpu.shifterCarryOut = cpu.cpsrC;
      } else if (rotate) {
        cpu.shifterOperand = gprs[rm] >>> rotate | gprs[rm] << 32 - rotate;
        cpu.shifterCarryOut = shiftVal & 1 << rotate - 1;
      } else {
        cpu.shifterOperand = shiftVal;
        cpu.shifterCarryOut = shiftVal >> 31;
      }
    };
  };
  ARMCoreArm.prototype.constructAddressingMode23Immediate = function(instruction, immediate, condOp) {
    var rn = (instruction & 983040) >> 16;
    return this.addressingMode23Immediate[(instruction & 27262976) >> 21](rn, immediate, condOp);
  };
  ARMCoreArm.prototype.constructAddressingMode23Register = function(instruction, rm, condOp) {
    var rn = (instruction & 983040) >> 16;
    return this.addressingMode23Register[(instruction & 27262976) >> 21](rn, rm, condOp);
  };
  ARMCoreArm.prototype.constructAddressingMode2RegisterShifted = function(instruction, shiftOp, condOp) {
    var rn = (instruction & 983040) >> 16;
    return this.addressingMode2RegisterShifted[(instruction & 27262976) >> 21](rn, shiftOp, condOp);
  };
  ARMCoreArm.prototype.constructAddressingMode4 = function(immediate, rn) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      var addr2 = gprs[rn] + immediate;
      return addr2;
    };
  };
  ARMCoreArm.prototype.constructAddressingMode4Writeback = function(immediate, offset, rn, overlap) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function(writeInitial) {
      var addr2 = gprs[rn] + immediate;
      if (writeInitial && overlap) {
        cpu.mmu.store32(gprs[rn] + immediate - 4, gprs[rn]);
      }
      gprs[rn] += offset;
      return addr2;
    };
  };
  ARMCoreArm.prototype.constructADC = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
      gprs[rd] = (gprs[rn] >>> 0) + shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructADCS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
      var d = (gprs[rn] >>> 0) + shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = d >> 31;
        cpu.cpsrZ = !(d & 4294967295);
        cpu.cpsrC = d > 4294967295;
        cpu.cpsrV = gprs[rn] >> 31 == shifterOperand >> 31 && gprs[rn] >> 31 != d >> 31 && shifterOperand >> 31 != d >> 31;
      }
      gprs[rd] = d;
    };
  };
  ARMCoreArm.prototype.constructADD = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
    };
  };
  ARMCoreArm.prototype.constructADDS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var d = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = d >> 31;
        cpu.cpsrZ = !(d & 4294967295);
        cpu.cpsrC = d > 4294967295;
        cpu.cpsrV = gprs[rn] >> 31 == cpu.shifterOperand >> 31 && gprs[rn] >> 31 != d >> 31 && cpu.shifterOperand >> 31 != d >> 31;
      }
      gprs[rd] = d;
    };
  };
  ARMCoreArm.prototype.constructAND = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] & cpu.shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructANDS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] & cpu.shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = gprs[rd] >> 31;
        cpu.cpsrZ = !(gprs[rd] & 4294967295);
        cpu.cpsrC = cpu.shifterCarryOut;
      }
    };
  };
  ARMCoreArm.prototype.constructB = function(immediate, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      if (condOp && !condOp()) {
        cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      gprs[cpu.PC] += immediate;
    };
  };
  ARMCoreArm.prototype.constructBIC = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructBICS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = gprs[rd] >> 31;
        cpu.cpsrZ = !(gprs[rd] & 4294967295);
        cpu.cpsrC = cpu.shifterCarryOut;
      }
    };
  };
  ARMCoreArm.prototype.constructBL = function(immediate, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      if (condOp && !condOp()) {
        cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      gprs[cpu.LR] = gprs[cpu.PC] - 4;
      gprs[cpu.PC] += immediate;
    };
  };
  ARMCoreArm.prototype.constructBX = function(rm, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      if (condOp && !condOp()) {
        cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      cpu.switchExecMode(gprs[rm] & 1);
      gprs[cpu.PC] = gprs[rm] & 4294967294;
    };
  };
  ARMCoreArm.prototype.constructCMN = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var aluOut = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = aluOut > 4294967295;
      cpu.cpsrV = gprs[rn] >> 31 == cpu.shifterOperand >> 31 && gprs[rn] >> 31 != aluOut >> 31 && cpu.shifterOperand >> 31 != aluOut >> 31;
    };
  };
  ARMCoreArm.prototype.constructCMP = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var aluOut = gprs[rn] - cpu.shifterOperand;
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = gprs[rn] >>> 0 >= cpu.shifterOperand >>> 0;
      cpu.cpsrV = gprs[rn] >> 31 != cpu.shifterOperand >> 31 && gprs[rn] >> 31 != aluOut >> 31;
    };
  };
  ARMCoreArm.prototype.constructEOR = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructEORS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = gprs[rd] >> 31;
        cpu.cpsrZ = !(gprs[rd] & 4294967295);
        cpu.cpsrC = cpu.shifterCarryOut;
      }
    };
  };
  ARMCoreArm.prototype.constructLDM = function(rs, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    var mmu = cpu.mmu;
    return function() {
      mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var addr2 = address(false);
      var total = 0;
      var m, i2;
      for (m = rs, i2 = 0;m; m >>= 1, ++i2) {
        if (m & 1) {
          gprs[i2] = mmu.load32(addr2 & 4294967292);
          addr2 += 4;
          ++total;
        }
      }
      mmu.waitMulti32(addr2, total);
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructLDMS = function(rs, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    var mmu = cpu.mmu;
    return function() {
      mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var addr2 = address(false);
      var total = 0;
      var mode = cpu.mode;
      cpu.switchMode(cpu.MODE_SYSTEM);
      var m, i2;
      for (m = rs, i2 = 0;m; m >>= 1, ++i2) {
        if (m & 1) {
          gprs[i2] = mmu.load32(addr2 & 4294967292);
          addr2 += 4;
          ++total;
        }
      }
      cpu.switchMode(mode);
      mmu.waitMulti32(addr2, total);
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructLDR = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var addr2 = address();
      gprs[rd] = cpu.mmu.load32(addr2);
      cpu.mmu.wait32(addr2);
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructLDRB = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var addr2 = address();
      gprs[rd] = cpu.mmu.loadU8(addr2);
      cpu.mmu.wait(addr2);
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructLDRH = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var addr2 = address();
      gprs[rd] = cpu.mmu.loadU16(addr2);
      cpu.mmu.wait(addr2);
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructLDRSB = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var addr2 = address();
      gprs[rd] = cpu.mmu.load8(addr2);
      cpu.mmu.wait(addr2);
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructLDRSH = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var addr2 = address();
      gprs[rd] = cpu.mmu.load16(addr2);
      cpu.mmu.wait(addr2);
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructMLA = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      ++cpu.cycles;
      cpu.mmu.waitMul(rs);
      if (gprs[rm] & 4294901760 && gprs[rs] & 4294901760) {
        var hi = (gprs[rm] & 4294901760) * gprs[rs] & 4294967295;
        var lo = (gprs[rm] & 65535) * gprs[rs] & 4294967295;
        gprs[rd] = hi + lo + gprs[rn] & 4294967295;
      } else {
        gprs[rd] = gprs[rm] * gprs[rs] + gprs[rn];
      }
    };
  };
  ARMCoreArm.prototype.constructMLAS = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      ++cpu.cycles;
      cpu.mmu.waitMul(rs);
      if (gprs[rm] & 4294901760 && gprs[rs] & 4294901760) {
        var hi = (gprs[rm] & 4294901760) * gprs[rs] & 4294967295;
        var lo = (gprs[rm] & 65535) * gprs[rs] & 4294967295;
        gprs[rd] = hi + lo + gprs[rn] & 4294967295;
      } else {
        gprs[rd] = gprs[rm] * gprs[rs] + gprs[rn];
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreArm.prototype.constructMOV = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = cpu.shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructMOVS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = cpu.shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = gprs[rd] >> 31;
        cpu.cpsrZ = !(gprs[rd] & 4294967295);
        cpu.cpsrC = cpu.shifterCarryOut;
      }
    };
  };
  ARMCoreArm.prototype.constructMRS = function(rd, r, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      if (r) {
        gprs[rd] = cpu.spsr;
      } else {
        gprs[rd] = cpu.packCPSR();
      }
    };
  };
  ARMCoreArm.prototype.constructMSR = function(rm, r, instruction, immediate, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    var c = instruction & 65536;
    var f = instruction & 524288;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      var operand;
      if (instruction & 33554432) {
        operand = immediate;
      } else {
        operand = gprs[rm];
      }
      var mask = (c ? 255 : 0) | (f ? 4278190080 : 0);
      if (r) {
        mask &= cpu.USER_MASK | cpu.PRIV_MASK | cpu.STATE_MASK;
        cpu.spsr = cpu.spsr & ~mask | operand & mask;
      } else {
        if (mask & cpu.USER_MASK) {
          cpu.cpsrN = operand >> 31;
          cpu.cpsrZ = operand & 1073741824;
          cpu.cpsrC = operand & 536870912;
          cpu.cpsrV = operand & 268435456;
        }
        if (cpu.mode != cpu.MODE_USER && mask & cpu.PRIV_MASK) {
          cpu.switchMode(operand & 15 | 16);
          cpu.cpsrI = operand & 128;
          cpu.cpsrF = operand & 64;
        }
      }
    };
  };
  ARMCoreArm.prototype.constructMUL = function(rd, rs, rm, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.mmu.waitMul(gprs[rs]);
      if (gprs[rm] & 4294901760 && gprs[rs] & 4294901760) {
        var hi = (gprs[rm] & 4294901760) * gprs[rs] | 0;
        var lo = (gprs[rm] & 65535) * gprs[rs] | 0;
        gprs[rd] = hi + lo;
      } else {
        gprs[rd] = gprs[rm] * gprs[rs];
      }
    };
  };
  ARMCoreArm.prototype.constructMULS = function(rd, rs, rm, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.mmu.waitMul(gprs[rs]);
      if (gprs[rm] & 4294901760 && gprs[rs] & 4294901760) {
        var hi = (gprs[rm] & 4294901760) * gprs[rs] | 0;
        var lo = (gprs[rm] & 65535) * gprs[rs] | 0;
        gprs[rd] = hi + lo;
      } else {
        gprs[rd] = gprs[rm] * gprs[rs];
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreArm.prototype.constructMVN = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = ~cpu.shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructMVNS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = ~cpu.shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = gprs[rd] >> 31;
        cpu.cpsrZ = !(gprs[rd] & 4294967295);
        cpu.cpsrC = cpu.shifterCarryOut;
      }
    };
  };
  ARMCoreArm.prototype.constructORR = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] | cpu.shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructORRS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] | cpu.shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = gprs[rd] >> 31;
        cpu.cpsrZ = !(gprs[rd] & 4294967295);
        cpu.cpsrC = cpu.shifterCarryOut;
      }
    };
  };
  ARMCoreArm.prototype.constructRSB = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = cpu.shifterOperand - gprs[rn];
    };
  };
  ARMCoreArm.prototype.constructRSBS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var d = cpu.shifterOperand - gprs[rn];
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = d >> 31;
        cpu.cpsrZ = !(d & 4294967295);
        cpu.cpsrC = cpu.shifterOperand >>> 0 >= gprs[rn] >>> 0;
        cpu.cpsrV = cpu.shifterOperand >> 31 != gprs[rn] >> 31 && cpu.shifterOperand >> 31 != d >> 31;
      }
      gprs[rd] = d;
    };
  };
  ARMCoreArm.prototype.constructRSC = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var n = (gprs[rn] >>> 0) + !cpu.cpsrC;
      gprs[rd] = (cpu.shifterOperand >>> 0) - n;
    };
  };
  ARMCoreArm.prototype.constructRSCS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var n = (gprs[rn] >>> 0) + !cpu.cpsrC;
      var d = (cpu.shifterOperand >>> 0) - n;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = d >> 31;
        cpu.cpsrZ = !(d & 4294967295);
        cpu.cpsrC = cpu.shifterOperand >>> 0 >= d >>> 0;
        cpu.cpsrV = cpu.shifterOperand >> 31 != n >> 31 && cpu.shifterOperand >> 31 != d >> 31;
      }
      gprs[rd] = d;
    };
  };
  ARMCoreArm.prototype.constructSBC = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
      gprs[rd] = (gprs[rn] >>> 0) - shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructSBCS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
      var d = (gprs[rn] >>> 0) - shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = d >> 31;
        cpu.cpsrZ = !(d & 4294967295);
        cpu.cpsrC = gprs[rn] >>> 0 >= d >>> 0;
        cpu.cpsrV = gprs[rn] >> 31 != shifterOperand >> 31 && gprs[rn] >> 31 != d >> 31;
      }
      gprs[rd] = d;
    };
  };
  ARMCoreArm.prototype.constructSMLAL = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.cycles += 2;
      cpu.mmu.waitMul(rs);
      var hi = (gprs[rm] & 4294901760) * gprs[rs];
      var lo = (gprs[rm] & 65535) * gprs[rs];
      var carry = (gprs[rn] >>> 0) + hi + lo;
      gprs[rn] = carry;
      gprs[rd] += Math.floor(carry * SHIFT_32);
    };
  };
  ARMCoreArm.prototype.constructSMLALS = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.cycles += 2;
      cpu.mmu.waitMul(rs);
      var hi = (gprs[rm] & 4294901760) * gprs[rs];
      var lo = (gprs[rm] & 65535) * gprs[rs];
      var carry = (gprs[rn] >>> 0) + hi + lo;
      gprs[rn] = carry;
      gprs[rd] += Math.floor(carry * SHIFT_32);
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295 || gprs[rn] & 4294967295);
    };
  };
  ARMCoreArm.prototype.constructSMULL = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      ++cpu.cycles;
      cpu.mmu.waitMul(gprs[rs]);
      var hi = ((gprs[rm] & 4294901760) >> 0) * (gprs[rs] >> 0);
      var lo = ((gprs[rm] & 65535) >> 0) * (gprs[rs] >> 0);
      gprs[rn] = (hi & 4294967295) + (lo & 4294967295) & 4294967295;
      gprs[rd] = Math.floor(hi * SHIFT_32 + lo * SHIFT_32);
    };
  };
  ARMCoreArm.prototype.constructSMULLS = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      ++cpu.cycles;
      cpu.mmu.waitMul(gprs[rs]);
      var hi = ((gprs[rm] & 4294901760) >> 0) * (gprs[rs] >> 0);
      var lo = ((gprs[rm] & 65535) >> 0) * (gprs[rs] >> 0);
      gprs[rn] = (hi & 4294967295) + (lo & 4294967295) & 4294967295;
      gprs[rd] = Math.floor(hi * SHIFT_32 + lo * SHIFT_32);
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295 || gprs[rn] & 4294967295);
    };
  };
  ARMCoreArm.prototype.constructSTM = function(rs, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    var mmu = cpu.mmu;
    return function() {
      if (condOp && !condOp()) {
        mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      mmu.wait32(gprs[cpu.PC]);
      var addr2 = address(true);
      var total = 0;
      var m, i2;
      for (m = rs, i2 = 0;m; m >>= 1, ++i2) {
        if (m & 1) {
          mmu.store32(addr2, gprs[i2]);
          addr2 += 4;
          ++total;
        }
      }
      mmu.waitMulti32(addr2, total);
    };
  };
  ARMCoreArm.prototype.constructSTMS = function(rs, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    var mmu = cpu.mmu;
    return function() {
      if (condOp && !condOp()) {
        mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      mmu.wait32(gprs[cpu.PC]);
      var mode = cpu.mode;
      var addr2 = address(true);
      var total = 0;
      var m, i2;
      cpu.switchMode(cpu.MODE_SYSTEM);
      for (m = rs, i2 = 0;m; m >>= 1, ++i2) {
        if (m & 1) {
          mmu.store32(addr2, gprs[i2]);
          addr2 += 4;
          ++total;
        }
      }
      cpu.switchMode(mode);
      mmu.waitMulti32(addr2, total);
    };
  };
  ARMCoreArm.prototype.constructSTR = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      if (condOp && !condOp()) {
        cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      var addr2 = address();
      cpu.mmu.store32(addr2, gprs[rd]);
      cpu.mmu.wait32(addr2);
      cpu.mmu.wait32(gprs[cpu.PC]);
    };
  };
  ARMCoreArm.prototype.constructSTRB = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      if (condOp && !condOp()) {
        cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      var addr2 = address();
      cpu.mmu.store8(addr2, gprs[rd]);
      cpu.mmu.wait(addr2);
      cpu.mmu.wait32(gprs[cpu.PC]);
    };
  };
  ARMCoreArm.prototype.constructSTRH = function(rd, address, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      if (condOp && !condOp()) {
        cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      var addr2 = address();
      cpu.mmu.store16(addr2, gprs[rd]);
      cpu.mmu.wait(addr2);
      cpu.mmu.wait32(gprs[cpu.PC]);
    };
  };
  ARMCoreArm.prototype.constructSUB = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      gprs[rd] = gprs[rn] - cpu.shifterOperand;
    };
  };
  ARMCoreArm.prototype.constructSUBS = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var d = gprs[rn] - cpu.shifterOperand;
      if (rd == cpu.PC && cpu.hasSPSR()) {
        cpu.unpackCPSR(cpu.spsr);
      } else {
        cpu.cpsrN = d >> 31;
        cpu.cpsrZ = !(d & 4294967295);
        cpu.cpsrC = gprs[rn] >>> 0 >= cpu.shifterOperand >>> 0;
        cpu.cpsrV = gprs[rn] >> 31 != cpu.shifterOperand >> 31 && gprs[rn] >> 31 != d >> 31;
      }
      gprs[rd] = d;
    };
  };
  ARMCoreArm.prototype.constructSWI = function(immediate, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      if (condOp && !condOp()) {
        cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
        return;
      }
      cpu.irq.swi32(immediate);
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
    };
  };
  ARMCoreArm.prototype.constructSWP = function(rd, rn, rm, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.mmu.wait32(gprs[rn]);
      cpu.mmu.wait32(gprs[rn]);
      var d = cpu.mmu.load32(gprs[rn]);
      cpu.mmu.store32(gprs[rn], gprs[rm]);
      gprs[rd] = d;
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructSWPB = function(rd, rn, rm, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.mmu.wait(gprs[rn]);
      cpu.mmu.wait(gprs[rn]);
      var d = cpu.mmu.load8(gprs[rn]);
      cpu.mmu.store8(gprs[rn], gprs[rm]);
      gprs[rd] = d;
      ++cpu.cycles;
    };
  };
  ARMCoreArm.prototype.constructTEQ = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var aluOut = gprs[rn] ^ cpu.shifterOperand;
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = cpu.shifterCarryOut;
    };
  };
  ARMCoreArm.prototype.constructTST = function(rd, rn, shiftOp, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      shiftOp();
      var aluOut = gprs[rn] & cpu.shifterOperand;
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = cpu.shifterCarryOut;
    };
  };
  ARMCoreArm.prototype.constructUMLAL = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.cycles += 2;
      cpu.mmu.waitMul(rs);
      var hi = ((gprs[rm] & 4294901760) >>> 0) * (gprs[rs] >>> 0);
      var lo = (gprs[rm] & 65535) * (gprs[rs] >>> 0);
      var carry = (gprs[rn] >>> 0) + hi + lo;
      gprs[rn] = carry;
      gprs[rd] += carry * SHIFT_32;
    };
  };
  ARMCoreArm.prototype.constructUMLALS = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      cpu.cycles += 2;
      cpu.mmu.waitMul(rs);
      var hi = ((gprs[rm] & 4294901760) >>> 0) * (gprs[rs] >>> 0);
      var lo = (gprs[rm] & 65535) * (gprs[rs] >>> 0);
      var carry = (gprs[rn] >>> 0) + hi + lo;
      gprs[rn] = carry;
      gprs[rd] += carry * SHIFT_32;
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295 || gprs[rn] & 4294967295);
    };
  };
  ARMCoreArm.prototype.constructUMULL = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      ++cpu.cycles;
      cpu.mmu.waitMul(gprs[rs]);
      var hi = ((gprs[rm] & 4294901760) >>> 0) * (gprs[rs] >>> 0);
      var lo = ((gprs[rm] & 65535) >>> 0) * (gprs[rs] >>> 0);
      gprs[rn] = (hi & 4294967295) + (lo & 4294967295) & 4294967295;
      gprs[rd] = hi * SHIFT_32 + lo * SHIFT_32 >>> 0;
    };
  };
  ARMCoreArm.prototype.constructUMULLS = function(rd, rn, rs, rm, condOp) {
    var cpu = this.cpu;
    var SHIFT_32 = 1 / 4294967296;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch32(gprs[cpu.PC]);
      if (condOp && !condOp()) {
        return;
      }
      ++cpu.cycles;
      cpu.mmu.waitMul(gprs[rs]);
      var hi = ((gprs[rm] & 4294901760) >>> 0) * (gprs[rs] >>> 0);
      var lo = ((gprs[rm] & 65535) >>> 0) * (gprs[rs] >>> 0);
      gprs[rn] = (hi & 4294967295) + (lo & 4294967295) & 4294967295;
      gprs[rd] = hi * SHIFT_32 + lo * SHIFT_32 >>> 0;
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295 || gprs[rn] & 4294967295);
    };
  };
  module.exports = ARMCoreArm;
});

// js/thumb.js
var require_thumb = __commonJS((exports, module) => {
  var ARMCoreThumb = function(cpu) {
    this.cpu = cpu;
  };
  ARMCoreThumb.prototype.constructADC = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var m = (gprs[rm] >>> 0) + !!cpu.cpsrC;
      var oldD = gprs[rd];
      var d = (oldD >>> 0) + m;
      var oldDn = oldD >> 31;
      var dn = d >> 31;
      var mn = m >> 31;
      cpu.cpsrN = dn;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = d > 4294967295;
      cpu.cpsrV = oldDn == mn && oldDn != dn && mn != dn;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructADD1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = (gprs[rn] >>> 0) + immediate;
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = d > 4294967295;
      cpu.cpsrV = !(gprs[rn] >> 31) && (gprs[rn] >> 31 ^ d) >> 31 && d >> 31;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructADD2 = function(rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = (gprs[rn] >>> 0) + immediate;
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = d > 4294967295;
      cpu.cpsrV = !(gprs[rn] >> 31) && (gprs[rn] ^ d) >> 31 && (immediate ^ d) >> 31;
      gprs[rn] = d;
    };
  };
  ARMCoreThumb.prototype.constructADD3 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = (gprs[rn] >>> 0) + (gprs[rm] >>> 0);
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = d > 4294967295;
      cpu.cpsrV = !((gprs[rn] ^ gprs[rm]) >> 31) && (gprs[rn] ^ d) >> 31 && (gprs[rm] ^ d) >> 31;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructADD4 = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] += gprs[rm];
    };
  };
  ARMCoreThumb.prototype.constructADD5 = function(rd, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = (gprs[cpu.PC] & 4294967292) + immediate;
    };
  };
  ARMCoreThumb.prototype.constructADD6 = function(rd, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = gprs[cpu.SP] + immediate;
    };
  };
  ARMCoreThumb.prototype.constructADD7 = function(immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[cpu.SP] += immediate;
    };
  };
  ARMCoreThumb.prototype.constructAND = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = gprs[rd] & gprs[rm];
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructASR1 = function(rd, rm, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      if (immediate == 0) {
        cpu.cpsrC = gprs[rm] >> 31;
        if (cpu.cpsrC) {
          gprs[rd] = 4294967295;
        } else {
          gprs[rd] = 0;
        }
      } else {
        cpu.cpsrC = gprs[rm] & 1 << immediate - 1;
        gprs[rd] = gprs[rm] >> immediate;
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructASR2 = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var rs = gprs[rm] & 255;
      if (rs) {
        if (rs < 32) {
          cpu.cpsrC = gprs[rd] & 1 << rs - 1;
          gprs[rd] >>= rs;
        } else {
          cpu.cpsrC = gprs[rd] >> 31;
          if (cpu.cpsrC) {
            gprs[rd] = 4294967295;
          } else {
            gprs[rd] = 0;
          }
        }
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructB1 = function(immediate, condOp) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      if (condOp()) {
        gprs[cpu.PC] += immediate;
      }
    };
  };
  ARMCoreThumb.prototype.constructB2 = function(immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[cpu.PC] += immediate;
    };
  };
  ARMCoreThumb.prototype.constructBIC = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = gprs[rd] & ~gprs[rm];
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructBL1 = function(immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[cpu.LR] = gprs[cpu.PC] + immediate;
    };
  };
  ARMCoreThumb.prototype.constructBL2 = function(immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var pc = gprs[cpu.PC];
      gprs[cpu.PC] = gprs[cpu.LR] + (immediate << 1);
      gprs[cpu.LR] = pc - 1;
    };
  };
  ARMCoreThumb.prototype.constructBX = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      cpu.switchExecMode(gprs[rm] & 1);
      var misalign = 0;
      if (rm == 15) {
        misalign = gprs[rm] & 2;
      }
      gprs[cpu.PC] = gprs[rm] & 4294967294 - misalign;
    };
  };
  ARMCoreThumb.prototype.constructCMN = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var aluOut = (gprs[rd] >>> 0) + (gprs[rm] >>> 0);
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = aluOut > 4294967295;
      cpu.cpsrV = gprs[rd] >> 31 == gprs[rm] >> 31 && gprs[rd] >> 31 != aluOut >> 31 && gprs[rm] >> 31 != aluOut >> 31;
    };
  };
  ARMCoreThumb.prototype.constructCMP1 = function(rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var aluOut = gprs[rn] - immediate;
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = gprs[rn] >>> 0 >= immediate;
      cpu.cpsrV = gprs[rn] >> 31 && (gprs[rn] ^ aluOut) >> 31;
    };
  };
  ARMCoreThumb.prototype.constructCMP2 = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = gprs[rd];
      var m = gprs[rm];
      var aluOut = d - m;
      var an = aluOut >> 31;
      var dn = d >> 31;
      cpu.cpsrN = an;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = d >>> 0 >= m >>> 0;
      cpu.cpsrV = dn != m >> 31 && dn != an;
    };
  };
  ARMCoreThumb.prototype.constructCMP3 = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var aluOut = gprs[rd] - gprs[rm];
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
      cpu.cpsrC = gprs[rd] >>> 0 >= gprs[rm] >>> 0;
      cpu.cpsrV = (gprs[rd] ^ gprs[rm]) >> 31 && (gprs[rd] ^ aluOut) >> 31;
    };
  };
  ARMCoreThumb.prototype.constructEOR = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = gprs[rd] ^ gprs[rm];
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructLDMIA = function(rn, rs) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var address = gprs[rn];
      var total = 0;
      var m, i2;
      for (m = 1, i2 = 0;i2 < 8; m <<= 1, ++i2) {
        if (rs & m) {
          gprs[i2] = cpu.mmu.load32(address);
          address += 4;
          ++total;
        }
      }
      cpu.mmu.waitMulti32(address, total);
      if (!(1 << rn & rs)) {
        gprs[rn] = address;
      }
    };
  };
  ARMCoreThumb.prototype.constructLDR1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var n = gprs[rn] + immediate;
      gprs[rd] = cpu.mmu.load32(n);
      cpu.mmu.wait32(n);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDR2 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.load32(gprs[rn] + gprs[rm]);
      cpu.mmu.wait32(gprs[rn] + gprs[rm]);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDR3 = function(rd, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.load32((gprs[cpu.PC] & 4294967292) + immediate);
      cpu.mmu.wait32(gprs[cpu.PC]);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDR4 = function(rd, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.load32(gprs[cpu.SP] + immediate);
      cpu.mmu.wait32(gprs[cpu.SP] + immediate);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDRB1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      var n = gprs[rn] + immediate;
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.loadU8(n);
      cpu.mmu.wait(n);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDRB2 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.loadU8(gprs[rn] + gprs[rm]);
      cpu.mmu.wait(gprs[rn] + gprs[rm]);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDRH1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      var n = gprs[rn] + immediate;
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.loadU16(n);
      cpu.mmu.wait(n);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDRH2 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.loadU16(gprs[rn] + gprs[rm]);
      cpu.mmu.wait(gprs[rn] + gprs[rm]);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDRSB = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.load8(gprs[rn] + gprs[rm]);
      cpu.mmu.wait(gprs[rn] + gprs[rm]);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLDRSH = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = cpu.mmu.load16(gprs[rn] + gprs[rm]);
      cpu.mmu.wait(gprs[rn] + gprs[rm]);
      ++cpu.cycles;
    };
  };
  ARMCoreThumb.prototype.constructLSL1 = function(rd, rm, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      if (immediate == 0) {
        gprs[rd] = gprs[rm];
      } else {
        cpu.cpsrC = gprs[rm] & 1 << 32 - immediate;
        gprs[rd] = gprs[rm] << immediate;
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructLSL2 = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var rs = gprs[rm] & 255;
      if (rs) {
        if (rs < 32) {
          cpu.cpsrC = gprs[rd] & 1 << 32 - rs;
          gprs[rd] <<= rs;
        } else {
          if (rs > 32) {
            cpu.cpsrC = 0;
          } else {
            cpu.cpsrC = gprs[rd] & 1;
          }
          gprs[rd] = 0;
        }
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructLSR1 = function(rd, rm, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      if (immediate == 0) {
        cpu.cpsrC = gprs[rm] >> 31;
        gprs[rd] = 0;
      } else {
        cpu.cpsrC = gprs[rm] & 1 << immediate - 1;
        gprs[rd] = gprs[rm] >>> immediate;
      }
      cpu.cpsrN = 0;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructLSR2 = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var rs = gprs[rm] & 255;
      if (rs) {
        if (rs < 32) {
          cpu.cpsrC = gprs[rd] & 1 << rs - 1;
          gprs[rd] >>>= rs;
        } else {
          if (rs > 32) {
            cpu.cpsrC = 0;
          } else {
            cpu.cpsrC = gprs[rd] >> 31;
          }
          gprs[rd] = 0;
        }
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructMOV1 = function(rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rn] = immediate;
      cpu.cpsrN = immediate >> 31;
      cpu.cpsrZ = !(immediate & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructMOV2 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = gprs[rn];
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = 0;
      cpu.cpsrV = 0;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructMOV3 = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = gprs[rm];
    };
  };
  ARMCoreThumb.prototype.constructMUL = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      cpu.mmu.waitMul(gprs[rm]);
      if (gprs[rm] & 4294901760 && gprs[rd] & 4294901760) {
        var hi = (gprs[rd] & 4294901760) * gprs[rm] & 4294967295;
        var lo = (gprs[rd] & 65535) * gprs[rm] & 4294967295;
        gprs[rd] = hi + lo & 4294967295;
      } else {
        gprs[rd] *= gprs[rm];
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructMVN = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = ~gprs[rm];
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructNEG = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = -gprs[rm];
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = 0 >= d >>> 0;
      cpu.cpsrV = gprs[rm] >> 31 && d >> 31;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructORR = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      gprs[rd] = gprs[rd] | gprs[rm];
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructPOP = function(rs, r) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      ++cpu.cycles;
      var address = gprs[cpu.SP];
      var total = 0;
      var m, i2;
      for (m = 1, i2 = 0;i2 < 8; m <<= 1, ++i2) {
        if (rs & m) {
          cpu.mmu.waitSeq32(address);
          gprs[i2] = cpu.mmu.load32(address);
          address += 4;
          ++total;
        }
      }
      if (r) {
        gprs[cpu.PC] = cpu.mmu.load32(address) & 4294967294;
        address += 4;
        ++total;
      }
      cpu.mmu.waitMulti32(address, total);
      gprs[cpu.SP] = address;
    };
  };
  ARMCoreThumb.prototype.constructPUSH = function(rs, r) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      var address = gprs[cpu.SP] - 4;
      var total = 0;
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      if (r) {
        cpu.mmu.store32(address, gprs[cpu.LR]);
        address -= 4;
        ++total;
      }
      var m, i2;
      for (m = 128, i2 = 7;m; m >>= 1, --i2) {
        if (rs & m) {
          cpu.mmu.store32(address, gprs[i2]);
          address -= 4;
          ++total;
          break;
        }
      }
      for (m >>= 1, --i2;m; m >>= 1, --i2) {
        if (rs & m) {
          cpu.mmu.store32(address, gprs[i2]);
          address -= 4;
          ++total;
        }
      }
      cpu.mmu.waitMulti32(address, total);
      gprs[cpu.SP] = address + 4;
    };
  };
  ARMCoreThumb.prototype.constructROR = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var rs = gprs[rm] & 255;
      if (rs) {
        var r4 = rs & 31;
        if (r4 > 0) {
          cpu.cpsrC = gprs[rd] & 1 << r4 - 1;
          gprs[rd] = gprs[rd] >>> r4 | gprs[rd] << 32 - r4;
        } else {
          cpu.cpsrC = gprs[rd] >> 31;
        }
      }
      cpu.cpsrN = gprs[rd] >> 31;
      cpu.cpsrZ = !(gprs[rd] & 4294967295);
    };
  };
  ARMCoreThumb.prototype.constructSBC = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var m = (gprs[rm] >>> 0) + !cpu.cpsrC;
      var d = (gprs[rd] >>> 0) - m;
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = gprs[rd] >>> 0 >= d >>> 0;
      cpu.cpsrV = (gprs[rd] ^ m) >> 31 && (gprs[rd] ^ d) >> 31;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructSTMIA = function(rn, rs) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.wait(gprs[cpu.PC]);
      var address = gprs[rn];
      var total = 0;
      var m, i2;
      for (m = 1, i2 = 0;i2 < 8; m <<= 1, ++i2) {
        if (rs & m) {
          cpu.mmu.store32(address, gprs[i2]);
          address += 4;
          ++total;
          break;
        }
      }
      for (m <<= 1, ++i2;i2 < 8; m <<= 1, ++i2) {
        if (rs & m) {
          cpu.mmu.store32(address, gprs[i2]);
          address += 4;
          ++total;
        }
      }
      cpu.mmu.waitMulti32(address, total);
      gprs[rn] = address;
    };
  };
  ARMCoreThumb.prototype.constructSTR1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      var n = gprs[rn] + immediate;
      cpu.mmu.store32(n, gprs[rd]);
      cpu.mmu.wait(gprs[cpu.PC]);
      cpu.mmu.wait32(n);
    };
  };
  ARMCoreThumb.prototype.constructSTR2 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.store32(gprs[rn] + gprs[rm], gprs[rd]);
      cpu.mmu.wait(gprs[cpu.PC]);
      cpu.mmu.wait32(gprs[rn] + gprs[rm]);
    };
  };
  ARMCoreThumb.prototype.constructSTR3 = function(rd, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.store32(gprs[cpu.SP] + immediate, gprs[rd]);
      cpu.mmu.wait(gprs[cpu.PC]);
      cpu.mmu.wait32(gprs[cpu.SP] + immediate);
    };
  };
  ARMCoreThumb.prototype.constructSTRB1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      var n = gprs[rn] + immediate;
      cpu.mmu.store8(n, gprs[rd]);
      cpu.mmu.wait(gprs[cpu.PC]);
      cpu.mmu.wait(n);
    };
  };
  ARMCoreThumb.prototype.constructSTRB2 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.store8(gprs[rn] + gprs[rm], gprs[rd]);
      cpu.mmu.wait(gprs[cpu.PC]);
      cpu.mmu.wait(gprs[rn] + gprs[rm]);
    };
  };
  ARMCoreThumb.prototype.constructSTRH1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      var n = gprs[rn] + immediate;
      cpu.mmu.store16(n, gprs[rd]);
      cpu.mmu.wait(gprs[cpu.PC]);
      cpu.mmu.wait(n);
    };
  };
  ARMCoreThumb.prototype.constructSTRH2 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.store16(gprs[rn] + gprs[rm], gprs[rd]);
      cpu.mmu.wait(gprs[cpu.PC]);
      cpu.mmu.wait(gprs[rn] + gprs[rm]);
    };
  };
  ARMCoreThumb.prototype.constructSUB1 = function(rd, rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = gprs[rn] - immediate;
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = gprs[rn] >>> 0 >= immediate;
      cpu.cpsrV = gprs[rn] >> 31 && (gprs[rn] ^ d) >> 31;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructSUB2 = function(rn, immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = gprs[rn] - immediate;
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = gprs[rn] >>> 0 >= immediate;
      cpu.cpsrV = gprs[rn] >> 31 && (gprs[rn] ^ d) >> 31;
      gprs[rn] = d;
    };
  };
  ARMCoreThumb.prototype.constructSUB3 = function(rd, rn, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var d = gprs[rn] - gprs[rm];
      cpu.cpsrN = d >> 31;
      cpu.cpsrZ = !(d & 4294967295);
      cpu.cpsrC = gprs[rn] >>> 0 >= gprs[rm] >>> 0;
      cpu.cpsrV = gprs[rn] >> 31 != gprs[rm] >> 31 && gprs[rn] >> 31 != d >> 31;
      gprs[rd] = d;
    };
  };
  ARMCoreThumb.prototype.constructSWI = function(immediate) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.irq.swi(immediate);
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
    };
  };
  ARMCoreThumb.prototype.constructTST = function(rd, rm) {
    var cpu = this.cpu;
    var gprs = cpu.gprs;
    return function() {
      cpu.mmu.waitPrefetch(gprs[cpu.PC]);
      var aluOut = gprs[rd] & gprs[rm];
      cpu.cpsrN = aluOut >> 31;
      cpu.cpsrZ = !(aluOut & 4294967295);
    };
  };
  module.exports = ARMCoreThumb;
});

// js/core.js
var require_core = __commonJS((exports, module) => {
  var ARMCore = function() {
    inherit.call(this);
    this.SP = 13;
    this.LR = 14;
    this.PC = 15;
    this.MODE_ARM = 0;
    this.MODE_THUMB = 1;
    this.MODE_USER = 16;
    this.MODE_FIQ = 17;
    this.MODE_IRQ = 18;
    this.MODE_SUPERVISOR = 19;
    this.MODE_ABORT = 23;
    this.MODE_UNDEFINED = 27;
    this.MODE_SYSTEM = 31;
    this.BANK_NONE = 0;
    this.BANK_FIQ = 1;
    this.BANK_IRQ = 2;
    this.BANK_SUPERVISOR = 3;
    this.BANK_ABORT = 4;
    this.BANK_UNDEFINED = 5;
    this.UNALLOC_MASK = 268435200;
    this.USER_MASK = 4026531840;
    this.PRIV_MASK = 207;
    this.STATE_MASK = 32;
    this.WORD_SIZE_ARM = 4;
    this.WORD_SIZE_THUMB = 2;
    this.BASE_RESET = 0;
    this.BASE_UNDEF = 4;
    this.BASE_SWI = 8;
    this.BASE_PABT = 12;
    this.BASE_DABT = 16;
    this.BASE_IRQ = 24;
    this.BASE_FIQ = 28;
    this.armCompiler = new ARMCoreArm(this);
    this.thumbCompiler = new ARMCoreThumb(this);
    this.generateConds();
    this.gprs = new Int32Array(16);
  };
  var inherit = require_util().inherit;
  var ARMCoreArm = require_arm();
  var ARMCoreThumb = require_thumb();
  ARMCore.prototype.resetCPU = function(startOffset) {
    for (var i2 = 0;i2 < this.PC; ++i2) {
      this.gprs[i2] = 0;
    }
    this.gprs[this.PC] = startOffset + this.WORD_SIZE_ARM;
    this.loadInstruction = this.loadInstructionArm;
    this.execMode = this.MODE_ARM;
    this.instructionWidth = this.WORD_SIZE_ARM;
    this.mode = this.MODE_SYSTEM;
    this.cpsrI = false;
    this.cpsrF = false;
    this.cpsrV = false;
    this.cpsrC = false;
    this.cpsrZ = false;
    this.cpsrN = false;
    this.bankedRegisters = [
      new Int32Array(7),
      new Int32Array(7),
      new Int32Array(2),
      new Int32Array(2),
      new Int32Array(2),
      new Int32Array(2)
    ];
    this.spsr = 0;
    this.bankedSPSRs = new Int32Array(6);
    this.cycles = 0;
    this.shifterOperand = 0;
    this.shifterCarryOut = 0;
    this.page = null;
    this.pageId = 0;
    this.pageRegion = -1;
    this.instruction = null;
    this.irq.clear();
    var gprs = this.gprs;
    var mmu = this.mmu;
    this.step = function() {
      var instruction = this.instruction || (this.instruction = this.loadInstruction(gprs[this.PC] - this.instructionWidth));
      gprs[this.PC] += this.instructionWidth;
      this.conditionPassed = true;
      instruction();
      if (!instruction.writesPC) {
        if (this.instruction != null) {
          if (instruction.next == null || instruction.next.page.invalid) {
            instruction.next = this.loadInstruction(gprs[this.PC] - this.instructionWidth);
          }
          this.instruction = instruction.next;
        }
      } else {
        if (this.conditionPassed) {
          var pc = gprs[this.PC] &= 4294967294;
          if (this.execMode == this.MODE_ARM) {
            mmu.wait32(pc);
            mmu.waitPrefetch32(pc);
          } else {
            mmu.wait(pc);
            mmu.waitPrefetch(pc);
          }
          gprs[this.PC] += this.instructionWidth;
          if (!instruction.fixedJump) {
            this.instruction = null;
          } else if (this.instruction != null) {
            if (instruction.next == null || instruction.next.page.invalid) {
              instruction.next = this.loadInstruction(gprs[this.PC] - this.instructionWidth);
            }
            this.instruction = instruction.next;
          }
        } else {
          this.instruction = null;
        }
      }
      this.irq.updateTimers();
    };
  };
  ARMCore.prototype.freeze = function() {
    return {
      gprs: [
        this.gprs[0],
        this.gprs[1],
        this.gprs[2],
        this.gprs[3],
        this.gprs[4],
        this.gprs[5],
        this.gprs[6],
        this.gprs[7],
        this.gprs[8],
        this.gprs[9],
        this.gprs[10],
        this.gprs[11],
        this.gprs[12],
        this.gprs[13],
        this.gprs[14],
        this.gprs[15]
      ],
      mode: this.mode,
      cpsrI: this.cpsrI,
      cpsrF: this.cpsrF,
      cpsrV: this.cpsrV,
      cpsrC: this.cpsrC,
      cpsrZ: this.cpsrZ,
      cpsrN: this.cpsrN,
      bankedRegisters: [
        [
          this.bankedRegisters[0][0],
          this.bankedRegisters[0][1],
          this.bankedRegisters[0][2],
          this.bankedRegisters[0][3],
          this.bankedRegisters[0][4],
          this.bankedRegisters[0][5],
          this.bankedRegisters[0][6]
        ],
        [
          this.bankedRegisters[1][0],
          this.bankedRegisters[1][1],
          this.bankedRegisters[1][2],
          this.bankedRegisters[1][3],
          this.bankedRegisters[1][4],
          this.bankedRegisters[1][5],
          this.bankedRegisters[1][6]
        ],
        [
          this.bankedRegisters[2][0],
          this.bankedRegisters[2][1]
        ],
        [
          this.bankedRegisters[3][0],
          this.bankedRegisters[3][1]
        ],
        [
          this.bankedRegisters[4][0],
          this.bankedRegisters[4][1]
        ],
        [
          this.bankedRegisters[5][0],
          this.bankedRegisters[5][1]
        ]
      ],
      spsr: this.spsr,
      bankedSPSRs: [
        this.bankedSPSRs[0],
        this.bankedSPSRs[1],
        this.bankedSPSRs[2],
        this.bankedSPSRs[3],
        this.bankedSPSRs[4],
        this.bankedSPSRs[5]
      ],
      cycles: this.cycles
    };
  };
  ARMCore.prototype.defrost = function(frost) {
    this.instruction = null;
    this.page = null;
    this.pageId = 0;
    this.pageRegion = -1;
    this.gprs[0] = frost.gprs[0];
    this.gprs[1] = frost.gprs[1];
    this.gprs[2] = frost.gprs[2];
    this.gprs[3] = frost.gprs[3];
    this.gprs[4] = frost.gprs[4];
    this.gprs[5] = frost.gprs[5];
    this.gprs[6] = frost.gprs[6];
    this.gprs[7] = frost.gprs[7];
    this.gprs[8] = frost.gprs[8];
    this.gprs[9] = frost.gprs[9];
    this.gprs[10] = frost.gprs[10];
    this.gprs[11] = frost.gprs[11];
    this.gprs[12] = frost.gprs[12];
    this.gprs[13] = frost.gprs[13];
    this.gprs[14] = frost.gprs[14];
    this.gprs[15] = frost.gprs[15];
    this.mode = frost.mode;
    this.cpsrI = frost.cpsrI;
    this.cpsrF = frost.cpsrF;
    this.cpsrV = frost.cpsrV;
    this.cpsrC = frost.cpsrC;
    this.cpsrZ = frost.cpsrZ;
    this.cpsrN = frost.cpsrN;
    this.bankedRegisters[0][0] = frost.bankedRegisters[0][0];
    this.bankedRegisters[0][1] = frost.bankedRegisters[0][1];
    this.bankedRegisters[0][2] = frost.bankedRegisters[0][2];
    this.bankedRegisters[0][3] = frost.bankedRegisters[0][3];
    this.bankedRegisters[0][4] = frost.bankedRegisters[0][4];
    this.bankedRegisters[0][5] = frost.bankedRegisters[0][5];
    this.bankedRegisters[0][6] = frost.bankedRegisters[0][6];
    this.bankedRegisters[1][0] = frost.bankedRegisters[1][0];
    this.bankedRegisters[1][1] = frost.bankedRegisters[1][1];
    this.bankedRegisters[1][2] = frost.bankedRegisters[1][2];
    this.bankedRegisters[1][3] = frost.bankedRegisters[1][3];
    this.bankedRegisters[1][4] = frost.bankedRegisters[1][4];
    this.bankedRegisters[1][5] = frost.bankedRegisters[1][5];
    this.bankedRegisters[1][6] = frost.bankedRegisters[1][6];
    this.bankedRegisters[2][0] = frost.bankedRegisters[2][0];
    this.bankedRegisters[2][1] = frost.bankedRegisters[2][1];
    this.bankedRegisters[3][0] = frost.bankedRegisters[3][0];
    this.bankedRegisters[3][1] = frost.bankedRegisters[3][1];
    this.bankedRegisters[4][0] = frost.bankedRegisters[4][0];
    this.bankedRegisters[4][1] = frost.bankedRegisters[4][1];
    this.bankedRegisters[5][0] = frost.bankedRegisters[5][0];
    this.bankedRegisters[5][1] = frost.bankedRegisters[5][1];
    this.spsr = frost.spsr;
    this.bankedSPSRs[0] = frost.bankedSPSRs[0];
    this.bankedSPSRs[1] = frost.bankedSPSRs[1];
    this.bankedSPSRs[2] = frost.bankedSPSRs[2];
    this.bankedSPSRs[3] = frost.bankedSPSRs[3];
    this.bankedSPSRs[4] = frost.bankedSPSRs[4];
    this.bankedSPSRs[5] = frost.bankedSPSRs[5];
    this.cycles = frost.cycles;
  };
  ARMCore.prototype.fetchPage = function(address) {
    var region = address >> this.mmu.BASE_OFFSET;
    var pageId = this.mmu.addressToPage(region, address & this.mmu.OFFSET_MASK);
    if (region == this.pageRegion) {
      if (pageId == this.pageId && !this.page.invalid) {
        return;
      }
      this.pageId = pageId;
    } else {
      this.pageMask = this.mmu.memory[region].PAGE_MASK;
      this.pageRegion = region;
      this.pageId = pageId;
    }
    this.page = this.mmu.accessPage(region, pageId);
  };
  ARMCore.prototype.loadInstructionArm = function(address) {
    var next = null;
    this.fetchPage(address);
    var offset = (address & this.pageMask) >> 2;
    next = this.page.arm[offset];
    if (next) {
      return next;
    }
    var instruction = this.mmu.load32(address) >>> 0;
    next = this.compileArm(instruction);
    next.next = null;
    next.page = this.page;
    next.address = address;
    next.opcode = instruction;
    this.page.arm[offset] = next;
    return next;
  };
  ARMCore.prototype.loadInstructionThumb = function(address) {
    var next = null;
    this.fetchPage(address);
    var offset = (address & this.pageMask) >> 1;
    next = this.page.thumb[offset];
    if (next) {
      return next;
    }
    var instruction = this.mmu.load16(address);
    next = this.compileThumb(instruction);
    next.next = null;
    next.page = this.page;
    next.address = address;
    next.opcode = instruction;
    this.page.thumb[offset] = next;
    return next;
  };
  ARMCore.prototype.selectBank = function(mode) {
    switch (mode) {
      case this.MODE_USER:
      case this.MODE_SYSTEM:
        return this.BANK_NONE;
      case this.MODE_FIQ:
        return this.BANK_FIQ;
      case this.MODE_IRQ:
        return this.BANK_IRQ;
      case this.MODE_SUPERVISOR:
        return this.BANK_SUPERVISOR;
      case this.MODE_ABORT:
        return this.BANK_ABORT;
      case this.MODE_UNDEFINED:
        return this.BANK_UNDEFINED;
      default:
        throw "Invalid user mode passed to selectBank";
    }
  };
  ARMCore.prototype.switchExecMode = function(newMode) {
    if (this.execMode != newMode) {
      this.execMode = newMode;
      if (newMode == this.MODE_ARM) {
        this.instructionWidth = this.WORD_SIZE_ARM;
        this.loadInstruction = this.loadInstructionArm;
      } else {
        this.instructionWidth = this.WORD_SIZE_THUMB;
        this.loadInstruction = this.loadInstructionThumb;
      }
    }
  };
  ARMCore.prototype.switchMode = function(newMode) {
    if (newMode == this.mode) {
      return;
    }
    if (newMode != this.MODE_USER || newMode != this.MODE_SYSTEM) {
      var newBank = this.selectBank(newMode);
      var oldBank = this.selectBank(this.mode);
      if (newBank != oldBank) {
        if (newMode == this.MODE_FIQ || this.mode == this.MODE_FIQ) {
          var oldFiqBank = (oldBank == this.BANK_FIQ) + 0;
          var newFiqBank = (newBank == this.BANK_FIQ) + 0;
          this.bankedRegisters[oldFiqBank][2] = this.gprs[8];
          this.bankedRegisters[oldFiqBank][3] = this.gprs[9];
          this.bankedRegisters[oldFiqBank][4] = this.gprs[10];
          this.bankedRegisters[oldFiqBank][5] = this.gprs[11];
          this.bankedRegisters[oldFiqBank][6] = this.gprs[12];
          this.gprs[8] = this.bankedRegisters[newFiqBank][2];
          this.gprs[9] = this.bankedRegisters[newFiqBank][3];
          this.gprs[10] = this.bankedRegisters[newFiqBank][4];
          this.gprs[11] = this.bankedRegisters[newFiqBank][5];
          this.gprs[12] = this.bankedRegisters[newFiqBank][6];
        }
        this.bankedRegisters[oldBank][0] = this.gprs[this.SP];
        this.bankedRegisters[oldBank][1] = this.gprs[this.LR];
        this.gprs[this.SP] = this.bankedRegisters[newBank][0];
        this.gprs[this.LR] = this.bankedRegisters[newBank][1];
        this.bankedSPSRs[oldBank] = this.spsr;
        this.spsr = this.bankedSPSRs[newBank];
      }
    }
    this.mode = newMode;
  };
  ARMCore.prototype.packCPSR = function() {
    return this.mode | !!this.execMode << 5 | !!this.cpsrF << 6 | !!this.cpsrI << 7 | !!this.cpsrN << 31 | !!this.cpsrZ << 30 | !!this.cpsrC << 29 | !!this.cpsrV << 28;
  };
  ARMCore.prototype.unpackCPSR = function(spsr) {
    this.switchMode(spsr & 31);
    this.switchExecMode(!!(spsr & 32));
    this.cpsrF = spsr & 64;
    this.cpsrI = spsr & 128;
    this.cpsrN = spsr & 2147483648;
    this.cpsrZ = spsr & 1073741824;
    this.cpsrC = spsr & 536870912;
    this.cpsrV = spsr & 268435456;
    this.irq.testIRQ();
  };
  ARMCore.prototype.hasSPSR = function() {
    return this.mode != this.MODE_SYSTEM && this.mode != this.MODE_USER;
  };
  ARMCore.prototype.raiseIRQ = function() {
    if (this.cpsrI) {
      return;
    }
    var cpsr = this.packCPSR();
    var instructionWidth = this.instructionWidth;
    this.switchMode(this.MODE_IRQ);
    this.spsr = cpsr;
    this.gprs[this.LR] = this.gprs[this.PC] - instructionWidth + 4;
    this.gprs[this.PC] = this.BASE_IRQ + this.WORD_SIZE_ARM;
    this.instruction = null;
    this.switchExecMode(this.MODE_ARM);
    this.cpsrI = true;
  };
  ARMCore.prototype.raiseTrap = function() {
    var cpsr = this.packCPSR();
    var instructionWidth = this.instructionWidth;
    this.switchMode(this.MODE_SUPERVISOR);
    this.spsr = cpsr;
    this.gprs[this.LR] = this.gprs[this.PC] - instructionWidth;
    this.gprs[this.PC] = this.BASE_SWI + this.WORD_SIZE_ARM;
    this.instruction = null;
    this.switchExecMode(this.MODE_ARM);
    this.cpsrI = true;
  };
  ARMCore.prototype.badOp = function(instruction) {
    var func = function() {
      throw "Illegal instruction: 0x" + instruction.toString(16);
    };
    func.writesPC = true;
    func.fixedJump = false;
    return func;
  };
  ARMCore.prototype.generateConds = function() {
    var cpu = this;
    this.conds = [
      function() {
        return cpu.conditionPassed = cpu.cpsrZ;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrZ;
      },
      function() {
        return cpu.conditionPassed = cpu.cpsrC;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrC;
      },
      function() {
        return cpu.conditionPassed = cpu.cpsrN;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrN;
      },
      function() {
        return cpu.conditionPassed = cpu.cpsrV;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrV;
      },
      function() {
        return cpu.conditionPassed = cpu.cpsrC && !cpu.cpsrZ;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrC || cpu.cpsrZ;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrN == !cpu.cpsrV;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrN != !cpu.cpsrV;
      },
      function() {
        return cpu.conditionPassed = !cpu.cpsrZ && !cpu.cpsrN == !cpu.cpsrV;
      },
      function() {
        return cpu.conditionPassed = cpu.cpsrZ || !cpu.cpsrN != !cpu.cpsrV;
      },
      null,
      null
    ];
  };
  ARMCore.prototype.barrelShiftImmediate = function(shiftType, immediate, rm) {
    var cpu = this;
    var gprs = this.gprs;
    var shiftOp = this.badOp;
    switch (shiftType) {
      case 0:
        if (immediate) {
          shiftOp = function() {
            cpu.shifterOperand = gprs[rm] << immediate;
            cpu.shifterCarryOut = gprs[rm] & 1 << 32 - immediate;
          };
        } else {
          shiftOp = function() {
            cpu.shifterOperand = gprs[rm];
            cpu.shifterCarryOut = cpu.cpsrC;
          };
        }
        break;
      case 32:
        if (immediate) {
          shiftOp = function() {
            cpu.shifterOperand = gprs[rm] >>> immediate;
            cpu.shifterCarryOut = gprs[rm] & 1 << immediate - 1;
          };
        } else {
          shiftOp = function() {
            cpu.shifterOperand = 0;
            cpu.shifterCarryOut = gprs[rm] & 2147483648;
          };
        }
        break;
      case 64:
        if (immediate) {
          shiftOp = function() {
            cpu.shifterOperand = gprs[rm] >> immediate;
            cpu.shifterCarryOut = gprs[rm] & 1 << immediate - 1;
          };
        } else {
          shiftOp = function() {
            cpu.shifterCarryOut = gprs[rm] & 2147483648;
            if (cpu.shifterCarryOut) {
              cpu.shifterOperand = 4294967295;
            } else {
              cpu.shifterOperand = 0;
            }
          };
        }
        break;
      case 96:
        if (immediate) {
          shiftOp = function() {
            cpu.shifterOperand = gprs[rm] >>> immediate | gprs[rm] << 32 - immediate;
            cpu.shifterCarryOut = gprs[rm] & 1 << immediate - 1;
          };
        } else {
          shiftOp = function() {
            cpu.shifterOperand = !!cpu.cpsrC << 31 | gprs[rm] >>> 1;
            cpu.shifterCarryOut = gprs[rm] & 1;
          };
        }
        break;
    }
    return shiftOp;
  };
  ARMCore.prototype.compileArm = function(instruction) {
    var op = this.badOp(instruction);
    var i2 = instruction & 234881024;
    var cpu = this;
    var gprs = this.gprs;
    var condOp = this.conds[(instruction & 4026531840) >>> 28];
    if ((instruction & 268435440) == 19922704) {
      var rm = instruction & 15;
      op = this.armCompiler.constructBX(rm, condOp);
      op.writesPC = true;
      op.fixedJump = false;
    } else if (!(instruction & 201326592) && (i2 == 33554432 || (instruction & 144) != 144)) {
      var opcode = instruction & 31457280;
      var s = instruction & 1048576;
      var shiftsRs = false;
      if ((opcode & 25165824) == 16777216 && !s) {
        var r = instruction & 4194304;
        if ((instruction & 11595776) == 2158592) {
          var rm = instruction & 15;
          var immediate = instruction & 255;
          var rotateImm = (instruction & 3840) >> 7;
          immediate = immediate >>> rotateImm | immediate << 32 - rotateImm;
          op = this.armCompiler.constructMSR(rm, r, instruction, immediate, condOp);
          op.writesPC = false;
        } else if ((instruction & 12517376) == 983040) {
          var rd = (instruction & 61440) >> 12;
          op = this.armCompiler.constructMRS(rd, r, condOp);
          op.writesPC = rd == this.PC;
        }
      } else {
        var rn = (instruction & 983040) >> 16;
        var rd = (instruction & 61440) >> 12;
        var shiftType = instruction & 96;
        var rm = instruction & 15;
        var shiftOp = function() {
          throw "BUG: invalid barrel shifter";
        };
        if (instruction & 33554432) {
          var immediate = instruction & 255;
          var rotate = (instruction & 3840) >> 7;
          if (!rotate) {
            shiftOp = this.armCompiler.constructAddressingMode1Immediate(immediate);
          } else {
            shiftOp = this.armCompiler.constructAddressingMode1ImmediateRotate(immediate, rotate);
          }
        } else if (instruction & 16) {
          var rs = (instruction & 3840) >> 8;
          shiftsRs = true;
          switch (shiftType) {
            case 0:
              shiftOp = this.armCompiler.constructAddressingMode1LSL(rs, rm);
              break;
            case 32:
              shiftOp = this.armCompiler.constructAddressingMode1LSR(rs, rm);
              break;
            case 64:
              shiftOp = this.armCompiler.constructAddressingMode1ASR(rs, rm);
              break;
            case 96:
              shiftOp = this.armCompiler.constructAddressingMode1ROR(rs, rm);
              break;
          }
        } else {
          var immediate = (instruction & 3968) >> 7;
          shiftOp = this.barrelShiftImmediate(shiftType, immediate, rm);
        }
        switch (opcode) {
          case 0:
            if (s) {
              op = this.armCompiler.constructANDS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructAND(rd, rn, shiftOp, condOp);
            }
            break;
          case 2097152:
            if (s) {
              op = this.armCompiler.constructEORS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructEOR(rd, rn, shiftOp, condOp);
            }
            break;
          case 4194304:
            if (s) {
              op = this.armCompiler.constructSUBS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructSUB(rd, rn, shiftOp, condOp);
            }
            break;
          case 6291456:
            if (s) {
              op = this.armCompiler.constructRSBS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructRSB(rd, rn, shiftOp, condOp);
            }
            break;
          case 8388608:
            if (s) {
              op = this.armCompiler.constructADDS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructADD(rd, rn, shiftOp, condOp);
            }
            break;
          case 10485760:
            if (s) {
              op = this.armCompiler.constructADCS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructADC(rd, rn, shiftOp, condOp);
            }
            break;
          case 12582912:
            if (s) {
              op = this.armCompiler.constructSBCS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructSBC(rd, rn, shiftOp, condOp);
            }
            break;
          case 14680064:
            if (s) {
              op = this.armCompiler.constructRSCS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructRSC(rd, rn, shiftOp, condOp);
            }
            break;
          case 16777216:
            op = this.armCompiler.constructTST(rd, rn, shiftOp, condOp);
            break;
          case 18874368:
            op = this.armCompiler.constructTEQ(rd, rn, shiftOp, condOp);
            break;
          case 20971520:
            op = this.armCompiler.constructCMP(rd, rn, shiftOp, condOp);
            break;
          case 23068672:
            op = this.armCompiler.constructCMN(rd, rn, shiftOp, condOp);
            break;
          case 25165824:
            if (s) {
              op = this.armCompiler.constructORRS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructORR(rd, rn, shiftOp, condOp);
            }
            break;
          case 27262976:
            if (s) {
              op = this.armCompiler.constructMOVS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructMOV(rd, rn, shiftOp, condOp);
            }
            break;
          case 29360128:
            if (s) {
              op = this.armCompiler.constructBICS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructBIC(rd, rn, shiftOp, condOp);
            }
            break;
          case 31457280:
            if (s) {
              op = this.armCompiler.constructMVNS(rd, rn, shiftOp, condOp);
            } else {
              op = this.armCompiler.constructMVN(rd, rn, shiftOp, condOp);
            }
            break;
        }
        op.writesPC = rd == this.PC;
      }
    } else if ((instruction & 263196656) == 16777360) {
      var rm = instruction & 15;
      var rd = instruction >> 12 & 15;
      var rn = instruction >> 16 & 15;
      if (instruction & 4194304) {
        op = this.armCompiler.constructSWPB(rd, rn, rm, condOp);
      } else {
        op = this.armCompiler.constructSWP(rd, rn, rm, condOp);
      }
      op.writesPC = rd == this.PC;
    } else {
      switch (i2) {
        case 0:
          if ((instruction & 16777456) == 144) {
            var rd = (instruction & 983040) >> 16;
            var rn = (instruction & 61440) >> 12;
            var rs = (instruction & 3840) >> 8;
            var rm = instruction & 15;
            switch (instruction & 15728640) {
              case 0:
                op = this.armCompiler.constructMUL(rd, rs, rm, condOp);
                break;
              case 1048576:
                op = this.armCompiler.constructMULS(rd, rs, rm, condOp);
                break;
              case 2097152:
                op = this.armCompiler.constructMLA(rd, rn, rs, rm, condOp);
                break;
              case 3145728:
                op = this.armCompiler.constructMLAS(rd, rn, rs, rm, condOp);
                break;
              case 8388608:
                op = this.armCompiler.constructUMULL(rd, rn, rs, rm, condOp);
                break;
              case 9437184:
                op = this.armCompiler.constructUMULLS(rd, rn, rs, rm, condOp);
                break;
              case 10485760:
                op = this.armCompiler.constructUMLAL(rd, rn, rs, rm, condOp);
                break;
              case 11534336:
                op = this.armCompiler.constructUMLALS(rd, rn, rs, rm, condOp);
                break;
              case 12582912:
                op = this.armCompiler.constructSMULL(rd, rn, rs, rm, condOp);
                break;
              case 13631488:
                op = this.armCompiler.constructSMULLS(rd, rn, rs, rm, condOp);
                break;
              case 14680064:
                op = this.armCompiler.constructSMLAL(rd, rn, rs, rm, condOp);
                break;
              case 15728640:
                op = this.armCompiler.constructSMLALS(rd, rn, rs, rm, condOp);
                break;
            }
            op.writesPC = rd == this.PC;
          } else {
            var load = instruction & 1048576;
            var rd = (instruction & 61440) >> 12;
            var hiOffset = (instruction & 3840) >> 4;
            var loOffset = rm = instruction & 15;
            var h = instruction & 32;
            var s = instruction & 64;
            var w = instruction & 2097152;
            var i2 = instruction & 4194304;
            var address;
            if (i2) {
              var immediate = loOffset | hiOffset;
              address = this.armCompiler.constructAddressingMode23Immediate(instruction, immediate, condOp);
            } else {
              address = this.armCompiler.constructAddressingMode23Register(instruction, rm, condOp);
            }
            address.writesPC = !!w && rn == this.PC;
            if ((instruction & 144) == 144) {
              if (load) {
                if (h) {
                  if (s) {
                    op = this.armCompiler.constructLDRSH(rd, address, condOp);
                  } else {
                    op = this.armCompiler.constructLDRH(rd, address, condOp);
                  }
                } else {
                  if (s) {
                    op = this.armCompiler.constructLDRSB(rd, address, condOp);
                  }
                }
              } else if (!s && h) {
                op = this.armCompiler.constructSTRH(rd, address, condOp);
              }
            }
            op.writesPC = rd == this.PC || address.writesPC;
          }
          break;
        case 67108864:
        case 100663296:
          var rd = (instruction & 61440) >> 12;
          var load = instruction & 1048576;
          var b = instruction & 4194304;
          var i2 = instruction & 33554432;
          var address = function() {
            throw "Unimplemented memory access: 0x" + instruction.toString(16);
          };
          if (~instruction & 16777216) {
            instruction &= 4292870143;
          }
          if (i2) {
            var rm = instruction & 15;
            var shiftType = instruction & 96;
            var shiftImmediate = (instruction & 3968) >> 7;
            if (shiftType || shiftImmediate) {
              var shiftOp = this.barrelShiftImmediate(shiftType, shiftImmediate, rm);
              address = this.armCompiler.constructAddressingMode2RegisterShifted(instruction, shiftOp, condOp);
            } else {
              address = this.armCompiler.constructAddressingMode23Register(instruction, rm, condOp);
            }
          } else {
            var offset = instruction & 4095;
            address = this.armCompiler.constructAddressingMode23Immediate(instruction, offset, condOp);
          }
          if (load) {
            if (b) {
              op = this.armCompiler.constructLDRB(rd, address, condOp);
            } else {
              op = this.armCompiler.constructLDR(rd, address, condOp);
            }
          } else {
            if (b) {
              op = this.armCompiler.constructSTRB(rd, address, condOp);
            } else {
              op = this.armCompiler.constructSTR(rd, address, condOp);
            }
          }
          op.writesPC = rd == this.PC || address.writesPC;
          break;
        case 134217728:
          var load = instruction & 1048576;
          var w = instruction & 2097152;
          var user = instruction & 4194304;
          var u = instruction & 8388608;
          var p = instruction & 16777216;
          var rs = instruction & 65535;
          var rn = (instruction & 983040) >> 16;
          var address;
          var immediate = 0;
          var offset = 0;
          var overlap = false;
          if (u) {
            if (p) {
              immediate = 4;
            }
            for (var m = 1, i2 = 0;i2 < 16; m <<= 1, ++i2) {
              if (rs & m) {
                if (w && i2 == rn && !offset) {
                  rs &= ~m;
                  immediate += 4;
                  overlap = true;
                }
                offset += 4;
              }
            }
          } else {
            if (!p) {
              immediate = 4;
            }
            for (var m = 1, i2 = 0;i2 < 16; m <<= 1, ++i2) {
              if (rs & m) {
                if (w && i2 == rn && !offset) {
                  rs &= ~m;
                  immediate += 4;
                  overlap = true;
                }
                immediate -= 4;
                offset -= 4;
              }
            }
          }
          if (w) {
            address = this.armCompiler.constructAddressingMode4Writeback(immediate, offset, rn, overlap);
          } else {
            address = this.armCompiler.constructAddressingMode4(immediate, rn);
          }
          if (load) {
            if (user) {
              op = this.armCompiler.constructLDMS(rs, address, condOp);
            } else {
              op = this.armCompiler.constructLDM(rs, address, condOp);
            }
            op.writesPC = !!(rs & 1 << 15);
          } else {
            if (user) {
              op = this.armCompiler.constructSTMS(rs, address, condOp);
            } else {
              op = this.armCompiler.constructSTM(rs, address, condOp);
            }
            op.writesPC = false;
          }
          break;
        case 167772160:
          var immediate = instruction & 16777215;
          if (immediate & 8388608) {
            immediate |= 4278190080;
          }
          immediate <<= 2;
          var link = instruction & 16777216;
          if (link) {
            op = this.armCompiler.constructBL(immediate, condOp);
          } else {
            op = this.armCompiler.constructB(immediate, condOp);
          }
          op.writesPC = true;
          op.fixedJump = true;
          break;
        case 201326592:
          break;
        case 234881024:
          if ((instruction & 251658240) == 251658240) {
            var immediate = instruction & 16777215;
            op = this.armCompiler.constructSWI(immediate, condOp);
            op.writesPC = false;
          }
          break;
        default:
          throw "Bad opcode: 0x" + instruction.toString(16);
      }
    }
    op.execMode = this.MODE_ARM;
    op.fixedJump = op.fixedJump || false;
    return op;
  };
  ARMCore.prototype.compileThumb = function(instruction) {
    var op = this.badOp(instruction & 65535);
    var cpu = this;
    var gprs = this.gprs;
    if ((instruction & 64512) == 16384) {
      var rm = (instruction & 56) >> 3;
      var rd = instruction & 7;
      switch (instruction & 960) {
        case 0:
          op = this.thumbCompiler.constructAND(rd, rm);
          break;
        case 64:
          op = this.thumbCompiler.constructEOR(rd, rm);
          break;
        case 128:
          op = this.thumbCompiler.constructLSL2(rd, rm);
          break;
        case 192:
          op = this.thumbCompiler.constructLSR2(rd, rm);
          break;
        case 256:
          op = this.thumbCompiler.constructASR2(rd, rm);
          break;
        case 320:
          op = this.thumbCompiler.constructADC(rd, rm);
          break;
        case 384:
          op = this.thumbCompiler.constructSBC(rd, rm);
          break;
        case 448:
          op = this.thumbCompiler.constructROR(rd, rm);
          break;
        case 512:
          op = this.thumbCompiler.constructTST(rd, rm);
          break;
        case 576:
          op = this.thumbCompiler.constructNEG(rd, rm);
          break;
        case 640:
          op = this.thumbCompiler.constructCMP2(rd, rm);
          break;
        case 704:
          op = this.thumbCompiler.constructCMN(rd, rm);
          break;
        case 768:
          op = this.thumbCompiler.constructORR(rd, rm);
          break;
        case 832:
          op = this.thumbCompiler.constructMUL(rd, rm);
          break;
        case 896:
          op = this.thumbCompiler.constructBIC(rd, rm);
          break;
        case 960:
          op = this.thumbCompiler.constructMVN(rd, rm);
          break;
      }
      op.writesPC = false;
    } else if ((instruction & 64512) == 17408) {
      var rm = (instruction & 120) >> 3;
      var rn = instruction & 7;
      var h1 = instruction & 128;
      var rd = rn | h1 >> 4;
      switch (instruction & 768) {
        case 0:
          op = this.thumbCompiler.constructADD4(rd, rm);
          op.writesPC = rd == this.PC;
          break;
        case 256:
          op = this.thumbCompiler.constructCMP3(rd, rm);
          op.writesPC = false;
          break;
        case 512:
          op = this.thumbCompiler.constructMOV3(rd, rm);
          op.writesPC = rd == this.PC;
          break;
        case 768:
          op = this.thumbCompiler.constructBX(rd, rm);
          op.writesPC = true;
          op.fixedJump = false;
          break;
      }
    } else if ((instruction & 63488) == 6144) {
      var rm = (instruction & 448) >> 6;
      var rn = (instruction & 56) >> 3;
      var rd = instruction & 7;
      switch (instruction & 1536) {
        case 0:
          op = this.thumbCompiler.constructADD3(rd, rn, rm);
          break;
        case 512:
          op = this.thumbCompiler.constructSUB3(rd, rn, rm);
          break;
        case 1024:
          var immediate = (instruction & 448) >> 6;
          if (immediate) {
            op = this.thumbCompiler.constructADD1(rd, rn, immediate);
          } else {
            op = this.thumbCompiler.constructMOV2(rd, rn, rm);
          }
          break;
        case 1536:
          var immediate = (instruction & 448) >> 6;
          op = this.thumbCompiler.constructSUB1(rd, rn, immediate);
          break;
      }
      op.writesPC = false;
    } else if (!(instruction & 57344)) {
      var rd = instruction & 7;
      var rm = (instruction & 56) >> 3;
      var immediate = (instruction & 1984) >> 6;
      switch (instruction & 6144) {
        case 0:
          op = this.thumbCompiler.constructLSL1(rd, rm, immediate);
          break;
        case 2048:
          op = this.thumbCompiler.constructLSR1(rd, rm, immediate);
          break;
        case 4096:
          op = this.thumbCompiler.constructASR1(rd, rm, immediate);
          break;
        case 6144:
          break;
      }
      op.writesPC = false;
    } else if ((instruction & 57344) == 8192) {
      var immediate = instruction & 255;
      var rn = (instruction & 1792) >> 8;
      switch (instruction & 6144) {
        case 0:
          op = this.thumbCompiler.constructMOV1(rn, immediate);
          break;
        case 2048:
          op = this.thumbCompiler.constructCMP1(rn, immediate);
          break;
        case 4096:
          op = this.thumbCompiler.constructADD2(rn, immediate);
          break;
        case 6144:
          op = this.thumbCompiler.constructSUB2(rn, immediate);
          break;
      }
      op.writesPC = false;
    } else if ((instruction & 63488) == 18432) {
      var rd = (instruction & 1792) >> 8;
      var immediate = (instruction & 255) << 2;
      op = this.thumbCompiler.constructLDR3(rd, immediate);
      op.writesPC = false;
    } else if ((instruction & 61440) == 20480) {
      var rd = instruction & 7;
      var rn = (instruction & 56) >> 3;
      var rm = (instruction & 448) >> 6;
      var opcode = instruction & 3584;
      switch (opcode) {
        case 0:
          op = this.thumbCompiler.constructSTR2(rd, rn, rm);
          break;
        case 512:
          op = this.thumbCompiler.constructSTRH2(rd, rn, rm);
          break;
        case 1024:
          op = this.thumbCompiler.constructSTRB2(rd, rn, rm);
          break;
        case 1536:
          op = this.thumbCompiler.constructLDRSB(rd, rn, rm);
          break;
        case 2048:
          op = this.thumbCompiler.constructLDR2(rd, rn, rm);
          break;
        case 2560:
          op = this.thumbCompiler.constructLDRH2(rd, rn, rm);
          break;
        case 3072:
          op = this.thumbCompiler.constructLDRB2(rd, rn, rm);
          break;
        case 3584:
          op = this.thumbCompiler.constructLDRSH(rd, rn, rm);
          break;
      }
      op.writesPC = false;
    } else if ((instruction & 57344) == 24576) {
      var rd = instruction & 7;
      var rn = (instruction & 56) >> 3;
      var immediate = (instruction & 1984) >> 4;
      var b = instruction & 4096;
      if (b) {
        immediate >>= 2;
      }
      var load = instruction & 2048;
      if (load) {
        if (b) {
          op = this.thumbCompiler.constructLDRB1(rd, rn, immediate);
        } else {
          op = this.thumbCompiler.constructLDR1(rd, rn, immediate);
        }
      } else {
        if (b) {
          op = this.thumbCompiler.constructSTRB1(rd, rn, immediate);
        } else {
          op = this.thumbCompiler.constructSTR1(rd, rn, immediate);
        }
      }
      op.writesPC = false;
    } else if ((instruction & 62976) == 46080) {
      var r = !!(instruction & 256);
      var rs = instruction & 255;
      if (instruction & 2048) {
        op = this.thumbCompiler.constructPOP(rs, r);
        op.writesPC = r;
        op.fixedJump = false;
      } else {
        op = this.thumbCompiler.constructPUSH(rs, r);
        op.writesPC = false;
      }
    } else if (instruction & 32768) {
      switch (instruction & 28672) {
        case 0:
          var rd = instruction & 7;
          var rn = (instruction & 56) >> 3;
          var immediate = (instruction & 1984) >> 5;
          if (instruction & 2048) {
            op = this.thumbCompiler.constructLDRH1(rd, rn, immediate);
          } else {
            op = this.thumbCompiler.constructSTRH1(rd, rn, immediate);
          }
          op.writesPC = false;
          break;
        case 4096:
          var rd = (instruction & 1792) >> 8;
          var immediate = (instruction & 255) << 2;
          var load = instruction & 2048;
          if (load) {
            op = this.thumbCompiler.constructLDR4(rd, immediate);
          } else {
            op = this.thumbCompiler.constructSTR3(rd, immediate);
          }
          op.writesPC = false;
          break;
        case 8192:
          var rd = (instruction & 1792) >> 8;
          var immediate = (instruction & 255) << 2;
          if (instruction & 2048) {
            op = this.thumbCompiler.constructADD6(rd, immediate);
          } else {
            op = this.thumbCompiler.constructADD5(rd, immediate);
          }
          op.writesPC = false;
          break;
        case 12288:
          if (!(instruction & 3840)) {
            var b = instruction & 128;
            var immediate = (instruction & 127) << 2;
            if (b) {
              immediate = -immediate;
            }
            op = this.thumbCompiler.constructADD7(immediate);
            op.writesPC = false;
          }
          break;
        case 16384:
          var rn = (instruction & 1792) >> 8;
          var rs = instruction & 255;
          if (instruction & 2048) {
            op = this.thumbCompiler.constructLDMIA(rn, rs);
          } else {
            op = this.thumbCompiler.constructSTMIA(rn, rs);
          }
          op.writesPC = false;
          break;
        case 20480:
          var cond = (instruction & 3840) >> 8;
          var immediate = instruction & 255;
          if (cond == 15) {
            op = this.thumbCompiler.constructSWI(immediate);
            op.writesPC = false;
          } else {
            if (instruction & 128) {
              immediate |= 4294967040;
            }
            immediate <<= 1;
            var condOp = this.conds[cond];
            op = this.thumbCompiler.constructB1(immediate, condOp);
            op.writesPC = true;
            op.fixedJump = true;
          }
          break;
        case 24576:
        case 28672:
          var immediate = instruction & 2047;
          var h = instruction & 6144;
          switch (h) {
            case 0:
              if (immediate & 1024) {
                immediate |= 4294965248;
              }
              immediate <<= 1;
              op = this.thumbCompiler.constructB2(immediate);
              op.writesPC = true;
              op.fixedJump = true;
              break;
            case 2048:
              break;
            case 4096:
              if (immediate & 1024) {
                immediate |= 4294966272;
              }
              immediate <<= 12;
              op = this.thumbCompiler.constructBL1(immediate);
              op.writesPC = false;
              break;
            case 6144:
              op = this.thumbCompiler.constructBL2(immediate);
              op.writesPC = true;
              op.fixedJump = false;
              break;
          }
          break;
        default:
          this.WARN("Undefined instruction: 0x" + instruction.toString(16));
      }
    } else {
      throw "Bad opcode: 0x" + instruction.toString(16);
    }
    op.execMode = this.MODE_THUMB;
    op.fixedJump = op.fixedJump || false;
    return op;
  };
  module.exports = ARMCore;
});

// node_modules/buffer-dataview/dataview.js
var require_dataview = __commonJS((exports, module) => {
  var DataView2 = function(buffer, byteOffset, byteLength) {
    if (!(this instanceof DataView2))
      throw new TypeError("Constructor DataView requires \'new\'");
    if (!buffer || buffer.length == null)
      throw new TypeError("First argument to DataView constructor must be a Buffer");
    if (byteOffset == null)
      byteOffset = 0;
    if (byteLength == null)
      byteLength = buffer.length;
    this.buffer = buffer;
    this.byteOffset = byteOffset | 0;
    this.byteLength = byteLength | 0;
  };
  module.exports = DataView2;
  DataView2.prototype.getInt8 = function(byteOffset) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    return this.buffer.readInt8(offset);
  };
  DataView2.prototype.getUint8 = function(byteOffset) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    return this.buffer.readUInt8(offset);
  };
  DataView2.prototype.getInt16 = function(byteOffset, littleEndian) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      return this.buffer.readInt16LE(offset);
    } else {
      return this.buffer.readInt16BE(offset);
    }
  };
  DataView2.prototype.getUint16 = function(byteOffset, littleEndian) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      return this.buffer.readUInt16LE(offset);
    } else {
      return this.buffer.readUInt16BE(offset);
    }
  };
  DataView2.prototype.getInt32 = function(byteOffset, littleEndian) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      return this.buffer.readInt32LE(offset);
    } else {
      return this.buffer.readInt32BE(offset);
    }
  };
  DataView2.prototype.getUint32 = function(byteOffset, littleEndian) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      return this.buffer.readUInt32LE(offset);
    } else {
      return this.buffer.readUInt32BE(offset);
    }
  };
  DataView2.prototype.getFloat32 = function(byteOffset, littleEndian) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      return this.buffer.readFloatLE(offset);
    } else {
      return this.buffer.readFloatBE(offset);
    }
  };
  DataView2.prototype.getFloat64 = function(byteOffset, littleEndian) {
    if (arguments.length < 1)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      return this.buffer.readDoubleLE(offset);
    } else {
      return this.buffer.readDoubleBE(offset);
    }
  };
  DataView2.prototype.setInt8 = function(byteOffset, value) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    value = (value + 128 & 255) - 128;
    this.buffer.writeInt8(value, offset);
  };
  DataView2.prototype.setUint8 = function(byteOffset, value) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    value = value & 255;
    this.buffer.writeUInt8(value, offset);
  };
  DataView2.prototype.setInt16 = function(byteOffset, value, littleEndian) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    value = (value + 32768 & 65535) - 32768;
    if (littleEndian) {
      this.buffer.writeInt16LE(value, offset);
    } else {
      this.buffer.writeInt16BE(value, offset);
    }
  };
  DataView2.prototype.setUint16 = function(byteOffset, value, littleEndian) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    value = value & 65535;
    if (littleEndian) {
      this.buffer.writeUInt16LE(value, offset);
    } else {
      this.buffer.writeUInt16BE(value, offset);
    }
  };
  DataView2.prototype.setInt32 = function(byteOffset, value, littleEndian) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    value |= 0;
    if (littleEndian) {
      this.buffer.writeInt32LE(value, offset);
    } else {
      this.buffer.writeInt32BE(value, offset);
    }
  };
  DataView2.prototype.setUint32 = function(byteOffset, value, littleEndian) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    value = value >>> 0;
    if (littleEndian) {
      this.buffer.writeUInt32LE(value, offset);
    } else {
      this.buffer.writeUInt32BE(value, offset);
    }
  };
  DataView2.prototype.setFloat32 = function(byteOffset, value, littleEndian) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      this.buffer.writeFloatLE(value, offset);
    } else {
      this.buffer.writeFloatBE(value, offset);
    }
  };
  DataView2.prototype.setFloat64 = function(byteOffset, value, littleEndian) {
    if (arguments.length < 2)
      throw new TypeError("invalid_argument");
    var offset = this.byteOffset + (byteOffset | 0);
    var max = this.byteOffset + this.byteLength - 1;
    if (offset < this.byteOffset || offset > max) {
      throw new RangeError("Offset is outside the bounds of the DataView");
    }
    if (littleEndian) {
      this.buffer.writeDoubleLE(value, offset);
    } else {
      this.buffer.writeDoubleBE(value, offset);
    }
  };
});

// js/memory-view.js
var require_memory_view = __commonJS((exports, module) => {
  var MemoryView = function(memory, offset) {
    inherit.call(this);
    this.buffer = memory;
    this.view = MemoryView.DataView(this.buffer, typeof offset === "number" ? offset : 0);
    this.mask = memory.byteLength - 1;
    this.resetMask();
  };
  var BufferDataView = require_dataview();
  var inherit = require_util().inherit;
  MemoryView.DataView = function(buffer, byteOffset, byteLength) {
    if (Buffer.isBuffer(buffer)) {
      return new BufferDataView(buffer, byteOffset, byteLength);
    } else {
      return new DataView(buffer, byteOffset, byteLength);
    }
  };
  MemoryView.prototype.resetMask = function() {
    this.mask8 = this.mask & 4294967295;
    this.mask16 = this.mask & 4294967294;
    this.mask32 = this.mask & 4294967292;
  };
  MemoryView.prototype.load8 = function(offset) {
    return this.view.getInt8(offset & this.mask8);
  };
  MemoryView.prototype.load16 = function(offset) {
    return this.view.getInt16(offset & this.mask, true);
  };
  MemoryView.prototype.loadU8 = function(offset) {
    return this.view.getUint8(offset & this.mask8);
  };
  MemoryView.prototype.loadU16 = function(offset) {
    return this.view.getUint16(offset & this.mask, true);
  };
  MemoryView.prototype.load32 = function(offset) {
    var rotate = (offset & 3) << 3;
    var mem = this.view.getInt32(offset & this.mask32, true);
    return mem >>> rotate | mem << 32 - rotate;
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
  MemoryView.prototype.invalidatePage = function(address) {
  };
  MemoryView.prototype.replaceData = function(memory, offset) {
    this.buffer = memory;
    if (Buffer.isBuffer(this.buffer)) {
      this.view = new BufferDataView(this.buffer, typeof offset === "number" ? offset : 0);
    } else {
      this.view = new DataView(this.buffer, typeof offset === "number" ? offset : 0);
    }
    if (this.icache) {
      this.icache = new Array(this.icache.length);
    }
  };
  module.exports = MemoryView;
});

// js/gpio.js
var require_gpio = __commonJS((exports) => {
  var GameBoyAdvanceGPIO = function(core, rom) {
    this.core = core;
    this.rom = rom;
    this.readWrite = 0;
    this.direction = 0;
    this.device = new GameBoyAdvanceRTC(this);
  };
  var GameBoyAdvanceRTC = function(gpio) {
    this.gpio = gpio;
    this.pins = 0;
    this.direction = 0;
    this.totalBytes = [
      0,
      0,
      7,
      0,
      1,
      0,
      3,
      0
    ];
    this.bytesRemaining = 0;
    this.transferStep = 0;
    this.reading = 0;
    this.bitsRead = 0;
    this.bits = 0;
    this.command = -1;
    this.control = 64;
    this.time = [
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
  };
  GameBoyAdvanceGPIO.prototype.store16 = function(offset, value) {
    switch (offset) {
      case 196:
        this.device.setPins(value & 15);
        break;
      case 198:
        this.direction = value & 15;
        this.device.setDirection(this.direction);
        break;
      case 200:
        this.readWrite = value & 1;
        break;
      default:
        throw new Error("BUG: Bad offset passed to GPIO: " + offset.toString(16));
    }
    if (this.readWrite) {
      var old = this.rom.view.getUint16(offset, true);
      old &= ~this.direction;
      this.rom.view.setUint16(offset, old | value & this.direction, true);
    }
  };
  GameBoyAdvanceGPIO.prototype.outputPins = function(nybble) {
    if (this.readWrite) {
      var old = this.rom.view.getUint16(196, true);
      old &= this.direction;
      this.rom.view.setUint16(196, old | nybble & ~this.direction & 15, true);
    }
  };
  GameBoyAdvanceRTC.prototype.setPins = function(nybble) {
    switch (this.transferStep) {
      case 0:
        if ((nybble & 5) == 1) {
          this.transferStep = 1;
        }
        break;
      case 1:
        if (nybble & 4) {
          this.transferStep = 2;
        }
        break;
      case 2:
        if (!(nybble & 1)) {
          this.bits &= ~(1 << this.bitsRead);
          this.bits |= (nybble & 2) >> 1 << this.bitsRead;
        } else {
          if (nybble & 4) {
            if (this.direction & 2 && !this.read) {
              ++this.bitsRead;
              if (this.bitsRead == 8) {
                this.processByte();
              }
            } else {
              this.gpio.outputPins(5 | this.sioOutputPin() << 1);
              ++this.bitsRead;
              if (this.bitsRead == 8) {
                --this.bytesRemaining;
                if (this.bytesRemaining <= 0) {
                  this.command = -1;
                }
                this.bitsRead = 0;
              }
            }
          } else {
            this.bitsRead = 0;
            this.bytesRemaining = 0;
            this.command = -1;
            this.transferStep = 0;
          }
        }
        break;
    }
    this.pins = nybble & 7;
  };
  GameBoyAdvanceRTC.prototype.setDirection = function(direction) {
    this.direction = direction;
  };
  GameBoyAdvanceRTC.prototype.processByte = function() {
    --this.bytesRemaining;
    switch (this.command) {
      case -1:
        if ((this.bits & 15) == 6) {
          this.command = this.bits >> 4 & 7;
          this.reading = this.bits & 128;
          this.bytesRemaining = this.totalBytes[this.command];
          switch (this.command) {
            case 0:
              this.control = 0;
              break;
            case 2:
            case 6:
              this.updateClock();
              break;
          }
        } else {
          this.gpio.core.WARN("Invalid RTC command byte: " + this.bits.toString(16));
        }
        break;
      case 4:
        this.control = this.bits & 64;
        break;
    }
    this.bits = 0;
    this.bitsRead = 0;
    if (!this.bytesRemaining) {
      this.command = -1;
    }
  };
  GameBoyAdvanceRTC.prototype.sioOutputPin = function() {
    var outputByte = 0;
    switch (this.command) {
      case 4:
        outputByte = this.control;
        break;
      case 2:
      case 6:
        outputByte = this.time[7 - this.bytesRemaining];
        break;
    }
    var output = outputByte >> this.bitsRead & 1;
    return output;
  };
  GameBoyAdvanceRTC.prototype.updateClock = function() {
    var date = new Date;
    this.time[0] = this.bcd(date.getFullYear());
    this.time[1] = this.bcd(date.getMonth() + 1);
    this.time[2] = this.bcd(date.getDate());
    this.time[3] = date.getDay() - 1;
    if (this.time[3] < 0) {
      this.time[3] = 6;
    }
    if (this.control & 64) {
      this.time[4] = this.bcd(date.getHours());
    } else {
      this.time[4] = this.bcd(date.getHours() % 2);
      if (date.getHours() >= 12) {
        this.time[4] |= 128;
      }
    }
    this.time[5] = this.bcd(date.getMinutes());
    this.time[6] = this.bcd(date.getSeconds());
  };
  GameBoyAdvanceRTC.prototype.bcd = function(binary) {
    var counter = binary % 10;
    binary /= 10;
    counter += binary % 10 << 4;
    return counter;
  };
  exports.GameBoyAdvanceGPIO = GameBoyAdvanceGPIO;
  exports.GameBoyAdvanceRTC = GameBoyAdvanceRTC;
});

// js/savedata.js
var require_savedata = __commonJS((exports) => {
  var SRAMSavedata = function(size) {
    MemoryView.call(this, new ArrayBuffer(size), 0);
    this.writePending = false;
  };
  var FlashSavedata = function(size) {
    MemoryView.call(this, new ArrayBuffer(size), 0);
    this.COMMAND_WIPE = 16;
    this.COMMAND_ERASE_SECTOR = 48;
    this.COMMAND_ERASE = 128;
    this.COMMAND_ID = 144;
    this.COMMAND_WRITE = 160;
    this.COMMAND_SWITCH_BANK = 176;
    this.COMMAND_TERMINATE_ID = 240;
    this.ID_PANASONIC = 6962;
    this.ID_SANYO = 4962;
    this.bank0 = MemoryView.DataView(this.buffer, 0, 65536);
    if (size > 65536) {
      this.id = this.ID_SANYO;
      this.bank1 = MemoryView.DataView(this.buffer, 65536);
    } else {
      this.id = this.ID_PANASONIC;
      this.bank1 = null;
    }
    this.bank = this.bank0;
    this.idMode = false;
    this.writePending = false;
    this.first = 0;
    this.second = 0;
    this.command = 0;
    this.pendingCommand = 0;
  };
  var EEPROMSavedata = function(size, mmu) {
    MemoryView.call(this, new ArrayBuffer(size), 0);
    this.writeAddress = 0;
    this.readBitsRemaining = 0;
    this.readAddress = 0;
    this.command = 0;
    this.commandBitsRemaining = 0;
    this.realSize = 0;
    this.addressBits = 0;
    this.writePending = false;
    this.dma = mmu.core.irq.dma[3];
    this.COMMAND_NULL = 0;
    this.COMMAND_PENDING = 1;
    this.COMMAND_WRITE = 2;
    this.COMMAND_READ_PENDING = 3;
    this.COMMAND_READ = 4;
  };
  var MemoryView = require_memory_view();
  SRAMSavedata.prototype = Object.create(MemoryView.prototype);
  SRAMSavedata.prototype.store8 = function(offset, value) {
    this.view.setInt8(offset, value);
    this.writePending = true;
  };
  SRAMSavedata.prototype.store16 = function(offset, value) {
    this.view.setInt16(offset, value, true);
    this.writePending = true;
  };
  SRAMSavedata.prototype.store32 = function(offset, value) {
    this.view.setInt32(offset, value, true);
    this.writePending = true;
  };
  FlashSavedata.prototype = Object.create(MemoryView.prototype);
  FlashSavedata.prototype.load8 = function(offset) {
    if (this.idMode && offset < 2) {
      return this.id >> (offset << 3) & 255;
    } else if (offset < 65536) {
      return this.bank.getInt8(offset);
    } else {
      return 0;
    }
  };
  FlashSavedata.prototype.load16 = function(offset) {
    return this.load8(offset) & 255 | this.load8(offset + 1) << 8;
  };
  FlashSavedata.prototype.load32 = function(offset) {
    return this.load8(offset) & 255 | this.load8(offset + 1) << 8 | this.load8(offset + 2) << 16 | this.load8(offset + 3) << 24;
  };
  FlashSavedata.prototype.loadU8 = function(offset) {
    return this.load8(offset) & 255;
  };
  FlashSavedata.prototype.loadU16 = function(offset) {
    return this.loadU8(offset) & 255 | this.loadU8(offset + 1) << 8;
  };
  FlashSavedata.prototype.store8 = function(offset, value) {
    switch (this.command) {
      case 0:
        if (offset == 21845) {
          if (this.second == 85) {
            switch (value) {
              case this.COMMAND_ERASE:
                this.pendingCommand = value;
                break;
              case this.COMMAND_ID:
                this.idMode = true;
                break;
              case this.COMMAND_TERMINATE_ID:
                this.idMode = false;
                break;
              default:
                this.command = value;
                break;
            }
            this.second = 0;
            this.first = 0;
          } else {
            this.command = 0;
            this.first = value;
            this.idMode = false;
          }
        } else if (offset == 10922 && this.first == 170) {
          this.first = 0;
          if (this.pendingCommand) {
            this.command = this.pendingCommand;
          } else {
            this.second = value;
          }
        }
        break;
      case this.COMMAND_ERASE:
        switch (value) {
          case this.COMMAND_WIPE:
            if (offset == 21845) {
              for (var i2 = 0;i2 < this.view.byteLength; i2 += 4) {
                this.view.setInt32(i2, -1);
              }
            }
            break;
          case this.COMMAND_ERASE_SECTOR:
            if ((offset & 4095) == 0) {
              for (var i2 = offset;i2 < offset + 4096; i2 += 4) {
                this.bank.setInt32(i2, -1);
              }
            }
            break;
        }
        this.pendingCommand = 0;
        this.command = 0;
        break;
      case this.COMMAND_WRITE:
        this.bank.setInt8(offset, value);
        this.command = 0;
        this.writePending = true;
        break;
      case this.COMMAND_SWITCH_BANK:
        if (this.bank1 && offset == 0) {
          if (value == 1) {
            this.bank = this.bank1;
          } else {
            this.bank = this.bank0;
          }
        }
        this.command = 0;
        break;
    }
  };
  FlashSavedata.prototype.store16 = function(offset, value) {
    throw new Error("Unaligned save to flash!");
  };
  FlashSavedata.prototype.store32 = function(offset, value) {
    throw new Error("Unaligned save to flash!");
  };
  FlashSavedata.prototype.replaceData = function(memory) {
    var bank = this.view === this.bank1;
    MemoryView.prototype.replaceData.call(this, memory, 0);
    this.bank0 = MemoryView.DataView(this.buffer, 0, 65536);
    if (memory.byteLength > 65536) {
      this.bank1 = MemoryView.DataView(this.buffer, 65536);
    } else {
      this.bank1 = null;
    }
    this.bank = bank ? this.bank1 : this.bank0;
  };
  EEPROMSavedata.prototype = Object.create(MemoryView.prototype);
  EEPROMSavedata.prototype.load8 = function(offset) {
    throw new Error("Unsupported 8-bit access!");
  };
  EEPROMSavedata.prototype.load16 = function(offset) {
    return this.loadU16(offset);
  };
  EEPROMSavedata.prototype.loadU8 = function(offset) {
    throw new Error("Unsupported 8-bit access!");
  };
  EEPROMSavedata.prototype.loadU16 = function(offset) {
    if (this.command != this.COMMAND_READ || !this.dma.enable) {
      return 1;
    }
    --this.readBitsRemaining;
    if (this.readBitsRemaining < 64) {
      var step = 63 - this.readBitsRemaining;
      var data = this.view.getUint8(this.readAddress + step >> 3, false) >> 7 - (step & 7);
      if (!this.readBitsRemaining) {
        this.command = this.COMMAND_NULL;
      }
      return data & 1;
    }
    return 0;
  };
  EEPROMSavedata.prototype.load32 = function(offset) {
    throw new Error("Unsupported 32-bit access!");
  };
  EEPROMSavedata.prototype.store8 = function(offset, value) {
    throw new Error("Unsupported 8-bit access!");
  };
  EEPROMSavedata.prototype.store16 = function(offset, value) {
    switch (this.command) {
      case this.COMMAND_NULL:
      default:
        this.command = value & 1;
        break;
      case this.COMMAND_PENDING:
        this.command <<= 1;
        this.command |= value & 1;
        if (this.command == this.COMMAND_WRITE) {
          if (!this.realSize) {
            var bits = this.dma.count - 67;
            this.realSize = 8 << bits;
            this.addressBits = bits;
          }
          this.commandBitsRemaining = this.addressBits + 64 + 1;
          this.writeAddress = 0;
        } else {
          if (!this.realSize) {
            var bits = this.dma.count - 3;
            this.realSize = 8 << bits;
            this.addressBits = bits;
          }
          this.commandBitsRemaining = this.addressBits + 1;
          this.readAddress = 0;
        }
        break;
      case this.COMMAND_WRITE:
        if (--this.commandBitsRemaining > 64) {
          this.writeAddress <<= 1;
          this.writeAddress |= (value & 1) << 6;
        } else if (this.commandBitsRemaining <= 0) {
          this.command = this.COMMAND_NULL;
          this.writePending = true;
        } else {
          var current = this.view.getUint8(this.writeAddress >> 3);
          current &= ~(1 << 7 - (this.writeAddress & 7));
          current |= (value & 1) << 7 - (this.writeAddress & 7);
          this.view.setUint8(this.writeAddress >> 3, current);
          ++this.writeAddress;
        }
        break;
      case this.COMMAND_READ_PENDING:
        if (--this.commandBitsRemaining > 0) {
          this.readAddress <<= 1;
          if (value & 1) {
            this.readAddress |= 64;
          }
        } else {
          this.readBitsRemaining = 68;
          this.command = this.COMMAND_READ;
        }
        break;
    }
  };
  EEPROMSavedata.prototype.store32 = function(offset, value) {
    throw new Error("Unsupported 32-bit access!");
  };
  EEPROMSavedata.prototype.replaceData = function(memory) {
    MemoryView.prototype.replaceData.call(this, memory, 0);
  };
  exports.SRAMSavedata = SRAMSavedata;
  exports.FlashSavedata = FlashSavedata;
  exports.EEPROMSavedata = EEPROMSavedata;
});

// js/mmu.js
var require_mmu = __commonJS((exports) => {
  var MemoryBlock = function(size, cacheBits) {
    MemoryView.call(this, new ArrayBuffer(size));
    this.ICACHE_PAGE_BITS = cacheBits;
    this.PAGE_MASK = (2 << this.ICACHE_PAGE_BITS) - 1;
    this.icache = new Array(size >> this.ICACHE_PAGE_BITS + 1);
  };
  var ROMView = function(rom, offset) {
    MemoryView.call(this, rom, offset);
    this.ICACHE_PAGE_BITS = 10;
    this.PAGE_MASK = (2 << this.ICACHE_PAGE_BITS) - 1;
    this.icache = new Array(rom.byteLength >> this.ICACHE_PAGE_BITS + 1);
    this.mask = 33554431;
    this.resetMask();
  };
  var BIOSView = function(rom, offset) {
    MemoryView.call(this, rom, offset);
    this.ICACHE_PAGE_BITS = 16;
    this.PAGE_MASK = (2 << this.ICACHE_PAGE_BITS) - 1;
    this.icache = new Array(1);
  };
  var BadMemory = function(mmu, cpu) {
    inherit.call(this);
    this.cpu = cpu;
    this.mmu = mmu;
  };
  var GameBoyAdvanceMMU = function() {
    inherit.call(this);
    this.REGION_BIOS = 0;
    this.REGION_WORKING_RAM = 2;
    this.REGION_WORKING_IRAM = 3;
    this.REGION_IO = 4;
    this.REGION_PALETTE_RAM = 5;
    this.REGION_VRAM = 6;
    this.REGION_OAM = 7;
    this.REGION_CART0 = 8;
    this.REGION_CART1 = 10;
    this.REGION_CART2 = 12;
    this.REGION_CART_SRAM = 14;
    this.BASE_BIOS = 0;
    this.BASE_WORKING_RAM = 33554432;
    this.BASE_WORKING_IRAM = 50331648;
    this.BASE_IO = 67108864;
    this.BASE_PALETTE_RAM = 83886080;
    this.BASE_VRAM = 100663296;
    this.BASE_OAM = 117440512;
    this.BASE_CART0 = 134217728;
    this.BASE_CART1 = 167772160;
    this.BASE_CART2 = 201326592;
    this.BASE_CART_SRAM = 234881024;
    this.BASE_MASK = 251658240;
    this.BASE_OFFSET = 24;
    this.OFFSET_MASK = 16777215;
    this.SIZE_BIOS = 16384;
    this.SIZE_WORKING_RAM = 262144;
    this.SIZE_WORKING_IRAM = 32768;
    this.SIZE_IO = 1024;
    this.SIZE_PALETTE_RAM = 1024;
    this.SIZE_VRAM = 98304;
    this.SIZE_OAM = 1024;
    this.SIZE_CART0 = 33554432;
    this.SIZE_CART1 = 33554432;
    this.SIZE_CART2 = 33554432;
    this.SIZE_CART_SRAM = 32768;
    this.SIZE_CART_FLASH512 = 65536;
    this.SIZE_CART_FLASH1M = 131072;
    this.SIZE_CART_EEPROM = 8192;
    this.DMA_TIMING_NOW = 0;
    this.DMA_TIMING_VBLANK = 1;
    this.DMA_TIMING_HBLANK = 2;
    this.DMA_TIMING_CUSTOM = 3;
    this.DMA_INCREMENT = 0;
    this.DMA_DECREMENT = 1;
    this.DMA_FIXED = 2;
    this.DMA_INCREMENT_RELOAD = 3;
    this.DMA_OFFSET = [1, -1, 0, 1];
    this.WAITSTATES = [0, 0, 2, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4];
    this.WAITSTATES_32 = [0, 0, 5, 0, 0, 1, 0, 1, 7, 7, 9, 9, 13, 13, 8];
    this.WAITSTATES_SEQ = [0, 0, 2, 0, 0, 0, 0, 0, 2, 2, 4, 4, 8, 8, 4];
    this.WAITSTATES_SEQ_32 = [0, 0, 5, 0, 0, 1, 0, 1, 5, 5, 9, 9, 17, 17, 8];
    this.NULLWAIT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i2 = 15;i2 < 256; ++i2) {
      this.WAITSTATES[i2] = 0;
      this.WAITSTATES_32[i2] = 0;
      this.WAITSTATES_SEQ[i2] = 0;
      this.WAITSTATES_SEQ_32[i2] = 0;
      this.NULLWAIT[i2] = 0;
    }
    this.ROM_WS = [4, 3, 2, 8];
    this.ROM_WS_SEQ = [
      [2, 1],
      [4, 1],
      [8, 1]
    ];
    this.ICACHE_PAGE_BITS = 8;
    this.PAGE_MASK = (2 << this.ICACHE_PAGE_BITS) - 1;
    this.bios = null;
  };
  var MemoryView = require_memory_view();
  var util = require_util();
  var inherit = util.inherit;
  var Serializer = util.Serializer;
  var GameBoyAdvanceGPIO = require_gpio().GameBoyAdvanceGPIO;
  var Savedata = require_savedata();
  var EEPROMSavedata = Savedata.EEPROMSavedata;
  var FlashSavedata = Savedata.FlashSavedata;
  var SRAMSavedata = Savedata.SRAMSavedata;
  MemoryBlock.prototype = Object.create(MemoryView.prototype);
  MemoryBlock.prototype.invalidatePage = function(address) {
    var page = this.icache[(address & this.mask) >> this.ICACHE_PAGE_BITS];
    if (page) {
      page.invalid = true;
    }
  };
  ROMView.prototype = Object.create(MemoryView.prototype);
  ROMView.prototype.store8 = function(offset, value) {
  };
  ROMView.prototype.store16 = function(offset, value) {
    if (offset < 202 && offset >= 196) {
      if (!this.gpio) {
        this.gpio = this.mmu.allocGPIO(this);
      }
      this.gpio.store16(offset, value);
    }
  };
  ROMView.prototype.store32 = function(offset, value) {
    if (offset < 202 && offset >= 196) {
      if (!this.gpio) {
        this.gpio = this.mmu.allocGPIO(this);
      }
      this.gpio.store32(offset, value);
    }
  };
  BIOSView.prototype = Object.create(MemoryView.prototype);
  BIOSView.prototype.load8 = function(offset) {
    if (offset >= this.buffer.byteLength) {
      return -1;
    }
    return this.view.getInt8(offset);
  };
  BIOSView.prototype.load16 = function(offset) {
    if (offset >= this.buffer.byteLength) {
      return -1;
    }
    return this.view.getInt16(offset, true);
  };
  BIOSView.prototype.loadU8 = function(offset) {
    if (offset >= this.buffer.byteLength) {
      return -1;
    }
    return this.view.getUint8(offset);
  };
  BIOSView.prototype.loadU16 = function(offset) {
    if (offset >= this.buffer.byteLength) {
      return -1;
    }
    return this.view.getUint16(offset, true);
  };
  BIOSView.prototype.load32 = function(offset) {
    if (offset >= this.buffer.byteLength) {
      return -1;
    }
    return this.view.getInt32(offset, true);
  };
  BIOSView.prototype.store8 = function(offset, value) {
  };
  BIOSView.prototype.store16 = function(offset, value) {
  };
  BIOSView.prototype.store32 = function(offset, value) {
  };
  BadMemory.prototype.load8 = function(offset) {
    return this.mmu.load8(this.cpu.gprs[this.cpu.PC] - this.cpu.instructionWidth + (offset & 3));
  };
  BadMemory.prototype.load16 = function(offset) {
    return this.mmu.load16(this.cpu.gprs[this.cpu.PC] - this.cpu.instructionWidth + (offset & 2));
  };
  BadMemory.prototype.loadU8 = function(offset) {
    return this.mmu.loadU8(this.cpu.gprs[this.cpu.PC] - this.cpu.instructionWidth + (offset & 3));
  };
  BadMemory.prototype.loadU16 = function(offset) {
    return this.mmu.loadU16(this.cpu.gprs[this.cpu.PC] - this.cpu.instructionWidth + (offset & 2));
  };
  BadMemory.prototype.load32 = function(offset) {
    if (this.cpu.execMode == this.cpu.MODE_ARM) {
      return this.mmu.load32(this.cpu.gprs[this.cpu.gprs.PC] - this.cpu.instructionWidth);
    } else {
      var halfword = this.mmu.loadU16(this.cpu.gprs[this.cpu.PC] - this.cpu.instructionWidth);
      return halfword | halfword << 16;
    }
  };
  BadMemory.prototype.store8 = function(offset, value) {
  };
  BadMemory.prototype.store16 = function(offset, value) {
  };
  BadMemory.prototype.store32 = function(offset, value) {
  };
  BadMemory.prototype.invalidatePage = function(address) {
  };
  GameBoyAdvanceMMU.prototype.mmap = function(region, object) {
    this.memory[region] = object;
  };
  GameBoyAdvanceMMU.prototype.clear = function() {
    this.badMemory = new BadMemory(this, this.cpu);
    this.memory = [
      this.bios,
      this.badMemory,
      new MemoryBlock(this.SIZE_WORKING_RAM, 9),
      new MemoryBlock(this.SIZE_WORKING_IRAM, 7),
      null,
      null,
      null,
      null,
      this.badMemory,
      this.badMemory,
      this.badMemory,
      this.badMemory,
      this.badMemory,
      this.badMemory,
      this.badMemory,
      this.badMemory
    ];
    for (var i2 = 16;i2 < 256; ++i2) {
      this.memory[i2] = this.badMemory;
    }
    this.waitstates = this.WAITSTATES.slice(0);
    this.waitstatesSeq = this.WAITSTATES_SEQ.slice(0);
    this.waitstates32 = this.WAITSTATES_32.slice(0);
    this.waitstatesSeq32 = this.WAITSTATES_SEQ_32.slice(0);
    this.waitstatesPrefetch = this.WAITSTATES_SEQ.slice(0);
    this.waitstatesPrefetch32 = this.WAITSTATES_SEQ_32.slice(0);
    this.cart = null;
    this.save = null;
    this.DMA_REGISTER = [
      this.core.io.DMA0CNT_HI >> 1,
      this.core.io.DMA1CNT_HI >> 1,
      this.core.io.DMA2CNT_HI >> 1,
      this.core.io.DMA3CNT_HI >> 1
    ];
  };
  GameBoyAdvanceMMU.prototype.freeze = function() {
    return {
      ram: Serializer.prefix(this.memory[this.REGION_WORKING_RAM].buffer),
      iram: Serializer.prefix(this.memory[this.REGION_WORKING_IRAM].buffer)
    };
  };
  GameBoyAdvanceMMU.prototype.defrost = function(frost) {
    this.memory[this.REGION_WORKING_RAM].replaceData(frost.ram);
    this.memory[this.REGION_WORKING_IRAM].replaceData(frost.iram);
  };
  GameBoyAdvanceMMU.prototype.loadBios = function(bios, real) {
    this.bios = new BIOSView(bios);
    this.bios.real = !!real;
  };
  GameBoyAdvanceMMU.prototype.loadRom = function(rom, process2) {
    var cart = {
      title: null,
      code: null,
      maker: null,
      memory: rom,
      saveType: null
    };
    var lo = new ROMView(rom);
    if (lo.view.getUint8(178) != 150) {
      return null;
    }
    lo.mmu = this;
    this.memory[this.REGION_CART0] = lo;
    this.memory[this.REGION_CART1] = lo;
    this.memory[this.REGION_CART2] = lo;
    if (rom.byteLength > 16777216) {
      var hi = new ROMView(rom, 16777216);
      this.memory[this.REGION_CART0 + 1] = hi;
      this.memory[this.REGION_CART1 + 1] = hi;
      this.memory[this.REGION_CART2 + 1] = hi;
    }
    if (process2) {
      var name = "";
      for (var i2 = 0;i2 < 12; ++i2) {
        var c = lo.loadU8(i2 + 160);
        if (!c) {
          break;
        }
        name += String.fromCharCode(c);
      }
      cart.title = name;
      var code = "";
      for (var i2 = 0;i2 < 4; ++i2) {
        var c = lo.loadU8(i2 + 172);
        if (!c) {
          break;
        }
        code += String.fromCharCode(c);
      }
      cart.code = code;
      var maker = "";
      for (var i2 = 0;i2 < 2; ++i2) {
        var c = lo.loadU8(i2 + 176);
        if (!c) {
          break;
        }
        maker += String.fromCharCode(c);
      }
      cart.maker = maker;
      var state = "";
      var next;
      var terminal = false;
      for (var i2 = 228;i2 < rom.byteLength && !terminal; ++i2) {
        next = String.fromCharCode(lo.loadU8(i2));
        state += next;
        switch (state) {
          case "F":
          case "FL":
          case "FLA":
          case "FLAS":
          case "FLASH":
          case "FLASH_":
          case "FLASH5":
          case "FLASH51":
          case "FLASH512":
          case "FLASH512_":
          case "FLASH1":
          case "FLASH1M":
          case "FLASH1M_":
          case "S":
          case "SR":
          case "SRA":
          case "SRAM":
          case "SRAM_":
          case "E":
          case "EE":
          case "EEP":
          case "EEPR":
          case "EEPRO":
          case "EEPROM":
          case "EEPROM_":
            break;
          case "FLASH_V":
          case "FLASH512_V":
          case "FLASH1M_V":
          case "SRAM_V":
          case "EEPROM_V":
            terminal = true;
            break;
          default:
            state = next;
            break;
        }
      }
      if (terminal) {
        cart.saveType = state;
        switch (state) {
          case "FLASH_V":
          case "FLASH512_V":
            this.save = this.memory[this.REGION_CART_SRAM] = new FlashSavedata(this.SIZE_CART_FLASH512);
            break;
          case "FLASH1M_V":
            this.save = this.memory[this.REGION_CART_SRAM] = new FlashSavedata(this.SIZE_CART_FLASH1M);
            break;
          case "SRAM_V":
            this.save = this.memory[this.REGION_CART_SRAM] = new SRAMSavedata(this.SIZE_CART_SRAM);
            break;
          case "EEPROM_V":
            this.save = this.memory[this.REGION_CART2 + 1] = new EEPROMSavedata(this.SIZE_CART_EEPROM, this);
            break;
        }
      }
      if (!this.save) {
        this.save = this.memory[this.REGION_CART_SRAM] = new SRAMSavedata(this.SIZE_CART_SRAM);
      }
    }
    this.cart = cart;
    return cart;
  };
  GameBoyAdvanceMMU.prototype.loadSavedata = function(save) {
    this.save.replaceData(save);
  };
  GameBoyAdvanceMMU.prototype.load8 = function(offset) {
    return this.memory[offset >>> this.BASE_OFFSET].load8(offset & 16777215);
  };
  GameBoyAdvanceMMU.prototype.load16 = function(offset) {
    return this.memory[offset >>> this.BASE_OFFSET].load16(offset & 16777215);
  };
  GameBoyAdvanceMMU.prototype.load32 = function(offset) {
    return this.memory[offset >>> this.BASE_OFFSET].load32(offset & 16777215);
  };
  GameBoyAdvanceMMU.prototype.loadU8 = function(offset) {
    return this.memory[offset >>> this.BASE_OFFSET].loadU8(offset & 16777215);
  };
  GameBoyAdvanceMMU.prototype.loadU16 = function(offset) {
    return this.memory[offset >>> this.BASE_OFFSET].loadU16(offset & 16777215);
  };
  GameBoyAdvanceMMU.prototype.store8 = function(offset, value) {
    var maskedOffset = offset & 16777215;
    var memory = this.memory[offset >>> this.BASE_OFFSET];
    memory.store8(maskedOffset, value);
    memory.invalidatePage(maskedOffset);
  };
  GameBoyAdvanceMMU.prototype.store16 = function(offset, value) {
    var maskedOffset = offset & 16777214;
    var memory = this.memory[offset >>> this.BASE_OFFSET];
    memory.store16(maskedOffset, value);
    memory.invalidatePage(maskedOffset);
  };
  GameBoyAdvanceMMU.prototype.store32 = function(offset, value) {
    var maskedOffset = offset & 16777212;
    var memory = this.memory[offset >>> this.BASE_OFFSET];
    memory.store32(maskedOffset, value);
    memory.invalidatePage(maskedOffset);
    memory.invalidatePage(maskedOffset + 2);
  };
  GameBoyAdvanceMMU.prototype.waitPrefetch = function(memory) {
    this.cpu.cycles += 1 + this.waitstatesPrefetch[memory >>> this.BASE_OFFSET];
  };
  GameBoyAdvanceMMU.prototype.waitPrefetch32 = function(memory) {
    this.cpu.cycles += 1 + this.waitstatesPrefetch32[memory >>> this.BASE_OFFSET];
  };
  GameBoyAdvanceMMU.prototype.wait = function(memory) {
    this.cpu.cycles += 1 + this.waitstates[memory >>> this.BASE_OFFSET];
  };
  GameBoyAdvanceMMU.prototype.wait32 = function(memory) {
    this.cpu.cycles += 1 + this.waitstates32[memory >>> this.BASE_OFFSET];
  };
  GameBoyAdvanceMMU.prototype.waitSeq = function(memory) {
    this.cpu.cycles += 1 + this.waitstatesSeq[memory >>> this.BASE_OFFSET];
  };
  GameBoyAdvanceMMU.prototype.waitSeq32 = function(memory) {
    this.cpu.cycles += 1 + this.waitstatesSeq32[memory >>> this.BASE_OFFSET];
  };
  GameBoyAdvanceMMU.prototype.waitMul = function(rs) {
    if (rs & true || !(rs & 4294967040)) {
      this.cpu.cycles += 1;
    } else if (rs & true || !(rs & 4294901760)) {
      this.cpu.cycles += 2;
    } else if (rs & true || !(rs & 4278190080)) {
      this.cpu.cycles += 3;
    } else {
      this.cpu.cycles += 4;
    }
  };
  GameBoyAdvanceMMU.prototype.waitMulti32 = function(memory, seq) {
    this.cpu.cycles += 1 + this.waitstates32[memory >>> this.BASE_OFFSET];
    this.cpu.cycles += (1 + this.waitstatesSeq32[memory >>> this.BASE_OFFSET]) * (seq - 1);
  };
  GameBoyAdvanceMMU.prototype.addressToPage = function(region, address) {
    return address >> this.memory[region].ICACHE_PAGE_BITS;
  };
  GameBoyAdvanceMMU.prototype.accessPage = function(region, pageId) {
    var memory = this.memory[region];
    var page = memory.icache[pageId];
    if (!page || page.invalid) {
      page = {
        thumb: new Array(1 << memory.ICACHE_PAGE_BITS),
        arm: new Array(1 << memory.ICACHE_PAGE_BITS - 1),
        invalid: false
      };
      memory.icache[pageId] = page;
    }
    return page;
  };
  GameBoyAdvanceMMU.prototype.scheduleDma = function(number, info) {
    switch (info.timing) {
      case this.DMA_TIMING_NOW:
        this.serviceDma(number, info);
        break;
      case this.DMA_TIMING_HBLANK:
        break;
      case this.DMA_TIMING_VBLANK:
        break;
      case this.DMA_TIMING_CUSTOM:
        switch (number) {
          case 0:
            this.core.WARN("Discarding invalid DMA0 scheduling");
            break;
          case 1:
          case 2:
            this.cpu.irq.audio.scheduleFIFODma(number, info);
            break;
          case 3:
            this.cpu.irq.video.scheduleVCaptureDma(dma, info);
            break;
        }
    }
  };
  GameBoyAdvanceMMU.prototype.runHblankDmas = function() {
    var dma2;
    for (var i2 = 0;i2 < this.cpu.irq.dma.length; ++i2) {
      dma2 = this.cpu.irq.dma[i2];
      if (dma2.enable && dma2.timing == this.DMA_TIMING_HBLANK) {
        this.serviceDma(i2, dma2);
      }
    }
  };
  GameBoyAdvanceMMU.prototype.runVblankDmas = function() {
    var dma2;
    for (var i2 = 0;i2 < this.cpu.irq.dma.length; ++i2) {
      dma2 = this.cpu.irq.dma[i2];
      if (dma2.enable && dma2.timing == this.DMA_TIMING_VBLANK) {
        this.serviceDma(i2, dma2);
      }
    }
  };
  GameBoyAdvanceMMU.prototype.serviceDma = function(number, info) {
    if (!info.enable) {
      return;
    }
    var width = info.width;
    var sourceOffset = this.DMA_OFFSET[info.srcControl] * width;
    var destOffset = this.DMA_OFFSET[info.dstControl] * width;
    var wordsRemaining = info.nextCount;
    var source = info.nextSource & this.OFFSET_MASK;
    var dest = info.nextDest & this.OFFSET_MASK;
    var sourceRegion = info.nextSource >>> this.BASE_OFFSET;
    var destRegion = info.nextDest >>> this.BASE_OFFSET;
    var sourceBlock = this.memory[sourceRegion];
    var destBlock = this.memory[destRegion];
    var sourceView = null;
    var destView = null;
    var sourceMask = 4294967295;
    var destMask = 4294967295;
    var word;
    if (destBlock.ICACHE_PAGE_BITS) {
      var endPage = dest + wordsRemaining * width >> destBlock.ICACHE_PAGE_BITS;
      for (var i2 = dest >> destBlock.ICACHE_PAGE_BITS;i2 <= endPage; ++i2) {
        destBlock.invalidatePage(i2 << destBlock.ICACHE_PAGE_BITS);
      }
    }
    if (destRegion == this.REGION_WORKING_RAM || destRegion == this.REGION_WORKING_IRAM) {
      destView = destBlock.view;
      destMask = destBlock.mask;
    }
    if (sourceRegion == this.REGION_WORKING_RAM || sourceRegion == this.REGION_WORKING_IRAM || sourceRegion == this.REGION_CART0 || sourceRegion == this.REGION_CART1) {
      sourceView = sourceBlock.view;
      sourceMask = sourceBlock.mask;
    }
    if (sourceBlock && destBlock) {
      if (sourceView && destView) {
        if (width == 4) {
          source &= 4294967292;
          dest &= 4294967292;
          while (wordsRemaining--) {
            word = sourceView.getInt32(source & sourceMask);
            destView.setInt32(dest & destMask, word);
            source += sourceOffset;
            dest += destOffset;
          }
        } else {
          while (wordsRemaining--) {
            word = sourceView.getUint16(source & sourceMask);
            destView.setUint16(dest & destMask, word);
            source += sourceOffset;
            dest += destOffset;
          }
        }
      } else if (sourceView) {
        if (width == 4) {
          source &= 4294967292;
          dest &= 4294967292;
          while (wordsRemaining--) {
            word = sourceView.getInt32(source & sourceMask, true);
            destBlock.store32(dest, word);
            source += sourceOffset;
            dest += destOffset;
          }
        } else {
          while (wordsRemaining--) {
            word = sourceView.getUint16(source & sourceMask, true);
            destBlock.store16(dest, word);
            source += sourceOffset;
            dest += destOffset;
          }
        }
      } else {
        if (width == 4) {
          source &= 4294967292;
          dest &= 4294967292;
          while (wordsRemaining--) {
            word = sourceBlock.load32(source);
            destBlock.store32(dest, word);
            source += sourceOffset;
            dest += destOffset;
          }
        } else {
          while (wordsRemaining--) {
            word = sourceBlock.loadU16(source);
            destBlock.store16(dest, word);
            source += sourceOffset;
            dest += destOffset;
          }
        }
      }
    } else {
      this.core.WARN("Invalid DMA");
    }
    if (info.doIrq) {
      info.nextIRQ = this.cpu.cycles + 2;
      info.nextIRQ += width == 4 ? this.waitstates32[sourceRegion] + this.waitstates32[destRegion] : this.waitstates[sourceRegion] + this.waitstates[destRegion];
      info.nextIRQ += (info.count - 1) * (width == 4 ? this.waitstatesSeq32[sourceRegion] + this.waitstatesSeq32[destRegion] : this.waitstatesSeq[sourceRegion] + this.waitstatesSeq[destRegion]);
    }
    info.nextSource = source | sourceRegion << this.BASE_OFFSET;
    info.nextDest = dest | destRegion << this.BASE_OFFSET;
    info.nextCount = wordsRemaining;
    if (!info.repeat) {
      info.enable = false;
      var io = this.memory[this.REGION_IO];
      io.registers[this.DMA_REGISTER[number]] &= 32736;
    } else {
      info.nextCount = info.count;
      if (info.dstControl == this.DMA_INCREMENT_RELOAD) {
        info.nextDest = info.dest;
      }
      this.scheduleDma(number, info);
    }
  };
  GameBoyAdvanceMMU.prototype.adjustTimings = function(word) {
    var sram = word & 3;
    var ws0 = (word & 12) >> 2;
    var ws0seq = (word & 16) >> 4;
    var ws1 = (word & 96) >> 5;
    var ws1seq = (word & 128) >> 7;
    var ws2 = (word & 768) >> 8;
    var ws2seq = (word & 1024) >> 10;
    var prefetch = word & 16384;
    this.waitstates[this.REGION_CART_SRAM] = this.ROM_WS[sram];
    this.waitstatesSeq[this.REGION_CART_SRAM] = this.ROM_WS[sram];
    this.waitstates32[this.REGION_CART_SRAM] = this.ROM_WS[sram];
    this.waitstatesSeq32[this.REGION_CART_SRAM] = this.ROM_WS[sram];
    this.waitstates[this.REGION_CART0] = this.waitstates[this.REGION_CART0 + 1] = this.ROM_WS[ws0];
    this.waitstates[this.REGION_CART1] = this.waitstates[this.REGION_CART1 + 1] = this.ROM_WS[ws1];
    this.waitstates[this.REGION_CART2] = this.waitstates[this.REGION_CART2 + 1] = this.ROM_WS[ws2];
    this.waitstatesSeq[this.REGION_CART0] = this.waitstatesSeq[this.REGION_CART0 + 1] = this.ROM_WS_SEQ[0][ws0seq];
    this.waitstatesSeq[this.REGION_CART1] = this.waitstatesSeq[this.REGION_CART1 + 1] = this.ROM_WS_SEQ[1][ws1seq];
    this.waitstatesSeq[this.REGION_CART2] = this.waitstatesSeq[this.REGION_CART2 + 1] = this.ROM_WS_SEQ[2][ws2seq];
    this.waitstates32[this.REGION_CART0] = this.waitstates32[this.REGION_CART0 + 1] = this.waitstates[this.REGION_CART0] + 1 + this.waitstatesSeq[this.REGION_CART0];
    this.waitstates32[this.REGION_CART1] = this.waitstates32[this.REGION_CART1 + 1] = this.waitstates[this.REGION_CART1] + 1 + this.waitstatesSeq[this.REGION_CART1];
    this.waitstates32[this.REGION_CART2] = this.waitstates32[this.REGION_CART2 + 1] = this.waitstates[this.REGION_CART2] + 1 + this.waitstatesSeq[this.REGION_CART2];
    this.waitstatesSeq32[this.REGION_CART0] = this.waitstatesSeq32[this.REGION_CART0 + 1] = 2 * this.waitstatesSeq[this.REGION_CART0] + 1;
    this.waitstatesSeq32[this.REGION_CART1] = this.waitstatesSeq32[this.REGION_CART1 + 1] = 2 * this.waitstatesSeq[this.REGION_CART1] + 1;
    this.waitstatesSeq32[this.REGION_CART2] = this.waitstatesSeq32[this.REGION_CART2 + 1] = 2 * this.waitstatesSeq[this.REGION_CART2] + 1;
    if (prefetch) {
      this.waitstatesPrefetch[this.REGION_CART0] = this.waitstatesPrefetch[this.REGION_CART0 + 1] = 0;
      this.waitstatesPrefetch[this.REGION_CART1] = this.waitstatesPrefetch[this.REGION_CART1 + 1] = 0;
      this.waitstatesPrefetch[this.REGION_CART2] = this.waitstatesPrefetch[this.REGION_CART2 + 1] = 0;
      this.waitstatesPrefetch32[this.REGION_CART0] = this.waitstatesPrefetch32[this.REGION_CART0 + 1] = 0;
      this.waitstatesPrefetch32[this.REGION_CART1] = this.waitstatesPrefetch32[this.REGION_CART1 + 1] = 0;
      this.waitstatesPrefetch32[this.REGION_CART2] = this.waitstatesPrefetch32[this.REGION_CART2 + 1] = 0;
    } else {
      this.waitstatesPrefetch[this.REGION_CART0] = this.waitstatesPrefetch[this.REGION_CART0 + 1] = this.waitstatesSeq[this.REGION_CART0];
      this.waitstatesPrefetch[this.REGION_CART1] = this.waitstatesPrefetch[this.REGION_CART1 + 1] = this.waitstatesSeq[this.REGION_CART1];
      this.waitstatesPrefetch[this.REGION_CART2] = this.waitstatesPrefetch[this.REGION_CART2 + 1] = this.waitstatesSeq[this.REGION_CART2];
      this.waitstatesPrefetch32[this.REGION_CART0] = this.waitstatesPrefetch32[this.REGION_CART0 + 1] = this.waitstatesSeq32[this.REGION_CART0];
      this.waitstatesPrefetch32[this.REGION_CART1] = this.waitstatesPrefetch32[this.REGION_CART1 + 1] = this.waitstatesSeq32[this.REGION_CART1];
      this.waitstatesPrefetch32[this.REGION_CART2] = this.waitstatesPrefetch32[this.REGION_CART2 + 1] = this.waitstatesSeq32[this.REGION_CART2];
    }
  };
  GameBoyAdvanceMMU.prototype.saveNeedsFlush = function() {
    return this.save.writePending;
  };
  GameBoyAdvanceMMU.prototype.flushSave = function() {
    this.save.writePending = false;
  };
  GameBoyAdvanceMMU.prototype.allocGPIO = function(rom) {
    return new GameBoyAdvanceGPIO(this.core, rom);
  };
  exports.MemoryBlock = MemoryBlock;
  exports.ROMView = ROMView;
  exports.BIOSView = BIOSView;
  exports.GameBoyAdvanceMMU = GameBoyAdvanceMMU;
});

// js/irq.js
var require_irq = __commonJS((exports, module) => {
  var GameBoyAdvanceInterruptHandler = function() {
    inherit.call(this);
    this.FREQUENCY = 16777216;
    this.cpu = null;
    this.enable = false;
    this.IRQ_VBLANK = 0;
    this.IRQ_HBLANK = 1;
    this.IRQ_VCOUNTER = 2;
    this.IRQ_TIMER0 = 3;
    this.IRQ_TIMER1 = 4;
    this.IRQ_TIMER2 = 5;
    this.IRQ_TIMER3 = 6;
    this.IRQ_SIO = 7;
    this.IRQ_DMA0 = 8;
    this.IRQ_DMA1 = 9;
    this.IRQ_DMA2 = 10;
    this.IRQ_DMA3 = 11;
    this.IRQ_KEYPAD = 12;
    this.IRQ_GAMEPAK = 13;
    this.MASK_VBLANK = 1;
    this.MASK_HBLANK = 2;
    this.MASK_VCOUNTER = 4;
    this.MASK_TIMER0 = 8;
    this.MASK_TIMER1 = 16;
    this.MASK_TIMER2 = 32;
    this.MASK_TIMER3 = 64;
    this.MASK_SIO = 128;
    this.MASK_DMA0 = 256;
    this.MASK_DMA1 = 512;
    this.MASK_DMA2 = 1024;
    this.MASK_DMA3 = 2048;
    this.MASK_KEYPAD = 4096;
    this.MASK_GAMEPAK = 8192;
  };
  var inherit = require_util().inherit;
  var MemoryBlock = require_mmu().MemoryBlock;
  GameBoyAdvanceInterruptHandler.prototype.clear = function() {
    this.enable = false;
    this.enabledIRQs = 0;
    this.interruptFlags = 0;
    this.dma = new Array;
    for (var i2 = 0;i2 < 4; ++i2) {
      this.dma.push({
        source: 0,
        dest: 0,
        count: 0,
        nextSource: 0,
        nextDest: 0,
        nextCount: 0,
        srcControl: 0,
        dstControl: 0,
        repeat: false,
        width: 0,
        drq: false,
        timing: 0,
        doIrq: false,
        enable: false,
        nextIRQ: 0
      });
    }
    this.timersEnabled = 0;
    this.timers = new Array;
    for (var i2 = 0;i2 < 4; ++i2) {
      this.timers.push({
        reload: 0,
        oldReload: 0,
        prescaleBits: 0,
        countUp: false,
        doIrq: false,
        enable: false,
        lastEvent: 0,
        nextEvent: 0,
        overflowInterval: 1
      });
    }
    this.nextEvent = 0;
    this.springIRQ = false;
    this.resetSP();
  };
  GameBoyAdvanceInterruptHandler.prototype.freeze = function() {
    return {
      enable: this.enable,
      enabledIRQs: this.enabledIRQs,
      interruptFlags: this.interruptFlags,
      dma: this.dma,
      timers: this.timers,
      nextEvent: this.nextEvent,
      springIRQ: this.springIRQ
    };
  };
  GameBoyAdvanceInterruptHandler.prototype.defrost = function(frost) {
    this.enable = frost.enable;
    this.enabledIRQs = frost.enabledIRQs;
    this.interruptFlags = frost.interruptFlags;
    this.dma = frost.dma;
    this.timers = frost.timers;
    this.timersEnabled = 0;
    if (this.timers[0].enable) {
      ++this.timersEnabled;
    }
    if (this.timers[1].enable) {
      ++this.timersEnabled;
    }
    if (this.timers[2].enable) {
      ++this.timersEnabled;
    }
    if (this.timers[3].enable) {
      ++this.timersEnabled;
    }
    this.nextEvent = frost.nextEvent;
    this.springIRQ = frost.springIRQ;
  };
  GameBoyAdvanceInterruptHandler.prototype.updateTimers = function() {
    if (this.nextEvent > this.cpu.cycles) {
      return;
    }
    if (this.springIRQ) {
      this.cpu.raiseIRQ();
      this.springIRQ = false;
    }
    this.video.updateTimers(this.cpu);
    this.audio.updateTimers();
    if (this.timersEnabled) {
      var timer = this.timers[0];
      if (timer.enable) {
        if (this.cpu.cycles >= timer.nextEvent) {
          timer.lastEvent = timer.nextEvent;
          timer.nextEvent += timer.overflowInterval;
          this.io.registers[this.io.TM0CNT_LO >> 1] = timer.reload;
          timer.oldReload = timer.reload;
          if (timer.doIrq) {
            this.raiseIRQ(this.IRQ_TIMER0);
          }
          if (this.audio.enabled) {
            if (this.audio.enableChannelA && !this.audio.soundTimerA && this.audio.dmaA >= 0) {
              this.audio.sampleFifoA();
            }
            if (this.audio.enableChannelB && !this.audio.soundTimerB && this.audio.dmaB >= 0) {
              this.audio.sampleFifoB();
            }
          }
          timer = this.timers[1];
          if (timer.countUp) {
            if (++this.io.registers[this.io.TM1CNT_LO >> 1] == 65536) {
              timer.nextEvent = this.cpu.cycles;
            }
          }
        }
      }
      timer = this.timers[1];
      if (timer.enable) {
        if (this.cpu.cycles >= timer.nextEvent) {
          timer.lastEvent = timer.nextEvent;
          timer.nextEvent += timer.overflowInterval;
          if (!timer.countUp || this.io.registers[this.io.TM1CNT_LO >> 1] == 65536) {
            this.io.registers[this.io.TM1CNT_LO >> 1] = timer.reload;
          }
          timer.oldReload = timer.reload;
          if (timer.doIrq) {
            this.raiseIRQ(this.IRQ_TIMER1);
          }
          if (timer.countUp) {
            timer.nextEvent = 0;
          }
          if (this.audio.enabled) {
            if (this.audio.enableChannelA && this.audio.soundTimerA && this.audio.dmaA >= 0) {
              this.audio.sampleFifoA();
            }
            if (this.audio.enableChannelB && this.audio.soundTimerB && this.audio.dmaB >= 0) {
              this.audio.sampleFifoB();
            }
          }
          timer = this.timers[2];
          if (timer.countUp) {
            if (++this.io.registers[this.io.TM2CNT_LO >> 1] == 65536) {
              timer.nextEvent = this.cpu.cycles;
            }
          }
        }
      }
      timer = this.timers[2];
      if (timer.enable) {
        if (this.cpu.cycles >= timer.nextEvent) {
          timer.lastEvent = timer.nextEvent;
          timer.nextEvent += timer.overflowInterval;
          if (!timer.countUp || this.io.registers[this.io.TM2CNT_LO >> 1] == 65536) {
            this.io.registers[this.io.TM2CNT_LO >> 1] = timer.reload;
          }
          timer.oldReload = timer.reload;
          if (timer.doIrq) {
            this.raiseIRQ(this.IRQ_TIMER2);
          }
          if (timer.countUp) {
            timer.nextEvent = 0;
          }
          timer = this.timers[3];
          if (timer.countUp) {
            if (++this.io.registers[this.io.TM3CNT_LO >> 1] == 65536) {
              timer.nextEvent = this.cpu.cycles;
            }
          }
        }
      }
      timer = this.timers[3];
      if (timer.enable) {
        if (this.cpu.cycles >= timer.nextEvent) {
          timer.lastEvent = timer.nextEvent;
          timer.nextEvent += timer.overflowInterval;
          if (!timer.countUp || this.io.registers[this.io.TM3CNT_LO >> 1] == 65536) {
            this.io.registers[this.io.TM3CNT_LO >> 1] = timer.reload;
          }
          timer.oldReload = timer.reload;
          if (timer.doIrq) {
            this.raiseIRQ(this.IRQ_TIMER3);
          }
          if (timer.countUp) {
            timer.nextEvent = 0;
          }
        }
      }
    }
    var dma2 = this.dma[0];
    if (dma2.enable && dma2.doIrq && dma2.nextIRQ && this.cpu.cycles >= dma2.nextIRQ) {
      dma2.nextIRQ = 0;
      this.raiseIRQ(this.IRQ_DMA0);
    }
    dma2 = this.dma[1];
    if (dma2.enable && dma2.doIrq && dma2.nextIRQ && this.cpu.cycles >= dma2.nextIRQ) {
      dma2.nextIRQ = 0;
      this.raiseIRQ(this.IRQ_DMA1);
    }
    dma2 = this.dma[2];
    if (dma2.enable && dma2.doIrq && dma2.nextIRQ && this.cpu.cycles >= dma2.nextIRQ) {
      dma2.nextIRQ = 0;
      this.raiseIRQ(this.IRQ_DMA2);
    }
    dma2 = this.dma[3];
    if (dma2.enable && dma2.doIrq && dma2.nextIRQ && this.cpu.cycles >= dma2.nextIRQ) {
      dma2.nextIRQ = 0;
      this.raiseIRQ(this.IRQ_DMA3);
    }
    this.pollNextEvent();
  };
  GameBoyAdvanceInterruptHandler.prototype.resetSP = function() {
    this.cpu.switchMode(this.cpu.MODE_SUPERVISOR);
    this.cpu.gprs[this.cpu.SP] = 50364384;
    this.cpu.switchMode(this.cpu.MODE_IRQ);
    this.cpu.gprs[this.cpu.SP] = 50364320;
    this.cpu.switchMode(this.cpu.MODE_SYSTEM);
    this.cpu.gprs[this.cpu.SP] = 50364160;
  };
  GameBoyAdvanceInterruptHandler.prototype.swi32 = function(opcode) {
    this.swi(opcode >> 16);
  };
  GameBoyAdvanceInterruptHandler.prototype.swi = function(opcode) {
    if (this.core.mmu.bios.real) {
      this.cpu.raiseTrap();
      return;
    }
    switch (opcode) {
      case 0:
        var mem = this.core.mmu.memory[this.core.mmu.REGION_WORKING_IRAM];
        var flag = mem.loadU8(32762);
        for (var i2 = 32256;i2 < 32768; i2 += 4) {
          mem.store32(i2, 0);
        }
        this.resetSP();
        if (!flag) {
          this.cpu.gprs[this.cpu.LR] = 134217728;
        } else {
          this.cpu.gprs[this.cpu.LR] = 33554432;
        }
        this.cpu.switchExecMode(this.cpu.MODE_ARM);
        this.cpu.instruction.writesPC = true;
        this.cpu.gprs[this.cpu.PC] = this.cpu.gprs[this.cpu.LR];
        break;
      case 1:
        var regions = this.cpu.gprs[0];
        if (regions & 1) {
          this.core.mmu.memory[this.core.mmu.REGION_WORKING_RAM] = new MemoryBlock(this.core.mmu.SIZE_WORKING_RAM, 9);
        }
        if (regions & 2) {
          for (var i2 = 0;i2 < this.core.mmu.SIZE_WORKING_IRAM - 512; i2 += 4) {
            this.core.mmu.memory[this.core.mmu.REGION_WORKING_IRAM].store32(i2, 0);
          }
        }
        if (regions & 28) {
          this.video.renderPath.clearSubsets(this.core.mmu, regions);
        }
        if (regions & 224) {
          this.core.STUB("Unimplemented RegisterRamReset");
        }
        break;
      case 2:
        this.halt();
        break;
      case 5:
        this.cpu.gprs[0] = 1;
        this.cpu.gprs[1] = 1;
      case 4:
        if (!this.enable) {
          this.io.store16(this.io.IME, 1);
        }
        if (!this.cpu.gprs[0] && this.interruptFlags & this.cpu.gprs[1]) {
          return;
        }
        this.dismissIRQs(4294967295);
        this.cpu.raiseTrap();
        break;
      case 6:
        var result = (this.cpu.gprs[0] | 0) / (this.cpu.gprs[1] | 0);
        var mod = (this.cpu.gprs[0] | 0) % (this.cpu.gprs[1] | 0);
        this.cpu.gprs[0] = result | 0;
        this.cpu.gprs[1] = mod | 0;
        this.cpu.gprs[3] = Math.abs(result | 0);
        break;
      case 7:
        var result = (this.cpu.gprs[1] | 0) / (this.cpu.gprs[0] | 0);
        var mod = (this.cpu.gprs[1] | 0) % (this.cpu.gprs[0] | 0);
        this.cpu.gprs[0] = result | 0;
        this.cpu.gprs[1] = mod | 0;
        this.cpu.gprs[3] = Math.abs(result | 0);
        break;
      case 8:
        var root = Math.sqrt(this.cpu.gprs[0]);
        this.cpu.gprs[0] = root | 0;
        break;
      case 10:
        var x = this.cpu.gprs[0] / 16384;
        var y = this.cpu.gprs[1] / 16384;
        this.cpu.gprs[0] = Math.atan2(y, x) / (2 * Math.PI) * 65536;
        break;
      case 11:
        var source = this.cpu.gprs[0];
        var dest = this.cpu.gprs[1];
        var mode = this.cpu.gprs[2];
        var count = mode & 1048575;
        var fill = mode & 16777216;
        var wordsize = mode & 67108864 ? 4 : 2;
        if (fill) {
          if (wordsize == 4) {
            source &= 4294967292;
            dest &= 4294967292;
            var word = this.cpu.mmu.load32(source);
            for (var i2 = 0;i2 < count; ++i2) {
              this.cpu.mmu.store32(dest + (i2 << 2), word);
            }
          } else {
            source &= 4294967294;
            dest &= 4294967294;
            var word = this.cpu.mmu.load16(source);
            for (var i2 = 0;i2 < count; ++i2) {
              this.cpu.mmu.store16(dest + (i2 << 1), word);
            }
          }
        } else {
          if (wordsize == 4) {
            source &= 4294967292;
            dest &= 4294967292;
            for (var i2 = 0;i2 < count; ++i2) {
              var word = this.cpu.mmu.load32(source + (i2 << 2));
              this.cpu.mmu.store32(dest + (i2 << 2), word);
            }
          } else {
            source &= 4294967294;
            dest &= 4294967294;
            for (var i2 = 0;i2 < count; ++i2) {
              var word = this.cpu.mmu.load16(source + (i2 << 1));
              this.cpu.mmu.store16(dest + (i2 << 1), word);
            }
          }
        }
        return;
      case 12:
        var source = this.cpu.gprs[0] & 4294967292;
        var dest = this.cpu.gprs[1] & 4294967292;
        var mode = this.cpu.gprs[2];
        var count = mode & 1048575;
        count = count + 7 >> 3 << 3;
        var fill = mode & 16777216;
        if (fill) {
          var word = this.cpu.mmu.load32(source);
          for (var i2 = 0;i2 < count; ++i2) {
            this.cpu.mmu.store32(dest + (i2 << 2), word);
          }
        } else {
          for (var i2 = 0;i2 < count; ++i2) {
            var word = this.cpu.mmu.load32(source + (i2 << 2));
            this.cpu.mmu.store32(dest + (i2 << 2), word);
          }
        }
        return;
      case 14:
        var i2 = this.cpu.gprs[2];
        var ox, oy;
        var cx, cy;
        var sx, sy;
        var theta;
        var offset = this.cpu.gprs[0];
        var destination = this.cpu.gprs[1];
        var a, b, c, d;
        var rx, ry;
        while (i2--) {
          ox = this.core.mmu.load32(offset) / 256;
          oy = this.core.mmu.load32(offset + 4) / 256;
          cx = this.core.mmu.load16(offset + 8);
          cy = this.core.mmu.load16(offset + 10);
          sx = this.core.mmu.load16(offset + 12) / 256;
          sy = this.core.mmu.load16(offset + 14) / 256;
          theta = (this.core.mmu.loadU16(offset + 16) >> 8) / 128 * Math.PI;
          offset += 20;
          a = d = Math.cos(theta);
          b = c = Math.sin(theta);
          a *= sx;
          b *= -sx;
          c *= sy;
          d *= sy;
          rx = ox - (a * cx + b * cy);
          ry = oy - (c * cx + d * cy);
          this.core.mmu.store16(destination, a * 256 | 0);
          this.core.mmu.store16(destination + 2, b * 256 | 0);
          this.core.mmu.store16(destination + 4, c * 256 | 0);
          this.core.mmu.store16(destination + 6, d * 256 | 0);
          this.core.mmu.store32(destination + 8, rx * 256 | 0);
          this.core.mmu.store32(destination + 12, ry * 256 | 0);
          destination += 16;
        }
        break;
      case 15:
        var i2 = this.cpu.gprs[2];
        var sx, sy;
        var theta;
        var offset = this.cpu.gprs[0];
        var destination = this.cpu.gprs[1];
        var diff = this.cpu.gprs[3];
        var a, b, c, d;
        while (i2--) {
          sx = this.core.mmu.load16(offset) / 256;
          sy = this.core.mmu.load16(offset + 2) / 256;
          theta = (this.core.mmu.loadU16(offset + 4) >> 8) / 128 * Math.PI;
          offset += 6;
          a = d = Math.cos(theta);
          b = c = Math.sin(theta);
          a *= sx;
          b *= -sx;
          c *= sy;
          d *= sy;
          this.core.mmu.store16(destination, a * 256 | 0);
          this.core.mmu.store16(destination + diff, b * 256 | 0);
          this.core.mmu.store16(destination + diff * 2, c * 256 | 0);
          this.core.mmu.store16(destination + diff * 3, d * 256 | 0);
          destination += diff * 4;
        }
        break;
      case 17:
        this.lz77(this.cpu.gprs[0], this.cpu.gprs[1], 1);
        break;
      case 18:
        this.lz77(this.cpu.gprs[0], this.cpu.gprs[1], 2);
        break;
      case 19:
        this.huffman(this.cpu.gprs[0], this.cpu.gprs[1]);
        break;
      case 20:
        this.rl(this.cpu.gprs[0], this.cpu.gprs[1], 1);
        break;
      case 21:
        this.rl(this.cpu.gprs[0], this.cpu.gprs[1], 2);
        break;
      case 31:
        var key = this.cpu.mmu.load32(this.cpu.gprs[0] + 4);
        this.cpu.gprs[0] = key / Math.pow(2, (180 - this.cpu.gprs[1] - this.cpu.gprs[2] / 256) / 12) >>> 0;
        break;
      default:
        throw "Unimplemented software interrupt: 0x" + opcode.toString(16);
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.masterEnable = function(value) {
    this.enable = value;
    if (this.enable && this.enabledIRQs & this.interruptFlags) {
      this.cpu.raiseIRQ();
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.setInterruptsEnabled = function(value) {
    this.enabledIRQs = value;
    if (this.enabledIRQs & this.MASK_SIO) {
      this.core.STUB("Serial I/O interrupts not implemented");
    }
    if (this.enabledIRQs & this.MASK_KEYPAD) {
      this.core.STUB("Keypad interrupts not implemented");
    }
    if (this.enable && this.enabledIRQs & this.interruptFlags) {
      this.cpu.raiseIRQ();
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.pollNextEvent = function() {
    var nextEvent = this.video.nextEvent;
    var test;
    if (this.audio.enabled) {
      test = this.audio.nextEvent;
      if (!nextEvent || test < nextEvent) {
        nextEvent = test;
      }
    }
    if (this.timersEnabled) {
      var timer = this.timers[0];
      test = timer.nextEvent;
      if (timer.enable && test && (!nextEvent || test < nextEvent)) {
        nextEvent = test;
      }
      timer = this.timers[1];
      test = timer.nextEvent;
      if (timer.enable && test && (!nextEvent || test < nextEvent)) {
        nextEvent = test;
      }
      timer = this.timers[2];
      test = timer.nextEvent;
      if (timer.enable && test && (!nextEvent || test < nextEvent)) {
        nextEvent = test;
      }
      timer = this.timers[3];
      test = timer.nextEvent;
      if (timer.enable && test && (!nextEvent || test < nextEvent)) {
        nextEvent = test;
      }
    }
    var dma2 = this.dma[0];
    test = dma2.nextIRQ;
    if (dma2.enable && dma2.doIrq && test && (!nextEvent || test < nextEvent)) {
      nextEvent = test;
    }
    dma2 = this.dma[1];
    test = dma2.nextIRQ;
    if (dma2.enable && dma2.doIrq && test && (!nextEvent || test < nextEvent)) {
      nextEvent = test;
    }
    dma2 = this.dma[2];
    test = dma2.nextIRQ;
    if (dma2.enable && dma2.doIrq && test && (!nextEvent || test < nextEvent)) {
      nextEvent = test;
    }
    dma2 = this.dma[3];
    test = dma2.nextIRQ;
    if (dma2.enable && dma2.doIrq && test && (!nextEvent || test < nextEvent)) {
      nextEvent = test;
    }
    this.core.ASSERT(nextEvent >= this.cpu.cycles, "Next event is before present");
    this.nextEvent = nextEvent;
  };
  GameBoyAdvanceInterruptHandler.prototype.waitForIRQ = function() {
    var timer;
    var irqPending = this.testIRQ() || this.video.hblankIRQ || this.video.vblankIRQ || this.video.vcounterIRQ;
    if (this.timersEnabled) {
      timer = this.timers[0];
      irqPending = irqPending || timer.doIrq;
      timer = this.timers[1];
      irqPending = irqPending || timer.doIrq;
      timer = this.timers[2];
      irqPending = irqPending || timer.doIrq;
      timer = this.timers[3];
      irqPending = irqPending || timer.doIrq;
    }
    if (!irqPending) {
      return false;
    }
    for (;; ) {
      this.pollNextEvent();
      if (!this.nextEvent) {
        return false;
      } else {
        this.cpu.cycles = this.nextEvent;
        this.updateTimers();
        if (this.interruptFlags) {
          return true;
        }
      }
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.testIRQ = function() {
    if (this.enable && this.enabledIRQs & this.interruptFlags) {
      this.springIRQ = true;
      this.nextEvent = this.cpu.cycles;
      return true;
    }
    return false;
  };
  GameBoyAdvanceInterruptHandler.prototype.raiseIRQ = function(irqType) {
    this.interruptFlags |= 1 << irqType;
    this.io.registers[this.io.IF >> 1] = this.interruptFlags;
    if (this.enable && this.enabledIRQs & 1 << irqType) {
      this.cpu.raiseIRQ();
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.dismissIRQs = function(irqMask) {
    this.interruptFlags &= ~irqMask;
    this.io.registers[this.io.IF >> 1] = this.interruptFlags;
  };
  GameBoyAdvanceInterruptHandler.prototype.dmaSetSourceAddress = function(dma2, address) {
    this.dma[dma2].source = address & 4294967294;
  };
  GameBoyAdvanceInterruptHandler.prototype.dmaSetDestAddress = function(dma2, address) {
    this.dma[dma2].dest = address & 4294967294;
  };
  GameBoyAdvanceInterruptHandler.prototype.dmaSetWordCount = function(dma2, count) {
    this.dma[dma2].count = count ? count : dma2 == 3 ? 65536 : 16384;
  };
  GameBoyAdvanceInterruptHandler.prototype.dmaWriteControl = function(dma2, control) {
    var currentDma = this.dma[dma2];
    var wasEnabled = currentDma.enable;
    currentDma.dstControl = (control & 96) >> 5;
    currentDma.srcControl = (control & 384) >> 7;
    currentDma.repeat = !!(control & 512);
    currentDma.width = control & 1024 ? 4 : 2;
    currentDma.drq = !!(control & 2048);
    currentDma.timing = (control & 12288) >> 12;
    currentDma.doIrq = !!(control & 16384);
    currentDma.enable = !!(control & 32768);
    currentDma.nextIRQ = 0;
    if (currentDma.drq) {
      this.core.WARN("DRQ not implemented");
    }
    if (!wasEnabled && currentDma.enable) {
      currentDma.nextSource = currentDma.source;
      currentDma.nextDest = currentDma.dest;
      currentDma.nextCount = currentDma.count;
      this.cpu.mmu.scheduleDma(dma2, currentDma);
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.timerSetReload = function(timer, reload) {
    this.timers[timer].reload = reload & 65535;
  };
  GameBoyAdvanceInterruptHandler.prototype.timerWriteControl = function(timer, control) {
    var currentTimer = this.timers[timer];
    var oldPrescale = currentTimer.prescaleBits;
    switch (control & 3) {
      case 0:
        currentTimer.prescaleBits = 0;
        break;
      case 1:
        currentTimer.prescaleBits = 6;
        break;
      case 2:
        currentTimer.prescaleBits = 8;
        break;
      case 3:
        currentTimer.prescaleBits = 10;
        break;
    }
    currentTimer.countUp = !!(control & 4);
    currentTimer.doIrq = !!(control & 64);
    currentTimer.overflowInterval = 65536 - currentTimer.reload << currentTimer.prescaleBits;
    var wasEnabled = currentTimer.enable;
    currentTimer.enable = !!((control & 128) >> 7 << timer);
    if (!wasEnabled && currentTimer.enable) {
      if (!currentTimer.countUp) {
        currentTimer.lastEvent = this.cpu.cycles;
        currentTimer.nextEvent = this.cpu.cycles + currentTimer.overflowInterval;
      } else {
        currentTimer.nextEvent = 0;
      }
      this.io.registers[this.io.TM0CNT_LO + (timer << 2) >> 1] = currentTimer.reload;
      currentTimer.oldReload = currentTimer.reload;
      ++this.timersEnabled;
    } else if (wasEnabled && !currentTimer.enable) {
      if (!currentTimer.countUp) {
        this.io.registers[this.io.TM0CNT_LO + (timer << 2) >> 1] = currentTimer.oldReload + (this.cpu.cycles - currentTimer.lastEvent) >> oldPrescale;
      }
      --this.timersEnabled;
    } else if (currentTimer.prescaleBits != oldPrescale && !currentTimer.countUp) {
      currentTimer.nextEvent = currentTimer.lastEvent + currentTimer.overflowInterval;
    }
    this.pollNextEvent();
  };
  GameBoyAdvanceInterruptHandler.prototype.timerRead = function(timer) {
    var currentTimer = this.timers[timer];
    if (currentTimer.enable && !currentTimer.countUp) {
      return currentTimer.oldReload + (this.cpu.cycles - currentTimer.lastEvent) >> currentTimer.prescaleBits;
    } else {
      return this.io.registers[this.io.TM0CNT_LO + (timer << 2) >> 1];
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.halt = function() {
    if (!this.enable) {
      throw "Requested HALT when interrupts were disabled!";
    }
    if (!this.waitForIRQ()) {
      throw "Waiting on interrupt forever.";
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.lz77 = function(source, dest, unitsize) {
    var remaining = (this.cpu.mmu.load32(source) & 4294967040) >> 8;
    var blockheader;
    var sPointer = source + 4;
    var dPointer = dest;
    var blocksRemaining = 0;
    var block;
    var disp;
    var bytes;
    var buffer = 0;
    var loaded;
    while (remaining > 0) {
      if (blocksRemaining) {
        if (blockheader & 128) {
          block = this.cpu.mmu.loadU8(sPointer) | this.cpu.mmu.loadU8(sPointer + 1) << 8;
          sPointer += 2;
          disp = dPointer - ((block & 15) << 8 | (block & 65280) >> 8) - 1;
          bytes = ((block & 240) >> 4) + 3;
          while (bytes-- && remaining) {
            loaded = this.cpu.mmu.loadU8(disp++);
            if (unitsize == 2) {
              buffer >>= 8;
              buffer |= loaded << 8;
              if (dPointer & 1) {
                this.cpu.mmu.store16(dPointer - 1, buffer);
              }
            } else {
              this.cpu.mmu.store8(dPointer, loaded);
            }
            --remaining;
            ++dPointer;
          }
        } else {
          loaded = this.cpu.mmu.loadU8(sPointer++);
          if (unitsize == 2) {
            buffer >>= 8;
            buffer |= loaded << 8;
            if (dPointer & 1) {
              this.cpu.mmu.store16(dPointer - 1, buffer);
            }
          } else {
            this.cpu.mmu.store8(dPointer, loaded);
          }
          --remaining;
          ++dPointer;
        }
        blockheader <<= 1;
        --blocksRemaining;
      } else {
        blockheader = this.cpu.mmu.loadU8(sPointer++);
        blocksRemaining = 8;
      }
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.huffman = function(source, dest) {
    source = source & 4294967292;
    var header = this.cpu.mmu.load32(source);
    var remaining = header >> 8;
    var bits = header & 15;
    if (32 % bits) {
      throw "Unimplemented unaligned Huffman";
    }
    var padding = 4 - remaining & 3;
    remaining &= 4294967292;
    var tree = [];
    var treesize = (this.cpu.mmu.loadU8(source + 4) << 1) + 1;
    var block;
    var sPointer = source + 5 + treesize;
    var dPointer = dest & 4294967292;
    var i2;
    for (i2 = 0;i2 < treesize; ++i2) {
      tree.push(this.cpu.mmu.loadU8(source + 5 + i2));
    }
    var node;
    var offset = 0;
    var bitsRemaining;
    var readBits;
    var bitsSeen = 0;
    node = tree[0];
    while (remaining > 0) {
      var bitstream = this.cpu.mmu.load32(sPointer);
      sPointer += 4;
      for (bitsRemaining = 32;bitsRemaining > 0; --bitsRemaining, bitstream <<= 1) {
        if (typeof node === "number") {
          var next = (offset - 1 | 1) + ((node & 63) << 1) + 2;
          node = {
            l: next,
            r: next + 1,
            lTerm: node & 128,
            rTerm: node & 64
          };
          tree[offset] = node;
        }
        if (bitstream & 2147483648) {
          if (node.rTerm) {
            readBits = tree[node.r];
          } else {
            offset = node.r;
            node = tree[node.r];
            continue;
          }
        } else {
          if (node.lTerm) {
            readBits = tree[node.l];
          } else {
            offset = node.l;
            node = tree[offset];
            continue;
          }
        }
        block |= (readBits & (1 << bits) - 1) << bitsSeen;
        bitsSeen += bits;
        offset = 0;
        node = tree[0];
        if (bitsSeen == 32) {
          bitsSeen = 0;
          this.cpu.mmu.store32(dPointer, block);
          dPointer += 4;
          remaining -= 4;
          block = 0;
        }
      }
    }
    if (padding) {
      this.cpu.mmu.store32(dPointer, block);
    }
  };
  GameBoyAdvanceInterruptHandler.prototype.rl = function(source, dest, unitsize) {
    source = source & 4294967292;
    var remaining = (this.cpu.mmu.load32(source) & 4294967040) >> 8;
    var padding = 4 - remaining & 3;
    var blockheader;
    var block;
    var sPointer = source + 4;
    var dPointer = dest;
    var buffer = 0;
    while (remaining > 0) {
      blockheader = this.cpu.mmu.loadU8(sPointer++);
      if (blockheader & 128) {
        blockheader &= 127;
        blockheader += 3;
        block = this.cpu.mmu.loadU8(sPointer++);
        while (blockheader-- && remaining) {
          --remaining;
          if (unitsize == 2) {
            buffer >>= 8;
            buffer |= block << 8;
            if (dPointer & 1) {
              this.cpu.mmu.store16(dPointer - 1, buffer);
            }
          } else {
            this.cpu.mmu.store8(dPointer, block);
          }
          ++dPointer;
        }
      } else {
        blockheader++;
        while (blockheader-- && remaining) {
          --remaining;
          block = this.cpu.mmu.loadU8(sPointer++);
          if (unitsize == 2) {
            buffer >>= 8;
            buffer |= block << 8;
            if (dPointer & 1) {
              this.cpu.mmu.store16(dPointer - 1, buffer);
            }
          } else {
            this.cpu.mmu.store8(dPointer, block);
          }
          ++dPointer;
        }
      }
    }
    while (padding--) {
      this.cpu.mmu.store8(dPointer++, 0);
    }
  };
  module.exports = GameBoyAdvanceInterruptHandler;
});

// js/io.js
var require_io = __commonJS((exports, module) => {
  var GameBoyAdvanceIO = function() {
    this.DISPCNT = 0;
    this.GREENSWP = 2;
    this.DISPSTAT = 4;
    this.VCOUNT = 6;
    this.BG0CNT = 8;
    this.BG1CNT = 10;
    this.BG2CNT = 12;
    this.BG3CNT = 14;
    this.BG0HOFS = 16;
    this.BG0VOFS = 18;
    this.BG1HOFS = 20;
    this.BG1VOFS = 22;
    this.BG2HOFS = 24;
    this.BG2VOFS = 26;
    this.BG3HOFS = 28;
    this.BG3VOFS = 30;
    this.BG2PA = 32;
    this.BG2PB = 34;
    this.BG2PC = 36;
    this.BG2PD = 38;
    this.BG2X_LO = 40;
    this.BG2X_HI = 42;
    this.BG2Y_LO = 44;
    this.BG2Y_HI = 46;
    this.BG3PA = 48;
    this.BG3PB = 50;
    this.BG3PC = 52;
    this.BG3PD = 54;
    this.BG3X_LO = 56;
    this.BG3X_HI = 58;
    this.BG3Y_LO = 60;
    this.BG3Y_HI = 62;
    this.WIN0H = 64;
    this.WIN1H = 66;
    this.WIN0V = 68;
    this.WIN1V = 70;
    this.WININ = 72;
    this.WINOUT = 74;
    this.MOSAIC = 76;
    this.BLDCNT = 80;
    this.BLDALPHA = 82;
    this.BLDY = 84;
    this.SOUND1CNT_LO = 96;
    this.SOUND1CNT_HI = 98;
    this.SOUND1CNT_X = 100;
    this.SOUND2CNT_LO = 104;
    this.SOUND2CNT_HI = 108;
    this.SOUND3CNT_LO = 112;
    this.SOUND3CNT_HI = 114;
    this.SOUND3CNT_X = 116;
    this.SOUND4CNT_LO = 120;
    this.SOUND4CNT_HI = 124;
    this.SOUNDCNT_LO = 128;
    this.SOUNDCNT_HI = 130;
    this.SOUNDCNT_X = 132;
    this.SOUNDBIAS = 136;
    this.WAVE_RAM0_LO = 144;
    this.WAVE_RAM0_HI = 146;
    this.WAVE_RAM1_LO = 148;
    this.WAVE_RAM1_HI = 150;
    this.WAVE_RAM2_LO = 152;
    this.WAVE_RAM2_HI = 154;
    this.WAVE_RAM3_LO = 156;
    this.WAVE_RAM3_HI = 158;
    this.FIFO_A_LO = 160;
    this.FIFO_A_HI = 162;
    this.FIFO_B_LO = 164;
    this.FIFO_B_HI = 166;
    this.DMA0SAD_LO = 176;
    this.DMA0SAD_HI = 178;
    this.DMA0DAD_LO = 180;
    this.DMA0DAD_HI = 182;
    this.DMA0CNT_LO = 184;
    this.DMA0CNT_HI = 186;
    this.DMA1SAD_LO = 188;
    this.DMA1SAD_HI = 190;
    this.DMA1DAD_LO = 192;
    this.DMA1DAD_HI = 194;
    this.DMA1CNT_LO = 196;
    this.DMA1CNT_HI = 198;
    this.DMA2SAD_LO = 200;
    this.DMA2SAD_HI = 202;
    this.DMA2DAD_LO = 204;
    this.DMA2DAD_HI = 206;
    this.DMA2CNT_LO = 208;
    this.DMA2CNT_HI = 210;
    this.DMA3SAD_LO = 212;
    this.DMA3SAD_HI = 214;
    this.DMA3DAD_LO = 216;
    this.DMA3DAD_HI = 218;
    this.DMA3CNT_LO = 220;
    this.DMA3CNT_HI = 222;
    this.TM0CNT_LO = 256;
    this.TM0CNT_HI = 258;
    this.TM1CNT_LO = 260;
    this.TM1CNT_HI = 262;
    this.TM2CNT_LO = 264;
    this.TM2CNT_HI = 266;
    this.TM3CNT_LO = 268;
    this.TM3CNT_HI = 270;
    this.SIODATA32_LO = 288;
    this.SIOMULTI0 = 288;
    this.SIODATA32_HI = 290;
    this.SIOMULTI1 = 290;
    this.SIOMULTI2 = 292;
    this.SIOMULTI3 = 294;
    this.SIOCNT = 296;
    this.SIOMLT_SEND = 298;
    this.SIODATA8 = 298;
    this.RCNT = 308;
    this.JOYCNT = 320;
    this.JOY_RECV = 336;
    this.JOY_TRANS = 340;
    this.JOYSTAT = 344;
    this.KEYINPUT = 304;
    this.KEYCNT = 306;
    this.IE = 512;
    this.IF = 514;
    this.WAITCNT = 516;
    this.IME = 520;
    this.POSTFLG = 768;
    this.HALTCNT = 769;
    this.DEFAULT_DISPCNT = 128;
    this.DEFAULT_SOUNDBIAS = 512;
    this.DEFAULT_BGPA = 1;
    this.DEFAULT_BGPD = 1;
    this.DEFAULT_RCNT = 32768;
  };
  var Serializer = require_util().Serializer;
  GameBoyAdvanceIO.prototype.clear = function() {
    this.registers = new Uint16Array(this.cpu.mmu.SIZE_IO);
    this.registers[this.DISPCNT >> 1] = this.DEFAULT_DISPCNT;
    this.registers[this.SOUNDBIAS >> 1] = this.DEFAULT_SOUNDBIAS;
    this.registers[this.BG2PA >> 1] = this.DEFAULT_BGPA;
    this.registers[this.BG2PD >> 1] = this.DEFAULT_BGPD;
    this.registers[this.BG3PA >> 1] = this.DEFAULT_BGPA;
    this.registers[this.BG3PD >> 1] = this.DEFAULT_BGPD;
    this.registers[this.RCNT >> 1] = this.DEFAULT_RCNT;
  };
  GameBoyAdvanceIO.prototype.freeze = function() {
    return {
      registers: Serializer.prefix(this.registers.buffer)
    };
  };
  GameBoyAdvanceIO.prototype.defrost = function(frost) {
    this.registers = new Uint16Array(frost.registers);
    for (var i2 = 0;i2 <= this.BLDY; i2 += 2) {
      this.store16(this.registers[i2 >> 1]);
    }
  };
  GameBoyAdvanceIO.prototype.load8 = function(offset) {
    throw "Unimplmeneted unaligned I/O access";
  };
  GameBoyAdvanceIO.prototype.load16 = function(offset) {
    return this.loadU16(offset) << 16 >> 16;
  };
  GameBoyAdvanceIO.prototype.load32 = function(offset) {
    offset &= 4294967292;
    switch (offset) {
      case this.DMA0CNT_LO:
      case this.DMA1CNT_LO:
      case this.DMA2CNT_LO:
      case this.DMA3CNT_LO:
        return this.loadU16(offset | 2) << 16;
      case this.IME:
        return this.loadU16(offset) & 65535;
      case this.JOY_RECV:
      case this.JOY_TRANS:
        this.core.STUB("Unimplemented JOY register read: 0x" + offset.toString(16));
        return 0;
    }
    return this.loadU16(offset) | this.loadU16(offset | 2) << 16;
  };
  GameBoyAdvanceIO.prototype.loadU8 = function(offset) {
    var odd = offset & 1;
    var value = this.loadU16(offset & 65534);
    return value >>> (odd << 3) & 255;
  };
  GameBoyAdvanceIO.prototype.loadU16 = function(offset) {
    switch (offset) {
      case this.DISPCNT:
      case this.BG0CNT:
      case this.BG1CNT:
      case this.BG2CNT:
      case this.BG3CNT:
      case this.WININ:
      case this.WINOUT:
      case this.SOUND1CNT_LO:
      case this.SOUND3CNT_LO:
      case this.SOUNDCNT_LO:
      case this.SOUNDCNT_HI:
      case this.SOUNDBIAS:
      case this.BLDCNT:
      case this.BLDALPHA:
      case this.TM0CNT_HI:
      case this.TM1CNT_HI:
      case this.TM2CNT_HI:
      case this.TM3CNT_HI:
      case this.DMA0CNT_HI:
      case this.DMA1CNT_HI:
      case this.DMA2CNT_HI:
      case this.DMA3CNT_HI:
      case this.RCNT:
      case this.WAITCNT:
      case this.IE:
      case this.IF:
      case this.IME:
      case this.POSTFLG:
        break;
      case this.DISPSTAT:
        return this.registers[offset >> 1] | this.video.readDisplayStat();
      case this.VCOUNT:
        return this.video.vcount;
      case this.SOUND1CNT_HI:
      case this.SOUND2CNT_LO:
        return this.registers[offset >> 1] & 65472;
      case this.SOUND1CNT_X:
      case this.SOUND2CNT_HI:
      case this.SOUND3CNT_X:
        return this.registers[offset >> 1] & 16384;
      case this.SOUND3CNT_HI:
        return this.registers[offset >> 1] & 57344;
      case this.SOUND4CNT_LO:
        return this.registers[offset >> 1] & 65280;
      case this.SOUND4CNT_HI:
        return this.registers[offset >> 1] & 16639;
      case this.SOUNDCNT_X:
        this.core.STUB("Unimplemented sound register read: SOUNDCNT_X");
        return this.registers[offset >> 1] | 0;
      case this.TM0CNT_LO:
        return this.cpu.irq.timerRead(0);
      case this.TM1CNT_LO:
        return this.cpu.irq.timerRead(1);
      case this.TM2CNT_LO:
        return this.cpu.irq.timerRead(2);
      case this.TM3CNT_LO:
        return this.cpu.irq.timerRead(3);
      case this.SIOCNT:
        return this.sio.readSIOCNT();
      case this.KEYINPUT:
        this.keypad.pollGamepads();
        return this.keypad.currentDown;
      case this.KEYCNT:
        this.core.STUB("Unimplemented I/O register read: KEYCNT");
        return 0;
      case this.BG0HOFS:
      case this.BG0VOFS:
      case this.BG1HOFS:
      case this.BG1VOFS:
      case this.BG2HOFS:
      case this.BG2VOFS:
      case this.BG3HOFS:
      case this.BG3VOFS:
      case this.BG2PA:
      case this.BG2PB:
      case this.BG2PC:
      case this.BG2PD:
      case this.BG3PA:
      case this.BG3PB:
      case this.BG3PC:
      case this.BG3PD:
      case this.BG2X_LO:
      case this.BG2X_HI:
      case this.BG2Y_LO:
      case this.BG2Y_HI:
      case this.BG3X_LO:
      case this.BG3X_HI:
      case this.BG3Y_LO:
      case this.BG3Y_HI:
      case this.WIN0H:
      case this.WIN1H:
      case this.WIN0V:
      case this.WIN1V:
      case this.BLDY:
      case this.DMA0SAD_LO:
      case this.DMA0SAD_HI:
      case this.DMA0DAD_LO:
      case this.DMA0DAD_HI:
      case this.DMA0CNT_LO:
      case this.DMA1SAD_LO:
      case this.DMA1SAD_HI:
      case this.DMA1DAD_LO:
      case this.DMA1DAD_HI:
      case this.DMA1CNT_LO:
      case this.DMA2SAD_LO:
      case this.DMA2SAD_HI:
      case this.DMA2DAD_LO:
      case this.DMA2DAD_HI:
      case this.DMA2CNT_LO:
      case this.DMA3SAD_LO:
      case this.DMA3SAD_HI:
      case this.DMA3DAD_LO:
      case this.DMA3DAD_HI:
      case this.DMA3CNT_LO:
      case this.FIFO_A_LO:
      case this.FIFO_A_HI:
      case this.FIFO_B_LO:
      case this.FIFO_B_HI:
        this.core.WARN("Read for write-only register: 0x" + offset.toString(16));
        return this.core.mmu.badMemory.loadU16(0);
      case this.MOSAIC:
        this.core.WARN("Read for write-only register: 0x" + offset.toString(16));
        return 0;
      case this.SIOMULTI0:
      case this.SIOMULTI1:
      case this.SIOMULTI2:
      case this.SIOMULTI3:
        return this.sio.read(offset - this.SIOMULTI0 >> 1);
      case this.SIODATA8:
        this.core.STUB("Unimplemented SIO register read: 0x" + offset.toString(16));
        return 0;
      case this.JOYCNT:
      case this.JOYSTAT:
        this.core.STUB("Unimplemented JOY register read: 0x" + offset.toString(16));
        return 0;
      default:
        this.core.WARN("Bad I/O register read: 0x" + offset.toString(16));
        return this.core.mmu.badMemory.loadU16(0);
    }
    return this.registers[offset >> 1];
  };
  GameBoyAdvanceIO.prototype.store8 = function(offset, value) {
    switch (offset) {
      case this.WININ:
        this.value & 63;
        break;
      case this.WININ | 1:
        this.value & 63;
        break;
      case this.WINOUT:
        this.value & 63;
        break;
      case this.WINOUT | 1:
        this.value & 63;
        break;
      case this.SOUND1CNT_LO:
      case this.SOUND1CNT_LO | 1:
      case this.SOUND1CNT_HI:
      case this.SOUND1CNT_HI | 1:
      case this.SOUND1CNT_X:
      case this.SOUND1CNT_X | 1:
      case this.SOUND2CNT_LO:
      case this.SOUND2CNT_LO | 1:
      case this.SOUND2CNT_HI:
      case this.SOUND2CNT_HI | 1:
      case this.SOUND3CNT_LO:
      case this.SOUND3CNT_LO | 1:
      case this.SOUND3CNT_HI:
      case this.SOUND3CNT_HI | 1:
      case this.SOUND3CNT_X:
      case this.SOUND3CNT_X | 1:
      case this.SOUND4CNT_LO:
      case this.SOUND4CNT_LO | 1:
      case this.SOUND4CNT_HI:
      case this.SOUND4CNT_HI | 1:
      case this.SOUNDCNT_LO:
      case this.SOUNDCNT_LO | 1:
      case this.SOUNDCNT_X:
      case this.IF:
      case this.IME:
        break;
      case this.SOUNDBIAS | 1:
        this.STUB_REG("sound", offset);
        break;
      case this.HALTCNT:
        value &= 128;
        if (!value) {
          this.core.irq.halt();
        } else {
          this.core.STUB("Stop");
        }
        return;
      default:
        this.STUB_REG("8-bit I/O", offset);
        break;
    }
    if (offset & 1) {
      value <<= 8;
      value |= this.registers[offset >> 1] & 255;
    } else {
      value &= 255;
      value |= this.registers[offset >> 1] & 65280;
    }
    this.store16(offset & 268435454, value);
  };
  GameBoyAdvanceIO.prototype.store16 = function(offset, value) {
    switch (offset) {
      case this.DISPCNT:
        this.video.renderPath.writeDisplayControl(value);
        break;
      case this.DISPSTAT:
        value &= this.video.DISPSTAT_MASK;
        this.video.writeDisplayStat(value);
        break;
      case this.BG0CNT:
        this.video.renderPath.writeBackgroundControl(0, value);
        break;
      case this.BG1CNT:
        this.video.renderPath.writeBackgroundControl(1, value);
        break;
      case this.BG2CNT:
        this.video.renderPath.writeBackgroundControl(2, value);
        break;
      case this.BG3CNT:
        this.video.renderPath.writeBackgroundControl(3, value);
        break;
      case this.BG0HOFS:
        this.video.renderPath.writeBackgroundHOffset(0, value);
        break;
      case this.BG0VOFS:
        this.video.renderPath.writeBackgroundVOffset(0, value);
        break;
      case this.BG1HOFS:
        this.video.renderPath.writeBackgroundHOffset(1, value);
        break;
      case this.BG1VOFS:
        this.video.renderPath.writeBackgroundVOffset(1, value);
        break;
      case this.BG2HOFS:
        this.video.renderPath.writeBackgroundHOffset(2, value);
        break;
      case this.BG2VOFS:
        this.video.renderPath.writeBackgroundVOffset(2, value);
        break;
      case this.BG3HOFS:
        this.video.renderPath.writeBackgroundHOffset(3, value);
        break;
      case this.BG3VOFS:
        this.video.renderPath.writeBackgroundVOffset(3, value);
        break;
      case this.BG2X_LO:
        this.video.renderPath.writeBackgroundRefX(2, this.registers[offset >> 1 | 1] << 16 | value);
        break;
      case this.BG2X_HI:
        this.video.renderPath.writeBackgroundRefX(2, this.registers[offset >> 1 ^ 1] | value << 16);
        break;
      case this.BG2Y_LO:
        this.video.renderPath.writeBackgroundRefY(2, this.registers[offset >> 1 | 1] << 16 | value);
        break;
      case this.BG2Y_HI:
        this.video.renderPath.writeBackgroundRefY(2, this.registers[offset >> 1 ^ 1] | value << 16);
        break;
      case this.BG2PA:
        this.video.renderPath.writeBackgroundParamA(2, value);
        break;
      case this.BG2PB:
        this.video.renderPath.writeBackgroundParamB(2, value);
        break;
      case this.BG2PC:
        this.video.renderPath.writeBackgroundParamC(2, value);
        break;
      case this.BG2PD:
        this.video.renderPath.writeBackgroundParamD(2, value);
        break;
      case this.BG3X_LO:
        this.video.renderPath.writeBackgroundRefX(3, this.registers[offset >> 1 | 1] << 16 | value);
        break;
      case this.BG3X_HI:
        this.video.renderPath.writeBackgroundRefX(3, this.registers[offset >> 1 ^ 1] | value << 16);
        break;
      case this.BG3Y_LO:
        this.video.renderPath.writeBackgroundRefY(3, this.registers[offset >> 1 | 1] << 16 | value);
        break;
      case this.BG3Y_HI:
        this.video.renderPath.writeBackgroundRefY(3, this.registers[offset >> 1 ^ 1] | value << 16);
        break;
      case this.BG3PA:
        this.video.renderPath.writeBackgroundParamA(3, value);
        break;
      case this.BG3PB:
        this.video.renderPath.writeBackgroundParamB(3, value);
        break;
      case this.BG3PC:
        this.video.renderPath.writeBackgroundParamC(3, value);
        break;
      case this.BG3PD:
        this.video.renderPath.writeBackgroundParamD(3, value);
        break;
      case this.WIN0H:
        this.video.renderPath.writeWin0H(value);
        break;
      case this.WIN1H:
        this.video.renderPath.writeWin1H(value);
        break;
      case this.WIN0V:
        this.video.renderPath.writeWin0V(value);
        break;
      case this.WIN1V:
        this.video.renderPath.writeWin1V(value);
        break;
      case this.WININ:
        value &= 16191;
        this.video.renderPath.writeWinIn(value);
        break;
      case this.WINOUT:
        value &= 16191;
        this.video.renderPath.writeWinOut(value);
        break;
      case this.BLDCNT:
        value &= 32767;
        this.video.renderPath.writeBlendControl(value);
        break;
      case this.BLDALPHA:
        value &= 7967;
        this.video.renderPath.writeBlendAlpha(value);
        break;
      case this.BLDY:
        value &= 31;
        this.video.renderPath.writeBlendY(value);
        break;
      case this.MOSAIC:
        this.video.renderPath.writeMosaic(value);
        break;
      case this.SOUND1CNT_LO:
        value &= 127;
        this.audio.writeSquareChannelSweep(0, value);
        break;
      case this.SOUND1CNT_HI:
        this.audio.writeSquareChannelDLE(0, value);
        break;
      case this.SOUND1CNT_X:
        value &= 51199;
        this.audio.writeSquareChannelFC(0, value);
        value &= ~32768;
        break;
      case this.SOUND2CNT_LO:
        this.audio.writeSquareChannelDLE(1, value);
        break;
      case this.SOUND2CNT_HI:
        value &= 51199;
        this.audio.writeSquareChannelFC(1, value);
        value &= ~32768;
        break;
      case this.SOUND3CNT_LO:
        value &= 224;
        this.audio.writeChannel3Lo(value);
        break;
      case this.SOUND3CNT_HI:
        value &= 57599;
        this.audio.writeChannel3Hi(value);
        break;
      case this.SOUND3CNT_X:
        value &= 51199;
        this.audio.writeChannel3X(value);
        value &= ~32768;
        break;
      case this.SOUND4CNT_LO:
        value &= 65343;
        this.audio.writeChannel4LE(value);
        break;
      case this.SOUND4CNT_HI:
        value &= 49407;
        this.audio.writeChannel4FC(value);
        value &= ~32768;
        break;
      case this.SOUNDCNT_LO:
        value &= 65399;
        this.audio.writeSoundControlLo(value);
        break;
      case this.SOUNDCNT_HI:
        value &= 65295;
        this.audio.writeSoundControlHi(value);
        break;
      case this.SOUNDCNT_X:
        value &= 128;
        this.audio.writeEnable(value);
        break;
      case this.WAVE_RAM0_LO:
      case this.WAVE_RAM0_HI:
      case this.WAVE_RAM1_LO:
      case this.WAVE_RAM1_HI:
      case this.WAVE_RAM2_LO:
      case this.WAVE_RAM2_HI:
      case this.WAVE_RAM3_LO:
      case this.WAVE_RAM3_HI:
        this.audio.writeWaveData(offset - this.WAVE_RAM0_LO, value, 2);
        break;
      case this.DMA0SAD_LO:
      case this.DMA0DAD_LO:
      case this.DMA1SAD_LO:
      case this.DMA1DAD_LO:
      case this.DMA2SAD_LO:
      case this.DMA2DAD_LO:
      case this.DMA3SAD_LO:
      case this.DMA3DAD_LO:
        this.store32(offset, this.registers[(offset >> 1) + 1] << 16 | value);
        return;
      case this.DMA0SAD_HI:
      case this.DMA0DAD_HI:
      case this.DMA1SAD_HI:
      case this.DMA1DAD_HI:
      case this.DMA2SAD_HI:
      case this.DMA2DAD_HI:
      case this.DMA3SAD_HI:
      case this.DMA3DAD_HI:
        this.store32(offset - 2, this.registers[(offset >> 1) - 1] | value << 16);
        return;
      case this.DMA0CNT_LO:
        this.cpu.irq.dmaSetWordCount(0, value);
        break;
      case this.DMA0CNT_HI:
        this.registers[offset >> 1] = value & 65504;
        this.cpu.irq.dmaWriteControl(0, value);
        return;
      case this.DMA1CNT_LO:
        this.cpu.irq.dmaSetWordCount(1, value);
        break;
      case this.DMA1CNT_HI:
        this.registers[offset >> 1] = value & 65504;
        this.cpu.irq.dmaWriteControl(1, value);
        return;
      case this.DMA2CNT_LO:
        this.cpu.irq.dmaSetWordCount(2, value);
        break;
      case this.DMA2CNT_HI:
        this.registers[offset >> 1] = value & 65504;
        this.cpu.irq.dmaWriteControl(2, value);
        return;
      case this.DMA3CNT_LO:
        this.cpu.irq.dmaSetWordCount(3, value);
        break;
      case this.DMA3CNT_HI:
        this.registers[offset >> 1] = value & 65504;
        this.cpu.irq.dmaWriteControl(3, value);
        return;
      case this.TM0CNT_LO:
        this.cpu.irq.timerSetReload(0, value);
        return;
      case this.TM1CNT_LO:
        this.cpu.irq.timerSetReload(1, value);
        return;
      case this.TM2CNT_LO:
        this.cpu.irq.timerSetReload(2, value);
        return;
      case this.TM3CNT_LO:
        this.cpu.irq.timerSetReload(3, value);
        return;
      case this.TM0CNT_HI:
        value &= 199;
        this.cpu.irq.timerWriteControl(0, value);
        break;
      case this.TM1CNT_HI:
        value &= 199;
        this.cpu.irq.timerWriteControl(1, value);
        break;
      case this.TM2CNT_HI:
        value &= 199;
        this.cpu.irq.timerWriteControl(2, value);
        break;
      case this.TM3CNT_HI:
        value &= 199;
        this.cpu.irq.timerWriteControl(3, value);
        break;
      case this.SIOMULTI0:
      case this.SIOMULTI1:
      case this.SIOMULTI2:
      case this.SIOMULTI3:
      case this.SIODATA8:
        this.STUB_REG("SIO", offset);
        break;
      case this.RCNT:
        this.sio.setMode(value >> 12 & 12 | this.registers[this.SIOCNT >> 1] >> 12 & 3);
        this.sio.writeRCNT(value);
        break;
      case this.SIOCNT:
        this.sio.setMode(value >> 12 & 3 | this.registers[this.RCNT >> 1] >> 12 & 12);
        this.sio.writeSIOCNT(value);
        return;
      case this.JOYCNT:
      case this.JOYSTAT:
        this.STUB_REG("JOY", offset);
        break;
      case this.IE:
        value &= 16383;
        this.cpu.irq.setInterruptsEnabled(value);
        break;
      case this.IF:
        this.cpu.irq.dismissIRQs(value);
        return;
      case this.WAITCNT:
        value &= 57343;
        this.cpu.mmu.adjustTimings(value);
        break;
      case this.IME:
        value &= 1;
        this.cpu.irq.masterEnable(value);
        break;
      default:
        this.STUB_REG("I/O", offset);
    }
    this.registers[offset >> 1] = value;
  };
  GameBoyAdvanceIO.prototype.store32 = function(offset, value) {
    switch (offset) {
      case this.BG2X_LO:
        value &= 268435455;
        this.video.renderPath.writeBackgroundRefX(2, value);
        break;
      case this.BG2Y_LO:
        value &= 268435455;
        this.video.renderPath.writeBackgroundRefY(2, value);
        break;
      case this.BG3X_LO:
        value &= 268435455;
        this.video.renderPath.writeBackgroundRefX(3, value);
        break;
      case this.BG3Y_LO:
        value &= 268435455;
        this.video.renderPath.writeBackgroundRefY(3, value);
        break;
      case this.DMA0SAD_LO:
        this.cpu.irq.dmaSetSourceAddress(0, value);
        break;
      case this.DMA0DAD_LO:
        this.cpu.irq.dmaSetDestAddress(0, value);
        break;
      case this.DMA1SAD_LO:
        this.cpu.irq.dmaSetSourceAddress(1, value);
        break;
      case this.DMA1DAD_LO:
        this.cpu.irq.dmaSetDestAddress(1, value);
        break;
      case this.DMA2SAD_LO:
        this.cpu.irq.dmaSetSourceAddress(2, value);
        break;
      case this.DMA2DAD_LO:
        this.cpu.irq.dmaSetDestAddress(2, value);
        break;
      case this.DMA3SAD_LO:
        this.cpu.irq.dmaSetSourceAddress(3, value);
        break;
      case this.DMA3DAD_LO:
        this.cpu.irq.dmaSetDestAddress(3, value);
        break;
      case this.FIFO_A_LO:
        this.audio.appendToFifoA(value);
        return;
      case this.FIFO_B_LO:
        this.audio.appendToFifoB(value);
        return;
      case this.IME:
        this.store16(offset, value & 65535);
        return;
      case this.JOY_RECV:
      case this.JOY_TRANS:
        this.STUB_REG("JOY", offset);
        return;
      default:
        this.store16(offset, value & 65535);
        this.store16(offset | 2, value >>> 16);
        return;
    }
    this.registers[offset >> 1] = value & 65535;
    this.registers[(offset >> 1) + 1] = value >>> 16;
  };
  GameBoyAdvanceIO.prototype.invalidatePage = function(address) {
  };
  GameBoyAdvanceIO.prototype.STUB_REG = function(type, offset) {
    this.core.STUB("Unimplemented " + type + " register write: " + offset.toString(16));
  };
  module.exports = GameBoyAdvanceIO;
});

// js/audio.js
var require_audio = __commonJS((exports, module) => {
  var GameBoyAdvanceAudio = function() {
    var AudioContext = null;
    if (AudioContext) {
      var self2 = this;
      this.context = new AudioContext;
      this.bufferSize = 0;
      this.bufferSize = 4096;
      this.maxSamples = this.bufferSize << 2;
      this.buffers = [new Float32Array(this.maxSamples), new Float32Array(this.maxSamples)];
      this.sampleMask = this.maxSamples - 1;
      if (this.context.createScriptProcessor) {
        this.jsAudio = this.context.createScriptProcessor(this.bufferSize);
      } else {
        this.jsAudio = this.context.createJavaScriptNode(this.bufferSize);
      }
      this.jsAudio.onaudioprocess = function(e) {
        self2.audioProcess(e);
      };
    } else {
      this.context = null;
    }
    this.masterEnable = true;
    this.masterVolume = 1;
    this.SOUND_MAX = 1024;
    this.FIFO_MAX = 512;
    this.PSG_MAX = 128;
  };
  GameBoyAdvanceAudio.prototype.clear = function() {
    this.fifoA = [];
    this.fifoB = [];
    this.fifoASample = 0;
    this.fifoBSample = 0;
    this.enabled = false;
    if (this.context) {
      try {
        this.jsAudio.disconnect(this.context.destination);
      } catch (e) {
      }
    }
    this.enableChannel3 = false;
    this.enableChannel4 = false;
    this.enableChannelA = false;
    this.enableChannelB = false;
    this.enableRightChannelA = false;
    this.enableLeftChannelA = false;
    this.enableRightChannelB = false;
    this.enableLeftChannelB = false;
    this.playingChannel3 = false;
    this.playingChannel4 = false;
    this.volumeLeft = 0;
    this.volumeRight = 0;
    this.ratioChannelA = 1;
    this.ratioChannelB = 1;
    this.enabledLeft = 0;
    this.enabledRight = 0;
    this.dmaA = -1;
    this.dmaB = -1;
    this.soundTimerA = 0;
    this.soundTimerB = 0;
    this.soundRatio = 1;
    this.soundBias = 512;
    this.squareChannels = new Array;
    for (var i2 = 0;i2 < 2; ++i2) {
      this.squareChannels[i2] = {
        enabled: false,
        playing: false,
        sample: 0,
        duty: 0.5,
        increment: 0,
        step: 0,
        initialVolume: 0,
        volume: 0,
        frequency: 0,
        interval: 0,
        sweepSteps: 0,
        sweepIncrement: 0,
        sweepInterval: 0,
        doSweep: false,
        raise: 0,
        lower: 0,
        nextStep: 0,
        timed: false,
        length: 0,
        end: 0
      };
    }
    this.waveData = new Uint8Array(32);
    this.channel3Dimension = 0;
    this.channel3Bank = 0;
    this.channel3Volume = 0;
    this.channel3Interval = 0;
    this.channel3Next = 0;
    this.channel3Length = 0;
    this.channel3Timed = false;
    this.channel3End = 0;
    this.channel3Pointer = 0;
    this.channel3Sample = 0;
    this.cpuFrequency = this.core.irq.FREQUENCY;
    this.channel4 = {
      sample: 0,
      lfsr: 0,
      width: 15,
      interval: this.cpuFrequency / 524288,
      increment: 0,
      step: 0,
      initialVolume: 0,
      volume: 0,
      nextStep: 0,
      timed: false,
      length: 0,
      end: 0
    };
    this.nextEvent = 0;
    this.nextSample = 0;
    this.outputPointer = 0;
    this.samplePointer = 0;
    this.backup = 0;
    this.totalSamples = 0;
    this.sampleRate = 32768;
    this.sampleInterval = this.cpuFrequency / this.sampleRate;
    this.resampleRatio = 1;
    if (this.context) {
      this.resampleRatio = this.sampleRate / this.context.sampleRate;
    }
    this.writeSquareChannelFC(0, 0);
    this.writeSquareChannelFC(1, 0);
    this.writeChannel4FC(0);
  };
  GameBoyAdvanceAudio.prototype.freeze = function() {
    return {
      nextSample: this.nextSample
    };
  };
  GameBoyAdvanceAudio.prototype.defrost = function(frost) {
    this.nextSample = frost.nextSample;
  };
  GameBoyAdvanceAudio.prototype.pause = function(paused) {
    if (this.context) {
      if (paused) {
        try {
          this.jsAudio.disconnect(this.context.destination);
        } catch (e) {
        }
      } else if (this.enabled) {
        this.jsAudio.connect(this.context.destination);
      }
    }
  };
  GameBoyAdvanceAudio.prototype.updateTimers = function() {
    var cycles = this.cpu.cycles;
    if (!this.enabled || cycles < this.nextEvent && cycles < this.nextSample) {
      return;
    }
    if (cycles >= this.nextEvent) {
      var channel = this.squareChannels[0];
      this.nextEvent = Infinity;
      if (channel.playing) {
        this.updateSquareChannel(channel, cycles);
      }
      channel = this.squareChannels[1];
      if (channel.playing) {
        this.updateSquareChannel(channel, cycles);
      }
      if (this.enableChannel3 && this.playingChannel3) {
        if (cycles >= this.channel3Next) {
          if (this.channel3Write) {
            var sample = this.waveData[this.channel3Pointer >> 1];
            this.channel3Sample = ((sample >> ((this.channel3Pointer & 1) << 2) & 15) - 8) / 8;
            this.channel3Pointer = this.channel3Pointer + 1;
            if (this.channel3Dimension && this.channel3Pointer >= 64) {
              this.channel3Pointer -= 64;
            } else if (!this.channel3Bank && this.channel3Pointer >= 32) {
              this.channel3Pointer -= 32;
            } else if (this.channel3Pointer >= 64) {
              this.channel3Pointer -= 32;
            }
          }
          this.channel3Next += this.channel3Interval;
          if (this.channel3Interval && this.nextEvent > this.channel3Next) {
            this.nextEvent = this.channel3Next;
          }
        }
        if (this.channel3Timed && cycles >= this.channel3End) {
          this.playingChannel3 = false;
        }
      }
      if (this.enableChannel4 && this.playingChannel4) {
        if (this.channel4.timed && cycles >= this.channel4.end) {
          this.playingChannel4 = false;
        } else {
          if (cycles >= this.channel4.next) {
            this.channel4.lfsr >>= 1;
            var sample = this.channel4.lfsr & 1;
            this.channel4.lfsr |= (this.channel4.lfsr >> 1 & 1 ^ sample) << this.channel4.width - 1;
            this.channel4.next += this.channel4.interval;
            this.channel4.sample = (sample - 0.5) * 2 * this.channel4.volume;
          }
          this.updateEnvelope(this.channel4, cycles);
          if (this.nextEvent > this.channel4.next) {
            this.nextEvent = this.channel4.next;
          }
          if (this.channel4.timed && this.nextEvent > this.channel4.end) {
            this.nextEvent = this.channel4.end;
          }
        }
      }
    }
    if (cycles >= this.nextSample) {
      this.sample();
      this.nextSample += this.sampleInterval;
    }
    this.nextEvent = Math.ceil(this.nextEvent);
    if (this.nextEvent < cycles || this.nextSample < cycles) {
      this.updateTimers();
    }
  };
  GameBoyAdvanceAudio.prototype.writeEnable = function(value) {
    this.enabled = !!value;
    this.nextEvent = this.cpu.cycles;
    this.nextSample = this.nextEvent;
    this.updateTimers();
    this.core.irq.pollNextEvent();
    if (this.context) {
      if (value) {
        this.jsAudio.connect(this.context.destination);
      } else {
        try {
          this.jsAudio.disconnect(this.context.destination);
        } catch (e) {
        }
      }
    }
  };
  GameBoyAdvanceAudio.prototype.writeSoundControlLo = function(value) {
    this.masterVolumeLeft = value & 7;
    this.masterVolumeRight = value >> 4 & 7;
    this.enabledLeft = value >> 8 & 15;
    this.enabledRight = value >> 12 & 15;
    this.setSquareChannelEnabled(this.squareChannels[0], (this.enabledLeft | this.enabledRight) & 1);
    this.setSquareChannelEnabled(this.squareChannels[1], (this.enabledLeft | this.enabledRight) & 2);
    this.enableChannel3 = (this.enabledLeft | this.enabledRight) & 4;
    this.setChannel4Enabled((this.enabledLeft | this.enabledRight) & 8);
    this.updateTimers();
    this.core.irq.pollNextEvent();
  };
  GameBoyAdvanceAudio.prototype.writeSoundControlHi = function(value) {
    switch (value & 3) {
      case 0:
        this.soundRatio = 0.25;
        break;
      case 1:
        this.soundRatio = 0.5;
        break;
      case 2:
        this.soundRatio = 1;
        break;
    }
    this.ratioChannelA = (((value & 4) >> 2) + 1) * 0.5;
    this.ratioChannelB = (((value & 8) >> 3) + 1) * 0.5;
    this.enableRightChannelA = value & 256;
    this.enableLeftChannelA = value & 512;
    this.enableChannelA = value & 768;
    this.soundTimerA = value & 1024;
    if (value & 2048) {
      this.fifoA = [];
    }
    this.enableRightChannelB = value & 4096;
    this.enableLeftChannelB = value & 8192;
    this.enableChannelB = value & 12288;
    this.soundTimerB = value & 16384;
    if (value & 32768) {
      this.fifoB = [];
    }
  };
  GameBoyAdvanceAudio.prototype.resetSquareChannel = function(channel) {
    if (channel.step) {
      channel.nextStep = this.cpu.cycles + channel.step;
    }
    if (channel.enabled && !channel.playing) {
      channel.raise = this.cpu.cycles;
      channel.lower = channel.raise + channel.duty * channel.interval;
      channel.end = this.cpu.cycles + channel.length;
      this.nextEvent = this.cpu.cycles;
    }
    channel.playing = channel.enabled;
    this.updateTimers();
    this.core.irq.pollNextEvent();
  };
  GameBoyAdvanceAudio.prototype.setSquareChannelEnabled = function(channel, enable) {
    if (!(channel.enabled && channel.playing) && enable) {
      channel.enabled = !!enable;
      this.updateTimers();
      this.core.irq.pollNextEvent();
    } else {
      channel.enabled = !!enable;
    }
  };
  GameBoyAdvanceAudio.prototype.writeSquareChannelSweep = function(channelId, value) {
    var channel = this.squareChannels[channelId];
    channel.sweepSteps = value & 7;
    channel.sweepIncrement = value & 8 ? -1 : 1;
    channel.sweepInterval = (value >> 4 & 7) * this.cpuFrequency / 128;
    channel.doSweep = !!channel.sweepInterval;
    channel.nextSweep = this.cpu.cycles + channel.sweepInterval;
    this.resetSquareChannel(channel);
  };
  GameBoyAdvanceAudio.prototype.writeSquareChannelDLE = function(channelId, value) {
    var channel = this.squareChannels[channelId];
    var duty = value >> 6 & 3;
    switch (duty) {
      case 0:
        channel.duty = 0.125;
        break;
      case 1:
        channel.duty = 0.25;
        break;
      case 2:
        channel.duty = 0.5;
        break;
      case 3:
        channel.duty = 0.75;
        break;
    }
    this.writeChannelLE(channel, value);
    this.resetSquareChannel(channel);
  };
  GameBoyAdvanceAudio.prototype.writeSquareChannelFC = function(channelId, value) {
    var channel = this.squareChannels[channelId];
    var frequency = value & 2047;
    channel.frequency = frequency;
    channel.interval = this.cpuFrequency * (2048 - frequency) / 131072;
    channel.timed = !!(value & 16384);
    if (value & 32768) {
      this.resetSquareChannel(channel);
      channel.volume = channel.initialVolume;
    }
  };
  GameBoyAdvanceAudio.prototype.updateSquareChannel = function(channel, cycles) {
    if (channel.timed && cycles >= channel.end) {
      channel.playing = false;
      return;
    }
    if (channel.doSweep && cycles >= channel.nextSweep) {
      channel.frequency += channel.sweepIncrement * (channel.frequency >> channel.sweepSteps);
      if (channel.frequency < 0) {
        channel.frequency = 0;
      } else if (channel.frequency > 2047) {
        channel.frequency = 2047;
        channel.playing = false;
        return;
      }
      channel.interval = this.cpuFrequency * (2048 - channel.frequency) / 131072;
      channel.nextSweep += channel.sweepInterval;
    }
    if (cycles >= channel.raise) {
      channel.sample = channel.volume;
      channel.lower = channel.raise + channel.duty * channel.interval;
      channel.raise += channel.interval;
    } else if (cycles >= channel.lower) {
      channel.sample = -channel.volume;
      channel.lower += channel.interval;
    }
    this.updateEnvelope(channel, cycles);
    if (this.nextEvent > channel.raise) {
      this.nextEvent = channel.raise;
    }
    if (this.nextEvent > channel.lower) {
      this.nextEvent = channel.lower;
    }
    if (channel.timed && this.nextEvent > channel.end) {
      this.nextEvent = channel.end;
    }
    if (channel.doSweep && this.nextEvent > channel.nextSweep) {
      this.nextEvent = channel.nextSweep;
    }
  };
  GameBoyAdvanceAudio.prototype.writeChannel3Lo = function(value) {
    this.channel3Dimension = value & 32;
    this.channel3Bank = value & 64;
    var enable = value & 128;
    if (!this.channel3Write && enable) {
      this.channel3Write = enable;
      this.resetChannel3();
    } else {
      this.channel3Write = enable;
    }
  };
  GameBoyAdvanceAudio.prototype.writeChannel3Hi = function(value) {
    this.channel3Length = this.cpuFrequency * (256 - (value & 255)) / 256;
    var volume = value >> 13 & 7;
    switch (volume) {
      case 0:
        this.channel3Volume = 0;
        break;
      case 1:
        this.channel3Volume = 1;
        break;
      case 2:
        this.channel3Volume = 0.5;
        break;
      case 3:
        this.channel3Volume = 0.25;
        break;
      default:
        this.channel3Volume = 0.75;
    }
  };
  GameBoyAdvanceAudio.prototype.writeChannel3X = function(value) {
    this.channel3Interval = this.cpuFrequency * (2048 - (value & 2047)) / 2097152;
    this.channel3Timed = !!(value & 16384);
    if (this.channel3Write) {
      this.resetChannel3();
    }
  };
  GameBoyAdvanceAudio.prototype.resetChannel3 = function() {
    this.channel3Next = this.cpu.cycles;
    this.nextEvent = this.channel3Next;
    this.channel3End = this.cpu.cycles + this.channel3Length;
    this.playingChannel3 = this.channel3Write;
    this.updateTimers();
    this.core.irq.pollNextEvent();
  };
  GameBoyAdvanceAudio.prototype.writeWaveData = function(offset, data, width) {
    if (!this.channel3Bank) {
      offset += 16;
    }
    if (width == 2) {
      this.waveData[offset] = data & 255;
      data >>= 8;
      ++offset;
    }
    this.waveData[offset] = data & 255;
  };
  GameBoyAdvanceAudio.prototype.setChannel4Enabled = function(enable) {
    if (!this.enableChannel4 && enable) {
      this.channel4.next = this.cpu.cycles;
      this.channel4.end = this.cpu.cycles + this.channel4.length;
      this.enableChannel4 = true;
      this.playingChannel4 = true;
      this.nextEvent = this.cpu.cycles;
      this.updateEnvelope(this.channel4);
      this.updateTimers();
      this.core.irq.pollNextEvent();
    } else {
      this.enableChannel4 = enable;
    }
  };
  GameBoyAdvanceAudio.prototype.writeChannel4LE = function(value) {
    this.writeChannelLE(this.channel4, value);
    this.resetChannel4();
  };
  GameBoyAdvanceAudio.prototype.writeChannel4FC = function(value) {
    this.channel4.timed = !!(value & 16384);
    var r = value & 7;
    if (!r) {
      r = 0.5;
    }
    var s = value >> 4 & 15;
    var interval = this.cpuFrequency * (r * (2 << s)) / 524288;
    if (interval != this.channel4.interval) {
      this.channel4.interval = interval;
      this.resetChannel4();
    }
    var width = value & 8 ? 7 : 15;
    if (width != this.channel4.width) {
      this.channel4.width = width;
      this.resetChannel4();
    }
    if (value & 32768) {
      this.resetChannel4();
    }
  };
  GameBoyAdvanceAudio.prototype.resetChannel4 = function() {
    if (this.channel4.width == 15) {
      this.channel4.lfsr = 16384;
    } else {
      this.channel4.lfsr = 64;
    }
    this.channel4.volume = this.channel4.initialVolume;
    if (this.channel4.step) {
      this.channel4.nextStep = this.cpu.cycles + this.channel4.step;
    }
    this.channel4.end = this.cpu.cycles + this.channel4.length;
    this.channel4.next = this.cpu.cycles;
    this.nextEvent = this.channel4.next;
    this.playingChannel4 = this.enableChannel4;
    this.updateTimers();
    this.core.irq.pollNextEvent();
  };
  GameBoyAdvanceAudio.prototype.writeChannelLE = function(channel, value) {
    channel.length = this.cpuFrequency * ((64 - (value & 63)) / 256);
    if (value & 2048) {
      channel.increment = 1 / 16;
    } else {
      channel.increment = -1 / 16;
    }
    channel.initialVolume = (value >> 12 & 15) / 16;
    channel.step = this.cpuFrequency * ((value >> 8 & 7) / 64);
  };
  GameBoyAdvanceAudio.prototype.updateEnvelope = function(channel, cycles) {
    if (channel.step) {
      if (cycles >= channel.nextStep) {
        channel.volume += channel.increment;
        if (channel.volume > 1) {
          channel.volume = 1;
        } else if (channel.volume < 0) {
          channel.volume = 0;
        }
        channel.nextStep += channel.step;
      }
      if (this.nextEvent > channel.nextStep) {
        this.nextEvent = channel.nextStep;
      }
    }
  };
  GameBoyAdvanceAudio.prototype.appendToFifoA = function(value) {
    var b;
    if (this.fifoA.length > 28) {
      this.fifoA = this.fifoA.slice(-28);
    }
    for (var i2 = 0;i2 < 4; ++i2) {
      b = (value & 255) << 24;
      value >>= 8;
      this.fifoA.push(b / 2147483648);
    }
  };
  GameBoyAdvanceAudio.prototype.appendToFifoB = function(value) {
    var b;
    if (this.fifoB.length > 28) {
      this.fifoB = this.fifoB.slice(-28);
    }
    for (var i2 = 0;i2 < 4; ++i2) {
      b = (value & 255) << 24;
      value >>= 8;
      this.fifoB.push(b / 2147483648);
    }
  };
  GameBoyAdvanceAudio.prototype.sampleFifoA = function() {
    if (this.fifoA.length <= 16) {
      var dma2 = this.core.irq.dma[this.dmaA];
      dma2.nextCount = 4;
      this.core.mmu.serviceDma(this.dmaA, dma2);
    }
    this.fifoASample = this.fifoA.shift();
  };
  GameBoyAdvanceAudio.prototype.sampleFifoB = function() {
    if (this.fifoB.length <= 16) {
      var dma2 = this.core.irq.dma[this.dmaB];
      dma2.nextCount = 4;
      this.core.mmu.serviceDma(this.dmaB, dma2);
    }
    this.fifoBSample = this.fifoB.shift();
  };
  GameBoyAdvanceAudio.prototype.scheduleFIFODma = function(number, info) {
    switch (info.dest) {
      case this.cpu.mmu.BASE_IO | this.cpu.irq.io.FIFO_A_LO:
        info.dstControl = 2;
        this.dmaA = number;
        break;
      case this.cpu.mmu.BASE_IO | this.cpu.irq.io.FIFO_B_LO:
        info.dstControl = 2;
        this.dmaB = number;
        break;
      default:
        this.core.WARN("Tried to schedule FIFO DMA for non-FIFO destination");
        break;
    }
  };
  GameBoyAdvanceAudio.prototype.sample = function() {
    var sampleLeft = 0;
    var sampleRight = 0;
    var sample;
    var channel;
    channel = this.squareChannels[0];
    if (channel.playing) {
      sample = channel.sample * this.soundRatio * this.PSG_MAX;
      if (this.enabledLeft & 1) {
        sampleLeft += sample;
      }
      if (this.enabledRight & 1) {
        sampleRight += sample;
      }
    }
    channel = this.squareChannels[1];
    if (channel.playing) {
      sample = channel.sample * this.soundRatio * this.PSG_MAX;
      if (this.enabledLeft & 2) {
        sampleLeft += sample;
      }
      if (this.enabledRight & 2) {
        sampleRight += sample;
      }
    }
    if (this.playingChannel3) {
      sample = this.channel3Sample * this.soundRatio * this.channel3Volume * this.PSG_MAX;
      if (this.enabledLeft & 4) {
        sampleLeft += sample;
      }
      if (this.enabledRight & 4) {
        sampleRight += sample;
      }
    }
    if (this.playingChannel4) {
      sample = this.channel4.sample * this.soundRatio * this.PSG_MAX;
      if (this.enabledLeft & 8) {
        sampleLeft += sample;
      }
      if (this.enabledRight & 8) {
        sampleRight += sample;
      }
    }
    if (this.enableChannelA) {
      sample = this.fifoASample * this.FIFO_MAX * this.ratioChannelA;
      if (this.enableLeftChannelA) {
        sampleLeft += sample;
      }
      if (this.enableRightChannelA) {
        sampleRight += sample;
      }
    }
    if (this.enableChannelB) {
      sample = this.fifoBSample * this.FIFO_MAX * this.ratioChannelB;
      if (this.enableLeftChannelB) {
        sampleLeft += sample;
      }
      if (this.enableRightChannelB) {
        sampleRight += sample;
      }
    }
    var samplePointer = this.samplePointer;
    sampleLeft *= this.masterVolume / this.SOUND_MAX;
    sampleLeft = Math.max(Math.min(sampleLeft, 1), -1);
    sampleRight *= this.masterVolume / this.SOUND_MAX;
    sampleRight = Math.max(Math.min(sampleRight, 1), -1);
    if (this.buffers) {
      this.buffers[0][samplePointer] = sampleLeft;
      this.buffers[1][samplePointer] = sampleRight;
    }
    this.samplePointer = samplePointer + 1 & this.sampleMask;
  };
  GameBoyAdvanceAudio.prototype.audioProcess = function(audioProcessingEvent) {
    var left = audioProcessingEvent.outputBuffer.getChannelData(0);
    var right = audioProcessingEvent.outputBuffer.getChannelData(1);
    if (this.masterEnable) {
      var i2;
      var o = this.outputPointer;
      for (i2 = 0;i2 < this.bufferSize; ++i2, o += this.resampleRatio) {
        if (o >= this.maxSamples) {
          o -= this.maxSamples;
        }
        if ((o | 0) == this.samplePointer) {
          ++this.backup;
          break;
        }
        left[i2] = this.buffers[0][o | 0];
        right[i2] = this.buffers[1][o | 0];
      }
      for (;i2 < this.bufferSize; ++i2) {
        left[i2] = 0;
        right[i2] = 0;
      }
      this.outputPointer = o;
      ++this.totalSamples;
    } else {
      for (i2 = 0;i2 < this.bufferSize; ++i2) {
        left[i2] = 0;
        right[i2] = 0;
      }
    }
  };
  module.exports = GameBoyAdvanceAudio;
});

// js/video/software.js
var require_software = __commonJS((exports) => {
  var MemoryAligned16 = function(size) {
    this.buffer = new Uint16Array(size >> 1);
  };
  var GameBoyAdvanceVRAM = function(size) {
    MemoryAligned16.call(this, size);
    this.vram = this.buffer;
  };
  var GameBoyAdvanceOAM = function(size) {
    MemoryAligned16.call(this, size);
    this.oam = this.buffer;
    this.objs = new Array(128);
    for (var i2 = 0;i2 < 128; ++i2) {
      this.objs[i2] = new GameBoyAdvanceOBJ(this, i2);
    }
    this.scalerot = new Array(32);
    for (var i2 = 0;i2 < 32; ++i2) {
      this.scalerot[i2] = {
        a: 1,
        b: 0,
        c: 0,
        d: 1
      };
    }
  };
  var GameBoyAdvancePalette = function() {
    this.colors = [new Array(256), new Array(256)];
    this.adjustedColors = [new Array(256), new Array(256)];
    this.passthroughColors = [
      this.colors[0],
      this.colors[0],
      this.colors[0],
      this.colors[0],
      this.colors[1],
      this.colors[0]
    ];
    this.blendY = 1;
  };
  var GameBoyAdvanceOBJ = function(oam, index) {
    this.TILE_OFFSET = 65536;
    this.oam = oam;
    this.index = index;
    this.x = 0;
    this.y = 0;
    this.scalerot = 0;
    this.doublesize = false;
    this.disable = 1;
    this.mode = 0;
    this.mosaic = false;
    this.multipalette = false;
    this.shape = 0;
    this.scalerotParam = 0;
    this.hflip = 0;
    this.vflip = 0;
    this.tileBase = 0;
    this.priority = 0;
    this.palette = 0;
    this.drawScanline = this.drawScanlineNormal;
    this.pushPixel = GameBoyAdvanceSoftwareRenderer.pushPixel;
    this.cachedWidth = 8;
    this.cachedHeight = 8;
  };
  var GameBoyAdvanceOBJLayer = function(video, index) {
    this.video = video;
    this.bg = false;
    this.index = video.LAYER_OBJ;
    this.priority = index;
    this.enabled = false;
    this.objwin = 0;
  };
  var GameBoyAdvanceSoftwareRenderer = function() {
    this.LAYER_BG0 = 0;
    this.LAYER_BG1 = 1;
    this.LAYER_BG2 = 2;
    this.LAYER_BG3 = 3;
    this.LAYER_OBJ = 4;
    this.LAYER_BACKDROP = 5;
    this.HORIZONTAL_PIXELS = 240;
    this.VERTICAL_PIXELS = 160;
    this.LAYER_MASK = 6;
    this.BACKGROUND_MASK = 1;
    this.TARGET2_MASK = 8;
    this.TARGET1_MASK = 16;
    this.OBJWIN_MASK = 32;
    this.WRITTEN_MASK = 128;
    this.PRIORITY_MASK = this.LAYER_MASK | this.BACKGROUND_MASK;
    this.drawBackdrop = new function(video) {
      this.bg = true;
      this.priority = -1;
      this.index = video.LAYER_BACKDROP;
      this.enabled = true;
      this.drawScanline = function(backing, layer, start, end) {
        for (var x = start;x < end; ++x) {
          if (!(backing.stencil[x] & video.WRITTEN_MASK)) {
            backing.color[x] = video.palette.accessColor(this.index, 0);
            backing.stencil[x] = video.WRITTEN_MASK;
          } else if (backing.stencil[x] & video.TARGET1_MASK) {
            backing.color[x] = video.palette.mix(video.blendB, video.palette.accessColor(this.index, 0), video.blendA, backing.color[x]);
            backing.stencil[x] = video.WRITTEN_MASK;
          }
        }
      };
    }(this);
  };
  MemoryAligned16.prototype.load8 = function(offset) {
    return this.loadU8(offset) << 24 >> 24;
  };
  MemoryAligned16.prototype.load16 = function(offset) {
    return this.loadU16(offset) << 16 >> 16;
  };
  MemoryAligned16.prototype.loadU8 = function(offset) {
    var index = offset >> 1;
    if (offset & 1) {
      return (this.buffer[index] & 65280) >>> 8;
    } else {
      return this.buffer[index] & 255;
    }
  };
  MemoryAligned16.prototype.loadU16 = function(offset) {
    return this.buffer[offset >> 1];
  };
  MemoryAligned16.prototype.load32 = function(offset) {
    return this.buffer[offset >> 1 & ~1] | this.buffer[offset >> 1 | 1] << 16;
  };
  MemoryAligned16.prototype.store8 = function(offset, value) {
    var index = offset >> 1;
    this.store16(offset, value << 8 | value);
  };
  MemoryAligned16.prototype.store16 = function(offset, value) {
    this.buffer[offset >> 1] = value;
  };
  MemoryAligned16.prototype.store32 = function(offset, value) {
    var index = offset >> 1;
    this.store16(offset, this.buffer[index] = value & 65535);
    this.store16(offset + 2, this.buffer[index + 1] = value >>> 16);
  };
  MemoryAligned16.prototype.insert = function(start, data) {
    this.buffer.set(data, start);
  };
  MemoryAligned16.prototype.invalidatePage = function(address) {
  };
  GameBoyAdvanceVRAM.prototype = Object.create(MemoryAligned16.prototype);
  GameBoyAdvanceOAM.prototype = Object.create(MemoryAligned16.prototype);
  GameBoyAdvanceOAM.prototype.overwrite = function(memory) {
    for (var i2 = 0;i2 < this.buffer.byteLength >> 1; ++i2) {
      this.store16(i2 << 1, memory[i2]);
    }
  };
  GameBoyAdvanceOAM.prototype.store16 = function(offset, value) {
    var index = (offset & 1016) >> 3;
    var obj = this.objs[index];
    var scalerot = this.scalerot[index >> 2];
    var layer = obj.priority;
    var disable = obj.disable;
    var y = obj.y;
    switch (offset & 6) {
      case 0:
        obj.y = value & 255;
        var wasScalerot = obj.scalerot;
        obj.scalerot = value & 256;
        if (obj.scalerot) {
          obj.scalerotOam = this.scalerot[obj.scalerotParam];
          obj.doublesize = !!(value & 512);
          obj.disable = 0;
          obj.hflip = 0;
          obj.vflip = 0;
        } else {
          obj.doublesize = false;
          obj.disable = value & 512;
          if (wasScalerot) {
            obj.hflip = obj.scalerotParam & 8;
            obj.vflip = obj.scalerotParam & 16;
          }
        }
        obj.mode = (value & 3072) >> 6;
        obj.mosaic = value & 4096;
        obj.multipalette = value & 8192;
        obj.shape = (value & 49152) >> 14;
        obj.recalcSize();
        break;
      case 2:
        obj.x = value & 511;
        if (obj.scalerot) {
          obj.scalerotParam = (value & 15872) >> 9;
          obj.scalerotOam = this.scalerot[obj.scalerotParam];
          obj.hflip = 0;
          obj.vflip = 0;
          obj.drawScanline = obj.drawScanlineAffine;
        } else {
          obj.hflip = value & 4096;
          obj.vflip = value & 8192;
          obj.drawScanline = obj.drawScanlineNormal;
        }
        obj.size = (value & 49152) >> 14;
        obj.recalcSize();
        break;
      case 4:
        obj.tileBase = value & 1023;
        obj.priority = (value & 3072) >> 10;
        obj.palette = (value & 61440) >> 8;
        break;
      case 6:
        switch (index & 3) {
          case 0:
            scalerot.a = (value << 16) / 16777216;
            break;
          case 1:
            scalerot.b = (value << 16) / 16777216;
            break;
          case 2:
            scalerot.c = (value << 16) / 16777216;
            break;
          case 3:
            scalerot.d = (value << 16) / 16777216;
            break;
        }
        break;
    }
    MemoryAligned16.prototype.store16.call(this, offset, value);
  };
  GameBoyAdvancePalette.prototype.overwrite = function(memory) {
    for (var i2 = 0;i2 < 512; ++i2) {
      this.store16(i2 << 1, memory[i2]);
    }
  };
  GameBoyAdvancePalette.prototype.loadU8 = function(offset) {
    return this.loadU16(offset) >> 8 * (offset & 1) & 255;
  };
  GameBoyAdvancePalette.prototype.loadU16 = function(offset) {
    return this.colors[(offset & 512) >> 9][(offset & 511) >> 1];
  };
  GameBoyAdvancePalette.prototype.load16 = function(offset) {
    return this.loadU16(offset) << 16 >> 16;
  };
  GameBoyAdvancePalette.prototype.load32 = function(offset) {
    return this.loadU16(offset) | this.loadU16(offset + 2) << 16;
  };
  GameBoyAdvancePalette.prototype.store16 = function(offset, value) {
    var type = (offset & 512) >> 9;
    var index = (offset & 511) >> 1;
    this.colors[type][index] = value;
    this.adjustedColors[type][index] = this.adjustColor(value);
  };
  GameBoyAdvancePalette.prototype.store32 = function(offset, value) {
    this.store16(offset, value & 65535);
    this.store16(offset + 2, value >> 16);
  };
  GameBoyAdvancePalette.prototype.invalidatePage = function(address) {
  };
  GameBoyAdvancePalette.prototype.convert16To32 = function(value, input) {
    var r = (value & 31) << 3;
    var g = (value & 992) >> 2;
    var b = (value & 31744) >> 7;
    input[0] = r;
    input[1] = g;
    input[2] = b;
  };
  GameBoyAdvancePalette.prototype.mix = function(aWeight, aColor, bWeight, bColor) {
    var ar = aColor & 31;
    var ag = (aColor & 992) >> 5;
    var ab = (aColor & 31744) >> 10;
    var br = bColor & 31;
    var bg = (bColor & 992) >> 5;
    var bb = (bColor & 31744) >> 10;
    var r = Math.min(aWeight * ar + bWeight * br, 31);
    var g = Math.min(aWeight * ag + bWeight * bg, 31);
    var b = Math.min(aWeight * ab + bWeight * bb, 31);
    return r | g << 5 | b << 10;
  };
  GameBoyAdvancePalette.prototype.makeDarkPalettes = function(layers) {
    if (this.adjustColor != this.adjustColorDark) {
      this.adjustColor = this.adjustColorDark;
      this.resetPalettes();
    }
    this.resetPaletteLayers(layers);
  };
  GameBoyAdvancePalette.prototype.makeBrightPalettes = function(layers) {
    if (this.adjustColor != this.adjustColorBright) {
      this.adjustColor = this.adjustColorBright;
      this.resetPalettes();
    }
    this.resetPaletteLayers(layers);
  };
  GameBoyAdvancePalette.prototype.makeNormalPalettes = function() {
    this.passthroughColors[0] = this.colors[0];
    this.passthroughColors[1] = this.colors[0];
    this.passthroughColors[2] = this.colors[0];
    this.passthroughColors[3] = this.colors[0];
    this.passthroughColors[4] = this.colors[1];
    this.passthroughColors[5] = this.colors[0];
  };
  GameBoyAdvancePalette.prototype.makeSpecialPalette = function(layer) {
    this.passthroughColors[layer] = this.adjustedColors[layer == 4 ? 1 : 0];
  };
  GameBoyAdvancePalette.prototype.makeNormalPalette = function(layer) {
    this.passthroughColors[layer] = this.colors[layer == 4 ? 1 : 0];
  };
  GameBoyAdvancePalette.prototype.resetPaletteLayers = function(layers) {
    if (layers & 1) {
      this.passthroughColors[0] = this.adjustedColors[0];
    } else {
      this.passthroughColors[0] = this.colors[0];
    }
    if (layers & 2) {
      this.passthroughColors[1] = this.adjustedColors[0];
    } else {
      this.passthroughColors[1] = this.colors[0];
    }
    if (layers & 4) {
      this.passthroughColors[2] = this.adjustedColors[0];
    } else {
      this.passthroughColors[2] = this.colors[0];
    }
    if (layers & 8) {
      this.passthroughColors[3] = this.adjustedColors[0];
    } else {
      this.passthroughColors[3] = this.colors[0];
    }
    if (layers & 16) {
      this.passthroughColors[4] = this.adjustedColors[1];
    } else {
      this.passthroughColors[4] = this.colors[1];
    }
    if (layers & 32) {
      this.passthroughColors[5] = this.adjustedColors[0];
    } else {
      this.passthroughColors[5] = this.colors[0];
    }
  };
  GameBoyAdvancePalette.prototype.resetPalettes = function() {
    var i2;
    var outPalette = this.adjustedColors[0];
    var inPalette = this.colors[0];
    for (i2 = 0;i2 < 256; ++i2) {
      outPalette[i2] = this.adjustColor(inPalette[i2]);
    }
    outPalette = this.adjustedColors[1];
    inPalette = this.colors[1];
    for (i2 = 0;i2 < 256; ++i2) {
      outPalette[i2] = this.adjustColor(inPalette[i2]);
    }
  };
  GameBoyAdvancePalette.prototype.accessColor = function(layer, index) {
    return this.passthroughColors[layer][index];
  };
  GameBoyAdvancePalette.prototype.adjustColorDark = function(color) {
    var r = color & 31;
    var g = (color & 992) >> 5;
    var b = (color & 31744) >> 10;
    r = r - r * this.blendY;
    g = g - g * this.blendY;
    b = b - b * this.blendY;
    return r | g << 5 | b << 10;
  };
  GameBoyAdvancePalette.prototype.adjustColorBright = function(color) {
    var r = color & 31;
    var g = (color & 992) >> 5;
    var b = (color & 31744) >> 10;
    r = r + (31 - r) * this.blendY;
    g = g + (31 - g) * this.blendY;
    b = b + (31 - b) * this.blendY;
    return r | g << 5 | b << 10;
  };
  GameBoyAdvancePalette.prototype.adjustColor = GameBoyAdvancePalette.prototype.adjustColorBright;
  GameBoyAdvancePalette.prototype.setBlendY = function(y) {
    if (this.blendY != y) {
      this.blendY = y;
      this.resetPalettes();
    }
  };
  GameBoyAdvanceOBJ.prototype.drawScanlineNormal = function(backing, y, yOff, start, end) {
    var video = this.oam.video;
    var x;
    var underflow;
    var offset;
    var mask = this.mode | video.target2[video.LAYER_OBJ] | this.priority << 1;
    if (this.mode == 16) {
      mask |= video.TARGET1_MASK;
    }
    if (video.blendMode == 1 && video.alphaEnabled) {
      mask |= video.target1[video.LAYER_OBJ];
    }
    var totalWidth = this.cachedWidth;
    if (this.x < video.HORIZONTAL_PIXELS) {
      if (this.x < start) {
        underflow = start - this.x;
        offset = start;
      } else {
        underflow = 0;
        offset = this.x;
      }
      if (end < this.cachedWidth + this.x) {
        totalWidth = end - this.x;
      }
    } else {
      underflow = start + 512 - this.x;
      offset = start;
      if (end < this.cachedWidth - underflow) {
        totalWidth = end;
      }
    }
    var localX;
    var localY;
    if (!this.vflip) {
      localY = y - yOff;
    } else {
      localY = this.cachedHeight - y + yOff - 1;
    }
    var localYLo = localY & 7;
    var mosaicX;
    var tileOffset;
    var paletteShift = this.multipalette ? 1 : 0;
    if (video.objCharacterMapping) {
      tileOffset = (localY & 504) * this.cachedWidth >> 6;
    } else {
      tileOffset = (localY & 504) << 2 - paletteShift;
    }
    if (this.mosaic) {
      mosaicX = video.objMosaicX - 1 - (video.objMosaicX + offset - 1) % video.objMosaicX;
      offset += mosaicX;
      underflow += mosaicX;
    }
    if (!this.hflip) {
      localX = underflow;
    } else {
      localX = this.cachedWidth - underflow - 1;
    }
    var tileRow2 = video.accessTile(this.TILE_OFFSET + (x & 4) * paletteShift, this.tileBase + (tileOffset << paletteShift) + ((localX & 504) >> 3 - paletteShift), localYLo << paletteShift);
    for (x = underflow;x < totalWidth; ++x) {
      mosaicX = this.mosaic ? offset % video.objMosaicX : 0;
      if (!this.hflip) {
        localX = x - mosaicX;
      } else {
        localX = this.cachedWidth - (x - mosaicX) - 1;
      }
      if (!paletteShift) {
        if (!(x & 7) || this.mosaic && !mosaicX) {
          tileRow2 = video.accessTile(this.TILE_OFFSET, this.tileBase + tileOffset + (localX >> 3), localYLo);
        }
      } else {
        if (!(x & 3) || this.mosaic && !mosaicX) {
          tileRow2 = video.accessTile(this.TILE_OFFSET + (localX & 4), this.tileBase + (tileOffset << 1) + ((localX & 504) >> 2), localYLo << 1);
        }
      }
      this.pushPixel(video.LAYER_OBJ, this, video, tileRow2, localX & 7, offset, backing, mask, false);
      offset++;
    }
  };
  GameBoyAdvanceOBJ.prototype.drawScanlineAffine = function(backing, y, yOff, start, end) {
    var video = this.oam.video;
    var x;
    var underflow;
    var offset;
    var mask = this.mode | video.target2[video.LAYER_OBJ] | this.priority << 1;
    if (this.mode == 16) {
      mask |= video.TARGET1_MASK;
    }
    if (video.blendMode == 1 && video.alphaEnabled) {
      mask |= video.target1[video.LAYER_OBJ];
    }
    var localX;
    var localY;
    var yDiff = y - yOff;
    var tileOffset;
    var paletteShift = this.multipalette ? 1 : 0;
    var totalWidth = this.cachedWidth << this.doublesize;
    var totalHeight = this.cachedHeight << this.doublesize;
    var drawWidth = totalWidth;
    if (drawWidth > video.HORIZONTAL_PIXELS) {
      totalWidth = video.HORIZONTAL_PIXELS;
    }
    if (this.x < video.HORIZONTAL_PIXELS) {
      if (this.x < start) {
        underflow = start - this.x;
        offset = start;
      } else {
        underflow = 0;
        offset = this.x;
      }
      if (end < drawWidth + this.x) {
        drawWidth = end - this.x;
      }
    } else {
      underflow = start + 512 - this.x;
      offset = start;
      if (end < drawWidth - underflow) {
        drawWidth = end;
      }
    }
    for (x = underflow;x < drawWidth; ++x) {
      localX = this.scalerotOam.a * (x - (totalWidth >> 1)) + this.scalerotOam.b * (yDiff - (totalHeight >> 1)) + (this.cachedWidth >> 1);
      localY = this.scalerotOam.c * (x - (totalWidth >> 1)) + this.scalerotOam.d * (yDiff - (totalHeight >> 1)) + (this.cachedHeight >> 1);
      if (this.mosaic) {
        localX -= x % video.objMosaicX * this.scalerotOam.a + y % video.objMosaicY * this.scalerotOam.b;
        localY -= x % video.objMosaicX * this.scalerotOam.c + y % video.objMosaicY * this.scalerotOam.d;
      }
      if (localX < 0 || localX >= this.cachedWidth || localY < 0 || localY >= this.cachedHeight) {
        offset++;
        continue;
      }
      if (video.objCharacterMapping) {
        tileOffset = (localY & 504) * this.cachedWidth >> 6;
      } else {
        tileOffset = (localY & 504) << 2 - paletteShift;
      }
      tileRow = video.accessTile(this.TILE_OFFSET + (localX & 4) * paletteShift, this.tileBase + (tileOffset << paletteShift) + ((localX & 504) >> 3 - paletteShift), (localY & 7) << paletteShift);
      this.pushPixel(video.LAYER_OBJ, this, video, tileRow, localX & 7, offset, backing, mask, false);
      offset++;
    }
  };
  GameBoyAdvanceOBJ.prototype.recalcSize = function() {
    switch (this.shape) {
      case 0:
        this.cachedHeight = this.cachedWidth = 8 << this.size;
        break;
      case 1:
        switch (this.size) {
          case 0:
            this.cachedHeight = 8;
            this.cachedWidth = 16;
            break;
          case 1:
            this.cachedHeight = 8;
            this.cachedWidth = 32;
            break;
          case 2:
            this.cachedHeight = 16;
            this.cachedWidth = 32;
            break;
          case 3:
            this.cachedHeight = 32;
            this.cachedWidth = 64;
            break;
        }
        break;
      case 2:
        switch (this.size) {
          case 0:
            this.cachedHeight = 16;
            this.cachedWidth = 8;
            break;
          case 1:
            this.cachedHeight = 32;
            this.cachedWidth = 8;
            break;
          case 2:
            this.cachedHeight = 32;
            this.cachedWidth = 16;
            break;
          case 3:
            this.cachedHeight = 64;
            this.cachedWidth = 32;
            break;
        }
        break;
      default:
    }
  };
  GameBoyAdvanceOBJLayer.prototype.drawScanline = function(backing, layer, start, end) {
    var y = this.video.vcount;
    var wrappedY;
    var mosaicY;
    var obj;
    if (start >= end) {
      return;
    }
    var objs = this.video.oam.objs;
    for (var i2 = 0;i2 < objs.length; ++i2) {
      obj = objs[i2];
      if (obj.disable) {
        continue;
      }
      if ((obj.mode & this.video.OBJWIN_MASK) != this.objwin) {
        continue;
      }
      if (!(obj.mode & this.video.OBJWIN_MASK) && this.priority != obj.priority) {
        continue;
      }
      if (obj.y < this.video.VERTICAL_PIXELS) {
        wrappedY = obj.y;
      } else {
        wrappedY = obj.y - 256;
      }
      var totalHeight;
      if (!obj.scalerot) {
        totalHeight = obj.cachedHeight;
      } else {
        totalHeight = obj.cachedHeight << obj.doublesize;
      }
      if (!obj.mosaic) {
        mosaicY = y;
      } else {
        mosaicY = y - y % this.video.objMosaicY;
      }
      if (wrappedY <= y && wrappedY + totalHeight > y) {
        obj.drawScanline(backing, mosaicY, wrappedY, start, end);
      }
    }
  };
  GameBoyAdvanceOBJLayer.prototype.objComparator = function(a, b) {
    return a.index - b.index;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.clear = function(mmu) {
    this.palette = new GameBoyAdvancePalette;
    this.vram = new GameBoyAdvanceVRAM(mmu.SIZE_VRAM);
    this.oam = new GameBoyAdvanceOAM(mmu.SIZE_OAM);
    this.oam.video = this;
    this.objLayers = [
      new GameBoyAdvanceOBJLayer(this, 0),
      new GameBoyAdvanceOBJLayer(this, 1),
      new GameBoyAdvanceOBJLayer(this, 2),
      new GameBoyAdvanceOBJLayer(this, 3)
    ];
    this.objwinLayer = new GameBoyAdvanceOBJLayer(this, 4);
    this.objwinLayer.objwin = this.OBJWIN_MASK;
    this.backgroundMode = 0;
    this.displayFrameSelect = 0;
    this.hblankIntervalFree = 0;
    this.objCharacterMapping = 0;
    this.forcedBlank = 1;
    this.win0 = 0;
    this.win1 = 0;
    this.objwin = 0;
    this.vcount = -1;
    this.win0Left = 0;
    this.win0Right = 240;
    this.win1Left = 0;
    this.win1Right = 240;
    this.win0Top = 0;
    this.win0Bottom = 160;
    this.win1Top = 0;
    this.win1Bottom = 160;
    this.windows = new Array;
    for (var i2 = 0;i2 < 4; ++i2) {
      this.windows.push({
        enabled: [false, false, false, false, false, true],
        special: 0
      });
    }
    this.target1 = new Array(5);
    this.target2 = new Array(5);
    this.blendMode = 0;
    this.blendA = 0;
    this.blendB = 0;
    this.blendY = 0;
    this.bgMosaicX = 1;
    this.bgMosaicY = 1;
    this.objMosaicX = 1;
    this.objMosaicY = 1;
    this.lastHblank = 0;
    this.nextHblank = this.HDRAW_LENGTH;
    this.nextEvent = this.nextHblank;
    this.nextHblankIRQ = 0;
    this.nextVblankIRQ = 0;
    this.nextVcounterIRQ = 0;
    this.bg = new Array;
    for (var i2 = 0;i2 < 4; ++i2) {
      this.bg.push({
        bg: true,
        index: i2,
        enabled: false,
        video: this,
        vram: this.vram,
        priority: 0,
        charBase: 0,
        mosaic: false,
        multipalette: false,
        screenBase: 0,
        overflow: 0,
        size: 0,
        x: 0,
        y: 0,
        refx: 0,
        refy: 0,
        dx: 1,
        dmx: 0,
        dy: 0,
        dmy: 1,
        sx: 0,
        sy: 0,
        pushPixel: GameBoyAdvanceSoftwareRenderer.pushPixel,
        drawScanline: this.drawScanlineBGMode0
      });
    }
    this.bgModes = [
      this.drawScanlineBGMode0,
      this.drawScanlineBGMode2,
      this.drawScanlineBGMode2,
      this.drawScanlineBGMode3,
      this.drawScanlineBGMode4,
      this.drawScanlineBGMode5
    ];
    this.drawLayers = [
      this.bg[0],
      this.bg[1],
      this.bg[2],
      this.bg[3],
      this.objLayers[0],
      this.objLayers[1],
      this.objLayers[2],
      this.objLayers[3],
      this.objwinLayer,
      this.drawBackdrop
    ];
    objwinActive = false;
    this.alphaEnabled = false;
    this.scanline = {
      color: new Uint16Array(this.HORIZONTAL_PIXELS),
      stencil: new Uint8Array(this.HORIZONTAL_PIXELS)
    };
    this.sharedColor = [0, 0, 0];
    this.sharedMap = {
      tile: 0,
      hflip: false,
      vflip: false,
      palette: 0
    };
  };
  GameBoyAdvanceSoftwareRenderer.prototype.clearSubsets = function(mmu, regions) {
    if (regions & 4) {
      this.palette.overwrite(new Uint16Array(mmu.SIZE_PALETTE >> 1));
    }
    if (regions & 8) {
      this.vram.insert(0, new Uint16Array(mmu.SIZE_VRAM >> 1));
    }
    if (regions & 16) {
      this.oam.overwrite(new Uint16Array(mmu.SIZE_OAM >> 1));
      this.oam.video = this;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.freeze = function() {
  };
  GameBoyAdvanceSoftwareRenderer.prototype.defrost = function(frost) {
  };
  GameBoyAdvanceSoftwareRenderer.prototype.setBacking = function(backing) {
    this.pixelData = backing;
    for (var offset = 0;offset < this.HORIZONTAL_PIXELS * this.VERTICAL_PIXELS * 4; ) {
      this.pixelData.data[offset++] = 255;
      this.pixelData.data[offset++] = 255;
      this.pixelData.data[offset++] = 255;
      this.pixelData.data[offset++] = 255;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeDisplayControl = function(value) {
    this.backgroundMode = value & 7;
    this.displayFrameSelect = value & 16;
    this.hblankIntervalFree = value & 32;
    this.objCharacterMapping = value & 64;
    this.forcedBlank = value & 128;
    this.bg[0].enabled = value & 256;
    this.bg[1].enabled = value & 512;
    this.bg[2].enabled = value & 1024;
    this.bg[3].enabled = value & 2048;
    this.objLayers[0].enabled = value & 4096;
    this.objLayers[1].enabled = value & 4096;
    this.objLayers[2].enabled = value & 4096;
    this.objLayers[3].enabled = value & 4096;
    this.win0 = value & 8192;
    this.win1 = value & 16384;
    this.objwin = value & 32768;
    this.objwinLayer.enabled = value & 4096 && value & 32768;
    this.bg[2].multipalette &= ~1;
    this.bg[3].multipalette &= ~1;
    if (this.backgroundMode > 0) {
      this.bg[2].multipalette |= 1;
    }
    if (this.backgroundMode == 2) {
      this.bg[3].multipalette |= 1;
    }
    this.resetLayers();
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundControl = function(bg, value) {
    var bgData = this.bg[bg];
    bgData.priority = value & 3;
    bgData.charBase = (value & 12) << 12;
    bgData.mosaic = value & 64;
    bgData.multipalette &= ~128;
    if (bg < 2 || this.backgroundMode == 0) {
      bgData.multipalette |= value & 128;
    }
    bgData.screenBase = (value & 7936) << 3;
    bgData.overflow = value & 8192;
    bgData.size = (value & 49152) >> 14;
    this.drawLayers.sort(this.layerComparator);
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundHOffset = function(bg, value) {
    this.bg[bg].x = value & 511;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundVOffset = function(bg, value) {
    this.bg[bg].y = value & 511;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundRefX = function(bg, value) {
    this.bg[bg].refx = (value << 4) / 4096;
    this.bg[bg].sx = this.bg[bg].refx;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundRefY = function(bg, value) {
    this.bg[bg].refy = (value << 4) / 4096;
    this.bg[bg].sy = this.bg[bg].refy;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundParamA = function(bg, value) {
    this.bg[bg].dx = (value << 16) / 16777216;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundParamB = function(bg, value) {
    this.bg[bg].dmx = (value << 16) / 16777216;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundParamC = function(bg, value) {
    this.bg[bg].dy = (value << 16) / 16777216;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBackgroundParamD = function(bg, value) {
    this.bg[bg].dmy = (value << 16) / 16777216;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeWin0H = function(value) {
    this.win0Left = (value & 65280) >> 8;
    this.win0Right = Math.min(this.HORIZONTAL_PIXELS, value & 255);
    if (this.win0Left > this.win0Right) {
      this.win0Right = this.HORIZONTAL_PIXELS;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeWin1H = function(value) {
    this.win1Left = (value & 65280) >> 8;
    this.win1Right = Math.min(this.HORIZONTAL_PIXELS, value & 255);
    if (this.win1Left > this.win1Right) {
      this.win1Right = this.HORIZONTAL_PIXELS;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeWin0V = function(value) {
    this.win0Top = (value & 65280) >> 8;
    this.win0Bottom = Math.min(this.VERTICAL_PIXELS, value & 255);
    if (this.win0Top > this.win0Bottom) {
      this.win0Bottom = this.VERTICAL_PIXELS;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeWin1V = function(value) {
    this.win1Top = (value & 65280) >> 8;
    this.win1Bottom = Math.min(this.VERTICAL_PIXELS, value & 255);
    if (this.win1Top > this.win1Bottom) {
      this.win1Bottom = this.VERTICAL_PIXELS;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeWindow = function(index, value) {
    var window2 = this.windows[index];
    window2.enabled[0] = value & 1;
    window2.enabled[1] = value & 2;
    window2.enabled[2] = value & 4;
    window2.enabled[3] = value & 8;
    window2.enabled[4] = value & 16;
    window2.special = value & 32;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeWinIn = function(value) {
    this.writeWindow(0, value);
    this.writeWindow(1, value >> 8);
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeWinOut = function(value) {
    this.writeWindow(2, value);
    this.writeWindow(3, value >> 8);
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBlendControl = function(value) {
    this.target1[0] = !!(value & 1) * this.TARGET1_MASK;
    this.target1[1] = !!(value & 2) * this.TARGET1_MASK;
    this.target1[2] = !!(value & 4) * this.TARGET1_MASK;
    this.target1[3] = !!(value & 8) * this.TARGET1_MASK;
    this.target1[4] = !!(value & 16) * this.TARGET1_MASK;
    this.target1[5] = !!(value & 32) * this.TARGET1_MASK;
    this.target2[0] = !!(value & 256) * this.TARGET2_MASK;
    this.target2[1] = !!(value & 512) * this.TARGET2_MASK;
    this.target2[2] = !!(value & 1024) * this.TARGET2_MASK;
    this.target2[3] = !!(value & 2048) * this.TARGET2_MASK;
    this.target2[4] = !!(value & 4096) * this.TARGET2_MASK;
    this.target2[5] = !!(value & 8192) * this.TARGET2_MASK;
    this.blendMode = (value & 192) >> 6;
    switch (this.blendMode) {
      case 1:
      case 0:
        this.palette.makeNormalPalettes();
        break;
      case 2:
        this.palette.makeBrightPalettes(value & 63);
        break;
      case 3:
        this.palette.makeDarkPalettes(value & 63);
        break;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.setBlendEnabled = function(layer, enabled, override) {
    this.alphaEnabled = enabled && override == 1;
    if (enabled) {
      switch (override) {
        case 1:
        case 0:
          this.palette.makeNormalPalette(layer);
          break;
        case 2:
        case 3:
          this.palette.makeSpecialPalette(layer);
          break;
      }
    } else {
      this.palette.makeNormalPalette(layer);
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBlendAlpha = function(value) {
    this.blendA = (value & 31) / 16;
    if (this.blendA > 1) {
      this.blendA = 1;
    }
    this.blendB = ((value & 7936) >> 8) / 16;
    if (this.blendB > 1) {
      this.blendB = 1;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeBlendY = function(value) {
    this.blendY = value;
    this.palette.setBlendY(value >= 16 ? 1 : value / 16);
  };
  GameBoyAdvanceSoftwareRenderer.prototype.writeMosaic = function(value) {
    this.bgMosaicX = (value & 15) + 1;
    this.bgMosaicY = (value >> 4 & 15) + 1;
    this.objMosaicX = (value >> 8 & 15) + 1;
    this.objMosaicY = (value >> 12 & 15) + 1;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.resetLayers = function() {
    if (this.backgroundMode > 1) {
      this.bg[0].enabled = false;
      this.bg[1].enabled = false;
    }
    if (this.bg[2].enabled) {
      this.bg[2].drawScanline = this.bgModes[this.backgroundMode];
    }
    if (this.backgroundMode == 0 || this.backgroundMode == 2) {
      if (this.bg[3].enabled) {
        this.bg[3].drawScanline = this.bgModes[this.backgroundMode];
      }
    } else {
      this.bg[3].enabled = false;
    }
    this.drawLayers.sort(this.layerComparator);
  };
  GameBoyAdvanceSoftwareRenderer.prototype.layerComparator = function(a, b) {
    var diff = b.priority - a.priority;
    if (!diff) {
      if (a.bg && !b.bg) {
        return -1;
      } else if (!a.bg && b.bg) {
        return 1;
      }
      return b.index - a.index;
    }
    return diff;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.accessMapMode0 = function(base, size, x, yBase, out) {
    var offset = base + (x >> 2 & 62) + yBase;
    if (size & 1) {
      offset += (x & 256) << 3;
    }
    var mem = this.vram.loadU16(offset);
    out.tile = mem & 1023;
    out.hflip = mem & 1024;
    out.vflip = mem & 2048;
    out.palette = (mem & 61440) >> 8;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.accessMapMode1 = function(base, size, x, yBase, out) {
    var offset = base + (x >> 3) + yBase;
    out.tile = this.vram.loadU8(offset);
  };
  GameBoyAdvanceSoftwareRenderer.prototype.accessTile = function(base, tile, y) {
    var offset = base + (tile << 5);
    offset |= y << 2;
    return this.vram.load32(offset);
  };
  GameBoyAdvanceSoftwareRenderer.pushPixel = function(layer, map, video, row, x, offset, backing, mask, raw) {
    var index;
    if (!raw) {
      if (this.multipalette) {
        index = row >> (x << 3) & 255;
      } else {
        index = row >> (x << 2) & 15;
      }
      if (!index) {
        return;
      } else if (!this.multipalette) {
        index |= map.palette;
      }
    }
    var stencil = video.WRITTEN_MASK;
    var oldStencil = backing.stencil[offset];
    var blend = video.blendMode;
    if (video.objwinActive) {
      if (oldStencil & video.OBJWIN_MASK) {
        if (video.windows[3].enabled[layer]) {
          video.setBlendEnabled(layer, video.windows[3].special && video.target1[layer], blend);
          if (video.windows[3].special && video.alphaEnabled) {
            mask |= video.target1[layer];
          }
          stencil |= video.OBJWIN_MASK;
        } else {
          return;
        }
      } else if (video.windows[2].enabled[layer]) {
        video.setBlendEnabled(layer, video.windows[2].special && video.target1[layer], blend);
        if (video.windows[2].special && video.alphaEnabled) {
          mask |= video.target1[layer];
        }
      } else {
        return;
      }
    }
    if (mask & video.TARGET1_MASK && oldStencil & video.TARGET2_MASK) {
      video.setBlendEnabled(layer, true, 1);
    }
    var pixel = raw ? row : video.palette.accessColor(layer, index);
    if (mask & video.TARGET1_MASK) {
      video.setBlendEnabled(layer, !!blend, blend);
    }
    var highPriority = (mask & video.PRIORITY_MASK) < (oldStencil & video.PRIORITY_MASK);
    if ((mask & video.PRIORITY_MASK) == (oldStencil & video.PRIORITY_MASK)) {
      highPriority = mask & video.BACKGROUND_MASK;
    }
    if (!(oldStencil & video.WRITTEN_MASK)) {
      stencil |= mask;
    } else if (highPriority) {
      if (mask & video.TARGET1_MASK && oldStencil & video.TARGET2_MASK) {
        pixel = video.palette.mix(video.blendA, pixel, video.blendB, backing.color[offset]);
      }
      stencil |= mask & ~video.TARGET1_MASK;
    } else if ((mask & video.PRIORITY_MASK) > (oldStencil & video.PRIORITY_MASK)) {
      stencil = oldStencil & ~(video.TARGET1_MASK | video.TARGET2_MASK);
      if (mask & video.TARGET2_MASK && oldStencil & video.TARGET1_MASK) {
        pixel = video.palette.mix(video.blendB, pixel, video.blendA, backing.color[offset]);
      } else {
        return;
      }
    } else {
      return;
    }
    if (mask & video.OBJWIN_MASK) {
      backing.stencil[offset] |= video.OBJWIN_MASK;
      return;
    }
    backing.color[offset] = pixel;
    backing.stencil[offset] = stencil;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.identity = function(x) {
    return x;
  };
  GameBoyAdvanceSoftwareRenderer.prototype.drawScanlineBlank = function(backing) {
    for (var x = 0;x < this.HORIZONTAL_PIXELS; ++x) {
      backing.color[x] = 65535;
      backing.stencil[x] = 0;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.prepareScanline = function(backing) {
    for (var x = 0;x < this.HORIZONTAL_PIXELS; ++x) {
      backing.stencil[x] = this.target2[this.LAYER_BACKDROP];
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.drawScanlineBGMode0 = function(backing, bg, start, end) {
    var video = this.video;
    var x;
    var y = video.vcount;
    var offset = start;
    var xOff = bg.x;
    var yOff = bg.y;
    var localX;
    var localXLo;
    var localY = y + yOff;
    if (this.mosaic) {
      localY -= y % video.bgMosaicY;
    }
    var localYLo = localY & 7;
    var mosaicX;
    var screenBase = bg.screenBase;
    var charBase = bg.charBase;
    var size = bg.size;
    var index = bg.index;
    var map = video.sharedMap;
    var paletteShift = bg.multipalette ? 1 : 0;
    var mask = video.target2[index] | bg.priority << 1 | video.BACKGROUND_MASK;
    if (video.blendMode == 1 && video.alphaEnabled) {
      mask |= video.target1[index];
    }
    var yBase = localY << 3 & 1984;
    if (size == 2) {
      yBase += localY << 3 & 2048;
    } else if (size == 3) {
      yBase += localY << 4 & 4096;
    }
    var xMask;
    if (size & 1) {
      xMask = 511;
    } else {
      xMask = 255;
    }
    video.accessMapMode0(screenBase, size, start + xOff & xMask, yBase, map);
    var tileRow2 = video.accessTile(charBase, map.tile << paletteShift, (!map.vflip ? localYLo : 7 - localYLo) << paletteShift);
    for (x = start;x < end; ++x) {
      localX = x + xOff & xMask;
      mosaicX = this.mosaic ? offset % video.bgMosaicX : 0;
      localX -= mosaicX;
      localXLo = localX & 7;
      if (!paletteShift) {
        if (!localXLo || this.mosaic && !mosaicX) {
          video.accessMapMode0(screenBase, size, localX, yBase, map);
          tileRow2 = video.accessTile(charBase, map.tile, !map.vflip ? localYLo : 7 - localYLo);
          if (!tileRow2 && !localXLo) {
            x += 7;
            offset += 8;
            continue;
          }
        }
      } else {
        if (!localXLo || this.mosaic && !mosaicX) {
          video.accessMapMode0(screenBase, size, localX, yBase, map);
        }
        if (!(localXLo & 3) || this.mosaic && !mosaicX) {
          tileRow2 = video.accessTile(charBase + (!!(localX & 4) == !map.hflip ? 4 : 0), map.tile << 1, (!map.vflip ? localYLo : 7 - localYLo) << 1);
          if (!tileRow2 && !(localXLo & 3)) {
            x += 3;
            offset += 4;
            continue;
          }
        }
      }
      if (map.hflip) {
        localXLo = 7 - localXLo;
      }
      bg.pushPixel(index, map, video, tileRow2, localXLo, offset, backing, mask, false);
      offset++;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.drawScanlineBGMode2 = function(backing, bg, start, end) {
    var video = this.video;
    var x;
    var y = video.vcount;
    var offset = start;
    var localX;
    var localY;
    var screenBase = bg.screenBase;
    var charBase = bg.charBase;
    var size = bg.size;
    var sizeAdjusted = 128 << size;
    var index = bg.index;
    var map = video.sharedMap;
    var color;
    var mask = video.target2[index] | bg.priority << 1 | video.BACKGROUND_MASK;
    if (video.blendMode == 1 && video.alphaEnabled) {
      mask |= video.target1[index];
    }
    var yBase;
    for (x = start;x < end; ++x) {
      localX = bg.dx * x + bg.sx;
      localY = bg.dy * x + bg.sy;
      if (this.mosaic) {
        localX -= x % video.bgMosaicX * bg.dx + y % video.bgMosaicY * bg.dmx;
        localY -= x % video.bgMosaicX * bg.dy + y % video.bgMosaicY * bg.dmy;
      }
      if (bg.overflow) {
        localX &= sizeAdjusted - 1;
        if (localX < 0) {
          localX += sizeAdjusted;
        }
        localY &= sizeAdjusted - 1;
        if (localY < 0) {
          localY += sizeAdjusted;
        }
      } else if (localX < 0 || localY < 0 || localX >= sizeAdjusted || localY >= sizeAdjusted) {
        offset++;
        continue;
      }
      yBase = (localY << 1 & 2032) << size;
      video.accessMapMode1(screenBase, size, localX, yBase, map);
      color = this.vram.loadU8(charBase + (map.tile << 6) + ((localY & 7) << 3) + (localX & 7));
      bg.pushPixel(index, map, video, color, 0, offset, backing, mask, false);
      offset++;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.drawScanlineBGMode3 = function(backing, bg, start, end) {
    var video = this.video;
    var x;
    var y = video.vcount;
    var offset = start;
    var localX;
    var localY;
    var index = bg.index;
    var map = video.sharedMap;
    var color;
    var mask = video.target2[index] | bg.priority << 1 | video.BACKGROUND_MASK;
    if (video.blendMode == 1 && video.alphaEnabled) {
      mask |= video.target1[index];
    }
    var yBase;
    for (x = start;x < end; ++x) {
      localX = bg.dx * x + bg.sx;
      localY = bg.dy * x + bg.sy;
      if (this.mosaic) {
        localX -= x % video.bgMosaicX * bg.dx + y % video.bgMosaicY * bg.dmx;
        localY -= x % video.bgMosaicX * bg.dy + y % video.bgMosaicY * bg.dmy;
      }
      if (localX < 0 || localY < 0 || localX >= video.HORIZONTAL_PIXELS || localY >= video.VERTICAL_PIXELS) {
        offset++;
        continue;
      }
      color = this.vram.loadU16(localY * video.HORIZONTAL_PIXELS + localX << 1);
      bg.pushPixel(index, map, video, color, 0, offset, backing, mask, true);
      offset++;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.drawScanlineBGMode4 = function(backing, bg, start, end) {
    var video = this.video;
    var x;
    var y = video.vcount;
    var offset = start;
    var localX;
    var localY;
    var charBase = 0;
    if (video.displayFrameSelect) {
      charBase += 40960;
    }
    var size = bg.size;
    var index = bg.index;
    var map = video.sharedMap;
    var color;
    var mask = video.target2[index] | bg.priority << 1 | video.BACKGROUND_MASK;
    if (video.blendMode == 1 && video.alphaEnabled) {
      mask |= video.target1[index];
    }
    var yBase;
    for (x = start;x < end; ++x) {
      localX = bg.dx * x + bg.sx;
      localY = 0 | bg.dy * x + bg.sy;
      if (this.mosaic) {
        localX -= x % video.bgMosaicX * bg.dx + y % video.bgMosaicY * bg.dmx;
        localY -= x % video.bgMosaicX * bg.dy + y % video.bgMosaicY * bg.dmy;
      }
      yBase = localY << 2 & 2016;
      if (localX < 0 || localY < 0 || localX >= video.HORIZONTAL_PIXELS || localY >= video.VERTICAL_PIXELS) {
        offset++;
        continue;
      }
      color = this.vram.loadU8(charBase + localY * video.HORIZONTAL_PIXELS + localX);
      bg.pushPixel(index, map, video, color, 0, offset, backing, mask, false);
      offset++;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.drawScanlineBGMode5 = function(backing, bg, start, end) {
    var video = this.video;
    var x;
    var y = video.vcount;
    var offset = start;
    var localX;
    var localY;
    var charBase = 0;
    if (video.displayFrameSelect) {
      charBase += 40960;
    }
    var index = bg.index;
    var map = video.sharedMap;
    var color;
    var mask = video.target2[index] | bg.priority << 1 | video.BACKGROUND_MASK;
    if (video.blendMode == 1 && video.alphaEnabled) {
      mask |= video.target1[index];
    }
    var yBase;
    for (x = start;x < end; ++x) {
      localX = bg.dx * x + bg.sx;
      localY = bg.dy * x + bg.sy;
      if (this.mosaic) {
        localX -= x % video.bgMosaicX * bg.dx + y % video.bgMosaicY * bg.dmx;
        localY -= x % video.bgMosaicX * bg.dy + y % video.bgMosaicY * bg.dmy;
      }
      if (localX < 0 || localY < 0 || localX >= 160 || localY >= 128) {
        offset++;
        continue;
      }
      color = this.vram.loadU16(charBase + (localY * 160 + localX) << 1);
      bg.pushPixel(index, map, video, color, 0, offset, backing, mask, true);
      offset++;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.drawScanline = function(y) {
    var backing = this.scanline;
    if (this.forcedBlank) {
      this.drawScanlineBlank(backing);
      return;
    }
    this.prepareScanline(backing);
    var layer;
    var firstStart;
    var firstEnd;
    var lastStart;
    var lastEnd;
    this.vcount = y;
    for (var i2 = 0;i2 < this.drawLayers.length; ++i2) {
      layer = this.drawLayers[i2];
      if (!layer.enabled) {
        continue;
      }
      this.objwinActive = false;
      if (!(this.win0 || this.win1 || this.objwin)) {
        this.setBlendEnabled(layer.index, this.target1[layer.index], this.blendMode);
        layer.drawScanline(backing, layer, 0, this.HORIZONTAL_PIXELS);
      } else {
        firstStart = 0;
        firstEnd = this.HORIZONTAL_PIXELS;
        lastStart = 0;
        lastEnd = this.HORIZONTAL_PIXELS;
        if (this.win0 && y >= this.win0Top && y < this.win0Bottom) {
          if (this.windows[0].enabled[layer.index]) {
            this.setBlendEnabled(layer.index, this.windows[0].special && this.target1[layer.index], this.blendMode);
            layer.drawScanline(backing, layer, this.win0Left, this.win0Right);
          }
          firstStart = Math.max(firstStart, this.win0Left);
          firstEnd = Math.min(firstEnd, this.win0Left);
          lastStart = Math.max(lastStart, this.win0Right);
          lastEnd = Math.min(lastEnd, this.win0Right);
        }
        if (this.win1 && y >= this.win1Top && y < this.win1Bottom) {
          if (this.windows[1].enabled[layer.index]) {
            this.setBlendEnabled(layer.index, this.windows[1].special && this.target1[layer.index], this.blendMode);
            if (!this.windows[0].enabled[layer.index] && (this.win1Left < firstStart || this.win1Right < lastStart)) {
              layer.drawScanline(backing, layer, this.win1Left, firstStart);
              layer.drawScanline(backing, layer, lastEnd, this.win1Right);
            } else {
              layer.drawScanline(backing, layer, this.win1Left, this.win1Right);
            }
          }
          firstStart = Math.max(firstStart, this.win1Left);
          firstEnd = Math.min(firstEnd, this.win1Left);
          lastStart = Math.max(lastStart, this.win1Right);
          lastEnd = Math.min(lastEnd, this.win1Right);
        }
        if (this.windows[2].enabled[layer.index] || this.objwin && this.windows[3].enabled[layer.index]) {
          this.objwinActive = this.objwin;
          this.setBlendEnabled(layer.index, this.windows[2].special && this.target1[layer.index], this.blendMode);
          if (firstEnd > lastStart) {
            layer.drawScanline(backing, layer, 0, this.HORIZONTAL_PIXELS);
          } else {
            if (firstEnd) {
              layer.drawScanline(backing, layer, 0, firstEnd);
            }
            if (lastStart < this.HORIZONTAL_PIXELS) {
              layer.drawScanline(backing, layer, lastStart, this.HORIZONTAL_PIXELS);
            }
            if (lastEnd < firstStart) {
              layer.drawScanline(backing, layer, lastEnd, firstStart);
            }
          }
        }
        this.setBlendEnabled(this.LAYER_BACKDROP, this.target1[this.LAYER_BACKDROP] && this.windows[2].special, this.blendMode);
      }
      if (layer.bg) {
        layer.sx += layer.dmx;
        layer.sy += layer.dmy;
      }
    }
    this.finishScanline(backing);
  };
  GameBoyAdvanceSoftwareRenderer.prototype.finishScanline = function(backing) {
    var color;
    var bd = this.palette.accessColor(this.LAYER_BACKDROP, 0);
    var xx = this.vcount * this.HORIZONTAL_PIXELS * 4;
    var isTarget2 = this.target2[this.LAYER_BACKDROP];
    for (var x = 0;x < this.HORIZONTAL_PIXELS; ++x) {
      if (backing.stencil[x] & this.WRITTEN_MASK) {
        color = backing.color[x];
        if (isTarget2 && backing.stencil[x] & this.TARGET1_MASK) {
          color = this.palette.mix(this.blendA, color, this.blendB, bd);
        }
        this.palette.convert16To32(color, this.sharedColor);
      } else {
        this.palette.convert16To32(bd, this.sharedColor);
      }
      this.pixelData.data[xx++] = this.sharedColor[0];
      this.pixelData.data[xx++] = this.sharedColor[1];
      this.pixelData.data[xx++] = this.sharedColor[2];
      xx++;
    }
  };
  GameBoyAdvanceSoftwareRenderer.prototype.startDraw = function() {
  };
  GameBoyAdvanceSoftwareRenderer.prototype.finishDraw = function(caller) {
    this.bg[2].sx = this.bg[2].refx;
    this.bg[2].sy = this.bg[2].refy;
    this.bg[3].sx = this.bg[3].refx;
    this.bg[3].sy = this.bg[3].refy;
    caller.finishDraw(this.pixelData);
  };
  exports.GameBoyAdvanceSoftwareRenderer = GameBoyAdvanceSoftwareRenderer;
});

// js/video.js
var require_video = __commonJS((exports, module) => {
  var GameBoyAdvanceVideo = function() {
    this.renderPath = new GameBoyAdvanceSoftwareRenderer;
    this.CYCLES_PER_PIXEL = 4;
    this.HORIZONTAL_PIXELS = 240;
    this.HBLANK_PIXELS = 68;
    this.HDRAW_LENGTH = 1006;
    this.HBLANK_LENGTH = 226;
    this.HORIZONTAL_LENGTH = 1232;
    this.VERTICAL_PIXELS = 160;
    this.VBLANK_PIXELS = 68;
    this.VERTICAL_TOTAL_PIXELS = 228;
    this.TOTAL_LENGTH = 280896;
    this.drawCallback = function() {
    };
    this.vblankCallback = function() {
    };
  };
  var GameBoyAdvanceSoftwareRenderer = require_software().GameBoyAdvanceSoftwareRenderer;
  GameBoyAdvanceVideo.prototype.clear = function() {
    this.renderPath.clear(this.cpu.mmu);
    this.DISPSTAT_MASK = 65336;
    this.inHblank = false;
    this.inVblank = false;
    this.vcounter = 0;
    this.vblankIRQ = 0;
    this.hblankIRQ = 0;
    this.vcounterIRQ = 0;
    this.vcountSetting = 0;
    this.vcount = -1;
    this.lastHblank = 0;
    this.nextHblank = this.HDRAW_LENGTH;
    this.nextEvent = this.nextHblank;
    this.nextHblankIRQ = 0;
    this.nextVblankIRQ = 0;
    this.nextVcounterIRQ = 0;
  };
  GameBoyAdvanceVideo.prototype.freeze = function() {
    return {
      inHblank: this.inHblank,
      inVblank: this.inVblank,
      vcounter: this.vcounter,
      vblankIRQ: this.vblankIRQ,
      hblankIRQ: this.hblankIRQ,
      vcounterIRQ: this.vcounterIRQ,
      vcountSetting: this.vcountSetting,
      vcount: this.vcount,
      lastHblank: this.lastHblank,
      nextHblank: this.nextHblank,
      nextEvent: this.nextEvent,
      nextHblankIRQ: this.nextHblankIRQ,
      nextVblankIRQ: this.nextVblankIRQ,
      nextVcounterIRQ: this.nextVcounterIRQ,
      renderPath: this.renderPath.freeze(this.core.encodeBase64)
    };
  };
  GameBoyAdvanceVideo.prototype.defrost = function(frost) {
    this.inHblank = frost.inHblank;
    this.inVblank = frost.inVblank;
    this.vcounter = frost.vcounter;
    this.vblankIRQ = frost.vblankIRQ;
    this.hblankIRQ = frost.hblankIRQ;
    this.vcounterIRQ = frost.vcounterIRQ;
    this.vcountSetting = frost.vcountSetting;
    this.vcount = frost.vcount;
    this.lastHblank = frost.lastHblank;
    this.nextHblank = frost.nextHblank;
    this.nextEvent = frost.nextEvent;
    this.nextHblankIRQ = frost.nextHblankIRQ;
    this.nextVblankIRQ = frost.nextVblankIRQ;
    this.nextVcounterIRQ = frost.nextVcounterIRQ;
    this.renderPath.defrost(frost.renderPath, this.core.decodeBase64);
  };
  GameBoyAdvanceVideo.prototype.setBacking = function(backing) {
    var pixelData = backing.createImageData(this.HORIZONTAL_PIXELS, this.VERTICAL_PIXELS);
    this.context = backing;
    for (var offset = 0;offset < this.HORIZONTAL_PIXELS * this.VERTICAL_PIXELS * 4; ) {
      pixelData.data[offset++] = 255;
      pixelData.data[offset++] = 255;
      pixelData.data[offset++] = 255;
      pixelData.data[offset++] = 255;
    }
    this.renderPath.setBacking(pixelData);
  };
  GameBoyAdvanceVideo.prototype.updateTimers = function(cpu) {
    var cycles = cpu.cycles;
    if (this.nextEvent <= cycles) {
      if (this.inHblank) {
        this.inHblank = false;
        this.nextEvent = this.nextHblank;
        ++this.vcount;
        switch (this.vcount) {
          case this.VERTICAL_PIXELS:
            this.inVblank = true;
            this.renderPath.finishDraw(this);
            this.nextVblankIRQ = this.nextEvent + this.TOTAL_LENGTH;
            this.cpu.mmu.runVblankDmas();
            if (this.vblankIRQ) {
              this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_VBLANK);
            }
            this.vblankCallback();
            break;
          case this.VERTICAL_TOTAL_PIXELS - 1:
            this.inVblank = false;
            break;
          case this.VERTICAL_TOTAL_PIXELS:
            this.vcount = 0;
            this.renderPath.startDraw();
            break;
        }
        this.vcounter = this.vcount == this.vcountSetting;
        if (this.vcounter && this.vcounterIRQ) {
          this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_VCOUNTER);
          this.nextVcounterIRQ += this.TOTAL_LENGTH;
        }
        if (this.vcount < this.VERTICAL_PIXELS) {
          this.renderPath.drawScanline(this.vcount);
        }
      } else {
        this.inHblank = true;
        this.lastHblank = this.nextHblank;
        this.nextEvent = this.lastHblank + this.HBLANK_LENGTH;
        this.nextHblank = this.nextEvent + this.HDRAW_LENGTH;
        this.nextHblankIRQ = this.nextHblank;
        if (this.vcount < this.VERTICAL_PIXELS) {
          this.cpu.mmu.runHblankDmas();
        }
        if (this.hblankIRQ) {
          this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_HBLANK);
        }
      }
    }
  };
  GameBoyAdvanceVideo.prototype.writeDisplayStat = function(value) {
    this.vblankIRQ = value & 8;
    this.hblankIRQ = value & 16;
    this.vcounterIRQ = value & 32;
    this.vcountSetting = (value & 65280) >> 8;
    if (this.vcounterIRQ) {
      this.nextVcounterIRQ = this.nextHblank + this.HBLANK_LENGTH + (this.vcountSetting - this.vcount) * this.HORIZONTAL_LENGTH;
      if (this.nextVcounterIRQ < this.nextEvent) {
        this.nextVcounterIRQ += this.TOTAL_LENGTH;
      }
    }
  };
  GameBoyAdvanceVideo.prototype.readDisplayStat = function() {
    return this.inVblank | this.inHblank << 1 | this.vcounter << 2;
  };
  GameBoyAdvanceVideo.prototype.finishDraw = function(pixelData) {
    this.drawCallback();
  };
  module.exports = GameBoyAdvanceVideo;
});

// js/keypad.js
var require_keypad = __commonJS((exports, module) => {
  var GameBoyAdvanceKeypad = function() {
    this.KEYCODE_LEFT = 37;
    this.KEYCODE_UP = 38;
    this.KEYCODE_RIGHT = 39;
    this.KEYCODE_DOWN = 40;
    this.KEYCODE_START = 13;
    this.KEYCODE_SELECT = 220;
    this.KEYCODE_A = 90;
    this.KEYCODE_B = 88;
    this.KEYCODE_L = 65;
    this.KEYCODE_R = 83;
    this.GAMEPAD_LEFT = 14;
    this.GAMEPAD_UP = 12;
    this.GAMEPAD_RIGHT = 15;
    this.GAMEPAD_DOWN = 13;
    this.GAMEPAD_START = 9;
    this.GAMEPAD_SELECT = 8;
    this.GAMEPAD_A = 1;
    this.GAMEPAD_B = 0;
    this.GAMEPAD_L = 4;
    this.GAMEPAD_R = 5;
    this.GAMEPAD_THRESHOLD = 0.2;
    this.A = 0;
    this.B = 1;
    this.SELECT = 2;
    this.START = 3;
    this.RIGHT = 4;
    this.LEFT = 5;
    this.UP = 6;
    this.DOWN = 7;
    this.R = 8;
    this.L = 9;
    this.PRESS_TIME = 100;
    this.currentDown = 1023;
    this.eatInput = false;
    this.gamepads = [];
  };
  GameBoyAdvanceKeypad.prototype.press = function(key, time) {
    time = time || this.PRESS_TIME;
    var toggle = key;
    var self2 = this;
    toggle = 1 << toggle;
    this.currentDown &= ~toggle;
    setTimeout(function() {
      self2.currentDown |= toggle;
    }, time);
  };
  GameBoyAdvanceKeypad.prototype.keydown = function(key) {
    var toggle = key;
    toggle = 1 << toggle;
    this.currentDown &= ~toggle;
  };
  GameBoyAdvanceKeypad.prototype.keyup = function(key) {
    var toggle = key;
    toggle = 1 << toggle;
    this.currentDown |= toggle;
  };
  GameBoyAdvanceKeypad.prototype.keyboardHandler = function(e) {
    var toggle = 0;
    switch (e.keyCode) {
      case this.KEYCODE_START:
        toggle = this.START;
        break;
      case this.KEYCODE_SELECT:
        toggle = this.SELECT;
        break;
      case this.KEYCODE_A:
        toggle = this.A;
        break;
      case this.KEYCODE_B:
        toggle = this.B;
        break;
      case this.KEYCODE_L:
        toggle = this.L;
        break;
      case this.KEYCODE_R:
        toggle = this.R;
        break;
      case this.KEYCODE_UP:
        toggle = this.UP;
        break;
      case this.KEYCODE_RIGHT:
        toggle = this.RIGHT;
        break;
      case this.KEYCODE_DOWN:
        toggle = this.DOWN;
        break;
      case this.KEYCODE_LEFT:
        toggle = this.LEFT;
        break;
      default:
        return;
    }
    toggle = 1 << toggle;
    if (e.type == "keydown") {
      this.currentDown &= ~toggle;
    } else {
      this.currentDown |= toggle;
    }
    if (this.eatInput) {
      e.preventDefault();
    }
  };
  GameBoyAdvanceKeypad.prototype.gamepadHandler = function(gamepad) {
    var value = 0;
    if (gamepad.buttons[this.GAMEPAD_LEFT] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.LEFT;
    }
    if (gamepad.buttons[this.GAMEPAD_UP] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.UP;
    }
    if (gamepad.buttons[this.GAMEPAD_RIGHT] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.RIGHT;
    }
    if (gamepad.buttons[this.GAMEPAD_DOWN] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.DOWN;
    }
    if (gamepad.buttons[this.GAMEPAD_START] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.START;
    }
    if (gamepad.buttons[this.GAMEPAD_SELECT] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.SELECT;
    }
    if (gamepad.buttons[this.GAMEPAD_A] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.A;
    }
    if (gamepad.buttons[this.GAMEPAD_B] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.B;
    }
    if (gamepad.buttons[this.GAMEPAD_L] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.L;
    }
    if (gamepad.buttons[this.GAMEPAD_R] > this.GAMEPAD_THRESHOLD) {
      value |= 1 << this.R;
    }
    this.currentDown = ~value & 1023;
  };
  GameBoyAdvanceKeypad.prototype.gamepadConnectHandler = function(gamepad) {
    this.gamepads.push(gamepad);
  };
  GameBoyAdvanceKeypad.prototype.gamepadDisconnectHandler = function(gamepad) {
    this.gamepads = self.gamepads.filter(function(other) {
      return other != gamepad;
    });
  };
  GameBoyAdvanceKeypad.prototype.pollGamepads = function() {
    var navigatorList = [];
    if (navigatorList.length) {
      this.gamepads = [];
    }
    for (var i2 = 0;i2 < navigatorList.length; ++i2) {
      if (navigatorList[i2]) {
        this.gamepads.push(navigatorList[i2]);
      }
    }
    if (this.gamepads.length > 0) {
      this.gamepadHandler(this.gamepads[0]);
    }
  };
  GameBoyAdvanceKeypad.prototype.registerHandlers = function() {
  };
  module.exports = GameBoyAdvanceKeypad;
});

// js/sio.js
var require_sio = __commonJS((exports, module) => {
  var GameBoyAdvanceSIO = function() {
    this.SIO_NORMAL_8 = 0;
    this.SIO_NORMAL_32 = 1;
    this.SIO_MULTI = 2;
    this.SIO_UART = 3;
    this.SIO_GPIO = 8;
    this.SIO_JOYBUS = 12;
    this.BAUD = [9600, 38400, 57600, 115200];
  };
  var hex = require_util().hex;
  GameBoyAdvanceSIO.prototype.clear = function() {
    this.mode = this.SIO_GPIO;
    this.sd = false;
    this.irq = false;
    this.multiplayer = {
      baud: 0,
      si: 0,
      id: 0,
      error: 0,
      busy: 0,
      states: [65535, 65535, 65535, 65535]
    };
    this.linkLayer = null;
  };
  GameBoyAdvanceSIO.prototype.setMode = function(mode) {
    if (mode & 8) {
      mode &= 12;
    } else {
      mode &= 3;
    }
    this.mode = mode;
    this.core.INFO("Setting SIO mode to " + hex(mode, 1));
  };
  GameBoyAdvanceSIO.prototype.writeRCNT = function(value) {
    if (this.mode != this.SIO_GPIO) {
      return;
    }
    this.core.STUB("General purpose serial not supported");
  };
  GameBoyAdvanceSIO.prototype.writeSIOCNT = function(value) {
    switch (this.mode) {
      case this.SIO_NORMAL_8:
        this.core.STUB("8-bit transfer unsupported");
        break;
      case this.SIO_NORMAL_32:
        this.core.STUB("32-bit transfer unsupported");
        break;
      case this.SIO_MULTI:
        this.multiplayer.baud = value & 3;
        if (this.linkLayer) {
          this.linkLayer.setBaud(this.BAUD[this.multiplayer.baud]);
        }
        if (!this.multiplayer.si) {
          this.multiplayer.busy = value & 128;
          if (this.linkLayer && this.multiplayer.busy) {
            this.linkLayer.startMultiplayerTransfer();
          }
        }
        this.irq = value & 16384;
        break;
      case this.SIO_UART:
        this.core.STUB("UART unsupported");
        break;
      case this.SIO_GPIO:
        break;
      case this.SIO_JOYBUS:
        this.core.STUB("JOY BUS unsupported");
        break;
    }
  };
  GameBoyAdvanceSIO.prototype.readSIOCNT = function() {
    var value = this.mode << 12 & 65535;
    switch (this.mode) {
      case this.SIO_NORMAL_8:
        this.core.STUB("8-bit transfer unsupported");
        break;
      case this.SIO_NORMAL_32:
        this.core.STUB("32-bit transfer unsupported");
        break;
      case this.SIO_MULTI:
        value |= this.multiplayer.baud;
        value |= this.multiplayer.si;
        value |= !!this.sd << 3;
        value |= this.multiplayer.id << 4;
        value |= this.multiplayer.error;
        value |= this.multiplayer.busy;
        value |= !!this.multiplayer.irq << 14;
        break;
      case this.SIO_UART:
        this.core.STUB("UART unsupported");
        break;
      case this.SIO_GPIO:
        break;
      case this.SIO_JOYBUS:
        this.core.STUB("JOY BUS unsupported");
        break;
    }
    return value;
  };
  GameBoyAdvanceSIO.prototype.read = function(slot) {
    switch (this.mode) {
      case this.SIO_NORMAL_32:
        this.core.STUB("32-bit transfer unsupported");
        break;
      case this.SIO_MULTI:
        return this.multiplayer.states[slot];
      case this.SIO_UART:
        this.core.STUB("UART unsupported");
        break;
      default:
        this.core.WARN("Reading from transfer register in unsupported mode");
        break;
    }
    return 0;
  };
  module.exports = GameBoyAdvanceSIO;
});

// js/memory-canvas.js
var require_memory_canvas = __commonJS((exports, module) => {
  var MemoryCanvas = function() {
  };
  MemoryCanvas.prototype.getContext = function() {
    return this;
  };
  MemoryCanvas.prototype.createImageData = function(w, h) {
    var pixelData = {
      width: w,
      height: h,
      data: new Uint8Array(w * h * 4)
    };
    this.pixelData = pixelData;
    return pixelData;
  };
  module.exports = MemoryCanvas;
});

// js/gba.js
var require_gba = __commonJS((exports, module) => {
  var GameBoyAdvance = function() {
    this.LOG_ERROR = 1;
    this.LOG_WARN = 2;
    this.LOG_STUB = 4;
    this.LOG_INFO = 8;
    this.LOG_DEBUG = 16;
    this.SYS_ID = "com.endrift.gbajs";
    this.logLevel = this.LOG_ERROR | this.LOG_WARN;
    this.rom = null;
    this.cpu = new ARMCore;
    this.mmu = new GameBoyAdvanceMMU;
    this.irq = new GameBoyAdvanceInterruptHandler;
    this.io = new GameBoyAdvanceIO;
    this.audio = new GameBoyAdvanceAudio;
    this.video = new GameBoyAdvanceVideo;
    this.keypad = new GameBoyAdvanceKeypad;
    this.sio = new GameBoyAdvanceSIO;
    this.cpu.mmu = this.mmu;
    this.cpu.irq = this.irq;
    this.mmu.cpu = this.cpu;
    this.mmu.core = this;
    this.irq.cpu = this.cpu;
    this.irq.io = this.io;
    this.irq.audio = this.audio;
    this.irq.video = this.video;
    this.irq.core = this;
    this.io.cpu = this.cpu;
    this.io.audio = this.audio;
    this.io.video = this.video;
    this.io.keypad = this.keypad;
    this.io.sio = this.sio;
    this.io.core = this;
    this.audio.cpu = this.cpu;
    this.audio.core = this;
    this.video.cpu = this.cpu;
    this.video.core = this;
    this.keypad.core = this;
    this.sio.core = this;
    this.keypad.registerHandlers();
    this.doStep = this.waitFrame;
    this.paused = false;
    this.seenFrame = false;
    this.seenSave = false;
    this.lastVblank = 0;
    this.queue = null;
    this.reportFPS = null;
    this.throttle = 16;
    var self2 = this;
    queueFrame = function(f) {
      self2.queue = setTimeout(f, self2.throttle);
    };
    this.video.vblankCallback = function() {
      self2.seenFrame = true;
    };
  };
  var fs = __require("fs");
  var PNG = require_png().PNG;
  var ARMCore = require_core();
  var GameBoyAdvanceMMU = require_mmu().GameBoyAdvanceMMU;
  var GameBoyAdvanceInterruptHandler = require_irq();
  var GameBoyAdvanceIO = require_io();
  var GameBoyAdvanceAudio = require_audio();
  var GameBoyAdvanceVideo = require_video();
  var GameBoyAdvanceKeypad = require_keypad();
  var GameBoyAdvanceSIO = require_sio();
  var MemoryCanvas = require_memory_canvas();
  var queueFrame;
  GameBoyAdvance.MemoryCanvas = MemoryCanvas;
  GameBoyAdvance.prototype.setCanvas = function(canvas) {
    var self2 = this;
    if (canvas.offsetWidth != 240 || canvas.offsetHeight != 160) {
      this.indirectCanvas = document.createElement("canvas");
      this.indirectCanvas.setAttribute("height", "160");
      this.indirectCanvas.setAttribute("width", "240");
      this.targetCanvas = canvas;
      this.setCanvasDirect(this.indirectCanvas);
      var targetContext = canvas.getContext("2d");
      this.video.drawCallback = function() {
        targetContext.drawImage(self2.indirectCanvas, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      };
    } else {
      this.setCanvasDirect(canvas);
      var self2 = this;
    }
  };
  GameBoyAdvance.prototype.setCanvasDirect = function(canvas) {
    this.context = canvas.getContext("2d");
    this.video.setBacking(this.context);
  };
  GameBoyAdvance.prototype.setCanvasMemory = function() {
    var canvas = new MemoryCanvas;
    this.setCanvasDirect(canvas);
  };
  GameBoyAdvance.prototype.setBios = function(bios, real) {
    this.mmu.loadBios(bios, real);
  };
  GameBoyAdvance.prototype.setRom = function(rom) {
    this.reset();
    this.rom = this.mmu.loadRom(rom, true);
    if (!this.rom) {
      return false;
    }
    this.retrieveSavedata();
    return true;
  };
  GameBoyAdvance.prototype.hasRom = function() {
    return !!this.rom;
  };
  GameBoyAdvance.prototype.loadRomFromFile = function(romFile, callback) {
    var self2 = this;
    fs.readFile(romFile, function(err, data) {
      if (err) {
        this.ERROR(err);
        if (callback) {
          callback(err, false);
        }
        return;
      }
      var result = self2.setRom(data);
      if (callback) {
        callback(result ? null : new Error("Invalid ROM"), result);
      }
    });
  };
  GameBoyAdvance.prototype.reset = function() {
    this.audio.pause(true);
    this.mmu.clear();
    this.io.clear();
    this.audio.clear();
    this.video.clear();
    this.sio.clear();
    this.mmu.mmap(this.mmu.REGION_IO, this.io);
    this.mmu.mmap(this.mmu.REGION_PALETTE_RAM, this.video.renderPath.palette);
    this.mmu.mmap(this.mmu.REGION_VRAM, this.video.renderPath.vram);
    this.mmu.mmap(this.mmu.REGION_OAM, this.video.renderPath.oam);
    this.cpu.resetCPU(0);
  };
  GameBoyAdvance.prototype.step = function() {
    while (this.doStep()) {
      this.cpu.step();
    }
  };
  GameBoyAdvance.prototype.waitFrame = function() {
    var seen = this.seenFrame;
    this.seenFrame = false;
    return !seen;
  };
  GameBoyAdvance.prototype.pause = function() {
    this.paused = true;
    this.audio.pause(true);
    if (this.queue) {
      clearTimeout(this.queue);
      this.queue = null;
    }
  };
  GameBoyAdvance.prototype.advanceFrame = function() {
    this.step();
    if (this.seenSave) {
      if (!this.mmu.saveNeedsFlush()) {
        this.storeSavedata();
        this.seenSave = false;
      } else {
        this.mmu.flushSave();
      }
    } else if (this.mmu.saveNeedsFlush()) {
      this.seenSave = true;
      this.mmu.flushSave();
    }
  };
  GameBoyAdvance.prototype.runStable = function() {
    if (this.interval) {
      return;
    }
    var self2 = this;
    var timer = 0;
    var frames = 0;
    var runFunc;
    var start = Date.now();
    this.paused = false;
    this.audio.pause(false);
    if (this.reportFPS) {
      runFunc = function() {
        try {
          timer += Date.now() - start;
          if (self2.paused) {
            return;
          } else {
            queueFrame(runFunc);
          }
          start = Date.now();
          self2.advanceFrame();
          ++frames;
          if (frames == 60) {
            self2.reportFPS(frames * 1000 / timer);
            frames = 0;
            timer = 0;
          }
        } catch (exception) {
          self2.ERROR(exception);
          if (exception.stack) {
            self2.logStackTrace(exception.stack.split("\n"));
          }
          throw exception;
        }
      };
    } else {
      runFunc = function() {
        try {
          if (self2.paused) {
            return;
          } else {
            queueFrame(runFunc);
          }
          self2.advanceFrame();
        } catch (exception) {
          self2.ERROR(exception);
          if (exception.stack) {
            self2.logStackTrace(exception.stack.split("\n"));
          }
          throw exception;
        }
      };
    }
    queueFrame(runFunc);
  };
  GameBoyAdvance.prototype.setSavedata = function(data) {
    this.mmu.loadSavedata(data);
  };
  GameBoyAdvance.prototype.loadSavedataFromFile = function(saveFile, callback) {
    var self2 = this;
    fs.readFile(saveFile, function(err, data) {
      if (err) {
        self2.ERROR(err);
      } else {
        self2.setSavedata(data);
      }
      if (callback)
        callback(err);
    });
  };
  GameBoyAdvance.prototype.decodeSavedata = function(string) {
    this.setSavedata(this.decodeBase64(string));
  };
  GameBoyAdvance.prototype.decodeBase64 = function(string) {
    var length = string.length * 3 / 4;
    if (string[string.length - 2] == "=") {
      length -= 2;
    } else if (string[string.length - 1] == "=") {
      length -= 1;
    }
    var buffer = new ArrayBuffer(length);
    var view = new Uint8Array(buffer);
    var bits = string.match(/..../g);
    for (var i2 = 0;i2 + 2 < length; i2 += 3) {
      var s = atob(bits.shift());
      view[i2] = s.charCodeAt(0);
      view[i2 + 1] = s.charCodeAt(1);
      view[i2 + 2] = s.charCodeAt(2);
    }
    if (i2 < length) {
      var s = atob(bits.shift());
      view[i2++] = s.charCodeAt(0);
      if (s.length > 1) {
        view[i2++] = s.charCodeAt(1);
      }
    }
    return buffer;
  };
  GameBoyAdvance.prototype.encodeBase64 = function(view) {
    var data = [];
    var b;
    var wordstring = [];
    var triplet;
    for (var i2 = 0;i2 < view.byteLength; ++i2) {
      b = view.getUint8(i2, true);
      wordstring.push(String.fromCharCode(b));
      while (wordstring.length >= 3) {
        triplet = wordstring.splice(0, 3);
        data.push(btoa(triplet.join("")));
      }
    }
    if (wordstring.length) {
      data.push(btoa(wordstring.join("")));
    }
    return data.join("");
  };
  GameBoyAdvance.prototype.downloadSavedataToFile = function(saveFile, callback) {
    var sram = this.mmu.save;
    if (!sram) {
      this.WARN("No save data available");
      return null;
    }
    var buf = Buffer.from(sram.buffer);
    var self2 = this;
    fs.writeFile(saveFile, buf, function(err) {
      if (err) {
        self2.ERROR(err);
      }
      if (callback) {
        callback(err);
      }
    });
  };
  GameBoyAdvance.prototype.downloadSavedata = function() {
    var sram = this.mmu.save;
    if (!sram) {
      this.WARN("No save data available");
      return null;
    }
    if (window.URL) {
      var url = window.URL.createObjectURL(new Blob([sram.buffer], { type: "application/octet-stream" }));
      window.open(url);
    } else {
      var data = this.encodeBase64(sram.view);
      window.open("data:application/octet-stream;base64," + data, this.rom.code + ".sav");
    }
  };
  GameBoyAdvance.prototype.storeSavedata = function() {
    var sram = this.mmu.save;
    try {
      var storage = window.localStorage;
      storage[this.SYS_ID + "." + this.mmu.cart.code] = this.encodeBase64(sram.view);
    } catch (e) {
      this.WARN("Could not store savedata! " + e);
    }
  };
  GameBoyAdvance.prototype.retrieveSavedata = function() {
    try {
      var storage = window.localStorage;
      var data = storage[this.SYS_ID + "." + this.mmu.cart.code];
      if (data) {
        this.decodeSavedata(data);
        return true;
      }
    } catch (e) {
      this.WARN("Could not retrieve savedata! " + e);
    }
    return false;
  };
  GameBoyAdvance.prototype.screenshot = function() {
    var pd = this.context.pixelData;
    var png = new PNG({
      width: pd.width,
      height: pd.height,
      bitDepth: 8,
      colorType: 6,
      inputColorType: 6,
      inputHasAlpha: true
    });
    png.data = pd.data;
    return png;
  };
  GameBoyAdvance.prototype.freeze = function() {
    return {
      cpu: this.cpu.freeze(),
      mmu: this.mmu.freeze(),
      irq: this.irq.freeze(),
      io: this.io.freeze(),
      audio: this.audio.freeze(),
      video: this.video.freeze()
    };
  };
  GameBoyAdvance.prototype.defrost = function(frost) {
    this.cpu.defrost(frost.cpu);
    this.mmu.defrost(frost.mmu);
    this.audio.defrost(frost.audio);
    this.video.defrost(frost.video);
    this.irq.defrost(frost.irq);
    this.io.defrost(frost.io);
  };
  GameBoyAdvance.prototype.log = function(level, message) {
  };
  GameBoyAdvance.prototype.setLogger = function(logger) {
    this.log = logger;
  };
  GameBoyAdvance.prototype.logStackTrace = function(stack) {
    var overflow = stack.length - 32;
    this.ERROR("Stack trace follows:");
    if (overflow > 0) {
      this.log(-1, "> (Too many frames)");
    }
    for (var i2 = Math.max(overflow, 0);i2 < stack.length; ++i2) {
      this.log(-1, "> " + stack[i2]);
    }
  };
  GameBoyAdvance.prototype.ERROR = function(error) {
    if (this.logLevel & this.LOG_ERROR) {
      this.log(this.LOG_ERROR, error);
    }
  };
  GameBoyAdvance.prototype.WARN = function(warn) {
    if (this.logLevel & this.LOG_WARN) {
      this.log(this.LOG_WARN, warn);
    }
  };
  GameBoyAdvance.prototype.STUB = function(func) {
    if (this.logLevel & this.LOG_STUB) {
      this.log(this.LOG_STUB, func);
    }
  };
  GameBoyAdvance.prototype.INFO = function(info) {
    if (this.logLevel & this.LOG_INFO) {
      this.log(this.LOG_INFO, info);
    }
  };
  GameBoyAdvance.prototype.DEBUG = function(info) {
    if (this.logLevel & this.LOG_DEBUG) {
      this.log(this.LOG_DEBUG, info);
    }
  };
  GameBoyAdvance.prototype.ASSERT_UNREACHED = function(err) {
    throw new Error("Should be unreached: " + err);
  };
  GameBoyAdvance.prototype.ASSERT = function(test, err) {
    if (!test) {
      throw new Error("Assertion failed: " + err);
    }
  };
  module.exports = GameBoyAdvance;
});
export default require_gba();
