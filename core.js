function ARMCore() {
	this.SP = 13;
	this.LR = 14;
	this.PC = 15;

	this.MODE_ARM = 0;
	this.MODE_THUMB = 1;

	this.MODE_USER = 0x10;
	this.MODE_FIQ = 0x11;
	this.MODE_IRQ = 0x12;
	this.MODE_SUPERVISOR = 0x13;
	this.MODE_ABORT = 0x17;
	this.MODE_UNDEFINED = 0x1B;
	this.MODE_SYSTEM = 0x1F;

	this.BANK_NONE = 0
	this.BANK_FIQ = 1;
	this.BANK_IRQ = 2;
	this.BANK_SUPERVISOR = 3;
	this.BANK_ABORT = 4;
	this.BANK_UNDEFINED = 5;

	this.UNALLOC_MASK = 0x0FFFFF00;
	this.USER_MASK = 0xF0000000;
	this.PRIV_MASK = 0x000000CF; // This is out of spec, but it seems to be what's done in other implementations
	this.STATE_MASK = 0x00000020;

	this.WORD_SIZE_ARM = 4;
	this.WORD_SIZE_THUMB = 2;

	this.BASE_RESET = 0x00000000;
	this.BASE_UNDEF = 0x00000004;
	this.BASE_SWI = 0x00000008;
	this.BASE_PABT = 0x0000000C;
	this.BASE_DABT = 0x00000010;
	this.BASE_IRQ = 0x00000018;
	this.BASE_FIQ = 0x0000001C;

	this.armCompiler = new ARMCoreArm(this);
	this.thumbCompiler = new ARMCoreThumb(this);
	this.generateConds();
};

ARMCore.prototype.resetCPU = function(startOffset) {
	this.gprs = new Int32Array(16);
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

	this.currentBank = null;
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
	this.irqPending = 0;

	this.cycles = 0;

	this.shifterOperand = 0;
	this.shifterCarryOut = 0;

	this.page = null;
	this.pageId = 0;

	this.instruction;

	var gprs = this.gprs;
	var mmu = this.mmu;
	this.step = function() {
		var instruction;
		if (this.instruction) {
			instruction = this.instruction;
		} else {
			instruction = this.loadInstruction(gprs[this.PC] - this.instructionWidth);
			this.instruction = instruction;
		}
		gprs[this.PC] += this.instructionWidth;
		this.conditionPassed = true;
		instruction();
	
		if (!instruction.writesPC) {
			if (this.instruction) { // We might have gotten an interrupt from the instruction
				if (!instruction.next) {
					instruction.next = this.loadInstruction(gprs[this.PC] - this.instructionWidth);
				}
				this.instruction = instruction.next;
			}
		} else {
			this.instruction = null;
			if (this.conditionPassed) {
				var pc = gprs[this.PC] &= 0xFFFFFFFE;
				if (this.execMode == this.MODE_ARM) {
					mmu.wait32(pc);
					mmu.waitSeq32(pc);
				} else {
					mmu.wait(pc);
					mmu.waitSeq(pc);
				}
				gprs[this.PC] += this.instructionWidth;
			}
		}
		this.irq.updateTimers();
	};
};

ARMCore.prototype.fetchPage = function(address) {
	// FIXME: because this page held onto, it won't get invalidated if we're using it, even if
	// someone else writes over the instructions
	var pageId = address >> this.mmu.ICACHE_PAGE_BITS;
	if (pageId == this.pageId) {
		return;
	}
	this.pageId = pageId;
	this.page = this.mmu.icache[pageId];
	if (!this.page) {
		this.page = {
			thumb: new Array(1 << (this.mmu.ICACHE_PAGE_BITS)),
			arm: new Array(1 << this.mmu.ICACHE_PAGE_BITS - 1)
		}
		this.mmu.icache[pageId] = this.page;
	}
};

ARMCore.prototype.loadInstructionArm = function(address) {
	var next = null;
	this.fetchPage(address);
	var offset = (address & this.mmu.PAGE_MASK) >> 2;
	next = this.page.arm[offset];
	if (next) {
		return next;
	}
	var instruction = this.mmu.load32(address) >>> 0;
	next = this.compileArm(instruction);
	next.next = null;
	this.page.arm[offset] = next;
	return next;
};

ARMCore.prototype.loadInstructionThumb = function(address) {
	var next = null;
	this.fetchPage(address);
	var offset = (address & this.mmu.PAGE_MASK) >> 1;
	next = this.page.thumb[offset];
	if (next) {
		return next;
	}
	var instruction = this.mmu.load16(address);
	next = this.compileThumb(instruction);
	next.next = null;
	this.page.thumb[offset] = next;
	return next;
};

