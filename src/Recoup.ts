import { PlayerData } from "./PlayerData";

export class Recoup {

    recoup(playerData : PlayerData) {
        // Mana recoup
        const battleRouse = playerData.treeData.match(/5289/gm);
        if(battleRouse!=null) {
            playerData.manaRecoup = playerData.manaRecoup + 10;
        }

        const manaMastery = playerData.treeData.match(/59064/gm);
        if(manaMastery!=null) {
            playerData.manaRecoup = playerData.manaRecoup + 10;
        }

        const itemRecoup = playerData.pobString.match(/\d[%] of Damage taken Recouped as Mana/gm);

        if(itemRecoup!=null) {
            for(const item of itemRecoup) {
                playerData.manaRecoup = playerData.manaRecoup + parseInt( item.substring(0, 1));
            }
        }
        
        if(playerData.manaRecoup === 0) {
            playerData.fixArray.push('- You are missing Mana Recoup on tree/items');
        }

        if(playerData.manaRecoup < 20) {
            playerData.fixArray.push('- You want 20 or more Mana Recoup, check your tree & items');
        }

        // Life Recoup
        if(playerData.treeData.match(/37403/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 18;
        }
        if(playerData.treeData.match(/2474/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 6;
        }

        if(playerData.treeData.match(/55804/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 6;
        }

        if(playerData.treeData.match(/11784/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 12;
        }

        if(playerData.treeData.match(/4105/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 4;
        }

        if(playerData.treeData.match(/127/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 4;
        }

        if(playerData.treeData.match(/17749/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 6;
        }

        if(playerData.treeData.match(/18747/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 6;
        }

        if(playerData.treeData.match(/52789/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 12;
        }

        const implicitRecoup = playerData.pobString.match(/\d+[%] of Physical Damage taken Recouped as Life/gm);
        if(implicitRecoup!=null) {
            for(const item of implicitRecoup) {
                playerData.lifeRecoup = playerData.lifeRecoup + parseInt( item.substring(0, 2));
            }
        }

        const itemLifeRecoup = playerData.pobString.match(/\d+[%] of Damage taken Recouped as Life/gm)
        if(itemLifeRecoup!=null) {
            for(const item of itemLifeRecoup) {
                playerData.lifeRecoup = playerData.lifeRecoup + parseInt( item.substring(0, 2));
            }
        }        

        const jewelStr = playerData.itemManager?.jewelMap.get(61419);
        if(jewelStr?.match(/Unnatural Instinct/gm)!=null) {
            playerData.lifeRecoup = playerData.lifeRecoup + 12;
        }

        if(playerData.lifeRecoup == 0) {
            playerData.fixArray.push('- You are missing Life Recoup on tree/items')
        }

    }
}