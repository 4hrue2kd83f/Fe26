function GameManager(size, InputManager, Actuator, StorageManager) {
	this.size					 = size; // Size of the grid
	this.inputManager	 = new InputManager;
	this.storageManager = new StorageManager;
	this.actuator			 = new Actuator;

	this.version = 0.8;

	this.storageManager.clearIfOutdated(this.version);

	this.startTiles		 = 2;
	this.winningValue = "56Iron";

	this.inputManager.on("move", this.move.bind(this));
	this.inputManager.on("restart", this.restart.bind(this));
	this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

	this.setup();
	return this;
}

// Restart the game
GameManager.prototype.restart = function () {
	this.storageManager.clearGameState();
	this.actuator.continueGame(); // Clear the game won/lost message
	this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
	this.keepPlaying = true;
	this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
	if (this.over || (this.won && !this.keepPlaying)) {
		return true;
	} else {
		return false;
	}
};

// Set up the game
GameManager.prototype.setup = function () {
	var previousState = this.storageManager.getGameState();

	// Reload the game from a previous game if present
	if (previousState) {
		this.grid				= new Grid(previousState.grid.size,
																previousState.grid.cells); // Reload grid
		this.score			 = previousState.score;
		this.over				= previousState.over;
		this.won				 = previousState.won;
		this.keepPlaying = previousState.keepPlaying;
	} else {
		this.grid				= new Grid(this.size);
		this.score			 = 0;
		this.over				= false;
		this.won				 = false;
		this.keepPlaying = false;

		// Add the initial tiles
		this.addStartTiles();
	}

	// Update the actuator
	this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
	for (var i = 0; i < this.startTiles; i++) {
		this.addRandomTile();
	}
};


// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
	if (this.grid.cellsAvailable()) {
		var value = Math.random() < 0.2 ? "Neutron" : 0.75 ? "Hydrogen" : Math.random() < 0.96 ? "4Helium" : "7Lithium";
//		var value = "12Carbon";
		var tile = new Tile(this.grid.randomAvailableCell(), value, this.labels[value]);
		this.grid.insertTile(tile);
	}
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
	if (this.storageManager.getBestScore() < this.score) {
		this.storageManager.setBestScore(this.score);
	}

	// Clear the state when the game is over (game over only, not win)
	if (this.over) {
		this.storageManager.clearGameState();
	} else {
		this.storageManager.setGameState(this.serialize());
	}

	this.actuator.actuate(this.grid, {
		score:			this.score,
		over:			 this.over,
		won:				this.won,
		bestScore:	this.storageManager.getBestScore(),
		terminated: this.isGameTerminated()
	});

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
	return {
		grid:				this.grid.serialize(),
		score:			 this.score,
		over:				this.over,
		won:				 this.won,
		keepPlaying: this.keepPlaying
	};
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
	this.grid.eachCell(function (x, y, tile) {
		if (tile) {
			tile.mergedFrom = null;
			tile.savePosition();
		}
	});
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
	this.grid.cells[tile.x][tile.y] = null;
	this.grid.cells[cell.x][cell.y] = tile;
	tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
	// 0: up, 1: right, 2: down, 3: left
	var self = this;

	if (this.isGameTerminated()) return; // Don't do anything if the game's over

	var cell, tile;

	var vector		 = this.getVector(direction);
	var traversals = this.buildTraversals(vector);
	var moved			= false;

	// Save the current tile positions and remove merger information
	this.prepareTiles();

	// Traverse the grid in the right direction and move tiles
	traversals.x.forEach(function (x) {
		traversals.y.forEach(function (y) {
			cell = { x: x, y: y };
			tile = self.grid.cellContent(cell);

			if (tile) {
				var positions = self.findFarthestPosition(cell, vector);
				var next			= self.grid.cellContent(positions.next);

				// Only one merger per row traversal?
				var shouldMove = true;
				if (next && !next.mergedFrom) {
					//if(next.value === tile.value) {
					if( self.canFuse(next.value,tile.value) ) {
						shouldMove = false;
						var fusionValue = self.fusion(next.value,tile.value);
						var merged = new Tile(positions.next, fusionValue, self.labels[fusionValue]);
						merged.mergedFrom = [tile, next];

						var decay = self.decay[fusionValue] || false;

						if(decay !== false) {
							merged.movesLeft = Math.floor(Math.random() * (Math.ceil(8*decay['multipler']) - Math.ceil(4*decay['multipler']) + 1)) + Math.ceil(4*decay['multipler']);
						}

						self.grid.insertTile(merged);
						self.grid.removeTile(tile);

						// Converge the two tiles' positions
						tile.updatePosition(positions.next);

						// Update the score
						self.score += self.pointValues[merged.value];

						// TODO win state ( if not decaying )
						if (merged.value === self.winningValue) self.won = true;
					}
				}
				if (shouldMove) {
					self.moveTile(tile, positions.farthest);
				}

				if (!self.positionsEqual(cell, tile)) {
					moved = true; // The tile moved from its original cell!
				}
			}
		});
	});

	if (moved) {
		this.addRandomTile();

		this.grid.eachCell(function(x, y, tile) {
			if(tile !== null && self.decay[tile.value] && tile.decay()) {
				var decayValue = self.decay[tile.value]['to'];
				var decayed = new Tile({
					x: tile.x,
					y: tile.y
				}, decayValue, self.labels[decayValue]);
				self.grid.removeTile(tile);
				self.grid.insertTile(decayed);

				self.score += self.decay[tile.value].points;

				if (decayed.value === self.winningValue) self.won = true;
			}
		});

		if (!this.movesAvailable()) {
			this.over = true; // Game over!
		}

		this.actuate();
	}
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
	// Vectors representing tile movement
	var map = {
		0: { x: 0,	y: -1 }, // Up
		1: { x: 1,	y: 0 },	// Right
		2: { x: 0,	y: 1 },	// Down
		3: { x: -1, y: 0 }	 // Left
	};

	return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
	var traversals = { x: [], y: [] };

	for (var pos = 0; pos < this.size; pos++) {
		traversals.x.push(pos);
		traversals.y.push(pos);
	}

	// Always traverse from the farthest cell in the chosen direction
	if (vector.x === 1) traversals.x = traversals.x.reverse();
	if (vector.y === 1) traversals.y = traversals.y.reverse();

	return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
	var previous;

	// Progress towards the vector direction until an obstacle is found
	do {
		previous = cell;
		cell		 = { x: previous.x + vector.x, y: previous.y + vector.y };
	} while (this.grid.withinBounds(cell) &&
					 this.grid.cellAvailable(cell));

	return {
		farthest: previous,
		next: cell // Used to check if a merge is required
	};
};