ARMCore.prototype.selectBank = function(mode) {
	switch (mode) {
	case this.MODE_USER:
	case this.MODE_SYSTEM:
		// No banked registers
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
		// Not switching modes after all
		return;
	}
	if (newMode != this.MODE_USER || newMode != this.MODE_SYSTEM) {
		// Switch banked registers
		var newBank = this.selectBank(newMode);
		var oldBank = this.selectBank(this.mode);
		if (newBank != oldBank) {
			// TODO: support FIQ
			if (newMode == this.FIQ || this.mode == this.FIQ) {
				throw 'FIQ mode switching is unimplemented';
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
	return this.mode | (!!this.execMode << 5) | (!!this.cpsrF << 6) | (!!this.cpsrI << 7) |
	       (!!this.cpsrN << 31) | (!!this.cpsrZ << 30) | (!!this.cpsrC << 29) | (!!this.cpsrV << 28);
};

ARMCore.prototype.unpackCPSR = function(spsr) {
	this.switchMode(spsr & 0x0000001F);
	this.switchExecMode(!!(spsr & 0x00000020));
	this.cpsrF = spsr & 0x00000040;
	this.cpsrI = spsr & 0x00000080;
	this.cpsrN = spsr & 0x80000000;
	this.cpsrZ = spsr & 0x40000000;
	this.cpsrC = spsr & 0x20000000;
	this.cpsrV = spsr & 0x10000000;
};

ARMCore.prototype.hasSPSR = function() {
	return this.mode != this.MODE_SYSTEM && this.mode != this.MODE_USER;
};

ARMCore.prototype.raiseIRQ = function() {
	if (this.cpsrI) {
		this.irqPending = true;
		return;
	}
	this.irqPending = false;

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
	return func;
};

ARMCore.prototype.generateConds = function() {
	var cpu = this;
	this.conds = [
		// EQ
		function() {
			return cpu.conditionPassed = cpu.cpsrZ;
		},
		// NE
		function() {
			return cpu.conditionPassed = !cpu.cpsrZ;
		},
		// CS
		function() {
			return cpu.conditionPassed = cpu.cpsrC;
		},
		// CC
		function() {
			return cpu.conditionPassed = !cpu.cpsrC;
		},
		// MI
		function() {
			return cpu.conditionPassed = cpu.cpsrN;
		},
		// PL
		function() {
			return cpu.conditionPassed = !cpu.cpsrN;
		},
		// VS
		function() {
			return cpu.conditionPassed = cpu.cpsrV;
		},
		// VC
		function() {
			return cpu.conditionPassed = !cpu.cpsrV;
		},
		// HI
		function () {
			return cpu.conditionPassed = cpu.cpsrC && !cpu.cpsrZ;
		},
		// LS
		function () {
			return cpu.conditionPassed = !cpu.cpsrC || cpu.cpsrZ;
		},
		// GE
		function () {
			return cpu.conditionPassed = !cpu.cpsrN == !cpu.cpsrV;
		},
		// LT
		function () {
			return cpu.conditionPassed = !cpu.cpsrN != !cpu.cpsrV;
		},
		// GT
		function () {
			return cpu.conditionPassed = !cpu.cpsrZ && !cpu.cpsrN == !cpu.cpsrV;
		},
		// LE
		function () {
			return cpu.conditionPassed = cpu.cpsrZ || !cpu.cpsrN != !cpu.cpsrV;
		},
		// AL
		null,
		null
	]
}

ARMCore.prototype.barrelShiftImmediate = function(shiftType, immediate, rm) {
	var cpu = this;
	var gprs = this.gprs;
	var shiftOp = this.badOp;
	switch (shiftType) {
	case 0x00000000:
		// LSL
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm] << immediate;
				cpu.shifterCarryOut = gprs[rm] & (1 << (32 - immediate));
			};
		} else {
			// This boils down to no shift
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm];
				cpu.shifterCarryOut = cpu.cpsrC;
			};
		}
		break;
	case 0x00000020:
		// LSR
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm] >>> immediate;
				cpu.shifterCarryOut = gprs[rm] & (1 << (immediate - 1));
			};
		} else {
			shiftOp = function() {
				cpu.shifterOperand = 0;
				cpu.shifterCarryOut = gprs[rm] & 0x80000000;
			};
		}
		break;
	case 0x00000040:
		// ASR
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm] >> immediate;
				cpu.shifterCarryOut = gprs[rm] & (1 << (immediate - 1));
			};
		} else {
			shiftOp = function() {
				cpu.shifterCarryOut = gprs[rm] & 0x80000000;
				if (cpu.shifterCarryOut) {
					cpu.shifterOperand = 0xFFFFFFFF;
				} else {
					cpu.shifterOperand = 0;
				}
			};
		}
		break;
	case 0x00000060:
		// ROR
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = (gprs[rm] >>> immediate) | (gprs[rm] << (32 - immediate));
				cpu.shifterCarryOut = gprs[rm] & (1 << (immediate - 1));
			};
		} else {
			// RRX
			shiftOp = function() {
				cpu.shifterOperand = (!!cpu.cpsrC << 31) | (gprs[rm] >>> 1);
				cpu.shifterCarryOut =  gprs[rm] & 0x00000001;
			};
		}
		break;
	}
	return shiftOp;
}

