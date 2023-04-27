import { PlayerData } from "./PlayerData";

export class Validate {
    player : PlayerData;

    constructor(player : PlayerData) {
        this.player = player;   
    }

    isValid() : boolean {   
        const stringArray = ["Skin of the", "The Annihilating Light", "Brutal Restraint", "Olroth"];
        for(const str of stringArray) {
            const regex = new RegExp(str, "g");
            const count = this.player.pobString.match(regex);
            if(count!=null && count.length>1) {
                this.player.fixArray.push('- PoBs with unused items are not supported by the Bot, please import fresh and post');
                return false;
            }
        }
        return true;
    }
}