GameManager.prototype.movesAvailable = function () {
	return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
	var self = this;

	var tile;

	for (var x = 0; x < this.size; x++) {
		for (var y = 0; y < this.size; y++) {
			tile = this.grid.cellContent({ x: x, y: y });

			if (tile) {
				for (var direction = 0; direction < 4; direction++) {
					var vector = self.getVector(direction);
					var cell	 = { x: x + vector.x, y: y + vector.y };

					var other	= self.grid.cellContent(cell);

					if (other && self.canFuse(other.value, tile.value)) {
						return true; // These two tiles can be merged
					}
				}
			}
		}
	}

	return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
	return first.x === second.x && first.y === second.y;
};

GameManager.prototype.canFuse = function (first, second) {
	return (this.fusionRules[first]	&& this.fusionRules[first][second]) ||
				 (this.fusionRules[second] && this.fusionRules[second][first]);
};

GameManager.prototype.fusion = function (first, second) {
	var forward = this.fusionRules[first];
	this.fusionRules;
	if (forward && forward[second]) {
		return forward[second];
	} else {
		var backward = this.fusionRules[second][first];
		return backward;
	}
};

// a:{b:c}
// a + b = c
GameManager.prototype.fusionRules = {
	"Hydrogen":{"Neutron":"Deuterium",
							"Hydrogen":"Deuterium",
							"Deuterium":"3Helium",
							"7Lithium":"8Beryllium",
							"12Carbon":"13Nitrogen",
							"13Carbon":"14Nitrogen",
							"14Nitrogen":"15Oxygen",
							"15Nitrogen":"16Oxygen",
							"23Sodium":"24Magnesium",
						 },
	"Deuterium":{"Deuterium":"Tritium"},
	"Tritium":{"20Neon":"23Sodium"},
	"3Helium":{"3Helium":"4Helium",
							"4Helium":"7Beryllium",
						},
	"4Helium":{"4Helium":"8Beryllium", // unstable decays into 2 4Heliums
						 "8Beryllium":"12Carbon",
						 "12Carbon":"16Oxygen",
						 "16Oxygen":"20Neon",
						 "20Neon":"24Magnesium",
						 "24Magnesium":"28Silicon",
						 "28Silicon":"32Sulfur",
						 "32Sulfur":"36Argon",
						 "36Argon":"40Calcium",
						 "40Calcium":"44Titanium",
						 "44Titanium":"48Chromium",
						 "48Chromium":"52Iron",
						 "52Iron":"56Nickel"
						},
	"12Carbon":{"12Carbon":"20Neon", // + 4Helium (randomness)
						 },
	"16Oxygen":{"16Oxygen":"28Silicon", // + 4Helium
						 },
	"Neutron":{"Hydrogen":"Deuterium",
		"Deuterium":"Tritium",
				"13Carbon":"14Carbon",
				"16Oxygen":"17Oxygen",
				"17Oxygen":"18Oxygen",
				"18Oxygen":"19Fluorine",
				"19Fluorine":"20Neon",
				"56Iron":"57Iron",
				"57Iron":"58Iron",
				"58Iron":"59Cobalt",
				"59Cobalt":"60Nickel",
				"60Nickel":"61Nickel",
				"61Nickel":"62Nickel",
				"62Nickel":"63Nickel",
				"63Nickel":"64Nickel",
				"64Nickel":"65Copper",
				"63Copper":"64Copper",
				"64Copper":"65Copper",
				"65Copper":"66Zinc",
	},
};