ARMCore.prototype.compileArm = function(instruction) {
	var op = this.badOp(instruction);
	var i = instruction & 0x0E000000;
	var cpu = this;
	var gprs = this.gprs;

	var condOp = this.conds[(instruction & 0xF0000000) >>> 28];
	if ((instruction & 0x0FFFFFF0) == 0x012FFF10) {
		// BX
		var rm = instruction & 0xF;
		op = this.armCompiler.constructBX(rm, condOp);
		op.writesPC = true;
	} else if (!(instruction & 0x0C000000) && (i == 0x02000000 || (instruction & 0x00000090) != 0x00000090)) {
		var opcode = instruction & 0x01E00000;
		var s = instruction & 0x00100000;
		var shiftsRs = false;
		if ((opcode & 0x01800000) == 0x01000000 && !s) {
			var r = instruction & 0x00400000;
			if ((instruction & 0x00B0F000) == 0x0020F000) {
				// MSR
				var rm = instruction & 0x0000000F;
				var immediate = instruction & 0x000000FF;
				var rotateImm = (instruction & 0x00000F00) >> 7;
				immediate = (immediate >> rotateImm) | (immediate << (32 - rotateImm));
				op = this.armCompiler.constructMSR(rm, r, instruction, immediate, condOp);
				op.writesPC = false;
			} else if ((instruction & 0x00BF0000) == 0x000F0000) {
				// MRS
				var rd = (instruction & 0x0000F000) >> 12;
				op = this.armCompiler.constructMRS(rd, r, condOp);
				op.writesPC = rd == this.PC;
			}
		} else {
			// Data processing/FSR transfer
			var rn = (instruction & 0x000F0000) >> 16;
			var rd = (instruction & 0x0000F000) >> 12;

			// Parse shifter operand
			var shiftType = instruction & 0x00000060;
			var rm = instruction & 0x0000000F;
			var shiftOp = function() {
				throw 'BUG: invalid barrel shifter';
			};
			if (instruction & 0x02000000) {
				var immediate = instruction & 0x000000FF;
				var rotate = (instruction & 0x00000F00) >> 7;
				shiftOp = function() {
					if (rotate == 0) {
						cpu.shifterOperand = immediate;
						cpu.shifterCarryOut = cpu.cpsrC;
					} else {
						cpu.shifterOperand = (immediate >> rotate) | (immediate << (32 - rotate));
						cpu.shifterCarryOut = cpu.shifterOperand & 0x80000000;
					}
				};
			} else if (instruction & 0x00000010) {
				var rs = (instruction & 0x00000F00) >> 8;
				shiftsRs = true;
				switch (shiftType) {
				case 0x00000000:
					// LSL
					shiftOp = function() {
						++cpu.cycles;
						var shift = gprs[rs] & 0xFF;
						if (shift == 0) {
							cpu.shifterOperand = gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (shift < 32) {
							cpu.shifterOperand = gprs[rm] << shift;
							cpu.shifterCarryOut = gprs[rm] & (1 << (32 - shift));
						} else if (shift == 32) {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = gprs[rm] & 1;
						} else {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = 0;
						}
					};
					break;
				case 0x00000020:
					// LSR
					shiftOp = function() {
						++cpu.cycles;
						var shift = gprs[rs] & 0xFF;
						if (shift == 0) {
							cpu.shifterOperand = gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (shift < 32) {
							cpu.shifterOperand = gprs[rm] >>> shift;
							cpu.shifterCarryOut = gprs[rm] & (1 << (shift - 1));
						} else if (shift == 32) {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = gprs[rm] & 0x80000000;
						} else {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = 0;
						}
					};
					break;
				case 0x00000040:
					// ASR
					shiftOp = function() {
						++cpu.cycles;
						var shift = gprs[rs] & 0xFF;
						if (shift == 0) {
							cpu.shifterOperand = gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (shift < 32) {
							cpu.shifterOperand = gprs[rm] >> shift;
							cpu.shifterCarryOut = gprs[rm] & (1 << (shift - 1));
						} else if (gprs[rm] & 0x80000000) {
							cpu.shifterOperand = 0xFFFFFFFF;
							cpu.shifterCarryOut = 0x80000000;
						} else {
							cpu.shifterOperand = 0;
							cpu.shifterCarryOut = 0;
						}
					};
					break;
				case 0x00000060:
					// ROR
					shiftOp = function() {
						++cpu.cycles;
						var shift = gprs[rs] & 0xFF;
						var rotate = shift & 0x1F;
						if (shift == 0) {
							cpu.shifterOperand = gprs[rm];
							cpu.shifterCarryOut = cpu.cpsrC;
						} else if (rotate) {
							cpu.shifterOperand = (gprs[rm] >>> rotate) | (gprs[rm] << (32 - rotate));
							cpu.shifterCarryOut = gprs[rm] & (1 << (rotate - 1));
						} else {
							cpu.shifterOperand = gprs[rm];
							cpu.shifterCarryOut = gprs[rm] & 0x80000000;
						}
					};
					break;
				}
			} else {
				var immediate = (instruction & 0x00000F80) >> 7;
				shiftOp = this.barrelShiftImmediate(shiftType, immediate, rm);
			}

			switch (opcode) {
			case 0x00000000:
				// AND
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] & cpu.shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
							cpu.cpsrC = cpu.shifterCarryOut;
						}
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] & cpu.shifterOperand;
					};
				}
				break;
			case 0x00200000:
				// EOR
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
							cpu.cpsrC = cpu.shifterCarryOut;
						}
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
					};
				}
				break;
			case 0x00400000:
				// SUB
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var d = gprs[rn] - cpu.shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = d & 0x80000000;
							cpu.cpsrZ = !(d & 0xFFFFFFFF);
							cpu.cpsrC = (gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
							cpu.cpsrV = (gprs[rn] & 0x80000000) != (cpu.shifterOperand & 0x80000000) &&
										(gprs[rn] & 0x80000000) != (d & 0x80000000);
						}
						gprs[rd] = d;
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var d = gprs[rn] - cpu.shifterOperand;
						gprs[rd] = d;
					};
				}
				break;
			case 0x00600000:
				// RSB
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var d = cpu.shifterOperand - gprs[rn];
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = d & 0x80000000;
							cpu.cpsrZ = !(d & 0xFFFFFFFF);
							cpu.cpsrC = (cpu.shifterOperand >>> 0) >= (gprs[rn] >>> 0);
							cpu.cpsrV = (cpu.shifterOperand & 0x80000000) != (gprs[rn] & 0x80000000) &&
										(cpu.shifterOperand & 0x80000000) != (d & 0x80000000);
						}
						gprs[rd] = d;
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var d = cpu.shifterOperand - gprs[rn];
						gprs[rd] = d;
					};
				}
				break;
			case 0x00800000:
				// ADD
				op = function() {
					cpu.mmu.waitSeq32(gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var d = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
					if (s) {
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = d & 0x80000000;
							cpu.cpsrZ = !(d & 0xFFFFFFFF);
							cpu.cpsrC = d > 0xFFFFFFFF;
							cpu.cpsrV = (gprs[rn] & 0x80000000) == (cpu.shifterOperand & 0x80000000) &&
										(gprs[rn] & 0x80000000) != (d & 0x80000000) &&
										(cpu.shifterOperand & 0x80000000) != (d & 0x80000000);
						}
					}
					gprs[rd] = d;
				};
				break;
			case 0x00A00000:
				// ADC
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
						var d = (gprs[rn] >>> 0) + shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = d & 0x80000000;
							cpu.cpsrZ = !(d & 0xFFFFFFFF);
							cpu.cpsrC = d > 0xFFFFFFFF;
							cpu.cpsrV = (gprs[rn] & 0x80000000) == (shifterOperand & 0x80000000) &&
										(gprs[rn] & 0x80000000) != (d & 0x80000000) &&
										(shifterOperand & 0x80000000) != (d & 0x80000000);
						}
						gprs[rd] = d;
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var shifterOperand = (cpu.shifterOperand >>> 0) + !!cpu.cpsrC;
						var d = (gprs[rn] >>> 0) + shifterOperand;
						gprs[rd] = d;
					};
				}
				break;
			case 0x00C00000:
				// SBC
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
						var d = (gprs[rn] >>> 0) - shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = d & 0x80000000;
							cpu.cpsrZ = !(d & 0xFFFFFFFF);
							cpu.cpsrC = d > 0xFFFFFFFF;
							cpu.cpsrV = (gprs[rn] & 0x80000000) != (shifterOperand & 0x80000000) &&
										(gprs[rn] & 0x80000000) != (d & 0x80000000);
						}
						gprs[rd] = d;
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var shifterOperand = (cpu.shifterOperand >>> 0) + !cpu.cpsrC;
						var d = (gprs[rn] >>> 0) - shifterOperand;
						gprs[rd] = d;
					};
				}
				break;
			case 0x00E00000:
				// RSC
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var n = (gprs[rn] >>> 0) + !cpu.cpsrC;
						var d = (cpu.shifterOperand >>> 0) - n;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = d & 0x80000000;
							cpu.cpsrZ = !(d & 0xFFFFFFFF);
							cpu.cpsrC = d > 0xFFFFFFFF;
							cpu.cpsrV = (cpu.shifterOperand & 0x80000000) != (n & 0x80000000) &&
										(cpu.shifterOperand & 0x80000000) != (d & 0x80000000);
						}
						gprs[rd] = d;
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						var n = (gprs[rn] >>> 0) + !cpu.cpsrC;
						var d = (cpu.shifterOperand >>> 0) - n;
						gprs[rd] = d;
					};
				}
				break;
			case 0x01000000:
				// TST
				op = function() {
					cpu.mmu.waitSeq32(gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = gprs[rn] & cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = cpu.shifterCarryOut;
				};
				break;
			case 0x01200000:
				// TEQ
				op = function() {
					cpu.mmu.waitSeq32(gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = gprs[rn] ^ cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = cpu.shifterCarryOut;
				};
				break;
			case 0x01400000:
				// CMP
				op = function() {
					cpu.mmu.waitSeq32(gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = gprs[rn] - cpu.shifterOperand;
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = (gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
					cpu.cpsrV = (gprs[rn] & 0x80000000) != (cpu.shifterOperand & 0x80000000) &&
								(gprs[rn] & 0x80000000) != (aluOut & 0x80000000);
				};
				break;
			case 0x01600000:
				// CMN
				op = function() {
					cpu.mmu.waitSeq32(gprs[cpu.PC]);
					if (condOp && !condOp()) {
						return;
					}
					shiftOp();
					var aluOut = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
					cpu.cpsrN = aluOut & 0x80000000;
					cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
					cpu.cpsrC = aluOut > 0xFFFFFFFF;
					cpu.cpsrV = (gprs[rn] & 0x80000000) == (cpu.shifterOperand & 0x80000000) &&
								(gprs[rn] & 0x80000000) != (aluOut & 0x80000000) &&
								(cpu.shifterOperand & 0x80000000) != (aluOut & 0x80000000);
				};
				break;
			case 0x01800000:
				// ORR
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] | cpu.shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
							cpu.cpsrC = cpu.shifterCarryOut;
						}
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] | cpu.shifterOperand;
					}
				}
				break;
			case 0x01A00000:
				// MOV
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = cpu.shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
							cpu.cpsrC = cpu.shifterCarryOut;
						}
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = cpu.shifterOperand;
					};
				}
				break;
			case 0x01C00000:
				// BIC
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
							cpu.cpsrC = cpu.shifterCarryOut;
						}
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
					};
				}
				break;
			case 0x01E00000:
				// MVN
				if (s) {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = ~cpu.shifterOperand;
						if (rd == cpu.PC && cpu.hasSPSR()) {
							cpu.unpackCPSR(cpu.spsr);
						} else {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
							cpu.cpsrC = cpu.shifterCarryOut;
						}
					};
				} else {
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						shiftOp();
						gprs[rd] = ~cpu.shifterOperand;
					};
				}
				break;
			}
			op.writesPC = rd == this.PC;
		}
	} else if ((instruction & 0x0FB00FF0) == 0x01000090) {
		// Single data swap
	} else {
		var SHIFT_32 = 1/0x100000000;
		switch (i) {
		case 0x00000000:
			if ((instruction & 0x010000F0) == 0x00000090) {
				// Multiplies
				var s = instruction & 0x00100000;
				var rd = (instruction & 0x000F0000) >> 16;
				var rn = (instruction & 0x0000F000) >> 12;
				var rs = (instruction & 0x00000F00) >> 8;
				var rm = instruction & 0x0000000F;
				switch (instruction & 0x00E00000) {
				case 0x00000000:
					// MUL
					op = this.armCompiler.constructMUL(rd, rs, rm, s, condOp);
					break;
				case 0x00200000:
					// MLA
					op = this.armCompiler.constructMLA(rd, rn, rs, rm, s, condOp);
					break;
				case 0x00800000:
					// UMULL
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						cpu.cycles += 5; // TODO: better timing
						var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
						var lo = ((gprs[rm] & 0x0000FFFF) >>> 0) * (gprs[rs] >>> 0);
						gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
						gprs[rd] = (hi * SHIFT_32 + lo * SHIFT_32) >>> 0;
						if (s) {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
						}
					};
					break;
				case 0x00A00000:
					// UMLAL
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						cpu.cycles += 6; // TODO: better timing
						var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
						var lo = ((gprs[rm] & 0x0000FFFF) >>> 0) * (gprs[rs] >>> 0);
						var mid = (hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF);
						gprs[rn] += mid & 0xFFFFFFFF;
						gprs[rd] += (hi * SHIFT_32 + lo * SHIFT_32 + mid * SHIFT_32) >>> 0;
						if (s) {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
						}
					};
					break;
				case 0x00C00000:
					// SMULL
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						cpu.cycles += 5; // TODO: better timing
						var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
						var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
						gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
						gprs[rd] = Math.floor(hi * SHIFT_32 + lo * SHIFT_32);
						if (s) {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
						}
					};
					break;
				case 0x00E00000:
					// SMLAL
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						cpu.cycles += 6; // TODO: better timing
						var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
						var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
						var mid = (hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF);
						gprs[rn] += mid & 0xFFFFFFFF;
						gprs[rd] += Math.floor(hi * SHIFT_32 + lo * SHIFT_32 + mid * SHIFT_32);
						if (s) {
							cpu.cpsrN = gprs[rd] & 0x80000000;
							cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
						}
					};
					break;
				}
				op.touchesPC = rd == this.PC;
			} else {
				// Halfword and signed byte data transfer
				var load = instruction & 0x00100000;
				var rn = (instruction & 0x000F0000) >> 16;
				var rd = (instruction & 0x0000F000) >> 12;
				var hiOffset = (instruction & 0x00000F00) >> 4;
				var loOffset = rm = instruction & 0x0000000F;
				var h = instruction & 0x00000020;
				var s = instruction & 0x00000040;
				var w = instruction & 0x00200000;
				var i = instruction & 0x00400000;
				var u = instruction & 0x00800000;
				var p = instruction & 0x01000000;

				var address;
				if (i) {
					var immediate = loOffset | hiOffset;
					if (p) {
						if (u) {
							address = function() {
								var addr = gprs[rn] + immediate;
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = gprs[rn] - immediate;
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							};
						}
					} else {
						if (u) {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									gprs[rn] += immediate;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									gprs[rn] -= immediate;
								}
								return addr;
							};
						}
					}
				} else {
					var rn = (instruction & 0x000F0000) >> 16;
					if (p) {
						if (u) {
							address = function() {
								var addr = gprs[rn] + gprs[rm];
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = gprs[rn] - gprs[rm];
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							};
						}
					} else {
						if (u) {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									gprs[rn] += gprs[rm];
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									gprs[rn] -= gprs[rm];
								}
								return addr;
							};
						}
					}
				}
				address.writesPC = w && rn == this.PC;

				if ((instruction & 0x00000090) == 0x00000090) {
					if (load) {
						// Load [signed] halfword/byte
						if (h) {
							if (s) {
								op = function() {
									cpu.mmu.waitSeq32(gprs[cpu.PC]);
									if (condOp && !condOp()) {
										return;
									}
									var addr = address();
									cpu.mmu.wait32(addr);
									++cpu.cycles;
									gprs[rd] = cpu.mmu.load16(addr);
								};
							} else {
								op = function() {
									cpu.mmu.waitSeq32(gprs[cpu.PC]);
									if (condOp && !condOp()) {
										return;
									}
									var addr = address();
									cpu.mmu.wait32(addr);
									++cpu.cycles;
									gprs[rd] = cpu.mmu.loadU16(addr);
								};
							}
						} else {
							if (s) {
								op = function() {
									cpu.mmu.waitSeq32(gprs[cpu.PC]);
									if (condOp && !condOp()) {
										return;
									}
									var addr = address();
									cpu.mmu.wait32(addr);
									++cpu.cycles;
									gprs[rd] = cpu.mmu.load8(addr);
								};
							}
						}
					} else if (!s && h) {
						// Store halfword
						op = function() {
							if (condOp && !condOp()) {
								cpu.mmu.waitSeq32(gprs[cpu.PC]);
								return;
							}
							var addr = address();
							cpu.mmu.store16(addr, gprs[rd]);
							cpu.mmu.wait32(addr);
							cpu.mmu.wait32(gprs[cpu.PC]);
						};
					}
				}
				op.writesPC = rd == this.PC || address.writesPC;
			}
			break;
		case 0x04000000:
		case 0x06000000:
			// LDR/STR
			var rn = (instruction & 0x000F0000) >> 16;
			var rd = (instruction & 0x0000F000) >> 12;
			var load = instruction & 0x00100000;
			var w = instruction & 0x00200000;
			var b = instruction & 0x00400000;
			var u = instruction & 0x00800000;
			var p = instruction & 0x01000000;
			var i = instruction & 0x02000000;

			var address = function() {
				throw "Unimplemented memory access: 0x" + instruction.toString(16);
			};
			if (i) {
				// Register offset
				var rm = instruction & 0x0000000F;
				var shiftType = instruction & 0x00000060;
				var shiftImmediate = (instruction & 0x00000F80) >> 7;
				if (p) {
					if (shiftType || shiftImmediate) {
						var shiftOp = this.barrelShiftImmediate(shiftType, shiftImmediate, rm);
						if (u) {
							address = function() {
								shiftOp();
								var addr = gprs[rn] + cpu.shifterOperand;
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							}
						} else {
							address = function() {
								shiftOp();
								var addr = gprs[rn] - cpu.shifterOperand;
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							}
						}
					} else {
						if (u) {
							address = function() {
								var addr = gprs[rn] + gprs[rm];
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = gprs[rn] - gprs[rm];
								if (w && (!condOp || condOp())) {
									gprs[rn] = addr;
								}
								return addr;
							};
						}
						address.writesPC = w && rn == this.PC;
					}
				} else {
					if (shiftType || shiftImmediate) {
						var shiftOp = this.barrelShiftImmediate(shiftType, shiftImmediate, rm);
						if (u) {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									shiftOp();
									gprs[rn] += cpu.shifterOperand;
								}
								return addr;
							}
						} else {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									shiftOp();
									gprs[rn] -= cpu.shifterOperand;
								}
								return addr;
							}
						}
					} else {
						if (u) {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									gprs[rn] += gprs[rm];
								}
								return addr;
							};
						} else {
							address = function() {
								var addr = gprs[rn];
								if (!condOp || condOp()) {
									gprs[rn] -= gprs[rm];
								}
								return addr;
							};
						}
						address.writesPC = rn == this.PC;
					}
				}
			} else {
				// Immediate
				var offset = instruction & 0x00000FFF;
				if (p) {
					if (u) {
						address = function() {
							var addr = gprs[rn] + offset;
							if (w && (!condOp || condOp())) {
								gprs[rn] = addr;
							}
							return addr;
						};
					} else {
						address = function() {
							var addr = gprs[rn] - offset;
							if (w && (!condOp || condOp())) {
								gprs[rn] = addr;
							}
							return addr;
						};
					}
					address.writesPC = w && rn == this.PC;
				} else if (!w) {
					if (u) {
						address = function() {
							var addr = gprs[rn];
							if (!condOp || condOp()) {
								gprs[rn] += offset;
							}
							return addr;
						};
					} else {
						address = function() {
							var addr = gprs[rn];
							if (!condOp || condOp()) {
								gprs[rn] -= offset;
							}
							return addr;
						};
					}
					address.writesPC = rn == this.PC;
				}
			}
			if (load) {
				if (b) {
					// LDRB
					op = function() {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						if (condOp && !condOp()) {
							return;
						}
						var addr = address();
						cpu.mmu.wait32(addr);
						++cpu.cycles;
						gprs[rd] = cpu.mmu.loadU8(addr);
					};
				} else {
					// LDR
					op = function() {
						if (condOp && !condOp()) {
							cpu.mmu.waitSeq32(gprs[cpu.PC]);
							return;
						}
						var addr = address();
						cpu.mmu.wait32(addr);
						cpu.mmu.wait32(gprs[cpu.PC]);
						gprs[rd] = cpu.mmu.load32(addr);
					};
				}
			} else {
				if (b) {
					// STRB
					op = function() {
						if (condOp && !condOp()) {
							cpu.mmu.waitSeq32(gprs[cpu.PC]);
							return;
						}
						var addr = address();
						cpu.mmu.store8(addr, gprs[rd]);
						cpu.mmu.wait32(addr);
						cpu.mmu.wait32(gprs[cpu.PC]);
					};
				} else {
					// STR
					op = function() {
						if (condOp && !condOp()) {
							cpu.mmu.waitSeq32(gprs[cpu.PC]);
							return;
						}
						var addr = address();
						cpu.mmu.store32(addr, gprs[rd]);
						cpu.mmu.wait32(addr);
						cpu.mmu.wait32(gprs[cpu.PC]);
					};
				}
			}
			op.writesPC = rd == this.PC || address.writesPC;
			break;
		case 0x08000000:
			// Block data transfer
			var load = instruction & 0x00100000;
			var w = instruction & 0x00200000;
			var user = instruction & 0x00400000;
			var u = instruction & 0x00800000;
			var p = instruction & 0x01000000;
			var rs = instruction & 0x0000FFFF;
			var rn = (instruction & 0x000F0000) >> 16;

			var address;
			var immediate = 0;
			var offset = 0;
			if (u) {
				if (p) {
					immediate = -4;
				}
				for (var m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
					if (rs & m) {
						offset += 4;
					}
				}
			} else {
				if (!p) {
					immediate = 4;
				}
				for (var m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
					if (rs & m) {
						immediate -= 4;
						offset -= 4;
					}
				}
			}
			address = function() {
				var addr = gprs[rn] + immediate;
				if (w) {
					gprs[rn] += offset;
				}
				return addr;
			}
			if (load) {
				// LDM
				op = this.armCompiler.constructLDM(rs, address, condOp);
				op.writesPC = rs & (1 << 15);
			} else {
				// STM
				op = this.armCompiler.constructSTM(rs, address, condOp);
				op.writesPC = false;
			}
			break;
		case 0x0A000000:
			// Branch
			var immediate = instruction & 0x00FFFFFF;
			if (immediate & 0x00800000) {
				immediate |= 0xFF000000;
			}
			immediate <<= 2;
			var link = instruction & 0x01000000;
			if (link) {
				op = this.armCompiler.constructBL(immediate, condOp);
			} else {
				op = this.armCompiler.constructB(immediate, condOp);
			}
			op.writesPC = true;
			break;
		case 0x0C000000:
			// Coprocessor data transfer
			break;
		case 0x0E000000:
			// Coprocessor data operation/SWI
			if ((instruction & 0x0F000000) == 0x0F000000) {
				// SWI
				var immediate = (instruction & 0x00FFFFFF);
				op = function() {
					if (condOp && !condOp()) {
						cpu.mmu.waitSeq32(gprs[cpu.PC]);
						return;
					}
					cpu.irq.swi32(immediate);
					cpu.mmu.waitSeq32(gprs[cpu.PC]);
					// Wait on BIOS
					// FIXME: Is this correct?
					cpu.mmu.wait32(0);
					cpu.mmu.waitSeq32(0);
				}
				op.writesPC = false;
			}
			break;
		default:
			throw 'Bad opcode: 0x' + instruction.toString(16);
		}
	}

	op.execMode = this.MODE_ARM;
	return op;
};

