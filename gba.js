function GameBoyAdvance() {
	this.LOG_ERROR = 1;
	this.LOG_WARN = 2;
	this.LOG_STUB = 4;
	this.LOG_INFO = 8;

	this.logLevel = this.LOG_ERROR | this.LOG_WARN;

	this.rom = null;

	this.cpu = new ARMCore();
	this.mmu = new GameBoyAdvanceMMU()
	this.irq = new GameBoyAdvanceInterruptHandler();
	this.io = new GameBoyAdvanceIO();
	this.audio = new GameBoyAdvanceAudio();
	this.video = new GameBoyAdvanceVideo();
	this.keypad = new GameBoyAdvanceKeypad();

	// TODO: simplify this graph
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
	this.io.core = this;

	this.audio.cpu = this.cpu;
	this.audio.core = this;

	this.video.cpu = this.cpu;
	this.video.core = this;

	this.keypad.core = this;

	this.reset();

	this.keypad.registerKeyboardHandlers();
	this.doStep = this.returnFalse;

	this.seenFrame = false;
	this.interval = null;
	this.reportFPS = null;
};

GameBoyAdvance.prototype.setCanvas = function(canvas) {
	var self = this;
	if (canvas.offsetWidth != 240 || canvas.offsetHeight != 160) {
		this.indirectCanvas = document.createElement("canvas");
		this.indirectCanvas.setAttribute("height", "160"); 
		this.indirectCanvas.setAttribute("width", "240"); 
		this.targetCanvas = canvas;
		this.setCanvasDirect(this.indirectCanvas);
		var targetContext = canvas.getContext('2d');
		this.video.drawCallback = function() {
			targetContext.drawImage(self.indirectCanvas, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
			self.finishFrame();
		}
	} else {
		this.setCanvasDirect(canvas);
		var self = this;
		this.video.drawCallback = function() {
			self.finishFrame();
		}
	}
};

GameBoyAdvance.prototype.setCanvasDirect = function(canvas) {
	this.context = canvas.getContext('2d');
	this.video.setBacking(this.context);
};

GameBoyAdvance.prototype.setBios = function(bios) {
	this.mmu.loadBios(bios);
};

GameBoyAdvance.prototype.setRom = function(rom) {
	// TODO: be able to reset the ROM live
	//this.reset();

	this.rom = this.mmu.loadRom(rom, true);
};

GameBoyAdvance.prototype.hasRom = function() {
	return !!this.rom;
};

GameBoyAdvance.prototype.loadRomFromFile = function(romFile) {
	var reader = new FileReader();
	var self = this;
	reader.onload = function(e) { self.setRom(e.target.result); }
	reader.readAsArrayBuffer(romFile);
};

GameBoyAdvance.prototype.reset = function() {
	this.mmu.clear();
	this.io.clear();
	this.audio.clear();
	this.video.clear();

	this.mmu.mmap(this.mmu.REGION_IO, this.io);
	this.mmu.mmap(this.mmu.REGION_PALETTE_RAM, this.video.palette);
	this.mmu.mmap(this.mmu.REGION_VRAM, this.video.vram);
	this.mmu.mmap(this.mmu.REGION_OAM, this.video.oam);

	this.cpu.resetCPU(0x08000000);
};

GameBoyAdvance.prototype.step = function() {
	while (this.doStep()) {
		this.cpu.step();
	}
};

GameBoyAdvance.prototype.returnFalse = function() {
	return false;
};

GameBoyAdvance.prototype.finishFrame = function() {
	this.seenFrame = true;
};

GameBoyAdvance.prototype.waitFrame = function() {
	return !this.seenFrame;
};

GameBoyAdvance.prototype.advanceFrame = function() {
	this.seenFrame = false;
	this.doStep = this.waitFrame;
	this.step();
};

GameBoyAdvance.prototype.runStable = function() {
	if (this.interval) {
		return; // Already running
	}
	var self = this;
	var timer = 0;
	var frames = 0;
	var runFunc;
	var start = Date.now();

	if (this.reportFPS) {
		runFunc = function() {
			try {
				timer += Date.now() - start;
				start = Date.now();
				self.advanceFrame();
				++frames;
				if (frames == 20) {
					self.reportFPS((frames * 1000) / timer);
					frames = 0;
					timer = 0;
				}
			} catch(exception) {
				self.ERROR(exception);
				clearInterval(self.interval);
				this.interval = null;
			}
		};
	} else {
		runFunc = function() {
			try {
				self.advanceFrame();
			} catch(exception) {
				self.ERROR(exception);
				clearInterval(self.interval);
				this.interval = null;
			}
		};
	}
	this.interval = setInterval(runFunc, 1000/60);
};

GameBoyAdvance.prototype.setSavedata = function(data) {
	this.mmu.memory[this.mmu.REGION_CART_SRAM] = new MemoryView(data);
};

GameBoyAdvance.prototype.loadSavedataFromFile = function(saveFile) {
	var reader = new FileReader();
	var self = this;
	reader.onload = function(e) { self.setSavedata(e.target.result); }
	reader.readAsArrayBuffer(saveFile);
};

GameBoyAdvance.prototype.downloadSavedata = function() {
	var sram = this.mmu.memory[this.mmu.REGION_CART_SRAM];
	if (!sram) {
		this.WARN("No save data available");
		return;
	}
	var savedata = ['data:application/octet-stream;base64,'];
	var word;
	var wordstring = [];
	var triplet;
	for (var i = 0; i < this.mmu.SIZE_CART_SRAM; i += 4) {
		word = sram.load32(i);
		wordstring.push(String.fromCharCode(word & 0xFF));
		wordstring.push(String.fromCharCode((word >> 8) & 0xFF));
		wordstring.push(String.fromCharCode((word >> 16) & 0xFF));
		wordstring.push(String.fromCharCode((word >> 24) & 0xFF));
		while (wordstring.length >= 3) {
			triplet = wordstring.splice(0, 3);
			savedata.push(btoa(triplet.join('')));
		}
	};
	var data = savedata.join('');
	window.open(data, this.rom.code + '.sav');
};

GameBoyAdvance.prototype.log = function(message) {};

GameBoyAdvance.prototype.setLogger = function(logger) {
	this.log = logger;
};

GameBoyAdvance.prototype.ERROR = function(error) {
	if (this.logLevel & this.LOG_ERROR) {
		this.log('[ERROR] ' + error);
	}
};

GameBoyAdvance.prototype.WARN = function(warn) {
	if (this.logLevel & this.LOG_WARN) {
		this.log('[WARNING] ' + warn);
	}
};

GameBoyAdvance.prototype.STUB = function(func) {
	if (this.logLevel & this.LOG_STUB) {
		this.log('[STUB] ' + func);
	}
};

GameBoyAdvance.prototype.INFO = function(info) {
	if (this.logLevel & this.LOG_INFO) {
		this.log('[INFO] ' + info);
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