GameManager.prototype.labels = {
	"Neutron": "<sup>1</sup>n",
	"Hydrogen": "<sup>1</sup>p",
	"Deuterium": "<sup>2</sup>D",
	"Tritium": "<sup>3</sup>T",
	"3Helium": "<sup>3</sup>He",
	"4Helium": "<sup>4</sup>He",
	"7Lithium": "<sup>7</sup>Li",
	"7Beryllium": "<sup>7</sup>Be",
	"8Beryllium": "<sup>8</sup>Be",
	"12Carbon": "<sup>12</sup>C",
	"13Carbon": "<sup>13</sup>C",
	"14Carbon": "<sup>14</sup>C",
	"13Nitrogen": "<sup>13</sup>N",
	"14Nitrogen": "<sup>14</sup>N",
	"15Nitrogen": "<sup>15</sup>N",
	"15Oxygen": "<sup>15</sup>O",
	"16Oxygen": "<sup>16</sup>O",
	"17Oxygen": "<sup>17</sup>O",
	"18Oxygen": "<sup>18</sup>O",
	"19Fluorine": "<sup>19</sup>F",
	"20Neon": "<sup>20</sup>Ne",
	"23Sodium": "<sup>23</sup>Na",
	"23Magnesium": "<sup>23</sup>Mg",
	"24Magnesium": "<sup>24</sup>Mg",
	"27Aluminum": "<sup>27</sup>Al",
	"28Silicon": "<sup>28</sup>Si",
	"32Sulfur": "<sup>32</sup>S",
	"36Argon": "<sup>36</sup>Ar",
	"40Calcium": "<sup>40</sup>Ca",
	"44Titanium": "<sup>44</sup>Ti",
	"48Chromium": "<sup>48</sup>Cr",
	"52Iron": "<sup>52</sup>Fe",
	"56Iron": "<sup>56</sup>Fe",
	"57Iron": "<sup>57</sup>Fe",
	"58Iron": "<sup>58</sup>Fe",
	"59Cobalt": "<sup>59</sup>Co",
	"56Nickel": "<sup>56</sup>Ni",
	"60Nickel": "<sup>60</sup>Ni",
	"61Nickel": "<sup>61</sup>Ni",
	"62Nickel": "<sup>62</sup>Ni",
	"63Nickel": "<sup>63</sup>Ni",
	"64Nickel": "<sup>64</sup>Ni",
	"63Copper": "<sup>63</sup>Cu",
	"64Copper": "<sup>64</sup>Cu",
	"65Copper": "<sup>65</sup>Cu",
	"66Zinc": "<sup>66</sup>Zn",
};

GameManager.prototype.pointValues = {
	"Deuterium":1,
	"3Helium":1.5,
	"4Helium":2,
	"7Beryllium":3,
	"8Beryllium":4,
	"12Carbon":6,
	"16Oxygen":8,
	"20Neon":10,
	"24Magnesium":12,
	"27Aluminum":13,
	"28Silicon":14,
	"32Sulfur":16,
	"36Argon":18,
	"40Calcium":20,
	"44Titanium":22,
	"48Chromium":24,
	"52Iron":26,
	"56Nickel":28,
	"56Iron":56
};

GameManager.prototype.decay = {
	"Tritium": {
		"multipler": "2.75",
		"to": "3Helium",
	},
	"7Beryllium": {
		"multipler": "2.75",
		"to": "4Helium",
		"points": -3
	},
	"8Beryllium": {
		"multipler": "0.75",
		"to": "4Helium",
		"points": -4
	},
	"14Carbon": {
		"multipler": "3",
		"to": "14Nitrogen"
	},
	"13Nitrogen": {
		"multipler": "2.25",
		"to": "13Carbon"
	},
	"15Oxygen": {
		"multipler": "2.25",
		"to": "15Nitrogen"
	},
	"52Iron": {
		"multipler": "2",
		"to": "48Chromium",
		"points": -26
	},
	"56Nickel": {
		"multipler": "2",
		"to": "56Iron",
		"points": 56
	},
	"63Nickel": {
		"multipler": "3",
		"to": "63Copper",
		"points": 56
	},
	"64Copper": {
		"multipler": "2.5",
		"to": "64Nickel",
		"points": 56
	}
};
