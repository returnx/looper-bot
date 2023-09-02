import { PlayerData } from "./PlayerData";

export class ItemManager {

    itemArray : Map<number, string> = new Map<number, string>;
    equippedItems : string[] = [];
    itemString  = "";
    jewelMap : Map<number, string> = new Map<number, string>;

    items(pd : PlayerData) {
        const itemsLength = pd.pobJson.PathOfBuilding.Items[0].Item.length;

        for(let i =0 ; i <itemsLength; i++) {
            const id = parseInt(pd.pobJson.PathOfBuilding.Items[0].Item[i].$.id);
            this.itemArray.set(id,JSON.stringify(pd.pobJson.PathOfBuilding.Items[0].Item[i]));
        }

        const slotsLength = pd.pobJson.PathOfBuilding.Items[0].ItemSet[0].Slot.length
        for(let i = 0; i < slotsLength; i++ ) {
            const id = parseInt(pd.pobJson.PathOfBuilding.Items[0].ItemSet[0].Slot[i].$.itemId);
            
            if(id!=0) {
                let item = this.itemArray.get(id);
                if(item===undefined) item = "";
                this.equippedItems.push(item);
                this.itemString = this.itemString + item;
            }

        }

        for(let i = 0; i < pd.activeTree.Sockets[0].Socket.length; i++)  {
            const id = parseInt(pd.activeTree.Sockets[0].Socket[i].$.itemId);
            const nodeId = parseInt(pd.activeTree.Sockets[0].Socket[i].$.nodeId);
            let jewel = this.itemArray.get(id);
            if(jewel === undefined) jewel = "";
            this.equippedItems.push(jewel);
            this.jewelMap.set(nodeId,jewel);
            this.itemString = this.itemString + jewel;
        }
    }

}