ARMCore.prototype.compileThumb = function(instruction) {
	var op = this.badOp(instruction & 0xFFFF);
	var cpu = this;
	var gprs = this.gprs;
	if ((instruction & 0xFC00) == 0x4000) {
		// Data-processing register
		var rm = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x03C0) {
		case 0x0000:
			// AND
			op = this.thumbCompiler.constructAND(rd, rm);
			break;
		case 0x0040:
			// EOR
			op = this.thumbCompiler.constructEOR(rd, rm);
			break;
		case 0x0080:
			// LSL(2)
			op = this.thumbCompiler.constructLSL2(rd, rm);
			break;
		case 0x00C0:
			// LSR(2)
			op = this.thumbCompiler.constructLSR2(rd, rm);
			break;
		case 0x0100:
			// ASR(2)
			op = this.thumbCompiler.constructASR2(rd, rm);
			break;
		case 0x0140:
			// ADC
			op = this.thumbCompiler.constructADC(rd, rm);
			break;
		case 0x0180:
			// SBC
			op = this.thumbCompiler.constructSBC(rd, rm);
			break;
		case 0x01C0:
			// ROR
			op = this.thumbCompiler.constructROR(rd, rm);
			break;
		case 0x0200:
			// TST
			op = this.thumbCompiler.constructTST(rd, rm);
			break;
		case 0x0240:
			// NEG
			op = this.thumbCompiler.constructNEG(rd, rm);
			break;
		case 0x0280:
			// CMP(2)
			op = this.thumbCompiler.constructCMP2(rd, rm);
			break;
		case 0x02C0:
			// CMN
			op = this.thumbCompiler.constructCMN(rd, rm);
			break;
		case 0x0300:
			// ORR
			op = this.thumbCompiler.constructORR(rd, rm);
			break;
		case 0x0340:
			// MUL
			op = this.thumbCompiler.constructMUL(rd, rm);
			break;
		case 0x0380:
			// BIC
			op = this.thumbCompiler.constructBIC(rd, rm);
			break;
		case 0x03C0:
			// MVN
			op = this.thumbCompiler.constructMVN(rd, rm);
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xFC00) == 0x4400) {
		// Special data processing / branch/exchange instruction set
		var rm = (instruction & 0x0078) >> 3;
		var rn = instruction & 0x0007;
		var h1 = instruction & 0x0080;
		var rd = rn | (h1 >> 4);
		switch (instruction & 0x0300) {
		case 0x0000:
			// ADD(4)
			op = this.thumbCompiler.constructADD4(rd, rm)
			op.writesPC = rd == this.PC;
			break;
		case 0x0100:
			// CMP(3)
			op = this.thumbCompiler.constructCMP3(rd, rm);
			op.writesPC = false;
			break;
		case 0x0200:
			// MOV(3)
			op = this.thumbCompiler.constructMOV3(rd, rm);
			op.writesPC = rd == this.PC;
			break;
		case 0x0300:
			// BX
			op = this.thumbCompiler.constructBX(rd, rm);
			op.writesPC = true;
			break;
		}
	} else if ((instruction & 0xF800) == 0x1800) {
		// Add/subtract
		var rm = (instruction & 0x01C0) >> 6;
		var rn = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x0600) {
		case 0x0000:
			// ADD(3)
			op = this.thumbCompiler.constructADD3(rd, rn, rm);
			break;
		case 0x0200:
			// SUB(3)
			op = this.thumbCompiler.constructSUB3(rd, rn, rm);
			break;
		case 0x0400:
			var immediate = (instruction & 0x01C0) >> 6;
			if (immediate) {
				// ADD(1)
				op = this.thumbCompiler.constructADD1(rd, rn, immediate);
			} else {
				// MOV(2)
				op = this.thumbCompiler.constructMOV2(rd, rn, rm);
			}
			break;
		case 0x0600:
			// SUB(1)
			var immediate = (instruction & 0x01C0) >> 6;
			op = this.thumbCompiler.constructSUB1(rd, rn, immediate);
			break;
		}
		op.writesPC = false;
	} else if (!(instruction & 0xE000)) {
		// Shift by immediate
		var rd = instruction & 0x0007;
		var rm = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 6;
		switch (instruction & 0x1800) {
		case 0x0000:
			// LSL(1)
			op = this.thumbCompiler.constructLSL1(rd, rm, immediate);
			break;
		case 0x0800:
			// LSR(1)
			op = this.thumbCompiler.constructLSR1(rd, rm, immediate);
			break;
		case 0x1000:
			// ASR(1)
			op = this.thumbCompiler.constructASR1(rd, rm, immediate);
			break;
		case 0x1800:
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xE000) == 0x2000) {
		// Add/subtract/compare/move immediate
		var immediate = instruction & 0x00FF;
		var rn = (instruction & 0x0700) >> 8;
		switch (instruction & 0x1800) {
		case 0x0000:
			// MOV(1)
			op = this.thumbCompiler.constructMOV1(rn, immediate);
			break;
		case 0x0800:
			// CMP(1)
			op = this.thumbCompiler.constructCMP1(rn, immediate);
			break;
		case 0x1000:
			// ADD(2)
			op = this.thumbCompiler.constructADD2(rn, immediate);
			break;
		case 0x1800:
			// SUB(2)
			op = this.thumbCompiler.constructSUB2(rn, immediate);
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xF800) == 0x4800) {
		// LDR(3)
		var rd = (instruction & 0x0700) >> 8;
		var immediate = (instruction & 0x00FF) << 2;
		op = this.thumbCompiler.constructLDR3(rd, immediate);
		op.writesPC = false;
	} else if ((instruction & 0xF000) == 0x5000) {
		// Load and store with relative offset
		var rd = instruction & 0x0007;
		var rn = (instruction & 0x0038) >> 3;
		var rm = (instruction & 0x01C0) >> 6;
		var opcode = instruction & 0x0E00;
		switch (opcode) {
		case 0x0000:
			// STR(2)
			op = this.thumbCompiler.constructSTR2(rd, rn, rm);
			break;
		case 0x0200:
			// STRH(2)
			op = this.thumbCompiler.constructSTRH2(rd, rn, rm);
			break;
		case 0x0400:
			// STRB(2)
			op = this.thumbCompiler.constructSTRB2(rd, rn, rm);
			break;
		case 0x0600:
			// LDRSB
			op = this.thumbCompiler.constructLDRSB(rd, rn, rm);
			break;
		case 0x0800:
			// LDR(2)
			op = this.thumbCompiler.constructLDR2(rd, rn, rm);
			break;
		case 0x0A00:
			// LDRH(2)
			op = this.thumbCompiler.constructLDRH2(rd, rn, rm);
			break;
		case 0x0C00:
			// LDRB(2)
			op = this.thumbCompiler.constructLDRB2(rd, rn, rm);
			break;
		case 0x0E00:
			// LDRSH
			op = this.thumbCompiler.constructLDRSH(rd, rn, rm);
			break;
		}
	} else if ((instruction & 0xE000) == 0x6000) {
		// Load and store with immediate offset
		var rd = instruction & 0x0007;
		var rn = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 4;
		var b = instruction & 0x1000;
		if (b) {
			immediate >>= 2;
		}
		var load = instruction & 0x0800;
		if (load) {
			if (b) {
				// LDRB(1)
				op = this.thumbCompiler.constructLDRB1(rd, rn, immediate);
			} else {
				// LDR(1)
				op = this.thumbCompiler.constructLDR1(rd, rn, immediate);
			}
		} else {
			if (b) {
				// STRB(1)
				op = this.thumbCompiler.constructSTRB1(rd, rn, immediate);
			} else {
				// STR(1)
				op = this.thumbCompiler.constructSTR1(rd, rn, immediate);
			}
		}
		op.writesPC = false;
	} else if ((instruction & 0xF600) == 0xB400) {
		// Push and pop registers
		var r = instruction & 0x0100;
		var rs = instruction & 0x00FF;
		if (instruction & 0x0800) {
			// POP
			op = this.thumbCompiler.constructPOP(rs, r);
			op.writesPC = r;
		} else {
			// PUSH
			op = this.thumbCompiler.constructPUSH(rs, r);
			op.writesPC = false;
		}
	} else if (instruction & 0x8000) {
		switch (instruction & 0x7000) {
		case 0x0000:
			// Load and store halfword
			var rd = instruction & 0x0007;
			var rn = (instruction & 0x0038) >> 3;
			var immediate = (instruction & 0x07C0) >> 5;
			if (instruction & 0x0800) {
				// LDRH(1)
				op = this.thumbCompiler.constructLDRH1(rd, rn, immediate);
			} else {
				// STRH(1)
				op = this.thumbCompiler.constructSTRH1(rd, rn, immediate);
			}
			op.writesPC = false;
			break;
		case 0x1000:
			// SP-relative load and store
			var rd = (instruction & 0x0700) >> 8;
			var immediate = (instruction & 0x00FF) << 2;
			var load = instruction & 0x0800;
			if (load) {
				// LDR(4)
				op = this.thumbCompiler.constructLDR4(rd, immediate);
			} else {
				// STR(3)
				op = this.thumbCompiler.constructSTR3(rd, immediate);
			}
			op.writesPC = false;
			break;
		case 0x2000:
			// Load address
			var rd = (instruction & 0x0700) >> 8;
			var immediate = (instruction & 0x00FF) << 2;
			if (instruction & 0x0800) {
				// ADD(6)
				op = this.thumbCompiler.constructADD6(rd, immediate);
			} else {
				// ADD(5)
				op = this.thumbCompiler.constructADD5(rd, immediate);
			}
			op.writesPC = false;
			break;
		case 0x3000:
			// Miscellaneous
			if (!(instruction & 0x0F00)) {
				// Adjust stack pointer
				// ADD(7)/SUB(4)
				var b = instruction & 0x0080;
				var immediate = (instruction & 0x7F) << 2;
				if (b) {
					immediate = -immediate;
				}
				op = this.thumbCompiler.constructADD7(immediate)
				op.writesPC = false;
			}
			break;
		case 0x4000:
			// Multiple load and store
			var rn = (instruction & 0x0700) >> 8;
			var rs = instruction & 0x00FF;
			if (instruction & 0x0800) {
				// LDMIA
				op = this.thumbCompiler.constructLDMIA(rn, rs);
			} else {
				// STMIA
				op = this.thumbCompiler.constructSTMIA(rn, rs);
			}
			op.writesPC = false;
			break;
		case 0x5000:
			// Conditional branch
			var cond = (instruction & 0x0F00) >> 8;
			var immediate = (instruction & 0x00FF);
			if (cond == 0xF) {
				// SWI
				op = this.thumbCompiler.constructSWI(immediate);
				op.writesPC = false;
			} else {
				// B(1)
				if (instruction & 0x0080) {
					immediate |= 0xFFFFFF00;
				}
				immediate <<= 1;
				var condOp = this.conds[cond];
				op = this.thumbCompiler.constructB1(immediate, condOp);
				op.writesPC = true;
			}
			break;
		case 0x6000:
		case 0x7000:
			// BL(X)
			var immediate = instruction & 0x07FF;
			var h = instruction & 0x1800;
			switch (h) {
			case 0x0000:
				// B(2)
				if (immediate & 0x0400) {
					immediate |= 0xFFFFF800;
				}
				immediate <<= 1;
				op = this.thumbCompiler.constructB2(immediate);
				op.writesPC = true;
				break;
			case 0x0800:
				// BLX (ARMv5T)
				/*op = function() {
					var pc = gprs[cpu.PC];
					gprs[cpu.PC] = (gprs[cpu.LR] + (immediate << 1)) & 0xFFFFFFFC;
					gprs[cpu.LR] = pc - 1;
					cpu.switchExecMode(cpu.MODE_ARM);
				}*/
				break;
			case 0x1000:
				// BL(1)
				if (immediate & 0x0400) {
					immediate |= 0xFFFFFC00;
				}
				immediate <<= 12;
				op = this.thumbCompiler.constructBL1(immediate);
				op.writesPC = false;
				break;
			case 0x1800:
				// BL(2)
				op = this.thumbCompiler.constructBL2(immediate);
				op.writesPC = true;
				break;
			}
			break;
		default:
			this.WARN("Undefined instruction: 0x" + instruction.toString(16));
		}
	} else {
		throw 'Bad opcode: 0x' + instruction.toString(16);
	}

	op.execMode = this.MODE_THUMB;
	return op;
};
