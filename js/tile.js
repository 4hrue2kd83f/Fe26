const maxFuseableElement = 25;

class Tile {
    constructor(position, protons, neutrons) {
        this.x = position.x;
        this.y = position.y;
        this.z = protons;
        this.n = neutrons;
        this.w = protons + neutrons;
        //      this.label = ("<span class=\"subsup\"><sup>" + this.w + "</sup><sub>" + this.z + "</sub>" + isotopeData[this.z].symbol);
        this.label = ("<sup>" + this.w + "</sup>" + isotopeData[this.z].symbol);
        this.isotopeNumber = this.w - isotopeData[this.z].w;

        this.decayMode = (isotopeData[this.z].isotopes[this.isotopeNumber]);

        if (isotopeData[this.z].isotopes[this.isotopeNumber] == "s") {
            this.movesLeft = -1
        } else {
            this.movesLeft = 5
        }

        this.color = isotopeData[this.z].color;
        this.textColor = isotopeData[this.z].textColor;

        // Special isotope colors
        if (this.z == 1 && this.n == 1) {
            this.color = "#FFFFC0"; // special color for deuterium
        } else if (this.z == 1 && this.n >= 2) {
            this.color = "#FFFFA0"; // special color for tritium
        } else if (this.z == 6 && this.n == 7) {
            this.color = "#505050"; // special color for carbon-13
            this.textColor = "#FFFFFF"
        } else if (this.z == 6 && this.n >= 8) {
            this.color = "#404040"; // special color for carbon-14
            this.textColor = "#FFFFFF";
        } else if (this.z == 7 && this.n >= 8) {
            this.color = "#105050"; // special color for nitrogen-15
            this.textColor = "#FFFFFF";
        }

        this.previousPosition = null;
        this.mergedFrom = null; // Tracks tiles that merged together
    }
    savePosition() {
        this.previousPosition = { x: this.x, y: this.y };
    }
    updatePosition(position) {
        this.x = position.x;
        this.y = position.y;
    }
    serialize() {
        return {
            position: {
                x: this.x,
                y: this.y
            },
            protons: this.z,
            neutrons: this.n,
            movesLeft: this.movesLeft,
            label: this.label
        };
    }
    decay() {
        if (this.movesLeft > 0)
            this.movesLeft -= 1;

        if (this.movesLeft === 0) {
            return true;
            this.movesLeft = -1;
        }

        return false;
    }
}